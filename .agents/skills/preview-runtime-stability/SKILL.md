---
name: preview-runtime-stability
description: Diagnose and fix managed preview startup failures for TanStack Start or Vite apps in UNS-SWE executor sandboxes. Use when the user reports "Failed to load preview", "Preview loading timed out", preview_start, preview/status, live preview, Vite dev server, port 5173, /api/health, stale npm/node processes, or sandbox preview process cleanup problems.
---

# Preview Runtime Stability

## Purpose

Use this skill when the user says `Failed to load preview`, `Preview loading timed out`, or when a managed preview is stuck, repeatedly times out, or reports port conflicts such as `Port 5173 is already in use`. The goal is to make preview start/stop idempotent inside one executor Pod.

## Core Diagnosis

A preview failure is usually not an app build problem when all are true:

- `npm install` or dependency restore completed successfully.
- `npm run build` succeeds.
- Preview logs include `Port 5173 is in use` or `trying another one`.
- The platform keeps probing the declared preview port, usually `5173`.

Likely root cause: an old `npm -> sh -> node/vite` process chain survived preview stop/restart and still owns the declared port.

## Preview Port Contract

For TanStack Start or Vite apps in UNS-SWE templates, keep the preview/dev server on port `5173` consistently.

- Set `[[services]].localPort = 5173` in `artifact.toml` when the service is used for managed preview/runtime in this template.
- Set `[services.preview].port = 5173`.
- Ensure `[services.preview].args` starts dev with `--host 0.0.0.0 --port 5173`.
- Ensure `package.json` `scripts.dev` starts Vite/TanStack on port `5173`, for example `vite dev --host 0.0.0.0 --port 5173`.
- Do not leave preview on `3000`, `3001`, or allow Vite to drift to `5174/5175`; keep `artifact.toml` and `package.json` synchronized.

## Known Error Playbooks

### Artifact preview port mismatch

Error example:

```text
cannot restart preview: restart preview: parse artifact.toml: artifact: service "web" preview.port=3000 but must be 5173 (PreviewPort constant)
```

This is a configuration error, not a runtime process conflict. Do not keep retrying preview restart before fixing the files.

Fix sequence:

1. Open `artifact.toml` and find the `web` service.
2. Set `[services.preview].port = 5173`.
3. Ensure `[services.preview].args` passes `--host 0.0.0.0 --port 5173` to the dev server.
4. Keep `[[services]].localPort` aligned with the preview/runtime contract when this template is used for managed preview.
5. Open `package.json` and ensure `scripts.dev` starts Vite/TanStack on port `5173`, for example `vite dev --host 0.0.0.0 --port 5173`.
6. Retry preview only after the artifact and package script are synchronized.

### Preview loading timed out

Error example:

```text
Preview loading timed out. Try refreshing and send this error to the agent if the problem persists.
```

Treat this as a readiness failure. First determine whether the dev server is absent, bound to the wrong port, unhealthy, or still compiling.

Fix sequence:

1. Check preview logs before changing code. Look for install failures, build errors, route/runtime exceptions, or Vite binding to a port other than `5173`.
2. Verify `artifact.toml` uses preview port `5173` and the preview args include `--host 0.0.0.0 --port 5173`.
3. Verify `package.json` `scripts.dev` also uses port `5173`; if it omits `--port 5173`, add it.
4. Probe `http://127.0.0.1:5173/api/health` from inside the sandbox when possible.
5. If the port is occupied but health is not 2xx, run the preflight cleanup and restart preview.
6. If the server is compiling slowly but healthy afterward, increase the configured preview health timeout only when the app consistently needs more startup time.
7. If health never succeeds, fix the application runtime error or missing `/api/health` route before retrying preview.

## Required Runtime Behavior

Before every preview start:

1. Check whether the declared preview port is already listening.
2. If occupied, probe `http://127.0.0.1:${PREVIEW_PORT}/api/health`.
3. If health is 2xx, reuse the running preview and return ready instead of starting a second process.
4. If occupied but unhealthy, kill the old preview process group, wait for the port to free, then start the new preview.
5. If the port is free, start preview normally.

When preview stop/restart runs:

1. Stop by process group, not only by parent PID.
2. Send SIGTERM first.
3. Wait a few seconds.
4. If the process group or port is still alive, send SIGKILL.
5. Verify the declared port is free, unless the preview was intentionally reused because it is healthy.

For each session:

- Allow only one preview supervisor/task at a time.
- A new start request should reuse a healthy running preview, or replace an unhealthy one under a session-level lock.
- Do not allow Vite to silently drift from `5173` to `5174/5175`; use strict port behavior or treat drift as failure.

## Bundled Scripts

Use these scripts as reference implementations or direct smoke tests in the sandbox:

- `scripts/preview_preflight.sh` checks the port, probes health, and optionally cleans unhealthy listeners.
- `scripts/preview_stop_process_group.sh` stops a preview by PID/PGID or by the listener on the preview port.
- `scripts/test_preview_port_lifecycle.sh` verifies healthy reuse and unhealthy cleanup behavior with temporary Node test servers.

## Suggested Commands

Run preflight before starting preview:

```bash
PREVIEW_PORT=5173 HEALTH_PATH=/api/health ./.agents/skills/preview-runtime-stability/scripts/preview_preflight.sh --cleanup
```

Stop preview robustly:

```bash
PREVIEW_PORT=5173 ./.agents/skills/preview-runtime-stability/scripts/preview_stop_process_group.sh
```

Run the lifecycle test:

```bash
./.agents/skills/preview-runtime-stability/scripts/test_preview_port_lifecycle.sh
```

## Implementation Notes

- Prefer `127.0.0.1` for in-Pod health checks.
- Record `pid`, `pgid`, `session_id`, `task_id`, `port`, and `health_url` for every preview start.
- Add logs for `port_occupied`, `health_status`, `reuse_existing_preview`, `cleanup_unhealthy_preview`, `sigterm_sent`, `sigkill_sent`, and `port_free_after_stop`.
- If `lsof` is unavailable in the image, install it or provide an equivalent port-to-PID resolver. The bundled scripts can also use `fuser` or `ss` when available.
