# Deployment Guide (Rabbit r1)

## Prerequisites

- Rabbit r1 device
- `cloudflared`
- `python3`

## Build

```bash
npm install
npm run validate
npm run test
npm run build
```

This produces `dist/index.html` and updates root `index.html`.
The build also writes:

- `dist/404.html`
- `dist/.nojekyll`

## One-Command Local Install

```bash
./scripts/r1-local.sh
```

Script behavior:

1. Serves `dist/` on `http://127.0.0.1:8000`.
2. Starts Cloudflare quick tunnel.
3. Detects `https://*.trycloudflare.com` URL from tunnel logs.
4. Generates Rabbit Creations QR payload:
   - PNG: `/tmp/r1-qr.png`
   - terminal ASCII QR

Optional overrides:

- `PORT=8001 ./scripts/r1-local.sh`
- `TUNNEL_PROTOCOL=quic ./scripts/r1-local.sh`
- `TUNNEL_EDGE_IP_VERSION=auto ./scripts/r1-local.sh`
- `SERVE_DIR=/path/to/static ./scripts/r1-local.sh`

## Manual Hosted Deployment

Host `dist/index.html` on any HTTPS static host (Netlify, Vercel, GitHub Pages). Then generate a Rabbit Creations QR using your hosted URL.

## GitHub Pages Deployment

This repo includes `/Users/jignesh/dev/minimax-ws/math-kangaroo-game-r1/.github/workflows/pages.yml`, which builds and deploys `dist/` to GitHub Pages.

Setup:

1. Push the repository to GitHub.
2. In repository settings, open **Pages**.
3. Set the publishing source to **GitHub Actions**.
4. Push to `main` or `master`, or run the workflow manually.

The deployed site URL will be the stable Pages URL for your repo, for example:

- `https://<user>.github.io/<repo>/`

Generate the r1 install QR from that hosted URL:

```bash
./scripts/r1-qr.sh https://<user>.github.io/<repo>/
```

## Verification Checklist

- Grade and mode selectors are interactive.
- Start button launches game reliably.
- Grade 1-2 contest uses 24 questions and a 75-minute timer.
- Practice mode uses Diagnostic/Mastery/Mock cycle.
- Coach overlay appears after wrong answers in practice and on demand.
- Game Boy and Neon themes have legible text and controls.
- Screen fits Rabbit r1 dimensions (240x282) without clipped actions.
