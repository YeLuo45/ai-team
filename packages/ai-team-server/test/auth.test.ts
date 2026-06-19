// V20: Auth routes integration tests

import { describe, it, expect, beforeEach, afterAll } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import express from 'express';
import bcrypt from 'bcryptjs';
import {
  createUserStore,
  createAuditStore,
  signToken,
  JsonStore,
} from '../../ai-team-core/src/index.js';
import type { User, AuditEntry, JwtConfig } from '../../ai-team-core/src/index.js';
import { createAuthRouter } from '../src/routes/auth.js';
import { createAuthMiddleware } from '../src/middleware/auth.js';

const testDir = () => `/tmp/ai-team-auth-test-${randomUUID()}`;
const jwtConfig: JwtConfig = { secret: 'test-jwt-secret', expiresIn: '1h' };

async function setupApp() {
  const dir = testDir();
  const userStore_ = new JsonStore<User>({ baseDir: dir, fileName: 'users.json' });
  const auditStore_ = new JsonStore<AuditEntry>({ baseDir: dir, fileName: 'audit.json' });
  const userStore = createUserStore(userStore_);
  const auditStore = createAuditStore(auditStore_);

  const app = express();
  app.use(express.json());
  app.use(createAuthMiddleware(jwtConfig));
  app.use('/api/auth', createAuthRouter({ userStore, auditStore, jwtConfig }));

  return { app, userStore, auditStore };
}

