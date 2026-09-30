/** Format number with thousand separators (e.g. 12960 -> 12,960) */
export function formatNumber(num: number | undefined | null): string {
  if (typeof num !== 'number' || Number.isNaN(num)) return '0'
  return num.toLocaleString('en-US')
}
