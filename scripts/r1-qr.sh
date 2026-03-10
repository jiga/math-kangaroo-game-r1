#!/usr/bin/env bash
set -euo pipefail

URL="${1:-${PUBLIC_URL:-}}"
QR_VENV="${QR_VENV:-/tmp/qr-venv}"
QR_OUT="${QR_OUT:-/tmp/r1-qr.png}"

if [ -z "${URL}" ]; then
  echo "Usage: ./scripts/r1-qr.sh <https-url>"
  exit 1
fi

case "${URL}" in
  https://*) ;;
  *)
    echo "URL must start with https://"
    exit 1
    ;;
esac

if ! command -v python3 >/dev/null 2>&1; then
  echo "python3 is required."
  exit 1
fi

if [ -d "${QR_VENV}" ] && [ ! -f "${QR_VENV}/pyvenv.cfg" ]; then
  rm -rf "${QR_VENV}"
fi

if [ ! -d "${QR_VENV}" ] || [ ! -x "${QR_VENV}/bin/python" ] || [ ! -f "${QR_VENV}/pyvenv.cfg" ]; then
  python3 -m venv "${QR_VENV}"
fi

if [ ! -x "${QR_VENV}/bin/pip" ]; then
  "${QR_VENV}/bin/python" -m ensurepip --upgrade >/dev/null 2>&1 || true
fi

if ! "${QR_VENV}/bin/python" - <<'PY' >/dev/null 2>&1; then
import qrcode
PY
  "${QR_VENV}/bin/python" -m pip install -q "qrcode[pil]"
fi

"${QR_VENV}/bin/python" - <<PY
import json
import qrcode

payload = {
  "title": "Math Kangaroo Adventure",
  "url": "${URL}",
  "description": "Grade 1-2 Math Kangaroo trainer with adaptive practice and contest mode.",
  "iconUrl": "",
  "themeColor": "#00e5ff"
}

data = json.dumps(payload, separators=(",", ":"))
img = qrcode.make(data)
img.save("${QR_OUT}")
print(f"Install URL: ${URL}")
print(f"QR code saved to ${QR_OUT}")
print("QR code (terminal):")
qr = qrcode.QRCode(border=1)
qr.add_data(data)
qr.make(fit=True)
qr.print_ascii(invert=True)
PY
