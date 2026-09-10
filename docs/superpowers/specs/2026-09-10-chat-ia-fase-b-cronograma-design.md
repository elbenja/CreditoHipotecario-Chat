# Chat IA Fase B — Cronograma de pagos

## Goal

Let someone attach the payment schedule their bank gave them and have its terms
land in the pinned panel, so the conversation continues against the real credit
instead of estimates.

The upload is another way to pin data. It does not produce its own analysis and
it does not replace the chat.

## Scope

In: attaching a PDF, reading page 1, extracting the credit terms, confirming
them, pinning them into a new mortgage group in the panel.

Out: analysing the credit, comparing banks, reading the amortisation table,
OCR of anything page 1 does not carry, and storing the file anywhere.

## What the documents actually contain

Verified against five real schedules, one per bank (BBVA, BCP, BIF, Interbank,
Scotiabank). Findings that drive the design:

- **All five carry the condition block on page 1.** BCP repeats it on every
  page; the rest front-load it. So the feature reads page 1 and nothing else.
- **Only BCP and Interbank have a text layer.** Scotiabank and BBVA are
  scans; BIF is a set of phone photos. Sixty percent of the sample is an image.
- **Every bank names the same thing differently.** The financed amount is
  `Monto Prestamo`, `Importe`, `IMPORTE CONCEDIDO`, `IMPORTE PRESTAMO` and
  `MONTO DE CREDITO`. This rules out per-bank regex and is why extraction goes
  through the model.
- **No schedule states the property address or purchase price.** They state the
  financed amount, which is a different number. Scotiabank's `Imp. Bien` and
  BIF's `Monto Asegurado` give an insured or appraised value — a proxy, not a
  price.
- **Real documents are annotated.** The BBVA sample has highlighter over the key
  figures; the Scotiabank sample has handwriting and a pen bracket across twelve
  rows. Extraction must tolerate this.
- **A TEA is not always fixed.** Scotiabank's sample says `Tipo de TEA: Variable`.
  A variable-rate schedule is indicative, so the rate carries its type.

## Flow

1. Attach button in the composer, plus drag and drop.
2. `pdf.js` opens the file **in the browser**. The file never leaves the device.
3. Page 1 is probed for a text layer. With one, its text is extracted. Without
   one, page 1 is rendered to a JPEG about 1200px wide.
4. Text or image goes to `POST /api/chat` in a new `document` field on the body.
5. The API builds an extraction prompt and calls the existing model.
6. Extracted fields come back and are shown for confirmation.
7. On confirm, they pin into the mortgage group.

Reading only page 1 is what keeps this cheap: one image instead of eleven, no
table parsing, and no multi-page render on a phone.

## Extraction

One prompt, both routes — the text and the image differ only in the content
part of the message. The prompt MUST carry the per-bank synonym table; without
it the model misses fields it can plainly see. Measured on the BIF phone photo:
9/10 fields without the synonyms, 10/10 with them.

Fields: `montoFinanciado`, `cuota`, `tea`, `teaTipo` (fija|variable), `tcea`,
`plazoCuotas`, `seguroDesgravamen`, `seguroInmueble`, `valorInmueble`,
`totalAPagar`.

The model also returns `dudosos`: the fields it did not read with confidence.
This is not decoration — in testing it flagged exactly the field it got wrong.
Fields listed there arrive as `assumed` rather than `documento`, and the
confirmation step highlights them first.

`valorInmueble` is always `assumed`, never `documento`: an insured value is not
a purchase price, and presenting it as one would be a lie.

If the panel already holds a property price and the schedule gives the financed
amount, the down payment is derived from the difference.

## Data model

A new `MortgageFieldSchema` in `@chat/shared` with its own key enum. The seven
property keys in `FIELD_KEYS` are not touched — property and credit are
different entities and sharing one flat record is what would force that enum to
grow without end.

`Provenance` gains a third value, `documento`.

`enforceProvenance` does **not** run over mortgage fields. Its rule is "the
value appeared verbatim in what the user typed", which is never true here. The
pipeline marks these fields `documento` itself and rejects any attempt by the
model to claim `user` on them. The existing guarantee is unchanged: the model
still cannot promote a guess.

`ChatState` gains `mortgage: Record<string, MortgageField>`, persisted the same
way `fields` is.

## Interface

`PinnedPanel` renders two groups: **La propiedad** (today's seven fields,
unchanged) and **Tu hipoteca**, an accordion that starts collapsed once it holds
more than four fields. The legend gains a third dot, "Lo leí del banco".

`MobileBottomSheet` already wraps `PinnedPanel`, so it inherits the grouping.
Its collapsed summary counts both groups.

Confirmation is a modal listing what was read, with the `dudosos` fields
highlighted. Every value is editable there. Confirming pins them; cancelling
discards the read without pinning anything.

The modal states plainly why it exists: a digit read from a photo can be wrong
and still look confident, so the figures are worth a glance before they are
pinned. This is the warning's whole job — not to add ceremony, but to stop the
user from waving through ten numbers because the panel looks authoritative.

## Privacy notice

Every bank schedule carries the holder's name, national ID and loan number in
its header, so "don't upload confidential ones" would mean "don't upload any".
The attach control instead says what actually happens: only page 1 is read, the
file is never uploaded or stored, and the page's contents go to the model that
answers the chat. It adds that personal data can be covered before uploading —
the condition block sits below the name line in all five banks, so a schedule
with its header masked still reads correctly.

Anyone who would rather not send the document at all can type the figures into
the panel by hand, which is what the panel already does.

## Errors

Rejected in the browser without spending a model call: not a PDF, an encrypted
PDF, or a file over **20 MB**. The BIF sample is 14 MB of phone photos, so the
limit clears real documents with room to spare.

`pdf.js` cannot open the file: "No pude leer ese PDF."

The model does not recognise a schedule: "Esto no parece un cronograma de
pagos." Nothing is pinned.

The extraction call fails: the same Spanish error path the chat already uses.

## Testing

The five sample PDFs carry client names, national ID numbers and loan numbers.
**They do not go into the repository.** Fixtures are redacted derivatives: the
extracted text with identifiers stripped, and header-cropped images for the
image route.

- Text route: exact assertions against BCP and Interbank figures.
- Image route: not deterministic, so unit tests mock the extractor. A separate
  integration test, run by hand and marked as such, exercises the real model.
- Provenance: a mortgage field never comes back `user`; a field in `dudosos`
  comes back `assumed`; `valorInmueble` is always `assumed`.
- Derivation: price plus financed amount yields the down payment; neither alone
  does.
- Panel: the accordion collapses past four fields, the third legend state
  renders, and the mobile summary counts both groups.

## Verification

- All existing tests still pass (245 at the time of writing).
- Typecheck and web build clean.
- The five real schedules each read correctly through the manual integration
  test, scored field by field against the values recorded in the session notes.
- Mobile and desktop QA repeated for the panel, since the accordion changes
  both.

## Open risk

Values read from a photo are pinned as the most trustworthy data on screen.
Three things mitigate it: the confirmation step, the `dudosos` highlighting, and
the modal saying out loud that a misread digit can look confident. None of them
eliminate it — a wrong figure the user skims past still lands as fact, and it
lands in the field the whole analysis is built on.

If this leaves POC status, the mitigation to revisit is showing the source
snippet next to each extracted value, so confirming means comparing rather than
trusting.
