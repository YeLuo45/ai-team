// Auth middleware - JWT + RBAC

import type { Request, Response, NextFunction } from 'express';
import type { AuditStore } from '@ai-team/core';
import { hasPermission, verifyToken, type TokenPayload, type JwtConfig, type Role } from '@ai-team/core';

declare global {
  namespace Express {
    interface Request {
      auth?: TokenPayload;
      auditCtx?: { ip?: string; userAgent?: string };
    }
  }
}

export function createAuthMiddleware(config: JwtConfig) {
  return (req: Request, _res: Response, next: NextFunction) => {
    const auth = req.headers.authorization;
    if (auth?.startsWith('Bearer ')) {
      const token = auth.slice(7);
      const payload = verifyToken(token, config);
      if (payload) {
        req.auth = payload;
      }
    }
    req.auditCtx = {
      ip: req.ip || req.socket.remoteAddress,
      userAgent: typeof req.headers['user-agent'] === 'string' ? req.headers['user-agent'] : undefined,
    };
    next();
  };
}

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.auth) {
    res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
    return;
  }
  next();
}

export function requireRole(...roles: Role[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: 'unauthorized', message: 'Authentication required' });
      return;
    }
    if (!roles.includes(req.auth.role)) {
      res.status(403).json({
        error: 'forbidden',
        message: `Required role: ${roles.join(' or ')}`,
        your_role: req.auth.role,
      });
      return;
    }
    next();
  };
}

export function requirePermission(permission: string) {
  return (req: Request, res: Response, next: NextFunction) => {
    if (!req.auth) {
      res.status(401).json({ error: 'unauthorized' });
      return;
    }
    if (!hasPermission(req.auth.role, permission)) {
      res.status(403).json({
        error: 'forbidden',
        message: `Missing permission: ${permission}`,
        your_role: req.auth.role,
      });
      return;
    }
    next();
  };
}

export function createAuditMiddleware(auditStore: AuditStore) {
  return (action: string, success = true, errorMessage?: string) => {
    return (req: Request, _res: Response, next: NextFunction) => {
      const start = Date.now();
      const userId = req.auth?.sub;
      const username = req.auth?.username;
      const resourceType = req.params['type'] || req.baseUrl?.split('/').pop();
      const resourceId = req.params['id'];
      // Fire-and-forget audit log
      const auditCtx = (req as any).auditCtx as { ip?: string; userAgent?: string } | undefined;
      auditStore.log({
        userId,
        username,
        action: action as any,
        resourceType,
        resourceId,
        ip: auditCtx?.ip,
        userAgent: auditCtx?.userAgent,
        success,
        errorMessage,
        details: {
          method: req.method,
          path: req.path,
          duration_ms: Date.now() - start,
        },
      } as any).catch((err: Error) => {
        // Don't fail request if audit fails
        console.error('Audit log failed:', err);
      });
      next();
    };
  };
}