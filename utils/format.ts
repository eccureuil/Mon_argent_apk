import { format as dateFnsFormat, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

/** Format a number as Ariary with space-separated thousands. */
export function formatAr(n: number): string {
  const parts = Math.round(n).toString().split('');
  const formatted: string[] = [];
  for (let i = parts.length - 1, count = 0; i >= 0; i--, count++) {
    if (count > 0 && count % 3 === 0) {
      formatted.unshift(' ');
    }
    formatted.unshift(parts[i]);
  }
  return `${formatted.join('')} Ar`;
}

/** Format an ISO date string to 'dd MMM yyyy' in French locale. */
export function formatDate(dateStr: string): string {
  const d = parseISO(dateStr);
  return dateFnsFormat(d, 'dd MMM yyyy', { locale: fr });
}

/** Format an ISO date string to 'dd MMM yyyy HH:mm' in French locale. */
export function formatDateTime(dateStr: string): string {
  const d = parseISO(dateStr);
  return dateFnsFormat(d, 'dd MMM yyyy HH:mm', { locale: fr });
}

/** Format an ISO date string to 'HH:mm' in French locale. */
export function formatTime(dateStr: string): string {
  const d = parseISO(dateStr);
  return dateFnsFormat(d, 'HH:mm', { locale: fr });
}

/** Format a month/year pair as 'MMMM yyyy' in French locale. */
export function formatMonthYear(month: number, year: number): string {
  const d = new Date(year, month - 1, 1);
  return dateFnsFormat(d, 'MMMM yyyy', { locale: fr });
}

/** Truncate a string to maxLen with an ellipsis if needed. */
export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
