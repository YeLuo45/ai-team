// V20: 多用户认证 + RBAC + 审计日志

import type { JsonStore } from './store/json-store.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

// 角色定义
export type Role = 'admin' | 'manager' | 'interviewer' | 'viewer';

// 用户
export interface User {
  id: string;
  email: string;
  username: string;
  passwordHash: string;
  role: Role;
  teams: string[];  // 数据隔离
  createdAt: string;
  updatedAt: string;
  lastLoginAt?: string;
  disabled?: boolean;
}

// 用户 store
export interface UserStore {
  list(): Promise<User[]>;
  get(id: string): Promise<User | undefined>;
  getByEmail(email: string): Promise<User | undefined>;
  getByUsername(username: string): Promise<User | undefined>;
  create(input: { email: string; username: string; password: string; role: Role; teams?: string[] }): Promise<User>;
  update(id: string, patch: Partial<User>): Promise<User | undefined>;
  remove(id: string): Promise<boolean>;
}

export function createUserStore(baseStore: JsonStore<User>): UserStore {
  return {
    async list() {
      return baseStore.list();
    },
    async get(id) {
      return baseStore.get(id);
    },
    async getByEmail(email) {
      const users = await baseStore.list();
      return users.find((u: User) => u.email === email);
    },
    async getByUsername(username) {
      const users = await baseStore.list();
      return users.find((u: User) => u.username === username);
    },
    async create(input) {
      const passwordHash = await bcrypt.hash(input.password, 10);
      const now = new Date().toISOString();
      const user: User = {
        id: `usr_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        email: input.email,
        username: input.username,
        passwordHash,
        role: input.role,
        teams: input.teams || [],
        createdAt: now,
        updatedAt: now,
      };
      await baseStore.add(user);
      return user;
    },
    async update(id, patch) {
      return baseStore.update(id, { ...patch, updatedAt: new Date().toISOString() });
    },
    async remove(id) {
      return baseStore.remove(id);
    },
  };
}

// 审计日志
export type AuditAction =
  | 'user.login' | 'user.logout' | 'user.register' | 'user.update' | 'user.delete'
  | 'candidate.create' | 'candidate.update' | 'candidate.delete'
  | 'member.create' | 'member.update' | 'member.delete'
  | 'interview.start' | 'interview.complete'
  | 'training.generate' | 'review.generate'
  | 'auth.failed' | 'auth.unauthorized';

export interface AuditEntry {
  id: string;
  userId?: string;
  username?: string;
  action: AuditAction;
  resourceType?: string;
  resourceId?: string;
  details?: Record<string, any>;
  ip?: string;
  userAgent?: string;
  timestamp: string;
  success: boolean;
  errorMessage?: string;
}

export interface AuditStore {
  list(): Promise<AuditEntry[]>;
  filter(opts: { userId?: string; action?: string; since?: string; limit?: number }): Promise<AuditEntry[]>;
  log(entry: Omit<AuditEntry, 'id' | 'timestamp'>): Promise<AuditEntry>;
}

export function createAuditStore(baseStore: JsonStore<AuditEntry>): AuditStore {
  return {
    async list() {
      return baseStore.list();
    },
    async filter(opts) {
      let entries = await baseStore.list();
      if (opts.userId) entries = entries.filter((e: AuditEntry) => e.userId === opts.userId);
      if (opts.action) entries = entries.filter((e: AuditEntry) => e.action === opts.action);
      if (opts.since) {
        const since = opts.since;
        entries = entries.filter((e: AuditEntry) => e.timestamp >= since);
      }
      if (opts.limit) entries = entries.slice(-opts.limit);
      return entries;
    },
    async log(entry) {
      const log: AuditEntry = {
        id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
        timestamp: new Date().toISOString(),
        ...entry,
      };
      await baseStore.add(log);
      return log;
    },
  };
}

// JWT 工具
export interface JwtConfig {
  secret: string;
  expiresIn: string;
}

export interface TokenPayload {
  sub: string;        // user id
  username: string;
  role: Role;
  teams: string[];
}

export function signToken(payload: TokenPayload, config: JwtConfig): string {
  // jsonwebtoken types don't accept string for expiresIn; cast via any
  return jwt.sign(payload as any, config.secret as any, { expiresIn: config.expiresIn } as any);
}

export function verifyToken(token: string, config: JwtConfig): TokenPayload | null {
  try {
    const decoded = jwt.verify(token, config.secret) as any;
    if (!decoded.sub || !decoded.username || !decoded.role) {
      return null;
    }
    return {
      sub: decoded.sub,
      username: decoded.username,
      role: decoded.role as Role,
      teams: decoded.teams || [],
    };
  } catch {
    return null;
  }
}

// RBAC 权限
export const Permissions: Record<string, string[]> = {
  admin: [
    'user.manage', 'system.config',
    'candidate.*', 'member.*', 'interview.*', 'training.*', 'review.*',
    'plugin.*', 'audit.view',
  ],
  manager: [
    'candidate.read', 'candidate.create', 'candidate.update',
    'member.read', 'member.create', 'member.update',
    'interview.read', 'interview.create', 'interview.complete',
    'training.read', 'training.create',
    'review.read', 'review.create',
    'audit.view',
  ],
  interviewer: [
    'candidate.read', 'interview.read', 'interview.create', 'interview.complete',
    'member.read',
  ],
  viewer: [
    'candidate.read', 'member.read', 'interview.read',
    'training.read', 'review.read',
  ],
};

export function hasPermission(role: Role, permission: string): boolean {
  const perms = Permissions[role] || [];
  return perms.some((p: string) => {
    if (p === permission) return true;
    if (p.endsWith('.*')) {
      const prefix = p.slice(0, -2);
      return permission.startsWith(prefix + '.');
    }
    return false;
  });
}