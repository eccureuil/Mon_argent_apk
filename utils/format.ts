import { format as dateFnsFormat, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';

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

export function formatDate(dateStr: string): string {
  const d = parseISO(dateStr);
  return dateFnsFormat(d, 'dd MMM yyyy', { locale: fr });
}

export function formatDateTime(dateStr: string): string {
  const d = parseISO(dateStr);
  return dateFnsFormat(d, 'dd MMM yyyy HH:mm', { locale: fr });
}

export function formatTime(dateStr: string): string {
  const d = parseISO(dateStr);
  return dateFnsFormat(d, 'HH:mm', { locale: fr });
}

export function formatMonthYear(month: number, year: number): string {
  const d = new Date(year, month - 1, 1);
  return dateFnsFormat(d, 'MMMM yyyy', { locale: fr });
}

export function truncate(str: string, maxLen: number): string {
  if (str.length <= maxLen) return str;
  return str.substring(0, maxLen - 3) + '...';
}
