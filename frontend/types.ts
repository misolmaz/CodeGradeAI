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

export type RubricScoreValue = 1 | 2 | 3 | 4 | 5;

export type ErrorType =
  | 'syntax_error'
  | 'runtime_error'
  | 'logic_error'
  | 'conceptual_error'
  | 'boundary_case_error'
  | 'data_type_error'
  | 'loop_error'
  | 'conditional_error'
  | 'function_structure_error'
  | 'input_output_format_error'
  | 'code_readability_issue'
  | 'incomplete_solution'
  | 'major_error_not_detected';

export type ErrorSeverity = 'low' | 'medium' | 'high' | 'blocking';

export type ScaffoldingLevel = 'awareness' | 'guided_hint' | 'strategic_hint' | 'near_solution';

export interface RubricScores {
  correctness: RubricScoreValue;
  algorithmic_thinking: RubricScoreValue;
  syntax_and_language_use: RubricScoreValue;
  code_readability: RubricScoreValue;
  debugging_awareness: RubricScoreValue;
}

export interface ErrorFinding {
  error_type: ErrorType;
  severity: ErrorSeverity;
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
  scaffolding_level: ScaffoldingLevel;
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
  /** YAYIN 016: sunucunun öğrenciye uyguladığı görünüm. grade_only = yalnızca puan (kontrol koşulu). */
  feedbackMode?: 'socratic' | 'grade_only';
}

/** GET /api/config: koşul bilgisi içermeyen arayüz ayarları. */
export interface StudyConfig {
  gamification_enabled: boolean;
  max_attempts: number;
  success_threshold: number;
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