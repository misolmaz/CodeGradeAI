import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';
import { API_BASE_URL } from '../config';


export const TeacherDashboard = () => {
    const { token, logout } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);
    const [students, setStudents] = useState<any[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    const fetchStudents = async () => {
        if (!token) return;
        setIsLoading(true);
        try {
            const response = await fetch(`${API_BASE_URL}/admin/students`, {

                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (response.ok) {
                const data = await response.json();
                setStudents(data);
            }
        } catch (error) {
            console.error("Öğrenciler yüklenemedi:", error);
        } finally {
            setIsLoading(false);
        }
    };

    React.useEffect(() => {
        fetchStudents();
    }, [token]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setFile(e.target.files[0]);
            setUploadResult(null);
        }
    };

    const handleUpload = async () => {
        if (!file || !token) return;
        setIsUploading(true);

        const formData = new FormData();
        formData.append('file', file);

        try {
            const response = await fetch(`${API_BASE_URL}/admin/upload-students`, {

                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${token}`
                },
                body: formData
            });

            if (!response.ok) throw new Error('Yükleme başarısız oldu.');

            const data = await response.json();
            setUploadResult(data);
            setFile(null); // Reset file input
            fetchStudents(); // Refresh list
        } catch (error) {
            alert("Dosya yüklenirken hata oluştu.");
        } finally {
            setIsUploading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="bg-dark-800 p-8 rounded-xl border border-dark-700">
                <h2 className="text-2xl font-bold text-white mb-2">Öğretmen Paneli</h2>
                <p className="text-slate-400 mb-6">Sınıf listesini yükleyerek öğrencileri sisteme kaydedin.</p>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    <div>
                        <div className="border-2 border-dashed border-dark-600 rounded-xl p-8 flex flex-col items-center justify-center bg-dark-900/50 hover:bg-dark-900 transition-all group">
                            <Upload className="text-slate-500 mb-4 group-hover:text-primary transition-colors" size={48} />
                            <p className="text-slate-300 font-medium mb-2 text-center">Excel Dosyasını Buraya Sürükleyin veya Seçin</p>
                            <p className="text-xs text-slate-500 mb-6 font-mono">OgrenciNo, Ad, Soyad, Sinif</p>

                            <input
                                type="file"
                                accept=".xlsx, .xls"
                                onChange={handleFileChange}
                                className="hidden"
                                id="file-upload"
                            />
                            <label
                                htmlFor="file-upload"
                                className="px-6 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg cursor-pointer transition-colors border border-dark-600">
                                {file ? file.name : 'Dosya Seç'}
                            </label>

                            {file && (
                                <button
                                    onClick={handleUpload}
                                    disabled={isUploading}
                                    className="mt-4 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 disabled:opacity-50 shadow-lg shadow-primary/20">
                                    {isUploading ? <Loader2 className="animate-spin" size={18} /> : 'Yüklemeyi Başlat'}
                                </button>
                            )}
                        </div>

                        {uploadResult && (
                            <div className="mt-6 bg-green-500/10 border border-green-500/20 p-4 rounded-xl animate-in fade-in slide-in-from-top-2">
                                <h4 className="flex items-center gap-2 text-green-400 font-bold mb-2">
                                    <CheckCircle2 size={20} /> İşlem Başarılı
                                </h4>
                                <div className="text-sm text-slate-300">
                                    <p>Eklenen: {uploadResult.details.added}</p>
                                    <p>Atlanan: {uploadResult.details.skipped}</p>
                                    {uploadResult.details.errors.length > 0 && (
                                        <div className="mt-2 text-red-400">
                                            <p className="font-bold">Hatalar:</p>
                                            <ul className="list-disc ml-4 text-xs">
                                                {uploadResult.details.errors.map((err: string, idx: number) => (
                                                    <li key={idx}>{err}</li>
                                                ))}
                                            </ul>
                                        </div>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    <div className="bg-dark-900/50 rounded-xl border border-dark-700 overflow-hidden flex flex-col">
                        <div className="p-4 border-b border-dark-700 flex justify-between items-center bg-dark-800/30">
                            <h3 className="text-white font-bold flex items-center gap-2">
                                <CheckCircle2 className="text-primary" size={18} />
                                Kayıtlı Öğrenciler
                            </h3>
                            <span className="text-xs bg-dark-700 text-slate-400 px-2 py-1 rounded-full">{students.length} Öğrenci</span>
                        </div>
                        <div className="overflow-y-auto max-h-[400px] divide-y divide-dark-700/50">
                            {isLoading ? (
                                <div className="flex items-center justify-center p-8 text-slate-500">
                                    <Loader2 className="animate-spin mr-2" size={20} /> Yükleniyor...
                                </div>
                            ) : students.length > 0 ? (
                                students.map((s) => (
                                    <div key={s.id} className="p-4 hover:bg-dark-800 transition-colors flex justify-between items-center group">
                                        <div>
                                            <div className="text-sm font-semibold text-white group-hover:text-primary transition-colors">{s.full_name}</div>
                                            <div className="text-xs text-slate-500 font-mono">No: {s.student_number} | Sınıf: {s.class_code}</div>
                                        </div>
                                        <div className="w-8 h-8 rounded-full bg-dark-700 flex items-center justify-center text-[10px] text-slate-400 uppercase">
                                            {s.full_name.split(' ').map((n: string) => n[0]).join('')}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="p-8 text-center text-slate-500 text-sm italic">
                                    Henüz öğrenci kaydı yok.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );

};
