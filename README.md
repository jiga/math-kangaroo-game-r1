# Math Kangaroo R1 (Production Grade 1-12 Trainer)

This build is optimized for Rabbit r1 and now supports Grade 1-12 competition preparation with banded content, guided lessons, official-format mocks, adaptive practice progression, deterministic coaching, and optional LLM enrichment.

Related docs:

- `DEPLOY.md` - deployment and local install flow
- `PUBLISHING.md` - public GitHub repo and Pages publishing flow
- `RELEASE_CHECKLIST.md` - pre-release and post-deploy checklist

## What Changed

- Modular source architecture under `src/` with generated single-file output.
- Grade 1-2 question bank rebuilt from curriculum coverage map.
- Grade 3-12 migrated onto the same banded architecture, with guided lessons and official mock sizing by band.
- Contest fidelity by official Math Kangaroo band:
  - 24 questions
  - 75 minutes
  - 5 options per question
  - 3/4/5 point tiers
  - no wrong-answer penalty
- Practice progression:
  - `Diagnostic -> Mastery -> Mock`
- Visual puzzle support across the bands (SVG):
  - mazes
  - broken lines/perimeter
  - pictographs
  - Venn diagrams
  - cube/cuboid visuals
  - symmetry
  - region compare
- Deterministic per-skill coaching with optional LLM rewrite layer.
- Voice queue synchronization to avoid stale/out-of-order speech.
- Persistent on-device profile (`localStorage` key: `mk_profile_v2`).
- Grade 3-12 now run through the same banded content pipeline as Grade 1-2, with guided lessons, adaptive practice, and official-format contest generation by band.

## Structure

```text
src/
  app/
    template.html
    styles.css
    main.ts
  domain/
    types.ts
  content/
    g1g2/
      coverage-map.json
      templates.ts
      bank.ts
    bands/
      g12/
      g34/
      g56/
      g78/
      g910/
      g1112/
      guidedFactory.ts
      visuals.ts
      index.ts
    validateBank.ts
  engine/
    practiceEngine.ts
  coach/
    deterministicCoach.ts
    llmAdapter.ts
  audio/
    ttsQueue.ts
  storage/
    profileStore.ts
  render/
    visualQuestionRenderer.ts

dist/
  index.html

scripts/
  build.mjs
  r1-local.sh
```

## Build and Validate

- Install deps: `npm install`
- Validate Grade 1-12 coverage and schema: `npm run validate`
- Run tests: `npm run test`
- Build single-file artifact: `npm run build`

Build writes:

- `dist/index.html`
- `dist/404.html`
- `dist/.nojekyll`
- `index.html` (compatibility copy)

`dist/` is the publishable static site for GitHub Pages and other static hosts.

## Local r1 Install Flow

Use one command:

- `./scripts/r1-local.sh`

What it does:

1. Serves `dist/` by default.
2. Opens a quick Cloudflare tunnel.
3. Generates a valid Rabbit Creations payload QR PNG.
4. Prints terminal ASCII QR for quick scan.

## GitHub Pages

This repo is ready to deploy `dist/` to GitHub Pages with GitHub Actions.

After pushing to `main` or `master`:

1. In the repository settings, set **Pages** to use **GitHub Actions** as the source.
2. Let the `Deploy Pages` workflow publish the site.
3. Your install URL will be either:
   - `https://<user>.github.io/<repo>/`
   - or the custom domain you configure for Pages

Then generate the r1 QR from that stable HTTPS URL:

```bash
./scripts/r1-qr.sh https://<user>.github.io/<repo>/
```

## Notes

- The app now uses the official Math Kangaroo grade bands (1-2, 3-4, 5-6, 7-8, 9-10, 11-12) across learn, practice, and contest modes.
- Official questions are not copied verbatim; items are original but pattern-matched.
