import crypto from 'node:crypto';
import fs from 'node:fs';
import type { IncomingMessage, ServerResponse } from 'node:http';
import path from 'node:path';
import firebaseConfig from '../firebase-applet-config.json';
import { getStore } from './store';

export const SESSION_SECRET =
  process.env.SESSION_SECRET && process.env.SESSION_SECRET.trim().length >= 16
    ? process.env.SESSION_SECRET.trim()
    : crypto
        .createHash('sha256')
        .update(
          [
            firebaseConfig.projectId,
            firebaseConfig.firestoreDatabaseId,
            firebaseConfig.appId,
            process.env.ADMIN_EMAIL || 'admin@x.com',
          ].join(':')
        )
        .digest('hex');

const VALID_ID_REGEX = /^[a-zA-Z0-9_-]{1,128}$/;

export function isValidId(id: unknown): id is string {
  return typeof id === 'string' && VALID_ID_REGEX.test(id);
}

export function sanitizeUrl(url: unknown): string {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  if (
    trimmed.startsWith('/src/assets/') ||
    trimmed.startsWith('/uploads/') ||
    trimmed.startsWith('https://') ||
    trimmed.startsWith('http://') ||
    trimmed.startsWith('data:image/') ||
    trimmed.startsWith('data:video/')
  ) {
    return trimmed;
  }
  return '';
}

export function getUploadDir(): string | null {
  const dir = path.resolve(process.cwd(), '.uploads');
  try {
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    const check = path.join(dir, '.write-check');
    fs.writeFileSync(check, 'ok', 'utf-8');
    fs.unlinkSync(check);
    return dir;
  } catch {
    const tmpDir = '/tmp/ads-imoveis-uploads';
    try {
      if (!fs.existsSync(tmpDir)) {
        fs.mkdirSync(tmpDir, { recursive: true });
      }
      return tmpDir;
    } catch {
      return null;
    }
  }
}

export interface SessionPayload {
  email: string;
  role: 'admin';
  tenantId: string;
  exp: number;
}

export function signSessionToken(payload: SessionPayload): string {
  const encoded = Buffer.from(JSON.stringify(payload), 'utf-8').toString('base64url');
  const sig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  return `${encoded}.${sig}`;
}

export function verifySessionToken(token: string): SessionPayload | null {
  const parts = token.split('.');
  if (parts.length !== 2) return null;
  const [encoded, sig] = parts;
  const expectedSig = crypto
    .createHmac('sha256', SESSION_SECRET)
    .update(encoded)
    .digest('base64url');
  const sigBuf = Buffer.from(sig);
  const expBuf = Buffer.from(expectedSig);
  if (sigBuf.length !== expBuf.length || !crypto.timingSafeEqual(sigBuf, expBuf)) {
    return null;
  }
  try {
    const parsed = JSON.parse(
      Buffer.from(encoded, 'base64url').toString('utf-8')
    ) as SessionPayload;
    if (!parsed.email || parsed.exp < Date.now()) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function verifyAdminPassword(password: string): boolean {
  const envPass = process.env.ADMIN_PASSWORD?.trim();
  if (envPass) {
    const a = Buffer.from(password, 'utf-8');
    const b = Buffer.from(envPass, 'utf-8');
    return a.length === b.length && crypto.timingSafeEqual(a, b);
  }
  const store = getStore();
  const creds = store.adminPasswordHash;
  if (!creds) return false;
  const derived = crypto.scryptSync(password, creds.salt, 64);
  const stored = Buffer.from(creds.hashHex, 'hex');
  return derived.length === stored.length && crypto.timingSafeEqual(derived, stored);
}

export function requireAdminSession(
  req: IncomingMessage,
  res: ServerResponse
): SessionPayload | null {
  const rawHeader = req.headers.authorization;
  const authHeader = Array.isArray(rawHeader) ? rawHeader[0] : rawHeader;
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    sendJson(res, 401, { error: 'Sessão administrativa não autenticada.' });
    return null;
  }
  const token = authHeader.slice('Bearer '.length).trim();
  const payload = verifySessionToken(token);
  if (!payload) {
    sendJson(res, 401, { error: 'Sessão administrativa expirada ou inválida.' });
    return null;
  }
  return payload;
}

export function sendJson(res: ServerResponse, statusCode: number, data: unknown): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.end(JSON.stringify(data));
}

export function sendText(res: ServerResponse, statusCode: number, text: string): void {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'text/plain; charset=utf-8');
  res.end(text);
}

export async function readJsonBody(
  req: IncomingMessage & { body?: unknown }
): Promise<Record<string, unknown>> {
  if (req.body !== undefined && req.body !== null) {
    if (typeof req.body === 'object' && !Buffer.isBuffer(req.body)) {
      return req.body as Record<string, unknown>;
    }
    if (typeof req.body === 'string') {
      return req.body ? (JSON.parse(req.body) as Record<string, unknown>) : {};
    }
    if (Buffer.isBuffer(req.body)) {
      const str = req.body.toString('utf-8');
      return str ? (JSON.parse(str) as Record<string, unknown>) : {};
    }
  }

  return new Promise((resolve, reject) => {
    const chunks: Buffer[] = [];
    let totalBytes = 0;
    const maxBytes = 15 * 1024 * 1024;
    req.on('data', (chunk: Buffer | string) => {
      const buf = Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk);
      totalBytes += buf.length;
      if (totalBytes > maxBytes) {
        reject(new Error('Corpo da requisição excede o limite permitido.'));
        req.destroy();
        return;
      }
      chunks.push(buf);
    });
    req.on('end', () => {
      if (chunks.length === 0) {
        resolve({});
        return;
      }
      const raw = Buffer.concat(chunks).toString('utf-8').trim();
      if (!raw) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(raw) as Record<string, unknown>);
      } catch {
        reject(new Error('JSON inválido na requisição.'));
      }
    });
    req.on('error', (err) => reject(err));
  });
}

export function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.png') return 'image/png';
  if (ext === '.webp') return 'image/webp';
  if (ext === '.gif') return 'image/gif';
  if (ext === '.svg') return 'image/svg+xml';
  if (ext === '.webm') return 'video/webm';
  if (ext === '.mp4') return 'video/mp4';
  return 'image/jpeg';
}

export function resolveRequestRoute(req: IncomingMessage): {
  parsedUrl: URL;
  pathname: string;
  method: string;
} {
  const rawUrl = req.url || '/';
  const parsedUrl = new URL(rawUrl, 'http://localhost');
  const routeOverride = parsedUrl.searchParams.get('__route');
  const pathname =
    routeOverride &&
    (routeOverride.startsWith('/api/') || routeOverride.startsWith('/uploads/'))
      ? routeOverride.split('?')[0]
      : parsedUrl.pathname;
  const method = (req.method || 'GET').toUpperCase();
  return { parsedUrl, pathname, method };
}
