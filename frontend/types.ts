export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT'
}

export interface User {
  id: string;
  name: string;
  role: UserRole;
  avatar: string;
}

export interface Badge {
  name: string;
  icon: string;
  description: string;
}

export interface Assignment {
  id: string;
  title: string;
  description: string;
  dueDate: string; // ISO string
  language: string;
  studentLevel: 'beginner' | 'intermediate' | 'advanced';
  status: 'active' | 'expired';
  targetType: 'all' | 'class' | 'specific';
  targetClass?: string;
  targetStudents?: string[]; // Student numbers
}

export interface UnitTestResult {
  testName: string;
  passed: boolean;
  message: string;
}

export interface GradingResult {
  grade: number;
  feedback: string;
  codeQuality: string;
  suggestions: string[];
  unitTests: UnitTestResult[];
}

export interface Submission {
  id: string;
  assignmentId: string;
  studentId: string;
  studentName: string;
  code: string;
  submittedAt: string;
  gradingResult?: GradingResult;
  status: 'pending' | 'graded';
  newBadges?: Badge[];
}

export interface Announcement {
  id: string;
  title: string;
  content: string;
  date: string;
  type: 'info' | 'warning' | 'success';
}