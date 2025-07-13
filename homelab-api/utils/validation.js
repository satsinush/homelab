// Validation utilities
class ValidationUtils {
    // Validate and normalize MAC address
    static validateAndNormalizeMac(mac) {
        if (!mac) {
            throw new Error('MAC address is required');
        }
        
        if (typeof mac !== 'string') {
            throw new Error('MAC address must be a string');
        }
        
        // Remove all non-hex characters
        const macClean = mac.replace(/[^a-fA-F0-9]/g, '');
        
        if (macClean.length !== 12) {
            throw new Error('Invalid MAC address format. Expected 12 hex characters (e.g., 00:11:22:33:44:55)');
        }
        
        // Return normalized format (lowercase, no separators)
        return macClean.toLowerCase();
    }
    
    // Validate device name
    static validateDeviceName(name) {
        if (!name) {
            throw new Error('Device name is required');
        }
        
        if (typeof name !== 'string') {
            throw new Error('Device name must be a string');
        }
        
        const trimmed = name.trim();
        if (trimmed.length === 0) {
            throw new Error('Device name cannot be empty');
        }
        
        if (trimmed.length > 100) {
            throw new Error('Device name cannot exceed 100 characters');
        }
        
        return trimmed;
    }
    
    // Validate device description
    static validateDeviceDescription(description) {
        if (description === null || description === undefined) {
            return '';
        }
        
        if (typeof description !== 'string') {
            throw new Error('Device description must be a string');
        }
        
        const trimmed = description.trim();
        
        if (trimmed.length > 500) {
            throw new Error('Device description cannot exceed 500 characters');
        }
        
        return trimmed;
    }
    
    // Validate username
    static validateUsername(username) {
        if (!username) {
            throw new Error('Username is required');
        }
        
        if (typeof username !== 'string') {
            throw new Error('Username must be a string');
        }
        
        const trimmed = username.trim();
        
        if (trimmed.length < 3) {
            throw new Error('Username must be at least 3 characters long');
        }
        
        if (trimmed.length > 50) {
            throw new Error('Username cannot exceed 50 characters');
        }
        
        // Check for valid characters (alphanumeric, underscore, hyphen)
        if (!/^[a-zA-Z0-9_-]+$/.test(trimmed)) {
            throw new Error('Username can only contain letters, numbers, underscores, and hyphens');
        }
        
        return trimmed;
    }
    
    // Validate password
    static validatePassword(password) {
        if (!password) {
            throw new Error('Password is required');
        }
        
        if (typeof password !== 'string') {
            throw new Error('Password must be a string');
        }
        
        if (password.length < 6) {
            throw new Error('Password must be at least 6 characters long');
        }
        
        if (password.length > 128) {
            throw new Error('Password cannot exceed 128 characters');
        }
        
        return password;
    }
    
    // Validate login credentials
    static validateLoginCredentials(username, password) {
        if (!username) {
            throw new Error('Username is required');
        }
        
        if (!password) {
            throw new Error('Password is required');
        }
        
        if (typeof username !== 'string' || typeof password !== 'string') {
            throw new Error('Username and password must be strings');
        }
        
        const trimmedUsername = username.trim();
        
        if (trimmedUsername.length === 0) {
            throw new Error('Username cannot be empty');
        }
        
        if (password.length === 0) {
            throw new Error('Password cannot be empty');
        }
        
        return { username: trimmedUsername, password };
    }
}

module.exports = ValidationUtils;
