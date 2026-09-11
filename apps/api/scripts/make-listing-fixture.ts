import { writeFileSync } from 'node:fs';
import { fetchListingText } from '../src/listing/fetchListing.ts';

// Usage: node --experimental-strip-types scripts/make-listing-fixture.ts <nexo url> <out file>
// Produces the same reduced text the server sends to the model, so the
// fixture is exactly what extraction sees. Inspect the output by eye before
// committing: a listing page carries no personal data, but check anyway.
const [url, out] = process.argv.slice(2);
if (!url || !out) {
  console.error('usage: make-listing-fixture.ts <url> <out>');
  process.exit(1);
}
const text = await fetchListingText(url);
writeFileSync(out, text + '\n');
console.log(`${out}: ${text.length} chars`);
