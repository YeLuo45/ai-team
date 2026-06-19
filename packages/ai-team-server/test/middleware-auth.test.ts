// V20: Auth middleware tests

import { describe, it, expect, vi } from 'vitest';
import { randomUUID } from 'node:crypto';
import request from 'supertest';
import express from 'express';
import { signToken, JsonStore } from '../../ai-team-core/src/index.js';
import type { User, AuditEntry, JwtConfig } from '../../ai-team-core/src/index.js';
import {
  createAuthMiddleware,
  createAuditMiddleware,
  requireAuth,
  requirePermission,
  requireRole,
} from '../src/middleware/auth.js';

const testDir = () => `/tmp/ai-team-mw-test-${randomUUID()}`;
const jwtConfig: JwtConfig = { secret: 'mw-secret', expiresIn: '1h' };

function makeToken(payload: any, override?: JwtConfig) {
  return signToken(payload, override || jwtConfig);
}

describe('V20: Auth Middleware', () => {
  describe('createAuthMiddleware', () => {
    it('extracts JWT from Authorization header', async () => {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/test', (req: any, res) => {
        res.json({ user: req.auth });
      });

      const token = makeToken({ sub: 'u1', username: 'alice', role: 'admin', teams: ['x'] });
      const res = await request(app).get('/test').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.user.sub).toBe('u1');
    });

    it('continues without auth when no token', async () => {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/test', (req: any, res) => {
        res.json({ user: req.auth });
      });

      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeUndefined();
    });

    it('continues without auth on invalid token', async () => {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/test', (req: any, res) => {
        res.json({ user: req.auth });
      });

      const res = await request(app).get('/test').set('Authorization', 'Bearer bad.token');
      expect(res.status).toBe(200);
      expect(res.body.user).toBeUndefined();
    });

    it('attaches audit context (ip + userAgent)', async () => {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/test', (req: any, res) => {
        res.json({ audit: req.auditCtx });
      });

      const res = await request(app).get('/test').set('User-Agent', 'test-agent');
      expect(res.status).toBe(200);
      expect(res.body.audit.userAgent).toBe('test-agent');
    });

    it('handles missing userAgent header', async () => {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/test', (req: any, res) => {
        res.json({ audit: req.auditCtx });
      });

      const res = await request(app).get('/test');
      expect(res.status).toBe(200);
    });
  });

  describe('requireAuth', () => {
    it('returns 401 without auth', async () => {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/protected');
      expect(res.status).toBe(401);
    });

    it('passes with valid token', async () => {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/protected', requireAuth, (_req, res) => res.json({ ok: true }));

      const token = makeToken({ sub: 'u1', username: 'u', role: 'admin', teams: [] });
      const res = await request(app).get('/protected').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
      expect(res.body.ok).toBe(true);
    });
  });

  describe('requireRole', () => {
    function makeApp() {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.get('/admin', requireRole('admin'), (_req, res) => res.json({ ok: true }));
      app.get('/manager-or-admin', requireRole('admin', 'manager'), (_req, res) => res.json({ ok: true }));
      return app;
    }

    it('admin passes admin-only', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'a', role: 'admin', teams: [] });
      const res = await request(app).get('/admin').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('viewer fails admin-only', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'v', role: 'viewer', teams: [] });
      const res = await request(app).get('/admin').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('manager passes manager-or-admin', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'm', role: 'manager', teams: [] });
      const res = await request(app).get('/manager-or-admin').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('interviewer fails manager-or-admin', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'i', role: 'interviewer', teams: [] });
      const res = await request(app).get('/manager-or-admin').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      const app = makeApp();
      const res = await request(app).get('/admin');
      expect(res.status).toBe(401);
    });
  });

  describe('requirePermission', () => {
    function makeApp() {
      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.post('/candidates', requirePermission('candidate.create'), (_req, res) => res.json({ ok: true }));
      app.delete('/candidates/:id', requirePermission('candidate.delete'), (_req, res) => res.json({ ok: true }));
      return app;
    }

    it('admin passes candidate.create (via wildcard)', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'a', role: 'admin', teams: [] });
      const res = await request(app).post('/candidates').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('manager passes candidate.create', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'm', role: 'manager', teams: [] });
      const res = await request(app).post('/candidates').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('viewer fails candidate.create', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'v', role: 'viewer', teams: [] });
      const res = await request(app).post('/candidates').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('admin passes candidate.delete (wildcard)', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'a', role: 'admin', teams: [] });
      const res = await request(app).delete('/candidates/c1').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(200);
    });

    it('manager fails candidate.delete (no wildcard)', async () => {
      const app = makeApp();
      const token = makeToken({ sub: 'u', username: 'm', role: 'manager', teams: [] });
      const res = await request(app).delete('/candidates/c1').set('Authorization', `Bearer ${token}`);
      expect(res.status).toBe(403);
    });

    it('returns 401 without token', async () => {
      const app = makeApp();
      const res = await request(app).post('/candidates');
      expect(res.status).toBe(401);
    });
  });

  describe('createAuditMiddleware', () => {
    it('logs audit entry on request', async () => {
      const dir = testDir();
      const store = new JsonStore<AuditEntry>({ baseDir: dir, fileName: 'audit.json' });
      const auditStore = {
        list: () => store.list(),
        filter: (opts: any) => store.list().then(e => e.filter((x: any) =>
          (!opts.userId || x.userId === opts.userId) &&
          (!opts.action || x.action === opts.action)
        )),
        log: async (entry: any) => {
          const log = { id: `aud_${Date.now()}_${Math.random()}`, timestamp: new Date().toISOString(), ...entry };
          await store.add(log);
          return log;
        },
      };

      const auditLogger = createAuditMiddleware(auditStore);

      const app = express();
      app.use(createAuthMiddleware(jwtConfig));
      app.use(auditLogger('user.test', true));
      app.get('/x', (_req, res) => res.json({ ok: true }));

      const token = makeToken({ sub: 'u1', username: 'alice', role: 'admin', teams: [] });
      await request(app).get('/x').set('Authorization', `Bearer ${token}`);

      // Wait for fire-and-forget log
      await new Promise(r => setTimeout(r, 100));

      const entries = await auditStore.filter({ action: 'user.test' });
      expect(entries.length).toBe(1);
      expect(entries[0].userId).toBe('u1');
      expect(entries[0].username).toBe('alice');
    });

    it('handles audit log failure gracefully', async () => {
      const failAuditStore = {
        list: async () => [],
        filter: async () => [],
        log: async () => { throw new Error('audit down'); },
      };
      const auditLogger = createAuditMiddleware(failAuditStore);
      const consoleSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

      const app = express();
      app.use(auditLogger('user.test', true));
      app.get('/x', (_req, res) => res.json({ ok: true }));

      const res = await request(app).get('/x');
      expect(res.status).toBe(200);
      expect(consoleSpy).toHaveBeenCalled();
      consoleSpy.mockRestore();
    });
  });
});