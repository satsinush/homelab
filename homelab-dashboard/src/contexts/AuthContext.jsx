// src/contexts/AuthContext.jsx
import React, { createContext, useContext, useState, useEffect } from 'react';
import axios from 'axios';
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
    const [token, setToken] = useState(localStorage.getItem('auth_token'));
    const [loading, setLoading] = useState(true);

    // Configure axios default headers
    useEffect(() => {
        if (token) {
            axios.defaults.headers.common['Authorization'] = `Bearer ${token}`;
        } else {
            delete axios.defaults.headers.common['Authorization'];
        }
    }, [token]);

    // Check if user is authenticated on app load
    useEffect(() => {
        const checkAuth = async () => {
            if (token) {
                try {
                    const result = await tryApiCall('/auth/verify', {
                        method: 'POST'
                    });
                    setUser(result.data.user);
                } catch (error) {
                    console.error('Token verification failed:', error);
                    logout();
                }
            }
            setLoading(false);
        };
        checkAuth();
    }, [token]);

    const login = async (username, password) => {
        try {
            const result = await tryApiCall('/auth/login', {
                method: 'POST',
                data: {
                    username,
                    password
                }
            });

            const { token: authToken, user: userData } = result.data;

            // Store token in localStorage
            localStorage.setItem('auth_token', authToken);
            setToken(authToken);
            setUser(userData);

            return { success: true, user: userData };
        } catch (error) {
            console.error('Login failed:', error);
            return {
                success: false,
                error: error.response?.data?.error || 'Login failed'
            };
        }
    };

    const logout = async () => {
        try {
            if (token) {
                await tryApiCall('/auth/logout', {
                    method: 'POST'
                });
            }
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage and state
            localStorage.removeItem('auth_token');
            setToken(null);
            setUser(null);
            delete axios.defaults.headers.common['Authorization'];
        }
    };

    // Refresh user info
    const refreshUser = async () => {
        if (token) {
            try {
                const result = await tryApiCall('/auth/verify', {
                    method: 'POST'
                });
                setUser(result.data.user);
                return result.data.user;
            } catch (error) {
                console.error('User refresh failed:', error);
                return null;
            }
        }
        return null;
    };

    const value = {
        user,
        token,
        loading,
        login,
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
