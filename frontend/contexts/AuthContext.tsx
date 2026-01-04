import React, { createContext, useContext, useState, useEffect } from 'react';

interface AuthContextType {
    token: string | null;
    role: 'teacher' | 'student' | 'superadmin' | null;
    username: string | null;
    studentNumber: string | null;
    classCode: string | null;
    avatarUrl: string | null;
    userId: string | null;
    login: (token: string, role: string, username: string, studentNumber: string, classCode: string, avatarUrl: string | null, userId: string) => void;
    logout: () => void;

    updateAvatar: (newUrl: string) => void;
    updateName: (newName: string) => void;
}


const AuthContext = createContext<AuthContextType | null>(null);

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [role, setRole] = useState<'teacher' | 'student' | 'superadmin' | null>(localStorage.getItem('role') as any);
    const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
    const [studentNumber, setStudentNumber] = useState<string | null>(localStorage.getItem('studentNumber'));
    const [classCode, setClassCode] = useState<string | null>(localStorage.getItem('classCode'));
    const [avatarUrl, setAvatarUrl] = useState<string | null>(localStorage.getItem('avatarUrl'));
    const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));

    const login = (newToken: string, newRole: string, newUsername: string, newStudentNumber: string, newClassCode: string, newAvatarUrl: string | null, newUserId: string) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('role', newRole);
        localStorage.setItem('username', newUsername);
        localStorage.setItem('studentNumber', newStudentNumber);
        localStorage.setItem('classCode', newClassCode);
        localStorage.setItem('userId', newUserId);
        if (newAvatarUrl) localStorage.setItem('avatarUrl', newAvatarUrl);
        else localStorage.removeItem('avatarUrl');

        setToken(newToken);
        setRole(newRole as any);
        setUsername(newUsername);
        setStudentNumber(newStudentNumber);
        setClassCode(newClassCode);
        setAvatarUrl(newAvatarUrl);
        setUserId(newUserId);
    };


    const logout = () => {
        localStorage.clear();
        setToken(null);
        setRole(null);
        setUsername(null);
        setStudentNumber(null);
        setClassCode(null);
        setAvatarUrl(null);
        setUserId(null);
    };


    const updateAvatar = (newUrl: string) => {
        localStorage.setItem('avatarUrl', newUrl);
        setAvatarUrl(newUrl);
        // Ensure we don't lose the role
        const currentRole = localStorage.getItem('role');
        if (currentRole) setRole(currentRole as any);
    };

    const updateName = (newName: string) => {
        localStorage.setItem('username', newName);
        setUsername(newName);
        // Ensure we don't lose the role
        const currentRole = localStorage.getItem('role');
        if (currentRole) setRole(currentRole as any);
    };


    return (
        <AuthContext.Provider value={{ token, role, username, studentNumber, classCode, avatarUrl, userId, login, logout, updateAvatar, updateName }}>
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
