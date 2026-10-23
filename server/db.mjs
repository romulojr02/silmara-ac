import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import path from 'node:path';

const dataDir = process.env.SILMARA_DATA_DIR || path.join(process.cwd(), 'data');
mkdirSync(dataDir, { recursive: true });

export const db = new DatabaseSync(path.join(dataDir, 'silmara.db'));

db.exec(`
  PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  PRAGMA busy_timeout = 5000;
`);

db.exec(`
  CREATE TABLE IF NOT EXISTS meta (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS admin (
    id INTEGER PRIMARY KEY CHECK (id = 1),
    name TEXT NOT NULL,
    password_hash TEXT NOT NULL,
    recovery_hash TEXT,
    created_at TEXT NOT NULL,
    password_changed_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS sessions (
    id TEXT PRIMARY KEY,
    token_hash TEXT NOT NULL UNIQUE,
    created_at TEXT NOT NULL,
    expires_at TEXT NOT NULL,
    last_seen TEXT NOT NULL,
    user_agent TEXT,
    ip_hash TEXT
  );

  CREATE TABLE IF NOT EXISTS auth_throttle (
    key TEXT PRIMARY KEY,
    failures INTEGER NOT NULL DEFAULT 0,
    locked_until TEXT,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS types (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL UNIQUE COLLATE NOCASE,
    color TEXT NOT NULL,
    created_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS products (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    sku TEXT NOT NULL UNIQUE,
    type_id INTEGER NOT NULL REFERENCES types(id) ON DELETE RESTRICT,
    unit TEXT NOT NULL DEFAULT 'un',
    price REAL NOT NULL DEFAULT 0,
    initial_stock REAL NOT NULL DEFAULT 0,
    min_stock REAL NOT NULL DEFAULT 0,
    expires_on TEXT,
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL,
    updated_at TEXT NOT NULL
  );

  CREATE TABLE IF NOT EXISTS movements (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    product_id INTEGER NOT NULL REFERENCES products(id) ON DELETE CASCADE,
    kind TEXT NOT NULL CHECK (kind IN ('entrada', 'saida')),
    quantity REAL NOT NULL CHECK (quantity > 0),
    unit_price REAL NOT NULL DEFAULT 0,
    date TEXT NOT NULL,
    time TEXT NOT NULL,
    party TEXT NOT NULL DEFAULT '',
    notes TEXT NOT NULL DEFAULT '',
    created_at TEXT NOT NULL
  );

  CREATE INDEX IF NOT EXISTS idx_movements_date ON movements(date);
  CREATE INDEX IF NOT EXISTS idx_movements_product ON movements(product_id);
  CREATE INDEX IF NOT EXISTS idx_movements_kind_date ON movements(kind, date);
  CREATE INDEX IF NOT EXISTS idx_sessions_token ON sessions(token_hash);
`);

export function nowIso() {
  return new Date().toISOString();
}

export function todayStr(d = new Date()) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function addDays(dateStr, amount) {
  const [y, m, d] = dateStr.split('-').map(Number);
  const dt = new Date(y, m - 1, d + amount);
  return todayStr(dt);
}

export function getMeta(key) {
  const row = db.prepare('SELECT value FROM meta WHERE key = ?').get(key);
  return row ? row.value : null;
}

export function setMeta(key, value) {
  db.prepare(
    'INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
  ).run(key, String(value));
}

export function deleteMeta(key) {
  db.prepare('DELETE FROM meta WHERE key = ?').run(key);
}

export function transaction(fn) {
  db.exec('BEGIN IMMEDIATE');
  try {
    const result = fn();
    db.exec('COMMIT');
    return result;
  } catch (error) {
    db.exec('ROLLBACK');
    throw error;
  }
}

export function isConfigured() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM admin').get();
  return Number(row.n) > 0;
}

export function getAdmin() {
  return db.prepare('SELECT * FROM admin WHERE id = 1').get() ?? null;
}

export const DEFAULT_TYPES = [
  { name: 'Alimentos', color: '#b23b63' },
  { name: 'Bebidas', color: '#8f6aa8' },
  { name: 'Limpeza', color: '#c97b8e' },
  { name: 'Higiene', color: '#7d8fb3' },
  { name: 'Congelados', color: '#6f9c8c' },
];

