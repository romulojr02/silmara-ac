import express from 'express';
import path from 'node:path';
import { existsSync } from 'node:fs';
import { fileURLToPath, pathToFileURL } from 'node:url';

import {
  pool,
  one,
  initDb,
  isConfigured,
  getAdmin,
  nowIso,
  todayStr,
  listProducts,
  getProductRow,
  getProductStock,
  listTypes,
  listMovements,
  getMovementById,
  getAnalytics,
  generateSku,
  allSkus,
  resetData,
  exportAll,
  getMeta,
  ensureDefaultTypes,
  transaction,
} from './db.mjs';
import {
  hashPassword,
  verifyPassword,
  passwordIssue,
  generateRecoveryKey,
  hashRecoveryKey,
  safeCompareHex,
  createSession,
  destroyCurrentSession,
  revokeOtherSessions,
  countSessions,
  requireAuth,
  resolveSession,
  throttleMessage,
  registerFailure,
  clearFailures,
  clientKey,
  sleep,
} from './auth.mjs';
import { loadDemo } from './demo.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');
const DIST = path.join(ROOT, 'dist');

const app = express();
app.disable('x-powered-by');
if (process.env.TRUST_PROXY === '1' || process.env.VERCEL) app.set('trust proxy', 1);

class HttpError extends Error {
  constructor(status, message, extra = {}) {
    super(message);
    this.status = status;
    this.extra = extra;
  }
}

const wrap = (fn) => (req, res, next) => Promise.resolve(fn(req, res, next)).catch(next);

app.use((req, res, next) => {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'no-referrer');
  res.setHeader(
    'Permissions-Policy',
    'camera=(), microphone=(), geolocation=(), payment=(), usb=()',
  );
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; base-uri 'none'; form-action 'self'",
  );
  if (req.secure) {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
});

app.use(express.json({ limit: '64kb' }));

app.use('/api', (req, res, next) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!['GET', 'HEAD', 'OPTIONS'].includes(req.method)) {
    if (req.get('x-requested-with') !== 'silmara-web') {
      return res.status(403).json({ error: 'Requisição não autorizada.' });
    }
    const contentType = String(req.get('content-type') ?? '').toLowerCase();
    if (!contentType.includes('application/json')) {
      return res.status(415).json({ error: 'Os dados devem ser enviados em JSON.' });
    }
    const origin = req.get('origin');
    if (origin) {
      const host = req.get('host');
      const allowed = new Set([
        `http://${host}`,
        `https://${host}`,
        'http://localhost:5173',
        'http://127.0.0.1:5173',
        'http://localhost:5174',
        'http://127.0.0.1:5174',
      ]);
      for (const extra of String(process.env.APP_ORIGIN ?? '').split(',')) {
        const trimmed = extra.trim();
        if (trimmed) allowed.add(trimmed);
      }
      if (!allowed.has(origin)) {
        return res.status(403).json({ error: 'Origem não autorizada.' });
      }
    }
  }
  next();
});

function text(value, max = 200, { required = false, label = 'Campo' } = {}) {
  const result = typeof value === 'string' ? value.trim() : '';
  if (required && result.length === 0) throw new HttpError(400, `${label} é obrigatório.`);
  if (result.length > max) throw new HttpError(400, `${label} deve ter no máximo ${max} caracteres.`);
  return result;
}

function decimal(value, { min = 0, max = 1_000_000, label = 'Valor' } = {}) {
  const parsed =
    typeof value === 'number'
      ? value
      : Number(String(value ?? '').replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(parsed)) throw new HttpError(400, `${label} inválido.`);
  if (parsed < min) throw new HttpError(400, `${label} deve ser maior ou igual a ${min}.`);
  if (parsed > max) throw new HttpError(400, `${label} é muito grande.`);
  return Math.round(parsed * 1000) / 1000;
}

function isValidDate(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const [y, m, d] = value.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  return date.getFullYear() === y && date.getMonth() === m - 1 && date.getDate() === d;
}

