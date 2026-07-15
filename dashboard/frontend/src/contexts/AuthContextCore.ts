import { createContext } from 'react';

export interface UserProfile {
    id: number;
    username: string;
    email?: string;
    roles: string[];
    groups: string[];
    is_sso_user: boolean;
}

export interface AuthContextType {
    user: UserProfile | null;
    loading: boolean;
    loginLocal: (username: string, password: string) => Promise<{ success: boolean; user?: UserProfile; error?: string }>;
    loginSSO: () => void;
    logout: () => Promise<boolean>;
    refreshUser: () => Promise<UserProfile | null>;
    hasPermission: (role: string) => boolean;
    isAuthenticated: boolean;
}

export const AuthContext = createContext<AuthContextType | null>(null);
