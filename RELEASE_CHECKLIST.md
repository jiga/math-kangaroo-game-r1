# Release Checklist

## Before Merge / Push

- `npm run validate`
- `npm run test`
- `npm run build`
- verify no unexpected console errors in browser
- verify Grade 1 and Grade 2 still start in all three modes
- verify at least one visual question family renders correctly
- verify coach/help overlay is readable in both themes
- verify Game Boy and Neon key labels remain legible

## r1-Specific UI Checks

- home screen fits within the r1 creation viewport
- game HUD stays visible without hiding question controls
- long question content can be reached by touch scroll
- long question content can be reached by r1 `scrollUp` / `scrollDown`
- bottom answer choices remain reachable when a visual is present
- overlay help body scrolls when content is longer than the card

## Content Checks

- Grade 1-2 contest format remains `24 questions / 75 minutes / 5 options / 8-8-8 point tiers`
- wrong answers do not reduce score
- explanations are deterministic and match the actual answer
- no question has duplicate options
- visual questions include usable alt text

## Deployment Checks

- push to `main`
- confirm `CI` passes on GitHub
- confirm `Deploy Pages` passes on GitHub
- open `https://jiga.github.io/math-kangaroo-game-r1/`
- generate a fresh QR:
  - `./scripts/r1-qr.sh https://jiga.github.io/math-kangaroo-game-r1/`
- scan the QR on r1 and verify install/update succeeds

## Post-Deploy Smoke Test

- open home screen
- start Grade 1 contest
- start Grade 2 practice
- open HELP and test `HINT`, `STEPS`, and `WHY`
- test hardware scroll on a long question
- confirm no clipped buttons on the bottom row
