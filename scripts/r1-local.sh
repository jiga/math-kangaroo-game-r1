#!/usr/bin/env bash
set -euo pipefail

PORT="${PORT:-8000}"
HOST="${HOST:-127.0.0.1}"
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SERVE_DIR="${SERVE_DIR:-${ROOT_DIR}/dist}"
TUNNEL_LOG="${TUNNEL_LOG:-/tmp/r1-tunnel.log}"
TUNNEL_PROTOCOL="${TUNNEL_PROTOCOL:-http2}"
TUNNEL_EDGE_IP_VERSION="${TUNNEL_EDGE_IP_VERSION:-4}"

if [ ! -d "${SERVE_DIR}" ]; then
  SERVE_DIR="${ROOT_DIR}"
fi

if ! command -v cloudflared >/dev/null 2>&1; then
  echo "cloudflared is not installed. Install it with: brew install cloudflared"
  exit 1
fi

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required."
  exit 1
fi

cleanup() {
  if [ -n "${SERVER_PID:-}" ] && [ "${SERVER_PID}" != "0" ]; then
    kill "${SERVER_PID}" >/dev/null 2>&1 || true
  fi
  if [ -n "${TUNNEL_PID:-}" ] && [ "${TUNNEL_PID}" != "0" ]; then
    kill "${TUNNEL_PID}" >/dev/null 2>&1 || true
  fi
}
trap cleanup EXIT

echo "Serving ${SERVE_DIR} at http://${HOST}:${PORT}"
python3 -m http.server "${PORT}" --bind "${HOST}" --directory "${SERVE_DIR}" >/dev/null 2>&1 &
SERVER_PID=$!

echo "Starting Cloudflare tunnel (protocol: ${TUNNEL_PROTOCOL}, edge-ip: ${TUNNEL_EDGE_IP_VERSION})..."
rm -f "${TUNNEL_LOG}"
: > "${TUNNEL_LOG}"
cloudflared tunnel --url "http://${HOST}:${PORT}" --protocol "${TUNNEL_PROTOCOL}" --edge-ip-version "${TUNNEL_EDGE_IP_VERSION}" --loglevel info --logfile "${TUNNEL_LOG}" >/dev/null 2>&1 &
TUNNEL_PID=$!

echo "Waiting for public URL..."
PUBLIC_URL=""
for _ in {1..60}; do
  PUBLIC_URL="$({
    python3 - "${TUNNEL_LOG}" <<'PY'
import pathlib, re, sys
text = pathlib.Path(sys.argv[1]).read_text(errors="ignore")
hits = re.findall(r'https://[A-Za-z0-9.-]+\.trycloudflare\.com', text)
if hits:
    print(hits[-1])
PY
  } || true)"
  if [ -n "${PUBLIC_URL}" ]; then
    break
  fi
  sleep 1
done

if [ -z "${PUBLIC_URL}" ]; then
  echo "Could not detect Cloudflare URL. Check ${TUNNEL_LOG}"
  echo "Last log lines:"
  tail -n 20 "${TUNNEL_LOG}" || true
  wait "${TUNNEL_PID}"
  exit 1
fi

echo "Public URL: ${PUBLIC_URL}"
"${ROOT_DIR}/scripts/r1-qr.sh" "${PUBLIC_URL}"

wait "${TUNNEL_PID}"
