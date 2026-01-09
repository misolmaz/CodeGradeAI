// @ts-nocheck
import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import { User, UserRole } from '../types';
import { LogOut, BookOpen, BarChart2, Layout as LayoutIcon, Bell, Upload, User as UserIcon, Menu, X, Trophy, ChevronDown, Building2, Check, RotateCw } from 'lucide-react';


interface LayoutProps {
  user: User;
  onLogout: () => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, currentView, setCurrentView, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const { organizationName, token, login } = useAuth();
  const [organizations, setOrganizations] = useState<any[]>([]);
  const [isSwitcherOpen, setIsSwitcherOpen] = useState(false);
  const [isSwitching, setIsSwitching] = useState(false);

  React.useEffect(() => {
    if (token) {
      fetch(`${API_BASE_URL}/users/me/organizations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      })
        .then(res => res.json())
        .then(data => setOrganizations(data))
        .catch(err => console.error("Failed to fetch orgs", err));
    }
  }, [token]);

  const handleSwitch = async (orgId: number) => {
    if (isSwitching) return;
    setIsSwitching(true);
    try {
      const response = await fetch(`${API_BASE_URL}/token/switch?organization_id=${orgId}`, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${token}`,
          'Content-Type': 'application/json'
        }
      });

      if (response.ok) {
        const data = await response.json();
        login(
          data.access_token,
          data.role,
          data.username,
          data.student_number,
          data.class_code,
          data.avatar_url,
          data.user_id.toString(),
          data.organization_name,
          data.email
        );
        setIsSwitcherOpen(false);
        window.location.reload(); // Ensure fresh state
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsSwitching(false);
    }
  };

