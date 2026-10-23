import crypto from 'node:crypto';
import { promisify } from 'node:util';
import { nowIso, db } from './db.mjs';

const scryptAsync = promisify(crypto.scrypt);

const SCRYPT = { N: 32768, r: 8, p: 1, keylen: 64 };
const SESSION_COOKIE = 'silmara_sid';
const SESSION_DAYS = 7;

const COMMON_PASSWORDS = [
  'senha',
  'password',
  'admin',
  'silmara',
  'controles',
  'qwerty',
  '123456',
  'estoque',
  'brasil',
  '12345678',
  'iloveyou',
  'abc123',
];

export function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function hashPassword(password) {
  const salt = crypto.randomBytes(24);
  const derived = await scryptAsync(password, salt, SCRYPT.keylen, {
    N: SCRYPT.N,
    r: SCRYPT.r,
    p: SCRYPT.p,
    maxmem: 128 * 1024 * 1024,
  });
  return `scrypt$${SCRYPT.N}$${SCRYPT.r}$${SCRYPT.p}$${salt.toString('hex')}$${derived.toString('hex')}`;
}

export async function verifyPassword(password, stored) {
  try {
    const [scheme, n, r, p, saltHex, hashHex] = String(stored).split('$');
    if (scheme !== 'scrypt') return false;
    const salt = Buffer.from(saltHex, 'hex');
    const expected = Buffer.from(hashHex, 'hex');
    const derived = await scryptAsync(password, salt, expected.length, {
      N: Number(n),
      r: Number(r),
      p: Number(p),
      maxmem: 128 * 1024 * 1024,
    });
    return derived.length === expected.length && crypto.timingSafeEqual(derived, expected);
  } catch {
    return false;
  }
}

export function passwordIssue(password, name = '') {
  if (typeof password !== 'string') return 'Informe uma senha.';
  if (password.length < 12) return 'Use pelo menos 12 caracteres.';
  if (password.length > 128) return 'A senha pode ter no máximo 128 caracteres.';
  const classes = [/[a-z]/, /[A-Z]/, /\d/, /[^A-Za-z0-9]/].filter((re) => re.test(password)).length;
  if (classes < 3) {
    return 'Combine letras maiúsculas, minúsculas, números e símbolos (use ao menos 3 tipos).';
  }
  const normalized = password.toLowerCase();
  if (name && name.length >= 3 && normalized.includes(name.toLowerCase())) {
    return 'A senha não pode conter o seu nome.';
  }
  if (COMMON_PASSWORDS.some((word) => normalized.includes(word))) {
    return 'Essa senha é previsível. Escolha algo único.';
  }
  if (/^(.)\1+$/.test(password)) return 'Evite caracteres repetidos.';
  return null;
}

const RECOVERY_ALPHABET = 'ABCDEFGHJKMNPQRSTVWXYZ23456789';

export function generateRecoveryKey() {
  const bytes = crypto.randomBytes(20);
  let raw = '';
  for (const byte of bytes) raw += RECOVERY_ALPHABET[byte % RECOVERY_ALPHABET.length];
  const groups = raw.match(/.{1,5}/g) ?? [];
  return `SILMARA-${groups.join('-')}`;
}

export function normalizeRecoveryKey(input) {
  const clean = String(input ?? '')
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, '');
  return clean.startsWith('SILMARA') ? clean.slice(7) : clean;
}

export function hashRecoveryKey(input) {
  return crypto.createHash('sha256').update(`silmara-recovery:${normalizeRecoveryKey(input)}`).digest('hex');
}

export function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

export function safeCompareHex(a, b) {
  try {
    const bufA = Buffer.from(String(a), 'hex');
    const bufB = Buffer.from(String(b), 'hex');
    return bufA.length === bufB.length && crypto.timingSafeEqual(bufA, bufB);
  } catch {
    return false;
  }
}

export function parseCookies(header = '') {
  const cookies = {};
  for (const part of String(header).split(';')) {
    const index = part.indexOf('=');
    if (index === -1) continue;
    const name = part.slice(0, index).trim();
    const value = part.slice(index + 1).trim();
    if (!name) continue;
    try {
      cookies[name] = decodeURIComponent(value);
    } catch {
      cookies[name] = value;
    }
  }
  return cookies;
}

function cookieOptions(req, maxAgeSeconds = SESSION_DAYS * 24 * 60 * 60) {
  return {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    path: '/',
    maxAge: maxAgeSeconds * 1000,
    priority: 'high',
  };
}

export function setSessionCookie(req, res, token, maxAgeSeconds) {
  res.cookie(SESSION_COOKIE, token, cookieOptions(req, maxAgeSeconds));
}

export function clearSessionCookie(req, res) {
  res.clearCookie(SESSION_COOKIE, {
    httpOnly: true,
    sameSite: 'strict',
    secure: req.secure,
    path: '/',
  });
}

export function createSession(req, res) {
  const token = crypto.randomBytes(32).toString('base64url');
  const tokenHash = hashToken(token);
  const now = new Date();
  const expires = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
  const id = crypto.randomUUID();
  const ipHash = crypto.createHash('sha256').update(String(req.ip ?? '')).digest('hex').slice(0, 24);

  db.prepare('DELETE FROM sessions WHERE expires_at <= ?').run(now.toISOString());
  db.prepare(
    `
    INSERT INTO sessions (id, token_hash, created_at, expires_at, last_seen, user_agent, ip_hash)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `,
  ).run(
    id,
    tokenHash,
    now.toISOString(),
    expires.toISOString(),
    now.toISOString(),
    String(req.get('user-agent') ?? '').slice(0, 250),
    ipHash,
  );

  const count = db.prepare('SELECT COUNT(*) AS n FROM sessions').get();
  if (Number(count.n) > 20) {
    db.prepare(
      `DELETE FROM sessions WHERE id IN (
        SELECT id FROM sessions ORDER BY created_at ASC LIMIT ?
      )`,
    ).run(Number(count.n) - 20);
  }

  setSessionCookie(req, res, token, SESSION_DAYS * 24 * 60 * 60);
  return { id, token, tokenHash, expiresAt: expires.toISOString() };
}

