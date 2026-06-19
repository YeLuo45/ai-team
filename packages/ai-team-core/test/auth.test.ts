// V20: Auth tests - JWT, bcrypt, RBAC, audit

import { describe, it, expect, beforeEach } from 'vitest';
import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import {
  createUserStore,
  createAuditStore,
  signToken,
  verifyToken,
  hasPermission,
  JsonStore,
} from '../src/index.js';
import type { User, AuditEntry } from '../src/index.js';

// Helper: get unique test dir
const testDir = () => `/tmp/ai-team-test-${randomUUID()}`;

describe('V20: Auth Core', () => {
  describe('createUserStore', () => {
    it('creates user with hashed password', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      const user = await userStore.create({
        email: 'test@example.com',
        username: 'tester',
        password: 'secret123',
        role: 'manager',
        teams: ['alpha'],
      });

      expect(user.email).toBe('test@example.com');
      expect(user.username).toBe('tester');
      expect(user.role).toBe('manager');
      expect(user.passwordHash).not.toBe('secret123');
      expect(user.passwordHash.length).toBeGreaterThan(50);
      expect(user.teams).toEqual(['alpha']);
    });

    it('hashes password with bcrypt (verifiable)', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      const user = await userStore.create({
        email: 'a@b.com',
        username: 'a',
        password: 'mypass',
        role: 'viewer',
      });

      const matches = await bcrypt.compare('mypass', user.passwordHash);
      expect(matches).toBe(true);

      const wrongMatches = await bcrypt.compare('wrongpass', user.passwordHash);
      expect(wrongMatches).toBe(false);
    });

    it('lists users', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      await userStore.create({ email: 'a@x.com', username: 'a', password: 'p', role: 'viewer' });
      await userStore.create({ email: 'b@x.com', username: 'b', password: 'p', role: 'admin' });

      const users = await userStore.list();
      expect(users.length).toBe(2);
    });

    it('getByEmail finds user', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      await userStore.create({ email: 'find@x.com', username: 'finder', password: 'p', role: 'viewer' });

      const found = await userStore.getByEmail('find@x.com');
      expect(found).toBeDefined();
      expect(found!.username).toBe('finder');

      const notFound = await userStore.getByEmail('nope@x.com');
      expect(notFound).toBeUndefined();
    });

    it('getByUsername finds user', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      await userStore.create({ email: 'u@x.com', username: 'unique', password: 'p', role: 'viewer' });

      const found = await userStore.getByUsername('unique');
      expect(found).toBeDefined();

      const notFound = await userStore.getByUsername('nope');
      expect(notFound).toBeUndefined();
    });

    it('updates user', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      const user = await userStore.create({ email: 'u@x.com', username: 'u', password: 'p', role: 'viewer' });
      const updated = await userStore.update(user.id, { role: 'manager' });

      expect(updated).toBeDefined();
      expect(updated!.role).toBe('manager');
      expect(updated!.updatedAt).not.toBe(user.updatedAt);
    });

    it('removes user', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      const user = await userStore.create({ email: 'r@x.com', username: 'r', password: 'p', role: 'viewer' });
      const removed = await userStore.remove(user.id);

      expect(removed).toBe(true);
      const found = await userStore.get(user.id);
      expect(found).toBeUndefined();
    });

    it('generates unique IDs', async () => {
      const store = new JsonStore<User>({ baseDir: testDir(), fileName: 'users.json' });
      const userStore = createUserStore(store);

      const u1 = await userStore.create({ email: '1@x.com', username: '1', password: 'p', role: 'viewer' });
      const u2 = await userStore.create({ email: '2@x.com', username: '2', password: 'p', role: 'viewer' });

      expect(u1.id).not.toBe(u2.id);
      expect(u1.id).toMatch(/^usr_/);
    });
  });

  describe('createAuditStore', () => {
    it('logs entries with auto-generated id and timestamp', async () => {
      const store = new JsonStore<AuditEntry>({ baseDir: testDir(), fileName: 'audit.json' });
      const auditStore = createAuditStore(store);

      const entry = await auditStore.log({
        userId: 'usr_1',
        action: 'user.login',
        success: true,
      });

      expect(entry.id).toMatch(/^aud_/);
      expect(entry.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T/);
      expect(entry.success).toBe(true);
    });

    it('filters by userId', async () => {
      const store = new JsonStore<AuditEntry>({ baseDir: testDir(), fileName: 'audit.json' });
      const auditStore = createAuditStore(store);

      await auditStore.log({ userId: 'u1', action: 'user.login', success: true });
      await auditStore.log({ userId: 'u2', action: 'user.login', success: true });
      await auditStore.log({ userId: 'u1', action: 'user.logout', success: true });

      const u1Logs = await auditStore.filter({ userId: 'u1' });
      expect(u1Logs.length).toBe(2);
      expect(u1Logs.every(e => e.userId === 'u1')).toBe(true);
    });

    it('filters by action', async () => {
      const store = new JsonStore<AuditEntry>({ baseDir: testDir(), fileName: 'audit.json' });
      const auditStore = createAuditStore(store);

      await auditStore.log({ userId: 'u1', action: 'user.login', success: true });
      await auditStore.log({ userId: 'u1', action: 'auth.failed', success: false });
      await auditStore.log({ userId: 'u1', action: 'user.login', success: true });

      const logins = await auditStore.filter({ action: 'user.login' });
      expect(logins.length).toBe(2);
    });

    it('limits results', async () => {
      const store = new JsonStore<AuditEntry>({ baseDir: testDir(), fileName: 'audit.json' });
      const auditStore = createAuditStore(store);

      for (let i = 0; i < 10; i++) {
        await auditStore.log({ userId: 'u1', action: 'user.login', success: true });
      }

      const limited = await auditStore.filter({ limit: 5 });
      expect(limited.length).toBe(5);
    });

    it('filters by since', async () => {
      const store = new JsonStore<AuditEntry>({ baseDir: testDir(), fileName: 'audit.json' });
      const auditStore = createAuditStore(store);

      await auditStore.log({ userId: 'u1', action: 'user.login', success: true });
      const past = new Date(Date.now() - 60000).toISOString();
      await auditStore.log({ userId: 'u1', action: 'user.login', success: true });

      const recent = await auditStore.filter({ since: past });
      expect(recent.length).toBe(2);

      const future = new Date(Date.now() + 60000).toISOString();
      const futureOnly = await auditStore.filter({ since: future });
      expect(futureOnly.length).toBe(0);
    });
  });

  describe('JWT', () => {
    const config = { secret: 'test-secret', expiresIn: '1h' };

    it('signs and verifies token', () => {
      const payload = { sub: 'usr_1', username: 'alice', role: 'admin' as const, teams: ['x'] };
      const token = signToken(payload, config);
      const decoded = verifyToken(token, config);

      expect(decoded).toBeDefined();
      expect(decoded!.sub).toBe('usr_1');
      expect(decoded!.username).toBe('alice');
      expect(decoded!.role).toBe('admin');
      expect(decoded!.teams).toEqual(['x']);
    });

    it('returns null for invalid token', () => {
      const decoded = verifyToken('invalid.token.here', config);
      expect(decoded).toBeNull();
    });

    it('returns null for token signed with different secret', () => {
      const token = signToken({ sub: 'u', username: 'u', role: 'viewer' as const, teams: [] }, config);
      const decoded = verifyToken(token, { secret: 'different-secret', expiresIn: '1h' });
      expect(decoded).toBeNull();
    });

    it('returns null for malformed token (no required fields)', () => {
      const token = signToken({ sub: '', username: '', role: 'viewer' as const, teams: [] }, config);
      const decoded = verifyToken(token, config);
      expect(decoded).toBeNull();
    });
  });

  describe('RBAC Permissions', () => {
    it('admin has all permissions via wildcard', () => {
      expect(hasPermission('admin', 'candidate.create')).toBe(true);
      expect(hasPermission('admin', 'candidate.delete')).toBe(true);
      expect(hasPermission('admin', 'user.manage')).toBe(true);
      expect(hasPermission('admin', 'audit.view')).toBe(true);
    });

    it('manager has candidate/member/interview perms', () => {
      expect(hasPermission('manager', 'candidate.create')).toBe(true);
      expect(hasPermission('manager', 'candidate.delete')).toBe(false);
      expect(hasPermission('manager', 'member.update')).toBe(true);
      expect(hasPermission('manager', 'interview.complete')).toBe(true);
      expect(hasPermission('manager', 'user.manage')).toBe(false);
    });

    it('interviewer has read + interview perms', () => {
      expect(hasPermission('interviewer', 'interview.create')).toBe(true);
      expect(hasPermission('interviewer', 'candidate.read')).toBe(true);
      expect(hasPermission('interviewer', 'candidate.create')).toBe(false);
      expect(hasPermission('interviewer', 'member.update')).toBe(false);
    });

    it('viewer is read-only', () => {
      expect(hasPermission('viewer', 'candidate.read')).toBe(true);
      expect(hasPermission('viewer', 'candidate.create')).toBe(false);
      expect(hasPermission('viewer', 'member.update')).toBe(false);
      expect(hasPermission('viewer', 'interview.complete')).toBe(false);
    });

    it('handles unknown role gracefully', () => {
      expect(hasPermission('viewer', 'nonexistent.perm')).toBe(false);
    });

    it('handles unknown permission', () => {
      expect(hasPermission('admin', 'unknown.permission')).toBe(false);
    });
  });
});