function dateField(value, { label = 'Data', required = false } = {}) {
  if (value === null || value === undefined || value === '') {
    if (required) throw new HttpError(400, `${label} é obrigatória.`);
    return null;
  }
  if (!isValidDate(value)) throw new HttpError(400, `${label} inválida.`);
  return value;
}

function timeField(value) {
  if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
    throw new HttpError(400, 'Horário inválido.');
  }
  return value;
}

const UNITS = ['un', 'kg', 'g', 'L', 'ml', 'cx', 'pct', 'fardo', 'dz'];
const HEX_COLOR = /^#[0-9a-fA-F]{6}$/;

function adminPayload(admin) {
  return {
    name: admin.name,
    createdAt: admin.createdAt ?? admin.created_at,
    passwordChangedAt: admin.passwordChangedAt ?? admin.password_changed_at,
    recoveryConfigured:
      admin.recoveryConfigured ?? Boolean(admin.recovery_hash ?? admin.recoveryHash),
  };
}

app.get(
  '/api/health',
  wrap(async (req, res) => {
    res.json({ ok: true, app: 'Controles da Silmara', configured: await isConfigured() });
  }),
);

app.get(
  '/api/auth/status',
  wrap(async (req, res) => {
    const [configured, resolved, demoMarker] = await Promise.all([
      isConfigured(),
      resolveSession(req, res),
      getMeta('demo'),
    ]);
    res.json({
      configured,
      authenticated: Boolean(resolved),
      admin: resolved ? adminPayload(resolved.admin) : null,
      session: resolved
        ? { expiresAt: resolved.sessionExpiresAt, activeSessions: await countSessions() }
        : null,
      demo: Boolean(demoMarker),
    });
  }),
);

app.post(
  '/api/auth/setup',
  wrap(async (req, res) => {
    if (await isConfigured()) {
      throw new HttpError(409, 'O acesso já foi configurado neste sistema.');
    }
    const name = text(req.body?.name, 50, { required: true, label: 'Nome' });
    if (name.length < 2) throw new HttpError(400, 'Informe seu nome.');
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    const issue = passwordIssue(password, name);
    if (issue) throw new HttpError(400, issue);

    const passwordHash = await hashPassword(password);
    const recoveryKey = generateRecoveryKey();
    const recoveryHash = hashRecoveryKey(recoveryKey);
    const stamp = nowIso();

    try {
      await pool.query(
        `
        INSERT INTO admin (id, name, password_hash, recovery_hash, created_at, password_changed_at)
        VALUES (1, $1, $2, $3, $4, $5)
      `,
        [name, passwordHash, recoveryHash, stamp, stamp],
      );
    } catch (error) {
      if (error?.code === '23505') {
        throw new HttpError(409, 'O acesso já foi configurado neste sistema.');
      }
      throw error;
    }

    const withDemo = Boolean(req.body?.withDemo);
    let demoLoaded = false;
    if (withDemo) {
      try {
        await loadDemo();
        demoLoaded = true;
      } catch (error) {
        console.error('Falha ao carregar dados de exemplo:', error);
      }
    }
    await ensureDefaultTypes();

    await createSession(req, res);
    res.status(201).json({
      authenticated: true,
      recoveryKey,
      demoLoaded,
      admin: adminPayload(await getAdmin()),
    });
  }),
);

app.post(
  '/api/auth/login',
  wrap(async (req, res) => {
    const key = clientKey(req, 'login');
    const locked = await throttleMessage(key);
    if (locked) {
      return res.status(429).json({ error: locked.message, retryAfter: locked.seconds });
    }

    await sleep(320 + Math.floor(Math.random() * 140));
    const admin = await getAdmin();
    if (!admin) {
      throw new HttpError(409, 'Sistema ainda não configurado.', { setupRequired: true });
    }

    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!password || password.length > 128) {
      const failure = await registerFailure(key);
      return res
        .status(failure.locked ? 429 : 401)
        .json({ error: failure.locked ? failure.message : 'Senha incorreta.' });
    }

    const valid = await verifyPassword(password, admin.password_hash);
    if (!valid) {
      const failure = await registerFailure(key);
      return res
        .status(failure.locked ? 429 : 401)
        .json({ error: failure.locked ? failure.message : 'Senha incorreta.' });
    }

    await clearFailures(key);
    const session = await createSession(req, res);
    res.json({
      authenticated: true,
      admin: adminPayload(await getAdmin()),
      sessionExpiresAt: session.expiresAt,
    });
  }),
);

