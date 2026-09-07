# Kangaroo Studio

An interactive Math Kangaroo training companion for Grades 1-12, designed for Rabbit r1, phones, and desktops. Deploys as one static HTML file.

[Open the studio](https://jiga.github.io/math-kangaroo-game-r1/)

## Studio learning journey

- **Mission:** six questions selected from new skills, due reviews, and skills needing practice. A miss schedules a fresh follow-up later in the mission. Feedback stays until the child continues.
- **Explore:** reactive SVG diagrams, compact parameter buttons, prediction checks, and explanations revealed after a response. Listen is optional.
- **Mock exam:** skip, revisit, and review before submitting. Answers and explanations appear after submission. Recent results are saved locally.
- **My progress:** grade-specific evidence separates independent successes from help use. Remembered skills require different solved variants and successful retrieval on a later day. Replays and help cannot establish mastery.

Top-five performance is a training aspiration. This app does not predict ranks or claim measured learning gains. Questions are original; the app is not affiliated with Math Kangaroo.

## AI and device behavior

### Visual learning aids

Choose **Work it out** in a mission or a topic lab, or **Show me: visual tools** in Help. The full-screen workbench keeps the current question available and offers:

- **Picture:** mark or draw over the actual question/lesson diagram; a blank sketch grid is provided when there is no diagram.
- **Count:** construct up to 30 counters and tap to cross them out or restore them.
- **Parts:** split a whole into equal pieces and shade them. Grades 1-2 use halves, thirds, and quarters.
- **Balance:** adjust both sides and observe which side drops, or make them equal.
- **Graph:** Grades 3-12 can explore a linear model by adjusting slope and height.

These are child-built thinking tools, not automatic solutions. Undo and Reset act on the current tool. Construction survives switching tools and reopening Help for the same question, and resets for a new question. Opening an aid before answering records an assisted attempt. Aids are unavailable during mock exams.

The r1 wheel scrolls the workspace; Pen mode reserves touch gestures for drawing. The Back button remains visible. Visual-aid interaction tests run as part of `npm run check:browser`.

Local help works without AI. On r1, **Ask the AI tutor** requests a selection among vetted thinking prompts using the official Rabbit bridge. The model cannot supply a scored answer or arbitrary displayed text. Invalid or late responses fall back to local help. Listen is a separate action; nothing auto-narrates.

Rabbit speech is LLM-backed: the public SDK does not guarantee verbatim wording or remote cancellation. Browsers use speech synthesis when available. No API credentials are embedded. The app requests no child identity, microphone, camera, or account. See [research and SDK contract](docs/tutor-research.md).

The app follows the visual viewport, including reduced r1 height. Long content scrolls through touch, keyboard, the rail, or Rabbit wheel events. The wheel always scrolls; parameter buttons reveal explicit +/- controls. Larger screens give diagrams more room.

Training evidence uses `mk_training_v1` in SDK storage/localStorage. Grade, theme, explored topics, and recent mocks use `mk_studio_preferences_v1`. Existing `mk_profile_v2` data is preserved; its old totals cannot establish independent mastery because they lack help-use evidence. Progress belongs to the device/browser profile.

Related docs:

- `DEPLOY.md` - deployment and local install flow
- `PUBLISHING.md` - public GitHub repo and Pages publishing flow
- `RELEASE_CHECKLIST.md` - pre-release and post-deploy checklist

## What Changed

- Modular source architecture under `src/` with generated single-file output.
- Grade 1-2 question bank rebuilt from curriculum coverage map.
- Grade 3-12 migrated onto the same banded architecture, with guided lessons and official mock sizing by band.
- Contest fidelity by official Math Kangaroo band:
  - 24 questions for Grades 1-4; 30 for Grades 5-12
  - 75 minutes
  - 5 options per question
  - 3/4/5 point tiers
  - no wrong-answer penalty
- Practice uses short adaptive missions. Mock exams start only when explicitly selected.
- Visual puzzle support across the bands (SVG):
  - mazes
  - broken lines/perimeter
  - pictographs
  - Venn diagrams
  - cube/cuboid visuals
  - symmetry
  - region compare
- Deterministic per-skill coaching with optional AI selection of vetted hints.
- Explicit speech actions; no automatic question or feedback narration.
- Persistent grade-specific evidence and due reviews.
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

- Install deps: `npm ci`
- Run all content tests and strict TypeScript checks: `npm run check`
- Validate Grade 1-12 coverage and schema: `npm run validate`
- Run tests: `npm run test`
- Build single-file artifact: `npm run build`

Build writes:

- `dist/index.html`
- `dist/404.html`
- `dist/.nojekyll`
- `index.html` (compatibility copy)

`dist/` is the publishable static site for GitHub Pages and other static hosts.

With the local server running, browser verification uses:

```bash
CHECK_URL=http://127.0.0.1:8000 npm run check:browser
CHECK_URL=http://127.0.0.1:8000 node scripts/check_studio_mcp.mjs
```

The first uses installed Google Chrome through Playwright. The second launches an isolated Chrome DevTools MCP 1.8.0 session. Screenshots and reports go to ignored `output/`. Browser tests do not replace physical r1 firmware/speaker testing.

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
