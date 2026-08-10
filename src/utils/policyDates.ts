import { AppError } from '../middlewares/errorHandler';

const ISTANBUL = 'Europe/Istanbul';
const YMD_RE = /^\d{4}-\d{2}-\d{2}$/;

/** Europe/Istanbul takvim günü → YYYY-MM-DD */
export function todayInIstanbul(now: Date = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: ISTANBUL,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(now);
}

/** YYYY-MM-DD üzerine gün ekle (takvim günü, UTC noon kayması yok) */
export function addDaysYmd(ymd: string, days: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y, m - 1, d));
  dt.setUTCDate(dt.getUTCDate() + days);
  return dt.toISOString().slice(0, 10);
}

/** YYYY-MM-DD üzerine yıl ekle */
export function addYearsYmd(ymd: string, years: number): string {
  const [y, m, d] = ymd.split('-').map(Number);
  const dt = new Date(Date.UTC(y + years, m - 1, d));
  return dt.toISOString().slice(0, 10);
}

/** Gelen tarihi YYYY-MM-DD'ye çevir; geçersizse null */
export function normalizeToYmd(raw: string): string | null {
  const trimmed = raw.trim();
  if (YMD_RE.test(trimmed)) {
    const [y, m, d] = trimmed.split('-').map(Number);
    const check = new Date(Date.UTC(y, m - 1, d));
    if (
      check.getUTCFullYear() !== y ||
      check.getUTCMonth() !== m - 1 ||
      check.getUTCDate() !== d
    ) {
      return null;
    }
    return trimmed;
  }

  // DD.MM.YYYY
  const tr = trimmed.match(/^(\d{2})\.(\d{2})\.(\d{4})$/);
  if (tr) {
    return normalizeToYmd(`${tr[3]}-${tr[2]}-${tr[1]}`);
  }

  const parsed = new Date(trimmed);
  if (Number.isNaN(parsed.getTime())) return null;
  return todayInIstanbul(parsed);
}

export interface ResolvedPolicyDates {
  start_date: string;
  end_date: string;
}

/**
 * Poliçe başlangıç/bitiş çözümlemesi (tek kaynak).
 * - start yok/boş → bugün (İstanbul) + 7
 * - start var → bugünden önce olamaz
 * - end → her zaman start + 1 yıl
 */
export function resolvePolicyDates(startDate?: string | null): ResolvedPolicyDates {
  const today = todayInIstanbul();
  const trimmed = startDate?.toString().trim();

  let start: string;
  if (!trimmed) {
    start = addDaysYmd(today, 7);
  } else {
    const normalized = normalizeToYmd(trimmed);
    if (!normalized) {
      throw new AppError(400, 'Geçersiz başlangıç tarihi');
    }
    if (normalized < today) {
      throw new AppError(400, 'Başlangıç tarihi bugünden önce olamaz');
    }
    start = normalized;
  }

  return {
    start_date: start,
    end_date: addYearsYmd(start, 1),
  };
}