  const NavContent = () => (
    <div className="flex flex-col h-full">
      <div className="p-6">
        <div className="flex items-center gap-3 mb-8">
          <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center overflow-hidden">
            <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
          </div>
          <div className="overflow-hidden">
            <h1 className="text-sm font-bold truncate">{user.name}</h1>
            <p className="text-xs text-slate-400 truncate">
              {user.role === UserRole.SUPERADMIN ? 'Sistem Yöneticisi' : (user.role === UserRole.TEACHER ? 'Öğretim Üyesi' : 'Öğrenci')}
            </p>
          </div>
        </div>

        <nav className="flex flex-col gap-2">
          <button
            onClick={() => { setCurrentView('home'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'home' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
              }`}
          >
            <LayoutIcon size={20} />
            <span className="text-sm font-medium">Ana Sayfa</span>
          </button>
          {user.role !== UserRole.SUPERADMIN && (
            <button
              onClick={() => { setCurrentView('assignments'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'assignments' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                }`}
            >
              <BookOpen size={20} />
              <span className="text-sm font-medium">
                {user.role === UserRole.TEACHER ? 'Ödev Yönetimi' : 'Ödevlerim'}
              </span>
            </button>
          )}
          {user.role !== UserRole.SUPERADMIN && (
            <button
              onClick={() => { setCurrentView('leaderboard'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'leaderboard' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                }`}
            >
              <Trophy size={20} />
              <span className="text-sm font-medium">Liderlik Tablosu</span>
            </button>
          )}
          {user.role === UserRole.TEACHER && (
            <>
              <button
                onClick={() => { setCurrentView('students'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'students' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                  }`}
              >
                <BarChart2 size={20} />
                <span className="text-sm font-medium">Öğrenci Analizi</span>
              </button>
              <button
                onClick={() => { setCurrentView('teacher_dashboard'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'teacher_dashboard' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                  }`}
              >
                <Upload size={20} />
                <span className="text-sm font-medium">Yönetim Paneli</span>
              </button>
            </>
          )}

          {(user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) && (
            <button
              onClick={() => { setCurrentView('announcement_management'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'announcement_management' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                }`}
            >
              <Bell size={20} />
              <span className="text-sm font-medium">Duyuru Yönetimi</span>
            </button>
          )}

          {user.role === UserRole.SUPERADMIN && (
            <button
              onClick={() => { setCurrentView('system_panel'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'system_panel' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                }`}
            >
              <LayoutIcon size={20} className="text-purple-400" />
              <span className="text-sm font-medium text-purple-400">Sistem Paneli</span>
            </button>
          )}
          <button
            onClick={() => { setCurrentView('profile'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'profile' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
              }`}
          >
            <UserIcon size={20} />
            <span className="text-sm font-medium">Profil</span>
          </button>
        </nav>
      </div>

      <div className="mt-auto p-6 border-t border-dark-700">
        <button
          onClick={onLogout}
          className="flex items-center gap-3 px-4 py-3 rounded-lg text-red-400 hover:bg-red-500/10 hover:text-red-300 w-full transition-colors"
        >
          <LogOut size={20} />
          <span className="text-sm font-medium">Çıkış Yap</span>
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex h-screen w-full flex-col md:flex-row overflow-hidden bg-dark-900 text-slate-100">
      {/* Mobile Header */}
      <header className="h-16 flex md:hidden items-center justify-between px-6 border-b border-dark-700 bg-dark-800 z-50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center text-primary">
            <LayoutIcon size={20} />
          </div>
          <span className="font-bold text-white">CodeGrade AI</span>
        </div>
        <button
          onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
          className="p-2 text-slate-400 hover:text-white"
        >
          {isMobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="w-64 h-full hidden md:flex flex-col border-r border-dark-700 bg-dark-800">
        <NavContent />
      </aside>

      {/* Mobile Drawer Overlay */}
      {isMobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] md:hidden"
          onClick={() => setIsMobileMenuOpen(false)}
        />
      )}

      {/* Mobile Drawer */}
      <aside className={`fixed top-0 left-0 h-full w-72 bg-dark-800 z-[70] transform transition-transform duration-300 md:hidden ${isMobileMenuOpen ? 'translate-x-0' : '-translate-x-full'}`}>
        <div className="h-full flex flex-col">
          <div className="p-6 border-b border-dark-700 flex justify-between items-center">
            <span className="font-bold text-white">Menü</span>
            <button onClick={() => setIsMobileMenuOpen(false)}><X size={20} className="text-slate-400" /></button>
          </div>
          <NavContent />
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden flex flex-col bg-dark-900 relative">
        <header className="h-16 border-b border-dark-700 bg-dark-800/50 backdrop-blur hidden md:flex items-center justify-between px-8">
          <div className="flex items-center gap-4">
            {/* Organization Switcher - Smart Visibility */}
            {(organizations.length > 1 || user.role === UserRole.SUPERADMIN) ? (
              <div className="relative">
                <button
                  onClick={() => setIsSwitcherOpen(!isSwitcherOpen)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-dark-700 transition-colors border border-transparent hover:border-dark-600 group"
                >
                  <Building2 size={18} className="text-primary" />
                  <span className="font-bold text-white text-sm">
                    {organizations.find(o => o.is_current)?.organization_name
                      ? `${organizations.find(o => o.is_current)?.organization_name} - ${organizations.find(o => o.is_current)?.teacher_name || ''}`
                      : (organizationName || 'Organizasyon Seç')}
                  </span>
                  <ChevronDown size={14} className={`text-slate-500 transition-transform ${isSwitcherOpen ? 'rotate-180' : ''}`} />
                </button>

                {isSwitcherOpen && (
                  <>
                    <div className="fixed inset-0 z-[90]" onClick={() => setIsSwitcherOpen(false)} />
                    <div className="absolute top-full left-0 mt-2 w-72 bg-dark-800 border border-dark-700 rounded-xl shadow-xl z-[100] overflow-hidden animate-in fade-in zoom-in-95 duration-200">
                      <div className="p-3 bg-dark-700/30 border-b border-dark-700">
                        <span className="text-xs font-bold text-slate-500 uppercase">Kayıtlı Dersler/Kurumlar</span>
                      </div>
                      <div className="max-h-64 overflow-y-auto p-1">
                        {organizations.map(org => (
                          <button
                            key={org.organization_id}
                            onClick={() => handleSwitch(org.organization_id)}
                            disabled={isSwitching}
                            className={`w-full text-left px-3 py-2.5 rounded-lg flex items-center justify-between group transition-colors ${org.is_current ? 'bg-primary/10' : 'hover:bg-dark-700'}`}
                          >
                            <div className="flex flex-col">
                              <span className={`text-sm font-bold ${org.is_current ? 'text-primary' : 'text-slate-300 group-hover:text-white'}`}>
                                {org.organization_name}
                              </span>
                              <div className="flex items-center gap-2">
                                <span className="text-[11px] text-slate-500 font-medium">{org.teacher_name}</span>
                              </div>
                            </div>
                            {org.is_current && <Check size={14} className="text-primary" />}
                          </button>
                        ))}
                      </div>
                    </div>
                  </>
                )}
              </div>
            ) : (
              <div className="flex items-center gap-2 px-3 py-1.5 opacity-80 cursor-default">
                <Building2 size={18} className="text-primary" />
                <span className="font-bold text-white text-sm">
                  {organizationName || 'CodeGrade AI'}
                </span>
              </div>
            )}

            <div className="h-6 w-px bg-dark-700 mx-2"></div>

            <h2 className="text-lg font-semibold text-white uppercase tracking-widest text-xs opacity-50">
              {currentView.replace('_', ' ')}
            </h2>
          </div>

          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-dark-700">
              <Bell size={20} />
            </button>
            <div className="w-8 h-8 rounded-lg bg-dark-700 border border-dark-600"></div>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {children}
        </div>
      </main>
    </div>
  );
};

