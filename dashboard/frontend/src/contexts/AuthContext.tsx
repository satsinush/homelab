// src/contexts/AuthContext.tsx
import React, { useState, useEffect, ReactNode } from 'react';
import { tryApiCall } from '../utils/api';
import { AuthContext, UserProfile, AuthContextType } from './AuthContextCore';
import { VerifyResponse, LoginResponse, LogoutResponse } from '../types/api';

import { getErrorMessage } from '../utils/errors';

const SKIP_AUTO_SSO_KEY = 'homelab_skip_auto_sso';

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
                const result = await tryApiCall<VerifyResponse>('/users/verify', {
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
            const result = await tryApiCall<LoginResponse>('/users/login', {
                method: 'POST',
                data: {
                    username,
                    password
                }
            });

            const userProfile = result.data.user;
            setUser(userProfile);
            return { success: true, user: userProfile };
        } catch (error: unknown) {
            console.error('Local login failed:', error);
            return {
                success: false,
                error: getErrorMessage(error) || 'Login failed'
            };
        }
    };

    const loginSSO = () => {
        // Redirect to SSO login endpoint in user controller
        window.location.href = '/api/users/sso-login';
    };

    const logout = async (): Promise<boolean> => {
        try {
            const result = await tryApiCall<LogoutResponse>('/users/logout', {
                method: 'POST'
            });

            // Always suppress auto-SSO after an intentional logout.
            sessionStorage.setItem(SKIP_AUTO_SSO_KEY, '1');

            // SSO: leave via Authentik end-session. Don't clear user first — that
            // mounts LoginChoice and auto-SSO races the IdP logout redirect.
            if (result.data?.redirect) {
                window.location.assign(result.data.redirect);
                return true;
            }
        } catch (error) {
            console.error('Logout error:', error);
            sessionStorage.setItem(SKIP_AUTO_SSO_KEY, '1');
        }
        setUser(null);
        return false;
    };

    // Refresh user info
    const refreshUser = async (): Promise<UserProfile | null> => {
        try {
            const result = await tryApiCall<VerifyResponse>('/users/verify', {
                method: 'POST'
            });
            const userProfile = result.data.user;
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
