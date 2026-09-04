import {
  AnalysisEnvelopeSchema,
  isValidSoles,
  normalizeSoles,
  type AnalysisEnvelope,
} from '@chat/shared';
import { extractCandidates, type Candidate } from './fallback';
import { enforceProvenance } from './provenance';

export type PipelineResult =
  | { ok: true; envelope: AnalysisEnvelope }
  | { ok: false; prose: string; candidates: Candidate[] };

const MAX_PROSE = 3;
const MAX_FOLLOW_UPS = 3;

/** Models wrap JSON in markdown fences often enough to handle it rather than fail. */
function stripFences(raw: string): string {
  const fenced = /```(?:json)?\s*([\s\S]*?)\s*```/.exec(raw);
  return (fenced?.[1] ?? raw).trim();
}

/** Repair any soles-looking string into house format; leave everything else alone. */
function repairAmount(value: string): string {
  if (isValidSoles(value)) return value;
  if (!/S\/|^\s*[+-]?\d/.test(value)) return value;
  return normalizeSoles(value) ?? value;
}

export function runPipeline(raw: string, userTurns: string[]): PipelineResult {
  // 1. Parse and validate.
  let parsed: unknown;
  try {
    parsed = JSON.parse(stripFences(raw));
  } catch {
    return { ok: false, prose: raw, candidates: extractCandidates(raw) };
  }

  const result = AnalysisEnvelopeSchema.safeParse(parsed);
  if (!result.success) {
    return { ok: false, prose: raw, candidates: extractCandidates(raw) };
  }

  const envelope = result.data;

  // 2. Enforce provenance. The model does not get to promote a guess.
  const fields = enforceProvenance(envelope.fields, userTurns);

  // 3. Cap. The cards carry the numbers, so truncate silently.
  const prose = envelope.prose.slice(0, MAX_PROSE);
  const followUps = envelope.followUps.slice(0, MAX_FOLLOW_UPS);

  // 4. Format to house convention rather than trusting the model's.
  const metrics = envelope.metrics.map((m) => ({
    ...m,
    value: repairAmount(m.value),
    delta: m.delta === null ? null : repairAmount(m.delta),
  }));
  const scenarios = envelope.scenarios.map((s) => ({ ...s, value: repairAmount(s.value) }));

  return { ok: true, envelope: { ...envelope, fields, metrics, scenarios, prose, followUps } };
}
