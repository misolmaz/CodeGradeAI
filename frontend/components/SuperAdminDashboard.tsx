import React, { useState, useEffect } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import {
    LayoutDashboard, Users, UserCheck, Activity, Plus, Search,
    MoreVertical, Trash2, Power, UserX, UserPlus, KeyRound, Check
} from 'lucide-react';

interface Stats {
    total_tenants: number;
    active_tenants: number;
    total_students: number;
    total_teachers: number;
}

interface Tenant {
    id: number;
    name: string;
    is_active: boolean;
    created_at: string;
    owner_name: string;
    owner_email: string;
    student_count: number;
}

export const SuperAdminDashboard = () => {
    const { token } = useAuth();
    const [stats, setStats] = useState<Stats | null>(null);
    const [tenants, setTenants] = useState<Tenant[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);

    // New Tenant Form State
    const [newTenant, setNewTenant] = useState({
        orgName: '',
        teacherName: '',
        email: '',
        username: '',
        password: ''
    });

    const fetchData = async () => {
        setIsLoading(true);
        try {
            const headers = { 'Authorization': `Bearer ${token}` };
            const [statsRes, tenantsRes] = await Promise.all([
                fetch(`${API_BASE_URL}/admin/stats`, { headers }),
                fetch(`${API_BASE_URL}/admin/tenants`, { headers })
            ]);

            if (statsRes.ok) setStats(await statsRes.json());
            if (tenantsRes.ok) setTenants(await tenantsRes.json());

        } catch (error) {
            console.error("Dashboard data fetch error:", error);
        } finally {
            setIsLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [token]);

    const handleToggleStatus = async (tenant: Tenant) => {
        if (!confirm(`"${tenant.name}" hesabını ${tenant.is_active ? 'pasifize etmek' : 'aktifleştirmek'} istediğinize emin misiniz?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/admin/tenant/${tenant.id}/status?is_active=${!tenant.is_active}`, {
                method: 'PUT',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) fetchData();
        } catch (e) { console.error(e); }
    };

    const handleDeleteTenant = async (id: number, name: string) => {
        if (!confirm(`DİKKAT: "${name}" hesabını ve ona bağlı TÜM ÖĞRENCİLERİ silmek üzeresiniz. Bu işlem geri alınamaz!\n\nOnaylıyor musunuz?`)) return;

        try {
            const res = await fetch(`${API_BASE_URL}/admin/tenant/${id}`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) fetchData();
        } catch (e) { console.error(e); }
    };

    const handleCreateTenant = async () => {
        if (!newTenant.orgName || !newTenant.username || !newTenant.password || !newTenant.teacherName || !newTenant.email) {
            alert("Lütfen tüm alanları doldurun.");
            return;
        }

        try {
            const payload = {
                org_name: newTenant.orgName,
                teacher_username: newTenant.username,
                teacher_password: newTenant.password,
                teacher_fullname: newTenant.teacherName,
                teacher_email: newTenant.email
            };

            const res = await fetch(`${API_BASE_URL}/admin/create-tenant`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${token}`
                },
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                alert("Yeni öğretmen hesabı başarıyla oluşturuldu!");
                setIsCreateModalOpen(false);
                setIsCreateModalOpen(false);
                setNewTenant({ orgName: '', teacherName: '', email: '', username: '', password: '' });
                fetchData();
            } else {
                const err = await res.json();
                alert("Hata: " + err.detail);
            }
        } catch (e) { console.error(e); }
    };

    const filteredTenants = tenants.filter(t =>
        t.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.owner_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        t.owner_email.toLowerCase().includes(searchTerm.toLowerCase())
    );

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header Area */}
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                <div>
                    <h1 className="text-3xl font-bold text-white tracking-tight">Sistem Paneli</h1>
                    <p className="text-slate-400 mt-1">Tüm öğretmenlerin ve sınıfların yönetim merkezi.</p>
                </div>
                <button
                    onClick={() => setIsCreateModalOpen(true)}
                    className="bg-primary hover:bg-primary/90 text-white px-6 py-3 rounded-xl flex items-center gap-2 font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                >
                    <UserPlus size={20} />
                    Yeni Öğretmen Ekle
                </button>
            </div>

            {/* Stats Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Users size={80} />
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-blue-500/10 text-blue-400 rounded-xl"><Users size={24} /></div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Toplam Öğretmen</span>
                    </div>
                    <p className="text-4xl font-black text-white">{stats?.total_teachers || 0}</p>
                </div>

                <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <Activity size={80} className="text-emerald-500" />
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-emerald-500/10 text-emerald-400 rounded-xl"><Activity size={24} /></div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Aktif Hesaplar</span>
                    </div>
                    <p className="text-4xl font-black text-white">{stats?.active_tenants || 0}</p>
                </div>

                <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <LayoutDashboard size={80} className="text-purple-500" />
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-purple-500/10 text-purple-400 rounded-xl"><LayoutDashboard size={24} /></div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Organizasyonlar</span>
                    </div>
                    <p className="text-4xl font-black text-white">{stats?.total_tenants || 0}</p>
                </div>

                <div className="bg-dark-800 p-6 rounded-2xl border border-dark-700 relative overflow-hidden group">
                    <div className="absolute top-0 right-0 p-4 opacity-5 group-hover:opacity-10 transition-opacity">
                        <UserCheck size={80} className="text-orange-500" />
                    </div>
                    <div className="flex items-center gap-4 mb-2">
                        <div className="p-3 bg-orange-500/10 text-orange-400 rounded-xl"><UserCheck size={24} /></div>
                        <span className="text-slate-400 font-bold text-xs uppercase tracking-wider">Toplam Öğrenci</span>
                    </div>
                    <p className="text-4xl font-black text-white">{stats?.total_students || 0}</p>
                </div>
            </div>

            {/* Tenants Table */}
            <div className="bg-dark-800 rounded-2xl border border-dark-700 shadow-xl overflow-hidden">
                <div className="p-6 border-b border-dark-700 flex flex-col sm:flex-row justify-between items-center gap-4">
                    <h2 className="text-lg font-bold text-white flex items-center gap-2">
                        <Users size={20} className="text-primary" />
                        Kayıtlı Öğretmenler
                    </h2>
                    <div className="relative w-full sm:w-auto">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                        <input
                            type="text"
                            placeholder="İsim, email veya kurum ara..."
                            className="w-full sm:w-80 bg-dark-900 border border-dark-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full text-left">
                        <thead className="bg-dark-700/50 text-slate-400 text-[11px] font-black uppercase tracking-wider">
                            <tr>
                                <th className="px-6 py-4">Öğretmen / Kurum</th>
                                <th className="px-6 py-4">Kullanıcı Adı</th>
                                <th className="px-6 py-4 text-center">Öğrenci</th>
                                <th className="px-6 py-4 text-center">Durum</th>
                                <th className="px-6 py-4 text-right">İşlemler</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-dark-700/50">
                            {filteredTenants.map((tenant) => (
                                <tr key={tenant.id} className="hover:bg-dark-700/30 transition-colors group">
                                    <td className="px-6 py-4">
                                        <div className="flex flex-col">
                                            <span className="text-white font-bold text-sm">{tenant.owner_name}</span>
                                            <span className="text-slate-500 text-xs">{tenant.name}</span>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-300 font-mono text-xs">
                                        {tenant.owner_email}
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className="px-2.5 py-1 bg-dark-900 rounded-lg text-slate-300 text-xs font-bold border border-dark-600">
                                            {tenant.student_count}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-center">
                                        <span className={`px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-widest border ${tenant.is_active
                                            ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
                                            : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                                            }`}>
                                            {tenant.is_active ? 'AKTİF' : 'PASİF'}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-right">
                                        <div className="flex items-center justify-end gap-2">
                                            <button
                                                onClick={() => handleToggleStatus(tenant)}
                                                className={`p-2 rounded-lg transition-colors ${tenant.is_active
                                                    ? 'text-rose-400 hover:bg-rose-500/10'
                                                    : 'text-emerald-400 hover:bg-emerald-500/10'
                                                    }`}
                                                title={tenant.is_active ? "Hesabı Pasifize Et" : "Hesabı Aktifleştir"}
                                            >
                                                <Power size={18} />
                                            </button>
                                            <button
                                                onClick={() => handleDeleteTenant(tenant.id, tenant.name)}
                                                className="p-2 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 rounded-lg transition-colors"
                                                title="Hesabı Sil"
                                            >
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                            {filteredTenants.length === 0 && (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-slate-500 italic">
                                        {searchTerm ? 'Aramanızla eşleşen kayıt bulunamadı.' : 'Henüz sisteme kayıtlı öğretmen bulunmuyor.'}
                                    </td>
                                </tr>
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create Tenant Modal */}
            {isCreateModalOpen && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[100] flex items-center justify-center p-4 animate-in fade-in duration-200">
                    <div className="bg-dark-800 w-full max-w-lg rounded-2xl border border-dark-700 shadow-2xl overflow-hidden animate-in zoom-in duration-200">
                        <div className="p-6 border-b border-dark-700 bg-dark-700/30">
                            <h3 className="text-xl font-bold text-white flex items-center gap-2">
                                <UserPlus size={24} className="text-primary" />
                                Yeni Öğretmen Hesabı
                            </h3>
                            <p className="text-slate-400 text-xs mt-1">Tenant (Organizasyon) ve Öğretmen Hesabı oluşturulacak.</p>
                        </div>
                        <div className="p-8 space-y-4">
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Kurum / Organizasyon Adı</label>
                                <input
                                    type="text"
                                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="Örn: Yazılım Mühendisliği Bölümü"
                                    value={newTenant.orgName}
                                    onChange={e => setNewTenant({ ...newTenant, orgName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Öğretmen Adı Soyadı</label>
                                <input
                                    type="text"
                                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="Örn: Dr. Ahmet Yılmaz"
                                    value={newTenant.teacherName}
                                    onChange={e => setNewTenant({ ...newTenant, teacherName: e.target.value })}
                                />
                            </div>
                            <div>
                                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">E-Posta Adresi</label>
                                <input
                                    type="email"
                                    autoComplete="off"
                                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all"
                                    placeholder="ornek@edustack.cloud"
                                    value={newTenant.email}
                                    onChange={e => setNewTenant({ ...newTenant, email: e.target.value })}
                                />
                            </div>
                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Kullanıcı Adı (Giriş)</label>
                                    <input
                                        type="text"
                                        autoComplete="new-password"
                                        className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all"
                                        placeholder="ahmet.yilmaz"
                                        value={newTenant.username}
                                        onChange={e => setNewTenant({ ...newTenant, username: e.target.value })}
                                    />
                                </div>
                                <div>
                                    <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Şifre</label>
                                    <input
                                        type="password"
                                        autoComplete="new-password"
                                        className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-2 focus:ring-primary transition-all"
                                        placeholder="******"
                                        value={newTenant.password}
                                        onChange={e => setNewTenant({ ...newTenant, password: e.target.value })}
                                    />
                                </div>
                            </div>
                            <div className="p-4 bg-primary/10 rounded-xl border border-primary/20 flex gap-3 items-start">
                                <Check size={20} className="text-primary mt-0.5" />
                                <p className="text-xs text-primary/80 leading-relaxed">
                                    Bu işlemle birlikte yeni bir "Organization" kaydı açılacak ve belirtilen öğretmen bu organizasyonun yöneticisi (Teacher) olarak atanacaktır.
                                </p>
                            </div>
                        </div>
                        <div className="p-6 border-t border-dark-700 bg-dark-700/30 flex justify-end gap-3">
                            <button
                                onClick={() => setIsCreateModalOpen(false)}
                                className="px-5 py-2.5 text-slate-400 hover:text-white font-bold transition-colors"
                            >
                                İptal
                            </button>
                            <button
                                onClick={handleCreateTenant}
                                className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/20 transition-all active:scale-95"
                            >
                                Hesabı Oluştur
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
