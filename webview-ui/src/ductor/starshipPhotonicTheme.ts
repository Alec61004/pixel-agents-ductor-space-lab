/** Shared material and light palette for the bridge and Home controls. */
export const PHOTONIC_THEME = {
  void: '#10151c', hull: '#222d38', panel: '#202e39', line: '#435a69',
  cyan: '#9acede', violet: '#a3a0c9', magenta: '#cf9a91', amber: '#e7bd88',
  text: '#e8eef2', dim: '#a0b0bd',
} as const;

export const PHOTONIC_CSS_VARS = Object.entries(PHOTONIC_THEME)
  .map(([key, value]) => `--${key}: ${value};`).join('\n');
