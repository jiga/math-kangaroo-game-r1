type SvgTextAnchor = "start" | "middle" | "end";

type FitTextOptions = {
  minSize?: number;
  maxLines?: number;
};

type SvgSingleLineOptions = {
  size?: number;
  minSize?: number;
  weight?: number | string;
  anchor?: SvgTextAnchor;
  maxWidth?: number;
  fill?: string;
  stroke?: string;
  strokeOpacity?: number;
  strokeWidth?: number;
  paintOrder?: string;
};

type SvgTextBlockOptions = SvgSingleLineOptions & {
  maxWidth: number;
  maxLines?: number;
  lineHeight?: number;
};

export function escapeXml(text: string): string {
  return text
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&apos;");
}

function charWidthFactor(char: string): number {
  if (char === " ") return 0.33;
  if ("ilI1|!.,:;'`".includes(char)) return 0.28;
  if ("mwMW@#%&".includes(char)) return 0.84;
  if ("-_=+/\\*".includes(char)) return 0.46;
  if (char >= "A" && char <= "Z") return 0.66;
  return 0.56;
}

export function estimateTextWidth(text: string, fontSize: number): number {
  return [...text].reduce((sum, char) => sum + charWidthFactor(char) * fontSize, 0);
}

function normalizeText(text: string): string {
  return text.replace(/\s+/g, " ").trim();
}

function ellipsize(text: string, fontSize: number, maxWidth: number): string {
  const normalized = normalizeText(text);
  if (!normalized) return "";
  if (estimateTextWidth(normalized, fontSize) <= maxWidth) return normalized;
  let out = normalized;
  while (out.length > 1 && estimateTextWidth(`${out}…`, fontSize) > maxWidth) {
    out = out.slice(0, -1).trimEnd();
  }
  return `${out || normalized.slice(0, 1)}…`;
}

export function fitSingleLineText(text: string, maxWidth: number, size: number, minSize = 7): { text: string; fontSize: number } {
  const normalized = normalizeText(text);
  if (!normalized) return { text: "", fontSize: size };
  for (let fontSize = size; fontSize >= minSize; fontSize -= 0.5) {
    if (estimateTextWidth(normalized, fontSize) <= maxWidth) {
      return { text: normalized, fontSize };
    }
  }
  return { text: ellipsize(normalized, minSize, maxWidth), fontSize: minSize };
}

function wrapLongWord(word: string, maxWidth: number, fontSize: number): string[] {
  const chunks: string[] = [];
  let current = "";
  for (const char of word) {
    const candidate = current + char;
    if (current && estimateTextWidth(candidate, fontSize) > maxWidth) {
      chunks.push(current);
      current = char;
    } else {
      current = candidate;
    }
  }
  if (current) chunks.push(current);
  return chunks;
}

function wrapWords(text: string, maxWidth: number, fontSize: number): string[] {
  const normalized = normalizeText(text);
  if (!normalized) return [""];
  const words = normalized.split(" ");
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (estimateTextWidth(candidate, fontSize) <= maxWidth) {
      current = candidate;
      continue;
    }
    if (current) lines.push(current);
    if (estimateTextWidth(word, fontSize) <= maxWidth) {
      current = word;
      continue;
    }
    const chunks = wrapLongWord(word, maxWidth, fontSize);
    lines.push(...chunks.slice(0, -1));
    current = chunks[chunks.length - 1] ?? "";
  }

  if (current) lines.push(current);
  return lines.length ? lines : [normalized];
}

export function fitTextBlock(text: string, maxWidth: number, size: number, options: FitTextOptions = {}): { lines: string[]; fontSize: number } {
  const minSize = options.minSize ?? 7;
  const maxLines = options.maxLines ?? 2;
  const normalized = text
    .split(/\n+/)
    .map((part) => normalizeText(part))
    .filter(Boolean)
    .join(" ");

  if (!normalized) return { lines: [""], fontSize: size };

  for (let fontSize = size; fontSize >= minSize; fontSize -= 0.5) {
    const lines = wrapWords(normalized, maxWidth, fontSize);
    if (lines.length <= maxLines) {
      return { lines, fontSize };
    }
  }

  const truncated = wrapWords(normalized, maxWidth, minSize).slice(0, maxLines);
  const last = truncated[truncated.length - 1] ?? "";
  truncated[truncated.length - 1] = ellipsize(last, minSize, maxWidth);
  return { lines: truncated, fontSize: minSize };
}

function commonTextAttrs(options: SvgSingleLineOptions, fontSize: number, anchor: SvgTextAnchor): string {
  const attrs = [
    `text-anchor='${anchor}'`,
    `font-size='${fontSize}'`,
    `font-weight='${options.weight ?? 700}'`,
    `fill='${options.fill ?? "currentColor"}'`
  ];
  if (options.stroke) attrs.push(`stroke='${options.stroke}'`);
  if (typeof options.strokeOpacity === "number") attrs.push(`stroke-opacity='${options.strokeOpacity}'`);
  if (typeof options.strokeWidth === "number") attrs.push(`stroke-width='${options.strokeWidth}'`);
  if (options.paintOrder) attrs.push(`paint-order='${options.paintOrder}'`);
  return attrs.join(" ");
}

export function svgSingleLineText(x: number, y: number, text: string, options: SvgSingleLineOptions = {}): string {
  const anchor = options.anchor ?? "middle";
  const maxWidth = options.maxWidth ?? (anchor === "middle" ? 176 : 132);
  const fitted = fitSingleLineText(text, maxWidth, options.size ?? 11, options.minSize ?? 7);
  return `<text x='${x}' y='${y}' ${commonTextAttrs(options, fitted.fontSize, anchor)}>${escapeXml(fitted.text)}</text>`;
}

export function svgTextBlock(x: number, y: number, text: string, options: SvgTextBlockOptions): string {
  const anchor = options.anchor ?? "middle";
  const fitted = fitTextBlock(text, options.maxWidth, options.size ?? 11, {
    minSize: options.minSize,
    maxLines: options.maxLines
  });
  const lineHeight = options.lineHeight ?? Math.round(fitted.fontSize * 1.2 * 10) / 10;
  const startY = y - ((fitted.lines.length - 1) * lineHeight) / 2;
  return `<text x='${x}' y='${startY}' dominant-baseline='middle' ${commonTextAttrs(options, fitted.fontSize, anchor)}>${fitted.lines
    .map((line, index) => `<tspan x='${x}' y='${startY + index * lineHeight}'>${escapeXml(line)}</tspan>`)
    .join("")}</text>`;
}
