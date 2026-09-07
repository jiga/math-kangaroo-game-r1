export function escapeHtml(value: unknown): string {
  return String(value).replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]!);
}

export function trailVisual(completed = 0, total = 6): string {
  const nodes = Array.from({ length: total }, (_, i) => {
    const x = 26 + i * 36;
    const y = i % 2 ? 43 : 57;
    return '<circle cx="' + x + '" cy="' + y + '" r="12" fill="' + (i < completed ? 'var(--accent)' : 'var(--card)') + '" stroke="var(--accent)" stroke-width="1.5"/>' +
      '<text x="' + x + '" y="' + (y + 4) + '" text-anchor="middle" font-size="11" font-weight="bold" fill="' + (i < completed ? 'var(--bg)' : 'var(--text)') + '">' + (i < completed ? '+' : i + 1) + '</text>';
  }).join('');
  return '<svg viewBox="0 0 240 88" width="240" height="88" role="img" aria-label="' + completed + ' of ' + total + ' mission steps complete">' +
    '<path d="M10 75 Q52 17 95 66 T230 25" fill="none" stroke="var(--line)" stroke-width="26" stroke-linecap="round" opacity=".45"/>' +
    '<path d="M26 57 Q44 57 62 43 T98 57 T134 43 T170 57 T206 43" fill="none" stroke="var(--accent)" stroke-dasharray="3 5" opacity=".65"/>' +
    nodes + '<path d="M217 21v-16l13 5-13 5" fill="none" stroke="var(--accent2)" stroke-width="2"/></svg>';
}

export function topicGlyph(index: number): string {
  const glyphs = [
    '<circle cx="12" cy="12" r="4"/><circle cx="25" cy="12" r="4"/><circle cx="12" cy="25" r="4"/><circle cx="25" cy="25" r="4"/>',
    '<path d="M6 28h24M9 26V15h5v11M20 26V7h5v19"/>',
    '<path d="M6 15h24M18 7v23M7 15l-3 9h8l-5-9M28 15l-4 9h8l-4-9"/>',
    '<path d="M5 25h28M8 22v6m7-6v6m7-6v6m7-6v6M8 18q7-18 14 0m-4-3 4 3 1-5"/>',
    '<circle cx="18" cy="18" r="13"/><path d="M18 5v26M5 18h26M18 18l9-9"/>',
    '<rect x="5" y="5" width="26" height="26" rx="3"/><path d="M5 18h26M18 5v26"/>'
  ];
  return '<svg viewBox="0 0 36 36" width="36" height="36" aria-hidden="true" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round">' + glyphs[index % glyphs.length] + '</svg>';
}
