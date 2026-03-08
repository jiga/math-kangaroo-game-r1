import test from "node:test";
import assert from "node:assert/strict";
import { TTSQueue } from "../src/audio/ttsQueue";

test("tts queue sends child-safe speech prompt through PluginMessageHandler", () => {
  const sent: string[] = [];
  const originalPlugin = (globalThis as unknown as { PluginMessageHandler?: { postMessage?: (msg: string) => void } }).PluginMessageHandler;
  const originalSpeech = (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis;

  (globalThis as unknown as { PluginMessageHandler?: { postMessage?: (msg: string) => void } }).PluginMessageHandler = {
    postMessage: (msg: string) => sent.push(msg)
  };
  (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis = undefined;

  const queue = new TTSQueue();
  queue.speak("Try this: Count by twos.");

  assert.equal(sent.length, 1);
  const payload = JSON.parse(sent[0]) as Record<string, unknown>;
  assert.equal(payload.useLLM, true);
  assert.equal(payload.wantsR1Response, true);
  assert.equal(payload.wantsJournalEntry, false);
  assert.match(String(payload.message), /speaking to a child through rabbit r1/);
  assert.match(String(payload.message), /Repeat only the child-facing words inside <say> tags/);
  assert.match(String(payload.message), /<say>Count by twos\.<\/say>/);

  (globalThis as unknown as { PluginMessageHandler?: { postMessage?: (msg: string) => void } }).PluginMessageHandler = originalPlugin;
  (globalThis as unknown as { speechSynthesis?: unknown }).speechSynthesis = originalSpeech;
});
