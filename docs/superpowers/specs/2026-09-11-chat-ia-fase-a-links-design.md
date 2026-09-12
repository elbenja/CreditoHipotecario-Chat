# Chat IA Fase A — Pegar el link de un anuncio

Diseño aprobado por el usuario el 11 de septiembre de 2026.

## Goal

Let someone paste the link of a listing they are looking at and have the
property land in the pinned panel — location, price, area — so the
conversation starts from the real apartment instead of from a blank panel.

The link is another way to pin data, like the schedule in Fase B. It does not
produce an analysis and it does not replace the chat. The empty screen has
promised this since the cronograma UX pass ("Sube un documento o pega el link
de un anuncio"); this is the feature that makes the promise true.

## Scope

In:

- A `nexoinmobiliario.pe` listing URL pasted into the composer, read
  server-side, extracted by the model, confirmed in a modal, pinned as the
  property.
- Any other host: an honest refusal that names the host and offers the
  alternative below.
- A listing page saved as PDF (print-to-PDF of Urbania or any portal),
  uploaded through the existing attach control or drop zone, ending in the
  same modal. This is the fallback that sidesteps Cloudflare: the user's own
  browser already passed the challenge.
- A fourth provenance, `anuncio`, with its own legend.

Out: scraping Urbania (Cloudflare Managed Challenge, verified 2026-09-10 and
2026-09-11 — see `docs/HANDOFF-fase-a-links.md`, do not re-litigate), saved
`.html` pages (a second reader; the PDF solves the same problem), listing
images, more than one URL per message, caching or storing fetched pages, and
any analysis of the listing.

## The terrain

Verified from the owner's residential connection on 2026-09-10/11 and **from
Railway's datacenter IP on 2026-09-11** via a throwaway `GET /api/probe`
route: three distinct listings answered `200`, `server: nginx`, no
`cf-mitigated`, 480–520 KB, 1.4–1.5 s each, with a server-side JSON-LD
`Product` carrying `offers.lowPrice`, `priceCurrency: PEN`, `areaServed` (the
district) and `brand` (the developer). The one open technical risk in the
handoff is closed.

What a listing actually is drives the design: **a Nexo listing is a project,
not an apartment.** Aspiria (Barranco) has one address, one developer, one
delivery date, and three models with their own area and price:

| Modelo | Área | Desde |
|---|---|---|
| TIPO 3 | 82.96 m² | S/ 664,806 |
| TIPO 6 | 41.77 m² | S/ 364,088 |
| TIPO 7 | 41.75 m² | S/ 363,906 |

The panel holds one `precio` and one `area`, so the user has to say which
model they mean. Pinning the cheapest ("desde") silently would present an
inference as fact — the rule Fase B set. A stripped listing is ~11k characters
(~3.2k tokens); a whole page fits one extraction prompt without chunking.

## Flow

### Link

1. The user sends a message containing a URL. The browser takes the first URL
   in the text.
2. Host `nexoinmobiliario.pe` (with or without `www.`): the turn goes to
   `POST /api/chat` with a new `listing: { url }` field on the body, no
   `document`. The user's message shows in the transcript like any other. The
   rest of the message text is not used for the read.
3. Any other host: a local assistant message, no network call, worded:
   *"De `<host>` no puedo leer el anuncio. Pégame los datos o el link de Nexo
   — o guarda la página como PDF y súbela aquí."* — with the real host of the
   URL they pasted.
4. No URL: a normal turn.

Server side, `runTurn` branches on `body.listing` before the out-of-scope
guardrail, exactly as it does on `body.document`:

5. `analyzeStep: "Leyendo el anuncio"`, `status: analyzing`.
6. The host is re-validated against the allowlist **on the server** — the
   client is not trusted. A host outside it is a 400 and no fetch happens.
7. `fetch` with a 10 s timeout, `redirect: 'manual'` (a redirect is an error —
   never follow off the allowlist), a browser-like user agent, and a 2 MB cap
   on the body. Anything other than a 200 HTML response is an error.
8. The HTML is reduced to text: `script` and `style` blocks removed **except
   `application/ld+json` blocks, which are kept verbatim**; tags stripped;
   entities decoded; whitespace collapsed.
9. The text goes to the document model (the same `'document'` mode Fase B
   uses, 4,000-token ceiling) with the listing prompt.
10. `runListingPipeline` parses and validates the reply and the server emits
    `listing: { listing }`.
11. The browser opens the confirmation modal. On confirm, the fields pin.

### PDF

Transport is unchanged: page 1 is read in the browser, text or image goes up
in `document`. What changes is the prompt and the pipeline:

- `DOCUMENT_PROMPT` first asks for `tipo: "cronograma" | "anuncio" | "otro"`
  and then for the block of fields that type carries. The per-bank synonym
  table stays verbatim for the cronograma block.
- The pipeline dispatches on `tipo`: `cronograma` → `extraction` (today's
  path, byte-for-byte the same result); `anuncio` → `listing` (the new path,
  same event as the link route); `otro` → error.

A page printed to PDF from a browser has a text layer, so a saved listing
nearly always takes the cheap text route. A listing read from a PDF carries
`fuente: { host: 'pdf' }` and no URL; the modal's heading line and the
`ubicacion` note are built the same way from whatever the page stated.

## Extraction

One listing prompt, both routes — the fetched text and the PDF text differ
only in what precedes them. The prompt asks for:

```
proyecto        name of the project or, for a resale, of the listing
constructora    developer or agency, if stated
direccion       street address, if stated
distrito        district (required)
entrega         delivery date, if stated
etapa           "En planos" | "En construcción" | "Entrega inmediata", if stated
modelos[]       { nombre?, area?, precioDesde?, dormitorios? }
dudosos[]       fields not read with confidence
```

Every figure is a string copied from the page, units outside the value, as in
Fase B. `modelos` is one entry per model the page lists with its own price or
area. A resale listing (one apartment, one price) returns one model with no
name. Zero models **and** no price anywhere means the page was not a listing.

The prompt tells the model the JSON-LD block, when present, is the most
reliable source for name, district, developer and the lowest price, and that
per-model prices and areas are in the page text.

`dudosos` keeps the Fase B role: a field listed there arrives `assumed`, not
`anuncio`, and the modal highlights it first.

## Data model

In `@chat/shared`:

```ts
ListingModelSchema = { nombre?, area?, precioDesde?, dormitorios? }
ListingSchema = {
  proyecto, constructora?, direccion?, distrito, entrega?, etapa?,
  modelos: ListingModel[], fuente: { host, url? }, dudosos: string[]
}
ProvenanceSchema = enum ['user', 'assumed', 'market', 'documento', 'anuncio']
```

`Provenance` gains `anuncio`: read from a third party's page — firm, but
neither the user's word nor the bank's document, and the developer can change
it tomorrow. It renders like `documento` (green dot) with its own legend text.

`FIELD_KEYS` does not change. A listing fills `ubicacion`, `precio` and
`area`; nothing else.

`ChatState` gains `pendingListing: Listing | null` — read but not yet
confirmed, never persisted, cleared on confirm or cancel — alongside
`pendingExtraction`.

## Interface

### The modal

`ConfirmExtraction` is generalised rather than duplicated. It takes a
`variant: 'cronograma' | 'anuncio'` that selects the heading, the warning text
and the field type (`MortgageField[]` today, `PinnedField[]` for the listing).
Same CTA "Fijar estos datos", same Cancelar, same focus trap, scroll lock and
Escape. The cronograma variant is unchanged in behaviour.

The anuncio variant:

- Heading "Leí el anuncio", then one line: proyecto · distrito · constructora
  (· "entrega <fecha>" when known).
- With more than one model: a radio list, one row per model — "TIPO 3 ·
  82.96 m² · desde S/ 664,806". Nothing is selected on open. Precio and Área
  are empty until a model is chosen and the CTA is disabled until there is a
  price. Choosing fills both; the user can edit either afterwards.
- With one model: no list, fields already filled.
- Fields: Ubicación, Precio, Área — all editable. `dudosos` first, highlighted.
- Warning: "Un 'desde' es el precio más bajo del modelo; el tuyo puede ser
  otro. Revísalo antes de fijar."

The modal shows **every time** — first link or a replacement — the same way
the cronograma modal does. Cancelling pins nothing.

### On confirm

`confirmListing` in the reducer:

- Replaces `ubicacion`, `precio` and `area` as one entity: a link describes a
  property, and a new link is a new property. A key the user typed by hand
  keeps its value and the listing's value becomes a proposal, the rule the
  envelope path already applies.
- Drops `alquiler` when its provenance is `market` or `assumed`: it was
  estimated for the previous location and area. A user-typed `alquiler` stays.
- Does not touch `inicial`, `tasa`, `plazo` or anything in `mortgage`.
- Re-derives `inicial` from price and financed amount, as `confirmExtraction`
  does, never over a user-owned value.
- Marks the three fields `provenance: 'anuncio'` (or `assumed` when in
  `dudosos`) and writes their notes: `precio.note` = "Precio 'desde' del
  modelo TIPO 3" (or "Precio del anuncio" for a nameless model),
  `ubicacion.note` = "Proyecto Aspiria · GRUPO T&C · entrega feb 2027" with
  whichever parts are known.
- Appends a short local assistant message to the transcript — "Fijé
  ubicación, precio y área del anuncio" — so the conversation records what
  happened. No model call.

### Provenance on screen

- `PinnedField.tsx`: `anuncio` paints the dot and the text like `documento`.
- The Propiedad group legend gains "Lo leí de la página", shown only while
  some field carries `anuncio`, mirroring how the Hipoteca legend shows "Lo
  leí del banco".
- The reducer's `envelope` case keeps `anuncio` when the model returns the
  same value — the same clause that today keeps a user-edited field's
  provenance. Without this, the first analysis turn would silently demote a
  read price to `assumed`.
- The system prompt's field rendering tells the model that an `anuncio` field
  was read from a listing, not stated by the user.
- `enforceProvenance` does not run over listing fields, for the same reason it
  does not run over mortgage fields: "the value appeared in what the user
  typed" is never true here. The pipeline marks them `anuncio` itself.

### Progress

`UploadingRow` is reused for the link read: `attachStart` is dispatched with
the host as the name and size `0`, and the row hides the size and the local
read bar when the size is `0` — just the server's "Leyendo el anuncio" step
spinning.
The PDF route shows exactly what it shows today.

### Capture buttons

`FieldSuggestions` already hides Ubicación, Precio and Área once they are
pinned. No change.

## Errors

All in Spanish, none from the SDK, and pinned data survives every failure.

| Case | Where | Message |
|---|---|---|
| URL on another host | browser, no network | "De `<host>` no puedo leer el anuncio. Pégame los datos o el link de Nexo — o guarda la página como PDF y súbela aquí." |
| Disallowed host reaches the server | server, before any fetch | 400 |
| Nexo unreachable, timeout, non-200, redirect | server | `error` kind `listing`: "No pude abrir ese anuncio. Prueba de nuevo o pégame los datos." |
| Body over 2 MB or not HTML | server | same message |
| Model says `otro`, or zero models and no price | server | "Esa página no parece un anuncio de un departamento." |
| Model reply is not valid JSON / fails the schema | server | "No pude leer los datos del anuncio." |
| Model call throws | server | today's `kind: 'api'` message |
| PDF is neither schedule nor listing | server | "Esto no parece un cronograma ni un anuncio. Revisa que sea la primera página." |
| A link while a read is in flight | browser | the composer is already disabled during a read |

Deliberately not done: following redirects off the allowlist, retries, caching
listings, fetching images or sub-resources, storing the URL anywhere but
`fuente.url` in local state, reading more than the first URL in a message.

The server canonicalises the URL to `https://nexoinmobiliario.pe` (drops
`www.`, forces https, strips userinfo and port) before fetching; a redirect
from there is still an error.

Privacy: a listing is a public page, so the link adds no notice. A listing PDF
is covered by the attach control's existing tooltip.

## Testing

Fixtures are reduced text, not HTML: the stripped text of two Nexo listings
(Aspiria, three models; one single-model project) and the extracted text of a
Urbania page the owner saves as PDF, with the agent's contact details removed.
No 500 KB pages in the repository.

- Server: the allowlist rejects other hosts, look-alike hosts
  (`nexoinmobiliario.pe.evil.com`) and redirects; the fetch honours the
  timeout and the size cap; `runListingPipeline` handles valid JSON, broken
  JSON, `tipo: otro`, and the zero-models-no-price case; the document prompt
  classifies Fase B's cronograma fixtures as `cronograma` and the new ones as
  `anuncio`; a listing field never comes back `user`; a field in `dudosos`
  comes back `assumed`.
- Reducer: `confirmListing` replaces the three keys, turns a user-edited key
  into a proposal, drops an estimated `alquiler` and keeps a typed one, derives
  `inicial`, and keeps `anuncio` through a later `envelope` with the same
  value.
- UI: the modal's CTA is disabled until a model is chosen, choosing fills the
  fields, editing after choosing sticks, one model shows no list; the legend
  appears and disappears with the provenance; a foreign-host URL produces the
  refusal with `fetch` spied and never called.
- **Every test must bite.** Fase B shipped five assertions that could not fail
  and one survived two reviews. The plan makes it an explicit step: break the
  code, watch the test fail, restore it.
- Manual integration, run by the owner: three real Nexo links in the deployed
  app, and a Urbania page saved as PDF through both the picker and the drop
  zone. Field-by-field results recorded in the session notes.

## Verification

- All existing tests still pass (433 at the time of writing: shared 53, API
  166, web 214).
- Typecheck and web build clean.
- Mobile (375px) and desktop QA repeated for the modal, since it changes
  shape.

## Open risk

A "desde" pinned as `precio` is the floor of a model, not the price of the
apartment the user is looking at. The modal says so, the field's note repeats
it, and the field is editable — but a user who confirms without reading
analyses against a low price. It is Fase B's misread-digit risk in a new
coat, with the same mitigation and the same limit: it stops the careless
confirm from being invisible, not from happening.
