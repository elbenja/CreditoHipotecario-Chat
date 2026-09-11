import {
  AnalysisEnvelopeSchema,
  CaptureEnvelopeSchema,
  groupFieldValue,
  isValidSoles,
  normalizeSoles,
  type AnalysisEnvelope,
} from '@chat/shared';
import { extractCandidates, type Candidate } from './fallback.ts';
import { enforceProvenance } from './provenance.ts';

export type PipelineResult =
  | { ok: true; envelope: AnalysisEnvelope }
  | { ok: false; prose: string; candidates: Candidate[] };

const MAX_PROSE = 1;
const MAX_FOLLOW_UPS = 2;
const MAX_METRICS = 2;

/** A value we may rewrite: the WHOLE string is a soles amount, nothing else. */
const CURRENCY_ONLY = /^[+-]?\s*S\/\.?\s*[\d.,]+$/;

/** Models wrap JSON in markdown fences often enough to handle it rather than fail. */
function stripFences(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(raw);
  return (fenced?.[1] ?? raw).trim();
}

const SCHEMA_FALLBACK =
  'Tengo el análisis pero no pude estructurarlo esta vez. Puedes fijar los datos a mano acá abajo.';

/** Rescue the readable parts of an envelope that failed validation. */
function salvageProse(parsed: unknown): string | null {
  if (typeof parsed !== 'object' || parsed === null) return null;
  const v = parsed as Record<string, unknown>;
  const parts: string[] = [];
  if (typeof v.verdict === 'string') parts.push(v.verdict);
  if (Array.isArray(v.prose)) parts.push(...v.prose.filter((p): p is string => typeof p === 'string'));
  return parts.length > 0 ? parts.slice(0, 4).join('\n\n') : null;
}

/** The model sometimes folds the prefix/suffix into `value` despite the prompt. */
function stripAffixes(field: { value: string; prefix?: string; suffix?: string }): string {
  let v = field.value.trim();
  const prefix = field.prefix?.trim();
  const suffix = field.suffix?.trim();
  if (prefix && v.toLowerCase().startsWith(prefix.toLowerCase())) v = v.slice(prefix.length).trim();
  if (suffix && v.toLowerCase().endsWith(suffix.toLowerCase())) v = v.slice(0, -suffix.length).trim();
  return v || field.value;
}

/**
 * Repair a soles amount into house format. Anything that is not wholly a soles
 * amount is returned untouched: '6.2%' is a yield, '↑ 1.0 pt' is a delta, and
 * turning either into money would be worse than leaving it alone.
 */
function repairAmount(value: string): string {
  if (isValidSoles(value)) return value;
  if (!CURRENCY_ONLY.test(value.trim())) return value;
  return normalizeSoles(value) ?? value;
}

const AFFIRMATIVE = /^(s[ií]|ok|acepto|de acuerdo|dale|correcto)(?:\s|[.!]|$)/i;

function extractExplicitCaptureFields(userTurn: string): AnalysisEnvelope['fields'] {
  const text = userTurn.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  const fields: AnalysisEnvelope['fields'] = [];
  const initial = /(?:([\d]{1,2}(?:[.,]\d+)?)\s*%\s*(?:de\s+)?(?:cuota\s+)?inicial\b|\b(?:cuota\s+)?inicial(?:\s+de|\s*:)?\s*([\d]{1,2}(?:[.,]\d+)?)\s*%)/.exec(text);
  const term = /\b(?:(?:a|en)\s+|plazo(?:\s+de|\s*:)?\s*)(\d{1,2})\s+anos?\b/.exec(text);

  if (initial) {
    fields.push({
      key: 'inicial', label: 'Cuota inicial', value: (initial[1] ?? initial[2]!).replace(',', '.'),
      suffix: '%', provenance: 'user', note: '',
    });
  }
  if (term?.[1]) {
    fields.push({
      key: 'plazo', label: 'Plazo', value: term[1], suffix: 'años', provenance: 'user', note: '',
    });
  }
  return fields;
}

function sameReply(a: string, b: string): boolean {
  const normalize = (value: string) => value.trim().replace(/\s+/g, ' ').toLocaleLowerCase('es');
  return Boolean(a.trim() && b.trim()) && normalize(a) === normalize(b);
}

