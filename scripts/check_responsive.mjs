import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const targetUrl = process.env.CHECK_URL || 'http://127.0.0.1:8011';
const outDir = '/Users/jignesh/dev/minimax-ws/math-kangaroo-game-r1/output/playwright/responsive';
await fs.mkdir(outDir, { recursive: true });

const cases = [
  { name: 'r1-home', viewport: { width: 240, height: 282 }, flow: 'home' },
  { name: 'r1-learn', viewport: { width: 240, height: 282 }, flow: 'learn' },
  { name: 'phone-home', viewport: { width: 393, height: 852 }, flow: 'home' },
  { name: 'phone-learn', viewport: { width: 393, height: 852 }, flow: 'learn' },
  { name: 'desktop-home', viewport: { width: 1280, height: 800 }, flow: 'home' },
  { name: 'desktop-learn', viewport: { width: 1280, height: 800 }, flow: 'learn' }
];

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const summary = [];
for (const entry of cases) {
  const page = await browser.newPage({ viewport: entry.viewport, deviceScaleFactor: 1 });
  const errors = [];
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });
  page.on('pageerror', (err) => errors.push(String(err)));
  await page.goto(targetUrl, { waitUntil: 'networkidle' });
  await page.waitForTimeout(150);
  if (entry.flow === 'learn') {
    await page.click('button[data-mode="learn"]');
    await page.click('#start-btn');
    await page.waitForSelector('.topic-card');
    await page.locator('.topic-card').first().click();
    await page.waitForTimeout(150);
  }
  const data = await page.evaluate(() => {
    const app = document.querySelector('.app');
    const activeScreen = document.querySelector('.screen.active');
    const questionCard = document.querySelector('.question-card');
    const guidedVisual = document.querySelector('#guided-visual');
    const startBtn = document.querySelector('#start-btn');
    const topicCard = document.querySelector('.topic-card');
    const rect = (node) => {
      if (!node) return null;
      const r = node.getBoundingClientRect();
      return {
        x: Math.round(r.x),
        y: Math.round(r.y),
        width: Math.round(r.width),
        height: Math.round(r.height),
        bottom: Math.round(r.bottom),
        right: Math.round(r.right)
      };
    };
    return {
      renderState: typeof window.render_game_to_text === 'function' ? JSON.parse(window.render_game_to_text()) : null,
      viewport: { width: window.innerWidth, height: window.innerHeight },
      roomy: document.body.dataset.roomy || 'false',
      compactHeight: document.body.dataset.compactHeight || 'false',
      appRect: rect(app),
      screenRect: rect(activeScreen),
      questionCardRect: rect(questionCard),
      guidedVisualRect: rect(guidedVisual),
      startBtnRect: rect(startBtn),
      topicCardRect: rect(topicCard),
      railVisible: !document.querySelector('#scroll-rail')?.hasAttribute('hidden'),
      railRect: rect(document.querySelector('#scroll-rail')),
      bodyScrollHeight: document.body.scrollHeight,
      bodyClientHeight: document.body.clientHeight,
      activeScrollTop: questionCard?.scrollTop || 0,
      activeScrollHeight: questionCard?.scrollHeight || 0,
      activeClientHeight: questionCard?.clientHeight || 0
    };
  });
  await page.screenshot({ path: `${outDir}/${entry.name}.png` });
  await fs.writeFile(`${outDir}/${entry.name}.json`, JSON.stringify({ ...data, errors }, null, 2));
  summary.push({ name: entry.name, ...data, errors });
  await page.close();
}
await fs.writeFile(`${outDir}/summary.json`, JSON.stringify(summary, null, 2));
await browser.close();
