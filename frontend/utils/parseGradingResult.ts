import {
  GradingResult,
  UnitTestResult,
  RubricScores,
  ErrorFinding,
  SocraticFeedback,
  PedagogicalMetadata,
} from '../types';

function normalizeUnitTest(raw: unknown): UnitTestResult {
  const item = raw as Record<string, unknown>;
  return {
    testName:
      typeof item?.testName === 'string'
        ? item.testName
        : typeof item?.test === 'string'
          ? item.test
          : 'Test',
    passed: Boolean(item?.passed),
    message: typeof item?.message === 'string' ? item.message : '',
  };
}

function parseRubricScores(raw: unknown): RubricScores | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const scores = raw as Record<string, unknown>;
  const fields = [
    'correctness',
    'algorithmic_thinking',
    'syntax_and_language_use',
    'code_readability',
    'debugging_awareness',
  ] as const;
  if (!fields.every((key) => typeof scores[key] === 'number')) return undefined;
  return {
    correctness: scores.correctness as number,
    algorithmic_thinking: scores.algorithmic_thinking as number,
    syntax_and_language_use: scores.syntax_and_language_use as number,
    code_readability: scores.code_readability as number,
    debugging_awareness: scores.debugging_awareness as number,
  };
}

function parseErrorFindings(raw: unknown): ErrorFinding[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const findings = raw
    .filter((item) => item && typeof item === 'object')
    .map((item) => {
      const finding = item as Record<string, unknown>;
      return {
        error_type: typeof finding.error_type === 'string' ? finding.error_type : '',
        severity: typeof finding.severity === 'string' ? finding.severity : '',
        location_hint:
          typeof finding.location_hint === 'string' ? finding.location_hint : undefined,
        explanation: typeof finding.explanation === 'string' ? finding.explanation : '',
        misconception:
          typeof finding.misconception === 'string' ? finding.misconception : undefined,
      };
    })
    .filter((finding) => finding.error_type && finding.explanation);
  return findings.length > 0 ? findings : undefined;
}

function parseSocraticFeedback(raw: unknown): SocraticFeedback | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const feedback = raw as Record<string, unknown>;
  const required = [
    'awareness_question',
    'guiding_question',
    'progressive_hint',
    'next_action',
  ] as const;
  if (!required.every((key) => typeof feedback[key] === 'string')) return undefined;
  if (typeof feedback.direct_solution_given !== 'boolean') return undefined;
  return {
    awareness_question: feedback.awareness_question as string,
    guiding_question: feedback.guiding_question as string,
    progressive_hint: feedback.progressive_hint as string,
    next_action: feedback.next_action as string,
    direct_solution_given: feedback.direct_solution_given,
  };
}

function parsePedagogicalMetadata(raw: unknown): PedagogicalMetadata | undefined {
  if (!raw || typeof raw !== 'object') return undefined;
  const metadata = raw as Record<string, unknown>;
  const required = [
    'feedback_strategy',
    'scaffolding_level',
    'student_level',
    'prompt_version',
    'rubric_version',
  ] as const;
  if (!required.every((key) => typeof metadata[key] === 'string')) return undefined;
  return {
    feedback_strategy: metadata.feedback_strategy as string,
    scaffolding_level: metadata.scaffolding_level as string,
    student_level: metadata.student_level as string,
    prompt_version: metadata.prompt_version as string,
    rubric_version: metadata.rubric_version as string,
    model_name: typeof metadata.model_name === 'string' ? metadata.model_name : undefined,
  };
}

/**
 * Safely parses grading_result JSON from the database.
 * Preserves legacy records: missing v0.2 fields are omitted; required MVP fields get safe defaults.
 */
export function parseGradingResult(raw: string | unknown): GradingResult | null {
  try {
    const parsed = typeof raw === 'string' ? JSON.parse(raw) : raw;
    if (!parsed || typeof parsed !== 'object') return null;

    const data = parsed as Record<string, unknown>;
    const result: GradingResult = {
      grade: typeof data.grade === 'number' ? data.grade : 0,
      feedback: typeof data.feedback === 'string' ? data.feedback : '',
      codeQuality: typeof data.codeQuality === 'string' ? data.codeQuality : 'Bilinmiyor',
      suggestions: Array.isArray(data.suggestions)
        ? data.suggestions.filter((item): item is string => typeof item === 'string')
        : [],
      unitTests: Array.isArray(data.unitTests)
        ? data.unitTests.map(normalizeUnitTest)
        : [],
    };

    const rubricScores = parseRubricScores(data.rubricScores);
    if (rubricScores) result.rubricScores = rubricScores;

    const errorFindings = parseErrorFindings(data.errorFindings);
    if (errorFindings) result.errorFindings = errorFindings;

    const socraticFeedback = parseSocraticFeedback(data.socraticFeedback);
    if (socraticFeedback) result.socraticFeedback = socraticFeedback;

    const pedagogicalMetadata = parsePedagogicalMetadata(data.pedagogicalMetadata);
    if (pedagogicalMetadata) result.pedagogicalMetadata = pedagogicalMetadata;

    return result;
  } catch {
    return null;
  }
}
