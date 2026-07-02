// Authentication middleware
const requireAuth = (requiredRole = null) => {
    return (req, res, next) => {        
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

module.exports = {
    requireAuth
};
