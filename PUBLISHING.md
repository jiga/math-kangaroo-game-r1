# Publishing Guide

This repository is configured for a source-first public GitHub workflow.

## Current Public Endpoints

- Repository: `https://github.com/jiga/math-kangaroo-game-r1`
- GitHub Pages: `https://jiga.github.io/math-kangaroo-game-r1/`

## Source Of Truth

- Edit source under `src/`
- Build output is generated into `dist/`
- `dist/` is deployed by GitHub Actions
- `index.html` at the repo root is a generated compatibility copy

Do not hand-edit generated output.

## Standard Publish Flow

1. Run local checks:
   - `npm run validate`
   - `npm run test`
   - `npm run build`
2. Review changes:
   - `git status`
   - `git diff --stat`
3. Commit to `main`:
   - `git add -A`
   - `git commit -m "Your message"`
   - `git push origin main`
4. Wait for GitHub Actions:
   - `CI`
   - `Deploy Pages`
5. Verify the deployed site:
   - `https://jiga.github.io/math-kangaroo-game-r1/`
6. Generate a fresh r1 QR from the Pages URL:
   - `./scripts/r1-qr.sh https://jiga.github.io/math-kangaroo-game-r1/`

## GitHub Pages Notes

- Pages is configured to deploy via `.github/workflows/pages.yml`
- `dist/` is built during CI and uploaded as the Pages artifact
- `dist/` does not need to be committed
- The site is static and HTTPS-hosted, which matches Rabbit r1 install requirements

## Repo Hygiene

Before publishing, confirm:

- no secrets in source, docs, logs, or screenshots
- no local-only temp files in `git status`
- generated QR files remain outside the repo
- screenshots under `output/` are only committed intentionally

## Recommended Release Practice

- use short, factual commit messages
- keep UI and question-bank changes separate when practical
- attach device screenshots to GitHub releases or issues when a change affects layout
