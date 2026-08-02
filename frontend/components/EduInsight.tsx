import React, { useEffect, useMemo, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import {
    BrainCircuit, TrendingUp, Target, Layers, ClipboardCheck, MessageCircleQuestion,
    AlertTriangle, Users, Search, RotateCw, ArrowUpRight, ArrowDownRight, Minus,
    Sparkles, BarChart3, Gauge
} from 'lucide-react';

interface KpiSummary {
    class_average: number;
    total_submissions: number;
    graded_submissions: number;
    active_assignments: number;
    total_assignments: number;
    total_students: number;
    participating_students: number;
    socratic_support_rate: number;
    success_rate: number;
    average_attempts: number;
    first_attempt_success_rate: number;
    average_improvement: number;
}

interface ScoreBucket {
    label: string;
    count: number;
    share: number;
}

interface MisconceptionItem {
    error_type: string;
    label: string;
    count: number;
    student_count: number;
    share: number;
    severity_counts: Record<string, number>;
    sample_misconceptions: string[];
}

interface StudentProgressItem {
    user_id: number;
    student_number?: string;
    full_name?: string;
    class_code?: string;
    avatar_url?: string;
    submission_count: number;
    assignment_count: number;
    average_score: number;
    best_score: number;
    first_score?: number | null;
    latest_score?: number | null;
    improvement: number;
    attempts_to_success?: number | null;
    solved_assignments: number;
    top_error_type?: string | null;
    top_error_label?: string | null;
    last_submitted_at?: string | null;
}

interface AssignmentPerformanceItem {
    assignment_id: number;
    title: string;
    status?: string;
    submission_count: number;
    student_count: number;
    average_score: number;
    success_rate: number;
}

interface TeacherSummary {
    generated_at: string;
    class_code?: string | null;
    class_options: string[];
    kpi: KpiSummary;
    score_distribution: ScoreBucket[];
    misconceptions: MisconceptionItem[];
    students: StudentProgressItem[];
    assignments: AssignmentPerformanceItem[];
}

type TabId = 'overview' | 'misconceptions' | 'students';

const TABS: { id: TabId; label: string; icon: any }[] = [
    { id: 'overview', label: 'Genel Bakış', icon: BarChart3 },
    { id: 'misconceptions', label: 'Kavram Yanılgıları', icon: AlertTriangle },
    { id: 'students', label: 'Öğrenci Gelişimi', icon: Users }
];

const SEVERITY_LABELS: Record<string, string> = {
    blocking: 'Engelleyici',
    high: 'Yüksek',
    medium: 'Orta',
    low: 'Düşük',
    unknown: 'Belirsiz'
};

const SEVERITY_STYLES: Record<string, string> = {
    blocking: 'bg-rose-500/10 text-rose-400 border-rose-500/20',
    high: 'bg-orange-500/10 text-orange-400 border-orange-500/20',
    medium: 'bg-amber-500/10 text-amber-400 border-amber-500/20',
    low: 'bg-sky-500/10 text-sky-400 border-sky-500/20',
    unknown: 'bg-slate-500/10 text-slate-400 border-slate-500/20'
};

const SEVERITY_ORDER = ['blocking', 'high', 'medium', 'low', 'unknown'];

const scoreTone = (score: number) =>
    score >= 70
        ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
        : score >= 50
            ? 'bg-amber-500/10 text-amber-400 border-amber-500/20'
            : 'bg-rose-500/10 text-rose-400 border-rose-500/20';

const bucketGradient = (label: string) => {
    if (label === '85-100') return 'from-emerald-500 to-emerald-400';
    if (label === '70-84') return 'from-teal-500 to-emerald-500';
    if (label === '55-69') return 'from-amber-500 to-yellow-500';
    if (label === '40-54') return 'from-orange-500 to-amber-500';
    return 'from-rose-600 to-rose-500';
};

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

const EmptyState = ({ message }: { message: string }) => (
    <div className="text-center py-20 text-slate-500 italic bg-dark-800/30 rounded-2xl border border-dark-700 border-dashed">
        <Sparkles size={40} className="mx-auto mb-4 opacity-10" />
        {message}
    </div>
);

export const EduInsight = () => {
    const { token } = useAuth();
    const [summary, setSummary] = useState<TeacherSummary | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState('');
    const [classFilter, setClassFilter] = useState('all');
    const [activeTab, setActiveTab] = useState<TabId>('overview');
    const [studentSearch, setStudentSearch] = useState('');
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (!token) return;

        const controller = new AbortController();

        const fetchSummary = async () => {
            setIsLoading(true);
            setError('');
            try {
                const query = classFilter === 'all' ? '' : `?class_code=${encodeURIComponent(classFilter)}`;
                const res = await fetch(`${API_BASE_URL}/analytics/teacher-summary${query}`, {
                    headers: { 'Authorization': `Bearer ${token}` },
                    signal: controller.signal
                });

                if (res.ok) {
                    setSummary(await res.json());
                } else {
                    setError('Analitik verileri alınamadı. Lütfen tekrar deneyin.');
                }
            } catch (err: any) {
                if (err?.name === 'AbortError') return;
                console.error('EduInsight fetch error', err);
                setError('Sunucuya bağlanılamadı.');
            } finally {
                if (!controller.signal.aborted) setIsLoading(false);
            }
        };

        fetchSummary();

        return () => controller.abort();
    }, [token, classFilter, reloadKey]);

    const kpi = summary?.kpi;
    const maxBucketCount = useMemo(
        () => Math.max(1, ...(summary?.score_distribution || []).map(b => b.count)),
        [summary]
    );

    const filteredStudents = useMemo(() => {
        const rows = summary?.students || [];
        const term = studentSearch.trim().toLocaleLowerCase('tr');
        if (!term) return rows;
        return rows.filter(s =>
            (s.full_name || '').toLocaleLowerCase('tr').includes(term) ||
            (s.student_number || '').includes(term)
        );
    }, [summary, studentSearch]);

    if (isLoading && !summary) {
        return <div className="p-10 text-center text-slate-500 animate-pulse">EduInsight analitiği hesaplanıyor...</div>;
    }

    return (
        <div className="space-y-8 animate-in fade-in duration-500 pb-20">
            {/* Header */}
            <div className="flex flex-col lg:flex-row justify-between items-start lg:items-end gap-6 bg-gradient-to-r from-blue-900/20 to-emerald-900/20 p-8 rounded-3xl border border-white/5 relative overflow-hidden">
                <div className="relative z-10">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="p-2.5 rounded-xl bg-primary/15 text-primary border border-primary/20">
                            <BrainCircuit size={24} />
                        </div>
                        <h1 className="text-4xl font-black text-white">EduInsight</h1>
                    </div>
                    <p className="text-slate-400 text-lg max-w-xl">
                        Sınıfınızın genel başarısını, Sokratik gelişimini ve yaygın kavram yanılgılarını tek ekrandan izleyin.
                    </p>
                </div>

                <div className="flex flex-wrap items-center gap-3 relative z-10">
                    <select
                        value={classFilter}
                        onChange={e => setClassFilter(e.target.value)}
                        className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-3 text-sm font-bold text-white focus:ring-2 focus:ring-primary outline-none"
                    >
                        <option value="all">Tüm Sınıflar</option>
                        {(summary?.class_options || []).map(c => (
                            <option key={c} value={c}>{c} Sınıfı</option>
                        ))}
                    </select>
                    <button
                        onClick={() => setReloadKey(k => k + 1)}
                        disabled={isLoading}
                        className="bg-white/10 hover:bg-white/20 disabled:opacity-50 text-white px-5 py-3 rounded-xl flex items-center gap-2 font-bold backdrop-blur-sm transition-all active:scale-95"
                    >
                        <RotateCw size={18} className={isLoading ? 'animate-spin' : ''} />
                        Yenile
                    </button>
                </div>

                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/20 blur-[100px] rounded-full pointer-events-none -translate-y-1/2 translate-x-1/2"></div>
            </div>

            {error && (
                <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 px-6 py-4 rounded-2xl text-sm font-medium">
                    {error}
                </div>
            )}

            {/* KPI Cards */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
                <StatCard
                    title="Sınıf Ortalaması"
                    value={kpi ? kpi.class_average : 0}
                    subtext={`%${kpi?.success_rate ?? 0} başarı (≥70)`}
                    icon={Gauge}
                    color="text-blue-500"
                />
                <StatCard
                    title="Aktif Ödev"
                    value={kpi?.active_assignments ?? 0}
                    subtext={`toplam ${kpi?.total_assignments ?? 0} ödev`}
                    icon={Layers}
                    color="text-purple-500"
                />
                <StatCard
                    title="Değerlendirilen Teslim"
                    value={kpi?.graded_submissions ?? 0}
                    subtext={`${kpi?.participating_students ?? 0}/${kpi?.total_students ?? 0} öğrenci`}
                    icon={ClipboardCheck}
                    color="text-emerald-500"
                />
                <StatCard
                    title="Sokratik Destek Oranı"
                    value={`%${kpi?.socratic_support_rate ?? 0}`}
                    subtext="doğrudan çözüm verilmeden"
                    icon={MessageCircleQuestion}
                    color="text-orange-500"
                />
            </div>

            {/* Tabs */}
            <div className="flex flex-wrap gap-2 bg-dark-800 p-1.5 rounded-2xl border border-dark-700 w-full lg:w-fit">
                {TABS.map(tab => {
                    const Icon = tab.icon;
                    const isActive = activeTab === tab.id;
                    return (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl text-sm font-bold transition-all ${isActive
                                ? 'bg-primary/20 text-primary border border-primary/30'
                                : 'text-slate-400 border border-transparent hover:bg-dark-700 hover:text-white'
                                }`}
                        >
                            <Icon size={16} />
                            {tab.label}
                        </button>
                    );
                })}
            </div>

            {activeTab === 'overview' && (
                <div className="space-y-6">
                    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                        {/* Score distribution */}
                        <div className="lg:col-span-2 bg-dark-800 rounded-2xl border border-dark-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <BarChart3 size={20} className="text-primary" />
                                Puan Dağılımı
                            </h3>
                            <div className="space-y-4">
                                {(summary?.score_distribution || []).map(bucket => (
                                    <div key={bucket.label} className="flex items-center gap-4">
                                        <span className="w-16 text-xs font-black text-slate-500 tracking-wider">{bucket.label}</span>
                                        <div className="flex-1 h-3 bg-dark-900 rounded-full overflow-hidden">
                                            <div
                                                className={`h-full bg-gradient-to-r ${bucketGradient(bucket.label)} rounded-full transition-all duration-700`}
                                                style={{ width: `${(bucket.count / maxBucketCount) * 100}%` }}
                                            ></div>
                                        </div>
                                        <span className="w-24 text-right text-xs text-slate-400 font-mono">
                                            {bucket.count} ödev · %{bucket.share}
                                        </span>
                                    </div>
                                ))}
                                {!summary?.score_distribution?.some(b => b.count > 0) && (
                                    <p className="text-slate-500 text-sm italic py-6">Henüz değerlendirilmiş teslim yok.</p>
                                )}
                            </div>
                        </div>

                        {/* Socratic impact */}
                        <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <TrendingUp size={20} className="text-emerald-500" />
                                Sokratik Etki
                            </h3>
                            <div className="space-y-5">
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Ortalama Deneme</p>
                                    <p className="text-2xl font-black text-white">{kpi?.average_attempts ?? 0}</p>
                                    <p className="text-xs text-slate-500 mt-1">bir ödevi tamamlamak için</p>
                                </div>
                                <div className="h-px bg-dark-700"></div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">İlk Denemede Başarı</p>
                                    <p className="text-2xl font-black text-white">%{kpi?.first_attempt_success_rate ?? 0}</p>
                                    <p className="text-xs text-slate-500 mt-1">ipucu almadan 70+ puan</p>
                                </div>
                                <div className="h-px bg-dark-700"></div>
                                <div>
                                    <p className="text-xs text-slate-500 font-bold uppercase tracking-wider mb-1">Ortalama Puan Kazancı</p>
                                    <p className="text-2xl font-black text-emerald-400">+{kpi?.average_improvement ?? 0}</p>
                                    <p className="text-xs text-slate-500 mt-1">tekrar denenen ödevlerde</p>
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Top misconceptions preview */}
                        <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <AlertTriangle size={20} className="text-amber-500" />
                                En Sık Görülen Hatalar
                            </h3>
                            <div className="space-y-4">
                                {(summary?.misconceptions || []).slice(0, 5).map(item => (
                                    <div key={item.error_type}>
                                        <div className="flex justify-between mb-1.5">
                                            <span className="text-white text-sm font-medium">{item.label}</span>
                                            <span className="text-slate-400 text-xs font-mono">{item.count} kez</span>
                                        </div>
                                        <div className="h-2 w-full bg-dark-900 rounded-full overflow-hidden">
                                            <div
                                                className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full opacity-80"
                                                style={{ width: `${item.share}%` }}
                                            ></div>
                                        </div>
                                    </div>
                                ))}
                                {(summary?.misconceptions || []).length === 0 && (
                                    <p className="text-slate-500 text-sm italic py-6">Henüz kayda değer bir hata örüntüsü tespit edilmedi.</p>
                                )}
                            </div>
                            {(summary?.misconceptions || []).length > 5 && (
                                <button
                                    onClick={() => setActiveTab('misconceptions')}
                                    className="mt-6 text-primary text-xs font-black uppercase tracking-widest flex items-center gap-1 hover:gap-2 transition-all"
                                >
                                    Tümünü Gör <ArrowUpRight size={14} />
                                </button>
                            )}
                        </div>

                        {/* Hardest assignments */}
                        <div className="bg-dark-800 rounded-2xl border border-dark-700 p-6">
                            <h3 className="text-lg font-bold text-white mb-6 flex items-center gap-2">
                                <Target size={20} className="text-rose-500" />
                                En Çok Zorlanılan Ödevler
                            </h3>
                            <div className="space-y-3">
                                {(summary?.assignments || []).slice(0, 5).map(item => (
                                    <div
                                        key={item.assignment_id}
                                        className="flex items-center justify-between gap-4 p-3 hover:bg-dark-700/50 rounded-xl transition-colors"
                                    >
                                        <div className="min-w-0">
                                            <p className="text-white text-sm font-medium truncate">{item.title}</p>
                                            <p className="text-xs text-slate-500 mt-0.5">
                                                {item.student_count} öğrenci · %{item.success_rate} başarı
                                            </p>
                                        </div>
                                        <span className={`px-3 py-1.5 rounded-lg text-sm font-black border tracking-tight shrink-0 ${scoreTone(item.average_score)}`}>
                                            {item.average_score}
                                        </span>
                                    </div>
                                ))}
                                {(summary?.assignments || []).length === 0 && (
                                    <p className="text-slate-500 text-sm italic py-6">Henüz teslim alınmış bir ödev yok.</p>
                                )}
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {activeTab === 'misconceptions' && (
                <div className="space-y-4">
                    {(summary?.misconceptions || []).length === 0 && (
                        <EmptyState message="Yapay zeka henüz sınıf genelinde tekrar eden bir hata örüntüsü tespit etmedi." />
                    )}
                    {(summary?.misconceptions || []).map(item => (
                        <div key={item.error_type} className="bg-dark-800 rounded-2xl border border-dark-700 p-6 hover:border-dark-600 transition-all">
                            <div className="flex flex-wrap items-start justify-between gap-4">
                                <div className="min-w-0">
                                    <h4 className="text-lg font-bold text-white">{item.label}</h4>
                                    <p className="text-xs text-slate-500 font-mono mt-1">{item.error_type}</p>
                                </div>
                                <div className="flex items-center gap-6 shrink-0">
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-white">{item.count}</p>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tekrar</p>
                                    </div>
                                    <div className="text-right">
                                        <p className="text-2xl font-black text-primary">{item.student_count}</p>
                                        <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Öğrenci</p>
                                    </div>
                                </div>
                            </div>

                            <div className="h-2 w-full bg-dark-900 rounded-full overflow-hidden mt-5">
                                <div
                                    className="h-full bg-gradient-to-r from-amber-500 to-rose-500 rounded-full"
                                    style={{ width: `${item.share}%` }}
                                ></div>
                            </div>
                            <p className="text-xs text-slate-500 mt-2">Tüm hataların %{item.share}'i</p>

                            <div className="flex flex-wrap gap-2 mt-4">
                                {SEVERITY_ORDER.filter(sev => item.severity_counts[sev]).map(sev => (
                                    <span
                                        key={sev}
                                        className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${SEVERITY_STYLES[sev]}`}
                                    >
                                        {SEVERITY_LABELS[sev]} · {item.severity_counts[sev]}
                                    </span>
                                ))}
                            </div>

                            {item.sample_misconceptions.length > 0 && (
                                <div className="mt-5 space-y-2">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest">Tespit Edilen Kavram Yanılgıları</p>
                                    {item.sample_misconceptions.map((text, idx) => (
                                        <p key={idx} className="text-sm text-slate-400 italic bg-dark-900/50 border border-dark-700 rounded-xl px-4 py-3 leading-relaxed">
                                            "{text}"
                                        </p>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {activeTab === 'students' && (
                <div className="space-y-4">
                    <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
                        <div className="relative flex-1 md:max-w-sm w-full">
                            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
                            <input
                                type="text"
                                placeholder="Öğrenci Ara..."
                                className="w-full bg-dark-800 border border-dark-700 rounded-xl py-2.5 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                                value={studentSearch}
                                onChange={e => setStudentSearch(e.target.value)}
                            />
                        </div>
                        <div className="text-sm text-slate-500 font-bold uppercase tracking-widest bg-dark-800 px-4 py-2.5 rounded-xl border border-dark-700">
                            {filteredStudents.length} ÖĞRENCİ
                        </div>
                    </div>

                    <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden shadow-2xl overflow-x-auto">
                        <table className="w-full text-left min-w-[900px]">
                            <thead className="bg-dark-700/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">
                                <tr>
                                    <th className="px-6 py-5">Öğrenci</th>
                                    <th className="px-6 py-5">Sınıf</th>
                                    <th className="px-6 py-5 text-center">Teslim</th>
                                    <th className="px-6 py-5 text-center">Ortalama</th>
                                    <th className="px-6 py-5 text-center">Son Puan</th>
                                    <th className="px-6 py-5 text-center">Gelişim</th>
                                    <th className="px-6 py-5 text-center">Başarı Denemesi</th>
                                    <th className="px-6 py-5">En Sık Hatası</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-dark-700/50">
                                {filteredStudents.map(student => (
                                    <tr key={student.user_id} className="hover:bg-dark-700/40 transition-colors">
                                        <td className="px-6 py-5">
                                            <p className="text-white font-bold">{student.full_name}</p>
                                            <p className="text-slate-500 font-mono text-xs mt-0.5">{student.student_number}</p>
                                        </td>
                                        <td className="px-6 py-5 text-slate-400 text-sm">{student.class_code || '—'}</td>
                                        <td className="px-6 py-5 text-center text-slate-300 font-mono text-sm">{student.submission_count}</td>
                                        <td className="px-6 py-5 text-center">
                                            {student.submission_count > 0 ? (
                                                <span className={`px-3 py-1.5 rounded-lg text-sm font-black border tracking-tight ${scoreTone(student.average_score)}`}>
                                                    {student.average_score}
                                                </span>
                                            ) : (
                                                <span className="text-slate-600 text-sm">—</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-center text-slate-300 font-mono text-sm">
                                            {student.latest_score ?? '—'}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {student.improvement > 0 ? (
                                                <span className="inline-flex items-center gap-1 text-emerald-400 font-bold text-sm">
                                                    <ArrowUpRight size={14} />+{student.improvement}
                                                </span>
                                            ) : student.improvement < 0 ? (
                                                <span className="inline-flex items-center gap-1 text-rose-400 font-bold text-sm">
                                                    <ArrowDownRight size={14} />{student.improvement}
                                                </span>
                                            ) : (
                                                <span className="inline-flex items-center gap-1 text-slate-600 text-sm">
                                                    <Minus size={14} />
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-center">
                                            {student.attempts_to_success ? (
                                                <span className="inline-block whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border bg-primary/10 text-primary border-primary/20">
                                                    {student.attempts_to_success}. DENEME
                                                </span>
                                            ) : (
                                                <span className="inline-block whitespace-nowrap px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border bg-slate-500/10 text-slate-500 border-slate-500/20">
                                                    HENÜZ YOK
                                                </span>
                                            )}
                                        </td>
                                        <td className="px-6 py-5 text-slate-400 text-sm">{student.top_error_label || '—'}</td>
                                    </tr>
                                ))}
                                {filteredStudents.length === 0 && (
                                    <tr>
                                        <td colSpan={8} className="px-8 py-20 text-center text-slate-500 italic">
                                            Aranan kriterlere uygun öğrenci bulunamadı.
                                        </td>
                                    </tr>
                                )}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
};
