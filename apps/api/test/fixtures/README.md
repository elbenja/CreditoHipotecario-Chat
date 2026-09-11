# Test fixtures

Redacted derivatives of five real bank payment schedules. The source PDFs are
NOT in this repository: they carry client names, national ID numbers and loan
numbers.

Regenerate with `scripts/make-fixtures.sh "<dir holding the source PDFs>"`,
then **inspect every output by eye** before committing. The script's redaction
is a regex; it is not a guarantee.

- `bcp-page1.txt`, `interbank-page1.txt` — page 1 text, identifiers replaced.
- `../../../../apps/web/test/fixtures/scotia-page1.jpg` — page 1 with the header
  band cropped off, for the image route.
