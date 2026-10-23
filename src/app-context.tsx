import { createContext, useContext } from 'react';
import type { Admin, Kind, Product } from './types';

export type TabId = 'painel' | 'produtos' | 'movimentacoes' | 'metricas' | 'tipos' | 'ajustes';

export interface AppContextValue {
  admin: Admin;
  revision: number;
  notifyChange: () => void;
  navigate: (tab: TabId) => void;
  openMovement: (kind: Kind, product?: Product) => void;
  updateAdmin: (admin: Admin) => void;
  logout: () => void;
}

export const AppContext = createContext<AppContextValue | null>(null);

export function useApp(): AppContextValue {
  const context = useContext(AppContext);
  if (!context) throw new Error('useApp precisa estar dentro do AppContext');
  return context;
}