export function destroyCurrentSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (token) {
    db.prepare('DELETE FROM sessions WHERE token_hash = ?').run(hashToken(token));
  }
  clearSessionCookie(req, res);
}

export function revokeOtherSessions(req) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return 0;
  const result = db
    .prepare('DELETE FROM sessions WHERE token_hash <> ?')
    .run(hashToken(token));
  return Number(result.changes);
}

export function countSessions() {
  const row = db.prepare('SELECT COUNT(*) AS n FROM sessions WHERE expires_at > ?').get(nowIso());
  return Number(row.n);
}

export function resolveSession(req, res) {
  const cookies = parseCookies(req.headers.cookie);
  const token = cookies[SESSION_COOKIE];
  if (!token) return null;

  const row = db
    .prepare(
      `
      SELECT s.id, s.expires_at, s.last_seen, s.created_at, a.name, a.created_at AS admin_created_at,
        a.password_changed_at, a.recovery_hash
      FROM sessions s
      JOIN admin a ON a.id = 1
      WHERE s.token_hash = ?
    `,
    )
    .get(hashToken(token));

  if (!row) {
    clearSessionCookie(req, res);
    return null;
  }

  const now = new Date();
  if (new Date(row.expires_at) <= now) {
    db.prepare('DELETE FROM sessions WHERE id = ?').run(row.id);
    clearSessionCookie(req, res);
    return null;
  }

  const remainingMs = new Date(row.expires_at).getTime() - now.getTime();
  if (remainingMs < (SESSION_DAYS - 1) * 24 * 60 * 60 * 1000) {
    const newExpiry = new Date(now.getTime() + SESSION_DAYS * 24 * 60 * 60 * 1000);
    db.prepare('UPDATE sessions SET expires_at = ?, last_seen = ? WHERE id = ?').run(
      newExpiry.toISOString(),
      now.toISOString(),
      row.id,
    );
    setSessionCookie(req, res, token, SESSION_DAYS * 24 * 60 * 60);
  } else if (now.getTime() - new Date(row.last_seen).getTime() > 10 * 60 * 1000) {
    db.prepare('UPDATE sessions SET last_seen = ? WHERE id = ?').run(now.toISOString(), row.id);
  }

  return {
    sessionId: row.id,
    sessionExpiresAt: row.expires_at,
    admin: {
      name: row.name,
      createdAt: row.admin_created_at,
      passwordChangedAt: row.password_changed_at,
      recoveryConfigured: Boolean(row.recovery_hash),
    },
  };
}

export function requireAuth(req, res, next) {
  const resolved = resolveSession(req, res);
  if (!resolved) {
    return res.status(401).json({ error: 'Sua sessão não está ativa. Entre novamente.' });
  }
  req.admin = resolved.admin;
  req.sessionId = resolved.sessionId;
  req.sessionExpiresAt = resolved.sessionExpiresAt;
  return next();
}

export function getThrottle(key) {
  return db.prepare('SELECT * FROM auth_throttle WHERE key = ?').get(key) ?? null;
}

export function throttleMessage(key) {
  const row = getThrottle(key);
  if (!row || !row.locked_until) return null;
  const seconds = Math.ceil((new Date(row.locked_until).getTime() - Date.now()) / 1000);
  if (seconds <= 0) return null;
  const minutes = Math.max(1, Math.ceil(seconds / 60));
  return {
    seconds,
    message: `Muitas tentativas. Acesso bloqueado por ${minutes} min.`,
  };
}

export function registerFailure(key) {
  const now = new Date();
  const row = getThrottle(key);
  const failures = (row?.failures ?? 0) + 1;
  let lockedUntil = null;
  if (failures >= 12) lockedUntil = new Date(now.getTime() + 6 * 60 * 60 * 1000);
  else if (failures >= 8) lockedUntil = new Date(now.getTime() + 30 * 60 * 1000);
  else if (failures >= 5) lockedUntil = new Date(now.getTime() + 5 * 60 * 1000);

  db.prepare(
    `
    INSERT INTO auth_throttle (key, failures, locked_until, updated_at)
    VALUES (?, ?, ?, ?)
    ON CONFLICT(key) DO UPDATE SET
      failures = excluded.failures,
      locked_until = excluded.locked_until,
      updated_at = excluded.updated_at
  `,
  ).run(key, failures, lockedUntil ? lockedUntil.toISOString() : row?.locked_until ?? null, now.toISOString());

  if (lockedUntil) {
    const minutes = Math.max(1, Math.ceil((lockedUntil.getTime() - now.getTime()) / 60000));
    return { locked: true, message: `Muitas tentativas. Acesso bloqueado por ${minutes} min.` };
  }
  return { locked: false, failures };
}

export function clearFailures(key) {
  db.prepare('DELETE FROM auth_throttle WHERE key = ?').run(key);
}

export function clientKey(req, scope = 'login') {
  return `${scope}:${String(req.ip ?? 'unknown')}`;
}

export { SESSION_COOKIE, SESSION_DAYS };
