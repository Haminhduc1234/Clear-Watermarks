import fs from 'fs';
import path from 'path';
import crypto from 'crypto';

export interface User {
  id: string;
  name: string;
  email: string;
  role: 'admin' | 'user';
  createdAt: string;
}

interface StoredUser extends User {
  passwordHash: string;
  salt: string;
}

const DB_DIR = path.resolve(process.cwd(), 'data');
const DB_FILE = path.join(DB_DIR, 'users.json');
const AUTH_SECRET = process.env.AUTH_SECRET || 'clearmark-secret-key-2026-auth';

// Helper to ensure data directory and database file exist
function ensureDatabase(): StoredUser[] {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }

  if (!fs.existsSync(DB_FILE)) {
    // Seed with a default Administrator account
    const salt = crypto.randomBytes(16).toString('hex');
    const passwordHash = hashPassword('admin123', salt);

    const defaultAdmin: StoredUser = {
      id: 'admin-' + Date.now(),
      name: 'Administrator',
      email: 'admin@clearmark.com',
      role: 'admin',
      createdAt: new Date().toISOString(),
      passwordHash,
      salt,
    };

    const initialUsers = [defaultAdmin];
    fs.writeFileSync(DB_FILE, JSON.stringify(initialUsers, null, 2), 'utf-8');
    return initialUsers;
  }

  try {
    const content = fs.readFileSync(DB_FILE, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    console.error('Error reading users database:', err);
    return [];
  }
}

function saveUsers(users: StoredUser[]) {
  if (!fs.existsSync(DB_DIR)) {
    fs.mkdirSync(DB_DIR, { recursive: true });
  }
  fs.writeFileSync(DB_FILE, JSON.stringify(users, null, 2), 'utf-8');
}

function hashPassword(password: string, salt: string): string {
  return crypto.pbkdf2Sync(password, salt, 1000, 64, 'sha512').toString('hex');
}

// Token handling (HMAC-SHA256 signed JSON)
export function createToken(user: User): string {
  const payload = {
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7 days expiration
  };

  const payloadB64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const signature = crypto
    .createHmac('sha256', AUTH_SECRET)
    .update(payloadB64)
    .digest('base64url');

  return `${payloadB64}.${signature}`;
}

export function verifyToken(token: string): { id: string; email: string; role: string } | null {
  try {
    const parts = token.split('.');
    if (parts.length !== 2) return null;

    const [payloadB64, signature] = parts;
    const expectedSig = crypto
      .createHmac('sha256', AUTH_SECRET)
      .update(payloadB64)
      .digest('base64url');

    if (signature !== expectedSig) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf-8'));
    if (Date.now() > payload.exp) return null;

    return payload;
  } catch (err) {
    return null;
  }
}

export function registerUser(name: string, email: string, password: string): { user: User; token: string } {
  const users = ensureDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  if (!name.trim()) throw new Error('Vui lòng nhập họ và tên');
  if (!normalizedEmail || !normalizedEmail.includes('@')) throw new Error('Email không hợp lệ');
  if (!password || password.length < 6) throw new Error('Mật khẩu phải có ít nhất 6 ký tự');

  if (users.some((u) => u.email.toLowerCase() === normalizedEmail)) {
    throw new Error('Email này đã được đăng ký trong hệ thống');
  }

  const salt = crypto.randomBytes(16).toString('hex');
  const passwordHash = hashPassword(password, salt);

  const newUser: StoredUser = {
    id: 'user-' + Date.now() + '-' + Math.random().toString(36).substring(2, 7),
    name: name.trim(),
    email: normalizedEmail,
    role: 'user',
    createdAt: new Date().toISOString(),
    passwordHash,
    salt,
  };

  users.push(newUser);
  saveUsers(users);

  const safeUser: User = {
    id: newUser.id,
    name: newUser.name,
    email: newUser.email,
    role: newUser.role,
    createdAt: newUser.createdAt,
  };

  const token = createToken(safeUser);
  return { user: safeUser, token };
}

export function loginUser(email: string, password: string): { user: User; token: string } {
  const users = ensureDatabase();
  const normalizedEmail = email.trim().toLowerCase();

  const user = users.find((u) => u.email.toLowerCase() === normalizedEmail);
  if (!user) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác');
  }

  const hash = hashPassword(password, user.salt);
  if (hash !== user.passwordHash) {
    throw new Error('Tài khoản hoặc mật khẩu không chính xác');
  }

  const safeUser: User = {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };

  const token = createToken(safeUser);
  return { user: safeUser, token };
}

export function getUserById(id: string): User | null {
  const users = ensureDatabase();
  const user = users.find((u) => u.id === id);
  if (!user) return null;

  return {
    id: user.id,
    name: user.name,
    email: user.email,
    role: user.role,
    createdAt: user.createdAt,
  };
}
