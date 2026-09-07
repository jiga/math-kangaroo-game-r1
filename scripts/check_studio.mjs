import { chromium } from 'playwright';
import assert from 'node:assert/strict';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';

const url = process.env.CHECK_URL || 'http://127.0.0.1:4198';
const out = resolve('output/studio');
await mkdir(out, { recursive: true });
const browser = await chromium.launch({ channel: 'chrome', headless: true });
const results = [];
const cases = [
  { width: 240, height: 282, grade: 1, theme: 'gameboy' },
  { width: 240, height: 258, grade: 2, theme: 'neon' },
  { width: 240, height: 258, grade: 3, theme: 'gameboy' },
  { width: 240, height: 282, grade: 5, theme: 'neon' },
  { width: 393, height: 852, grade: 7, theme: 'gameboy' },
  { width: 1280, height: 800, grade: 9, theme: 'neon' },
  { width: 240, height: 258, grade: 11, theme: 'gameboy' },
  { width: 393, height: 852, grade: 12, theme: 'neon' }
];

try {
  for (const item of cases) {
    const page = await browser.newPage({ viewport: { width: item.width, height: item.height }, isMobile: item.width < 500, hasTouch: item.width < 500 });
    const errors = [];
    page.on('pageerror', (error) => errors.push(error.message));
    page.on('console', (message) => { if (message.type() === 'error') errors.push(message.text()); });
    const name = 'g' + item.grade + '-' + item.width + '-' + item.height + '-' + item.theme;
    const shot = (suffix) => page.screenshot({ path: resolve(out, name + '-' + suffix + '.png') });
    const state = () => page.evaluate(() => JSON.parse(window.render_game_to_text()));
    await page.goto(url);
    await page.waitForFunction(() => !document.querySelector('#start-btn').disabled);
    await page.click('#grade-toggle');
    await page.click('button[data-grade="' + item.grade + '"]');
    await page.click(item.theme === 'neon' ? '#theme-neon' : '#theme-gb');
    await shot('home');
    const bounds = await page.locator('#app').boundingBox();
    assert.ok(bounds.x >= -1 && bounds.y >= -1 && bounds.x + bounds.width <= item.width + 1 && bounds.y + bounds.height <= item.height + 1, JSON.stringify(bounds));
    await page.click('#start-btn');
    assert.equal((await state()).total, 6);
    const skills = [];
    for (let i = 0; i < 6; i++) {
      if (i === 0) {
        await shot('mission');
        await page.click('#coach-btn');
        await page.click('#coach-ai');
        await page.waitForFunction(() => !document.querySelector('#coach-ai').disabled);
        assert.match(await page.locator('#ai-status').innerText(), /saved thinking prompt/);
        await shot('help');
        await page.click('#coach-continue');
      }
      skills.push(await page.locator('#question-meta').innerText());
      const last = page.locator('#options .option').last();
      for (let tick = 0; tick < 25; tick++) await page.evaluate(() => window.dispatchEvent(new Event('scrollDown')));
      await last.click();
      await page.waitForSelector('#answer-feedback:not([hidden])');
      assert.equal((await state()).index, i + 1);
      if (i === 0) {
        await page.waitForTimeout(800);
        assert.equal((await state()).index, 1, 'Feedback must not auto-advance');
        await shot('feedback');
        await page.click('#feedback-learn');
        assert.equal((await state()).lessonDetour, true);
        await page.click('#guided-back');
        assert.equal((await state()).answerFeedback, true);
        assert.equal(await page.locator('#options .option:enabled').count(), 0, 'Detour must not allow rescoring');
      }
      await page.click('#feedback-next');
    }
    await page.waitForSelector('#result-screen.active');
    await shot('result');
    const attempts = await page.evaluate((grade) => JSON.parse(localStorage.getItem('mk_training_v1')).grades[grade].attempts, item.grade);
    assert.equal(attempts.length, 6);
    assert.equal(attempts[0].assisted, true);
    assert.ok(new Set(attempts.map((attempt) => attempt.skillId)).size >= 4);
    await page.reload();
    await page.waitForFunction(() => !document.querySelector('#start-btn').disabled);
    assert.equal((await state()).grade, item.grade);
    assert.equal((await state()).theme, item.theme);
    await page.click('#progress-btn');
    assert.equal(await page.locator('.progress-row').count() > 0, true);
    await shot('progress');
    await page.click('#home-btn');
    await page.click('#mode-learn');
    await page.click('#start-btn');
    await page.locator('.topic-card').first().click();
    await shot('explore');
    const visual = page.locator('#guided-visual svg');
    assert.equal(await visual.count(), 1);
    const vb = await visual.boundingBox();
    assert.ok(vb.width > 100 && vb.height >= 90);
    const firstParameter = page.locator('.guided-param-chip').first();
    if (await firstParameter.count()) await firstParameter.click();
    const plus = page.getByRole('button', { name: /^Increase / }).first();
    if (await plus.count()) {
      await plus.scrollIntoViewIfNeeded();
      const before = await state();
      const svgBefore = await visual.innerHTML();
      await plus.click();
      const after = await state();
      assert.notDeepEqual(after.guidedValues, before.guidedValues);
      assert.notEqual(await visual.innerHTML(), svgBefore, 'Parameter must change the diagram');
      assert.ok(Math.abs(after.scrollTop - before.scrollTop) <= 3, 'Controls must preserve scroll');
    }
    await page.click('#guided-next');
    if (await page.locator('#guided-choice-options:visible').count()) {
      assert.equal(await page.locator('#guided-derivation').isVisible(), false, 'Hide answer derivation before check');
      await page.locator('.guided-choice-option').first().click();
      if (await page.locator('#guided-next').isDisabled()) await page.locator('.guided-choice-option').nth(1).click();
      assert.equal(await page.locator('#guided-derivation').isVisible(), true);
    }
    if (item.grade === 1) {
      await page.click('#guided-next');
      await page.locator('.guided-choice-option').first().click();
      if (await page.locator('#guided-next').isDisabled()) await page.locator('.guided-choice-option').nth(1).click();
      await page.click('#guided-practice');
      assert.equal((await state()).mode, 'practice', 'Completed labs lead into related practice');
      assert.equal((await state()).total, 6);
    }
    await page.click('#home-btn');
    await page.click('#mode-contest');
    await page.click('#start-btn');
    assert.equal((await state()).total, item.grade <= 4 ? 24 : 30);
    assert.equal(await page.locator('#coach-btn').isVisible(), false);
    await page.locator('#options .option').first().click();
    assert.equal(await page.locator('#options .correct').count(), 0, 'Exam hides correctness');
    await page.click('#contest-next');
    await page.click('#contest-prev');
    assert.equal(await page.locator('#options .selected').count(), 1);
    await page.click('#contest-review-btn');
    assert.equal(await page.locator('.exam-review-grid .btn').count(), item.grade <= 4 ? 24 : 30);
    await shot('mock-review');
    await page.locator('#contest-review .btn-start').click();
    await page.waitForSelector('#result-screen.active');
    assert.deepEqual(errors, [], 'No browser errors');
    results.push({ ...item, checks: 'mission, assistance, feedback, detour, persistence, progress, visual controls, exam review', skills, errors });
    await page.close();
    console.log(name + ' passed');
  }
  await writeFile(resolve(out, 'results.json'), JSON.stringify(results, null, 2));
} finally {
  await browser.close();
}
