import { Request, Response, NextFunction } from 'express';

declare module 'express-session' {
    interface SessionData {
        userId: number;
        user: {
            id: number;
            username: string;
            groups: string[];
            roles: string[];
            email: string | null;
            is_sso_user: boolean;
            [key: string]: unknown;
        };
        oidc_code_verifier?: string;
        oidc_state?: string;
        oidc_id_token?: string;
    }
}

declare module 'express-serve-static-core' {
    interface Request {
        user?: {
            id: number;
            username: string;
            groups: string[];
            roles: string[];
            email: string | null;
            is_sso_user: boolean;
            [key: string]: unknown;
        };
    }
}

// Authentication middleware
export const requireAuth = (requiredRole: string | null = null) => {
    return (req: Request, res: Response, next: NextFunction) => {        
        // Check if user is logged in via session
        if (!req.session.userId || !req.session.user) {
            console.log('No session data found - authentication required');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const user = req.session.user;
        const roles = user.roles || [];
        
        // Admins bypass all role checks
        const hasAdmin = roles.includes('homelab-admin');
        
        if (requiredRole && !hasAdmin && !roles.includes(requiredRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        req.user = user;
        next();
    };
};
