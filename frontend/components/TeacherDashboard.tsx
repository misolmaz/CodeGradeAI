import React, { useState } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Upload, FileValues, CheckCircle2, AlertCircle, Loader2 } from 'lucide-react';

export const TeacherDashboard = () => {
    const { token, logout } = useAuth();
    const [file, setFile] = useState<File | null>(null);
    const [isUploading, setIsUploading] = useState(false);
    const [uploadResult, setUploadResult] = useState<any>(null);

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
            const response = await fetch('http://localhost:8000/admin/upload-students', {
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

                <div className="border-2 border-dashed border-dark-600 rounded-xl p-8 flex flex-col items-center justify-center bg-dark-900/50 hover:bg-dark-900 transition-colors">
                    <Upload className="text-slate-500 mb-4" size={48} />
                    <p className="text-slate-300 font-medium mb-2">Excel Dosyasını Buraya Sürükleyin veya Seçin</p>
                    <p className="text-xs text-slate-500 mb-6">OgrenciNo, Ad, Soyad, Sinif sütunları gereklidir.</p>

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
                            className="mt-4 px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
                            {isUploading ? <Loader2 className="animate-spin" size={18} /> : 'Yüklemeyi Başlat'}
                        </button>
                    )}
                </div>

                {uploadResult && (
                    <div className="mt-6 bg-green-500/10 border border-green-500/20 p-4 rounded-xl">
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
        </div>
    );
};
