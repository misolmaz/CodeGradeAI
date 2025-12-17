import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    token: string | null;
    role: 'teacher' | 'student' | null;
    username: string | null;
    login: (token: string, role: string, username: string) => void;
    logout: () => void;
}

const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [role, setRole] = useState<'teacher' | 'student' | null>(localStorage.getItem('role') as any);
    const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));

    const login = (newToken: string, newRole: string, newUsername: string) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('role', newRole);
        localStorage.setItem('username', newUsername);
        setToken(newToken);
        setRole(newRole as any);
        setUsername(newUsername);
    };

    const logout = () => {
        localStorage.removeItem('token');
        localStorage.removeItem('role');
        localStorage.removeItem('username');
        setToken(null);
        setRole(null);
        setUsername(null);
    };

    return (
        <AuthContext.Provider value={{ token, role, username, login, logout }}>
            {children}
        </AuthContext.Provider>
    );
};

export const useAuth = () => {
    const context = useContext(AuthContext);
    if (!context) {
        throw new Error('useAuth must be used within an AuthProvider');
    }
    return context;
};
