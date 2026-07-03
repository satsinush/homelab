// src/contexts/AuthContext.tsx
import React, { useState, useEffect, ReactNode } from 'react';
import { tryApiCall } from '../utils/api';
import { AuthContext, UserProfile, AuthContextType } from './AuthContextCore';

interface AuthProviderProps {
    children: ReactNode;
}

export const AuthProvider = ({ children }: AuthProviderProps) => {
    const [user, setUser] = useState<UserProfile | null>(null);
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

    const loginLocal = async (username: string, password: string) => {
        try {
            const result = await tryApiCall('/users/login', {
                method: 'POST',
                data: {
                    username,
                    password
                }
            });

            const userProfile = result.data.user as UserProfile;
            setUser(userProfile);
            return { success: true, user: userProfile };
        } catch (error: unknown) {
            console.error('Local login failed:', error);
            const err = error as Error;
            return {
                success: false,
                error: err.message || 'Login failed'
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
                // Redirect the browser window to Authentik logout
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
    const refreshUser = async (): Promise<UserProfile | null> => {
        try {
            const result = await tryApiCall('/users/verify', {
                method: 'POST'
            });
            const userProfile = result.data.user as UserProfile;
            setUser(userProfile);
            return userProfile;
        } catch (error) {
            console.error('User refresh failed:', error);
            setUser(null);
            return null;
        }
    };

    const hasPermission = (role: string): boolean => {
        if (!user || !user.roles) return false;
        const roles = user.roles;
        if (roles.includes('homelab-admin')) return true;
        return roles.includes(role);
    };

    const value: AuthContextType = {
        user,
        loading,
        loginLocal,
        loginSSO,
        logout,
        refreshUser,
        hasPermission,
        isAuthenticated: !!user
    };

    return (
        <AuthContext.Provider value={value}>
            {children}
        </AuthContext.Provider>
    );
};
