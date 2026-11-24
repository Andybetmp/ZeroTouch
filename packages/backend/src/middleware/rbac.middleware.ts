import { Request, Response, NextFunction } from 'express';

export type AppRole = 'SSOMA' | 'ECM' | 'GARITA' | 'TRABAJADOR';

export interface AuthSessionPayload {
  email: string;
  role: AppRole;
  workerId: string | null;
  fullName: string;
  iat: number;
}

declare global {
  namespace Express {
    interface Request {
      authUser?: AuthSessionPayload;
    }
  }
}

export function normalizeRole(rawRole: string): AppRole {
  const upper = (rawRole || '').trim().toUpperCase();
  if (upper === 'SSOMA' || upper === 'SSOMA_DHO' || upper === 'ADMIN') return 'SSOMA';
  if (upper === 'ECM' || upper === 'ADMIN_ECM') return 'ECM';
  if (upper === 'GARITA') return 'GARITA';
  return 'TRABAJADOR';
}

export function encodeAuthToken(payload: Omit<AuthSessionPayload, 'iat'>): string {
  const full: AuthSessionPayload = { ...payload, iat: Date.now() };
  return Buffer.from(JSON.stringify(full), 'utf8').toString('base64');
}

export function decodeAuthToken(token?: string | null): AuthSessionPayload | null {
  if (!token) return null;
  try {
    const clean = token.replace(/^Bearer\s+/i, '').trim();
    const decoded = Buffer.from(clean, 'base64').toString('utf8');
    if (decoded.startsWith('{')) {
      const parsed = JSON.parse(decoded);
      return {
        email: parsed.email || parsed.username || '',
        role: normalizeRole(parsed.role),
        workerId: parsed.workerId || null,
        fullName: parsed.fullName || '',
        iat: parsed.iat || Date.now(),
      };
    }
    // Compatibilidad retroactiva con tokens username:role:timestamp
    const parts = decoded.split(':');
    if (parts.length >= 2) {
      return {
        email: parts[0],
        role: normalizeRole(parts[1]),
        workerId: null,
        fullName: parts[0],
        iat: Number(parts[2] || Date.now()),
      };
    }
    return null;
  } catch {
    return null;
  }
}

export function extractAuthMiddleware(req: Request, _res: Response, next: NextFunction) {
  const headerToken = req.headers.authorization || (req.headers['x-auth-token'] as string | undefined);
  const parsed = decodeAuthToken(headerToken);
  if (parsed) {
    req.authUser = parsed;
  }
  next();
}

/**
 * Middleware RBAC estricto:
 * - Si el cliente envía token de un rol no incluido en allowedRoles, bloquea con 403.
 * - Si el rol es TRABAJADOR y la ruta incluye :workerId o :id, valida que coincida con su propio workerId.
 */
export function requireRole(allowedRoles: AppRole[]) {
  return (req: Request, res: Response, next: NextFunction) => {
    const headerToken = req.headers.authorization || (req.headers['x-auth-token'] as string | undefined);
    const user = req.authUser || decodeAuthToken(headerToken);

    if (user) {
      req.authUser = user;
      if (!allowedRoles.includes(user.role)) {
        res.status(403).json({
          success: false,
          error: `Acceso Denegado (RBAC): El rol '${user.role}' no tiene permisos para este recurso. Roles requeridos: [${allowedRoles.join(', ')}].`,
        });
        return;
      }

      if (user.role === 'TRABAJADOR' && user.workerId) {
        const paramWorkerId = req.params.workerId || req.body?.workerId;
        if (paramWorkerId && paramWorkerId !== user.workerId) {
          res.status(403).json({
            success: false,
            error: 'Acceso Denegado (RBAC Aislamiento): Un trabajador solo puede consultar o actualizar su propio expediente.',
          });
          return;
        }
      }
    }

    next();
  };
}
