// V20: Auth routes - register, login, me, refresh

import type { Router, Request, Response } from 'express';
import { Router as createRouter } from 'express';
import bcrypt from 'bcryptjs';
import type { UserStore, AuditStore } from '@ai-team/core';
import { signToken, type JwtConfig, type Role } from '@ai-team/core';

export interface AuthDeps {
  userStore: UserStore;
  auditStore: AuditStore;
  jwtConfig: JwtConfig;
}

export function createAuthRouter(deps: AuthDeps): Router {
  const router = createRouter();

  // POST /api/auth/register - register new user
  router.post('/register', async (req: Request, res: Response) => {
    const { email, username, password, role } = req.body || {};

    if (!email || !username || !password) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'email, username, and password are required',
      });
    }

    if (password.length < 6) {
      return res.status(400).json({
        error: 'weak_password',
        message: 'Password must be at least 6 characters',
      });
    }

    const existing = await deps.userStore.getByEmail(email);
    if (existing) {
      await deps.auditStore.log({
        action: 'user.register',
        success: false,
        errorMessage: 'Email already in use',
        details: { email },
        ip: req.auditCtx?.ip,
        userAgent: req.auditCtx?.userAgent,
      });
      return res.status(409).json({
        error: 'email_exists',
        message: 'Email already in use',
      });
    }

    const existingUsername = await deps.userStore.getByUsername(username);
    if (existingUsername) {
      return res.status(409).json({
        error: 'username_exists',
        message: 'Username already taken',
      });
    }

    try {
      const user = await deps.userStore.create({
        email,
        username,
        password,
        role: (role as Role) || 'viewer',
        teams: req.body.teams || [],
      });

      await deps.auditStore.log({
        userId: user.id,
        username: user.username,
        action: 'user.register',
        resourceType: 'user',
        resourceId: user.id,
        success: true,
        details: { role: user.role },
        ip: req.auditCtx?.ip,
        userAgent: req.auditCtx?.userAgent,
      });

      const token = signToken(
        { sub: user.id, username: user.username, role: user.role, teams: user.teams },
        deps.jwtConfig
      );

      return res.status(201).json({
        token,
        user: sanitizeUser(user),
      });
    } catch (err: any) {
      return res.status(500).json({
        error: 'server_error',
        message: err.message,
      });
    }
  });

  // POST /api/auth/login - login
  router.post('/login', async (req: Request, res: Response) => {
    const { email, password } = req.body || {};

    if (!email || !password) {
      return res.status(400).json({
        error: 'validation_error',
        message: 'email and password are required',
      });
    }

    const user = await deps.userStore.getByEmail(email);
    if (!user || user.disabled) {
      await deps.auditStore.log({
        action: 'auth.failed',
        success: false,
        errorMessage: 'User not found or disabled',
        details: { email },
        ip: req.auditCtx?.ip,
        userAgent: req.auditCtx?.userAgent,
      });
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password',
      });
    }

    const valid = await bcrypt.compare(password, user.passwordHash);
    if (!valid) {
      await deps.auditStore.log({
        userId: user.id,
        username: user.username,
        action: 'auth.failed',
        success: false,
        errorMessage: 'Wrong password',
        ip: req.auditCtx?.ip,
        userAgent: req.auditCtx?.userAgent,
      });
      return res.status(401).json({
        error: 'invalid_credentials',
        message: 'Invalid email or password',
      });
    }

    // Update last login and re-fetch for response
    const updatedUser = await deps.userStore.update(user.id, { lastLoginAt: new Date().toISOString() });
    const finalUser = updatedUser || user;

    await deps.auditStore.log({
      userId: user.id,
      username: user.username,
      action: 'user.login',
      success: true,
      ip: req.auditCtx?.ip,
      userAgent: req.auditCtx?.userAgent,
    });

    const token = signToken(
      { sub: user.id, username: user.username, role: user.role, teams: user.teams },
      deps.jwtConfig
    );

    return res.json({
      token,
      user: sanitizeUser(finalUser),
    });
  });

  // GET /api/auth/me - current user info
  router.get('/me', (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({
        error: 'unauthorized',
        message: 'Authentication required',
      });
    }
    return res.json({
      user: {
        id: req.auth.sub,
        username: req.auth.username,
        role: req.auth.role,
        teams: req.auth.teams,
      },
    });
  });

  // POST /api/auth/logout
  router.post('/logout', async (req: Request, res: Response) => {
    if (req.auth) {
      await deps.auditStore.log({
        userId: req.auth.sub,
        username: req.auth.username,
        action: 'user.logout',
        success: true,
        ip: req.auditCtx?.ip,
        userAgent: req.auditCtx?.userAgent,
      });
    }
    return res.json({ ok: true });
  });

  // GET /api/users - list users (admin only)
  router.get('/users', async (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden', message: 'Admin only' });
    }
    const users = await deps.userStore.list();
    return res.json({ users: users.map(sanitizeUser) });
  });

  // GET /api/audit - list audit log (admin only)
  router.get('/audit', async (req: Request, res: Response) => {
    if (!req.auth) {
      return res.status(401).json({ error: 'unauthorized' });
    }
    if (req.auth.role !== 'admin') {
      return res.status(403).json({ error: 'forbidden', message: 'Admin only' });
    }
    const limit = parseInt(req.query.limit as string) || 100;
    const action = req.query.action as string | undefined;
    const userId = req.query.userId as string | undefined;
    const since = req.query.since as string | undefined;
    const entries = await deps.auditStore.filter({ limit, action, userId, since });
    return res.json({ entries });
  });

  return router;
}

function sanitizeUser(user: any) {
  const { passwordHash, ...rest } = user;
  return rest;
}