app.post(
  '/api/auth/recover',
  wrap(async (req, res) => {
    const key = clientKey(req, 'recover');
    const locked = await throttleMessage(key);
    if (locked) return res.status(429).json({ error: locked.message, retryAfter: locked.seconds });

    await sleep(350);
    const admin = await getAdmin();
    if (!admin || !admin.recovery_hash) {
      throw new HttpError(400, 'Recuperação por chave não está disponível.');
    }

    const providedHash = hashRecoveryKey(req.body?.recoveryKey);
    if (!safeCompareHex(providedHash, admin.recovery_hash)) {
      const failure = await registerFailure(key);
      return res
        .status(failure.locked ? 429 : 401)
        .json({ error: failure.locked ? failure.message : 'Chave de recuperação inválida.' });
    }

    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    const issue = passwordIssue(newPassword, admin.name);
    if (issue) throw new HttpError(400, issue);

    const passwordHash = await hashPassword(newPassword);
    const recoveryKey = generateRecoveryKey();
    const recoveryHash = hashRecoveryKey(recoveryKey);
    const stamp = nowIso();

    await transaction(async (client) => {
      await client.query(
        'UPDATE admin SET password_hash = $1, recovery_hash = $2, password_changed_at = $3 WHERE id = 1',
        [passwordHash, recoveryHash, stamp],
      );
      await client.query('DELETE FROM sessions');
    });

    await clearFailures(key);
    await createSession(req, res);
    res.json({
      authenticated: true,
      recoveryKey,
      admin: adminPayload(await getAdmin()),
      message: 'Senha redefinida com sucesso.',
    });
  }),
);

app.post(
  '/api/auth/logout',
  wrap(async (req, res) => {
    await destroyCurrentSession(req, res);
    res.json({ ok: true });
  }),
);

app.get(
  '/api/auth/me',
  requireAuth,
  wrap(async (req, res) => {
    res.json({
      admin: adminPayload(req.admin),
      session: { expiresAt: req.sessionExpiresAt, activeSessions: await countSessions() },
    });
  }),
);

app.patch(
  '/api/auth/profile',
  requireAuth,
  wrap(async (req, res) => {
    const name = text(req.body?.name, 50, { required: true, label: 'Nome' });
    if (name.length < 2) throw new HttpError(400, 'Informe ao menos 2 caracteres.');
    await pool.query('UPDATE admin SET name = $1 WHERE id = 1', [name]);
    res.json({ admin: adminPayload(await getAdmin()) });
  }),
);

app.post(
  '/api/auth/change-password',
  requireAuth,
  wrap(async (req, res) => {
    const admin = await getAdmin();
    const currentPassword =
      typeof req.body?.currentPassword === 'string' ? req.body.currentPassword : '';
    const newPassword = typeof req.body?.newPassword === 'string' ? req.body.newPassword : '';
    await sleep(220);

    if (!(await verifyPassword(currentPassword, admin.password_hash))) {
      throw new HttpError(400, 'Senha atual incorreta.');
    }
    const issue = passwordIssue(newPassword, admin.name);
    if (issue) throw new HttpError(400, issue);
    if (await verifyPassword(newPassword, admin.password_hash)) {
      throw new HttpError(400, 'Escolha uma senha diferente da atual.');
    }

    const hash = await hashPassword(newPassword);
    await pool.query('UPDATE admin SET password_hash = $1, password_changed_at = $2 WHERE id = 1', [
      hash,
      nowIso(),
    ]);
    const revoked = await revokeOtherSessions(req);
    res.json({
      ok: true,
      message:
        revoked > 0
          ? 'Senha alterada. Outras sessões foram encerradas.'
          : 'Senha alterada com sucesso.',
      revoked,
    });
  }),
);

