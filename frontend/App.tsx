import React, { useState, useEffect } from 'react';
import { UserRole, Assignment, Announcement, Submission, GradingResult } from './types';
import { Layout } from './components/Layout';
import { gradeSubmission } from './services/geminiService';
import { db } from './services/persistence';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { TeacherDashboard } from './components/TeacherDashboard';
import {
  Plus, Calendar, Clock, CheckCircle2, AlertCircle, FileCode,
  ChevronRight, Award, Activity, Search, X, GraduationCap, Trash2
} from 'lucide-react';

// --- Main App Content ---
const AppContent = () => {
  const { token, role, username, logout } = useAuth();
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

  if (!token) {
    return <Login />;
  }

  // Creating a pseudo user object to match existing layout expectations
  const user = {
    id: username || 'unknown',
    name: username || 'User',
    role: role === 'teacher' ? UserRole.TEACHER : UserRole.STUDENT,
    avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=" + username
  };

  // ... (Keep existing handler functions roughly same, adjust for real auth if strictly needed) ...
  // ... For simplicity, we are wrapping existing logic ...

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
        selectedAssignment.studentLevel
      );
      if (gradingResult.grade === 0) {
        alert(gradingResult.feedback || "Değerlendirme sırasında bir hata oluştu.");
        return;
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
      const updatedSubmissions = db.saveSubmission(newSubmission);
      setSubmissions(updatedSubmissions);
      setSelectedSubmission(newSubmission);
      setIsModalOpen(false);
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

  // Render Logic Extracts
  const renderHomeView = () => (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><CheckCircle2 size={64} /></div>
          <h3 className="text-slate-400 text-sm font-medium uppercase">Aktif Ödevler</h3>
          <p className="text-3xl font-bold text-white mt-2">{assignments.filter(a => a.status === 'active').length}</p>
        </div>
        {/* Same Mock Stats for now */}
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Clock size={64} /></div>
          <h3 className="text-slate-400 text-sm font-medium uppercase">Bekleyen Teslimler</h3>
          <p className="text-3xl font-bold text-white mt-2">-</p>
        </div>
        <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden">
          <div className="absolute top-0 right-0 p-4 opacity-10"><Award size={64} /></div>
          <h3 className="text-slate-400 text-sm font-medium uppercase">Ortalama Not</h3>
          <p className="text-3xl font-bold text-white mt-2">-</p>
        </div>
      </div>
    </div>
  );

  // ... Reusing other render functions mostly as is, just context aware ...
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
        {/* Simplified Assignment List for brevity in this replacement */}
        <div className="grid gap-4">
          {assignments.map(assignment => (
            <div key={assignment.id} className="bg-dark-800 p-6 rounded-xl border border-dark-700 hover:border-primary/50 transition-all group">
              <div className="flex justify-between items-start">
                <div>
                  <h3 className="text-lg font-semibold text-white group-hover:text-primary transition-colors">{assignment.title}</h3>
                  <p className="text-slate-400 text-sm mb-2">{assignment.description}</p>
                </div>
                <div>
                  {isTeacher ? (
                    <button onClick={() => { setSelectedAssignment(assignment); setCurrentView('assignment_detail'); }} className="text-primary text-sm font-medium hover:underline">Detaylar</button>
                  ) : (
                    <button onClick={() => { setSelectedAssignment(assignment); setIsModalOpen(true); }} className="px-4 py-2 bg-dark-700 hover:bg-dark-600 text-white rounded-lg text-sm font-medium transition-colors border border-dark-600">Yükle</button>
                  )}
                </div>
              </div>
            </div>
          ))}
          {assignments.length === 0 && <p className="text-slate-500 text-center py-8">Henüz ödev yok.</p>}
        </div>

        {/* Modals placed here properly */}
        {isModalOpen && isTeacher && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 w-full max-w-lg rounded-2xl border border-dark-700 shadow-2xl p-6">
              <h3 className="text-lg font-bold text-white mb-4">Yeni Ödev</h3>
              <input type="text" placeholder="Başlık" className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-white mb-3" value={newAssignmentData.title} onChange={e => setNewAssignmentData({ ...newAssignmentData, title: e.target.value })} />
              <textarea placeholder="Açıklama" className="w-full bg-dark-900 border border-dark-700 rounded-lg p-2.5 text-white mb-3 h-24" value={newAssignmentData.description} onChange={e => setNewAssignmentData({ ...newAssignmentData, description: e.target.value })} />
              <div className="flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400">İptal</button>
                <button onClick={handleCreateAssignment} className="bg-primary text-white px-4 py-2 rounded-lg">Oluştur</button>
              </div>
            </div>
          </div>
        )}

        {isModalOpen && !isTeacher && selectedAssignment && (
          <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 w-full max-w-2xl rounded-2xl border border-dark-700 shadow-2xl p-6 flex flex-col h-[80vh]">
              <h3 className="text-lg font-bold text-white mb-2">{selectedAssignment.title}</h3>
              <textarea className="flex-1 bg-[#0d1117] border border-dark-700 rounded-lg p-4 font-mono text-sm text-slate-300 resize-none mb-4" placeholder="// Kodu buraya yapıştır..." value={codeDraft} onChange={e => setCodeDraft(e.target.value)} />
              <div className="flex justify-end gap-3">
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400">İptal</button>
                <button onClick={handleSubmitCode} disabled={isGrading} className="bg-primary text-white px-6 py-2 rounded-lg flex items-center gap-2">{isGrading ? 'Kontrol Ediliyor...' : 'Gönder'}</button>
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
          <h1 className="text-2xl font-bold text-white">{selectedAssignment.title}</h1>
          <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden mt-6">
            <table className="w-full text-left">
              <thead className="bg-dark-700/50 text-slate-400 text-xs uppercase">
                <tr>
                  <th className="px-6 py-4 font-medium">Öğrenci</th>
                  <th className="px-6 py-4 font-medium">Not</th>
                  <th className="px-6 py-4 font-medium text-right">İşlem</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-dark-700">
                {assignmentSubmissions.map(sub => (
                  <tr key={sub.id}>
                    <td className="px-6 py-4 text-white font-medium">{sub.studentName}</td>
                    <td className="px-6 py-4 text-white">{sub.gradingResult?.grade}</td>
                    <td className="px-6 py-4 text-right flex items-center justify-end gap-2">
                      <button onClick={() => setSelectedSubmission(sub)} className="text-primary text-sm">İncele</button>
                      <button onClick={() => handleDeleteSubmission(sub.id)} className="text-red-500 hover:text-red-400"><Trash2 size={18} /></button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
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
          <div className="bg-dark-800 w-full max-w-4xl rounded-2xl border border-dark-700 shadow-2xl relative p-8">
            <button onClick={() => setSelectedSubmission(null)} className="absolute top-4 right-4 text-slate-400 hover:text-white"><X size={24} /></button>
            <div className="grid grid-cols-3 gap-8">
              <div className="col-span-1 border-r border-dark-700 pr-8">
                <div className="text-6xl font-bold text-white mb-2">{gradingResult.grade}</div>
                <div className="text-slate-400 uppercase tracking-widest text-sm mb-6">Puan</div>
                <div className="space-y-4">
                  <div className="bg-dark-900 p-4 rounded-lg"><div className="text-xs text-slate-500 uppercase">Öğrenci</div><div className="text-white font-bold">{selectedSubmission.studentName}</div></div>
                </div>
              </div>
              <div className="col-span-2 space-y-6">
                <div><h3 className="text-white font-bold mb-2">Geri Bildirim</h3><p className="text-slate-300 bg-dark-900 p-4 rounded-lg">{gradingResult.feedback}</p></div>
                <div><h3 className="text-white font-bold mb-2">Tavsiyeler</h3><ul className="list-disc list-inside text-slate-300 space-y-1">{gradingResult.suggestions.map((s, i) => <li key={i}>{s}</li>)}</ul></div>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  };

  return (
    <Layout user={user} onLogout={logout} currentView={currentView} setCurrentView={setCurrentView}>
      {currentView === 'home' && renderHomeView()}
      {/* Only Show Teacher Dashboard Link in Layout (needs update potentially) but here is the view */}
      {currentView === 'teacher_dashboard' && user.role === UserRole.TEACHER && <TeacherDashboard />}
      {currentView === 'assignments' && renderAssignmentsView()}
      {currentView === 'assignment_detail' && user.role === UserRole.TEACHER && renderAssignmentDetailView()}
      {selectedSubmission && renderSubmissionDetailModal()}
    </Layout>
  );
};

export default function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}