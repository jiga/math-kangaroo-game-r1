// A dedicated MCP session avoids locking another task's Chrome profile.
import { spawn } from 'node:child_process';
import { mkdir, writeFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import assert from 'node:assert/strict';

const out = resolve('output/studio-mcp');
await mkdir(out, { recursive: true });
const child = spawn('npx', ['--yes', 'chrome-devtools-mcp@1.8.0', '--isolated', '--headless', '--no-page-id-routing', '--no-usage-statistics', '--allow-unrestricted-paths'], { stdio: ['pipe', 'pipe', 'pipe'] });
const pending = new Map();
let buffer = '', seq = 0;
const log = [];
child.stderr.on('data', (data) => log.push(String(data)));
child.stdout.on('data', (data) => {
  buffer += data;
  let newline;
  while ((newline = buffer.indexOf('\n')) >= 0) {
    const line = buffer.slice(0, newline);
    buffer = buffer.slice(newline + 1);
    try {
      const message = JSON.parse(line);
      const operation = pending.get(message.id);
      if (operation) {
        clearTimeout(operation.timeout);
        pending.delete(message.id);
        message.error ? operation.reject(new Error(JSON.stringify(message.error))) : operation.resolve(message.result);
      }
    } catch { /* Server diagnostic output is retained separately on stderr. */ }
  }
});
function request(method, params = {}) {
  return new Promise((resolve, reject) => {
    const id = ++seq;
    const timeout = setTimeout(() => { pending.delete(id); reject(new Error(method + ' timed out')); }, 60000);
    pending.set(id, { resolve, reject, timeout });
    child.stdin.write(JSON.stringify({ jsonrpc: '2.0', id, method, params }) + '\n');
  });
}
async function call(name, args = {}) {
  const result = await request('tools/call', { name, arguments: args });
  if (result.isError) throw new Error(JSON.stringify(result));
  return result.content.filter((item) => item.type === 'text').map((item) => item.text).join('\n');
}
const evaluate = (fn) => call('evaluate_script', { function: fn });
try {
  const initialized = await request('initialize', { protocolVersion: '2024-11-05', capabilities: {}, clientInfo: { name: 'kangaroo-studio-qa', version: '1' } });
  assert.equal(initialized.serverInfo.name, 'chrome_devtools');
  child.stdin.write(JSON.stringify({ jsonrpc: '2.0', method: 'notifications/initialized' }) + '\n');
  const tools = await request('tools/list');
  assert.ok(tools.tools.some((tool) => tool.name === 'emulate'));
  await call('new_page', { url: process.env.CHECK_URL || 'http://127.0.0.1:4198' });
  const records = [];
  for (const viewport of ['240x282x1,mobile,touch', '240x258x1,mobile,touch', '393x852x1,mobile,touch', '1280x800x1']) {
    const name = viewport.split(',')[0];
    await call('emulate', { viewport });
    await evaluate('() => { document.querySelector("#home-btn").click(); return window.render_game_to_text(); }');
    await call('take_screenshot', { filePath: resolve(out, name + '-home.png') });
    const fit = await evaluate('() => { const r=document.querySelector("#app").getBoundingClientRect(); const v=visualViewport; if(r.width>v.width+1 || r.height>v.height+1) throw new Error("App exceeds viewport"); return {width:r.width,height:r.height,available:{width:v.width,height:v.height}}; }');
    const snapshot = await call('take_snapshot');
    const uid = snapshot.match(/(\d+_\d+) button "Start my mission/);
    assert.ok(uid, 'Mission button exists in the accessibility tree');
    await call('click', { uid: uid[1] });
    const missionState = await evaluate('() => { const s=JSON.parse(window.render_game_to_text()); if(s.total!==6) throw new Error("Mission length"); return s; }');
    await call('take_screenshot', { filePath: resolve(out, name + '-mission.png') });
    const scroll = await evaluate('() => { const c=document.querySelector(".question-card"); const before=c.scrollTop; window.dispatchEvent(new Event("scrollDown")); return {before,after:c.scrollTop,client:c.clientHeight,total:c.scrollHeight}; }');
    await evaluate('() => { document.querySelector("#home-btn").click(); document.querySelector("#mode-learn").click(); document.querySelector("#start-btn").click(); document.querySelector(".topic-card").click(); return window.render_game_to_text(); }');
    const lessonState = await evaluate((() => {
      const svg = document.querySelector('#guided-visual svg');
      if (!svg || svg.getBoundingClientRect().height < 80) throw new Error('Lesson visual missing');
      const before = svg.innerHTML;
      document.querySelector('.guided-param-chip').click();
      Array.from(document.querySelectorAll('button')).find((button) => button.getAttribute('aria-label')?.startsWith('Increase '))?.click();
      const after = document.querySelector('#guided-visual svg').innerHTML;
      if (before === after) throw new Error('Diagram did not react');
      return window.render_game_to_text();
    }).toString());
    await call('take_screenshot', { filePath: resolve(out, name + '-lesson.png') });
    await evaluate('() => { document.querySelector("#home-btn").click(); document.querySelector("#mode-practice").click(); return true; }');
    records.push({ viewport, fit, missionState, scroll, lessonState });
    console.log('Chrome DevTools MCP verified ' + viewport);
  }
  const errors = await call('list_console_messages', { types: ['error'] });
  await writeFile(resolve(out, 'verification.json'), JSON.stringify({ server: initialized.serverInfo, records, console: errors }, null, 2));
  assert.ok(!errors.includes('msgid='), errors);
} finally {
  for (const operation of pending.values()) clearTimeout(operation.timeout);
  child.kill('SIGTERM');
  await writeFile(resolve(out, 'server.log'), log.join(''));
}
