import {
  GradingResult,
  UnitTestResult,
  RubricScores,
  RubricScoreValue,
  ErrorFinding,
  ErrorType,
  ErrorSeverity,
  ScaffoldingLevel,
  SocraticFeedback,
  PedagogicalMetadata,
} from '../types';

/**
 * AI/legacy kayıtlardan gelebilecek bozuk JSON metnini (markdown code fence,
 * ```json ... ``` sarmalayıcıları, açıklama satırlarıyla çevrili JSON, veya
 * kapanıştan hemen önce fazladan virgül — trailing comma) ayrıştırmadan önce
 * güvenle temizler. `JSON.parse` başarısız olduğunda ikinci bir deneme olarak
 * kullanılır; sistemin bozuk JSON karşısında çökmemesini garanti eden
 * dirençli parse zincirinin bir parçasıdır (bkz. parseGradingResult).
 */
function sanitizeJsonString(raw: string): string {
  let cleaned = raw.trim();

  const fenceMatch = cleaned.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fenceMatch) cleaned = fenceMatch[1].trim();

  const firstBrace = cleaned.indexOf('{');
  const lastBrace = cleaned.lastIndexOf('}');
  if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1);
  }

  // Trailing comma toleransı: `..., }` / `..., ]` standart JSON'da geçersizdir.
  cleaned = cleaned.replace(/,(\s*[}\]])/g, '$1');

  return cleaned.trim();
}

const VALID_ERROR_TYPES: ReadonlySet<string> = new Set([
  'syntax_error',
  'runtime_error',
  'logic_error',
  'conceptual_error',
  'boundary_case_error',
  'data_type_error',
  'loop_error',
  'conditional_error',
  'function_structure_error',
  'input_output_format_error',
  'code_readability_issue',
  'incomplete_solution',
  'major_error_not_detected',
]);

const VALID_ERROR_SEVERITIES: ReadonlySet<string> = new Set(['low', 'medium', 'high', 'blocking']);

const VALID_SCAFFOLDING_LEVELS: ReadonlySet<string> = new Set([
  'awareness',
  'guided_hint',
  'strategic_hint',
  'near_solution',
]);

function isRubricScoreValue(value: unknown): value is RubricScoreValue {
  return typeof value === 'number' && Number.isInteger(value) && value >= 1 && value <= 5;
}

function isErrorType(value: unknown): value is ErrorType {
  return typeof value === 'string' && VALID_ERROR_TYPES.has(value);
}

function isErrorSeverity(value: unknown): value is ErrorSeverity {
  return typeof value === 'string' && VALID_ERROR_SEVERITIES.has(value);
}

function isScaffoldingLevel(value: unknown): value is ScaffoldingLevel {
  return typeof value === 'string' && VALID_SCAFFOLDING_LEVELS.has(value);
}

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
  if (!fields.every((key) => isRubricScoreValue(scores[key]))) return undefined;
  return {
    correctness: scores.correctness as RubricScoreValue,
    algorithmic_thinking: scores.algorithmic_thinking as RubricScoreValue,
    syntax_and_language_use: scores.syntax_and_language_use as RubricScoreValue,
    code_readability: scores.code_readability as RubricScoreValue,
    debugging_awareness: scores.debugging_awareness as RubricScoreValue,
  };
}

function parseErrorFindings(raw: unknown): ErrorFinding[] | undefined {
  if (!Array.isArray(raw) || raw.length === 0) return undefined;
  const findings: ErrorFinding[] = [];
  for (const item of raw) {
    if (!item || typeof item !== 'object') continue;
    const finding = item as Record<string, unknown>;
    if (!isErrorType(finding.error_type) || !isErrorSeverity(finding.severity)) continue;
    if (typeof finding.explanation !== 'string' || !finding.explanation) continue;
    findings.push({
      error_type: finding.error_type,
      severity: finding.severity,
      location_hint:
        typeof finding.location_hint === 'string' ? finding.location_hint : undefined,
      explanation: finding.explanation,
      misconception:
        typeof finding.misconception === 'string' ? finding.misconception : undefined,
    });
  }
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
  if (!isScaffoldingLevel(metadata.scaffolding_level)) return undefined;
  return {
    feedback_strategy: metadata.feedback_strategy as string,
    scaffolding_level: metadata.scaffolding_level,
    student_level: metadata.student_level as string,
    prompt_version: metadata.prompt_version as string,
    rubric_version: metadata.rubric_version as string,
    model_name: typeof metadata.model_name === 'string' ? metadata.model_name : undefined,
  };
}

/**
 * Safely parses grading_result JSON from the database.
 * Preserves legacy records: missing v0.2 fields are omitted; required MVP fields get safe defaults.
 *
 * Dirençli parse zinciri: string girdi doğrudan JSON.parse ile ayrıştırılamazsa
 * (markdown code fence, trailing comma vb. kirlilik), `sanitizeJsonString` ile
 * temizlenip ikinci kez denenir. İkisi de başarısız olursa (veya girdi zaten
 * geçersizse) hata fırlatmadan `null` döner — çağıran taraf bunu güvenle
 * "sonuç yok" olarak ele alır; sistem hiçbir koşulda çökmez.
 */
export function parseGradingResult(raw: string | unknown): GradingResult | null {
  try {
    let parsed: unknown;
    if (typeof raw === 'string') {
      try {
        parsed = JSON.parse(raw);
      } catch {
        parsed = JSON.parse(sanitizeJsonString(raw));
      }
    } else {
      parsed = raw;
    }
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
