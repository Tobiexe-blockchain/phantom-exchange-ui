export function fmt(value: number, decimals: number): string {
  return value.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPercent(value: number): string {
  return `${value > 0 ? '+' : ''}${value.toFixed(2)}%`;
}

export function fmtTime(ms: number): string {
  return new Date(ms).toLocaleTimeString('en-GB', { hour12: false });
}

export function fmtCompact(value: number): string {
  return value.toLocaleString('en-US', { notation: 'compact', maximumFractionDigits: 2 });
}

/** Trim trailing zeros so a computed amount reads naturally in an input. */
export function toInputValue(value: number, decimals: number): string {
  const floored = Math.floor(value * 10 ** decimals) / 10 ** decimals;
  return floored.toFixed(decimals).replace(/\.?0+$/, '') || '0';
}
