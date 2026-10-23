import { useEffect, useState, type FormEvent } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Check,
  KeyRound,
  LockKeyhole,
  ShieldCheck,
  Sparkles,
  Table2,
} from 'lucide-react';
import { api } from '../api';
import type { Admin } from '../types';
import {
  Button,
  Field,
  InlineAlert,
  Logo,
  PasswordInput,
  PasswordMeter,
  useToast,
} from '../components/Ui';
import { cx } from '../format';

type Mode = 'login' | 'setup' | 'recover';

export function AuthScreen({
  configured,
  onAuthenticated,
}: {
  configured: boolean;
  onAuthenticated: (admin: Admin, recoveryKey?: string) => void;
}) {
  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>(configured ? 'login' : 'setup');
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [recoveryKey, setRecoveryKey] = useState('');
  const [withDemo, setWithDemo] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [cooldown, setCooldown] = useState(0);

  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setTimeout(() => setCooldown((value) => Math.max(0, value - 1)), 1000);
    return () => window.clearTimeout(timer);
  }, [cooldown]);

  const resetForm = () => {
    setError(null);
    setPassword('');
    setConfirm('');
    setRecoveryKey('');
  };

  const switchMode = (next: Mode) => {
    resetForm();
    setMode(next);
  };

  const handleLogin = async (event: FormEvent) => {
    event.preventDefault();
    if (!password) {
      setError('Digite sua senha para entrar.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<{ admin: Admin }>('/api/auth/login', { password });
      onAuthenticated(result.admin);
    } catch (err) {
      const apiError = err as { message?: string; status?: number; data?: { retryAfter?: number } };
      setError(apiError.message ?? 'Não foi possível entrar.');
      if (apiError.status === 429 && apiError.data?.retryAfter) {
        setCooldown(Number(apiError.data.retryAfter));
      }
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetup = async (event: FormEvent) => {
    event.preventDefault();
    if (name.trim().length < 2) {
      setError('Informe seu nome.');
      return;
    }
    if (password.length < 12) {
      setError('Use uma senha com pelo menos 12 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<{ admin: Admin; recoveryKey: string; demoLoaded: boolean }>(
        '/api/auth/setup',
        { name: name.trim(), password, withDemo },
      );
      onAuthenticated(result.admin, result.recoveryKey);
      toast(result.demoLoaded ? 'Acesso criado. Dados de exemplo carregados.' : 'Acesso criado com sucesso.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível criar o acesso.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleRecover = async (event: FormEvent) => {
    event.preventDefault();
    if (!recoveryKey.trim()) {
      setError('Informe sua chave de recuperação.');
      return;
    }
    if (password.length < 12) {
      setError('A nova senha precisa ter pelo menos 12 caracteres.');
      return;
    }
    if (password !== confirm) {
      setError('As senhas não coincidem.');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const result = await api.post<{ admin: Admin; recoveryKey: string }>('/api/auth/recover', {
        recoveryKey,
        newPassword: password,
      });
      onAuthenticated(result.admin, result.recoveryKey);
      toast('Acesso recuperado. Sua senha foi redefinida.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Não foi possível recuperar o acesso.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="auth-shell">
      <aside className="auth-art">
        <div className="auth-art-inner">
          <div className="auth-brand-row">
            <Logo light />
            <span className="auth-brand-tag">controle de estoque</span>
          </div>

          <div className="auth-copy">
            <span className="auth-kicker">
              <Sparkles size={14} /> Simples por fora. Preciso por dentro.
            </span>
            <h1>
              Seu estoque,
              <br />
              <em>em equilíbrio.</em>
            </h1>
            <p>
              Produtos, entradas e saídas organizados em um só lugar — com a clareza de quem sabe
              exatamente o que tem em mãos.
            </p>
          </div>

          <div className="auth-preview" aria-hidden="true">
            <div className="preview-top">
              <span className="preview-dot" />
              <span>Visão geral</span>
              <small>exemplo</small>
            </div>
            <div className="preview-main">
              <div>
                <span className="preview-label">Valor em estoque</span>
                <strong className="preview-value">R$ 7.504,28</strong>
              </div>
              <span className="preview-badge">
                <BarChart3 size={13} /> em dia
              </span>
            </div>
            <svg className="preview-chart" viewBox="0 0 420 110" preserveAspectRatio="none">
              <defs>
                <linearGradient id="authArea" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="#f6b8cc" stopOpacity="0.34" />
                  <stop offset="100%" stopColor="#f6b8cc" stopOpacity="0" />
                </linearGradient>
              </defs>
              <path
                d="M0 88 C 30 84, 42 66, 72 70 C 104 74, 116 48, 148 52 C 182 56, 194 74, 224 62 C 254 50, 264 32, 296 38 C 328 44, 342 26, 372 20 C 392 16, 408 22, 420 14 L 420 110 L 0 110 Z"
                fill="url(#authArea)"
              />
              <path
                d="M0 88 C 30 84, 42 66, 72 70 C 104 74, 116 48, 148 52 C 182 56, 194 74, 224 62 C 254 50, 264 32, 296 38 C 328 44, 342 26, 372 20 C 392 16, 408 22, 420 14"
                fill="none"
                stroke="#f6b8cc"
                strokeWidth="2.4"
                strokeLinecap="round"
              />
              <circle cx="420" cy="14" r="4" fill="#f6b8cc" stroke="#681630" strokeWidth="2.5" />
            </svg>
            <div className="preview-foot">
              <div>
                <span>Saídas no mês</span>
                <strong>192 un</strong>
              </div>
              <div>
                <span>Produtos ativos</span>
                <strong>14</strong>
              </div>
              <div>
                <span>Tudo em ordem</span>
                <strong>96%</strong>
              </div>
            </div>
          </div>

          <div className="auth-features">
            <span>
              <ShieldCheck size={15} /> Acesso único protegido
            </span>
            <span>
              <Table2 size={15} /> Planilha de produtos
            </span>
            <span>
              <BarChart3 size={15} /> Métricas de saída
            </span>
          </div>

          <p className="auth-art-foot">Silmara · clareza para decidir, segurança para continuar.</p>
        </div>
      </aside>

      <main className="auth-panel">
        <div className="auth-panel-inner">
          <div className="auth-mobile-brand">
            <Logo />
          </div>

          {mode === 'login' ? (
            <form className="auth-form" onSubmit={handleLogin} noValidate>
              <div className="auth-form-head">
                <span className="eyebrow">Acesso restrito</span>
                <h2>Bem-vinda de volta.</h2>
                <p>Entre com a senha da administradora para continuar.</p>
              </div>

              <div className="auth-lockmark" aria-hidden="true">
                <LockKeyhole size={20} />
                <span>
                  <strong>Administradora</strong>
                  <small>acesso exclusivo deste sistema</small>
                </span>
              </div>

              {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

              <Field label="Senha da administradora">
                <PasswordInput
                  value={password}
                  onChange={(event) => {
                    setPassword(event.target.value);
                    if (error) setError(null);
                  }}
                  placeholder="Digite sua senha"
                  autoComplete="current-password"
                  autoFocus
                  aria-label="Senha da administradora"
                />
              </Field>

              <Button
                type="submit"
                size="lg"
                full
                loading={submitting}
                disabled={cooldown > 0}
                iconAfter={<ArrowRight size={17} />}
              >
                {cooldown > 0 ? `Aguarde ${cooldown}s` : 'Entrar nos meus controles'}
              </Button>

              <button type="button" className="auth-link" onClick={() => switchMode('recover')}>
                <KeyRound size={14} /> Esqueci a senha — usar chave de recuperação
              </button>

              <div className="auth-security">
                <ShieldCheck size={15} />
                <span>
                  Sessão protegida por cookie seguro · tentativas ilimitadas não são permitidas
                </span>
              </div>
            </form>
          ) : null}

          {mode === 'setup' ? (
            <form className="auth-form" onSubmit={handleSetup} noValidate>
              <div className="auth-form-head">
                <span className="eyebrow">Primeiro acesso</span>
                <h2>Crie seu acesso.</h2>
                <p>
                  Esta é a única conta dos Controles da Silmara. Defina a senha da administradora — ela
                  será pedida em todos os acessos.
                </p>
              </div>

              {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

              <Field label="Seu nome">
                <input
                  className="input"
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Como você quer ser chamada"
                  autoComplete="name"
                  maxLength={50}
                  autoFocus
                  aria-label="Seu nome"
                />
              </Field>

              <Field label="Senha da administradora">
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Crie uma senha forte"
                  autoComplete="new-password"
                  aria-label="Senha da administradora"
                />
              </Field>
              <PasswordMeter password={password} name={name} />

              <Field
                label="Confirmar senha"
                error={confirm && password !== confirm ? 'As senhas não coincidem.' : null}
              >
                <PasswordInput
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Repita a senha"
                  autoComplete="new-password"
                  aria-label="Confirmar senha"
                />
              </Field>

              <label className={cx('demo-toggle', withDemo && 'is-on')}>
                <span className="demo-switch">
                  <input
                    type="checkbox"
                    checked={withDemo}
                    onChange={(event) => setWithDemo(event.target.checked)}
                  />
                  <span className="demo-track">
                    <span className="demo-thumb">{withDemo ? <Check size={11} /> : null}</span>
                  </span>
                </span>
                <span>
                  <strong>Começar com dados de exemplo</strong>
                  <small>Para explorar o painel. Você pode limpar depois em Ajustes.</small>
                </span>
              </label>

              <Button type="submit" size="lg" full loading={submitting} iconAfter={<ArrowRight size={17} />}>
                Criar acesso seguro
              </Button>

              <div className="auth-security">
                <ShieldCheck size={15} />
                <span>
                  Senha protegida com scrypt · bloqueio contra tentativas · chave de recuperação ao
                  final
                </span>
              </div>
            </form>
          ) : null}

          {mode === 'recover' ? (
            <form className="auth-form" onSubmit={handleRecover} noValidate>
              <button type="button" className="auth-back" onClick={() => switchMode('login')}>
                <ArrowLeft size={15} /> Voltar ao login
              </button>
              <div className="auth-form-head">
                <span className="eyebrow">Recuperação</span>
                <h2>Use sua chave.</h2>
                <p>
                  Informe a chave de recuperação gerada no primeiro acesso e defina uma nova senha.
                  Todas as sessões serão encerradas.
                </p>
              </div>

              {error ? <InlineAlert tone="danger">{error}</InlineAlert> : null}

              <Field
                label="Chave de recuperação"
                hint="Formato: SILMARA-XXXXX-XXXXX-XXXXX-XXXXX"
              >
                <input
                  className="input input-mono"
                  value={recoveryKey}
                  onChange={(event) => setRecoveryKey(event.target.value.toUpperCase())}
                  placeholder="SILMARA-XXXXX-XXXXX-XXXXX-XXXXX"
                  autoComplete="off"
                  spellCheck={false}
                  autoFocus
                  aria-label="Chave de recuperação"
                />
              </Field>

              <Field label="Nova senha">
                <PasswordInput
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="Crie uma nova senha forte"
                  autoComplete="new-password"
                  aria-label="Nova senha"
                />
              </Field>
              <PasswordMeter password={password} name={name} />

              <Field
                label="Confirmar nova senha"
                error={confirm && password !== confirm ? 'As senhas não coincidem.' : null}
              >
                <PasswordInput
                  value={confirm}
                  onChange={(event) => setConfirm(event.target.value)}
                  placeholder="Repita a nova senha"
                  autoComplete="new-password"
                  aria-label="Confirmar nova senha"
                />
              </Field>

              <Button type="submit" size="lg" full loading={submitting} iconAfter={<ArrowRight size={17} />}>
                Redefinir senha
              </Button>

              <div className="auth-security">
                <ShieldCheck size={15} />
                <span>Uma nova chave de recuperação será gerada ao final do processo.</span>
              </div>
            </form>
          ) : null}

          <footer className="auth-foot">
            <span>Controles da Silmara · seus dados ficam neste servidor</span>
          </footer>
        </div>
      </main>
    </div>
  );
}