app.post(
  '/api/auth/recovery/regenerate',
  requireAuth,
  wrap(async (req, res) => {
    const admin = await getAdmin();
    await sleep(220);
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!(await verifyPassword(password, admin.password_hash))) {
      throw new HttpError(400, 'Senha incorreta.');
    }
    const recoveryKey = generateRecoveryKey();
    await pool.query('UPDATE admin SET recovery_hash = $1 WHERE id = 1', [
      hashRecoveryKey(recoveryKey),
    ]);
    res.json({ recoveryKey });
  }),
);

app.post(
  '/api/auth/revoke-sessions',
  requireAuth,
  wrap(async (req, res) => {
    const revoked = await revokeOtherSessions(req);
    res.json({ ok: true, revoked, activeSessions: await countSessions() });
  }),
);

app.get(
  '/api/products',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ products: await listProducts() });
  }),
);

async function validateProduct(body, existing = null) {
  const name = text(body.name, 90, { required: true, label: 'Nome do produto' });
  if (name.length < 2) throw new HttpError(400, 'O nome do produto é muito curto.');
  const typeId = Number(body.typeId);
  if (!Number.isInteger(typeId) || typeId <= 0) {
    throw new HttpError(400, 'Selecione um tipo de produto.');
  }
  const type = await one('SELECT id FROM types WHERE id = $1', [typeId]);
  if (!type) throw new HttpError(400, 'Tipo de produto não encontrado.');

  const unit = String(body.unit ?? 'un');
  if (!UNITS.includes(unit)) throw new HttpError(400, 'Unidade inválida.');

  const price = decimal(body.price, { min: 0, max: 10_000_000, label: 'Preço' });
  const initialStock = decimal(body.initialStock ?? 0, {
    min: 0,
    max: 5_000_000,
    label: 'Estoque inicial',
  });
  const minStock = decimal(body.minStock ?? 0, {
    min: 0,
    max: 5_000_000,
    label: 'Estoque mínimo',
  });
  const expiresOn = dateField(body.expiresOn, { label: 'Validade' });
  const notes = text(body.notes, 400);

  let sku = String(body.sku ?? '')
    .trim()
    .toUpperCase();
  if (!sku) {
    const existingSkus = await allSkus();
    if (existing) existingSkus.delete(existing.sku);
    sku = generateSku(name, existingSkus);
  }
  if (!/^[A-Z0-9][A-Z0-9._-]{1,23}$/.test(sku)) {
    throw new HttpError(
      400,
      'Código inválido. Use de 2 a 24 caracteres: letras, números, ponto, hífen ou _. ',
    );
  }
  const skuConflict = await one('SELECT id FROM products WHERE sku = $1 AND id <> $2', [
    sku,
    existing?.id ?? 0,
  ]);
  if (skuConflict) throw new HttpError(409, 'Já existe um produto com esse código.');

  if (existing) {
    const stockAfter = existing.stock - existing.initialStock + initialStock;
    if (stockAfter < 0) {
      throw new HttpError(
        409,
        'Com esse estoque inicial o saldo ficaria negativo. Exclua movimentações antes.',
      );
    }
  }

  return {
    name,
    sku,
    typeId,
    unit,
    price: Math.round(price * 100) / 100,
    initialStock,
    minStock,
    expiresOn,
    notes,
  };
}

app.post(
  '/api/products',
  requireAuth,
  wrap(async (req, res) => {
    const data = await validateProduct(req.body ?? {});
    const stamp = nowIso();
    const inserted = await one(
      `
      INSERT INTO products
        (name, sku, type_id, unit, price, initial_stock, min_stock, expires_on, notes, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING id
    `,
      [
        data.name,
        data.sku,
        data.typeId,
        data.unit,
        data.price,
        data.initialStock,
        data.minStock,
        data.expiresOn,
        data.notes,
        stamp,
        stamp,
      ],
    );
    res.status(201).json({ product: await getProductRow(Number(inserted.id)) });
  }),
);

