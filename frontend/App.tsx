// @ts-nocheck
import React, { useState, useEffect, useRef } from 'react';
import { UserRole, Assignment, Announcement, Submission, GradingResult } from './types';
import { Layout } from './components/Layout';
import { gradeSubmission } from './services/geminiService';
import { parseGradingResult } from './utils/parseGradingResult';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Login } from './components/Login';
import { TeacherDashboard } from './components/TeacherDashboard';
import { Leaderboard } from './components/Leaderboard';
import { SuperAdminDashboard } from './components/SuperAdminDashboard';
import { SuperAdminHome } from './components/SuperAdminHome';
import { LandingPage } from './components/LandingPage';

import {
  Plus, Calendar, Clock, CheckCircle2, AlertCircle, FileCode,
  ChevronRight, Award, Activity, Search, X, GraduationCap, Trash2,
  User as UserIcon, Lock as LockIcon, Camera, Save, KeyRound, Edit2, Loader2,
  HelpCircle, Lightbulb, Compass, ArrowRight, Eye
} from 'lucide-react';
import Editor from 'react-simple-code-editor';
// @ts-ignore
import { highlight, languages } from 'prismjs/components/prism-core';
import 'prismjs/components/prism-clike';
import 'prismjs/components/prism-javascript';
import 'prismjs/components/prism-python';
import 'prismjs/themes/prism-tomorrow.css';
import { API_BASE_URL } from './config';

// --- Helpers ---
const calculateTimeRemaining = (dueDateString: string): string => {
  const now = new Date();
  const due = new Date(dueDateString);
  const diff = due.getTime() - now.getTime();

  if (diff <= 0) return "Süre Doldu";

  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

  if (days > 0) return `${days} gün ${hours} saat`;
  if (hours > 0) return `${hours} saat ${minutes} dk`;
  return `${minutes} dk`;
};

const isDeadlinePassed = (dueDateString: string): boolean => {
  return new Date(dueDateString).getTime() < new Date().getTime();
};

// Request cancellation (session boundary): whenever a fetch is aborted — because
// the component unmounted, the session changed (login/logout/tenant switch), or a
// newer request superseded it — we must silently discard it instead of treating it
// as an error. This is the "Latest-Request-Wins" rule from the security audit.
const isAbortError = (error: unknown): boolean =>
  (error instanceof DOMException && error.name === 'AbortError') ||
  (typeof error === 'object' && error !== null && (error as any).name === 'AbortError');




const PUBLIC_VIEWS = ['landing', 'login'];
const DEFAULT_ASSIGNMENT_FORM: Partial<Assignment> = {
  title: '',
  description: '',
  language: 'python',
  dueDate: '',
  studentLevel: 'intermediate',
  targetType: 'all',
  targetClass: '',
  targetStudents: []
};

