export class TTSQueue {
  private generation = 0;
  private lastSpokenText = "";
  private lastSpokenAt = 0;

  private normalize(text: string): string {
    return text
      .replace(/\b(Hint|Diagnosis|Speed|Example|Try this|Watch out|Fast move|Mini example):\s*/gi, "")
      .replace(/\b(function|plugin|json|prompt|journal|system action|system|message|tool)\b/gi, "")
      .replace(/\s{2,}/g, " ")
      .trim();
  }

  private estimateDurationMs(text: string): number {
    const words = text.split(/\s+/).filter(Boolean).length;
    return Math.max(900, Math.min(6500, words * 340));
  }

  cancelAll(): void {
    this.generation += 1;
  }

  speak(text: string): number {
    const currentGeneration = ++this.generation;
    const clean = this.normalize(text);
    if (!clean) return 0;
    if (clean === this.lastSpokenText && Date.now() - this.lastSpokenAt < 1200) return 0;
    this.lastSpokenText = clean;
    this.lastSpokenAt = Date.now();
    const durationMs = this.estimateDurationMs(clean);

    const plugin = (globalThis as unknown as { PluginMessageHandler?: { postMessage?: (msg: string) => void } }).PluginMessageHandler;
    if (plugin?.postMessage) {
      try {
        const speechPrompt = [
          "You are speaking to a child through rabbit r1.",
          "Repeat only the child-facing words inside <say> tags, one time.",
          "Keep the same meaning and keep it short.",
          "Do not solve beyond what is said.",
          "Do not add intros, outros, notes, or mention functions, prompts, tools, plugins, JSON, journal entries, or system actions.",
          ` <say>${clean}</say>`
        ].join("\n");

        plugin.postMessage(
          JSON.stringify({
            requestId: `tts_${Date.now()}_${currentGeneration}`,
            message: speechPrompt,
            useLLM: true,
            wantsR1Response: true,
            wantsJournalEntry: false
          })
        );
        return durationMs;
      } catch {
        // fallback to browser speech if plugin fails
      }
    }

    const synth = globalThis.speechSynthesis;
    if (!synth) return durationMs;
    synth.cancel();
    const utterance = new SpeechSynthesisUtterance(clean);
    utterance.rate = 1.0;
    utterance.pitch = 1.0;
    utterance.volume = 1;
    utterance.onstart = () => {
      if (currentGeneration !== this.generation) synth.cancel();
    };
    synth.speak(utterance);
    return durationMs;
  }
}