app.patch(
  '/api/products/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await getProductRow(id);
    if (!existing) throw new HttpError(404, 'Produto não encontrado.');
    const data = await validateProduct(req.body ?? {}, existing);
    await pool.query(
      `
      UPDATE products SET
        name = $1, sku = $2, type_id = $3, unit = $4, price = $5, initial_stock = $6,
        min_stock = $7, expires_on = $8, notes = $9, updated_at = $10
      WHERE id = $11
    `,
      [
        data.name,
        data.sku,
        data.typeId,
        data.unit,
        data.price,
        data.initialStock,
        data.minStock,
        data.expiresOn,
        data.notes,
        nowIso(),
        id,
      ],
    );
    res.json({ product: await getProductRow(id) });
  }),
);

app.delete(
  '/api/products/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await getProductRow(id);
    if (!existing) throw new HttpError(404, 'Produto não encontrado.');
    const movementCount = await one('SELECT COUNT(*) AS n FROM movements WHERE product_id = $1', [
      id,
    ]);
    await pool.query('DELETE FROM products WHERE id = $1', [id]);
    res.json({ ok: true, movementsDeleted: Number(movementCount.n) });
  }),
);

app.get(
  '/api/movements',
  requireAuth,
  wrap(async (req, res) => {
    const days = Number(req.query.days ?? 0);
    const limit = Number(req.query.limit ?? 800);
    res.json({
      movements: await listMovements({
        days: Number.isFinite(days) ? days : 0,
        limit: Number.isFinite(limit) ? limit : 800,
      }),
    });
  }),
);

app.post(
  '/api/movements',
  requireAuth,
  wrap(async (req, res) => {
    const productId = Number(req.body?.productId);
    if (!Number.isInteger(productId) || productId <= 0) {
      throw new HttpError(400, 'Selecione um produto.');
    }
    const product = await getProductRow(productId);
    if (!product) throw new HttpError(404, 'Produto não encontrado.');

    const kind = req.body?.kind;
    if (kind !== 'saida' && kind !== 'entrada') {
      throw new HttpError(400, 'Escolha o tipo da movimentação.');
    }
    const quantity = decimal(req.body?.quantity, {
      min: 0.001,
      max: 5_000_000,
      label: 'Quantidade',
    });
    const date = dateField(req.body?.date, { required: true });
    if (date > todayStr()) throw new HttpError(400, 'A data não pode estar no futuro.');
    const time = timeField(req.body?.time);
    const unitPrice =
      req.body?.unitPrice === undefined || req.body?.unitPrice === ''
        ? product.price
        : decimal(req.body.unitPrice, { min: 0, max: 10_000_000, label: 'Valor unitário' });
    const party = text(req.body?.party, 120);
    const notes = text(req.body?.notes, 400);

    const stock = await getProductStock(productId);
    if (kind === 'saida' && stock < quantity) {
      throw new HttpError(409, `Estoque insuficiente. Disponível: ${stock} ${product.unit}.`, {
        availableStock: stock,
      });
    }

    const stamp = nowIso();
    let insertedId = 0;
    await transaction(async (client) => {
      const lock = await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [
        productId,
      ]);
      if (!lock.rows[0]) throw new HttpError(404, 'Produto não encontrado.');
      const currentStock = await getProductStock(productId, client);
      if (kind === 'saida' && currentStock < quantity) {
        throw new HttpError(409, 'Estoque insuficiente no momento do registro.', {
          availableStock: currentStock,
        });
      }
      const inserted = await client.query(
        `
        INSERT INTO movements (product_id, kind, quantity, unit_price, date, time, party, notes, created_at)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING id
      `,
        [
          productId,
          kind,
          Math.round(quantity * 1000) / 1000,
          Math.round(unitPrice * 100) / 100,
          date,
          time,
          party,
          notes,
          stamp,
        ],
      );
      insertedId = Number(inserted.rows[0].id);
    });

    res.status(201).json({
      movement: await getMovementById(insertedId),
      stock: await getProductStock(productId),
    });
  }),
);

