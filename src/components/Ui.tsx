import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useId,
  useRef,
  useState,
  type ButtonHTMLAttributes,
  type InputHTMLAttributes,
  type ReactNode,
  type SelectHTMLAttributes,
  type TextareaHTMLAttributes,
} from 'react';
import { createPortal } from 'react-dom';
import {
  AlertCircle,
  AlertTriangle,
  Check,
  CheckCircle2,
  ChevronDown,
  Eye,
  EyeOff,
  Info,
  Loader2,
  X,
} from 'lucide-react';
import { cx, formatNumberInput } from '../format';
import type { Tone } from '../types';

export function Spinner({ size = 16, className }: { size?: number; className?: string }) {
  return <Loader2 size={size} className={cx('spin', className)} aria-hidden="true" />;
}

type ButtonVariant = 'primary' | 'secondary' | 'ghost' | 'danger' | 'soft';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: ReactNode;
  iconAfter?: ReactNode;
  full?: boolean;
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  icon,
  iconAfter,
  full,
  className,
  children,
  disabled,
  type = 'button',
  ...rest
}: ButtonProps) {
  return (
    <button
      type={type}
      className={cx('btn', `btn-${variant}`, `btn-${size}`, full && 'btn-full', className)}
      disabled={disabled || loading}
      {...rest}
    >
      {loading ? <Spinner size={size === 'sm' ? 14 : 16} /> : icon}
      {children !== undefined && children !== null && children !== '' ? <span>{children}</span> : null}
      {iconAfter}
    </button>
  );
}

interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  label: string;
  size?: 'sm' | 'md';
  variant?: 'ghost' | 'outline' | 'danger';
}

export function IconButton({
  label,
  size = 'md',
  variant = 'ghost',
  className,
  children,
  ...rest
}: IconButtonProps) {
  return (
    <button
      type="button"
      className={cx('icon-btn', `icon-btn-${size}`, `icon-btn-${variant}`, className)}
      aria-label={label}
      title={label}
      {...rest}
    >
      {children}
    </button>
  );
}

export function Card({
  children,
  className,
  as: Tag = 'div',
}: {
  children: ReactNode;
  className?: string;
  as?: 'div' | 'section' | 'article';
}) {
  return <Tag className={cx('card', className)}>{children}</Tag>;
}

export function CardHead({
  title,
  subtitle,
  action,
  eyebrow,
}: {
  title: ReactNode;
  subtitle?: ReactNode;
  action?: ReactNode;
  eyebrow?: ReactNode;
}) {
  return (
    <div className="card-head">
      <div className="card-head-text">
        {eyebrow ? <span className="card-eyebrow">{eyebrow}</span> : null}
        <h2 className="card-title">{title}</h2>
        {subtitle ? <p className="card-subtitle">{subtitle}</p> : null}
      </div>
      {action ? <div className="card-head-action">{action}</div> : null}
    </div>
  );
}

