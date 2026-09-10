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

function unredactedIdentifierLines(text: string): string[] {
  return text
    .split('\n')
    .filter((line) => /cliente|titular|referencia/i.test(line))
    .filter((line) => {
      const afterLabel = line.split(':').slice(1).join(':').trim();
      return afterLabel !== '[REDACTADO]';
    });
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
});
