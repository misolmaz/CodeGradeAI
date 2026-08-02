// @ts-nocheck
import React, { createContext, useContext, useEffect, useState } from 'react';
import { API_BASE_URL } from '../config';

interface AuthContextType {
    token: string | null;
    role: 'teacher' | 'student' | 'superadmin' | null;
    username: string | null;
    studentNumber: string | null;
    classCode: string | null;
    avatarUrl: string | null;
    userId: string | null;
    organizationName: string | null;
    email: string | null;
    sessionNonce: string;
    // True only while the bootstrap token-validation request (see AuthProvider)
    // is in flight on initial app load. Consumers should hold off rendering any
    // "authenticated" UI (or a bare Login screen) until this settles, otherwise
    // a stale/expired token in localStorage would briefly render as a valid,
    // empty session (e.g. "no assignments") before the forced logout kicks in.
    isAuthLoading: boolean;
    login: (token: string, role: string, username: string, studentNumber: string, classCode: string, avatarUrl: string | null, userId: string, organizationName: string, email?: string) => void;
    logout: () => void;

    updateAvatar: (newUrl: string) => void;
    updateName: (newName: string) => void;
}


const AuthContext = createContext<AuthContextType | null>(null);

// Generates a fresh, unique identifier for each authenticated session (login,
// logout, or tenant switch). Consumers use this as a React `key` on the main
// data-owning component so React fully unmounts/remounts it on session
// boundaries instead of reusing stale component state/closures — this is what
// prevents a late-arriving response from a PREVIOUS session (User A) from ever
// being written into the NEW session's (User B) UI.
const generateSessionNonce = (): string => {
    if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
        return crypto.randomUUID();
    }
    return `${Date.now()}-${Math.random().toString(36).slice(2)}`;
};

export const AuthProvider = ({ children }: { children: React.ReactNode }) => {
    const [token, setToken] = useState<string | null>(localStorage.getItem('token'));
    const [role, setRole] = useState<'teacher' | 'student' | 'superadmin' | null>(localStorage.getItem('role') as any);
    const [username, setUsername] = useState<string | null>(localStorage.getItem('username'));
    const [studentNumber, setStudentNumber] = useState<string | null>(localStorage.getItem('studentNumber'));
    const [classCode, setClassCode] = useState<string | null>(localStorage.getItem('classCode'));
    const [avatarUrl, setAvatarUrl] = useState<string | null>(localStorage.getItem('avatarUrl'));
    const [userId, setUserId] = useState<string | null>(localStorage.getItem('userId'));
    const [organizationName, setOrganizationName] = useState<string | null>(localStorage.getItem('organizationName'));
    const [email, setEmail] = useState<string | null>(localStorage.getItem('email'));
    // Regenerated on every login/logout/tenant-switch — see generateSessionNonce above.
    const [sessionNonce, setSessionNonce] = useState<string>(generateSessionNonce());
    // Only true when we booted up with a persisted token whose validity hasn't
    // been confirmed with the backend yet (see bootstrap verification effect).
    const [isAuthLoading, setIsAuthLoading] = useState<boolean>(() => !!localStorage.getItem('token'));

    const login = (newToken: string, newRole: string, newUsername: string, newStudentNumber: string, newClassCode: string, newAvatarUrl: string | null, newUserId: string, newOrganizationName: string, newEmail?: string) => {
        localStorage.setItem('token', newToken);
        localStorage.setItem('role', newRole);
        localStorage.setItem('username', newUsername);
        localStorage.setItem('studentNumber', newStudentNumber);
        localStorage.setItem('classCode', newClassCode);
        localStorage.setItem('userId', newUserId);
        localStorage.setItem('organizationName', newOrganizationName);
        if (newAvatarUrl) localStorage.setItem('avatarUrl', newAvatarUrl);
        else localStorage.removeItem('avatarUrl');

        if (newEmail) localStorage.setItem('email', newEmail);
        else localStorage.removeItem('email');

        setToken(newToken);
        setRole(newRole as any);
        setUsername(newUsername);
        setStudentNumber(newStudentNumber);
        setClassCode(newClassCode);
        setAvatarUrl(newAvatarUrl);
        setUserId(newUserId);
        setOrganizationName(newOrganizationName);
        setEmail(newEmail || null);
        // New session boundary: covers fresh logins AND tenant switches (which
        // also call login() with a new token/user). Any in-flight requests from
        // the previous session's component tree will be orphaned by the ensuing
        // remount and their late responses discarded.
        setSessionNonce(generateSessionNonce());
    };


    const logout = () => {
        // Wipe all browser storage so no token/user/page remnants remain
        localStorage.clear();
        sessionStorage.clear();

        setToken(null);
        setRole(null);
        setUsername(null);
        setStudentNumber(null);
        setClassCode(null);
        setAvatarUrl(null);
        setUserId(null);
        setOrganizationName(null);
        setEmail(null);
        // New session boundary on logout too, so the (now logged-out) component
        // tree is torn down and stale requests can't leak into a subsequent login.
        setSessionNonce(generateSessionNonce());
    };

    // Auth bootstrap verification: a token sitting in localStorage tells us
    // nothing about whether it's still valid — it may be expired, revoked, or
    // forged. On initial load we can't blindly trust it, so we confirm it
    // against the backend via GET /users/me. Any failure (401, other HTTP
    // error, or a network/fetch error) forces an immediate logout instead of
    // letting the rest of the app render as an authenticated-but-empty state.
    useEffect(() => {
        const bootstrapToken = localStorage.getItem('token');
        if (!bootstrapToken) {
            setIsAuthLoading(false);
            return;
        }

        let cancelled = false;

        (async () => {
            try {
                const res = await fetch(`${API_BASE_URL}/users/me`, {
                    headers: { 'Authorization': `Bearer ${bootstrapToken}` }
                });
                if (cancelled) return;
                if (!res.ok) {
                    logout();
                }
            } catch (e) {
                if (cancelled) return;
                logout();
            } finally {
                if (!cancelled) setIsAuthLoading(false);
            }
        })();

        return () => { cancelled = true; };
        // Runs once per app load — this is a bootstrap check, not something
        // that should re-run as token/session state changes during the app's
        // lifetime (login/logout already establish trust synchronously).
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);


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
        <AuthContext.Provider value={{ token, role, username, studentNumber, classCode, avatarUrl, userId, organizationName, email, sessionNonce, isAuthLoading, login, logout, updateAvatar, updateName }}>
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
