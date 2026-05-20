#!/usr/bin/env bash
set -euo pipefail

PORT="${PREVIEW_PORT:-5173}"
HOST="${PREVIEW_HOST:-127.0.0.1}"
HEALTH_PATH="${HEALTH_PATH:-/api/health}"
CLEANUP=false
TIMEOUT_SECONDS="${PREVIEW_STOP_TIMEOUT_SECONDS:-5}"

if [[ "${1:-}" == "--cleanup" ]]; then
  CLEANUP=true
fi

health_url="http://${HOST}:${PORT}${HEALTH_PATH}"

listener_pids() {
  if command -v lsof >/dev/null 2>&1; then
    lsof -tiTCP:"${PORT}" -sTCP:LISTEN 2>/dev/null || true
    return
  fi
  if command -v fuser >/dev/null 2>&1; then
    fuser "${PORT}/tcp" 2>/dev/null | tr ' ' '\n' | sed '/^$/d' || true
    return
  fi
  if command -v ss >/dev/null 2>&1; then
    ss -ltnp "sport = :${PORT}" 2>/dev/null \
      | sed -n 's/.*pid=\([0-9][0-9]*\).*/\1/p' \
      | sort -u || true
    return
  fi
  echo "preview_preflight: no lsof/fuser/ss available to inspect port ${PORT}" >&2
  return 1
}

is_healthy() {
  command -v curl >/dev/null 2>&1 && curl -fsS --max-time 2 "${health_url}" >/dev/null
}

kill_process_group_for_pid() {
  local pid="$1"
  local pgid
  pgid="$(ps -o pgid= -p "${pid}" 2>/dev/null | tr -d ' ' || true)"
  local current_pgid
  current_pgid="$(ps -o pgid= -p "$$" 2>/dev/null | tr -d ' ' || true)"
  if [[ -n "${pgid}" && "${pgid}" != "1" && "${pgid}" != "${current_pgid}" ]]; then
    kill -TERM "-${pgid}" 2>/dev/null || kill -TERM "${pid}" 2>/dev/null || true
  else
    kill -TERM "${pid}" 2>/dev/null || true
  fi
}

force_kill_process_group_for_pid() {
  local pid="$1"
  local pgid
  pgid="$(ps -o pgid= -p "${pid}" 2>/dev/null | tr -d ' ' || true)"
  local current_pgid
  current_pgid="$(ps -o pgid= -p "$$" 2>/dev/null | tr -d ' ' || true)"
  if [[ -n "${pgid}" && "${pgid}" != "1" && "${pgid}" != "${current_pgid}" ]]; then
    kill -KILL "-${pgid}" 2>/dev/null || kill -KILL "${pid}" 2>/dev/null || true
  else
    kill -KILL "${pid}" 2>/dev/null || true
  fi
}

wait_port_free() {
  local deadline=$((SECONDS + TIMEOUT_SECONDS))
  while (( SECONDS < deadline )); do
    if [[ -z "$(listener_pids | tr -d '\n')" ]]; then
      return 0
    fi
    sleep 0.2
  done
  return 1
}

pids=()
while IFS= read -r pid; do
  [[ -n "${pid}" ]] && pids+=("${pid}")
done < <(listener_pids)
if [[ "${#pids[@]}" -eq 0 ]]; then
  echo "preview_preflight: port ${PORT} is free"
  exit 10
fi

if is_healthy; then
  echo "preview_preflight: existing preview is healthy at ${health_url}; reuse it"
  exit 0
fi

echo "preview_preflight: port ${PORT} is occupied but unhealthy: pids=${pids[*]}" >&2

if [[ "${CLEANUP}" != true ]]; then
  exit 20
fi

for pid in "${pids[@]}"; do
  kill_process_group_for_pid "${pid}"
done

if ! wait_port_free; then
  pids=()
  while IFS= read -r pid; do
    [[ -n "${pid}" ]] && pids+=("${pid}")
  done < <(listener_pids)
  for pid in "${pids[@]}"; do
    force_kill_process_group_for_pid "${pid}"
  done
fi

if wait_port_free; then
  echo "preview_preflight: cleaned unhealthy preview listeners on port ${PORT}"
  exit 10
fi

echo "preview_preflight: failed to free port ${PORT}" >&2
exit 30