const parseTargetStudents = (raw: unknown): string[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw.map(String);
  if (typeof raw === 'string') {
    try {
      const parsed = JSON.parse(raw);
      return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch {
      return [];
    }
  }
  return [];
};

// --- Main App Content ---
const AppContent = () => {
  const { token, role, username, studentNumber, classCode, avatarUrl, userId, logout, updateAvatar, updateName, email, isAuthLoading } = useAuth();


  // Initialize view from URL; no session → login, valid session → role dashboard (home)
  const [currentView, setCurrentView] = useState(() => {
    const params = new URLSearchParams(window.location.search);
    const view = params.get('view');
    const hasSession = !!localStorage.getItem('token');

    if (!hasSession) {
      return view === 'landing' ? 'landing' : 'login';
    }

    if (!view || view === 'login' || view === 'landing') {
      return 'home';
    }
    return view;
  });

  // Handle Browser Back Button (PopState)
  useEffect(() => {
    const handlePopState = () => {
      const params = new URLSearchParams(window.location.search);
      const view = params.get('view');
      const hasSession = !!localStorage.getItem('token');

      if (!hasSession) {
        setCurrentView(view === 'landing' ? 'landing' : 'login');
        return;
      }

      if (!view || view === 'login' || view === 'landing') {
        setCurrentView('home');
      } else {
        setCurrentView(view);
      }
    };

    window.addEventListener('popstate', handlePopState);
    return () => window.removeEventListener('popstate', handlePopState);
  }, []);

  // Auth gate: no session → login; valid session on login/landing → home (role dashboard)
  useEffect(() => {
    if (!token) {
      if (!PUBLIC_VIEWS.includes(currentView)) {
        setCurrentView('login');
      }
      return;
    }

    if (currentView === 'login' || currentView === 'landing') {
      setCurrentView('home');
    }
  }, [token, currentView]);

  // Sync state changes to URL (PushState)
  useEffect(() => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('view') !== currentView) {
      url.searchParams.set('view', currentView);
      window.history.pushState({}, '', url);
    }
  }, [currentView]);

  // Initialize state
  const [assignments, setAssignments] = useState<Assignment[]>([]);
  const [submissions, setSubmissions] = useState<Submission[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [backendStudents, setBackendStudents] = useState<any[]>([]);
  const [isDataLoading, setIsDataLoading] = useState(() => !!localStorage.getItem('token'));

  // Search/Filter State
  const [searchTerm, setSearchTerm] = useState('');
  const [classFilter, setClassFilter] = useState('all');

  // UI States
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedAssignment, setSelectedAssignment] = useState<Assignment | null>(null);
  const [selectedSubmission, setSelectedSubmission] = useState<Submission | null>(null);
  // Sokratik Aşamalı Gösterim (Progressive Disclosure): AI Analiz Modalı her açıldığında
  // 0'dan başlar (sadece farkındalık sorusu). Öğrenci kendi iradesiyle ipucu istedikçe
  // kademe artar; modal kapandığında 0'a sıfırlanır (bkz. aşağıdaki useEffect).
  const [scaffoldingLevel, setScaffoldingLevel] = useState(0);
  const [selectedStudent, setSelectedStudent] = useState<any | null>(null);
  const [codeDraft, setCodeDraft] = useState('');
  const [isGrading, setIsGrading] = useState(false);
  const [submitError, setSubmitError] = useState('');
  // Tracks the in-flight AI grading request so it can be cancelled if the user
  // closes the modal, the session ends, or this component unmounts.
  const gradingAbortRef = useRef<AbortController | null>(null);

  // Session boundary safety net: cancel any still-running grading request when
  // this component instance goes away (covers unmount AND the key-based remount
  // that happens on login/logout/tenant switch).
  useEffect(() => {
    return () => {
      gradingAbortRef.current?.abort();
    };
  }, []);

  // Modal her açılıp kapandığında (yeni bir teslimat seçildiğinde de) Sokratik
  // kademe başlangıç seviyesi yeniden hesaplanır. Varsayılan olarak öğrenci her
  // seferinde farkındalık sorusuyla (Seviye 0) başlar; ancak iki istisna
  // durumunda Sokratik aşamalar tamamen atlanıp doğrudan Tam Rapor (Seviye 3)
  // gösterilir:
  //   1) Yüksek Puan istisnası: incelenen teslim 90 ve üzeri puan almışsa
  //      (AI'nın küçük detaylar için kırdığı ufak puanlar Sokratik akışı
  //      tetiklemesin diye tam 100 yerine bir eşik kullanılır).
  //   2) "1 Düzeltme Hakkı" istisnası: öğrenci bu ödeve zaten 2. (veya daha
  //      sonraki) kez kod göndermişse — yani ilk Sokratik ipucu hakkını
  //      kullanıp tekrar denemişse.
  useEffect(() => {
    if (!selectedSubmission) {
      setScaffoldingLevel(0);
      return;
    }

    const isPerfectScore = (selectedSubmission.gradingResult?.grade ?? 0) >= 90;

    const attemptCount = submissions.filter(
      s =>
        s.assignmentId === selectedSubmission.assignmentId &&
        s.studentId === selectedSubmission.studentId
    ).length;
    const correctionAttemptUsed = attemptCount >= 2;

    setScaffoldingLevel(isPerfectScore || correctionAttemptUsed ? 3 : 0);
  }, [selectedSubmission?.id]);

  const [modalSearchTerm, setModalSearchTerm] = useState('');

  // Profile States
  const [profilePassData, setProfilePassData] = useState({ old: '', new: '', confirm: '' });
  const [profileNewAvatar, setProfileNewAvatar] = useState('');
  const [profileFullName, setProfileFullName] = useState('');
  const [profileEmail, setProfileEmail] = useState(email || '');
  const [profileLoading, setProfileLoading] = useState(false);

  const [profileMsg, setProfileMsg] = useState({ type: '', text: '' });
  const [toast, setToast] = useState<{ title: string; msg: string; visible: boolean } | null>(null);

  // Announcement Management State
  const [newAnnData, setNewAnnData] = useState({ title: '', content: '', type: 'info' });

  // Create Assignment State
  const [editingAssignment, setEditingAssignment] = useState<Assignment | null>(null);
  const [newAssignmentData, setNewAssignmentData] = useState<Partial<Assignment>>({ ...DEFAULT_ASSIGNMENT_FORM });

  const resetAppDataState = () => {
    setAssignments([]);
    setSubmissions([]);
    setAnnouncements([]);
    setBackendStudents([]);
    setIsDataLoading(false);
    setSearchTerm('');
    setClassFilter('all');
    setIsModalOpen(false);
    setSelectedAssignment(null);
    setSelectedSubmission(null);
    setScaffoldingLevel(0);
    setSelectedStudent(null);
    setCodeDraft('');
    setIsGrading(false);
    setSubmitError('');
    setModalSearchTerm('');
    setEditingAssignment(null);
    setNewAssignmentData({ ...DEFAULT_ASSIGNMENT_FORM });
    setNewAnnData({ title: '', content: '', type: 'info' });
    setToast(null);
    setProfileMsg({ type: '', text: '' });
    setProfilePassData({ old: '', new: '', confirm: '' });
  };

  const closeCodeModal = () => {
    // Cancel an in-flight grading/submission request if the user backs out.
    gradingAbortRef.current?.abort();
    gradingAbortRef.current = null;
    setIsModalOpen(false);
    setSelectedAssignment(null);
    setCodeDraft('');
    setIsGrading(false);
    setSubmitError('');
  };

  const closeCreateAssignmentModal = () => {
    setIsModalOpen(false);
    setEditingAssignment(null);
    setNewAssignmentData({ ...DEFAULT_ASSIGNMENT_FORM });
    setModalSearchTerm('');
  };

  const handleLogout = () => {
    logout();
    resetAppDataState();
    setCurrentView('login');
  };

  // fetchAllData is invoked both from the auto-refresh effect (with an
  // AbortSignal tied to the session/component lifecycle) and from various
  // handlers after a mutation (create/delete) with no signal at all — both are
  // valid call shapes.
  const fetchAllData = async (signal?: AbortSignal) => {
    if (!token) return;
    setIsDataLoading(true);
    try {
      const headers = { 'Authorization': `Bearer ${token}` };

      // P1 fix: independent requests via Promise.allSettled — one endpoint
      // failing (or being aborted) must never prevent the other, successful
      // responses (e.g. "assignments") from being applied to state.
      const [assRes, subRes, annRes] = await Promise.allSettled([
        fetch(`${API_BASE_URL}/assignments/`, { headers, signal }),
        fetch(`${API_BASE_URL}/submissions/`, { headers, signal }),
        fetch(`${API_BASE_URL}/announcements/`, { headers, signal })
      ]);

      if (assRes.status === 'fulfilled') {
        if (assRes.value.ok) {
          const data = await assRes.value.json();
          // Map backend snake_case to frontend camelCase
          setAssignments((Array.isArray(data) ? data : []).map((a: any) => ({
            id: a.id.toString(),
            title: a.title,
            description: a.description,
            dueDate: a.due_date,
            language: a.language,
            studentLevel: a.student_level,
            status: a.status,
            targetType: a.target_type,
            targetClass: a.target_class,
            targetStudents: parseTargetStudents(a.target_students),
            teacherName: a.teacher_name // Map backend field
          })));
        } else {
          setAssignments([]);
        }
      } else if (!isAbortError(assRes.reason)) {
        console.error("Assignments fetch error", assRes.reason);
      }

      if (subRes.status === 'fulfilled') {
        if (subRes.value.ok) {
          const data = await subRes.value.json();
          // Map backend snake_case to frontend camelCase
          setSubmissions((Array.isArray(data) ? data : []).map((s: any) => ({
            id: s.id.toString(),
            assignmentId: s.assignment_id?.toString(),
            studentId: s.user_id?.toString(),
            studentName: s.student_name || "Öğrenci",
            code: s.code_content,
            submittedAt: s.submitted_at,
            status: 'graded',
            gradingResult: parseGradingResult(s.grading_result) ?? undefined
          })));
        } else {
          setSubmissions([]);
        }
      } else if (!isAbortError(subRes.reason)) {
        console.error("Submissions fetch error", subRes.reason);
      }

      if (annRes.status === 'fulfilled') {
        if (annRes.value.ok) {
          const data = await annRes.value.json();
          setAnnouncements((Array.isArray(data) ? data : []).map((a: any) => ({
            id: a.id.toString(),
            title: a.title,
            content: a.content,
            type: a.type,
            date: a.date
          })));
        } else {
          setAnnouncements([]);
        }
      } else if (!isAbortError(annRes.reason)) {
        console.error("Announcements fetch error", annRes.reason);
      }
    } catch (e) {
      if (!isAbortError(e)) console.error("Data fetch error", e);
    } finally {
      // Never touch state on behalf of a request that was cancelled — a newer,
      // still-in-flight request (or none at all, if we've navigated away) owns
      // the loading indicator now.
      if (!signal?.aborted) setIsDataLoading(false);
    }
  };

  useEffect(() => {
    if (!token) {
      setAssignments([]);
      setSubmissions([]);
      setAnnouncements([]);
      setBackendStudents([]);
      setIsDataLoading(false);
      return;
    }

    const controller = new AbortController();
    fetchAllData(controller.signal);

    // Cancel any still-pending requests when the view changes, the session
    // changes, or this component unmounts — this is what stops a delayed
    // response from a previous context from ever reaching setState.
    return () => controller.abort();
  }, [token, currentView]);

  useEffect(() => {
    if (!((role === 'teacher' || role === 'superadmin') && token)) {
      setBackendStudents([]);
      return;
    }

    const controller = new AbortController();

    const fetchStudents = async () => {
      try {
        const res = await fetch(`${API_BASE_URL}/admin/students`, {
          headers: { 'Authorization': `Bearer ${token}` },
          signal: controller.signal
        });

        if (res.ok) setBackendStudents(await res.json());
        else setBackendStudents([]);
      } catch (e) {
        if (!isAbortError(e)) console.error(e);
      }
    };
    fetchStudents();

    return () => controller.abort();
  }, [role, token, currentView]);

  // Clear code modal residue when leaving assignments (keep selection for teacher detail)
  useEffect(() => {
    if (currentView === 'assignment_detail') return;

    if (currentView !== 'assignments') {
      setIsModalOpen(false);
      setCodeDraft('');
      setSubmitError('');
      setIsGrading(false);
      setSelectedAssignment(null);
      setEditingAssignment(null);
      setModalSearchTerm('');
    }
  }, [currentView]);

  useEffect(() => {
    if (avatarUrl) setProfileNewAvatar(avatarUrl);
    else if (studentNumber) setProfileNewAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=" + studentNumber);
    if (username) setProfileFullName(username);
    // Keep the profile form's email field in sync with the auth source of
    // truth — otherwise a value fetched/updated after the initial mount
    // (e.g. from the bootstrap /users/me check) would never reach the form.
    setProfileEmail(email || '');
  }, [avatarUrl, studentNumber, username, email]);

  // Bootstrap gate: while the persisted token is being verified against the
  // backend (see AuthContext), never render an authenticated view or the bare
  // Login screen — an expired/forged token would otherwise flash as a valid,
  // empty session (e.g. "no assignments") until the forced logout completes.
  if (isAuthLoading) {
    return (
      <div className="min-h-screen bg-dark-900 flex flex-col items-center justify-center gap-4">
        <Loader2 size={40} className="animate-spin text-primary" />
        <p className="text-slate-400 text-sm font-medium">Oturum doğrulanıyor...</p>
      </div>
    );
  }

  if (currentView === 'landing') {
    return <LandingPage
      isLoggedIn={!!token}
      onLoginClick={() => setCurrentView('login')}
      onDashboardClick={() => setCurrentView('home')}
    />;
  }

  if (!token) {
    return <Login />;
  }

  const user = {
    id: userId || 'unknown',
    name: username || 'User',
    role: role === 'superadmin' ? UserRole.SUPERADMIN : (role === 'teacher' ? UserRole.TEACHER : UserRole.STUDENT),
    avatar: avatarUrl || ("https://api.dicebear.com/7.x/avataaars/svg?seed=" + (studentNumber || 'unknown'))
  };



  const handleCreateAssignment = async () => {
    if (!newAssignmentData.title || !newAssignmentData.dueDate || !token) return;

    const payload = {
      title: newAssignmentData.title,
      description: newAssignmentData.description || '',
      due_date: newAssignmentData.dueDate,
      language: newAssignmentData.language || 'python',
      student_level: newAssignmentData.studentLevel || 'intermediate',
      status: 'active',
      target_type: newAssignmentData.targetType || 'all',
      target_class: newAssignmentData.targetClass || null,
      target_students: newAssignmentData.targetStudents ? JSON.stringify(newAssignmentData.targetStudents) : null
    };

    try {
      const url = editingAssignment
        ? `${API_BASE_URL}/assignments/${editingAssignment.id}`
        : `${API_BASE_URL}/assignments/`;


      const res = await fetch(url, {
        method: editingAssignment ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload)
      });

      if (res.ok) {
        fetchAllData();
        closeCreateAssignmentModal();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleCreateAnnouncement = async () => {
    if (!newAnnData.title || !newAnnData.content || !token) return;

    try {
      const res = await fetch(`${API_BASE_URL}/announcements/`, {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify({
          ...newAnnData,
          date: new Date().toLocaleDateString('tr-TR', { day: 'numeric', month: 'long', year: 'numeric' })
        })
      });

      if (res.ok) {
        fetchAllData();
        setNewAnnData({ title: '', content: '', type: 'info' });
        setIsModalOpen(false);
      }
    } catch (e) { console.error(e); }
  };

  const handleDeleteAnnouncement = async (id: string) => {
    if (!token || !window.confirm('Bu duyuruyu silmek istediğinize emin misiniz?')) return;
    try {
      const res = await fetch(`${API_BASE_URL}/announcements/${id}`, {

        method: 'DELETE',
        headers: { 'Authorization': `Bearer ${token}` }
      });
      if (res.ok) {
        fetchAllData();
      }
    } catch (e) { console.error(e); }
  };


  const handleSubmitCode = async () => {
    if (!user || !selectedAssignment) return;
    setIsGrading(true);
    setSubmitError('');

    // Fresh controller per submission attempt: cancelled by closeCodeModal(),
    // by the unmount cleanup effect, or implicitly discarded on session change.
    const controller = new AbortController();
    gradingAbortRef.current = controller;

    try {
      const gradingResult = await gradeSubmission(
        selectedAssignment.description,
        selectedAssignment.language,
        codeDraft,
        selectedAssignment.studentLevel,
        controller.signal
      );

      if (gradingResult.grade === 0) {
        setSubmitError(gradingResult.feedback || "Değerlendirme sırasında bir hata oluştu.");
        return;
      }

      const payload = {
        assignment_id: parseInt(selectedAssignment.id),
        code_content: codeDraft,
        grading_result: JSON.stringify(gradingResult)
      };



      const res = await fetch(`${API_BASE_URL}/submissions/`, {

        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${token}`
        },
        body: JSON.stringify(payload),
        signal: controller.signal
      });

      if (res.ok) {
        const responseData = await res.json();

        // Check new badges
        if (responseData.new_badges && responseData.new_badges.length > 0) {
          const badgeNames = responseData.new_badges.map((b: any) => b.name).join(", ");
          setToast({
            title: "Tebrikler! Yeni Rozet Kazandın!",
            msg: `Harika iş! "${badgeNames}" rozetini profiline ekledik.`,
            visible: true
          });
          setTimeout(() => setToast(null), 8000);
        }

        // Yeni değerlendirilmiş teslimatı, AI Analiz Raporu modalını otomatik
        // açmak için POST cevabından doğrudan inşa ediyoruz (fetchAllData'nın
        // tamamlanmasını beklemeye gerek kalmadan).
        const freshSubmission: Submission = {
          id: responseData.id?.toString(),
          assignmentId: responseData.assignment_id?.toString(),
          studentId: responseData.user_id?.toString(),
          studentName: responseData.student_name || user.name,
          code: responseData.code_content,
          submittedAt: responseData.submitted_at,
          status: 'graded',
          gradingResult: parseGradingResult(responseData.grading_result) ?? undefined
        };

        closeCodeModal();
        await fetchAllData();
        // Öğrenciyi Ana Sayfaya atmak yerine "Ödevler" görünümünde tutup
        // sonucu doğrudan Sokratik AI Analiz Raporu modalıyla gösteriyoruz.
        setCurrentView('assignments');
        setSelectedSubmission(freshSubmission);
      } else {
        setSubmitError("Gönderim kaydedilemedi.");
      }
    } catch (error) {
      // Latest-Request-Wins: a cancelled request (modal closed, session ended)
      // is not a user-facing error — swallow it silently.
      if (isAbortError(error)) return;
      setSubmitError("Hata oluştu! Lütfen internet bağlantınızı ve API anahtarınızı kontrol edin.");
    } finally {
      if (!controller.signal.aborted) setIsGrading(false);
      if (gradingAbortRef.current === controller) gradingAbortRef.current = null;
    }
  };


  const handleDeleteSubmission = async (submissionId: string) => {
    if (window.confirm('Bu teslimi silmek istediğinize emin misiniz? Öğrenci tekrar ödev yükleyebilecek.')) {
      try {
        const res = await fetch(`${API_BASE_URL}/submissions/${submissionId}`, {

          method: 'DELETE',
          headers: { 'Authorization': `Bearer ${token}` }
        });
        if (res.ok) {
          fetchAllData();
          if (selectedSubmission?.id === submissionId) {
            setSelectedSubmission(null);
          }
        }
      } catch (e) { console.error(e); }
    }
  };


  // --- Views ---

  const renderHomeView = () => {
    if (user.role === UserRole.SUPERADMIN) {
      return <SuperAdminHome setCurrentView={setCurrentView} />;
    }

    const studentSubs = submissions.filter(s => s.studentId === user.id);

    const averageScore = studentSubs.length > 0
      ? Math.round(studentSubs.reduce((acc, curr) => acc + (curr.gradingResult?.grade || 0), 0) / studentSubs.length)
      : 0;

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden group hover:border-primary/50 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <CheckCircle2 size={64} className="text-primary" />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Aktif Ödevler</h3>
            <p className="text-4xl font-bold text-white mt-2">{assignments.filter(a => a.status === 'active').length}</p>
          </div>
          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden group hover:border-primary/50 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Clock size={64} className="text-blue-500" />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Bekleyen Teslimler</h3>
            <p className="text-4xl font-bold text-white mt-2">
              {user.role === UserRole.STUDENT
                ? assignments.filter(a => {
                  const hasSub = submissions.find(s => s.assignmentId === a.id && s.studentId === user.id);
                  if (hasSub) return false;

                  const type = a.targetType || 'all';
                  if (type === 'all') return true;
                  if (type === 'class') return a.targetClass === classCode;
                  if (type === 'specific') return a.targetStudents?.includes(studentNumber || '');
                  return false;
                }).length
                : submissions.length}
            </p>
          </div>
          <div className="bg-dark-800 p-6 rounded-xl border border-dark-700 relative overflow-hidden group hover:border-primary/50 transition-all">
            <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
              <Award size={64} className="text-emerald-500" />
            </div>
            <h3 className="text-slate-400 text-sm font-medium uppercase tracking-wider">Ortalama Puan</h3>
            <p className="text-4xl font-bold text-white mt-2">
              {user.role === UserRole.STUDENT
                ? (studentSubs.length > 0 ? averageScore : '-')
                : (submissions.length > 0 ? Math.round(submissions.reduce((acc, curr) => acc + (curr.gradingResult?.grade || 0), 0) / submissions.length) : '-')}
            </p>
          </div>
        </div>

        {user.role === UserRole.STUDENT && studentSubs.length > 0 && (
          <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden shadow-lg">
            <div className="p-6 border-b border-dark-700 bg-dark-700/30">
              <h3 className="text-lg font-semibold text-white flex items-center gap-2">
                <Activity size={20} className="text-primary" />
                Ödev Teslim Geçmişim
              </h3>
            </div>
            <div className="divide-y divide-dark-700/50">
              {studentSubs.slice(0, 5).map(sub => {
                const assignment = assignments.find(a => a.id === sub.assignmentId);
                return (
                  <div key={sub.id} className="p-5 hover:bg-dark-700/20 transition-all flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 group">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 rounded-lg bg-dark-700 flex items-center justify-center text-primary group-hover:scale-110 transition-transform flex-shrink-0">
                        <FileCode size={20} />
                      </div>
                      <div>
                        <h4 className="text-white font-medium line-clamp-1">{assignment?.title || 'Ödev'}</h4>
                        <p className="text-slate-500 text-xs">{new Date(sub.submittedAt).toLocaleDateString()} tarihinde gönderildi</p>
                      </div>
                    </div>
                    <div className="flex items-center justify-between w-full sm:w-auto gap-4">
                      <span className={`px-3 py-1 rounded-lg text-xs font-black border flex-shrink-0 ${(sub.gradingResult?.grade || 0) >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                        (sub.gradingResult?.grade || 0) >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                        {sub.gradingResult?.grade || 0} Puan
                      </span>
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="p-2 hover:bg-dark-700 rounded-lg text-slate-400 hover:text-white transition-all">
                        <ChevronRight size={18} />
                      </button>
                    </div>
                  </div>

                );
              })}
            </div>
          </div>
        )}

        <div className="bg-dark-800 rounded-xl border border-dark-700 overflow-hidden shadow-lg">
          <div className="p-6 border-b border-dark-700 flex justify-between items-center bg-dark-700/30">
            <h3 className="text-lg font-semibold text-white flex items-center gap-2">
              <AlertCircle size={20} className="text-primary" />
              Duyurular
            </h3>
          </div>
          <div className="divide-y divide-dark-700/50">
            {announcements.map(ann => (
              <div key={ann.id} className="p-6 hover:bg-dark-700/20 transition-colors">
                <div className="flex gap-4">
                  <div className={`w-1 rounded-full ${ann.type === 'warning' ? 'bg-orange-500' : 'bg-primary'}`}></div>
                  <div>
                    <h4 className="text-white font-medium mb-1">{ann.title}</h4>
                    <p className="text-slate-400 text-sm leading-relaxed">{ann.content}</p>
                    <span className="text-xs text-slate-500 mt-3 block flex items-center gap-1">
                      <Calendar size={12} /> {ann.date}
                    </span>
                  </div>
                </div>
              </div>
            ))}
            {announcements.length === 0 && (
              <div className="p-12 text-center text-slate-500 italic text-sm">Hiç duyuru bulunmuyor.</div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderAssignmentsView = () => {
    const isTeacher = user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN;
    const filteredAssignments = isTeacher
      ? assignments
      : assignments.filter(a => {
        // Submitted assignments should always be visible to the student
        const hasSubmission = submissions.some(s => s.assignmentId === a.id && s.studentId === user.id);

        if (hasSubmission) return true;

        const type = a.targetType || 'all'; // Default to 'all' for legacy compatibility
        if (type === 'all') return true;
        if (type === 'class') return a.targetClass === classCode;
        if (type === 'specific') return a.targetStudents?.includes(studentNumber || '');
        return false;
      });


    return (
      <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">Ödevler</h2>
          {isTeacher && (
            <button
              onClick={() => { setEditingAssignment(null); setNewAssignmentData({ ...DEFAULT_ASSIGNMENT_FORM }); setIsModalOpen(true); }}
              className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg shadow-primary/20 active:scale-95">
              <Plus size={20} />
              Yeni Ödev
            </button>
          )}
        </div>

        <div className="grid gap-5">
          {isDataLoading && assignments.length === 0 && (
            <div className="text-center py-20 text-slate-400 bg-dark-800/50 rounded-2xl border border-dark-700 border-dashed flex flex-col items-center justify-center gap-4">
              <Loader2 size={40} className="animate-spin text-primary" />
              <p className="text-lg font-medium">Yükleniyor...</p>
            </div>
          )}
          {!(isDataLoading && assignments.length === 0) && filteredAssignments.map(assignment => {
            const studentSubmission = user.role === UserRole.STUDENT
              ? submissions.find(s => s.assignmentId === assignment.id && s.studentId === user.id)

              : null;
            const subCount = submissions.filter(s => s.assignmentId === assignment.id).length;

            return (
              <div key={assignment.id} className="bg-dark-800 p-6 rounded-xl border border-dark-700 hover:border-primary/50 transition-all group relative overflow-hidden">
                <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-6 relative z-10">
                  <div className="flex gap-4 sm:gap-5 w-full">
                    <div className="w-12 h-12 sm:w-14 sm:h-14 rounded-xl bg-dark-700 flex items-center justify-center text-primary border border-dark-600 shadow-inner group-hover:scale-110 transition-transform flex-shrink-0">
                      <FileCode size={24} className="sm:size-28" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="text-lg sm:text-xl font-bold text-white group-hover:text-primary transition-colors truncate">{assignment.title}</h3>
                      {assignment.teacherName && (
                        <div className="flex items-center gap-1.5 mb-1.5">
                          <span className="w-1.5 h-1.5 rounded-full bg-primary/50"></span>
                          <span className="text-slate-400 text-xs font-semibold">Dersi Veren: <span className="text-slate-300">{assignment.teacherName}</span></span>
                        </div>
                      )}
                      <p className="text-slate-400 text-xs sm:text-sm mb-3 mt-1 line-clamp-2 max-w-xl">{assignment.description}</p>
                      <div className="flex flex-wrap items-center gap-2 sm:gap-4 text-[10px] sm:text-xs text-slate-500 font-medium">
                        <span className="flex items-center gap-1.5 whitespace-nowrap"><Calendar size={14} className="text-slate-400" /> {new Date(assignment.dueDate).toLocaleDateString()}</span>
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-dark-900 text-primary uppercase border border-primary/20 tracking-wider font-bold">{assignment.language}</span>
                        <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-dark-900 text-slate-300 border border-dark-600">
                          {assignment.studentLevel === 'beginner' ? '👶 Başlangıç' : assignment.studentLevel === 'intermediate' ? '🎓 Orta' : '🚀 İleri'}
                        </span>
                        {isTeacher && assignment.targetType !== 'all' && (
                          <span className="px-2 sm:px-3 py-0.5 sm:py-1 rounded-full bg-primary/10 text-primary border border-primary/20 font-bold uppercase tracking-tighter">
                            🎯 {assignment.targetType === 'class' ? `Sınıf: ${assignment.targetClass}` : 'Seçili Öğrenciler'}
                          </span>
                        )}
                        <span className={`px-2 sm:px-3 py-0.5 sm:py-1 rounded-full border font-bold uppercase tracking-tighter flex items-center gap-1 ${isDeadlinePassed(assignment.dueDate)
                          ? 'bg-rose-500/10 text-rose-500 border-rose-500/20'
                          : 'bg-blue-500/10 text-blue-400 border-blue-500/20'
                          }`}>
                          <Clock size={12} /> {calculateTimeRemaining(assignment.dueDate) === "Süre Doldu" ? "Süre Doldu" : `${calculateTimeRemaining(assignment.dueDate)} Kaldı`}
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between lg:justify-end w-full lg:w-auto gap-4 lg:gap-8 border-t lg:border-t-0 border-dark-700 pt-4 lg:pt-0">
                    {isTeacher ? (
                      <>
                        <div className="flex flex-col items-center lg:items-end">
                          <span className="text-2xl sm:text-3xl font-black text-white">{subCount}</span>
                          <span className="text-[10px] text-slate-500 uppercase font-black tracking-widest">Teslim</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            onClick={() => {
                              setEditingAssignment(assignment);
                              setNewAssignmentData({
                                title: assignment.title,
                                description: assignment.description,
                                language: assignment.language,
                                dueDate: assignment.dueDate,
                                studentLevel: assignment.studentLevel,
                                targetType: assignment.targetType,
                                targetClass: assignment.targetClass,
                                targetStudents: assignment.targetStudents
                              });
                              setIsModalOpen(true);
                            }}
                            className="p-2 sm:p-2.5 bg-dark-700 hover:bg-primary/20 hover:text-primary rounded-lg transition-all border border-dark-600"
                          >
                            <Edit2 size={16} />
                          </button>
                          <button
                            onClick={async () => {
                              if (window.confirm('Bu ödevi silmek istediğinize emin misiniz?')) {
                                const res = await fetch(`${API_BASE_URL}/assignments/${assignment.id}`, {
                                  method: 'DELETE',
                                  headers: { 'Authorization': `Bearer ${token}` }
                                });
                                if (res.ok) fetchAllData();
                              }
                            }}
                            className="p-2 sm:p-2.5 bg-dark-700 hover:bg-rose-500/20 hover:text-rose-400 rounded-lg transition-all border border-dark-600"
                          >
                            <Trash2 size={16} />
                          </button>
                          <button
                            onClick={() => { setSelectedAssignment(assignment); setCurrentView('assignment_detail'); }}
                            className="p-2 sm:p-2.5 bg-primary hover:bg-primary/90 text-white rounded-lg transition-all shadow-lg shadow-primary/20">
                            <ChevronRight size={18} />
                          </button>
                        </div>
                      </>
                    ) : (
                      <>
                        {studentSubmission ? (
                          <>
                            <span className="px-3 sm:px-4 py-1.5 bg-emerald-500/10 text-emerald-400 rounded-lg text-[10px] sm:text-xs font-black border border-emerald-500/20 shadow-sm flex items-center gap-2">
                              <CheckCircle2 size={14} /> TAMAMLANDI
                            </span>
                            <button
                              onClick={() => setSelectedSubmission(studentSubmission)}
                              className="bg-dark-700 hover:bg-dark-600 text-white px-4 py-2 rounded-lg text-xs sm:text-sm font-bold transition-all border border-dark-600 whitespace-nowrap">
                              Sonucu İncele
                            </button>
                          </>
                        ) : (
                          <button
                            onClick={() => {
                              setSelectedAssignment(assignment);
                              setCodeDraft('');
                              setSubmitError('');
                              setIsGrading(false);
                              setIsModalOpen(true);
                            }}
                            className="w-full sm:w-auto px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-bold transition-all shadow-lg shadow-primary/20 active:scale-95 whitespace-nowrap">
                            Ödev Yükle
                          </button>
                        )}
                      </>
                    )}
                  </div>
                </div>
              </div>

            );
          })}
          {!isDataLoading && filteredAssignments.length === 0 && (
            <div className="text-center py-20 text-slate-500 bg-dark-800/50 rounded-2xl border border-dark-700 border-dashed">
              <FileCode size={64} className="mx-auto mb-6 opacity-20" />
              <p className="text-lg font-medium opacity-50 text-slate-400">Henüz yayınlanmış bir ödev bulunmamaktadır.</p>
            </div>
          )}
        </div>

        {/* Create Assignment Modal */}
        {isModalOpen && isTeacher && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-dark-800 w-full max-w-lg rounded-2xl border border-dark-700 shadow-2xl animate-in zoom-in duration-300">
              <div className="p-6 border-b border-dark-700 flex justify-between items-center text-white">
                <h3 className="text-xl font-bold">{editingAssignment ? 'Ödevi Düzenle' : 'Yeni Ödev Oluştur'}</h3>
                <button onClick={closeCreateAssignmentModal} className="p-2 hover:bg-dark-700 rounded-full transition-colors">
                  <X />
                </button>
              </div>

              <div className="p-6 space-y-5">
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Başlık</label>
                  <input
                    type="text"
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    placeholder="Örn: Python'da Döngüler"
                    value={newAssignmentData.title}
                    onChange={e => setNewAssignmentData({ ...newAssignmentData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-sm font-bold text-slate-400 mb-2">Açıklama</label>
                  <textarea
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary outline-none h-32 resize-none transition-all"
                    placeholder="Ödev detaylarını buraya yazın..."
                    value={newAssignmentData.description}
                    onChange={e => setNewAssignmentData({ ...newAssignmentData, description: e.target.value })}
                  />
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Programlama Dili</label>
                    <select
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                      value={newAssignmentData.language}
                      onChange={e => setNewAssignmentData({ ...newAssignmentData, language: e.target.value })}
                    >
                      <option value="python">Python</option>
                      <option value="javascript">JavaScript</option>
                      <option value="java">Java</option>
                      <option value="c++">C++</option>
                      <option value="csharp">C#</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Son Teslim Tarihi</label>
                    <input
                      type="date"
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                      value={newAssignmentData.dueDate ? new Date(newAssignmentData.dueDate).toISOString().split('T')[0] : ''}
                      onChange={e => setNewAssignmentData({ ...newAssignmentData, dueDate: new Date(e.target.value).toISOString() })}
                    />

                  </div>
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2 tracking-wide">AI Seviyesi</label>
                    <select
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                      value={newAssignmentData.studentLevel}
                      onChange={(e: any) => setNewAssignmentData({ ...newAssignmentData, studentLevel: e.target.value })}
                    >
                      <option value="beginner">👶 Başlangıç</option>
                      <option value="intermediate">🎓 Orta</option>
                      <option value="advanced">🚀 İleri</option>
                    </select>
                  </div>
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Hedef Kitle</label>
                    <select
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                      value={newAssignmentData.targetType}
                      onChange={e => setNewAssignmentData({ ...newAssignmentData, targetType: e.target.value as any })}
                    >
                      <option value="all">Tüm Öğrenciler</option>
                      <option value="class">Sınıf Bazlı</option>
                      <option value="specific">Seçili Öğrenciler</option>
                    </select>
                  </div>
                </div>

                {newAssignmentData.targetType === 'class' && (
                  <div>
                    <label className="block text-sm font-bold text-slate-400 mb-2">Sınıf Seçin</label>
                    <select
                      className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white focus:ring-2 focus:ring-primary outline-none"
                      value={newAssignmentData.targetClass}
                      onChange={e => setNewAssignmentData({ ...newAssignmentData, targetClass: e.target.value })}
                    >
                      <option value="">Sınıf Seçiniz</option>
                      {Array.from(new Set(backendStudents.map(s => s.class_code))).filter(Boolean).map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                )}

                {newAssignmentData.targetType === 'specific' && (
                  <div className="space-y-3">
                    <label className="block text-sm font-bold text-slate-400 mb-2">Öğrencileri Seçin</label>
                    <div className="relative">
                      <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                      <input
                        type="text"
                        placeholder="Öğrenci ara..."
                        className="w-full bg-dark-900 border border-dark-700 rounded-xl py-2 pl-10 pr-4 text-xs text-white focus:ring-1 focus:ring-primary outline-none"
                        value={modalSearchTerm}
                        onChange={(e) => setModalSearchTerm(e.target.value)}
                      />
                    </div>
                    <div className="max-h-40 overflow-y-auto bg-dark-900 border border-dark-700 rounded-xl p-3 space-y-2">
                      {backendStudents
                        .filter(s => s.full_name.toLowerCase().includes(modalSearchTerm.toLowerCase()) || s.student_number.includes(modalSearchTerm))
                        .map(student => (
                          <label key={student.student_number} className="flex items-center gap-2 text-white cursor-pointer hover:bg-dark-700 p-1 rounded transition-colors">
                            <input
                              type="checkbox"
                              checked={newAssignmentData.targetStudents?.includes(student.student_number)}
                              onChange={e => {
                                const current = newAssignmentData.targetStudents || [];
                                if (e.target.checked) {
                                  setNewAssignmentData({ ...newAssignmentData, targetStudents: [...current, student.student_number] });
                                } else {
                                  setNewAssignmentData({ ...newAssignmentData, targetStudents: current.filter(id => id !== student.student_number) });
                                }
                              }}
                              className="w-4 h-4 rounded border-dark-600 text-primary focus:ring-primary bg-dark-800"
                            />
                            <span className="text-sm">{student.full_name} ({student.student_number})</span>
                          </label>
                        ))}
                    </div>
                  </div>
                )}
              </div>
              <div className="p-6 border-t border-dark-700 flex justify-end gap-3 bg-dark-900/10">
                <button onClick={closeCreateAssignmentModal} className="px-5 py-2.5 text-slate-400 hover:text-white font-bold transition-colors">İptal</button>
                <button onClick={handleCreateAssignment} className="px-6 py-2.5 bg-primary hover:bg-primary/90 text-white rounded-xl font-bold shadow-lg shadow-primary/20">
                  {editingAssignment ? 'Değişiklikleri Kaydet' : 'Ödevi Yayınla'}
                </button>
              </div>

            </div>
          </div>
        )}

        {/* Submit Code Modal (Student) */}
        {isModalOpen && !isTeacher && selectedAssignment && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-md z-50 flex items-center justify-center p-4">
            <div className="bg-dark-800 w-full max-w-4xl rounded-2xl border border-dark-700 shadow-2xl flex flex-col h-[90vh] animate-in slide-in-from-bottom-8 duration-300">
              <div className="p-4 sm:p-6 border-b border-dark-700 flex justify-between items-center bg-dark-700/30">
                <div className="flex items-center gap-3 sm:gap-4 min-w-0">
                  <div className="p-2 sm:p-2.5 bg-primary/10 rounded-lg text-primary border border-primary/20 flex-shrink-0"><FileCode size={20} className="sm:size-24" /></div>
                  <div className="min-w-0">
                    <h3 className="text-lg sm:text-xl font-bold text-white truncate">{selectedAssignment.title}</h3>
                    <p className="text-[10px] text-slate-400 uppercase font-black tracking-widest">{selectedAssignment.language} Ödevi</p>
                  </div>
                </div>
                <button onClick={closeCodeModal} className="p-2 hover:bg-dark-700 rounded-full transition-colors text-slate-400 hover:text-white flex-shrink-0">
                  <X size={20} />
                </button>
              </div>
              {isDeadlinePassed(selectedAssignment.dueDate) && (
                <div className="bg-rose-500/10 border-b border-rose-500/20 p-3 text-center text-rose-400 text-xs font-black uppercase tracking-widest">
                  ⚠️ Bu ödevin teslim süresi dolmuştur
                </div>
              )}
              <div className="p-4 sm:p-8 flex-1 overflow-y-auto space-y-6">
                <div className="bg-dark-900/80 p-4 sm:p-6 rounded-2xl border border-dark-700 text-slate-300">
                  <h4 className="text-[10px] sm:text-sm font-black text-slate-500 uppercase tracking-widest mb-3">Soru/Tanım</h4>
                  <p className="text-sm sm:text-lg leading-relaxed italic">"{selectedAssignment.description}"</p>
                </div>

                {submitError && (
                  <div className="bg-rose-500/10 border border-rose-500/20 text-rose-400 p-3 rounded-xl text-sm font-medium">
                    {submitError}
                  </div>
                )}

                <div className="flex flex-col gap-3">
                  <div className="flex justify-between items-center px-1">
                    <label className="text-sm font-bold text-slate-400">Kaynak Kod</label>
                    <span className="text-[10px] text-slate-500 font-mono tracking-tighter">CTRL+V ile yapıştırabilirsiniz</span>
                  </div>
                  <div className="bg-[#0d1117] border border-dark-700 rounded-2xl overflow-hidden shadow-inner">
                    <Editor
                      value={codeDraft}
                      onValueChange={code => { setCodeDraft(code); if (submitError) setSubmitError(''); }}
                      highlight={code => highlight(code, languages[selectedAssignment.language.toLowerCase()] || languages.javascript)}
                      padding={20}
                      style={{
                        fontFamily: '"Fira code", "Fira Mono", monospace',
                        fontSize: 14,
                        minHeight: '400px',
                        backgroundColor: 'transparent',
                        color: '#a9b1d6' // Adjusted for prism-tomorrow feel
                      }}
                      className="editor-container"
                    />
                  </div>

                </div>
              </div>
              <div className="p-4 sm:p-6 border-t border-dark-700 flex flex-col sm:flex-row justify-end gap-3 sm:gap-4 bg-dark-900/30 backdrop-blur">
                <button onClick={closeCodeModal} className="w-full sm:w-auto px-6 py-2.5 text-slate-400 hover:text-white font-bold transition-colors order-2 sm:order-1">İptal</button>
                <button
                  onClick={handleSubmitCode}
                  disabled={isGrading || !codeDraft || isDeadlinePassed(selectedAssignment.dueDate)}
                  className="w-full sm:w-auto px-8 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl flex items-center justify-center gap-3 disabled:opacity-50 disabled:cursor-not-allowed font-black shadow-lg shadow-primary/30 active:scale-95 transition-all order-1 sm:order-2">
                  {isGrading ? <Activity className="animate-spin" size={20} /> : <GraduationCap size={20} />}
                  <span className="sm:whitespace-nowrap">
                    {isDeadlinePassed(selectedAssignment.dueDate)
                      ? 'SÜRE DOLDU'
                      : (isGrading ? 'YAPAY ZEKA ANALİZ EDİYOR...' : 'DEĞERLENDİRMEYE GÖNDER')}
                  </span>
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
      <div className="space-y-6 animate-in fade-in duration-500">
        <button onClick={() => setCurrentView('assignments')} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 group font-bold">
          <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={20} /> GERİ DÖN
        </button>

        <div className="bg-dark-800 p-6 sm:p-8 rounded-2xl border border-dark-700 shadow-xl overflow-hidden relative">
          <div className="absolute top-0 right-0 p-8 opacity-5">
            <FileCode size={120} />
          </div>
          <div className="relative z-10 flex flex-col md:flex-row justify-between items-start gap-6">
            <div className="max-w-3xl">
              <h1 className="text-2xl sm:text-4xl font-black text-white mb-4 tracking-tighter">{selectedAssignment.title}</h1>
              <p className="text-slate-400 text-base sm:text-lg leading-relaxed">{selectedAssignment.description}</p>
            </div>
            <span className="px-4 py-2 rounded-xl bg-primary/10 border border-primary/20 text-primary text-[10px] sm:text-xs font-black uppercase tracking-widest whitespace-nowrap">
              {selectedAssignment.studentLevel} Seviye
            </span>
          </div>

          <div className="flex flex-col sm:flex-row gap-4 sm:gap-6 mt-10">
            <div className="bg-dark-900/50 p-6 rounded-2xl border border-dark-700 flex-1">
              <span className="block text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Toplam Teslim</span>
              <span className="text-3xl sm:text-4xl font-black text-white">{assignmentSubmissions.length}</span>
            </div>

            <div className="bg-dark-900/50 p-6 rounded-2xl border border-dark-700 flex-1">
              <span className="block text-[10px] text-slate-500 font-black uppercase tracking-[0.2em] mb-2">Sınıf Ortalaması</span>
              <span className="text-4xl font-black text-primary">
                {assignmentSubmissions.length > 0
                  ? Math.round(assignmentSubmissions.reduce((acc, s) => acc + (s.gradingResult?.grade || 0), 0) / assignmentSubmissions.length)
                  : '-'}
              </span>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-black text-white mt-12 mb-6 flex items-center gap-3">
          <Activity className="text-primary" /> ÖĞRENCİ TESLİMLERİ
        </h3>
        <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-dark-700/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">
              <tr>
                <th className="px-8 py-5 font-bold">Öğrenci</th>
                <th className="px-8 py-5 font-bold">Teslim Tarihi</th>
                <th className="px-8 py-5 font-bold text-center">Not</th>
                <th className="px-8 py-5 font-bold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50 font-medium">
              {assignmentSubmissions.map(sub => (
                <tr key={sub.id} className="hover:bg-dark-700/30 transition-colors group">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-white font-bold text-lg">{sub.studentName}</span>
                      <span className="text-slate-500 text-xs font-mono">{sub.studentId}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-slate-400 text-sm">{new Date(sub.submittedAt).toLocaleDateString()}</td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-4 py-1.5 rounded-lg text-sm font-black shadow-sm border ${(sub.gradingResult?.grade || 0) >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                      (sub.gradingResult?.grade || 0) >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                      }`}>
                      {sub.gradingResult?.grade || 0}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-right">
                    <div className="flex items-center justify-end gap-4 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button
                        onClick={() => setSelectedSubmission(sub)}
                        className="text-primary hover:text-white text-sm font-black tracking-widest uppercase flex items-center gap-1 transition-all">
                        İNCELE <ChevronRight size={14} />
                      </button>
                      <button
                        onClick={() => handleDeleteSubmission(sub.id)}
                        className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                        title="Teslimi Sil">
                        <Trash2 size={18} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {assignmentSubmissions.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic">Henüz bu ödev için bir teslimat yapılmadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderSubmissionDetailModal = () => {
    if (!selectedSubmission || !selectedSubmission.gradingResult) return null;
    const { gradingResult } = selectedSubmission;
    const unitTests = gradingResult.unitTests ?? [];
    const suggestions = gradingResult.suggestions ?? [];
    const isTeacherView = role === 'teacher' || role === 'superadmin';
    const showDirectSolutionWarning =
      isTeacherView && gradingResult.socraticFeedback?.direct_solution_given === true;

    // Sokratik Aşamalı Gösterim (Progressive Disclosure): sadece öğrenci görünümünde
    // ve Sokratik geri bildirim verisi mevcutsa devreye girer. Öğretmen görünümü ve
    // Sokratik verisi olmayan eski kayıtlar her zaman tam raporu doğrudan gösterir.
    const socratic = gradingResult.socraticFeedback;
    const isGated = !isTeacherView && !!socratic;
    const effectiveLevel = isGated ? scaffoldingLevel : 3;
    const secondaryLabel = effectiveLevel === 2 ? 'Tam Raporu Gör (Önerilmez)' : 'Daha Fazla İpucu';

    // Başarı / maksimum deneme istisnaları: öğrenci zaten yüksek puan aldıysa
    // veya bu ödeve 2. (ya da daha sonraki) kez gönderim yaptıysa, sistemi
    // tekrar tekrar denemeye teşvik etmemek için "Kodumu Düzenle" butonu
    // footer'dan tamamen kaldırılır (yalnızca "Kapat" kalır).
    const isSuccessful = (gradingResult.grade ?? 0) >= 90;
    const isMaxRetriesReached = submissions.filter(
      s =>
        s.assignmentId === selectedSubmission.assignmentId &&
        s.studentId === selectedSubmission.studentId
    ).length >= 2;
    const hideEditCodeButton = isSuccessful || isMaxRetriesReached;

    const handleEditCode = () => {
      const targetAssignment = assignments.find(a => a.id === selectedSubmission.assignmentId);
      setSelectedSubmission(null);
      if (targetAssignment) {
        // "Ödevler" görünümüne geçiyoruz ki (rapor Ana Sayfa'daki teslim
        // geçmişinden açılmış olsa bile) currentView'i 'assignments' dışına
        // çıkınca kod modalını temizleyen effect (bkz. yukarıda) yeni açılan
        // editör modalını hemen kapatmasın.
        setCurrentView('assignments');
        setSelectedAssignment(targetAssignment);
        setCodeDraft(selectedSubmission.code);
        setSubmitError('');
        setIsGrading(false);
        setIsModalOpen(true);
      }
    };

    return (
      <div className="fixed inset-0 bg-black/80 backdrop-blur-xl z-[100] overflow-y-auto animate-in fade-in duration-300">
        <div className="min-h-screen flex items-center justify-center p-4">
          <div className="bg-dark-800 w-full max-w-5xl rounded-[2rem] border border-dark-700 shadow-[0_0_50px_-12px_rgba(0,0,0,0.5)] overflow-hidden relative border-primary/20 flex flex-col max-h-[92vh]">
            <button
              onClick={() => setSelectedSubmission(null)}
              className="absolute top-6 right-6 p-3 bg-dark-700/50 hover:bg-dark-600 rounded-full text-slate-400 hover:text-white z-10 transition-all active:scale-95 shadow-lg border border-dark-600">
              <X size={24} />
            </button>

            {isGated && effectiveLevel < 3 ? (
              /* --- Sokratik Kapı: Seviye 0 (Farkındalık) / 1 (+Yönlendirme) / 2 (+İpucu) --- */
              <div className="flex-1 overflow-y-auto p-8 sm:p-16">
                <div className="max-w-2xl mx-auto flex flex-col items-center text-center py-8">
                  <div className="w-16 h-16 rounded-2xl bg-primary/10 text-primary flex items-center justify-center border border-primary/20 mb-8 shadow-lg">
                    <HelpCircle size={30} />
                  </div>
                  <span className="text-primary font-black uppercase tracking-[0.3em] text-[10px] mb-4">Farkındalık Sorusu</span>
                  <p className="text-2xl sm:text-3xl font-black text-white leading-snug tracking-tight">
                    {socratic.awareness_question}
                  </p>

                  {effectiveLevel >= 1 && (
                    <div className="w-full mt-10 pt-8 border-t border-dark-700/60 animate-in fade-in slide-in-from-bottom-2 duration-500">
                      <div className="flex flex-col items-center">
                        <div className="w-12 h-12 rounded-xl bg-blue-500/10 text-blue-400 flex items-center justify-center border border-blue-500/20 mb-4">
                          <Compass size={22} />
                        </div>
                        <span className="text-blue-400 font-black uppercase tracking-[0.3em] text-[10px] mb-3">Yönlendirici Soru</span>
                        <p className="text-lg sm:text-xl font-bold text-slate-100 leading-relaxed">
                          {socratic.guiding_question}
                        </p>
                      </div>
                    </div>
                  )}

                  {effectiveLevel >= 2 && (
                    <div className="w-full mt-10 pt-8 border-t border-dark-700/60 animate-in fade-in slide-in-from-bottom-2 duration-500 space-y-4 text-left">
                      <div className="bg-amber-500/5 border border-amber-500/20 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <Lightbulb size={16} className="text-amber-400" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-amber-400">İpucu</h4>
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed">{socratic.progressive_hint}</p>
                      </div>
                      <div className="bg-emerald-500/5 border border-emerald-500/20 rounded-2xl p-5">
                        <div className="flex items-center gap-2 mb-2">
                          <ArrowRight size={16} className="text-emerald-400" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Sonraki Adım</h4>
                        </div>
                        <p className="text-slate-200 text-sm leading-relaxed">{socratic.next_action}</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ) : (
            /* --- Tam Rapor: Seviye 3 (öğrenci) / her zaman (öğretmen ya da Sokratik veri yok) --- */
            <div className="flex-1 overflow-y-auto">
            <div className="grid grid-cols-1 lg:grid-cols-4">
              {/* Sidebar Info */}
              <div className="p-10 bg-dark-900/50 border-r border-dark-700/50 h-full">
                <div className="flex flex-col items-center text-center">
                  <div className={`w-40 h-40 rounded-full flex flex-col items-center justify-center border-8 mb-6 shadow-2xl relative ${gradingResult.grade >= 70 ? 'border-emerald-500/10 text-emerald-400' :
                    gradingResult.grade >= 50 ? 'border-amber-500/10 text-amber-400' : 'border-rose-500/10 text-rose-400'
                    }`}>
                    <span className="text-6xl font-black tracking-tighter">{gradingResult.grade}</span>
                    <span className="text-[10px] font-black uppercase tracking-[0.3em] opacity-50">SKOR</span>
                    <div className="absolute inset-0 rounded-full border border-white/5 animate-pulse"></div>
                  </div>
                  <h3 className="text-white font-black text-2xl mb-1 tracking-tight">KOD KALİTESİ</h3>
                  <p className="text-primary font-black uppercase tracking-[0.2em] text-xs px-4 py-1.5 bg-primary/10 rounded-full border border-primary/20 shadow-sm">{gradingResult.codeQuality}</p>
                </div>

                <div className="space-y-4 mt-10">
                  <div className="bg-dark-800/80 p-5 rounded-2xl border border-dark-700 shadow-sm">
                    <h4 className="text-slate-500 text-[10px] uppercase font-black mb-1 opacity-50 tracking-widest">Öğrenci</h4>
                    <p className="text-white font-bold truncate">{selectedSubmission.studentName}</p>
                  </div>
                  <div className="bg-dark-800/80 p-5 rounded-2xl border border-dark-700 shadow-sm">
                    <h4 className="text-slate-500 text-[10px] uppercase font-black mb-1 opacity-50 tracking-widest">İşlem Zamanı</h4>
                    <p className="text-white font-bold text-xs">{new Date(selectedSubmission.submittedAt).toLocaleString()}</p>
                  </div>
                </div>
              </div>

              {/* Detail Content */}
              <div className="lg:col-span-3 p-10 space-y-12">
                <header>
                  <h2 className="text-3xl font-black text-white flex items-center gap-4 tracking-tighter">
                    <div className="w-12 h-12 bg-primary/10 text-primary flex items-center justify-center rounded-2xl border border-primary/20"><Activity size={24} /></div>
                    AI ANALİZ RAPORU
                  </h2>
                </header>

                <section className="animate-in slide-in-from-right-4 duration-500 delay-100">
                  <h3 className="text-lg font-black text-white/50 mb-4 tracking-[0.2em] uppercase text-xs">Genel Geri Bildirim</h3>
                  <div className="text-slate-100 text-lg leading-relaxed bg-dark-900/80 p-8 rounded-3xl border border-dark-700 shadow-inner italic font-medium relative">
                    <div className="absolute top-0 left-0 p-4 opacity-5"><FileCode size={40} /></div>
                    "{gradingResult.feedback}"
                  </div>
                </section>

                <section className="animate-in slide-in-from-right-4 duration-500 delay-200">
                  <h3 className="text-lg font-black text-white/50 mb-4 tracking-[0.2em] uppercase text-xs">Birim Testleri (Unit Tests)</h3>
                  <div className="grid gap-3">
                    {unitTests.length > 0 ? unitTests.map((test, idx) => (
                      <div key={idx} className="flex items-center justify-between p-5 bg-dark-900/50 rounded-2xl border border-dark-700 group hover:border-primary/20 transition-all">
                        <div className="flex items-center gap-4">
                          <div className={`p-2 rounded-lg ${test.passed ? 'bg-emerald-500/10 text-emerald-500' : 'bg-rose-500/10 text-rose-500'}`}>
                            {test.passed ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
                          </div>
                          <span className="text-slate-100 font-bold">{test.testName}</span>
                        </div>
                        <span className={`text-sm font-black uppercase tracking-widest ${test.passed ? 'text-emerald-400' : 'text-rose-400'}`}>
                          {test.message}
                        </span>
                      </div>
                    )) : (
                      <p className="text-slate-500 text-sm italic p-4 bg-dark-900/30 rounded-2xl border border-dark-700">Birim testi sonucu bulunmuyor.</p>
                    )}
                  </div>
                </section>

                <section className="animate-in slide-in-from-right-4 duration-500 delay-300">
                  <h3 className="text-lg font-black text-white/50 mb-4 tracking-[0.2em] uppercase text-xs">Gelişim Tavsiyeleri</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {suggestions.length > 0 ? suggestions.map((sug, idx) => (
                      <div key={idx} className="flex gap-4 p-5 bg-dark-900/30 rounded-2xl border border-dark-700 group hover:bg-dark-700/20 transition-all">
                        <div className="w-8 h-8 rounded-full bg-primary/10 text-primary flex items-center justify-center font-black text-sm shrink-0 border border-primary/20">{idx + 1}</div>
                        <p className="text-slate-300 text-sm leading-relaxed">{sug}</p>
                      </div>
                    )) : (
                      <p className="text-slate-500 text-sm italic p-4 bg-dark-900/30 rounded-2xl border border-dark-700">Gelişim tavsiyesi bulunmuyor.</p>
                    )}
                  </div>
                </section>

                {gradingResult.rubricScores && (
                  <section className="animate-in slide-in-from-right-4 duration-500 delay-350">
                    <h3 className="text-lg font-black text-white/50 mb-4 tracking-[0.2em] uppercase text-xs">Rubrik Alt Puanları</h3>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {[
                        { label: 'Doğruluk', value: gradingResult.rubricScores.correctness },
                        { label: 'Algoritmik Düşünme', value: gradingResult.rubricScores.algorithmic_thinking },
                        { label: 'Sözdizimi ve Dil', value: gradingResult.rubricScores.syntax_and_language_use },
                        { label: 'Okunabilirlik', value: gradingResult.rubricScores.code_readability },
                        { label: 'Hata Ayıklama Farkındalığı', value: gradingResult.rubricScores.debugging_awareness },
                      ].map((item) => (
                        <div key={item.label} className="flex items-center justify-between p-4 bg-dark-900/50 rounded-2xl border border-dark-700">
                          <span className="text-slate-300 text-sm font-medium">{item.label}</span>
                          <span className="text-primary font-black">{item.value}/5</span>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {gradingResult.errorFindings && gradingResult.errorFindings.length > 0 && (
                  <section className="animate-in slide-in-from-right-4 duration-500 delay-400">
                    <h3 className="text-lg font-black text-white/50 mb-4 tracking-[0.2em] uppercase text-xs">Tespit Edilen Hatalar</h3>
                    <div className="grid gap-3">
                      {gradingResult.errorFindings.map((finding, idx) => (
                        <div key={idx} className="p-5 bg-dark-900/50 rounded-2xl border border-dark-700 space-y-2">
                          <div className="flex items-center gap-3 flex-wrap">
                            <span className="text-xs font-black uppercase tracking-widest text-primary">{finding.error_type}</span>
                            <span className="text-xs font-bold text-slate-500 uppercase">{finding.severity}</span>
                            {finding.location_hint && (
                              <span className="text-xs text-slate-500 italic">{finding.location_hint}</span>
                            )}
                          </div>
                          <p className="text-slate-300 text-sm">{finding.explanation}</p>
                          {finding.misconception && (
                            <p className="text-slate-500 text-xs italic">Kavram yanılgısı: {finding.misconception}</p>
                          )}
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {gradingResult.socraticFeedback && (
                  <section className="animate-in slide-in-from-right-4 duration-500 delay-450">
                    <h3 className="text-lg font-black text-white/50 mb-4 tracking-[0.2em] uppercase text-xs">Sokratik Geri Bildirim</h3>
                    <div className="grid gap-3">
                      {[
                        { label: 'Farkındalık Sorusu', value: gradingResult.socraticFeedback.awareness_question },
                        { label: 'Yönlendirici Soru', value: gradingResult.socraticFeedback.guiding_question },
                        { label: 'Kademeli İpucu', value: gradingResult.socraticFeedback.progressive_hint },
                        { label: 'Sonraki Adım', value: gradingResult.socraticFeedback.next_action },
                      ].map((item) => (
                        <div key={item.label} className="p-5 bg-dark-900/30 rounded-2xl border border-dark-700">
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-2">{item.label}</h4>
                          <p className="text-slate-300 text-sm leading-relaxed">{item.value}</p>
                        </div>
                      ))}
                    </div>
                  </section>
                )}

                {showDirectSolutionWarning && (
                  <section className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl">
                    <p className="text-amber-300 text-sm font-medium">
                      Bu değerlendirme çıktısında doğrudan çözüm verme riski tespit edilmiştir. Geri bildirimin pedagojik uygunluğu öğretim elemanı tarafından kontrol edilmelidir.
                    </p>
                  </section>
                )}

                <section className="animate-in slide-in-from-right-4 duration-500 delay-400">
                  <div className="flex justify-between items-center mb-4">
                    <h3 className="text-lg font-black text-white/50 tracking-[0.2em] uppercase text-xs">Gönderilen Kod</h3>
                    <span className="text-[10px] text-slate-600 font-bold uppercase tracking-widest">Syntax Highlighted (AI View)</span>
                  </div>
                  <pre className="bg-[#0b0e14] p-8 rounded-3xl border border-dark-700 overflow-x-auto text-sm font-mono text-emerald-400/80 shadow-2xl relative group">
                    <div className="absolute top-4 right-6 text-xs text-white/10 font-black pointer-events-none group-hover:opacity-100 transition-opacity">SOURCE CODE</div>
                    <code>{selectedSubmission.code}</code>
                  </pre>
                </section>
              </div>
            </div>
            </div>
            )}

            {isGated && (
              <div className={`border-t border-dark-700/60 bg-dark-900/60 p-5 sm:p-6 flex flex-col-reverse sm:flex-row items-center gap-3 shrink-0 ${hideEditCodeButton ? 'justify-center' : 'justify-between'}`}>
                {effectiveLevel < 3 ? (
                  <button
                    onClick={() => setScaffoldingLevel(l => Math.min(l + 1, 3))}
                    className={`w-full sm:w-auto px-6 py-3 rounded-xl text-sm font-bold transition-all active:scale-95 border ${effectiveLevel === 2
                      ? 'bg-amber-500/10 text-amber-400 border-amber-500/30 hover:bg-amber-500/20'
                      : 'bg-dark-700 hover:bg-dark-600 text-white border-dark-600'
                      }`}>
                    {secondaryLabel}
                  </button>
                ) : (
                  <button
                    onClick={() => setSelectedSubmission(null)}
                    className={`px-6 py-3 bg-dark-700 hover:bg-dark-600 text-white rounded-xl text-sm font-bold transition-all border border-dark-600 active:scale-95 ${hideEditCodeButton ? 'w-full sm:w-auto sm:min-w-[200px]' : 'w-full sm:w-auto'}`}>
                    Kapat
                  </button>
                )}
                {/* Başarılı (>=90 puan) veya maksimum deneme hakkı (2+ gönderim)
                    durumunda öğrenciyi tekrar denemeye teşvik etmemek için
                    "Kodumu Düzenle" butonu tamamen gizlenir. */}
                {!hideEditCodeButton && (
                  <button
                    onClick={handleEditCode}
                    className="w-full sm:w-auto px-6 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl text-sm font-black transition-all shadow-lg shadow-primary/20 active:scale-95">
                    Kodumu Düzenle
                  </button>
                )}
              </div>
            )}
          </div>
        </div>
      </div>
    );
  };

  const renderStudentsView = () => {
    // Get unique classes for filter
    const classes = Array.from(new Set(backendStudents.map(s => s.class_code))).filter(Boolean).sort();

    // Filter and Sort Students
    const filteredStudents = backendStudents
      .filter(student => {
        const matchesSearch = student.full_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          student.student_number.includes(searchTerm);
        const matchesClass = classFilter === 'all' || student.class_code === classFilter;
        return matchesSearch && matchesClass;
      })
      .sort((a, b) => {
        // Sort by class first, then by name
        if (a.class_code < b.class_code) return -1;
        if (a.class_code > b.class_code) return 1;
        return a.full_name.localeCompare(b.full_name);
      });

    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <h2 className="text-2xl font-bold text-white tracking-tight">Öğrenci Listesi</h2>
          <div className="flex flex-wrap gap-3 w-full md:w-auto">
            <div className="relative flex-1 md:w-64">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" size={18} />
              <input
                type="text"
                placeholder="Öğrenci Ara..."
                className="w-full bg-dark-800 border border-dark-700 rounded-xl py-2 pl-10 pr-4 text-sm text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <select
              className="bg-dark-800 border border-dark-700 rounded-xl px-4 py-2 text-sm text-white focus:ring-2 focus:ring-primary outline-none"
              value={classFilter}
              onChange={(e) => setClassFilter(e.target.value)}
            >
              <option value="all">Tüm Sınıflar</option>
              {classes.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
            <div className="text-sm text-slate-500 font-bold uppercase tracking-widest bg-dark-800 px-4 py-2 rounded-xl border border-dark-700 flex items-center">
              {filteredStudents.length} ÖĞRENCİ
            </div>
          </div>
        </div>

        <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden shadow-2xl">
          <table className="w-full text-left">
            <thead className="bg-dark-700/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">
              <tr>
                <th className="px-8 py-5 font-bold">Öğrenci Adı</th>
                <th className="px-8 py-5 font-bold">Öğrenci No</th>
                <th className="px-8 py-5 font-bold">Sınıf</th>
                <th className="px-8 py-5 font-bold text-center">Ödev Durumu</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {filteredStudents.map(student => {
                const studentSubs = submissions.filter(s => s.studentId === student.id.toString());

                return (
                  <tr
                    key={student.id}
                    onClick={() => { setSelectedStudent(student); setCurrentView('student_analysis_detail'); }}
                    className="hover:bg-dark-700/40 transition-colors group cursor-pointer"
                  >
                    <td className="px-8 py-6 text-white font-bold">{student.full_name}</td>
                    <td className="px-8 py-6 text-slate-400 font-mono text-sm">{student.student_number}</td>
                    <td className="px-8 py-6 text-slate-400">{student.class_code}</td>
                    <td className="px-8 py-6 text-center">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${studentSubs.length > 0 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                        }`}>
                        {studentSubs.length > 0 ? `${studentSubs.length} ÖDEV TAMAM` : 'HİÇ ÖDEV YOK'}
                      </span>
                    </td>
                  </tr>
                );
              })}
              {filteredStudents.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic">Aranan kriterlere uygun öğrenci bulunamadı.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    );
  };

  const renderStudentAnalysisDetailView = () => {
    if (!selectedStudent) return null;
    const studentSubs = submissions.filter(s => s.studentId === selectedStudent.id.toString());


    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <button onClick={() => setCurrentView('students')} className="text-slate-400 hover:text-white flex items-center gap-2 mb-4 group font-bold transition-all">
          <ChevronRight className="rotate-180 group-hover:-translate-x-1 transition-transform" size={20} /> ÖĞRENCİ LİSTESİNE DÖN
        </button>

        <div className="bg-dark-800 p-8 rounded-2xl border border-dark-700 shadow-xl overflow-hidden relative">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 rounded-full bg-primary/20 border-2 border-primary/30 flex items-center justify-center overflow-hidden shadow-inner">
              <img src={"https://api.dicebear.com/7.x/avataaars/svg?seed=" + selectedStudent.student_number} alt="" className="w-full h-full object-cover" />
            </div>
            <div>
              <h1 className="text-3xl font-black text-white tracking-tighter">{selectedStudent.full_name}</h1>
              <div className="flex items-center gap-4 mt-2">
                <span className="text-slate-400 font-mono tracking-wider">{selectedStudent.student_number}</span>
                <span className="w-1.5 h-1.5 rounded-full bg-dark-600"></span>
                <span className="text-slate-400 font-medium">{selectedStudent.class_code} Sınıfı</span>
                <span className="px-4 py-1 rounded-full bg-primary/10 text-primary text-[10px] font-black border border-primary/20">{studentSubs.length} TESLİMAT</span>
              </div>
            </div>
          </div>
        </div>

        <h3 className="text-xl font-black text-white mt-12 mb-6 flex items-center gap-3">
          <Activity className="text-primary" /> YAPILAN ÖDEVLER
        </h3>

        <div className="grid gap-4">
          {studentSubs.map(sub => {
            const assignment = assignments.find(a => a.id === sub.assignmentId);
            return (
              <div key={sub.id} className="bg-dark-800 p-6 rounded-xl border border-dark-700 hover:border-primary/50 transition-all group flex justify-between items-center shadow-lg">
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 rounded-lg bg-dark-700 flex items-center justify-center text-primary border border-dark-600 group-hover:scale-110 transition-transform">
                    <FileCode size={24} />
                  </div>
                  <div>
                    <h4 className="text-lg font-bold text-white group-hover:text-primary transition-colors">{assignment?.title || 'Bilinmeyen Ödev'}</h4>
                    <p className="text-slate-500 text-xs mt-1">{new Date(sub.submittedAt).toLocaleDateString()} tarihinde teslim edildi</p>
                  </div>
                </div>
                <div className="flex items-center gap-8">
                  <div className={`px-4 py-2 rounded-lg text-lg font-black border tracking-tighter ${(sub.gradingResult?.grade || 0) >= 70 ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' :
                    (sub.gradingResult?.grade || 0) >= 50 ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-rose-500/10 text-rose-400 border-rose-500/20'
                    }`}>
                    {sub.gradingResult?.grade || 0}
                  </div>
                  <button
                    onClick={() => setSelectedSubmission(sub)}
                    className="bg-dark-700 hover:bg-dark-600 text-white px-5 py-2 rounded-lg text-xs font-black tracking-widest uppercase transition-all shadow-sm active:scale-95 border border-dark-600">
                    DETAYI GÖR
                  </button>
                </div>
              </div>
            );
          })}
          {studentSubs.length === 0 && (
            <div className="text-center py-20 text-slate-500 italic bg-dark-800/30 rounded-2xl border border-dark-700 border-dashed">
              <FileCode size={48} className="mx-auto mb-4 opacity-10" />
              Bu öğrenci henüz bir ödev teslim etmedi.
            </div>
          )}
        </div>
      </div>
    );
  };

  const renderProfileView = () => {
    const handlePasswordChange = async (e: React.FormEvent) => {
      e.preventDefault();
      if (profilePassData.new !== profilePassData.confirm) {
        setProfileMsg({ type: 'error', text: 'Yeni şifreler eşleşmiyor!' });
        return;
      }
      setProfileLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/users/change-password`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ oldPassword: profilePassData.old, newPassword: profilePassData.new })
        });
        if (res.ok) {
          setProfileMsg({ type: 'success', text: 'Şifreniz başarıyla değiştirildi.' });
          setProfilePassData({ old: '', new: '', confirm: '' });
        } else {
          const err = await res.json();
          setProfileMsg({ type: 'error', text: err.detail || 'Hata oluştu!' });
        }
      } catch (e) {
        setProfileMsg({ type: 'error', text: 'Sunucuya ulaşılamadı!' });
      } finally { setProfileLoading(false); }
    };

    const handleProfileUpdate = async () => {
      setProfileLoading(true);
      try {
        const res = await fetch(`${API_BASE_URL}/users/update-profile`, {
          method: 'PUT',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({
            avatarUrl: profileNewAvatar,
            full_name: profileFullName,
            email: profileEmail
          })
        });
        if (res.ok) {
          updateAvatar(profileNewAvatar);
          updateName(profileFullName);
          setProfileMsg({ type: 'success', text: 'Profil bilgileriniz güncellendi.' });
        } else {
          setProfileMsg({ type: 'error', text: 'Hata oluştu!' });
        }
      } catch (e) {
        setProfileMsg({ type: 'error', text: 'Sunucu hatası!' });
      } finally { setProfileLoading(false); }
    };

    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-in fade-in slide-in-from-bottom-4 duration-500">
        <h2 className="text-3xl font-black text-white tracking-tighter flex items-center gap-3">
          <UserIcon className="text-primary" size={32} /> PROFİL AYARLARI
        </h2>

        {profileMsg.text && (
          <div className={`p-4 rounded-xl border ${profileMsg.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400' : 'bg-rose-500/10 border-rose-500/20 text-rose-400'} flex items-center gap-3 font-bold`}>
            {profileMsg.type === 'success' ? <CheckCircle2 size={20} /> : <AlertCircle size={20} />}
            {profileMsg.text}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div className="bg-dark-800 p-8 rounded-3xl border border-dark-700 shadow-xl space-y-6 text-center">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest">Kullanıcı Bilgileri</h3>
            <div className="relative group mx-auto w-32 h-32">
              <div className="w-32 h-32 rounded-full overflow-hidden border-4 border-primary/20 shadow-2xl">
                <img src={profileNewAvatar} alt="Avatar" className="w-full h-full object-cover" />
              </div>
              <div className="absolute inset-0 bg-black/40 rounded-full opacity-0 group-hover:opacity-100 flex items-center justify-center transition-opacity cursor-pointer">
                <Camera className="text-white" size={24} />
              </div>
            </div>
            <div className="space-y-4 text-left">
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Görünen İsim</label>
                <input
                  type="text"
                  placeholder="Ad Soyad"
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
                  value={profileFullName || ''}
                  onChange={(e) => setProfileFullName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">Avatar URL</label>
                <input
                  type="text"
                  placeholder="Resim URL'si"
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-xs text-white outline-none focus:ring-1 focus:ring-primary"
                  value={profileNewAvatar || ''}
                  onChange={(e) => setProfileNewAvatar(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] mb-1.5 ml-1">E-Posta Adresi</label>
                <input
                  type="email"
                  placeholder="ornek@edustack.cloud"
                  className="w-full bg-dark-900 border border-dark-700 rounded-xl p-2.5 text-sm text-white outline-none focus:ring-1 focus:ring-primary"
                  value={profileEmail || ''}
                  onChange={(e) => setProfileEmail(e.target.value)}
                />
              </div>

              <div className="pt-2">
                <button
                  onClick={handleProfileUpdate}
                  disabled={profileLoading}
                  className="w-full py-3 bg-primary text-white hover:bg-primary/90 rounded-xl text-xs font-black uppercase tracking-widest transition-all shadow-lg shadow-primary/20 flex items-center justify-center gap-2"
                >
                  <Save size={16} /> BİLGİLERİ KAYDET
                </button>
                <button
                  onClick={() => setProfileNewAvatar("https://api.dicebear.com/7.x/avataaars/svg?seed=" + Math.random())}
                  className="w-full text-[10px] text-slate-500 hover:text-white underline transition-colors"
                  disabled={profileLoading}
                >
                  Rastgele Avatar Oluştur
                </button>
              </div>
            </div>
          </div>

          <div className="md:col-span-2 bg-dark-800 p-8 rounded-3xl border border-dark-700 shadow-xl">
            <h3 className="text-sm font-black text-slate-500 uppercase tracking-widest mb-6 flex items-center gap-2">
              <KeyRound size={18} className="text-primary" /> ŞİFRE DEĞİŞTİR
            </h3>
            <form onSubmit={handlePasswordChange} className="space-y-4">
              <div>
                <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Mevcut Şifre</label>
                <div className="relative">
                  <LockIcon className="absolute left-3 top-3 text-slate-600" size={18} />
                  <input
                    type="password"
                    required
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl py-2.5 pl-10 pr-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={profilePassData.old}
                    onChange={(e) => setProfilePassData({ ...profilePassData, old: e.target.value })}
                  />
                </div>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Yeni Şifre</label>
                  <input
                    type="password"
                    required
                    minLength={6}
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={profilePassData.new}
                    onChange={(e) => setProfilePassData({ ...profilePassData, new: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-2 ml-1">Şifre Tekrar</label>
                  <input
                    type="password"
                    required
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl py-2.5 px-4 text-white focus:ring-2 focus:ring-primary outline-none transition-all"
                    value={profilePassData.confirm}
                    onChange={(e) => setProfilePassData({ ...profilePassData, confirm: e.target.value })}
                  />
                </div>
              </div>
              <button
                type="submit"
                disabled={profileLoading}
                className="w-full mt-4 py-3 bg-primary hover:bg-primary/90 text-white rounded-xl font-black uppercase tracking-[0.2em] shadow-lg shadow-primary/20 transition-all active:scale-95 disabled:opacity-50"
              >
                {profileLoading ? 'GÜNCELLENİYOR...' : 'ŞİFREYİ KAYDET'}
              </button>
            </form>
          </div>
        </div>

        <div className="bg-dark-800/50 p-6 rounded-2xl border border-dark-700 border-dashed flex flex-col md:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-dark-700 rounded-xl flex items-center justify-center text-slate-400">
              <Activity size={24} />
            </div>
            <div>
              <h4 className="text-white font-bold">{username}</h4>
              <p className="text-slate-500 text-xs">Okul No: {studentNumber} | Sınıf: {classCode || 'Tanımsız'}</p>
            </div>
          </div>
          <div className="px-4 py-1.5 bg-dark-700 rounded-lg text-slate-400 text-[10px] font-black tracking-widest uppercase">
            {role === 'teacher' ? '📜 ÖĞRETMEN YETKİSİ' : (role === 'superadmin' ? '⚡ SİSTEM YÖNETİCİSİ' : '🎓 ÖĞRENCİ HESABI')}
          </div>
        </div>
      </div>
    );
  };

  const renderAnnouncementManagementView = () => {
    return (
      <div className="space-y-6 animate-in fade-in duration-500">
        <div className="flex justify-between items-center">
          <h2 className="text-2xl font-bold text-white tracking-tight">Duyuru Yönetimi</h2>
          <button
            onClick={() => setIsModalOpen(true)}
            className="bg-primary hover:bg-primary/90 text-white px-5 py-2.5 rounded-xl flex items-center gap-2 transition-all font-semibold shadow-lg shadow-primary/20"
          >
            <Plus size={20} /> Yeni Duyuru
          </button>
        </div>

        <div className="bg-dark-800 rounded-2xl border border-dark-700 overflow-hidden shadow-2xl overflow-x-auto">
          <table className="w-full text-left min-w-[600px]">

            <thead className="bg-dark-700/80 text-slate-400 text-[10px] font-black uppercase tracking-[0.15em]">
              <tr>
                <th className="px-8 py-5 font-bold">Başlık</th>
                <th className="px-8 py-5 font-bold text-center">Tür</th>
                <th className="px-8 py-5 font-bold">Tarih</th>
                <th className="px-8 py-5 font-bold text-right">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-dark-700/50">
              {announcements.map(ann => (
                <tr key={ann.id} className="hover:bg-dark-700/30 transition-colors group text-sm">
                  <td className="px-8 py-6">
                    <div className="flex flex-col">
                      <span className="text-white font-bold">{ann.title}</span>
                      <span className="text-slate-500 text-xs line-clamp-1">{ann.content}</span>
                    </div>
                  </td>
                  <td className="px-8 py-6 text-center">
                    <span className={`px-3 py-1 rounded-full text-[10px] font-black tracking-widest uppercase border ${ann.type === 'warning' ? 'bg-amber-500/10 text-amber-400 border-amber-500/20' : 'bg-primary/10 text-primary border-primary/20'}`}>
                      {ann.type === 'warning' ? 'UYARI' : 'BİLGİ'}
                    </span>
                  </td>
                  <td className="px-8 py-6 text-slate-400 font-medium">{ann.date}</td>
                  <td className="px-8 py-6 text-right">
                    <button
                      onClick={() => handleDeleteAnnouncement(ann.id)}
                      className="p-2 text-rose-500 hover:bg-rose-500/10 rounded-lg transition-all"
                    >
                      <Trash2 size={18} />
                    </button>
                  </td>
                </tr>
              ))}
              {announcements.length === 0 && (
                <tr>
                  <td colSpan={4} className="px-8 py-20 text-center text-slate-500 italic">Henüz duyuru bulunmuyor.</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {isModalOpen && (
          <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[110] flex items-center justify-center p-4 animate-in fade-in duration-200">
            <div className="bg-dark-800 w-full max-w-md rounded-2xl border border-dark-700 shadow-2xl p-8 relative">
              <button onClick={() => setIsModalOpen(false)} className="absolute top-4 right-4 p-2 text-slate-500 hover:text-white"><X size={20} /></button>
              <h3 className="text-xl font-bold text-white mb-6">Yeni Duyuru Oluştur</h3>
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Başlık</label>
                  <input
                    type="text"
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-primary"
                    placeholder="Duyuru başlığı..."
                    value={newAnnData.title}
                    onChange={e => setNewAnnData({ ...newAnnData, title: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">İçerik</label>
                  <textarea
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-primary min-h-[100px]"
                    placeholder="Duyuru metni..."
                    value={newAnnData.content}
                    onChange={e => setNewAnnData({ ...newAnnData, content: e.target.value })}
                  />
                </div>
                <div>
                  <label className="block text-xs font-black text-slate-500 uppercase tracking-widest mb-1.5 ml-1">Tür</label>
                  <select
                    className="w-full bg-dark-900 border border-dark-700 rounded-xl p-3 text-white outline-none focus:ring-1 focus:ring-primary"
                    value={newAnnData.type}
                    onChange={e => setNewAnnData({ ...newAnnData, type: e.target.value as any })}
                  >
                    <option value="info">Bilgi (Mavi)</option>
                    <option value="warning">Uyarı (Turuncu)</option>
                  </select>
                </div>
                <button
                  onClick={handleCreateAnnouncement}
                  className="w-full py-3 bg-primary text-white font-black rounded-xl hover:bg-primary/90 transition-all shadow-lg shadow-primary/20 mt-4"
                >
                  YAYINLA
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  };

  return (
    <Layout user={user} onLogout={handleLogout} currentView={currentView} setCurrentView={setCurrentView}>
      {currentView === 'home' && renderHomeView()}
      {currentView === 'teacher_dashboard' && (user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) && <TeacherDashboard />}
      {currentView === 'assignments' && renderAssignmentsView()}
      {currentView === 'assignment_detail' && (user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) && renderAssignmentDetailView()}
      {currentView === 'announcement_management' && (user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) && renderAnnouncementManagementView()}
      {currentView === 'students' && (user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) && renderStudentsView()}
      {currentView === 'student_analysis_detail' && (user.role === UserRole.TEACHER || user.role === UserRole.SUPERADMIN) && renderStudentAnalysisDetailView()}
      {currentView === 'system_panel' && user.role === UserRole.SUPERADMIN && <SuperAdminDashboard />}
      {currentView === 'profile' && renderProfileView()}
      {currentView === 'leaderboard' && <Leaderboard />}
      {selectedSubmission && renderSubmissionDetailModal()}

      {toast && toast.visible && (
        <div className="fixed top-6 right-6 z-[200] animate-in slide-in-from-right duration-500">
          <div className="bg-dark-800 border-l-4 border-yellow-500 p-6 rounded-xl shadow-2xl flex items-start gap-4 max-w-sm border border-dark-700">
            <div className="p-3 bg-yellow-500/10 rounded-full text-yellow-500 flex-shrink-0 animate-bounce">
              <Award size={32} />
            </div>
            <div>
              <h4 className="font-bold text-white text-lg leading-tight">{toast.title}</h4>
              <p className="text-slate-400 text-sm mt-1 leading-snug">{toast.msg}</p>
            </div>
            <button onClick={() => setToast(null)} className="text-slate-500 hover:text-white absolute top-4 right-4"><X size={18} /></button>
          </div>
        </div>
      )}

    </Layout>
  );
};

// Reads the session boundary marker from AuthContext and applies it as a React
// `key` on AppContent. Changing `key` forces React to unmount the previous
// AppContent instance (discarding all of its state, closures, and any
// in-flight requests it had queued via useEffect cleanups) and mount a brand
// new one — guaranteeing a clean slate on every login, logout, and tenant
// switch. This is the primary defense against stale-session data leaking into
// a different user's view.
const AppRoot = () => {
  const { sessionNonce } = useAuth();
  return <AppContent key={sessionNonce} />;
};

export default function App() {
  return (
    <AuthProvider>
      <AppRoot />
    </AuthProvider>
  );
}