export function ensureDefaultTypes() {
  const count = db.prepare('SELECT COUNT(*) AS n FROM types').get();
  if (Number(count.n) > 0) return;
  const insert = db.prepare('INSERT INTO types (name, color, created_at) VALUES (?, ?, ?)');
  const stamp = nowIso();
  for (const type of DEFAULT_TYPES) insert.run(type.name, type.color, stamp);
}

const productSelect = `
  SELECT
    p.id, p.name, p.sku, p.type_id, p.unit, p.price, p.initial_stock,
    p.min_stock, p.expires_on, p.notes, p.created_at, p.updated_at,
    t.name AS type_name, t.color AS type_color,
    p.initial_stock + COALESCE((
      SELECT SUM(CASE WHEN m.kind = 'entrada' THEN m.quantity ELSE -m.quantity END)
      FROM movements m WHERE m.product_id = p.id
    ), 0) AS stock
  FROM products p
  JOIN types t ON t.id = p.type_id
`;

function mapProduct(row) {
  return {
    id: Number(row.id),
    name: row.name,
    sku: row.sku,
    typeId: Number(row.type_id),
    typeName: row.type_name,
    typeColor: row.type_color,
    unit: row.unit,
    price: Number(row.price),
    initialStock: Number(row.initial_stock),
    minStock: Number(row.min_stock),
    expiresOn: row.expires_on ?? null,
    notes: row.notes,
    stock: Number(row.stock),
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export function listProducts() {
  return db
    .prepare(`${productSelect} ORDER BY p.name COLLATE NOCASE ASC, p.id ASC`)
    .all()
    .map(mapProduct);
}

export function getProductRow(id) {
  const row = db.prepare(`${productSelect} WHERE p.id = ?`).get(id);
  return row ? mapProduct(row) : null;
}

export function getProductStock(id) {
  const row = db.prepare(`${productSelect} WHERE p.id = ?`).get(id);
  return row ? Number(row.stock) : null;
}

export function listTypes() {
  return db
    .prepare(
      `
      WITH ps AS (
        SELECT p.id, p.type_id, p.price,
          p.initial_stock + COALESCE((
            SELECT SUM(CASE WHEN m.kind = 'entrada' THEN m.quantity ELSE -m.quantity END)
            FROM movements m WHERE m.product_id = p.id
          ), 0) AS stock
        FROM products p
      )
      SELECT t.id, t.name, t.color, t.created_at,
        COUNT(ps.id) AS product_count,
        COALESCE(SUM(ps.stock), 0) AS stock_total,
        COALESCE(SUM(ps.stock * ps.price), 0) AS stock_value
      FROM types t
      LEFT JOIN ps ON ps.type_id = t.id
      GROUP BY t.id
      ORDER BY t.name COLLATE NOCASE ASC
    `,
    )
    .all()
    .map((row) => ({
      id: Number(row.id),
      name: row.name,
      color: row.color,
      productCount: Number(row.product_count),
      stockTotal: Number(row.stock_total),
      stockValue: Number(row.stock_value),
      createdAt: row.created_at,
    }));
}

function mapMovement(row) {
  return {
    id: Number(row.id),
    productId: Number(row.product_id),
    productName: row.product_name,
    productSku: row.product_sku,
    unit: row.unit,
    typeName: row.type_name ?? null,
    typeColor: row.type_color ?? null,
    kind: row.kind,
    quantity: Number(row.quantity),
    unitPrice: Number(row.unit_price),
    date: row.date,
    time: row.time,
    party: row.party,
    notes: row.notes,
    createdAt: row.created_at,
  };
}

const movementSelect = `
  SELECT m.*, p.name AS product_name, p.sku AS product_sku, p.unit AS unit,
    t.name AS type_name, t.color AS type_color
  FROM movements m
  JOIN products p ON p.id = m.product_id
  JOIN types t ON t.id = p.type_id
`;

export function getMovementById(id) {
  const row = db.prepare(`${movementSelect} WHERE m.id = ?`).get(id);
  return row ? mapMovement(row) : null;
}

export function listMovements({ days = 0, limit = 500 } = {}) {
  const params = [];
  let where = '';
  if (days > 0) {
    where = 'WHERE m.date >= ?';
    params.push(addDays(todayStr(), -(days - 1)));
  }
  params.push(Math.min(Math.max(Number(limit) || 500, 1), 2000));
  return db
    .prepare(`${movementSelect} ${where} ORDER BY m.date DESC, m.time DESC, m.id DESC LIMIT ?`)
    .all(...params)
    .map(mapMovement);
}

function periodTotals(from, to) {
  const row = db
    .prepare(
      `
      SELECT
        COALESCE(SUM(CASE WHEN kind = 'saida' THEN quantity ELSE 0 END), 0) AS saida_qty,
        COALESCE(SUM(CASE WHEN kind = 'saida' THEN quantity * unit_price ELSE 0 END), 0) AS saida_value,
        COALESCE(SUM(CASE WHEN kind = 'entrada' THEN quantity ELSE 0 END), 0) AS entrada_qty,
        COALESCE(SUM(CASE WHEN kind = 'entrada' THEN quantity * unit_price ELSE 0 END), 0) AS entrada_value,
        COUNT(*) AS movements
      FROM movements
      WHERE date BETWEEN ? AND ?
    `,
    )
    .get(from, to);
  return {
    saidaQty: Number(row.saida_qty),
    saidaValue: Number(row.saida_value),
    entradaQty: Number(row.entrada_qty),
    entradaValue: Number(row.entrada_value),
    movements: Number(row.movements),
  };
}

export function getAnalytics(days = 30) {
  const safeDays = [7, 30, 90, 365].includes(Number(days)) ? Number(days) : 30;
  const today = todayStr();
  const from = addDays(today, -(safeDays - 1));
  const prevTo = addDays(from, -1);
  const prevFrom = addDays(prevTo, -(safeDays - 1));

  const products = listProducts();
  const totals = periodTotals(from, today);
  const previous = periodTotals(prevFrom, prevTo);
  const todayTotals = periodTotals(today, today);

  const stockQty = products.reduce((sum, p) => sum + Math.max(p.stock, 0), 0);
  const stockValue = products.reduce((sum, p) => sum + Math.max(p.stock, 0) * p.price, 0);
  const inventoryValue = products.reduce((sum, p) => sum + p.initialStock * p.price, 0);

  const lowStock = products
    .filter((p) => p.stock <= p.minStock)
    .sort((a, b) => a.stock - b.stock)
    .map((p) => ({ ...p }));
  const expiring = products
    .filter(
      (p) => p.expiresOn && p.stock > 0 && p.expiresOn >= today && p.expiresOn <= addDays(today, 30),
    )
    .sort((a, b) => String(a.expiresOn).localeCompare(String(b.expiresOn)))
    .map((p) => ({ ...p }));
  const outOfStock = products.filter((p) => p.stock <= 0);
  const expired = products
    .filter((p) => p.expiresOn && p.stock > 0 && p.expiresOn < today)
    .sort((a, b) => String(a.expiresOn).localeCompare(String(b.expiresOn)))
    .map((p) => ({ ...p }));

  const dailyMap = new Map();
  const dailyRows = db
    .prepare(
      `
      SELECT date,
        COALESCE(SUM(CASE WHEN kind = 'saida' THEN quantity ELSE 0 END), 0) AS saida_qty,
        COALESCE(SUM(CASE WHEN kind = 'saida' THEN quantity * unit_price ELSE 0 END), 0) AS saida_value,
        COALESCE(SUM(CASE WHEN kind = 'entrada' THEN quantity ELSE 0 END), 0) AS entrada_qty,
        COALESCE(SUM(CASE WHEN kind = 'entrada' THEN quantity * unit_price ELSE 0 END), 0) AS entrada_value,
        COUNT(*) AS movements
      FROM movements
      WHERE date BETWEEN ? AND ?
      GROUP BY date
    `,
    )
    .all(from, today);
  for (const row of dailyRows) {
    dailyMap.set(row.date, row);
  }
  const daily = [];
  for (let cursor = from; ; cursor = addDays(cursor, 1)) {
    const row = dailyMap.get(cursor);
    daily.push({
      date: cursor,
      saidaQty: Number(row?.saida_qty ?? 0),
      saidaValue: Number(row?.saida_value ?? 0),
      entradaQty: Number(row?.entrada_qty ?? 0),
      entradaValue: Number(row?.entrada_value ?? 0),
      movements: Number(row?.movements ?? 0),
    });
    if (cursor === today) break;
  }

  const byType = db
    .prepare(
      `
      SELECT t.id, t.name, t.color,
        COALESCE(SUM(m.quantity), 0) AS qty,
        COALESCE(SUM(m.quantity * m.unit_price), 0) AS value,
        COUNT(m.id) AS n
      FROM movements m
      JOIN products p ON p.id = m.product_id
      JOIN types t ON t.id = p.type_id
      WHERE m.kind = 'saida' AND m.date BETWEEN ? AND ?
      GROUP BY t.id
      ORDER BY qty DESC
    `,
    )
    .all(from, today)
    .map((row) => ({
      id: Number(row.id),
      name: row.name,
      color: row.color,
      qty: Number(row.qty),
      value: Number(row.value),
      count: Number(row.n),
    }));

  const topProducts = db
    .prepare(
      `
      SELECT p.id, p.name, p.sku, p.unit, t.name AS type_name, t.color AS type_color,
        COALESCE(SUM(m.quantity), 0) AS qty,
        COALESCE(SUM(m.quantity * m.unit_price), 0) AS value
      FROM movements m
      JOIN products p ON p.id = m.product_id
      JOIN types t ON t.id = p.type_id
      WHERE m.kind = 'saida' AND m.date BETWEEN ? AND ?
      GROUP BY p.id
      ORDER BY qty DESC, value DESC
      LIMIT 6
    `,
    )
    .all(from, today)
    .map((row) => ({
      id: Number(row.id),
      name: row.name,
      sku: row.sku,
      unit: row.unit,
      typeName: row.type_name,
      typeColor: row.type_color,
      qty: Number(row.qty),
      value: Number(row.value),
    }));

  const topParties = db
    .prepare(
      `
      SELECT party, COALESCE(SUM(quantity), 0) AS qty, COUNT(*) AS n
      FROM movements
      WHERE kind = 'saida' AND date BETWEEN ? AND ? AND TRIM(party) <> ''
      GROUP BY LOWER(TRIM(party))
      ORDER BY qty DESC
      LIMIT 4
    `,
    )
    .all(from, today)
    .map((row) => ({ party: row.party, qty: Number(row.qty), count: Number(row.n) }));

  const heatRows = db
    .prepare(
      `
      SELECT
        CAST(strftime('%w', date) AS INTEGER) AS weekday,
        CAST(substr(time, 1, 2) AS INTEGER) AS hour,
        COALESCE(SUM(quantity), 0) AS qty,
        COUNT(*) AS n
      FROM movements
      WHERE kind = 'saida' AND date BETWEEN ? AND ?
      GROUP BY weekday, hour
    `,
    )
    .all(from, today);

  const heatmap = [];
  for (let weekday = 0; weekday < 7; weekday += 1) {
    for (let bucket = 0; bucket < 4; bucket += 1) {
      heatmap.push({ weekday, bucket, qty: 0, count: 0 });
    }
  }
  const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
  const bucketTotals = [0, 0, 0, 0];
  for (const row of heatRows) {
    const weekday = Number(row.weekday);
    const bucket = Math.min(3, Math.floor(Number(row.hour) / 6));
    const cell = heatmap[weekday * 4 + bucket];
    cell.qty += Number(row.qty);
    cell.count += Number(row.n);
    weekdayTotals[weekday] += Number(row.qty);
    bucketTotals[bucket] += Number(row.qty);
  }

  const idleRows = db
    .prepare(
      `
      ${productSelect}
      WHERE NOT EXISTS (
        SELECT 1 FROM movements m
        WHERE m.product_id = p.id AND m.kind = 'saida' AND m.date BETWEEN ? AND ?
      )
      ORDER BY (p.initial_stock * p.price) DESC
      LIMIT 12
    `,
    )
    .all(from, today)
    .map(mapProduct);

  const lastSales = db
    .prepare(
      `
      SELECT product_id, MAX(date) AS last_date, MAX(time) AS last_time
      FROM movements WHERE kind = 'saida'
      GROUP BY product_id
    `,
    )
    .all();
  const lastSaleMap = new Map(
    lastSales.map((row) => [Number(row.product_id), `${row.last_date} ${row.last_time}`]),
  );

  const byTypeStockMap = new Map();
  for (const p of products) {
    const current = byTypeStockMap.get(p.typeId) ?? {
      id: p.typeId,
      name: p.typeName,
      color: p.typeColor,
      qty: 0,
      value: 0,
      products: 0,
    };
    current.qty += Math.max(p.stock, 0);
    current.value += Math.max(p.stock, 0) * p.price;
    current.products += 1;
    byTypeStockMap.set(p.typeId, current);
  }

  const recent = db
    .prepare(`${movementSelect} ORDER BY m.date DESC, m.time DESC, m.id DESC LIMIT 8`)
    .all()
    .map(mapMovement);

  const uniqueAttention = new Set([...lowStock, ...expiring, ...expired].map((p) => p.id));

  return {
    period: {
      days: safeDays,
      from,
      to: today,
      prevFrom,
      prevTo,
    },
    totals: {
      ...totals,
      previous,
      todaySaidaQty: todayTotals.saidaQty,
      todaySaidaValue: todayTotals.saidaValue,
      todayMovements: todayTotals.movements,
    },
    stock: {
      productCount: products.length,
      stockQty,
      stockValue,
      initialValue: inventoryValue,
      lowStockCount: lowStock.length,
      expiringCount: expiring.length,
      outOfStockCount: outOfStock.length,
      expiredCount: expired.length,
      attentionCount: uniqueAttention.size,
    },
    attention: {
      lowStock: lowStock.slice(0, 8),
      expiring: expiring.slice(0, 8),
      expired: expired.slice(0, 8),
    },
    daily,
    byType,
    topProducts,
    topParties,
    heatmap,
    weekdayTotals,
    bucketTotals,
    idleProducts: idleRows.map((p) => ({
      ...p,
      lastSale: lastSaleMap.get(p.id) ?? null,
    })),
    byTypeStock: Array.from(byTypeStockMap.values()).sort((a, b) => b.value - a.value),
    recent,
  };
}

export function generateSku(name, existingSkus = new Set()) {
  const cleaned = String(name)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, '')
    .slice(0, 3);
  const prefix = cleaned.length >= 2 ? cleaned.padEnd(3, 'X') : 'PRD';
  for (let attempt = 0; attempt < 40; attempt += 1) {
    const digits = String(Math.floor(1000 + Math.random() * 9000));
    const sku = `${prefix}-${digits}`;
    if (!existingSkus.has(sku)) return sku;
  }
  return `PRD-${Date.now().toString().slice(-7)}`;
}

export function allSkus() {
  return new Set(db.prepare('SELECT sku FROM products').all().map((row) => row.sku));
}

export function resetData() {
  transaction(() => {
    db.exec('DELETE FROM movements; DELETE FROM products; DELETE FROM types;');
    db.prepare("DELETE FROM meta WHERE key LIKE 'demo%'").run();
    try {
      db.exec(
        "DELETE FROM sqlite_sequence WHERE name IN ('movements', 'products', 'types');",
      );
    } catch {
      // sqlite_sequence may not exist on a fresh database.
    }
  });
}

export function exportAll() {
  const movements = db
    .prepare(`${movementSelect} ORDER BY m.date ASC, m.time ASC, m.id ASC`)
    .all()
    .map(mapMovement);
  const admin = getAdmin();
  return {
    app: 'Controles da Silmara',
    version: 1,
    exportedAt: nowIso(),
    admin: admin ? { name: admin.name, createdAt: admin.created_at } : null,
    types: listTypes(),
    products: listProducts(),
    movements,
  };
}
