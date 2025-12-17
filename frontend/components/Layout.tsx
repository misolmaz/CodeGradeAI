import React from 'react';
import { User, UserRole } from '../types';
import { LogOut, BookOpen, BarChart2, Layout as LayoutIcon, Bell, Upload } from 'lucide-react';

interface LayoutProps {
  user: User;
  onLogout: () => void;
  currentView: string;
  setCurrentView: (view: string) => void;
  children: React.ReactNode;
}

export const Layout: React.FC<LayoutProps> = ({ user, onLogout, currentView, setCurrentView, children }) => {
  return (
    <div className="flex h-screen w-full flex-row overflow-hidden bg-dark-900 text-slate-100">
      {/* Sidebar */}
      <aside className="w-64 h-full hidden md:flex flex-col border-r border-dark-700 bg-dark-800">
        <div className="p-6">
          <div className="flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-full bg-primary/20 border-2 border-primary flex items-center justify-center overflow-hidden">
              <img src={user.avatar} alt={user.name} className="w-full h-full object-cover" />
            </div>
            <div className="overflow-hidden">
              <h1 className="text-sm font-bold truncate">{user.name}</h1>
              <p className="text-xs text-slate-400 truncate">
                {user.role === UserRole.TEACHER ? 'Öğretim Üyesi' : 'Öğrenci'}
              </p>
            </div>
          </div>

          <nav className="flex flex-col gap-2">
            <button
              onClick={() => setCurrentView('home')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'home' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                }`}
            >
              <LayoutIcon size={20} />
              <span className="text-sm font-medium">Ana Sayfa</span>
            </button>
            <button
              onClick={() => setCurrentView('assignments')}
              className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'assignments' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                }`}
            >
              <BookOpen size={20} />
              <span className="text-sm font-medium">
                {user.role === UserRole.TEACHER ? 'Ödev Yönetimi' : 'Ödevlerim'}
              </span>
            </button>
            {user.role === UserRole.TEACHER && (
              <>
                <button
                  onClick={() => setCurrentView('students')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'students' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                    }`}
                >
                  <BarChart2 size={20} />
                  <span className="text-sm font-medium">Öğrenci Analizi</span>
                </button>
                <button
                  onClick={() => setCurrentView('teacher_dashboard')}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${currentView === 'teacher_dashboard' ? 'bg-primary/20 text-primary border border-primary/30' : 'text-slate-400 hover:bg-dark-700 hover:text-white'
                    }`}
                >
                  <Upload size={20} />
                  <span className="text-sm font-medium">Yönetim Paneli</span>
                </button>
              </>
            )}
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
      </aside>

      {/* Main Content */}
      <main className="flex-1 h-full overflow-hidden flex flex-col bg-dark-900 relative">
        <header className="h-16 border-b border-dark-700 bg-dark-800/50 backdrop-blur flex items-center justify-between px-6 md:px-8">
          <h2 className="text-lg font-semibold text-white">CodeGrade AI</h2>
          <div className="flex items-center gap-4">
            <button className="p-2 text-slate-400 hover:text-white rounded-full hover:bg-dark-700">
              <Bell size={20} />
            </button>
          </div>
        </header>
        <div className="flex-1 overflow-y-auto p-4 md:p-8 scroll-smooth">
          {children}
        </div>
      </main>
    </div>
  );
};
