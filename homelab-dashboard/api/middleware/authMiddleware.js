// Authentication middleware
const requireAuth = (requiredRole = null) => {
    return (req, res, next) => {
        // Debug logging
        console.log('Session data:', req.session);
        console.log('Session ID:', req.sessionID);
        console.log('User ID in session:', req.session.userId);
        
        // Check if user is logged in via session
        if (!req.session.userId || !req.session.user) {
            console.log('No session data found - authentication required');
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const user = req.session.user;
        
        // Check role if specified
        if (requiredRole && !user.roles.includes(requiredRole)) {
            return res.status(403).json({ error: 'Insufficient permissions' });
        }
        
        req.user = user;
        next();
    };
};

module.exports = {
    requireAuth
};
