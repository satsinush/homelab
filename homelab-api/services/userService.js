const User = require('../models/User');

class UserService {
    constructor() {
        this.userModel = new User();
    }

    // Initialize default admin user
    async createDefaultUser() {
        return await this.userModel.createDefaultUser();
    }

    // Authenticate user credentials
    async authenticate(username, password) {
        // Note: Input validation handled by controller
        return await this.userModel.authenticate(username, password);
    }

    // Create JWT token
    createToken(userId) {
        return this.userModel.createToken(userId);
    }

    // Verify JWT token
    verifyToken(token) {
        return this.userModel.verifyToken(token);
    }

    // Update user profile
    async updateProfile(userId, username, currentPassword, newPassword) {
        // Note: Input validation handled by controller
        return await this.userModel.updateProfile(userId, username, currentPassword, newPassword);
    }

    // Get user by ID
    getUserById(userId) {
        return this.userModel.getUserById(userId);
    }
}

module.exports = UserService;
