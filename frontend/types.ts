export enum UserRole {
  TEACHER = 'TEACHER',
  STUDENT = 'STUDENT',
  SUPERADMIN = 'SUPERADMIN'
}

export interface User {
  id: string;
  name: string;
  email?: string;
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
  teacherName?: string;
}

export interface UnitTestResult {
  testName: string;
  passed: boolean;
  message: string;
}

export interface RubricScores {
  correctness: number;
  algorithmic_thinking: number;
  syntax_and_language_use: number;
  code_readability: number;
  debugging_awareness: number;
}

export interface ErrorFinding {
  error_type: string;
  severity: string;
  location_hint?: string;
  explanation: string;
  misconception?: string;
}

export interface SocraticFeedback {
  awareness_question: string;
  guiding_question: string;
  progressive_hint: string;
  next_action: string;
  direct_solution_given: boolean;
}

export interface PedagogicalMetadata {
  feedback_strategy: string;
  scaffolding_level: string;
  student_level: string;
  prompt_version: string;
  rubric_version: string;
  model_name?: string;
}

export interface GradingResult {
  grade: number;
  feedback: string;
  codeQuality: string;
  suggestions: string[];
  unitTests: UnitTestResult[];
  rubricScores?: RubricScores;
  errorFindings?: ErrorFinding[];
  socraticFeedback?: SocraticFeedback;
  pedagogicalMetadata?: PedagogicalMetadata;
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