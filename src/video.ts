/** Parse CSV-style timestamps like "44:35:29" or "1:23" or "90" into seconds. */
export function parseTimestampToSeconds(raw: string | undefined | null): number | undefined {
  if (!raw) return undefined;
  const t = raw.trim();
  if (!t) return undefined;
  if (/^\d+$/.test(t)) return Number(t);
  const parts = t.split(':').map((p) => Number(p));
  if (parts.some((n) => Number.isNaN(n))) return undefined;
  if (parts.length === 3) return parts[0] * 3600 + parts[1] * 60 + parts[2];
  if (parts.length === 2) return parts[0] * 60 + parts[1];
  return undefined;
}

export function formatTimestamp(sec: number | undefined): string {
  if (sec == null || Number.isNaN(sec)) return '';
  const s = Math.max(0, Math.floor(sec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const r = s % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, '0')}:${String(r).padStart(2, '0')}`;
  return `${m}:${String(r).padStart(2, '0')}`;
}

/** Build a YouTube (or generic) URL jumping to t=seconds when possible. */
export function buildClipUrl(
  gameVideoUrl: string | undefined,
  clipUrl: string | undefined,
  timestampSec: number | undefined,
): string | undefined {
  const base = (clipUrl || gameVideoUrl || '').trim();
  if (!base) return undefined;
  if (timestampSec == null) return base;

  try {
    const u = new URL(base);
    const host = u.hostname.replace(/^www\./, '');
    if (host === 'youtu.be') {
      u.searchParams.set('t', String(Math.floor(timestampSec)));
      return u.toString();
    }
    if (host.endsWith('youtube.com')) {
      u.searchParams.set('t', String(Math.floor(timestampSec)));
      return u.toString();
    }
  } catch {
    /* fall through */
  }

  const sep = base.includes('?') ? '&' : '?';
  return `${base}${sep}t=${Math.floor(timestampSec)}`;
}
