#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PORT="${PREVIEW_PORT:-5173}"
TMP_DIR="$(mktemp -d)"

cleanup() {
  PREVIEW_PORT="${PORT}" "${SCRIPT_DIR}/preview_stop_process_group.sh" >/dev/null 2>&1 || true
  rm -rf "${TMP_DIR}"
}
trap cleanup EXIT

cat > "${TMP_DIR}/healthy.mjs" <<'NODE'
import http from 'node:http';
const port = Number(process.env.PREVIEW_PORT || 5173);
http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(200, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: true }));
    return;
  }
  res.writeHead(200);
  res.end('healthy preview');
}).listen(port, '127.0.0.1');
NODE

cat > "${TMP_DIR}/unhealthy.mjs" <<'NODE'
import http from 'node:http';
const port = Number(process.env.PREVIEW_PORT || 5173);
http.createServer((req, res) => {
  if (req.url === '/api/health') {
    res.writeHead(500, { 'content-type': 'application/json' });
    res.end(JSON.stringify({ ok: false }));
    return;
  }
  res.writeHead(200);
  res.end('unhealthy preview');
}).listen(port, '127.0.0.1');
NODE

wait_for_port() {
  local deadline=$((SECONDS + 5))
  while (( SECONDS < deadline )); do
    if curl -fsS --max-time 1 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

PREVIEW_PORT="${PORT}" "${SCRIPT_DIR}/preview_stop_process_group.sh" >/dev/null 2>&1 || true

env PREVIEW_PORT="${PORT}" node "${TMP_DIR}/healthy.mjs" >/tmp/preview-healthy-test.log 2>&1 &
healthy_pid=$!
disown "${healthy_pid}" 2>/dev/null || true
wait_for_port

set +e
PREVIEW_PORT="${PORT}" "${SCRIPT_DIR}/preview_preflight.sh" >/tmp/preview-preflight-healthy.log 2>&1
healthy_status=$?
set -e
if [[ "${healthy_status}" -ne 0 ]]; then
  echo "expected healthy preview reuse exit code 0, got ${healthy_status}" >&2
  cat /tmp/preview-preflight-healthy.log >&2
  exit 1
fi
if ! kill -0 "${healthy_pid}" 2>/dev/null; then
  echo "healthy preview should have been reused, not killed" >&2
  exit 1
fi

PREVIEW_PORT="${PORT}" "${SCRIPT_DIR}/preview_stop_process_group.sh" >/dev/null
wait "${healthy_pid}" 2>/dev/null || true

env PREVIEW_PORT="${PORT}" node "${TMP_DIR}/unhealthy.mjs" >/tmp/preview-unhealthy-test.log 2>&1 &
unhealthy_pid=$!
disown "${unhealthy_pid}" 2>/dev/null || true
wait_for_port

set +e
PREVIEW_PORT="${PORT}" "${SCRIPT_DIR}/preview_preflight.sh" --cleanup >/tmp/preview-preflight-unhealthy.log 2>&1
cleanup_status=$?
set -e
if [[ "${cleanup_status}" -ne 10 ]]; then
  echo "expected unhealthy cleanup to return port-free exit code 10, got ${cleanup_status}" >&2
  cat /tmp/preview-preflight-unhealthy.log >&2
  exit 1
fi
wait "${unhealthy_pid}" 2>/dev/null || true

set +e
curl -fsS --max-time 1 "http://127.0.0.1:${PORT}/" >/dev/null 2>&1
still_serving=$?
set -e
if [[ "${still_serving}" -eq 0 ]]; then
  echo "unhealthy preview still serves after cleanup" >&2
  exit 1
fi

echo "preview lifecycle test passed on port ${PORT}"