app.delete(
  '/api/movements/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const movement = await getMovementById(id);
    if (!movement) throw new HttpError(404, 'Movimentação não encontrada.');

    await transaction(async (client) => {
      await client.query('SELECT id FROM products WHERE id = $1 FOR UPDATE', [movement.productId]);
      const stock = await getProductStock(movement.productId, client);
      if (movement.kind === 'entrada' && stock - movement.quantity < 0) {
        throw new HttpError(
          409,
          'Não é possível excluir esta entrada: o estoque ficaria negativo.',
        );
      }
      await client.query('DELETE FROM movements WHERE id = $1', [id]);
    });

    res.json({ ok: true, stock: await getProductStock(movement.productId) });
  }),
);

app.get(
  '/api/types',
  requireAuth,
  wrap(async (req, res) => {
    res.json({ types: await listTypes() });
  }),
);

async function validateType(body, existing = null) {
  const name = text(body.name, 40, { required: true, label: 'Nome do tipo' });
  if (name.length < 2) throw new HttpError(400, 'O nome do tipo é muito curto.');
  const color = String(body.color ?? '').trim();
  if (!HEX_COLOR.test(color)) throw new HttpError(400, 'Selecione uma cor válida.');
  const conflict = await one(
    'SELECT id FROM types WHERE LOWER(name) = LOWER($1) AND id <> $2',
    [name, existing?.id ?? 0],
  );
  if (conflict) throw new HttpError(409, 'Já existe um tipo com esse nome.');
  return { name, color };
}

app.post(
  '/api/types',
  requireAuth,
  wrap(async (req, res) => {
    const data = await validateType(req.body ?? {});
    const inserted = await one(
      'INSERT INTO types (name, color, created_at) VALUES ($1, $2, $3) RETURNING id',
      [data.name, data.color, nowIso()],
    );
    const created = (await listTypes()).find((type) => type.id === Number(inserted.id));
    res.status(201).json({ type: created });
  }),
);

app.patch(
  '/api/types/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM types WHERE id = $1', [id]);
    if (!existing) throw new HttpError(404, 'Tipo não encontrado.');
    const data = await validateType(req.body ?? {}, existing);
    await pool.query('UPDATE types SET name = $1, color = $2 WHERE id = $3', [
      data.name,
      data.color,
      id,
    ]);
    const updated = (await listTypes()).find((type) => type.id === id);
    res.json({ type: updated });
  }),
);

app.delete(
  '/api/types/:id',
  requireAuth,
  wrap(async (req, res) => {
    const id = Number(req.params.id);
    const existing = await one('SELECT * FROM types WHERE id = $1', [id]);
    if (!existing) throw new HttpError(404, 'Tipo não encontrado.');
    const count = await one('SELECT COUNT(*) AS n FROM products WHERE type_id = $1', [id]);
    if (Number(count.n) > 0) {
      throw new HttpError(
        409,
        `Este tipo possui ${count.n} produto(s). Mova-os para outro tipo antes de excluir.`,
      );
    }
    await pool.query('DELETE FROM types WHERE id = $1', [id]);
    res.json({ ok: true });
  }),
);

app.get(
  '/api/analytics',
  requireAuth,
  wrap(async (req, res) => {
    const days = Number(req.query.days ?? 30);
    res.json(await getAnalytics(days));
  }),
);

