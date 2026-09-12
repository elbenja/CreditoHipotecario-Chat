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

## Listing fixtures (Fase A)

- `nexo-aspiria.txt` — `https://nexoinmobiliario.pe/departamentos/barranco/aspiria-1631`, a project with several models.
- `nexo-single.txt` — `https://nexoinmobiliario.pe/departamentos/san-miguel/allegro-loft-1418`, a project with one model.

Both are the server's reduced text (`htmlToText`), regenerated with
`node --experimental-strip-types scripts/make-listing-fixture.ts <url> <out>`.
A listing page is public and carries no personal data; still, inspect the
output before committing.

A Urbania page saved as PDF is **not** in the repository: the owner runs it
through the app by hand (see the plan's verification task).
