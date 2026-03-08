import type { CoachPack } from "../domain/types";

type LLMPayload = Partial<Record<"hint" | "errorDiagnosis" | "speedTactic" | "miniExample", string>>;

const BLOCKED_PATTERNS = [
  /saving a note/gi,
  /let'?s calcu+?let/gi,
  /I cannot assist/gi,
  /\bfunction\b/gi,
  /\bplugin\b/gi,
  /\bjson\b/gi,
  /\bprompt\b/gi,
  /\bjournal\b/gi,
  /\bsystem action\b/gi
];

function sanitize(text: string): string {
  let out = text.trim();
  for (const pattern of BLOCKED_PATTERNS) {
    out = out.replace(pattern, "").trim();
  }
  out = out.replace(/\s{2,}/g, " ");
  return out;
}

function isValidPayload(payload: LLMPayload): boolean {
  const fields = [payload.hint, payload.errorDiagnosis, payload.speedTactic, payload.miniExample].filter(Boolean);
  if (fields.length === 0) return false;
  return fields.every((value) => typeof value === "string" && value.length > 2 && value.length <= 300);
}

let seq = 0;
const pending = new Map<string, (payload: LLMPayload | null) => void>();

function installPluginHandler(): void {
  const handler = (globalThis as unknown as { onPluginMessage?: (data: unknown) => void }).onPluginMessage;
  if ((globalThis as unknown as { __mk_llm_installed?: boolean }).__mk_llm_installed) return;

  (globalThis as unknown as { onPluginMessage?: (data: unknown) => void }).onPluginMessage = (raw: unknown) => {
    if (typeof handler === "function") handler(raw);
    const maybe = raw as { data?: unknown } | string | null;
    const payloadRaw = typeof maybe === "object" && maybe && "data" in maybe ? maybe.data : maybe;
    let payload: Record<string, unknown> | null = null;
    if (typeof payloadRaw === "string") {
      try {
        payload = JSON.parse(payloadRaw) as Record<string, unknown>;
      } catch {
        payload = null;
      }
    } else if (payloadRaw && typeof payloadRaw === "object") {
      payload = payloadRaw as Record<string, unknown>;
    }

    if (!payload) return;
    if (typeof payload.text === "string") {
      const text = payload.text.trim();
      if (text.startsWith("{") && text.endsWith("}")) {
        try {
          payload = { ...payload, ...(JSON.parse(text) as Record<string, unknown>) };
        } catch {
          // ignore
        }
      }
    }

    const requestId = String(payload.requestId || payload.request_id || "");
    if (!requestId) {
      if (pending.size === 1) {
        const first = pending.keys().next().value as string;
        const cb = pending.get(first);
        pending.delete(first);
        if (cb) cb(payload as LLMPayload);
      }
      return;
    }

    const cb = pending.get(requestId);
    if (!cb) return;
    pending.delete(requestId);
    cb(payload as LLMPayload);
  };

  (globalThis as unknown as { __mk_llm_installed?: boolean }).__mk_llm_installed = true;
}

export async function enrichCoachText(base: CoachPack, context: { grade: number; prompt: string; answer: string }): Promise<CoachPack> {
  const plugin = (globalThis as unknown as { PluginMessageHandler?: { postMessage?: (msg: string) => void } }).PluginMessageHandler;
  const postMessage = plugin?.postMessage;
  if (typeof postMessage !== "function") return base;

  installPluginHandler();

  const requestId = `coach_${Date.now()}_${seq++}`;
  const message = {
    requestId,
    useLLM: true,
    message: [
      `Rewrite this kid-friendly coaching pack for grade ${context.grade}.`,
      `Question: ${context.prompt}`,
      `Correct answer: ${context.answer}`,
      "Return JSON only with keys: requestId, hint, errorDiagnosis, speedTactic, miniExample.",
      "Use plain child-friendly language only. Do not mention system actions, notes, functions, prompts, plugins, tools, JSON, or saving anything.",
      `Base hint: ${base.hint}`,
      `Base diagnosis: ${base.errorDiagnosis}`,
      `Base speed tactic: ${base.speedTactic}`,
      `Base mini example: ${base.miniExample}`
    ].join("\n")
  };

  const payload = await new Promise<LLMPayload | null>((resolve) => {
    const timeout = setTimeout(() => {
      pending.delete(requestId);
      resolve(null);
    }, 1500);

    pending.set(requestId, (result) => {
      clearTimeout(timeout);
      resolve(result);
    });

    try {
      postMessage(JSON.stringify(message));
    } catch {
      clearTimeout(timeout);
      pending.delete(requestId);
      resolve(null);
    }
  });

  if (!payload || !isValidPayload(payload)) return base;

  const next: CoachPack = {
    hint: sanitize(payload.hint || base.hint),
    errorDiagnosis: sanitize(payload.errorDiagnosis || base.errorDiagnosis),
    speedTactic: sanitize(payload.speedTactic || base.speedTactic),
    miniExample: sanitize(payload.miniExample || base.miniExample)
  };

  if (!isValidPayload(next)) return base;
  return next;
}