function acceptedProposal(
  field: { value: string; label: string; provenance: string },
  userTurns: string[],
  previousAssistant: string,
): boolean {
  const latestUser = userTurns.at(-1)?.trim() ?? '';
  if (!AFFIRMATIVE.test(latestUser) || !previousAssistant.trim()) return false;
  const escaped = field.value.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  if (!escaped) return false;
  const valueWasProposed = new RegExp(`(^|\\D)${escaped}(?=\\D|$)`).test(previousAssistant);
  const fieldWasNamed = previousAssistant.toLocaleLowerCase('es').includes(field.label.toLocaleLowerCase('es'));
  return valueWasProposed && fieldWasNamed && field.provenance !== 'user';
}

export function runPipeline(raw: string, userTurns: string[], previousAssistant = ''): PipelineResult {
  // 1. Parse and validate.
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, prose: raw, candidates: extractCandidates(raw) };
  }

  if (typeof parsed === 'object' && parsed !== null && 'kind' in parsed && (parsed.kind === 'capture' || parsed.kind === 'clarification')) {
    const capture = CaptureEnvelopeSchema.safeParse(parsed);
    if (!capture.success) {
      return { ok: false, prose: 'No pude registrar esos datos. ¿Puedes escribirlos de nuevo?', candidates: [] };
    }
    // Capture explicit facts and estimates the user just accepted. Other
    // guesses stay out of the panel.
    const fields = enforceProvenance(capture.data.fields, userTurns)
      .filter((field) => field.provenance === 'user' || acceptedProposal(field, userTurns, previousAssistant))
      .map((field) => ({ ...field, value: groupFieldValue(stripAffixes(field)) }));
    const fieldKeys = new Set(fields.map((field) => field.key));
    const latestUser = userTurns.at(-1) ?? '';
    const recovered = enforceProvenance(extractExplicitCaptureFields(latestUser), [latestUser])
      .filter((field) => field.provenance === 'user')
      .filter((field) => !fieldKeys.has(field.key));
    fields.push(...recovered);
    const repeatedQuestion = sameReply(capture.data.reply, previousAssistant);
    const completedRepeatedQuestion = repeatedQuestion && fields.length > 0;
    const completedCapture = capture.data.kind === 'capture' && fields.length > 0;
    // A successful capture has a product-owned acknowledgement. The model
    // must not smuggle unsolicited advice into the confirmation sentence.
    const verdict = completedCapture || completedRepeatedQuestion
      ? 'Listo, recibí los datos de la propiedad.'
      : repeatedQuestion
        ? 'No pude identificar el dato en tu respuesta. ¿Puedes escribirlo otra vez con su unidad?'
        : capture.data.kind === 'capture' && capture.data.fields.length > 0
          ? 'No pude confirmar esos datos. ¿Puedes precisarlos?'
          : capture.data.reply;
    return { ok: true, envelope: {
      kind: 'capture', verdict,
      askField: completedCapture || completedRepeatedQuestion ? undefined : capture.data.askField,
      fields,
      metrics: [], scenarios: [], sources: [], prose: [], followUps: [],
    } };
  }

  const result = AnalysisEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    // It parsed as JSON but did not match the contract. Never show the user
    // raw JSON — salvage the readable parts, or say something written.
    const salvaged = salvageProse(parsed);
    return {
      ok: false,
      prose: salvaged ?? SCHEMA_FALLBACK,
      candidates: extractCandidates(salvaged ?? ''),
    };
  }

  const envelope = result.data;

  // 2. Enforce provenance. The model does not get to promote a guess.
  // Provenance first, then presentation: the panel shows "S/ 300,000", never
  // "S/ 300000". The prefix is a separate property, so only grouping is added.
  const fields = enforceProvenance(envelope.fields, userTurns).map((f) => ({
    ...f,
    value: groupFieldValue(stripAffixes(f)),
  }));

  // 3. Cap. The cards carry the numbers, so truncate silently.
  const prose = envelope.prose.slice(0, MAX_PROSE);
  const followUps = envelope.followUps.slice(0, MAX_FOLLOW_UPS);

  // 4. Format to house convention rather than trusting the model's.
  const metrics = envelope.metrics.slice(0, MAX_METRICS).map((m) => ({
    ...m,
    value: repairAmount(m.value),
    delta: m.delta === null ? null : repairAmount(m.delta),
  }));
  const scenarios = envelope.scenarios.map((s) => ({ ...s, value: repairAmount(s.value) }));

  return { ok: true, envelope: { ...envelope, fields, metrics, scenarios, prose, followUps } };
}
