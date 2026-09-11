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

function redactionMarkerCount(text: string): number {
  return (text.match(/\[REDACTADO\]/g) ?? []).length;
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

  // Exact-count invariant: the one leak shape none of the checks above can
  // see is an unlabelled, digit-free identifier (e.g. a name and street
  // address sitting on their own lines with no "label :" and no digits at
  // all — this is exactly how the original name/address block leaked before
  // it was collapsed by the redaction script's awk rule). Such a line trips
  // no label pattern and no digit-run check, yet still removes a
  // "[REDACTADO]" marker if its rule stops firing, or leaves the marker
  // count unchanged if it's simply reworded around. Pinning the exact count
  // (verified by hand against the current fixture: the collapsed name/
  // address block, "CREDITO NRO", and both "(POLIZA n)" values) catches that
  // drop directly. This number must be updated deliberately, in lockstep
  // with any change to scripts/make-fixtures.sh's BCP redaction rules.
  it('has exactly the expected number of redaction markers', () => {
    expect(redactionMarkerCount(bcp)).toBe(4);
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

  // Exact-count invariant: see the matching comment in the bcp-page1.txt
  // suite above. Verified by hand against the current fixture (the
  // collapsed client-name line and the two "NRO DE POLIZA ... (8):"
  // values). Update deliberately if scripts/make-fixtures.sh's Interbank
  // redaction rules change.
  it('has exactly the expected number of redaction markers', () => {
    expect(redactionMarkerCount(interbank)).toBe(3);
  });
});

const aspiria = readFileSync(path.join(fixturesDir, 'nexo-aspiria.txt'), 'utf8');
const single = readFileSync(path.join(fixturesDir, 'nexo-single.txt'), 'utf8');

describe('listing fixtures', () => {
  it('nexo-aspiria.txt opens with a JSON-LD Product block and carries the three models', () => {
    expect(aspiria.split('\n')[0]).toMatch(/"@type"\s*:\s*"Product"/);
    expect(aspiria).toContain('TIPO 3');
    expect(aspiria).toContain('82.96');
    expect(aspiria).toContain('664,806');
    expect(aspiria).toContain('363,906');
    expect(aspiria).toContain('Barranco');
  });

  it('nexo-single.txt opens with a JSON-LD Product block', () => {
    expect(single.split('\n')[0]).toMatch(/"@type"\s*:\s*"Product"/);
  });

  it('neither fixture carries an email address or a long digit run', () => {
    for (const text of [aspiria, single]) {
      // Every Nexo listing page's footer prints the site's own published
      // support address verbatim ("Contáctanos info@nexoinmobiliario.pe") —
      // confirmed identical across every candidate URL fetched while
      // building these fixtures, so it isn't something a redaction step
      // could avoid. It is Nexo's contact address, not a person's; excluded
      // by name rather than dropping the assertion, so a *different*,
      // unexpected email address still fails the test.
      const emails = text.match(/[\w.+-]+@[\w-]+\.[\w.]+/g) ?? [];
      expect(emails.filter((e) => e.toLowerCase() !== 'info@nexoinmobiliario.pe')).toEqual([]);
      expect(text.match(/\d{9,}/g) ?? []).toEqual([]);
    }
  });
});
