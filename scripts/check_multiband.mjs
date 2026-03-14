import { chromium } from 'playwright';
import fs from 'node:fs/promises';

const outDir = 'output/playwright/multiband';
await fs.mkdir(outDir, { recursive: true });

const browser = await chromium.launch({ channel: 'chrome', headless: true });
const page = await browser.newPage({ viewport: { width: 240, height: 282 }, deviceScaleFactor: 1 });
const cdp = await page.context().newCDPSession(page);
const logs = [];
page.on('console', (msg) => logs.push(`${msg.type()}: ${msg.text()}`));

const targetUrl = process.env.CHECK_URL || 'http://127.0.0.1:8000';
await page.goto(targetUrl, { waitUntil: 'networkidle' });

async function capture(name) {
  const payload = await page.evaluate(() => window.render_game_to_text());
  const dom = await page.evaluate(() => {
    const visual = document.querySelector('#guided-visual svg');
    const panel = document.querySelector('.question-card');
    const prompt = document.querySelector('#guided-choice-prompt');
    const topicTitle = document.querySelector('#guided-topic-title');
    const stepTitle = document.querySelector('#guided-step-title');
    const visualHost = document.querySelector('#guided-visual');
    return {
      topicTitle: topicTitle?.textContent || '',
      stepTitle: stepTitle?.textContent || '',
      hasGuidedSvg: Boolean(visual),
      visualMarkupLength: visual?.outerHTML.length || 0,
      visualBox: visualHost ? {
        width: Math.round(visualHost.getBoundingClientRect().width),
        height: Math.round(visualHost.getBoundingClientRect().height)
      } : null,
      prompt: prompt?.textContent || '',
      scrollTop: panel?.scrollTop || 0,
      scrollHeight: panel?.scrollHeight || 0,
      clientHeight: panel?.clientHeight || 0,
      railVisible: !document.querySelector('#scroll-rail')?.hasAttribute('hidden')
    };
  });
  const metrics = await cdp.send('Page.getLayoutMetrics');
  await fs.writeFile(`${outDir}/${name}.json`, JSON.stringify({ renderState: JSON.parse(payload), dom, metrics }, null, 2));
  await page.screenshot({ path: `${outDir}/${name}.png` });
}

async function setGrade(grade) {
  await page.click(`#grade-grid button[data-grade="${grade}"]`);
}

async function setMode(mode) {
  await page.click(`button[data-mode="${mode}"]`);
}

async function openFirstTopic(name) {
  await page.waitForSelector('.topic-card');
  await page.locator('.topic-card').first().click();
  await page.waitForTimeout(200);
  await capture(name);
}

async function openTopicByText(snippet, name) {
  await page.waitForSelector('.topic-card');
  await page.locator('.topic-card', { hasText: snippet }).first().click();
  await page.waitForTimeout(200);
  await capture(name);
}

await setGrade(3);
await setMode('learn');
await page.click('#start-btn');
await page.waitForTimeout(200);
await capture('grade3-learn-browser');
await openFirstTopic('grade3-learn-topic');

await page.click('#home-btn');
await page.waitForTimeout(150);
await setGrade(5);
await setMode('learn');
await page.click('#start-btn');
await page.waitForTimeout(200);
await capture('grade5-learn-browser');
await openFirstTopic('grade5-learn-topic');

await page.click('#home-btn');
await page.waitForTimeout(150);
await setGrade(7);
await setMode('learn');
await page.click('#start-btn');
await page.waitForTimeout(200);
await capture('grade7-learn-browser');
await openFirstTopic('grade7-learn-topic');
await page.click('#guided-back');
await page.waitForTimeout(150);
await openTopicByText('Logical Reasoning', 'grade7-exam-lab-topic');

await page.click('#home-btn');
await page.waitForTimeout(150);
await setGrade(9);
await setMode('learn');
await page.click('#start-btn');
await page.waitForTimeout(200);
await capture('grade9-learn-browser');
await openFirstTopic('grade9-learn-topic');
await page.click('#guided-back');
await page.waitForTimeout(150);
await openTopicByText('Optimization and Logic', 'grade9-exam-lab-topic');

await page.click('#home-btn');
await page.waitForTimeout(150);
await setGrade(11);
await setMode('learn');
await page.click('#start-btn');
await page.waitForTimeout(200);
await capture('grade11-learn-browser');
await openFirstTopic('grade11-learn-topic');
await page.click('#guided-back');
await page.waitForTimeout(150);
await openTopicByText('Proof Logic and Invariants', 'grade11-exam-lab-topic');

await page.click('#home-btn');
await page.waitForTimeout(150);
await setGrade(5);
await setMode('practice');
await page.click('#start-btn');
await page.waitForTimeout(200);
await capture('grade5-practice');

await page.click('#home-btn');
await page.waitForTimeout(150);
await setGrade(9);
await setMode('contest');
await page.click('#start-btn');
await page.waitForTimeout(200);
await capture('grade9-contest');

await fs.writeFile(`${outDir}/console.log`, logs.join('\n'));
await browser.close();
