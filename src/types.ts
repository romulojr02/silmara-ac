export type Kind = 'entrada' | 'saida';

export type Tone = 'neutral' | 'success' | 'warning' | 'danger' | 'brand';

export interface Admin {
  name: string;
  createdAt: string;
  passwordChangedAt: string;
  recoveryConfigured: boolean;
}

export interface AuthSession {
  expiresAt: string;
  activeSessions: number;
}

export interface AuthStatus {
  configured: boolean;
  authenticated: boolean;
  admin: Admin | null;
  session: AuthSession | null;
  demo: boolean;
}

export interface ProductType {
  id: number;
  name: string;
  color: string;
  productCount: number;
  stockTotal: number;
  stockValue: number;
  createdAt: string;
}

export interface Product {
  id: number;
  name: string;
  sku: string;
  typeId: number;
  typeName: string;
  typeColor: string;
  unit: string;
  price: number;
  initialStock: number;
  minStock: number;
  expiresOn: string | null;
  notes: string;
  stock: number;
  createdAt: string;
  updatedAt: string;
}

export interface Movement {
  id: number;
  productId: number;
  productName: string;
  productSku: string;
  unit: string;
  typeName: string | null;
  typeColor: string | null;
  kind: Kind;
  quantity: number;
  unitPrice: number;
  date: string;
  time: string;
  party: string;
  notes: string;
  createdAt: string;
}

export interface DailyPoint {
  date: string;
  saidaQty: number;
  saidaValue: number;
  entradaQty: number;
  entradaValue: number;
  movements: number;
}

export interface PeriodTotals {
  saidaQty: number;
  saidaValue: number;
  entradaQty: number;
  entradaValue: number;
  movements: number;
}

export interface Analytics {
  period: { days: number; from: string; to: string; prevFrom: string; prevTo: string };
  totals: PeriodTotals & {
    previous: PeriodTotals;
    todaySaidaQty: number;
    todaySaidaValue: number;
    todayMovements: number;
  };
  stock: {
    productCount: number;
    stockQty: number;
    stockValue: number;
    initialValue: number;
    lowStockCount: number;
    expiringCount: number;
    outOfStockCount: number;
    expiredCount: number;
    attentionCount: number;
  };
  attention: {
    lowStock: Product[];
    expiring: Product[];
    expired: Product[];
  };
  daily: DailyPoint[];
  byType: { id: number; name: string; color: string; qty: number; value: number; count: number }[];
  topProducts: {
    id: number;
    name: string;
    sku: string;
    unit: string;
    typeName: string;
    typeColor: string;
    qty: number;
    value: number;
  }[];
  topParties: { party: string; qty: number; count: number }[];
  heatmap: { weekday: number; bucket: number; qty: number; count: number }[];
  weekdayTotals: number[];
  bucketTotals: number[];
  idleProducts: (Product & { lastSale: string | null })[];
  byTypeStock: { id: number; name: string; color: string; qty: number; value: number; products: number }[];
  recent: Movement[];
}

export type ProductStatusKey = 'ok' | 'low' | 'out' | 'expiring' | 'expired';

export interface ProductStatus {
  key: ProductStatusKey;
  label: string;
  tone: Tone;
}
