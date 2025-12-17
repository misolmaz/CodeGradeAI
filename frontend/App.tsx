import React, { useState, useEffect } from 'react';
import { User, UserRole, Assignment, Announcement, Submission, GradingResult } from './types';
import { MOCK_USERS } from './constants';
import { Layout } from './components/Layout';
import { gradeSubmission } from './services/geminiService';
import { db } from './services/persistence';
import {
  Plus, Calendar, Clock, CheckCircle2, AlertCircle, FileCode,
  ChevronRight, Award, Activity, Search, X, GraduationCap, Trash2
} from 'lucide-react';

// --- Sub-components defined here for simplicity of single-file constraint in prompt ---

const LoginScreen = ({ onLogin }: { onLogin: (role: UserRole) => void }) => (
  <div className="min-h-screen bg-dark-900 flex items-center justify-center p-4">
    <div className="max-w-md w-full bg-dark-800 rounded-2xl border border-dark-700 p-8 shadow-2xl">
      <div className="text-center mb-8">
        <div className="w-16 h-16 bg-primary/20 rounded-xl flex items-center justify-center mx-auto mb-4 text-primary">
          <FileCode size={32} />
        </div>
        <h1 className="text-3xl font-bold text-white mb-2">CodeGrade AI</h1>
        <p className="text-slate-400">Akıllı Kod Değerlendirme Sistemi</p>
      </div>

      <div className="space-y-4">
        <button
          onClick={() => onLogin(UserRole.TEACHER)}
          className="w-full p-4 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-xl flex items-center gap-4 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-blue-500/20 flex items-center justify-center text-blue-400 group-hover:scale-110 transition-transform">
            <Award size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-white font-semibold">Öğretim Üyesi Girişi</h3>
            <p className="text-sm text-slate-400">Ödev yönetimi ve analiz</p>
          </div>
          <ChevronRight className="ml-auto text-slate-500" />
        </button>

        <button
          onClick={() => onLogin(UserRole.STUDENT)}
          className="w-full p-4 bg-dark-700 hover:bg-dark-600 border border-dark-600 rounded-xl flex items-center gap-4 transition-all group"
        >
          <div className="w-12 h-12 rounded-full bg-emerald-500/20 flex items-center justify-center text-emerald-400 group-hover:scale-110 transition-transform">
            <FileCode size={24} />
          </div>
          <div className="text-left">
            <h3 className="text-white font-semibold">Öğrenci Girişi</h3>
            <p className="text-sm text-slate-400">Ödev yükleme ve sonuçlar</p>
          </div>
          <ChevronRight className="ml-auto text-slate-500" />
        </button>
      </div>
    </div>
  </div>
);

