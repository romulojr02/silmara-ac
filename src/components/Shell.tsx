import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeftRight,
  ChartNoAxesCombined,
  ChevronDown,
  LayoutDashboard,
  LogOut,
  Settings2,
  Table2,
  Tags,
} from 'lucide-react';
import { useApp, type TabId } from '../app-context';
import { cx, firstName } from '../format';
import { Avatar, Logo } from './Ui';

export const TABS: {
  id: TabId;
  label: string;
  mobileLabel: string;
  icon: typeof LayoutDashboard;
}[] = [
  { id: 'painel', label: 'Painel', mobileLabel: 'Painel', icon: LayoutDashboard },
  { id: 'produtos', label: 'Produtos', mobileLabel: 'Produtos', icon: Table2 },
  { id: 'movimentacoes', label: 'Movimentações', mobileLabel: 'Saídas', icon: ArrowLeftRight },
  { id: 'metricas', label: 'Métricas', mobileLabel: 'Métricas', icon: ChartNoAxesCombined },
  { id: 'tipos', label: 'Tipos', mobileLabel: 'Tipos', icon: Tags },
  { id: 'ajustes', label: 'Ajustes', mobileLabel: 'Ajustes', icon: Settings2 },
];

export function Shell({
  active,
  children,
}: {
  active: TabId;
  children: ReactNode;
}) {
  const { admin, navigate, logout } = useApp();
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    const onPointerDown = (event: MouseEvent | TouchEvent) => {
      if (!menuRef.current?.contains(event.target as Node)) setMenuOpen(false);
    };
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false);
    };
    document.addEventListener('mousedown', onPointerDown);
    document.addEventListener('touchstart', onPointerDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointerDown);
      document.removeEventListener('touchstart', onPointerDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [menuOpen]);

  return (
    <div className="app-shell">
      <header className="app-header">
        <div className="app-header-inner">
          <button
            type="button"
            className="brand-button"
            onClick={() => navigate('painel')}
            aria-label="Ir para o painel"
          >
            <Logo />
          </button>

          <nav className="main-nav" aria-label="Navegação principal">
            {TABS.map((tab) => {
              const Icon = tab.icon;
              return (
                <button
                  key={tab.id}
                  type="button"
                  className={cx('nav-tab', active === tab.id && 'is-active')}
                  onClick={() => navigate(tab.id)}
                  aria-current={active === tab.id ? 'page' : undefined}
                >
                  <Icon size={16} strokeWidth={2} />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="user-area" ref={menuRef}>
            <button
              type="button"
              className={cx('user-trigger', menuOpen && 'is-open')}
              onClick={() => setMenuOpen((open) => !open)}
              aria-haspopup="menu"
              aria-expanded={menuOpen}
              aria-label="Menu da administradora"
            >
              <Avatar name={admin.name} size={34} />
              <span className="user-trigger-text">
                <strong>{firstName(admin.name)}</strong>
                <small>Administradora</small>
              </span>
              <ChevronDown size={14} className="user-chevron" />
            </button>
            {menuOpen ? (
              <div className="user-menu" role="menu">
                <div className="user-menu-head">
                  <Avatar name={admin.name} size={38} />
                  <div>
                    <strong>{admin.name}</strong>
                    <span>Acesso exclusivo</span>
                  </div>
                </div>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item"
                  onClick={() => {
                    setMenuOpen(false);
                    navigate('ajustes');
                  }}
                >
                  <Settings2 size={16} /> Ajustes da conta
                </button>
                <button
                  type="button"
                  role="menuitem"
                  className="menu-item menu-item-danger"
                  onClick={() => {
                    setMenuOpen(false);
                    logout();
                  }}
                >
                  <LogOut size={16} /> Sair com segurança
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>

      <main className="app-main" id="conteudo">
        {children}
      </main>

      <nav className="bottom-nav" aria-label="Navegação principal">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          return (
            <button
              key={tab.id}
              type="button"
              className={cx('bottom-nav-item', active === tab.id && 'is-active')}
              onClick={() => navigate(tab.id)}
              aria-current={active === tab.id ? 'page' : undefined}
            >
              <span className="bottom-nav-icon">
                <Icon size={19} strokeWidth={active === tab.id ? 2.2 : 1.9} />
              </span>
              <span>{tab.mobileLabel}</span>
            </button>
          );
        })}
      </nav>
    </div>
  );
}
