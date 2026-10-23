import { useEffect, useState, type FormEvent } from 'react';
import {
  Check,
  Clock3,
  Database,
  Download,
  FileSpreadsheet,
  KeyRound,
  Laptop,
  LockKeyhole,
  LogOut,
  RefreshCw,
  ShieldAlert,
  ShieldCheck,
  Sparkles,
  Trash2,
  UserRound,
} from 'lucide-react';
import { api } from '../api';
import { useApp } from '../app-context';
import type { Admin, Product } from '../types';
import {
  brl,
  dateLong,
  downloadText,
  num,
  todayISO,
  toCsv,
} from '../format';
import {
  Avatar,
  Button,
  Card,
  CardHead,
  ConfirmDialog,
  Field,
  InlineAlert,
  Input,
  Modal,
  PageHead,
  PasswordInput,
  PasswordMeter,
  Skeleton,
  useToast,
} from '../components/Ui';
import { RecoveryKeyModal } from '../components/RecoveryKeyModal';

interface MeResponse {
  admin: Admin;
  session: { expiresAt: string; activeSessions: number };
}

function longDate(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('pt-BR', { day: '2-digit', month: 'long', year: 'numeric' });
}

function dateTime(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString('pt-BR', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function Settings() {
  const { admin, updateAdmin, notifyChange, logout } = useApp();
  const { toast } = useToast();
  const [me, setMe] = useState<MeResponse | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [name, setName] = useState(admin.name);
  const [profileSaving, setProfileSaving] = useState(false);
  const [profileError, setProfileError] = useState<string | null>(null);

  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordError, setPasswordError] = useState<string | null>(null);

  const [revokeOpen, setRevokeOpen] = useState(false);
  const [recoveryOpen, setRecoveryOpen] = useState(false);
  const [recoveryPassword, setRecoveryPassword] = useState('');
  const [recoveryBusy, setRecoveryBusy] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);
  const [newRecoveryKey, setNewRecoveryKey] = useState<string | null>(null);

  const [resetOpen, setResetOpen] = useState(false);
  const [resetPassword, setResetPassword] = useState('');
  const [resetConfirmation, setResetConfirmation] = useState('');
  const [resetBusy, setResetBusy] = useState(false);
  const [resetError, setResetError] = useState<string | null>(null);

  const [exportBusy, setExportBusy] = useState(false);
  const [demoBusy, setDemoBusy] = useState(false);

  const load = async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const [meResult, productsResult] = await Promise.all([
        api.get<MeResponse>('/api/auth/me'),
        api.get<{ products: Product[] }>('/api/products'),
      ]);
      setMe(meResult);
      setProducts(productsResult.products);
      setName(meResult.admin.name);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Não foi possível carregar os ajustes.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const saveProfile = async (event: FormEvent) => {
    event.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setProfileError('Informe pelo menos 2 caracteres.');
      return;
    }
    setProfileSaving(true);
    setProfileError(null);
    try {
      const result = await api.patch<{ admin: Admin }>('/api/auth/profile', { name: trimmed });
      updateAdmin(result.admin);
      setMe((current) => (current ? { ...current, admin: result.admin } : current));
      toast('Perfil atualizado.');
    } catch (err) {
      setProfileError(err instanceof Error ? err.message : 'Não foi possível salvar o perfil.');
    } finally {
      setProfileSaving(false);
    }
  };

  const changePassword = async (event: FormEvent) => {
    event.preventDefault();
    if (!currentPassword) {
      setPasswordError('Digite sua senha atual.');
      return;
    }
    if (newPassword.length < 12) {
      setPasswordError('A nova senha precisa ter pelo menos 12 caracteres.');
      return;
    }
    if (newPassword !== confirmPassword) {
      setPasswordError('A confirmação não coincide com a nova senha.');
      return;
    }
    setPasswordSaving(true);
    setPasswordError(null);
    try {
      const result = await api.post<{ message: string; revoked: number }>(
        '/api/auth/change-password',
        { currentPassword, newPassword },
      );
      const stamp = new Date().toISOString();
      updateAdmin({ ...admin, passwordChangedAt: stamp });
      setMe((current) =>
        current
          ? { ...current, admin: { ...current.admin, passwordChangedAt: stamp } }
          : current,
      );
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      toast(result.message);
    } catch (err) {
      setPasswordError(err instanceof Error ? err.message : 'Não foi possível alterar a senha.');
    } finally {
      setPasswordSaving(false);
    }
  };

  const regenerateRecovery = async (event: FormEvent) => {
    event.preventDefault();
    if (!recoveryPassword) {
      setRecoveryError('Digite sua senha para confirmar.');
      return;
    }
    setRecoveryBusy(true);
    setRecoveryError(null);
    try {
      const result = await api.post<{ recoveryKey: string }>('/api/auth/recovery/regenerate', {
        password: recoveryPassword,
      });
      setRecoveryOpen(false);
      setRecoveryPassword('');
      setNewRecoveryKey(result.recoveryKey);
      updateAdmin({ ...admin, recoveryConfigured: true });
      setMe((current) =>
        current
          ? { ...current, admin: { ...current.admin, recoveryConfigured: true } }
          : current,
      );
      toast('Nova chave de recuperação gerada.');
    } catch (err) {
      setRecoveryError(err instanceof Error ? err.message : 'Não foi possível gerar a chave.');
    } finally {
      setRecoveryBusy(false);
    }
  };

  const exportBackup = async () => {
    setExportBusy(true);
    try {
      const response = await fetch('/api/export', { credentials: 'same-origin' });
      if (!response.ok) throw new Error('Não foi possível gerar o backup.');
      const content = await response.text();
      downloadText(
        `controles-da-silmara-backup-${todayISO()}.json`,
        content,
        'application/json;charset=utf-8',
      );
      toast('Backup completo baixado.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível gerar o backup.', 'error');
    } finally {
      setExportBusy(false);
    }
  };

  const exportProducts = () => {
    const headers = [
      'Produto',
      'Código',
      'Tipo',
      'Unidade',
      'Estoque atual',
      'Estoque mínimo',
      'Preço unitário',
      'Valor em estoque',
      'Validade',
    ];
    const rows = products.map((product) => [
      product.name,
      product.sku,
      product.typeName,
      product.unit,
      num(product.stock),
      num(product.minStock),
      product.price.toFixed(2).replace('.', ','),
      (Math.max(product.stock, 0) * product.price).toFixed(2).replace('.', ','),
      product.expiresOn ? dateLong(product.expiresOn) : '',
    ]);
    downloadText(
      `controles-da-silmara-produtos-${todayISO()}.csv`,
      toCsv(headers, rows),
      'text/csv;charset=utf-8',
    );
    toast(`${products.length} produtos exportados em CSV.`);
  };

  const loadDemo = async () => {
    setDemoBusy(true);
    try {
      await api.post('/api/demo');
      notifyChange();
      await load();
      toast('Dados de exemplo carregados.');
    } catch (err) {
      toast(err instanceof Error ? err.message : 'Não foi possível carregar o exemplo.', 'error');
    } finally {
      setDemoBusy(false);
    }
  };

  const resetData = async (event: FormEvent) => {
    event.preventDefault();
    if (!resetPassword) {
      setResetError('Digite sua senha.');
      return;
    }
    if (resetConfirmation !== 'APAGAR') {
      setResetError('Digite APAGAR exatamente como aparece.');
      return;
    }
    setResetBusy(true);
    setResetError(null);
    try {
      await api.post('/api/data/reset', {
        password: resetPassword,
        confirmation: resetConfirmation,
      });
      setResetOpen(false);
      setResetPassword('');
      setResetConfirmation('');
      notifyChange();
      await load();
      toast('Todos os dados foram apagados. Os tipos padrão foram recriados.');
    } catch (err) {
      setResetError(err instanceof Error ? err.message : 'Não foi possível apagar os dados.');
    } finally {
      setResetBusy(false);
    }
  };

  if (loading && !me) {
    return (
      <div className="page">
        <PageHead
          eyebrow="Conta e segurança"
          title="Ajustes"
          subtitle="Carregando suas configurações…"
        />
        <div className="settings-layout">
          <Card>
            <Skeleton className="skeleton-line-md" />
            <Skeleton className="skeleton-block" />
          </Card>
          <Card>
            <Skeleton className="skeleton-line-md" />
            <Skeleton className="skeleton-block" />
          </Card>
        </div>
      </div>
    );
  }

  const activeSessions = me?.session.activeSessions ?? 1;
  const otherSessions = Math.max(0, activeSessions - 1);
  const recoveryConfigured = me?.admin.recoveryConfigured ?? admin.recoveryConfigured;

  return (
    <div className="page">
      <PageHead
        eyebrow="Conta e segurança"
        title="Ajustes"
        subtitle="Sua conta, seu backup e as proteções dos Controles da Silmara — tudo em um só lugar."
        actions={
          <Button variant="secondary" icon={<LogOut size={16} />} onClick={logout}>
            Sair com segurança
          </Button>
        }
      />

      {loadError ? (
        <InlineAlert
          tone="danger"
          action={
            <Button size="sm" variant="secondary" onClick={load}>
              Tentar novamente
            </Button>
          }
        >
          {loadError}
        </InlineAlert>
      ) : null}

      <div className="settings-layout">
        <div className="settings-main">
          <Card className="settings-card">
            <CardHead
              title="Perfil da administradora"
              subtitle="Como você aparece nos seus controles"
              action={
                <span className="settings-pill">
                  <UserRound size={13} /> Acesso único
                </span>
              }
            />
            <div className="profile-card-row">
              <Avatar name={me?.admin.name ?? admin.name} size={52} />
              <div>
                <strong>{me?.admin.name ?? admin.name}</strong>
                <span>Administradora do sistema</span>
                <small>
                  Conta criada em {me ? longDate(me.admin.createdAt) : longDate(admin.createdAt)}
                </small>
              </div>
            </div>
            <form className="settings-form" onSubmit={saveProfile}>
              <Field label="Seu nome" error={profileError}>
                <Input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  maxLength={50}
                  autoComplete="name"
                />
              </Field>
              <div className="settings-actions">
                <span className="settings-note">Usado nas saudações e no cabeçalho.</span>
                <Button
                  type="submit"
                  size="sm"
                  loading={profileSaving}
                  disabled={name.trim() === (me?.admin.name ?? admin.name)}
                >
                  Salvar nome
                </Button>
              </div>
            </form>
          </Card>

          <Card className="settings-card">
            <CardHead
              title="Senha de acesso"
              subtitle="Troque a senha periodicamente para manter o acesso protegido"
              action={
                <span className="settings-pill settings-pill-safe">
                  <ShieldCheck size={13} /> Protegida
                </span>
              }
            />
            <p className="settings-muted">
              Última alteração em{' '}
              {me ? longDate(me.admin.passwordChangedAt) : longDate(admin.passwordChangedAt)}.
            </p>
            <form className="settings-form" onSubmit={changePassword}>
              <Field label="Senha atual">
                <PasswordInput
                  value={currentPassword}
                  onChange={(event) => setCurrentPassword(event.target.value)}
                  autoComplete="current-password"
                  placeholder="Sua senha atual"
                />
              </Field>
              <div className="form-row">
                <Field label="Nova senha">
                  <PasswordInput
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Mínimo de 12 caracteres"
                  />
                </Field>
                <Field label="Confirmar nova senha">
                  <PasswordInput
                    value={confirmPassword}
                    onChange={(event) => setConfirmPassword(event.target.value)}
                    autoComplete="new-password"
                    placeholder="Repita a nova senha"
                  />
                </Field>
              </div>
              <PasswordMeter password={newPassword} name={me?.admin.name ?? admin.name} />
              {passwordError ? <InlineAlert tone="danger">{passwordError}</InlineAlert> : null}
              <div className="settings-actions">
                <span className="settings-note">
                  Ao alterar, outras sessões conectadas são encerradas.
                </span>
                <Button
                  type="submit"
                  size="sm"
                  loading={passwordSaving}
                  disabled={!currentPassword || !newPassword || !confirmPassword}
                  icon={<LockKeyhole size={15} />}
                >
                  Alterar senha
                </Button>
              </div>
            </form>
          </Card>

          <Card className="settings-card">
            <CardHead title="Dados e backup" subtitle="Suas informações sempre com você" />
            <div className="data-actions">
              <div className="data-action">
                <span className="data-action-icon">
                  <Database size={19} />
                </span>
                <div className="data-action-text">
                  <strong>Backup completo</strong>
                  <small>
                    Produtos, tipos, movimentações e perfil em um arquivo JSON.
                  </small>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download size={15} />}
                  loading={exportBusy}
                  onClick={exportBackup}
                >
                  Baixar
                </Button>
              </div>
              <div className="data-action">
                <span className="data-action-icon">
                  <FileSpreadsheet size={19} />
                </span>
                <div className="data-action-text">
                  <strong>Planilha em CSV</strong>
                  <small>Produtos com estoque, preço, tipo e validade.</small>
                </div>
                <Button
                  size="sm"
                  variant="secondary"
                  icon={<Download size={15} />}
                  onClick={exportProducts}
                  disabled={products.length === 0}
                >
                  Exportar
                </Button>
              </div>
              {products.length === 0 ? (
                <div className="data-action">
                  <span className="data-action-icon">
                    <Sparkles size={19} />
                  </span>
                  <div className="data-action-text">
                    <strong>Dados de exemplo</strong>
                    <small>
                      Preencha os controles com produtos e movimentações fictícias para explorar.
                    </small>
                  </div>
                  <Button
                    size="sm"
                    variant="secondary"
                    loading={demoBusy}
                    onClick={loadDemo}
                  >
                    Carregar
                  </Button>
                </div>
              ) : null}
            </div>
            <p className="settings-note settings-note-block">
              O backup é um retrato do momento. Guarde-o em local seguro.
            </p>
          </Card>

          <Card className="danger-card">
            <CardHead
              title="Zona de risco"
              subtitle="Uma ação definitiva, sem volta"
              action={
                <span className="settings-pill settings-pill-danger">
                  <Trash2 size={13} /> Cuidado
                </span>
              }
            />
            <div className="danger-row">
              <div>
                <strong>Apagar todos os dados</strong>
                <p>
                  Remove produtos, tipos e movimentações deste sistema. O acesso da administradora
                  é mantido. Considere baixar um backup antes.
                </p>
              </div>
              <Button
                variant="danger"
                icon={<Trash2 size={16} />}
                onClick={() => {
                  setResetError(null);
                  setResetPassword('');
                  setResetConfirmation('');
                  setResetOpen(true);
                }}
              >
                Apagar dados
              </Button>
            </div>
          </Card>
        </div>

        <aside className="settings-side">
          <Card className="settings-card">
            <CardHead title="Sessão ativa" subtitle="Acesso atual a este sistema" />
            <ul className="session-facts">
              <li>
                <span className="session-fact-icon">
                  <Laptop size={17} />
                </span>
                <span>
                  <small>Este dispositivo</small>
                  <strong>Conectado agora</strong>
                </span>
                <span className="status-dot" />
              </li>
              <li>
                <span className="session-fact-icon">
                  <Clock3 size={17} />
                </span>
                <span>
                  <small>Expiração da sessão</small>
                  <strong>{me ? dateTime(me.session.expiresAt) : '—'}</strong>
                </span>
              </li>
              <li>
                <span className="session-fact-icon">
                  <ShieldCheck size={17} />
                </span>
                <span>
                  <small>Outras sessões</small>
                  <strong>
                    {otherSessions === 0
                      ? 'Nenhuma ativa'
                      : `${otherSessions} ${otherSessions === 1 ? 'ativa' : 'ativas'}`}
                  </strong>
                </span>
              </li>
            </ul>
            <div className="settings-side-actions">
              <Button
                size="sm"
                variant="secondary"
                icon={<LogOut size={15} />}
                disabled={otherSessions === 0}
                onClick={() => setRevokeOpen(true)}
              >
                Encerrar outras sessões
              </Button>
              <Button size="sm" variant="ghost" onClick={logout}>
                Sair agora
              </Button>
            </div>
          </Card>

          <Card className="settings-card">
            <CardHead title="Chave de recuperação" subtitle="Seu plano B de acesso" />
            <div className="recovery-status">
              <span className="recovery-status-icon">
                <KeyRound size={18} />
              </span>
              <div>
                <strong>{recoveryConfigured ? 'Chave configurada' : 'Nenhuma chave configurada'}</strong>
                <small>
                  {recoveryConfigured
                    ? 'Use-a se esquecer a senha'
                    : 'Gere uma chave para ter um plano B'}
                </small>
              </div>
              {recoveryConfigured ? (
                <Check size={16} className="recovery-status-check" />
              ) : (
                <ShieldAlert size={16} className="recovery-status-check" />
              )}
            </div>
            <p className="settings-muted">
              Use a chave para redefinir a senha se esquecê-la. Ao gerar uma nova, a anterior deixa
              de funcionar imediatamente.
            </p>
            <Button
              size="sm"
              variant="secondary"
              icon={<RefreshCw size={15} />}
              onClick={() => {
                setRecoveryPassword('');
                setRecoveryError(null);
                setRecoveryOpen(true);
              }}
            >
              {recoveryConfigured ? 'Gerar nova chave' : 'Gerar chave de recuperação'}
            </Button>
          </Card>

          <Card className="settings-card security-card">
            <CardHead title="Segurança por padrão" subtitle="O que protege o seu acesso" />
            <ul className="security-list">
              <li>
                <span className="security-list-icon">
                  <ShieldCheck size={16} />
                </span>
                <div>
                  <strong>Senha com scrypt</strong>
                  <small>Derivação lenta com sal. Nunca armazenamos a senha em si.</small>
                </div>
              </li>
              <li>
                <span className="security-list-icon">
                  <LockKeyhole size={16} />
                </span>
                <div>
                  <strong>Sessão blindada</strong>
                  <small>Cookie HttpOnly, SameSite estrito e renovação deslizante.</small>
                </div>
              </li>
              <li>
                <span className="security-list-icon">
                  <Clock3 size={16} />
                </span>
                <div>
                  <strong>Bloqueio progressivo</strong>
                  <small>Tentativas repetidas bloqueiam temporariamente o acesso.</small>
                </div>
              </li>
              <li>
                <span className="security-list-icon">
                  <KeyRound size={16} />
                </span>
                <div>
                  <strong>Recuperação off-line</strong>
                  <small>Uma chave única, que só você conhece.</small>
                </div>
              </li>
            </ul>
            <p className="security-foot">
              Controles da Silmara · acesso exclusivo para{' '}
              <strong>{me?.admin.name ?? admin.name}</strong>
            </p>
          </Card>
        </aside>
      </div>

      <ConfirmDialog
        open={revokeOpen}
        title="Encerrar outras sessões?"
        description="Qualquer outro dispositivo conectado perderá o acesso imediatamente. Esta sessão atual continua ativa."
        confirmLabel="Encerrar sessões"
        tone="primary"
        onClose={() => setRevokeOpen(false)}
        onConfirm={async () => {
          const result = await api.post<{ revoked: number; activeSessions: number }>(
            '/api/auth/revoke-sessions',
          );
          setMe((current) =>
            current
              ? {
                  ...current,
                  session: { ...current.session, activeSessions: result.activeSessions },
                }
              : current,
          );
          toast(
            result.revoked > 0
              ? `${result.revoked} ${result.revoked === 1 ? 'sessão encerrada' : 'sessões encerradas'}.`
              : 'Nenhuma outra sessão estava ativa.',
          );
        }}
      />

      <Modal
        open={recoveryOpen}
        onClose={() => setRecoveryOpen(false)}
        size="sm"
        eyebrow="Segurança"
        title="Gerar nova chave"
        subtitle="A chave atual será substituída imediatamente."
        onSubmit={regenerateRecovery}
        dismissible={!recoveryBusy}
        footer={
          <>
            <Button variant="ghost" onClick={() => setRecoveryOpen(false)} disabled={recoveryBusy}>
              Cancelar
            </Button>
            <Button
              type="submit"
              loading={recoveryBusy}
              disabled={!recoveryPassword}
              icon={<RefreshCw size={15} />}
            >
              Gerar nova chave
            </Button>
          </>
        }
      >
        <InlineAlert tone="warning">
          A chave antiga deixará de funcionar. Guarde a nova chave assim que ela aparecer.
        </InlineAlert>
        {recoveryError ? <InlineAlert tone="danger">{recoveryError}</InlineAlert> : null}
        <Field label="Confirme sua senha">
          <PasswordInput
            value={recoveryPassword}
            onChange={(event) => setRecoveryPassword(event.target.value)}
            autoComplete="current-password"
            autoFocus
            data-autofocus
            placeholder="Sua senha atual"
          />
        </Field>
      </Modal>

      <Modal
        open={resetOpen}
        onClose={() => setResetOpen(false)}
        size="sm"
        eyebrow="Zona de risco"
        title="Apagar todos os dados"
        subtitle="Esta ação não pode ser desfeita."
        onSubmit={resetData}
        dismissible={!resetBusy}
        footer={
          <>
            <Button variant="ghost" onClick={() => setResetOpen(false)} disabled={resetBusy}>
              Cancelar
            </Button>
            <Button
              type="submit"
              variant="danger"
              loading={resetBusy}
              disabled={!resetPassword || resetConfirmation !== 'APAGAR'}
              icon={<Trash2 size={15} />}
            >
              Apagar tudo
            </Button>
          </>
        }
      >
        <InlineAlert tone="danger" title="Sem volta">
          Todos os produtos, tipos e movimentações serão apagados. Sua conta e senha continuam
          valendo. O arquivo de backup não é criado automaticamente.
        </InlineAlert>
        {resetError ? <InlineAlert tone="danger">{resetError}</InlineAlert> : null}
        <Field label="Senha atual">
          <PasswordInput
            value={resetPassword}
            onChange={(event) => setResetPassword(event.target.value)}
            autoComplete="current-password"
            placeholder="Confirme com sua senha"
          />
        </Field>
        <Field label="Digite APAGAR para confirmar" hint="Tudo em maiúsculas, sem espaços.">
          <Input
            value={resetConfirmation}
            onChange={(event) => setResetConfirmation(event.target.value.toUpperCase())}
            placeholder="APAGAR"
            autoComplete="off"
            className="input-mono"
          />
        </Field>
      </Modal>

      {newRecoveryKey ? (
        <RecoveryKeyModal recoveryKey={newRecoveryKey} onDone={() => setNewRecoveryKey(null)} />
      ) : null}
    </div>
  );
}
