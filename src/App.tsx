import { useCallback, useEffect, useMemo, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import { api } from './api';
import type { Admin, AuthStatus, Kind, Product } from './types';
import { AppContext, type TabId } from './app-context';
import { AuthScreen } from './auth/AuthScreen';
import { Shell } from './components/Shell';
import { MovementModal } from './components/MovementModal';
import { RecoveryKeyModal } from './components/RecoveryKeyModal';
import { Button, Logo, Spinner, useToast } from './components/Ui';
import { Dashboard } from './pages/Dashboard';
import { Products } from './pages/Products';
import { Movements } from './pages/Movements';
import { Analytics } from './pages/Analytics';
import { Types } from './pages/Types';
import { Settings } from './pages/Settings';

const TAB_IDS: TabId[] = ['painel', 'produtos', 'movimentacoes', 'metricas', 'tipos', 'ajustes'];

function readTab(): TabId {
  const value = window.location.hash.replace(/^#\/?/, '') as TabId;
  return TAB_IDS.includes(value) ? value : 'painel';
}

interface MovementRequest {
  kind: Kind;
  product?: Product;
}

export function App() {
  const { toast } = useToast();
  const [status, setStatus] = useState<AuthStatus | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);
  const [admin, setAdmin] = useState<Admin | null>(null);
  const [recoveryKey, setRecoveryKey] = useState<string | null>(null);
  const [tab, setTab] = useState<TabId>(() => readTab());
  const [revision, setRevision] = useState(0);
  const [movement, setMovement] = useState<MovementRequest | null>(null);

  const bootstrap = useCallback(async () => {
    setBootError(null);
    setStatus(null);
    try {
      const result = await api.get<AuthStatus>('/api/auth/status');
      setStatus(result);
      setAdmin(result.authenticated ? result.admin : null);
    } catch (err) {
      setBootError(
        err instanceof Error ? err.message : 'Não foi possível falar com o servidor dos Controles da Silmara.',
      );
    }
  }, []);

  useEffect(() => {
    bootstrap();
  }, [bootstrap]);

  useEffect(() => {
    const onHash = () => {
      setTab(readTab());
      window.scrollTo(0, 0);
    };
    window.addEventListener('hashchange', onHash);
    if (!window.location.hash) window.history.replaceState(null, '', '#/painel');
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    const onUnauthorized = () => {
      setAdmin(null);
      setMovement(null);
      setRecoveryKey(null);
      setStatus((current) =>
        current ? { ...current, authenticated: false, admin: null, session: null } : current,
      );
      toast('Sua sessão expirou. Entre novamente para continuar.', 'info');
    };
    window.addEventListener('silmara:unauthorized', onUnauthorized);
    return () => window.removeEventListener('silmara:unauthorized', onUnauthorized);
  }, [toast]);

  const navigate = useCallback((next: TabId) => {
    if (readTab() === next) {
      setTab(next);
      window.scrollTo(0, 0);
      return;
    }
    window.location.hash = `/${next}`;
  }, []);

  const notifyChange = useCallback(() => setRevision((value) => value + 1), []);

  const openMovement = useCallback((kind: Kind, product?: Product) => {
    setMovement({ kind, product });
  }, []);

  const updateAdmin = useCallback((next: Admin) => {
    setAdmin(next);
    setStatus((current) => (current ? { ...current, admin: next } : current));
  }, []);

  const logout = useCallback(async () => {
    try {
      await api.post('/api/auth/logout');
    } catch {
      // A sessão local é encerrada mesmo se o servidor não responder.
    }
    setAdmin(null);
    setMovement(null);
    setRecoveryKey(null);
    setStatus((current) =>
      current ? { ...current, authenticated: false, admin: null, session: null } : current,
    );
    navigate('painel');
  }, [navigate]);

  const contextValue = useMemo(
    () => ({
      admin: admin as Admin,
      revision,
      notifyChange,
      navigate,
      openMovement,
      updateAdmin,
      logout,
    }),
    [admin, revision, notifyChange, navigate, openMovement, updateAdmin, logout],
  );

  if (!status && !bootError) {
    return (
      <div className="boot-screen">
        <div className="boot-inner">
          <Logo />
          <Spinner size={20} />
          <p>Organizando seus controles…</p>
        </div>
      </div>
    );
  }

  if (bootError) {
    return (
      <div className="boot-screen">
        <div className="boot-inner">
          <Logo />
          <h1>O servidor não respondeu.</h1>
          <p>{bootError}</p>
          <Button icon={<RefreshCw size={16} />} onClick={bootstrap}>
            Tentar novamente
          </Button>
        </div>
      </div>
    );
  }

  if (!status || !admin) {
    return (
      <AuthScreen
        configured={Boolean(status?.configured)}
        onAuthenticated={(nextAdmin, key) => {
          setAdmin(nextAdmin);
          setStatus((current) =>
            current
              ? {
                  ...current,
                  configured: true,
                  authenticated: true,
                  admin: nextAdmin,
                  session: null,
                }
              : {
                  configured: true,
                  authenticated: true,
                  admin: nextAdmin,
                  session: null,
                  demo: false,
                },
          );
          if (key) setRecoveryKey(key);
          navigate('painel');
          setRevision((value) => value + 1);
        }}
      />
    );
  }

  return (
    <AppContext.Provider value={contextValue}>
      <Shell active={tab}>
        {tab === 'painel' ? <Dashboard /> : null}
        {tab === 'produtos' ? <Products /> : null}
        {tab === 'movimentacoes' ? <Movements /> : null}
        {tab === 'metricas' ? <Analytics /> : null}
        {tab === 'tipos' ? <Types /> : null}
        {tab === 'ajustes' ? <Settings /> : null}
      </Shell>

      {movement ? (
        <MovementModal
          key={`${movement.kind}-${movement.product?.id ?? 'novo'}`}
          initialKind={movement.kind}
          initialProduct={movement.product}
          onClose={() => setMovement(null)}
        />
      ) : null}

      {recoveryKey ? (
        <RecoveryKeyModal
          recoveryKey={recoveryKey}
          onDone={() => setRecoveryKey(null)}
        />
      ) : null}
    </AppContext.Provider>
  );
}
