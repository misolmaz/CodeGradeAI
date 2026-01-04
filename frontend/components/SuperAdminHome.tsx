import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import {
    Activity, Users, Server, ShieldCheck, TrendingUp, Bell, UserPlus, Zap
} from 'lucide-react';

interface SystemStats {
    total_tenants: number;
    active_tenants: number;
    total_students: number;
    total_teachers: number;
    new_tenants_24h: number;
    system_health: string;
}

interface Tenant {
    id: number;
    name: string;
    student_count: number;
    owner_name: string;
}

export const SuperAdminHome = ({ setCurrentView }: { setCurrentView: (view: string) => void }) => {
    const { token } = useAuth();
    const [stats, setStats] = useState<SystemStats | null>(null);
    const [topTenants, setTopTenants] = useState<Tenant[]>([]);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        const fetchHomeData = async () => {
            try {
                const headers = { 'Authorization': `Bearer ${token}` };
                const [statsRes, tenantsRes] = await Promise.all([
                    fetch(`${API_BASE_URL}/admin/stats`, { headers }),
                    fetch(`${API_BASE_URL}/admin/tenants`, { headers })
                ]);

                if (statsRes.ok) setStats(await statsRes.json());
                if (tenantsRes.ok) {
                    const allTenants: Tenant[] = await tenantsRes.json();
                    // Sort by student count desc and take top 5
                    const sorted = allTenants.sort((a, b) => b.student_count - a.student_count).slice(0, 5);
                    setTopTenants(sorted);
                }
            } catch (error) {
                console.error("SuperAdmin Home Fetch Error", error);
            } finally {
                setLoading(false);
            }
        };
        fetchHomeData();
    }, [token]);

    const StatCard = ({ title, value, subtext, icon: Icon, color }: any) => (
        <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 relative overflow-hidden group hover:border-dark-600 transition-all">
            <div className={`absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity ${color}`}>
                <Icon size={80} />
            </div>
            <div className="flex items-center gap-4 mb-3">
                <div className={`p-3 rounded-xl bg-opacity-10 ${color.replace('text-', 'bg-')} ${color}`}>
                    <Icon size={24} />
                </div>
                <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">{title}</span>
            </div>
            <div className="flex items-end gap-2">
                <p className="text-3xl font-black text-white">{value}</p>
                {subtext && <p className="text-xs text-slate-500 font-medium mb-1.5">{subtext}</p>}
            </div>
        </div>
    );

    if (loading) return <div className="p-10 text-center text-slate-500 animate-pulse">Sistem verileri yükleniyor...</div>;

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header / Quick Actions */}
            <div className="flex flex-col md:flex-row justify-between items-end gap-6 bg-gradient-to-r from-purple-900/20 to-blue-900/20 p-8 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <h1 className="text-4xl font-black text-white mb-2">Kontrol Merkezi</h1>
                    <p className="text-slate-400 text-lg max-w-xl">
                        SaaS platformunuzun anlık durumunu izleyin ve yönetin.
                    </p>
                </div>
                <div className="flex gap-3 relative z-10">
                    <button
                        onClick={() => setCurrentView('system_panel')}
                        className="bg-white/10 hover:bg-white/20 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold backdrop-blur-sm transition-all"
                    >
                        <UserPlus size={18} />
                        Yeni Öğretmen
                    </button>
                    <button
                        onClick={() => setCurrentView('announcement_management')}
                        className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                    >
                        <Bell size={18} />
                        Global Duyuru
                    </button>
                </div>

                {/* Decoration */}
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
            </div>

            {/* Global Stats */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Toplam Kurum"
                    value={stats?.total_tenants || 0}
                    icon={Server}
                    color="text-purple-500"
                    subtext={`${stats?.new_tenants_24h || 0} yeni (24s)`}
                />
                <StatCard
                    title="Aktif Öğrenci"
                    value={stats?.total_students || 0}
                    icon={Users}
                    color="text-blue-500"
                />
                <StatCard
                    title="Sistem Durumu"
                    value={stats?.system_health || "Bilinmiyor"}
                    icon={ShieldCheck}
                    color="text-emerald-500"
                />
                <StatCard
                    title="Eğitmen Sayısı"
                    value={stats?.total_teachers || 0}
                    icon={Zap}
                    color="text-orange-500"
                />
            </div>

            {/* Dashboard Visualizations */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Top Organizations Chart/List */}
                <div className="lg:col-span-2 bg-dark-800 rounded-2xl border border-dark-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <TrendingUp size={20} className="text-primary" />
                        En Yoğun Organizasyonlar (Top 5)
                    </h3>
                    <div className="space-y-4">
                        {topTenants.map((tenant, index) => (
                            <div key={tenant.id} className="flex items-center gap-4 p-3 hover:bg-dark-700/50 rounded-xl transition-colors group">
                                <div className="w-8 h-8 rounded-lg bg-dark-900 flex items-center justify-center font-bold text-slate-500 border border-dark-700 group-hover:border-primary/50 group-hover:text-primary transition-colors">
                                    {index + 1}
                                </div>
                                <div className="flex-1">
                                    <div className="flex justify-between mb-1">
                                        <span className="text-white font-medium">{tenant.name}</span>
                                        <span className="text-slate-400 text-xs font-mono">{tenant.student_count} öğrenci</span>
                                    </div>
                                    {/* Mock Progress Bar visually comparing to max (assume max 50 for visual scaling if count low, or dynamic) */}
                                    <div className="h-2 w-full bg-dark-900 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-gradient-to-r from-blue-600 to-purple-600 rounded-full opacity-80"
                                            style={{ width: `${Math.min((tenant.student_count / (topTenants[0]?.student_count || 1)) * 100, 100)}%` }}
                                        ></div>
                                    </div>
                                </div>
                            </div>
                        ))}
                        {topTenants.length === 0 && <p className="text-slate-500 text-sm italic">Henüz veri yok.</p>}
                    </div>
                </div>

                {/* Recent Activity / System Log */}
                <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6">
                    <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                        <Activity size={20} className="text-emerald-500" />
                        Son Aktiviteler
                    </h3>
                    <div className="relative border-l-2 border-dark-700 pl-6 space-y-6">
                        {/* Mock Items for Visual */}
                        <div className="relative">
                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-emerald-500 ring-4 ring-dark-800"></div>
                            <p className="text-sm text-white font-medium">Sistem Başlatıldı</p>
                            <p className="text-xs text-slate-500">Az önce</p>
                        </div>
                        {stats?.new_tenants_24h ? (
                            <div className="relative">
                                <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-purple-500 ring-4 ring-dark-800"></div>
                                <p className="text-sm text-white font-medium">{stats.new_tenants_24h} Yeni Kurum Katıldı</p>
                                <p className="text-xs text-slate-500">Son 24 saat içinde</p>
                            </div>
                        ) : null}
                        <div className="relative">
                            <div className="absolute -left-[31px] top-0 w-4 h-4 rounded-full bg-blue-500 ring-4 ring-dark-800"></div>
                            <p className="text-sm text-white font-medium">Veritabanı Bakımı</p>
                            <p className="text-xs text-slate-500">Otomatik (03:00)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
};
