import React, { useEffect, useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { API_BASE_URL } from '../config';
import { Trophy, Medal, Flame, Target, Star, Crown, Shield } from 'lucide-react';

export interface LeaderboardEntry {
    rank: number;
    username: string;
    full_name: string;
    avatar_url?: string;
    total_xp: number;
    average_score: number;
    completed_tasks: number;
    streak: boolean;
    badges: string[];
}

export const Leaderboard = () => {
    const { token, user_id, username: currentUsername } = useAuth(); // Assuming username is stored in auth context
    const [leaderboard, setLeaderboard] = useState<LeaderboardEntry[]>([]);
    const [isLoading, setIsLoading] = useState(true);
    const [filterClass, setFilterClass] = useState<string>('');

    useEffect(() => {
        fetchLeaderboard();
    }, [filterClass]);

    const fetchLeaderboard = async () => {
        try {
            setIsLoading(true);
            const url = filterClass
                ? `${API_BASE_URL}/leaderboard/?class_code=${filterClass}`
                : `${API_BASE_URL}/leaderboard/`;

            const res = await fetch(url, {
                headers: { 'Authorization': `Bearer ${token}` }
            });

            if (res.ok) {
                const data = await res.json();
                setLeaderboard(data);
            }
        } catch (error) {
            console.error(error);
        } finally {
            setIsLoading(false);
        }
    };

    const currentUserEntry = leaderboard.find(e => e.username === currentUsername);

    const getRankIcon = (rank: number) => {
        if (rank === 1) return <Crown className="text-yellow-400 drop-shadow-glow" size={24} fill="currentColor" />;
        if (rank === 2) return <Medal className="text-slate-300" size={24} />;
        if (rank === 3) return <Medal className="text-amber-700" size={24} />;
        return <span className="font-bold text-slate-500 w-6 text-center">{rank}</span>;
    };

    const getRowStyle = (rank: number) => {
        if (rank === 1) return "bg-gradient-to-r from-yellow-500/10 to-transparent border-yellow-500/30";
        if (rank === 2) return "bg-gradient-to-r from-slate-400/10 to-transparent border-slate-500/30";
        if (rank === 3) return "bg-gradient-to-r from-amber-700/10 to-transparent border-amber-700/30";
        return "bg-dark-800 border-dark-700 hover:border-dark-600";
    };

    return (
        <div className="space-y-6 animate-in fade-in duration-500 pb-24">
            <div className="flex flex-col md:flex-row justify-between items-end md:items-center gap-4">
                <div>
                    <h2 className="text-2xl font-bold text-white flex items-center gap-3">
                        <Trophy className="text-yellow-500" />
                        Liderlik Tablosu
                    </h2>
                    <p className="text-slate-400 text-sm mt-1">En yüksek XP toplayan öğrenciler ve başarı sıralaması</p>
                </div>

                <div className="flex bg-dark-800 p-1 rounded-lg border border-dark-700">
                    <button
                        onClick={() => setFilterClass('')}
                        className={`px-4 py-1.5 rounded-md text-sm font-medium transition-all ${!filterClass ? 'bg-primary text-white shadow-lg' : 'text-slate-400 hover:text-white'}`}
                    >
                        Tüm Okul
                    </button>
                    {/* Assuming we might want to filter by user's class dynamically later, 
                        for now allowing generic filtering or hardcoded if necessary. 
                        Ideally, we would fetch available classes. Leaving as single filter for now. 
                    */}
                </div>
            </div>

            <div className="grid grid-cols-1 gap-4">
                {isLoading ? (
                    <div className="text-center py-20 text-slate-500">Yükleniyor...</div>
                ) : (
                    leaderboard.map((entry) => (
                        <div
                            key={entry.username}
                            className={`relative p-4 rounded-xl border transition-all group ${getRowStyle(entry.rank)} flex items-center gap-4 sm:gap-6`}
                        >
                            <div className="flex-shrink-0 flex items-center justify-center w-12 h-12 bg-dark-900/50 rounded-full border border-dark-700">
                                {getRankIcon(entry.rank)}
                            </div>

                            <div className="flex-shrink-0">
                                <div className="w-12 h-12 rounded-full overflow-hidden border-2 border-dark-600">
                                    <img
                                        src={entry.avatar_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${entry.username}`}
                                        alt={entry.full_name}
                                        className="w-full h-full object-cover"
                                    />
                                </div>
                            </div>

                            <div className="flex-1 min-w-0">
                                <h3 className="text-white font-bold truncate flex items-center gap-2">
                                    {entry.full_name}
                                    {entry.username === currentUsername && <span className="text-[10px] bg-primary/20 text-primary px-2 py-0.5 rounded-full">SEN</span>}
                                </h3>
                                <div className="flex items-center gap-4 text-xs text-slate-400 mt-1">
                                    <span className="flex items-center gap-1" title="Ortalama Başarı">
                                        <Target size={14} /> %{entry.average_score}
                                    </span>
                                    <span className="flex items-center gap-1" title="Tamamlanan Görev">
                                        <Shield size={14} /> {entry.completed_tasks} Görev
                                    </span>
                                    {entry.streak && (
                                        <span className="flex items-center gap-1 text-orange-400 font-bold" title="Haftalık Seri">
                                            <Flame size={14} /> Streak!
                                        </span>
                                    )}
                                </div>
                            </div>

                            <div className="text-right flex-shrink-0">
                                <div className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-3 py-1 rounded-lg text-sm font-black shadow-lg shadow-purple-900/20">
                                    {entry.total_xp} XP
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Sticky Current User Row */}
            {currentUserEntry && (
                <div className="fixed bottom-0 left-0 md:left-64 right-0 p-4 bg-dark-900/80 backdrop-blur-md border-t border-dark-700 flex justify-center z-40">
                    <div className="w-full max-w-4xl bg-primary/10 border border-primary/20 p-4 rounded-xl flex items-center justify-between gap-4 shadow-2xl shadow-primary/10">
                        <div className="flex items-center gap-4">
                            <span className="font-black text-xl text-white">#{currentUserEntry.rank}</span>
                            <div>
                                <h4 className="font-bold text-white text-sm">Senin Sıralaman</h4>
                                <p className="text-primary text-xs flex items-center gap-1">
                                    {currentUserEntry.total_xp} XP ile yarıştasın
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-4">
                            <div className="text-center">
                                <span className="block text-xs text-slate-400 uppercase font-bold">Ortalama</span>
                                <span className="font-bold text-white">%{currentUserEntry.average_score}</span>
                            </div>
                            <div className="text-center">
                                <span className="block text-xs text-slate-400 uppercase font-bold">Görev</span>
                                <span className="font-bold text-white">{currentUserEntry.completed_tasks}</span>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};
