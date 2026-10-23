import type { Product, ProductStatus, Tone } from './types';

const brlFormatter = new Intl.NumberFormat('pt-BR', {
  style: 'currency',
  currency: 'BRL',
});

const numberFormatter = new Intl.NumberFormat('pt-BR', {
  maximumFractionDigits: 3,
});

export function brl(value: number | null | undefined): string {
  return brlFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function num(value: number | null | undefined): string {
  return numberFormatter.format(Number.isFinite(Number(value)) ? Number(value) : 0);
}

export function qty(value: number, unit?: string): string {
  return unit ? `${num(value)} ${unit}` : num(value);
}

export function parseLocalDate(date: string): Date {
  const [y, m, d] = date.split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function todayISO(): string {
  const now = new Date();
  const y = now.getFullYear();
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function nowTime(): string {
  const now = new Date();
  return `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
}

export function dateShort(date: string | null): string {
  if (!date) return '—';
  const parsed = parseLocalDate(date);
  const day = String(parsed.getDate()).padStart(2, '0');
  const month = parsed.toLocaleDateString('pt-BR', { month: 'short' }).replace('.', '');
  if (parsed.getFullYear() === new Date().getFullYear()) return `${day} de ${month}`;
  return `${day} ${month} ${parsed.getFullYear()}`;
}

export function dateLong(date: string): string {
  return parseLocalDate(date).toLocaleDateString('pt-BR', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
}

export function dateFull(date: string): string {
  return parseLocalDate(date).toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  });
}

export function weekdayShort(date: string): string {
  return parseLocalDate(date).toLocaleDateString('pt-BR', { weekday: 'short' }).replace('.', '');
}

export function todayLong(): string {
  const label = new Date().toLocaleDateString('pt-BR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function relativeDay(date: string): string {
  const today = todayISO();
  if (date === today) return 'Hoje';
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const y = yesterday.getFullYear();
  const m = String(yesterday.getMonth() + 1).padStart(2, '0');
  const d = String(yesterday.getDate()).padStart(2, '0');
  if (date === `${y}-${m}-${d}`) return 'Ontem';
  return dateShort(date);
}

export function daysUntil(date: string | null): number | null {
  if (!date) return null;
  const today = parseLocalDate(todayISO()).getTime();
  return Math.round((parseLocalDate(date).getTime() - today) / 86400000);
}

export function expiryLabel(date: string | null): string {
  if (!date) return 'Sem validade';
  const days = daysUntil(date);
  if (days === null) return 'Sem validade';
  if (days < 0) return `Vencido há ${Math.abs(days)}d`;
  if (days === 0) return 'Vence hoje';
  if (days === 1) return 'Vence amanhã';
  if (days <= 30) return `Vence em ${days}d`;
  return dateShort(date);
}

export function firstName(name: string): string {
  return name.trim().split(/\s+/)[0] ?? name;
}

export function initials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'P';
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
}

export function greeting(): string {
  const hour = new Date().getHours();
  if (hour < 12) return 'Bom dia';
  if (hour < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function productStatus(product: Product): ProductStatus {
  const days = daysUntil(product.expiresOn);
  if (days !== null && days < 0) return { key: 'expired', label: 'Vencido', tone: 'danger' };
  if (product.stock <= 0) return { key: 'out', label: 'Sem estoque', tone: 'danger' };
  if (days !== null && days <= 30) return { key: 'expiring', label: 'Validade próxima', tone: 'warning' };
  if (product.stock <= product.minStock) return { key: 'low', label: 'Estoque baixo', tone: 'warning' };
  return { key: 'ok', label: 'Em dia', tone: 'success' };
}

export function delta(current: number, previous: number): { value: number; label: string; tone: Tone } {
  if (!previous) {
    if (!current) return { value: 0, label: 'sem base anterior', tone: 'neutral' };
    return { value: 100, label: 'novo no período', tone: 'success' };
  }
  const value = ((current - previous) / previous) * 100;
  return {
    value,
    label: `${value >= 0 ? '+' : ''}${value.toFixed(0)}% vs. período anterior`,
    tone: value > 1 ? 'success' : value < -1 ? 'danger' : 'neutral',
  };
}

export function percent(part: number, total: number): number {
  if (!total) return 0;
  return (part / total) * 100;
}

export function plural(value: number, singular: string, pluralForm: string): string {
  return Math.abs(value) === 1 ? singular : pluralForm;
}

export function cx(...classes: (string | false | null | undefined)[]): string {
  return classes.filter(Boolean).join(' ');
}

export function parseAmountInput(value: string): number {
  const clean = value.replace(/[^\d,.-]/g, '').trim();
  if (!clean) return 0;
  const normalized = clean.includes(',') ? clean.replace(/\./g, '').replace(',', '.') : clean;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function downloadText(filename: string, content: string, mime = 'text/plain;charset=utf-8') {
  const blob = new Blob([content], { type: mime });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function toCsv(headers: string[], rows: (string | number | null | undefined)[][]): string {
  const escape = (value: string | number | null | undefined) => {
    const text = value === null || value === undefined ? '' : String(value);
    return `"${text.replace(/"/g, '""')}"`;
  };
  const lines = [headers.map(escape).join(';'), ...rows.map((row) => row.map(escape).join(';'))];
  return `\uFEFF${lines.join('\r\n')}`;
}

export function formatNumberInput(value: number, decimals = 2): string {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}

export function relativeTime(date: string, time: string): string {
  const today = todayISO();
  if (date === today) return `Hoje, ${time}`;
  return `${relativeDay(date)}, ${time}`;
}

export function normalizeText(value: string): string {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}