// --- Main App ---

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [currentView, setCurrentView] = useState('home');

  // Initialize state from local storage (db service)
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);

  useEffect(() => {
    // Load data on mount
    setAssignments(db.getAssignments());
    setSubmissions(db.getSubmissions());
    setAnnouncements(db.getAnnouncements());
  }, []);

  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  const [codeDraft, setCodeDraft] = useState('');
  const [isGrading, setIsGrading] = useState(false);

  // Create Assignment State
  const [newAssignmentData, setNewAssignmentData] = useState<Partial<Assignment>>({
    title: '',
    description: '',
    language: '',
    dueDate: '',
    studentLevel: 'intermediate'
  });

  const handleLogin = (role: UserRole) => {
    const mockUser = MOCK_USERS.find(u => u.role === role);
    if (mockUser) {
      setUser(mockUser);
      // Reset UI state to ensure clean start for the user
      setCurrentView('home');
      setSelectedAssignment(null);
      setSelectedSubmission(null);
      setIsModalOpen(false);
    }
  };

  const handleCreateAssignment = () => {
    if (!newAssignmentData.title || !newAssignmentData.dueDate) return;
    const newAssignment: Assignment = {
      id: Math.random().toString(36).substr(2, 9),
      title: newAssignmentData.title!,
      description: newAssignmentData.description || '',
      language: newAssignmentData.language || 'text',
      dueDate: newAssignmentData.dueDate!,
      studentLevel: newAssignmentData.studentLevel || 'intermediate',
      status: 'active'
    };

    // Save to storage and update state
    const updatedAssignments = db.saveAssignment(newAssignment);
    setAssignments(updatedAssignments);

    setIsModalOpen(false);
    setNewAssignmentData({ title: '', description: '', language: '', dueDate: '', studentLevel: 'intermediate' });
  };

  const handleSubmitCode = async () => {
    if (!user || !selectedAssignment) return;
    setIsGrading(true);

    try {
      const gradingResult = await gradeSubmission(
        selectedAssignment.description,
        selectedAssignment.language,
        codeDraft,
        selectedAssignment.studentLevel // Use the level defined in assignment
      );

      if (gradingResult.grade === 0) {
        alert(gradingResult.feedback || "Değerlendirme sırasında bir hata oluştu.");
        return; // Stop execution, do not save submission
      }

      const newSubmission: Submission = {
        id: Math.random().toString(36).substr(2, 9),
        assignmentId: selectedAssignment.id,
        studentId: user.id,
        studentName: user.name,
        code: codeDraft,
        submittedAt: new Date().toISOString(),
        status: 'graded',
        gradingResult
      };

      // Save to storage and update state
      const updatedSubmissions = db.saveSubmission(newSubmission);
      setSubmissions(updatedSubmissions);

      setSelectedSubmission(newSubmission); // Show result immediately
      setIsModalOpen(false); // Close upload modal
    } catch (error) {
      alert("Grading failed. Please check your connection or API Key.");
    } finally {
      setIsGrading(false);
    }
  };

  const handleDeleteSubmission = (submissionId: string) => {
    if (window.confirm('Bu teslimi silmek istediğinize emin misiniz? Öğrenci tekrar ödev yükleyebilecek.')) {
      const updatedSubmissions = db.deleteSubmission(submissionId);
      setSubmissions(updatedSubmissions);
      if (selectedSubmission?.id === submissionId) {
        setSelectedSubmission(null);
      }
    }
  };

  // --- Views as Render Functions (fixes focus issues) ---

  const renderHomeView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 size={64} /></div>
          <h3 className="text-slate-400 text-sm font-medium uppercase">Aktif Ödevler</h3>
          <p className="text-3xl font-bold text-white mt-2">{assignments.filter(a => a.status === 'active').length}</p>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={64} /></div>
          <h3 className="text-slate-400 text-sm font-medium uppercase">Bekleyen Teslimler</h3>
          <p className="text-3xl font-bold text-white mt-2">
            {user?.role === UserRole.STUDENT
              ? assignments.filter(a => a.status === 'active' && !submissions.find(s => s.assignmentId === a.id && s.studentId === user.id)).length
              : submissions.length
            }
          </p>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Award size={64} /></div>
          <h3 className="text-slate-400 text-sm font-medium uppercase">Ortalama Not</h3>
          <p className="text-3xl font-bold text-white mt-2">
            {submissions.length > 0
              ? Math.round(submissions.reduce((acc, curr) => acc + (curr.gradingResult?.grade || 0), 0) / submissions.length)
              : '-'
            }
          </p>
        </div>
      </div>

      <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
        <div className="p-6 border-b border-dark-700 flex justify-between items-center">
          <h3 className="text-lg font-semibold text-white flex items-center gap-2">
            <AlertCircle size={20} className="text-primary" />
            Duyurular
          </h3>
        </div>
        <div className="divide-y divide-dark-700">
          {announcements.map(ann => (
            <div key={ann.id} className="p-6 hover:bg-dark-700/50 transition-colors">
              <div className="flex gap-4">
                <div className={`w-1 rounded-full ${ann.type === 'warning' ? 'bg-orange-500' : 'bg-primary'}`}></div>
                <div>
                  <h4 className="text-white font-medium mb-1">{ann.title}</h4>
                  <p className="text-slate-400 text-sm">{ann.content}</p>
                  <span className="text-xs text-slate-500 mt-2 block">{ann.date}</span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  const renderAssignmentsView = () => {
    const isTeacher = user?.role === UserRole.TEACHER;

    return (
      <div className="space-y-6">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white">Ödevler</h2>
          {isTeacher && (
            <button
              onClick={() => setIsModalOpen(true)}
              className="bg-primary hover:bg-primary/90 text-white px-4 py-2 rounded-lg flex items-center gap-2 transition-colors font-medium">
              <Plus size={20} />
              Yeni Ödev
            </button>
          )}
        </div>

        <div className="grid gap-4">
          {assignments.map(assignment => {
            const studentSubmission = user?.role === UserRole.STUDENT
              ? submissions.find(s => s.assignmentId === assignment.id && s.studentId === user.id)
              : null;

            const subCount = submissions.filter(s => s.assignmentId === assignment.id).length;

            return (
              <div key={assignment.id} className="bg-dark-800 p-6 rounded-xl border border-dark-700 hover:border-primary/50 transition-all group">
                <div className="flex justify-between items-start">
                  <div className="flex gap-4">
                    <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center text-primary">
                      <FileCode size={24} />
                    </div>
                    <div>
                      <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">{assignment.title}</h3>
                      <p className="text-slate-400 text-sm mb-2">{assignment.description}</p>
                      <div className="flex items-center gap-4 text-xs text-slate-500">
                        <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(assignment.dueDate).toLocaleDateString()}</span>
                        <span className="px-2 py-0.5 rounded-full bg-dark-700 text-slate-300 uppercase">{assignment.language}</span>
                        <span className={`px-2 py-0.5 rounded-full bg-dark-700 text-slate-300 uppercase border border-dark-600`}>
                          {assignment.studentLevel === 'beginner' ? '👶 Başlangıç' : assignment.studentLevel === 'intermediate' ? '🎓 Orta' : '🚀 İleri'}
                        </span>
                      </div>
                    </div>
                  </div>

                  {isTeacher ? (
                    <div className="text-right">
                      <p className="text-2xl font-bold text-white">{subCount}</p>
                      <p className="text-xs text-slate-400">Teslim</p>
                      <button
                        onClick={() => { setSelectedAssignment(assignment); setCurrentView('assignment_detail'); }}
                        className="mt-2 text-primary text-sm font-medium hover:underline">
                        Detaylar
                      </button>
                    </div>
                  ) : (
                    <div>
                      {studentSubmission ? (
                        <div className="flex flex-col items-end gap-2">
                          <span className="px-3 py-1 bg-green-500/10 text-green-400 rounded-full text-xs font-medium border border-green-500/20">
                            Tamamlandı
                          </span>
                          <button
                            onClick={() => setSelectedSubmission(studentSubmission)}
                            className="text-sm text-slate-400 hover:text-white">Sonucu Gör</button>
                        </div>
                      ) : (
                        <button
                          onClick={() => { setSelectedAssignment(assignment); setIsModalOpen(true); }}
                          className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm font-medium transition-colors border border-dark-600">
                          Yükle
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {assignments.length === 0 && (
            <div className="text-center py-12 text-slate-500 bg-dark-800/50 rounded-xl border border-dark-700 border-dashed">
              <FileCode size={48} className="mx-auto mb-4 opacity-50" />
              <p>Henüz ödev bulunmuyor.</p>
            </div>
          )}
        </div>

        {/* Create Assignment Modal */}
        {isModalOpen && isTeacher && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 w-full max-w-lg rounded-2xl border border-dark-700 shadow-2xl overflow-hidden">
              <div className="p-6 border-b border-dark-700 flex justify-between items-center">
                <h3 className="text-lg font-bold text-white">Yeni Ödev Oluştur</h3>
                <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
              </div>
              <div className="p-6 space-y-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Başlık</label>
                  <input
                    type="text"
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                    value={newAssignmentData.title}
                    onChange={e => setNewAssignmentData({ ...newAssignmentData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Açıklama</label>
                  <textarea
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none h-24"
                    value={newAssignmentData.description}
                    onChange={e => setNewAssignmentData({ ...newAssignmentData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Dil</label>
                    <select
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                      value={newAssignmentData.language}
                      onChange={e => setNewAssignmentData({ ...newAssignmentData, language: e.target.value })}
                    >
                      <option value="">Seçiniz</option>
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                      <option value="c++">C++</option>
                      <option value="csharp">C#</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm text-slate-400 mb-1">Son Tarih</label>
                    <input
                      type="date"
                      className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                      onChange={e => setNewAssignmentData({ ...newAssignmentData, dueDate: new Date(e.target.value).toISOString() })}
                    />
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Hedef Öğrenci Seviyesi</label>
                  <select
                    className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-white focus:ring-1 focus:ring-primary outline-none"
                    value={newAssignmentData.studentLevel}
                    onChange={(e: any) => setNewAssignmentData({ ...newAssignmentData, studentLevel: e.target.value })}
                  >
                    <option value="beginner">👶 Başlangıç (Beginner)</option>
                    <option value="intermediate">🎓 Orta Seviye (Intermediate)</option>
                    <option value="advanced">🚀 İleri Seviye (Advanced)</option>
                  </select>
                  <p className="text-xs text-slate-500 mt-1">
                    Yapay zeka bu seviyeye göre değerlendirme kriterlerini ve dilini ayarlayacaktır.
                  </p>
                </div>
              </div>
              <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">İptal</button>
                <button onClick={handleCreateAssignment} className="px-4 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg">Oluştur</button>
              </div>
            </div>
          </div>
        )}

        {/* Submit Code Modal (Student) */}
        {isModalOpen && !isTeacher && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 w-full max-w-2xl rounded-2xl border border-dark-700 shadow-2xl flex flex-col max-h-[90vh]">
              <div className="p-6 border-b border-dark-700 flex justify-between items-center">
                <div>
                  <h3 className="text-lg font-bold text-white">{selectedAssignment.title}</h3>
                  <p className="text-sm text-slate-400">{selectedAssignment.language}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)}><X className="text-slate-400 hover:text-white" /></button>
              </div>
              <div className="p-6 flex-1 overflow-y-auto">
                <p className="text-slate-300 mb-4 bg-dark-900 p-4 rounded-lg border border-dark-700 text-sm">
                  {selectedAssignment.description}
                </p>

                <div className="mb-4 bg-dark-900/50 p-3 rounded-lg border border-dark-700/50 flex items-start gap-3">
                  <div className="p-2 bg-primary/10 rounded-lg text-primary">
                    <GraduationCap size={20} />
                  </div>
                  <div>
                    <h4 className="text-sm font-semibold text-white">Beklenen Seviye: <span className="text-primary capitalize">{selectedAssignment.studentLevel}</span></h4>
                    <p className="text-xs text-slate-400 mt-1">
                      {selectedAssignment.studentLevel === "beginner" && "Temel kavramlara odaklanılacak ve basit bir dil kullanılacak."}
                      {selectedAssignment.studentLevel === "intermediate" && "Kod kalitesi ve optimizasyon değerlendirilecek."}
                      {selectedAssignment.studentLevel === "advanced" && "Profesyonel standartlar, performans ve güvenlik analiz edilecek."}
                    </p>
                  </div>
                </div>

                <label className="block text-sm font-medium text-white mb-2">Kodunuzu Buraya Yapıştırın</label>
                <textarea
                  className="w-full h-64 bg-[#0d1117] border border-dark-700 rounded-lg p-4 font-mono text-sm text-slate-300 focus:ring-1 focus:ring-primary outline-none resize-none"
                  placeholder="// Write your code here..."
                  value={codeDraft}
                  onChange={e => setCodeDraft(e.target.value)}
                />
              </div>
              <div className="p-6 border-t border-dark-700 flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="px-4 py-2 text-slate-400 hover:text-white">İptal</button>
                <button
                  onClick={handleSubmitCode}
                  disabled={isGrading || !codeDraft}
                  className="px-6 py-2 bg-primary hover:bg-primary/90 text-white rounded-lg flex items-center gap-2 disabled:opacity-50">
                  {isGrading ? <Activity className="animate-spin" size={18} /> : <FileCode size={18} />}
                  {isGrading ? 'AI Kontrol Ediyor...' : 'Kodu Gönder ve Test Et'}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  const renderAssignmentDetailView = () => {
    if (!selectedAssignment) return <div>Ödev bulunamadı</div>;

    const assignmentSubmissions = submissions.filter(s => s.assignmentId === selectedAssignment.id);

    return (
      <div className="space-y-6">
        <button onClick={() => setCurrentView('assignments')} className="text-slate-400 hover:text-white flex items-center gap-1 mb-4">
          <ChevronRight className="rotate-180" size={16} /> Geri Dön
        </button>

        <div className="bg-dark-800 p-8 rounded-xl border border-dark-700">
          <div className="flex justify-between items-start">
            <div>
              <h1 className="text-3xl font-bold text-white mb-2">{selectedAssignment.title}</h1>
              <p className="text-slate-400">{selectedAssignment.description}</p>
            </div>
            <span className="px-3 py-1 rounded-full bg-dark-700 border border-dark-600 text-slate-300 text-sm font-medium capitalize">
              {selectedAssignment.studentLevel} Seviye
            </span>
          </div>

          <div className="flex gap-4 mt-6">
            <div className="bg-dark-700 px-4 py-2 rounded-lg text-center">
              <span className="block text-xs text-slate-400 uppercase">Toplam Teslim</span>
              <span className="text-xl font-bold text-white">{assignmentSubmissions.length}</span>
            </div>
            <div className="bg-dark-700 px-4 py-2 rounded-lg text-center">
              <span className="block text-xs text-slate-400 uppercase">Ortalama Not</span>
              <span className="text-xl font-bold text-primary">
                {assignmentSubmissions.length > 0
                  ? Math.round(assignmentSubmissions.reduce((acc, s) => acc + (s.gradingResult?.grade || 0), 0) / assignmentSubmissions.length)
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-bold text-white mt-8 mb-4">Öğrenci Teslimleri</h3>
        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden">
          <table className="w-full text-left">
            <thead className="bg-dark-700/50 text-slate-400 text-xs uppercase">
              <tr>
                <th className="px-6 py-4 font-medium">Öğrenci</th>
                <th className="px-6 py-4 font-medium">Teslim Tarihi</th>
                <th className="px-6 py-4 font-medium">Not</th>
                <th className="px-6 py-4 font-medium text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700">
              {assignmentSubmissions.map(sub => (
                <tr key={sub.id} className="hover:bg-dark-700/30 transition-colors">
                  <td className="px-6 py-4 text-white font-medium">{sub.studentName}</td>
                  <td className="px-6 py-4 text-slate-400 text-sm">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                  <td className="px-6 py-4">
                    <span className={`px-2 py-1 rounded text-xs font-bold ${(sub.gradingResult?.grade || 0) >= 70 ? 'bg-green-500/10 text-green-400' :
                      (sub.gradingResult?.grade || 0) >= 50 ? 'bg-yellow-500/10 text-yellow-400' : 'bg-red-500/10 text-red-400'
                      }`}>
                      {sub.gradingResult?.grade || 0}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right flex items-center justify-end gap-3">
                    <button
                      onClick={() => setSelectedSubmission(sub)}
                      className="text-primary hover:text-white text-sm font-medium">
                      Raporu İncele
                    </button>
                    <button
                      onClick={() => handleDeleteSubmission(sub.id)}
                      className="text-red-500 hover:text-red-400 p-1 rounded hover:bg-red-500/10 transition-colors"
                      title="Teslimi Sil">
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {assignmentSubmissions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-6 py-8 text-center text-slate-500">Henüz teslim yapılmamış.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStudentsView = () => {
    // Basic analytics view for teachers
    const students = MOCK_USERS.filter(u => u.role === UserRole.STUDENT);

    return (
      <div className="space-y-6">
        <h2 className="text-2xl font-bold text-white">Öğrenci Analizi</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {students.map(student => {
            const studentSubs = submissions.filter(s => s.studentId === student.id);
            const avgGrade = studentSubs.length > 0
              ? Math.round(studentSubs.reduce((acc, s) => acc + (s.gradingResult?.grade || 0), 0) / studentSubs.length)
              : 0;

            return (
              <div key={student.id} className="bg-dark-800 p-6 rounded-xl border border-dark-700 flex flex-col items-center text-center hover:border-primary/50 transition-colors cursor-pointer">
                <img src={student.avatar} alt={student.name} className="w-20 h-20 rounded-full border-4 border-dark-700 mb-4" />
                <h3 className="text-lg font-bold text-white">{student.name}</h3>
                <p className="text-slate-400 text-sm mb-6">Öğrenci No: 2023{student.id}</p>

                <div className="grid grid-cols-2 gap-4 w-full">
                  <div className="bg-dark-900 p-3 rounded-lg">
                    <span className="block text-xs text-slate-500 uppercase mb-1">Teslimler</span>
                    <span className="text-xl font-bold text-white">{studentSubs.length}</span>
                  </div>
                  <div className="bg-dark-900 p-3 rounded-lg">
                    <span className="block text-xs text-slate-500 uppercase mb-1">Ortalama</span>
                    <span className={`text-xl font-bold ${avgGrade >= 50 ? 'text-green-400' : 'text-red-400'}`}>{avgGrade}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSubmissionDetailModal = () => {
    if (!selectedSubmission || !selectedSubmission.gradingResult) return null;
    const { gradingResult } = selectedSubmission;

    return (
      <div className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[100] overflow-y-auto">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-dark-800 w-full max-w-4xl rounded-2xl border border-dark-700 shadow-2xl relative">
            <button
              onClick={() => setSelectedSubmission(null)}
              className="absolute top-4 right-4 p-2 bg-dark-700 rounded-full text-slate-400 hover:text-white z-10">
              <X size={20} />
            </button>

            <div className="grid grid-cols-1 lg:grid-cols-3">
              {/* Sidebar Info */}
              <div className="p-8 bg-dark-900 border-r border-dark-700 rounded-l-2xl">
                <div className="flex flex-col items-center text-center mb-8">
                  <div className={`w-32 h-32 rounded-full flex items-center justify-center border-8 mb-4 ${gradingResult.grade >= 70 ? 'border-green-500/20 text-green-500' :
                    gradingResult.grade >= 50 ? 'border-yellow-500/20 text-yellow-500' : 'border-red-500/20 text-red-500'
                    }`}>
                    <span className="text-5xl font-bold">{gradingResult.grade}</span>
                  </div>
                  <h3 className="text-white font-bold text-xl mb-1">Kod Kalitesi</h3>
                  <p className="text-slate-400">{gradingResult.codeQuality}</p>
                </div>

                <div className="space-y-4">
                  <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
                    <h4 className="text-slate-400 text-xs uppercase font-bold mb-2">Öğrenci</h4>
                    <p className="text-white font-medium">{selectedSubmission.studentName}</p>
                  </div>
                  <div className="bg-dark-800 p-4 rounded-lg border border-dark-700">
                    <h4 className="text-slate-400 text-xs uppercase font-bold mb-2">Teslim Tarihi</h4>
                    <p className="text-white font-medium">{new Date(selectedSubmission.submittedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Detail Content */}
              <div className="col-span-2 p-8 lg:max-h-[90vh] lg:overflow-y-auto">
                <h2 className="text-2xl font-bold text-white mb-6 flex items-center gap-2">
                  <Activity className="text-primary" />
                  AI Değerlendirme Raporu
                </h2>

                <div className="space-y-8">
                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Genel Geri Bildirim</h3>
                    <p className="text-slate-300 leading-relaxed bg-dark-900/50 p-4 rounded-lg border border-dark-700">
                      {gradingResult.feedback}
                    </p>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Birim Testleri</h3>
                    <div className="space-y-2">
                      {gradingResult.unitTests.map((test, idx) => (
                        <div key={idx} className="flex items-center justify-between p-3 bg-dark-900/50 rounded-lg border border-dark-700">
                          <span className="text-slate-300 font-medium">{test.testName}</span>
                          <div className="flex items-center gap-2">
                            <span className={`text-sm ${test.passed ? 'text-green-400' : 'text-red-400'}`}>
                              {test.message}
                            </span>
                            {test.passed
                              ? <CheckCircle2 className="text-green-500" size={18} />
                              : <AlertCircle className="text-red-500" size={18} />
                            }
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Gelişim Tavsiyeleri</h3>
                    <ul className="space-y-2">
                      {gradingResult.suggestions.map((sug, idx) => (
                        <li key={idx} className="flex gap-3 text-slate-300">
                          <span className="text-primary mt-1">•</span>
                          {sug}
                        </li>
                      ))}
                    </ul>
                  </div>

                  <div>
                    <h3 className="text-lg font-semibold text-white mb-3">Gönderilen Kod</h3>
                    <pre className="bg-[#0d1117] p-4 rounded-lg border border-dark-700 overflow-x-auto text-sm font-mono text-slate-300">
                      <code>{selectedSubmission.code}</code>
                    </pre>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    );
  };

  if (!user) {
    return <LoginScreen onLogin={handleLogin} />;
  }

  return (
    <Layout user={user} onLogout={() => setUser(null)} currentView={currentView} setCurrentView={setCurrentView}>
      {currentView === 'home' && renderHomeView()}
      {currentView === 'assignments' && renderAssignmentsView()}
      {currentView === 'students' && user.role === UserRole.TEACHER && renderStudentsView()}
      {currentView === 'assignment_detail' && user.role === UserRole.TEACHER && renderAssignmentDetailView()}

      {/* Global Modals */}
      {selectedSubmission && renderSubmissionDetailModal()}
    </Layout>
  );
}