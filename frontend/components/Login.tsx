import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import { FileCode, Loader2, Lock, User as UserIcon } from 'lucide-react';
import { API_BASE_URL } from '../config';


export const Login = () => {
    const { login } = useAuth();
    const [username, setUsername] = useState('');
    const [password, setPassword] = useState('');
    const [isLoading, setIsLoading] = useState(false);
    const [error, setError] = useState('');

    // Ambiguity States
    const [showOrgModal, setShowOrgModal] = useState(false);
    const [orgCandidates, setOrgCandidates] = useState<any[]>([]);

    const handleOrgSelect = async (orgId: number) => {
        setIsLoading(true);
        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);
            formData.append('organization_id', orgId.toString());

            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                body: formData,
            });

            if (!response.ok) {
                const errData = await response.json();
                throw new Error(errData.detail || 'Giriş başarısız.');
            }

            const data = await response.json();
            login(
                data.access_token,
                data.role,
                data.username,
                data.student_number,
                data.class_code,
                data.avatar_url,
                data.user_id.toString(),
                data.organization_name
            );
        } catch (err: any) {
            setError(err.message);
            setShowOrgModal(false);
        } finally {
            setIsLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);
        setError('');

        try {
            const formData = new URLSearchParams();
            formData.append('username', username);
            formData.append('password', password);

            const response = await fetch(`${API_BASE_URL}/token`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: formData,
            });

            const data = await response.json();

            // Handle Ambiguity (Multiple Organizations)
            if (response.status === 409) {
                setOrgCandidates(data.organizations);
                setShowOrgModal(true);
                return;
            }

            if (!response.ok) {
                throw new Error(data.detail || 'Giriş başarısız. Kullanıcı adı veya şifre hatalı.');
            }

            login(
                data.access_token,
                data.role,
                data.username,
                data.student_number,
                data.class_code,
                data.avatar_url,
                data.user_id.toString(),
                data.organization_name
            );

        } catch (err: any) {
            setError(err.message);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-dark-800 rounded-2xl border border-dark-700 p-8 shadow-2xl">
                <div className="text-center mb-8">
                    <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary">
                        <FileCode size={32} />
                    </div>
                    <h1 className="text-3xl font-bold text-white mb-2">CodeGrade AI</h1>
                    <p className="text-slate-400">Akıllı Kod Değerlendirme Sistemi</p>
                </div>

                {error && (
                    <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-4 text-sm font-medium">
                        {error}
                    </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-4">
                    <div>
                        <label className="block text-sm text-slate-400 mb-1 ml-1">Öğrenci/Kullanıcı No</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="text"
                                required
                                className="w-full bg-dark-900 border border-dark-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="Örn: 20231001"
                                value={username}
                                onChange={(e) => setUsername(e.target.value)}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm text-slate-400 mb-1 ml-1">Şifre</label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                            <input
                                type="password"
                                required
                                className="w-full bg-dark-900 border border-dark-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all"
                                placeholder="••••••••"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                            />
                        </div>
                    </div>

                    <button
                        type="submit"
                        disabled={isLoading}
                        className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
                    >
                        {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Giriş Yap'}
                    </button>
                </form>

                <p className="text-center text-xs text-slate-500 mt-6">
                    Varsayılan şifreniz öğrenci numaranızdır.
                </p>
            </div>

            {/* Organization Selection Modal */}
            {showOrgModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-300">
                    <div className="bg-dark-800 w-full max-w-md rounded-2xl border border-dark-700 shadow-2xl overflow-hidden animate-in zoom-in duration-300">
                        <div className="p-6 border-b border-dark-700 bg-dark-700/50">
                            <h3 className="text-xl font-bold text-white mb-1">Sınıf Seçimi</h3>
                            <p className="text-slate-400 text-sm">Devam etmek için giriş yapmak istediğiniz dersi seçin.</p>
                        </div>
                        <div className="p-4 max-h-[60vh] overflow-y-auto space-y-3">
                            {orgCandidates.map((org) => (
                                <button
                                    key={org.id}
                                    onClick={() => handleOrgSelect(org.id)}
                                    className="w-full text-left p-4 rounded-xl bg-dark-900 border border-dark-700 hover:border-primary/50 hover:bg-primary/5 group transition-all"
                                >
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h4 className="font-bold text-white group-hover:text-primary transition-colors">{org.name}</h4>
                                            <span className="text-xs text-slate-500 uppercase tracking-wider font-bold">{org.role === 'teacher' ? 'Öğretmen' : 'Öğrenci'}</span>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-dark-800 flex items-center justify-center group-hover:bg-primary group-hover:text-white transition-colors">
                                            <FileCode size={16} />
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
                        <div className="p-4 border-t border-dark-700 bg-dark-700/30">
                            <button
                                onClick={() => setShowOrgModal(false)}
                                className="w-full py-3 text-slate-400 hover:text-white font-medium transition-colors"
                            >
                                İptal Et
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