describe('V20: Auth Routes', () => {
  describe('POST /api/auth/register', () => {
    it('registers a new user and returns token', async () => {
      const { app } = await setupApp();
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          email: 'alice@test.com',
          username: 'alice',
          password: 'secret123',
          role: 'manager',
          teams: ['alpha'],
        });

      expect(res.status).toBe(201);
      expect(res.body.token).toMatch(/^eyJ/);
      expect(res.body.user.email).toBe('alice@test.com');
      expect(res.body.user.username).toBe('alice');
      expect(res.body.user.role).toBe('manager');
      expect(res.body.user.teams).toEqual(['alpha']);
      expect(res.body.user.passwordHash).toBeUndefined();
    });

    it('rejects duplicate email', async () => {
      const { app } = await setupApp();
      await request(app).post('/api/auth/register').send({
        email: 'dup@test.com', username: 'dup', password: 'pass123', role: 'viewer',
      });
      const res = await request(app).post('/api/auth/register').send({
        email: 'dup@test.com', username: 'dup2', password: 'pass123', role: 'viewer',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('email_exists');
    });

    it('rejects duplicate username', async () => {
      const { app } = await setupApp();
      await request(app).post('/api/auth/register').send({
        email: 'a@x.com', username: 'samename', password: 'pass123', role: 'viewer',
      });
      const res = await request(app).post('/api/auth/register').send({
        email: 'b@x.com', username: 'samename', password: 'pass123', role: 'viewer',
      });
      expect(res.status).toBe(409);
      expect(res.body.error).toBe('username_exists');
    });

    it('rejects weak password (< 6 chars)', async () => {
      const { app } = await setupApp();
      const res = await request(app).post('/api/auth/register').send({
        email: 'weak@x.com', username: 'weak', password: '123', role: 'viewer',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('weak_password');
    });

    it('rejects missing fields', async () => {
      const { app } = await setupApp();
      const res = await request(app).post('/api/auth/register').send({
        email: 'only@x.com',
      });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('validation_error');
    });

    it('defaults role to viewer if not provided', async () => {
      const { app } = await setupApp();
      const res = await request(app).post('/api/auth/register').send({
        email: 'norole@x.com', username: 'norole', password: 'pass123',
      });
      expect(res.status).toBe(201);
      expect(res.body.user.role).toBe('viewer');
    });

    it('hashes password (not stored plain)', async () => {
      const { app, userStore } = await setupApp();
      await request(app).post('/api/auth/register').send({
        email: 'hash@x.com', username: 'h', password: 'plaintext123', role: 'viewer',
      });
      const user = await userStore.getByEmail('hash@x.com');
      expect(user!.passwordHash).not.toBe('plaintext123');
      const matches = await bcrypt.compare('plaintext123', user!.passwordHash);
      expect(matches).toBe(true);
    });
  });

  describe('POST /api/auth/login', () => {
    let app: any;
    beforeEach(async () => {
      const setup = await setupApp();
      app = setup.app;
      await request(app).post('/api/auth/register').send({
        email: 'login@x.com', username: 'loginuser', password: 'correct', role: 'admin',
      });
    });

    it('returns token on correct credentials', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@x.com', password: 'correct',
      });
      expect(res.status).toBe(200);
      expect(res.body.token).toMatch(/^eyJ/);
      expect(res.body.user.email).toBe('login@x.com');
    });

    it('rejects wrong password', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@x.com', password: 'wrong',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('invalid_credentials');
    });

    it('rejects unknown email', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'nobody@x.com', password: 'anything',
      });
      expect(res.status).toBe(401);
      expect(res.body.error).toBe('invalid_credentials');
    });

    it('rejects missing fields', async () => {
      const res = await request(app).post('/api/auth/login').send({});
      expect(res.status).toBe(400);
    });

    it('updates lastLoginAt timestamp', async () => {
      const res = await request(app).post('/api/auth/login').send({
        email: 'login@x.com', password: 'correct',
      });
      expect(res.status).toBe(200);
      expect(res.body.user.lastLoginAt).toBeDefined();
    });

    it('logs failed attempt to audit', async () => {
      const { app, auditStore } = await setupApp();
      const auditBefore = (await auditStore.filter({ action: 'auth.failed' })).length;
      await request(app).post('/api/auth/login').send({
        email: 'login@x.com', password: 'wrong',
      });
      const auditAfter = (await auditStore.filter({ action: 'auth.failed' })).length;
      expect(auditAfter).toBe(auditBefore + 1);
    });
  });

  describe('GET /api/auth/me', () => {
    it('returns user info with valid token', async () => {
      const { app } = await setupApp();
      const reg = await request(app).post('/api/auth/register').send({
        email: 'me@x.com', username: 'me', password: 'pass123', role: 'manager', teams: ['t1'],
      });
      const token = reg.body.token;

      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${token}`);

      expect(res.status).toBe(200);
      expect(res.body.user.id).toMatch(/^usr_/);
      expect(res.body.user.username).toBe('me');
      expect(res.body.user.role).toBe('manager');
      expect(res.body.user.teams).toEqual(['t1']);
    });

    it('returns 401 without token', async () => {
      const { app } = await setupApp();
      const res = await request(app).get('/api/auth/me');
      expect(res.status).toBe(401);
    });

    it('returns 401 with invalid token', async () => {
      const { app } = await setupApp();
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid.token.here');
      expect(res.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    it('succeeds with valid token', async () => {
      const { app } = await setupApp();
      const reg = await request(app).post('/api/auth/register').send({
        email: 'lo@x.com', username: 'lo', password: 'pass123', role: 'viewer',
      });
      const res = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${reg.body.token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });

    it('succeeds without token (idempotent)', async () => {
      const { app } = await setupApp();
      const res = await request(app).post('/api/auth/logout');
      expect(res.status).toBe(200);
    });
  });

  describe('GET /api/auth/users (admin only)', () => {
    it('admin can list all users', async () => {
      const { app } = await setupApp();
      const adminReg = await request(app).post('/api/auth/register').send({
        email: 'admin@x.com', username: 'admin', password: 'pass123', role: 'admin',
      });
      await request(app).post('/api/auth/register').send({
        email: 'user@x.com', username: 'user', password: 'pass123', role: 'viewer',
      });

      const res = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${adminReg.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.users.length).toBe(2);
    });

    it('non-admin gets 403', async () => {
      const { app } = await setupApp();
      const userReg = await request(app).post('/api/auth/register').send({
        email: 'viewer@x.com', username: 'viewer', password: 'pass123', role: 'viewer',
      });

      const res = await request(app)
        .get('/api/auth/users')
        .set('Authorization', `Bearer ${userReg.body.token}`);

      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      const { app } = await setupApp();
      const res = await request(app).get('/api/auth/users');
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/auth/audit (admin only)', () => {
    it('admin can list audit log', async () => {
      const { app } = await setupApp();
      const adminReg = await request(app).post('/api/auth/register').send({
        email: 'audit-admin@x.com', username: 'aa', password: 'pass123', role: 'admin',
      });
      await request(app).post('/api/auth/login').send({
        email: 'audit-admin@x.com', password: 'pass123',
      });

      const res = await request(app)
        .get('/api/auth/audit?limit=10')
        .set('Authorization', `Bearer ${adminReg.body.token}`);

      expect(res.status).toBe(200);
      expect(res.body.entries.length).toBeGreaterThan(0);
    });

    it('non-admin gets 403', async () => {
      const { app } = await setupApp();
      const userReg = await request(app).post('/api/auth/register').send({
        email: 'nona@x.com', username: 'nona', password: 'pass123', role: 'viewer',
      });

      const res = await request(app)
        .get('/api/auth/audit')
        .set('Authorization', `Bearer ${userReg.body.token}`);

      expect(res.status).toBe(403);
    });
  });
});