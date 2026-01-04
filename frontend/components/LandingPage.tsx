import React from 'react';
import { LayoutDashboard, FileSpreadsheet, BarChart2, ArrowRight, CheckCircle, Code2, ShieldCheck } from 'lucide-react';

interface LandingPageProps {
    onLoginClick: () => void;
    onDashboardClick: () => void;
    isLoggedIn: boolean;
}

export const LandingPage: React.FC<LandingPageProps> = ({ onLoginClick, onDashboardClick, isLoggedIn }) => {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-900">
            {/* Navbar */}
            <nav className="fixed top-0 w-full bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex justify-between items-center">
                    <div className="flex items-center gap-2">
                        <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center text-white">
                            <Code2 size={20} />
                        </div>
                        <span className="font-bold text-xl tracking-tight text-slate-800">EduStack</span>
                    </div>
                    <div className="flex items-center gap-4">
                        <a href="https://edustack.cloud" target="_blank" rel="noreferrer" className="hidden sm:block text-slate-500 hover:text-indigo-600 font-medium text-sm transition-colors">
                            edustack.cloud
                        </a>
                        {isLoggedIn ? (
                            <button
                                onClick={onDashboardClick}
                                className="px-5 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-full font-semibold transition-all shadow-lg shadow-indigo-200 flex items-center gap-2 text-sm"
                            >
                                <LayoutDashboard size={16} />
                                Panele Git
                            </button>
                        ) : (
                            <button
                                onClick={onLoginClick}
                                className="px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-white rounded-full font-semibold transition-all shadow-lg shadow-slate-200 text-sm"
                            >
                                Giriş Yap
                            </button>
                        )}
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <header className="pt-32 pb-20 px-6 mt-10">
                <div className="max-w-4xl mx-auto text-center space-y-8">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 text-indigo-600 text-xs font-bold uppercase tracking-wider border border-indigo-100 mb-4 animate-in fade-in slide-in-from-bottom-4 duration-700">
                        <span className="w-2 h-2 rounded-full bg-indigo-600 animate-pulse"></span>
                        Yapay Zeka Destekli Eğitim
                    </div>
                    <h1 className="text-5xl sm:text-7xl font-black text-slate-900 leading-tight tracking-tight animate-in fade-in slide-in-from-bottom-6 duration-700 delay-100">
                        Kodlama Eğitiminde <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 to-violet-600">Otomatik Puanlama</span>
                    </h1>
                    <p className="text-xl text-slate-600 max-w-2xl mx-auto leading-relaxed animate-in fade-in slide-in-from-bottom-6 duration-700 delay-200">
                        Öğrenci ödevlerini saniyeler içinde analiz edin, puanlayın ve detaylı geri bildirim sağlayın.
                        Modern sınıf yönetimi artık tek bir panelde.
                    </p>
                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4 animate-in fade-in slide-in-from-bottom-6 duration-700 delay-300">
                        {isLoggedIn ? (
                            <button
                                onClick={onDashboardClick}
                                className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-3"
                            >
                                Yönetim Paneline Dön
                                <ArrowRight size={20} />
                            </button>
                        ) : (
                            <>
                                <button
                                    onClick={onLoginClick}
                                    className="w-full sm:w-auto px-8 py-4 bg-indigo-600 hover:bg-indigo-700 text-white rounded-2xl font-bold text-lg shadow-xl shadow-indigo-200 active:scale-95 transition-all flex items-center justify-center gap-2"
                                >
                                    Hemen Başla
                                    <ArrowRight size={20} />
                                </button>
                                <button className="w-full sm:w-auto px-8 py-4 bg-white hover:bg-slate-50 text-slate-700 border border-slate-200 rounded-2xl font-bold text-lg active:scale-95 transition-all">
                                    Daha Fazla Bilgi
                                </button>
                            </>
                        )}
                    </div>
                </div>
            </header>

            {/* Features Section */}
            <section className="py-20 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all group">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-indigo-600 shadow-sm mb-6 group-hover:scale-110 transition-transform">
                                <ShieldCheck size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Eşsiz Veri Alanı</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Her öğretmen ve kurum için izole edilmiş veri tabanı yapısı (Tenant Isolation) ile öğrenci verileriniz güvende ve sadece size özel.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all group">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-emerald-600 shadow-sm mb-6 group-hover:scale-110 transition-transform">
                                <FileSpreadsheet size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Excel ile Hızlı Kayıt</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Yüzlerce öğrenciyi tek tıkla sisteme aktarın. Akıllı eşleştirme algoritması ile mükerrer kayıtlar ve veri karmaşası tarihe karıştı.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="p-8 rounded-3xl bg-slate-50 border border-slate-100 hover:border-indigo-100 hover:shadow-xl hover:shadow-indigo-50 transition-all group">
                            <div className="w-14 h-14 bg-white rounded-2xl flex items-center justify-center text-violet-600 shadow-sm mb-6 group-hover:scale-110 transition-transform">
                                <BarChart2 size={32} />
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Gelişmiş Analitik</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Öğrenci performansını detaylı grafiklerle izleyin. Sınıf başarısını, ödev teslim oranlarını ve gelişim süreçlerini anlık takip edin.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="py-12 bg-slate-50 border-t border-slate-200">
                <div className="max-w-7xl mx-auto px-6 flex flex-col items-center justify-center gap-4 text-center">
                    <div className="flex items-center gap-2 opacity-50 grayscale hover:grayscale-0 transition-all">
                        <div className="w-6 h-6 bg-slate-400 rounded flex items-center justify-center text-white">
                            <Code2 size={14} />
                        </div>
                        <span className="font-bold text-slate-400">EduStack Cloud</span>
                    </div>
                    <p className="text-slate-400 text-sm">
                        © 2024 TechEducation Solutions. Tüm hakları saklıdır.
                    </p>
                </div>
            </footer>
        </div>
    );
};
