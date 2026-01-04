import React, { useState } from 'react';
import { User, UserRole } from '../types';
import { LogOut, BookOpen, BarChart2, Layout as LayoutIcon, Bell, Upload, User as UserIcon, Menu, X, Trophy } from 'lucide-react';


interface LayoutProps {
  user: User;
  onLogout: () => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, currentView, setCurrentView, children }) => {
  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);

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
          <button
            onClick={() => { setCurrentView('assignments'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'assignments' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
              }`}
          >
            <BookOpen size={20} />
            <span className="text-sm font-medium">
              {(user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) ? 'Ödev Yönetimi' : 'Ödevlerim'}
            </span>
          </button>
          <button
            onClick={() => { setCurrentView('leaderboard'); setIsMobileMenuOpen(false); }}
            className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'leaderboard' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
              }`}
          >
            <Trophy size={20} />
            <span className="text-sm font-medium">Liderlik Tablosu</span>
          </button>
          {(user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) && (
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
                onClick={() => { setCurrentView('announcement_management'); setIsMobileMenuOpen(false); }}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'announcement_management' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                  }`}
              >
                <Bell size={20} />
                <span className="text-sm font-medium">Duyuru Yönetimi</span>
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

          {user.role === UserRole.SUPERADMIN && (
            <button
              onClick={() => { setCurrentView('superadmin_dashboard'); setIsMobileMenuOpen(false); }}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'superadmin_dashboard' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
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
          <h2 className="text-lg font-semibold text-white uppercase tracking-widest text-xs opacity-50">
            {currentView.replace('_', ' ')}
          </h2>
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