export function PageHead({
  eyebrow,
  title,
  subtitle,
  actions,
  children,
}: {
  eyebrow?: ReactNode;
  title: ReactNode;
  subtitle?: ReactNode;
  actions?: ReactNode;
  children?: ReactNode;
}) {
  return (
    <header className="page-head">
      <div className="page-head-main">
        {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
        <h1 className="page-title">{title}</h1>
        {subtitle ? <p className="page-subtitle">{subtitle}</p> : null}
        {children}
      </div>
      {actions ? <div className="page-actions">{actions}</div> : null}
    </header>
  );
}

export function Field({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <label className={cx('field', className)}>
      <span className="field-label">
        {label}
        {optional ? <em>opcional</em> : null}
      </span>
      {children}
      {error ? (
        <span className="field-error">
          <AlertCircle size={13} /> {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </label>
  );
}

export function FieldGroup({
  label,
  hint,
  error,
  optional,
  children,
  className,
}: {
  label: ReactNode;
  hint?: ReactNode;
  error?: string | null;
  optional?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div className={cx('field', className)}>
      <span className="field-label">
        {label}
        {optional ? <em>opcional</em> : null}
      </span>
      {children}
      {error ? (
        <span className="field-error">
          <AlertCircle size={13} /> {error}
        </span>
      ) : hint ? (
        <span className="field-hint">{hint}</span>
      ) : null}
    </div>
  );
}

export function Input({ className, ...rest }: InputHTMLAttributes<HTMLInputElement>) {
  return <input className={cx('input', className)} {...rest} />;
}

export function Textarea({
  className,
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return <textarea className={cx('input', 'textarea', className)} {...rest} />;
}

export function Select({
  className,
  children,
  ...rest
}: SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <span className="select-wrap">
      <select className={cx('input', 'select', className)} {...rest}>
        {children}
      </select>
      <ChevronDown size={15} className="select-chevron" aria-hidden="true" />
    </span>
  );
}

export function PasswordInput({
  className,
  onChange,
  ...rest
}: InputHTMLAttributes<HTMLInputElement>) {
  const [visible, setVisible] = useState(false);
  const [caps, setCaps] = useState(false);
  return (
    <>
      <span className="password-wrap">
        <input
          className={cx('input', className)}
          type={visible ? 'text' : 'password'}
          onChange={onChange}
          onKeyUp={(event) => {
            setCaps(event.getModifierState?.('CapsLock') ?? false);
          }}
          onKeyDown={(event) => {
            setCaps(event.getModifierState?.('CapsLock') ?? false);
          }}
          {...rest}
        />
        <button
          type="button"
          className="password-toggle"
          onClick={() => setVisible((value) => !value)}
          aria-label={visible ? 'Ocultar senha' : 'Mostrar senha'}
          tabIndex={-1}
        >
          {visible ? <EyeOff size={17} /> : <Eye size={17} />}
        </button>
      </span>
      {caps ? <span className="caps-hint">Caps Lock está ativado</span> : null}
    </>
  );
}

export function CurrencyInput({
  value,
  onValueChange,
  id,
  ariaLabel,
  autoFocus,
  disabled,
}: {
  value: number;
  onValueChange: (value: number) => void;
  id?: string;
  ariaLabel?: string;
  autoFocus?: boolean;
  disabled?: boolean;
}) {
  const lastEmitted = useRef<number>(value);
  const [display, setDisplay] = useState(value ? formatNumberInput(value, 2) : '');

  useEffect(() => {
    if (value !== lastEmitted.current) {
      setDisplay(value ? formatNumberInput(value, 2) : '');
      lastEmitted.current = value;
    }
  }, [value]);

  return (
    <span className={cx('currency-wrap', disabled && 'is-disabled')}>
      <span className="currency-prefix">R$</span>
      <input
        id={id}
        aria-label={ariaLabel}
        className="input currency-input"
        inputMode="numeric"
        autoComplete="off"
        autoFocus={autoFocus}
        disabled={disabled}
        placeholder="0,00"
        value={display}
        onChange={(event) => {
          const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
          if (!digits) {
            setDisplay('');
            lastEmitted.current = 0;
            onValueChange(0);
            return;
          }
          const amount = Number(digits) / 100;
          setDisplay(formatNumberInput(amount, 2));
          lastEmitted.current = amount;
          onValueChange(amount);
        }}
      />
    </span>
  );
}

export function Badge({
  tone = 'neutral',
  dot,
  children,
  className,
}: {
  tone?: Tone;
  dot?: boolean;
  children: ReactNode;
  className?: string;
}) {
  return (
    <span className={cx('badge', `badge-${tone}`, className)}>
      {dot ? <i className="badge-dot" aria-hidden="true" /> : null}
      {children}
    </span>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  label,
  className,
  compact,
}: {
  options: { value: T; label: ReactNode; icon?: ReactNode }[];
  value: T;
  onChange: (value: T) => void;
  label?: string;
  className?: string;
  compact?: boolean;
}) {
  return (
    <div className={cx('segmented', compact && 'segmented-compact', className)} role="group" aria-label={label}>
      {options.map((option) => (
        <button
          key={option.value}
          type="button"
          className={cx('segmented-item', value === option.value && 'is-active')}
          aria-pressed={value === option.value}
          onClick={() => onChange(option.value)}
        >
          {option.icon}
          {option.label}
        </button>
      ))}
    </div>
  );
}

export function Divider({ className }: { className?: string }) {
  return <div className={cx('divider', className)} role="separator" />;
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  eyebrow,
  children,
  footer,
  onSubmit,
  size = 'md',
  dismissible = true,
  variant = 'modal',
}: {
  open: boolean;
  onClose: () => void;
  title: ReactNode;
  subtitle?: ReactNode;
  eyebrow?: ReactNode;
  children: ReactNode;
  footer?: ReactNode;
  onSubmit?: (event: React.FormEvent<HTMLFormElement>) => void;
  size?: 'sm' | 'md' | 'lg';
  dismissible?: boolean;
  variant?: 'modal' | 'drawer';
}) {
  const panelRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
  const dismissibleRef = useRef(dismissible);
  closeRef.current = onClose;
  dismissibleRef.current = dismissible;
  const titleId = useId();

  useEffect(() => {
    if (!open) return;
    const previous = document.activeElement as HTMLElement | null;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const panel = panelRef.current;
    const findFocusable = () =>
      panel
        ? Array.from(
            panel.querySelectorAll<HTMLElement>(
              'input:not([disabled]):not([type="hidden"]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
            ),
          ).filter((element) => element.offsetParent !== null)
        : [];

    const timer = window.setTimeout(() => {
      const focusable = findFocusable();
      const preferred = panel?.querySelector<HTMLElement>('[data-autofocus]');
      (preferred ?? focusable[0] ?? panel)?.focus();
    }, 40);

    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && dismissibleRef.current) {
        event.preventDefault();
        closeRef.current();
        return;
      }
      if (event.key !== 'Tab') return;
      const focusable = findFocusable();
      if (focusable.length === 0) {
        event.preventDefault();
        panel?.focus();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey);
    return () => {
      window.clearTimeout(timer);
      document.removeEventListener('keydown', handleKey);
      document.body.style.overflow = previousOverflow;
      previous?.focus?.();
    };
  }, [open]);

  if (!open) return null;

  const body = (
    <>
      <div className="overlay-body">{children}</div>
      {footer ? <div className="overlay-footer">{footer}</div> : null}
    </>
  );

  return createPortal(
    <div
      className={cx('overlay', `overlay-${variant}`)}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && dismissible) onClose();
      }}
    >
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={cx(
          'overlay-panel',
          variant === 'drawer' ? 'drawer-panel' : `modal-panel modal-${size}`,
        )}
      >
        <div className="overlay-head">
          <div>
            {eyebrow ? <p className="eyebrow">{eyebrow}</p> : null}
            <h2 id={titleId} className="overlay-title">
              {title}
            </h2>
            {subtitle ? <p className="overlay-subtitle">{subtitle}</p> : null}
          </div>
          {dismissible ? (
            <IconButton label="Fechar" onClick={onClose} className="overlay-close">
              <X size={18} />
            </IconButton>
          ) : null}
        </div>
        {onSubmit ? (
          <form className="overlay-form" onSubmit={onSubmit} noValidate>
            {body}
          </form>
        ) : (
          body
        )}
      </div>
    </div>,
    document.body,
  );
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = 'Excluir',
  cancelLabel = 'Cancelar',
  tone = 'danger',
  onConfirm,
  onClose,
  children,
}: {
  open: boolean;
  title: string;
  description: ReactNode;
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: 'danger' | 'primary';
  onConfirm: () => Promise<void> | void;
  onClose: () => void;
  children?: ReactNode;
}) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) setError(null);
  }, [open]);

  return (
    <Modal
      open={open}
      onClose={busy ? () => undefined : onClose}
      title={title}
      size="sm"
      dismissible={!busy}
      footer={
        <>
          <Button variant="ghost" onClick={onClose} disabled={busy}>
            {cancelLabel}
          </Button>
          <Button
            variant={tone === 'danger' ? 'danger' : 'primary'}
            loading={busy}
            onClick={async () => {
              setBusy(true);
              setError(null);
              try {
                await onConfirm();
                onClose();
              } catch (err) {
                setError(err instanceof Error ? err.message : 'Não foi possível concluir.');
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className={cx('confirm-body', tone === 'danger' && 'confirm-danger')}>
        <div className="confirm-icon">
          <AlertTriangle size={20} />
        </div>
        <div>
          <p className="confirm-text">{description}</p>
          {children}
          {error ? <p className="form-error">{error}</p> : null}
        </div>
      </div>
    </Modal>
  );
}

type ToastTone = 'success' | 'error' | 'info';

interface ToastItem {
  id: number;
  message: string;
  tone: ToastTone;
}

const ToastContext = createContext<{ toast: (message: string, tone?: ToastTone) => void } | null>(null);

let toastId = 0;

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const remove = useCallback((id: number) => {
    setItems((current) => current.filter((item) => item.id !== id));
  }, []);
  const toast = useCallback((message: string, tone: ToastTone = 'success') => {
    toastId += 1;
    setItems((current) => [...current.slice(-3), { id: toastId, message, tone }]);
  }, []);
  return (
    <ToastContext.Provider value={{ toast }}>
      {children}
      {createPortal(
        <div className="toast-stack" aria-live="polite" aria-atomic="false">
          {items.map((item) => (
            <ToastCard key={item.id} item={item} onDone={() => remove(item.id)} />
          ))}
        </div>,
        document.body,
      )}
    </ToastContext.Provider>
  );
}

function ToastCard({ item, onDone }: { item: ToastItem; onDone: () => void }) {
  useEffect(() => {
    const timer = window.setTimeout(onDone, 4600);
    return () => window.clearTimeout(timer);
  }, [onDone]);
  const Icon = item.tone === 'success' ? CheckCircle2 : item.tone === 'error' ? AlertCircle : Info;
  return (
    <div className={cx('toast', `toast-${item.tone}`)} role="status">
      <Icon size={18} className="toast-icon" />
      <span>{item.message}</span>
      <button type="button" className="toast-close" onClick={onDone} aria-label="Fechar aviso">
        <X size={14} />
      </button>
    </div>
  );
}

export function useToast() {
  const context = useContext(ToastContext);
  if (!context) throw new Error('useToast precisa estar dentro de ToastProvider');
  return context;
}

export function EmptyState({
  icon,
  title,
  description,
  action,
  compact,
}: {
  icon?: ReactNode;
  title: string;
  description: ReactNode;
  action?: ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={cx('empty-state', compact && 'empty-state-compact')}>
      <div className="empty-mark" aria-hidden="true">
        {icon ?? <Info size={22} />}
      </div>
      <h3>{title}</h3>
      <p>{description}</p>
      {action ? <div className="empty-actions">{action}</div> : null}
    </div>
  );
}

export function Skeleton({ className }: { className?: string }) {
  return <span className={cx('skeleton', className)} aria-hidden="true" />;
}

export function Logo({ light, compact }: { light?: boolean; compact?: boolean }) {
  return (
    <span className={cx('logo', light && 'logo-light', compact && 'logo-compact')}>
      <svg viewBox="0 0 40 40" className="brand-mark" aria-hidden="true">
        <rect className="brand-mark-bg" width="40" height="40" rx="12" />
        <path
          className="brand-mark-line"
          d="M26.6 12.2c-1.4-1.8-3.7-2.9-6.5-2.9-3.9 0-6.7 2-6.7 4.9 0 2.6 1.9 3.9 5.7 4.8 3.9 1 5.9 2.1 5.9 4.8 0 3.1-2.9 5.1-6.8 5.1-2.7 0-5.1-.9-6.7-2.7"
          strokeWidth="2.1"
          strokeLinecap="round"
        />
        <circle className="brand-mark-dot" cx="30.2" cy="10.8" r="2.4" />
      </svg>
      {!compact ? (
        <span className="logo-word">
          <small>Controles da</small>
          <strong>Silmara</strong>
        </span>
      ) : null}
    </span>
  );
}

export function Avatar({ name, size = 36 }: { name: string; size?: number }) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const label =
    parts.length === 0
      ? 'P'
      : parts.length === 1
        ? parts[0].slice(0, 2).toUpperCase()
        : `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase();
  return (
    <span className="avatar" style={{ width: size, height: size, fontSize: size * 0.34 }}>
      {label}
    </span>
  );
}

export function PasswordMeter({
  password,
  name,
  showChecks = true,
}: {
  password: string;
  name?: string;
  showChecks?: boolean;
}) {
  const checks = [
    { label: '12 caracteres ou mais', ok: password.length >= 12 },
    { label: 'Maiúscula e minúscula', ok: /[a-z]/.test(password) && /[A-Z]/.test(password) },
    { label: 'Pelo menos um número', ok: /\d/.test(password) },
    { label: 'Um símbolo (!@#…)', ok: /[^A-Za-z0-9]/.test(password) },
  ];
  const passed = checks.filter((check) => check.ok).length;
  const bonus = password.length >= 16 ? 1 : 0;
  const score = Math.min(5, passed + bonus);
  const labels = ['Muito fraca', 'Fraca', 'Razoável', 'Boa', 'Forte', 'Excelente'];
  const tone = score <= 1 ? 'danger' : score <= 3 ? 'warning' : 'success';
  const nameWarning =
    name && name.trim().length >= 3 && password.toLowerCase().includes(name.trim().toLowerCase());
  if (!password) return null;
  return (
    <div className="pw-meter">
      <div className="pw-meter-top">
        <div className={cx('pw-bars', `pw-${tone}`)} aria-hidden="true">
          {[1, 2, 3, 4, 5].map((segment) => (
            <span key={segment} className={cx(segment <= score && 'is-on')} />
          ))}
        </div>
        <span className={cx('pw-label', `pw-label-${tone}`)}>{labels[score]}</span>
      </div>
      {showChecks ? (
        <ul className="pw-checks">
          {checks.map((check) => (
            <li key={check.label} className={cx(check.ok && 'is-ok')}>
              {check.ok ? <Check size={12} /> : <span className="pw-dot" />}
              {check.label}
            </li>
          ))}
          {nameWarning ? (
            <li className="is-warning">
              <AlertCircle size={12} /> Evite usar seu nome
            </li>
          ) : null}
        </ul>
      ) : null}
    </div>
  );
}

export function InlineAlert({
  tone = 'info',
  title,
  children,
  action,
}: {
  tone?: 'info' | 'warning' | 'danger' | 'success';
  title?: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const Icon = tone === 'danger' || tone === 'warning' ? AlertTriangle : tone === 'success' ? CheckCircle2 : Info;
  return (
    <div className={cx('inline-alert', `inline-alert-${tone}`)}>
      <Icon size={17} className="inline-alert-icon" />
      <div className="inline-alert-body">
        {title ? <strong>{title}</strong> : null}
        <span>{children}</span>
      </div>
      {action}
    </div>
  );
}
