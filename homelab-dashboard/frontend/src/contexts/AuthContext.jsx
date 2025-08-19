// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import { tryApiCall } from '../utils/api';

const AuthContext = createContext();

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};

export const AuthProvider = ({ children }) => {
    const [user, setUser] = useState(null);
    const [loading, setLoading] = useState(true);

    // Check if user is authenticated on app load
    useEffect(() => {
        const checkAuth = async () => {
            try {
                const result = await tryApiCall('/users/verify', {
                    method: 'POST'
                });
                setUser(result.data.user);
            } catch (error) {
                console.error('Authentication check failed:', error);
                setUser(null);
            }
            setLoading(false);
        };
        checkAuth();
    }, []);

    const loginLocal = async (username, password) => {
        try {
            const result = await tryApiCall('/users/login', {
                method: 'POST',
                data: {
                    username,
                    password
                }
            });

            setUser(result.data.user);
            return { success: true, user: result.data.user };
        } catch (error) {
            console.error('Local login failed:', error);
            return {
                success: false,
                error: error.message || 'Login failed'
            };
        }
    };

    const loginSSO = () => {
        // Redirect to SSO login endpoint in user controller
        window.location.href = '/api/users/sso-login';
    };

    const logout = async () => {
        try {
            const result = await tryApiCall('/users/logout', {
                method: 'POST'
            });

            // Check if this is an SSO logout that requires a redirect
            if (result.data && result.data.redirect) {
                console.log('SSO logout - redirecting to:', result.data.redirect);
                // Redirect the browser window to Authelia logout
                window.location.href = result.data.redirect;
                return; // Don't clear user state yet, let the redirect handle it
            } else {
                console.log('Local logout successful');
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // For local logout or if there's an error, clear user state
            setUser(null);
        }
    };

    // Refresh user info
    const refreshUser = async () => {
        try {
            const result = await tryApiCall('/users/verify', {
                method: 'POST'
            });
            setUser(result.data.user);
            return result.data.user;
        } catch (error) {
            console.error('User refresh failed:', error);
            setUser(null);
            return null;
        }
    };

    const value = {
        user,
        loading,
        loginLocal,
        loginSSO,
        logout,
        refreshUser,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
