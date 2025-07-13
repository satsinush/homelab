const User = require('../models/User');

const userModel = new User();

// Authentication middleware
const requireAuth = (requiredRole = null) => {
    return (req, res, next) => {
        const token = req.headers.authorization?.replace('Bearer ', '') || req.session.token;
        
        if (!token) {
            return res.status(401).json({ error: 'Authentication required' });
        }
        
        const user = userModel.verifyToken(token);
        
        if (!user) {
            return res.status(401).json({ error: 'Invalid or expired token' });
        }
        
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
