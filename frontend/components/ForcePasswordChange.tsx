import React, { useState } from 'react';
import { KeyRound, Loader2, Lock, LogOut } from 'lucide-react';
import { API_BASE_URL } from '../config';

interface Props {
  token: string;
  onDone: () => void;
  onLogout: () => void;
}

/**
 * YAYIN 016: ilk girişte parola değişimi zorunlu. Varsayılan parola öğrenci numarası
 * olduğundan, değiştirilmezse sınıf arkadaşı başkasının hesabıyla giriş yapabilir ve
 * o öğrencinin teslim/log verisi güvenilir olmaktan çıkar.
 */
export const ForcePasswordChange: React.FC<Props> = ({ token, onDone, onLogout }) => {
  const [oldPassword, setOldPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) {
      setError('Yeni şifre en az 6 karakter olmalı.');
      return;
    }
    if (newPassword !== confirm) {
      setError('Yeni şifreler eşleşmiyor.');
      return;
    }
    setIsLoading(true);
    try {
      const res = await fetch(`${API_BASE_URL}/users/change-password`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
        body: JSON.stringify({ oldPassword, newPassword }),
      });
      if (res.ok) {
        onDone();
        return;
      }
      const data = await res.json().catch(() => ({}));
      setError(typeof data.detail === 'string' ? data.detail : 'Şifre değiştirilemedi.');
    } catch {
      setError('Sunucu ile bağlantı kurulamadı.');
    } finally {
      setIsLoading(false);
    }
  };

  const inputClass =
    'w-full bg-dark-900 border border-dark-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition-all';

  return (
    <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
      <div className="max-w-md w-full bg-dark-800 rounded-2xl border border-dark-700 p-8 shadow-2xl">
        <div className="text-center mb-6">
          <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary">
            <KeyRound size={32} />
          </div>
          <h1 className="text-2xl font-bold text-white mb-2">Şifrenizi Belirleyin</h1>
          <p className="text-slate-400 text-sm">
            İlk girişte varsayılan şifrenizi (öğrenci numaranız) değiştirmeniz gerekiyor.
            Yeni şifreniz en az 6 karakter olmalı ve öğrenci numaranızdan farklı olmalı.
          </p>
        </div>

        {error && (
          <div className="bg-red-500/10 border border-red-500/20 text-red-500 p-3 rounded-lg mb-4 text-sm font-medium">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          {[
            { label: 'Mevcut Şifre', value: oldPassword, set: setOldPassword },
            { label: 'Yeni Şifre', value: newPassword, set: setNewPassword },
            { label: 'Yeni Şifre (Tekrar)', value: confirm, set: setConfirm },
          ].map(field => (
            <div key={field.label}>
              <label className="block text-sm text-slate-400 mb-1 ml-1">{field.label}</label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 text-slate-500" size={18} />
                <input
                  type="password"
                  required
                  className={inputClass}
                  value={field.value}
                  onChange={e => field.set(e.target.value)}
                />
              </div>
            </div>
          ))}

          <button
            type="submit"
            disabled={isLoading}
            className="w-full bg-primary hover:bg-primary/90 text-white font-semibold py-3 rounded-xl transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed mt-2"
          >
            {isLoading ? <Loader2 className="animate-spin" size={20} /> : 'Şifreyi Kaydet'}
          </button>
        </form>

        <button
          onClick={onLogout}
          className="w-full mt-4 py-2 text-slate-400 hover:text-white text-sm font-medium transition-colors flex items-center justify-center gap-2"
        >
          <LogOut size={16} /> Çıkış Yap
        </button>
      </div>
    </div>
  );
};
