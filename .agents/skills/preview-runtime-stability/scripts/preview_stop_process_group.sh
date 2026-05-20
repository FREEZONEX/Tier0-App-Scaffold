#!/usr/bin/env bash
set -euo pipefail

PORT="${PREVIEW_PORT:-5173}"
PID="${PREVIEW_PID:-}"
PGID="${PREVIEW_PGID:-}"
TIMEOUT_SECONDS="${PREVIEW_STOP_TIMEOUT_SECONDS:-5}"

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
  return 0
}

resolve_pgid() {
  local pid="$1"
  ps -o pgid= -p "${pid}" 2>/dev/null | tr -d ' ' || true
}

term_target() {
  local current_pgid
  current_pgid="$(ps -o pgid= -p "$$" 2>/dev/null | tr -d ' ' || true)"
  if [[ -n "${PGID}" && "${PGID}" != "${current_pgid}" ]]; then
    kill -TERM "-${PGID}" 2>/dev/null || true
    return
  fi
  if [[ -n "${PID}" ]]; then
    local resolved
    resolved="$(resolve_pgid "${PID}")"
    if [[ -n "${resolved}" && "${resolved}" != "1" && "${resolved}" != "${current_pgid}" ]]; then
      kill -TERM "-${resolved}" 2>/dev/null || kill -TERM "${PID}" 2>/dev/null || true
    else
      kill -TERM "${PID}" 2>/dev/null || true
    fi
    return
  fi
  while read -r listener_pid; do
    [[ -z "${listener_pid}" ]] && continue
    local resolved
    resolved="$(resolve_pgid "${listener_pid}")"
    if [[ -n "${resolved}" && "${resolved}" != "1" && "${resolved}" != "${current_pgid}" ]]; then
      kill -TERM "-${resolved}" 2>/dev/null || kill -TERM "${listener_pid}" 2>/dev/null || true
    else
      kill -TERM "${listener_pid}" 2>/dev/null || true
    fi
  done < <(listener_pids)
}

kill_target() {
  local current_pgid
  current_pgid="$(ps -o pgid= -p "$$" 2>/dev/null | tr -d ' ' || true)"
  if [[ -n "${PGID}" && "${PGID}" != "${current_pgid}" ]]; then
    kill -KILL "-${PGID}" 2>/dev/null || true
    return
  fi
  if [[ -n "${PID}" ]]; then
    local resolved
    resolved="$(resolve_pgid "${PID}")"
    if [[ -n "${resolved}" && "${resolved}" != "1" && "${resolved}" != "${current_pgid}" ]]; then
      kill -KILL "-${resolved}" 2>/dev/null || kill -KILL "${PID}" 2>/dev/null || true
    else
      kill -KILL "${PID}" 2>/dev/null || true
    fi
    return
  fi
  while read -r listener_pid; do
    [[ -z "${listener_pid}" ]] && continue
    local resolved
    resolved="$(resolve_pgid "${listener_pid}")"
    if [[ -n "${resolved}" && "${resolved}" != "1" && "${resolved}" != "${current_pgid}" ]]; then
      kill -KILL "-${resolved}" 2>/dev/null || kill -KILL "${listener_pid}" 2>/dev/null || true
    else
      kill -KILL "${listener_pid}" 2>/dev/null || true
    fi
  done < <(listener_pids)
}

port_is_free() {
  [[ -z "$(listener_pids | tr -d '\n')" ]]
}

term_target

deadline=$((SECONDS + TIMEOUT_SECONDS))
while (( SECONDS < deadline )); do
  if port_is_free; then
    echo "preview_stop: port ${PORT} is free"
    exit 0
  fi
  sleep 0.2
done

kill_target
sleep 0.5

if port_is_free; then
  echo "preview_stop: force-stopped preview on port ${PORT}"
  exit 0
fi

echo "preview_stop: port ${PORT} is still occupied" >&2
exit 1
