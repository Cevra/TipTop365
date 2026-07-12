// Money + date formatting (plan D5, §12.1). Money is stored as integer fenings
// (1 KM = 100 f). Pure + deterministic (no Intl locale variance) so it is
// unit-tested and identical across server/client/CI.

/** 5760 → "57,60 KM"; -960 → "−9,60 KM"; 123456 → "1.234,56 KM". */
export function formatKM(fenings: number): string {
  const negative = fenings < 0;
  const abs = Math.abs(Math.round(fenings));
  const whole = Math.floor(abs / 100)
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, '.'); // dot thousands separator (bs)
  const cents = (abs % 100).toString().padStart(2, '0');
  return `${negative ? '−' : ''}${whole},${cents} KM`;
}

/** Convenience for KM amounts held as a decimal number (e.g. 57.6 → "57,60 KM"). */
export function formatKMFromDecimal(km: number): string {
  return formatKM(Math.round(km * 100));
}

/** Date → "12.7.2026." (bs convention, plan §12.1: d.M.yyyy). */
export function formatDateBs(date: Date): string {
  return `${date.getDate()}.${date.getMonth() + 1}.${date.getFullYear()}.`;
}

/** Date → "12.7.2026. 14:05". */
export function formatDateTimeBs(date: Date): string {
  const hh = date.getHours().toString().padStart(2, '0');
  const mm = date.getMinutes().toString().padStart(2, '0');
  return `${formatDateBs(date)} ${hh}:${mm}`;
}