app.get(
  '/api/export',
  requireAuth,
  wrap(async (req, res) => {
    const filename = `controles-da-silmara-backup-${todayStr()}.json`;
    res.setHeader('Content-Type', 'application/json; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(JSON.stringify(await exportAll(), null, 2));
  }),
);

app.post(
  '/api/demo',
  requireAuth,
  wrap(async (req, res) => {
    const count = await one('SELECT COUNT(*) AS n FROM products');
    if (Number(count.n) > 0) {
      throw new HttpError(
        409,
        'Já existem produtos cadastrados. Use uma base vazia para carregar os dados de exemplo.',
      );
    }
    const result = await loadDemo();
    res.status(201).json({ ok: true, ...result });
  }),
);

app.post(
  '/api/data/reset',
  requireAuth,
  wrap(async (req, res) => {
    await sleep(220);
    const admin = await getAdmin();
    const password = typeof req.body?.password === 'string' ? req.body.password : '';
    if (!(await verifyPassword(password, admin.password_hash))) {
      throw new HttpError(400, 'Senha incorreta.');
    }
    if (req.body?.confirmation !== 'APAGAR') {
      throw new HttpError(400, 'Digite APAGAR para confirmar a exclusão.');
    }
    await resetData();
    await ensureDefaultTypes();
    res.json({ ok: true, message: 'Todos os produtos e movimentações foram removidos.' });
  }),
);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Recurso não encontrado.' });
});

if (existsSync(DIST)) {
  app.use('/assets', express.static(path.join(DIST, 'assets'), { maxAge: '1y', immutable: true }));
  app.use(express.static(DIST, { index: false, maxAge: '1h' }));
  app.get('*', (req, res) => {
    res.setHeader('Cache-Control', 'no-store');
    res.sendFile(path.join(DIST, 'index.html'));
  });
} else {
  app.get('*', (req, res) => {
    res
      .status(200)
      .type('text/plain; charset=utf-8')
      .send(
        'Controles da Silmara — API ativa.\nA interface ainda não foi compilada. Rode "npm run build" e reinicie o servidor, ou use "npm run dev" para desenvolvimento.',
      );
  });
}

app.use((err, req, res, next) => {
  if (res.headersSent) return next(err);
  if (err?.type === 'entity.too.large') {
    return res.status(413).json({ error: 'A requisição é muito grande.' });
  }
  if (err?.type === 'entity.parse.failed') {
    return res.status(400).json({ error: 'Dados inválidos.' });
  }
  if (err instanceof HttpError) {
    return res.status(err.status).json({ error: err.message, ...err.extra });
  }
  console.error(err);
  return res.status(500).json({ error: 'Ocorreu um erro interno. Tente novamente.' });
});

async function ensureAdminFromEnvironment() {
  if (await isConfigured()) return;
  const password = process.env.SILMARA_ADMIN_PASSWORD;
  if (!password) return;
  if (password.length < 8) {
    console.warn('SILMARA_ADMIN_PASSWORD precisa ter ao menos 8 caracteres. Conta não criada.');
    return;
  }
  const requestedName = String(process.env.SILMARA_ADMIN_NAME ?? 'Silmara').trim().slice(0, 50);
  const name = requestedName.length >= 2 ? requestedName : 'Silmara';
  const passwordHash = await hashPassword(password);
  const stamp = nowIso();
  try {
    await pool.query(
      'INSERT INTO admin (id, name, password_hash, recovery_hash, created_at, password_changed_at) VALUES (1, $1, $2, NULL, $3, $4)',
      [name, passwordHash, stamp, stamp],
    );
  } catch (error) {
    if (error?.code === '23505') return;
    throw error;
  }
  await ensureDefaultTypes();
  const issue = passwordIssue(password, name);
  console.log(
    `Conta de ${name} criada a partir de SILMARA_ADMIN_PASSWORD.${issue ? ' A senha inicial não segue a política completa; troque-a em Ajustes quando puder.' : ''}`,
  );
}

let readyPromise = null;

export function prepareApp() {
  if (!readyPromise) {
    readyPromise = (async () => {
      await initDb();
      await ensureAdminFromEnvironment();
    })().catch((error) => {
      readyPromise = null;
      throw error;
    });
  }
  return readyPromise;
}

const isDirectRun =
  Boolean(process.argv[1]) &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectRun) {
  const PORT = Number(process.env.PORT) || 5174;
  await prepareApp();
  const server = app.listen(PORT, () => {
    console.log(`\n  Controles da Silmara · http://localhost:${PORT}\n`);
  });

  process.on('SIGTERM', () => {
    server.close(() => {
      pool.end().finally(() => process.exit(0));
    });
  });
}

export { app };
export default app;
