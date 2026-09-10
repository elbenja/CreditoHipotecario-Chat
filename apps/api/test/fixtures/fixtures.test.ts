import { describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

// Regression net for the redacted cronograma fixtures (see README.md in this
// directory). These assertions are the only deterministic place the spec's
// "exact figures survive redaction" requirement can live: everything
// downstream of the model is non-deterministic, and neither Task 3's tests
// (inline synthetic JSON) nor Task 5's (fake File objects) ever open these
// files.

const fixturesDir = path.dirname(fileURLToPath(import.meta.url));
const bcp = readFileSync(path.join(fixturesDir, 'bcp-page1.txt'), 'utf8');
const interbank = readFileSync(path.join(fixturesDir, 'interbank-page1.txt'), 'utf8');

// Same-line "label : value" fields: cliente/titular/referencia (original
// coverage) plus BCP's "CREDITO NRO :". Both banks' page layouts pack
// unrelated fields side by side on one physical text line (a pdftotext
// artifact of the multi-column PDFs), so a bare label match without a
// colon on that same line is a page-layout fragment, not a value to check
// (e.g. Interbank's "NRO DE POLIZA DE" line, which ends before its value —
// the value prints on the following line).
function unredactedIdentifierLines(text: string): string[] {
  const labelPattern = /cliente|titular|referencia|credito\s*nro/i;
  return text
    .split('\n')
    .filter((line) => labelPattern.test(line))
    .filter((line) => {
      const afterLabel = line.split(':').slice(1).join(':').trim();
      return afterLabel !== '[REDACTADO]';
    });
}

// BCP's insurance policy numbers print as "(POLIZA <value>)" with no
// colon at all, so the colon-split check above can't see them. Extract
// the parenthesised value directly.
function unredactedParenPolizaValues(text: string): string[] {
  return [...text.matchAll(/\(poliza\s+([^)]*)\)/gi)]
    .map((m) => m[1].trim())
    .filter((value) => value !== '[REDACTADO]');
}

// Structural, PII-free backstop: loan numbers, policy numbers and national
// ID numbers in these documents all run 8+ consecutive digits, while every
// financial figure under test carries comma/period separators and never
// forms a run that long. This is what actually protects two shapes the
// checks above cannot reach: an identifier reintroduced with no label at
// all (BCP's collapsed, unlabelled name/address/national-id block), and
// Interbank's two "NRO DE POLIZA ... (8):" values — that "(8)" footnote
// marker also labels two legitimate insurance-rate percentages elsewhere
// on the same page (0.0280%, 0.34%), so it cannot be turned into a safe
// per-line label check; distinguishing by digit-run length avoids that
// ambiguity entirely.
function longDigitRuns(text: string): string[] {
  return text.match(/\d{8,}/g) ?? [];
}

describe('cronograma fixtures: bcp-page1.txt', () => {
  it('still carries the figures under test', () => {
    expect(bcp).toContain('6.99%');
    expect(bcp).toContain('8.07%');
    expect(bcp).toContain('0.52%');
    expect(bcp).toContain('0.30%');
    expect(bcp).toMatch(/\b240\b/);
  });

  it('has no unredacted client/reference identifier', () => {
    expect(bcp).toContain('[REDACTADO]');
    expect(unredactedIdentifierLines(bcp)).toEqual([]);
  });

  it('has no unredacted policy number in "(POLIZA n)" form', () => {
    expect(unredactedParenPolizaValues(bcp)).toEqual([]);
  });

  it('has no unlabelled 8+ digit identifier (loan/policy/national-id)', () => {
    expect(longDigitRuns(bcp)).toEqual([]);
  });
});

describe('cronograma fixtures: interbank-page1.txt', () => {
  it('still carries the figures under test', () => {
    expect(interbank).toContain('283,764.56');
    expect(interbank).toContain('120 MESES');
  });

  it('has no unredacted client/reference identifier', () => {
    expect(interbank).toContain('[REDACTADO]');
    expect(unredactedIdentifierLines(interbank)).toEqual([]);
  });

  it('has no unlabelled 8+ digit identifier (loan/policy/national-id)', () => {
    expect(longDigitRuns(interbank)).toEqual([]);
  });
});
