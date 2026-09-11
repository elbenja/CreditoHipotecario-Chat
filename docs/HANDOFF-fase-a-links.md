# Handoff — Fase A: pegar el link de un anuncio

Written 2026-09-11. Start a fresh chat here if you are picking up Fase A.

## Status: researched and costed. NOT designed, NOT planned.

Be clear about what exists, so you do not go looking for documents that were
never written:

- There is **no spec** for Fase A and **no implementation plan**. Nothing in
  `docs/superpowers/specs/` or `docs/superpowers/plans/` covers it.
- What exists is the research below — the terrain was probed twice, a day
  apart — plus a cost estimate and a handful of decisions the project owner
  already took in conversation.
- So the first step is **brainstorming → spec → plan**, not implementation.
  Fase B's artefacts are the shape to copy:
  `docs/superpowers/specs/2026-09-10-chat-ia-fase-b-cronograma-design.md` and
  `docs/superpowers/plans/2026-09-10-chat-ia-fase-b-cronograma.md`.

## Why this is worth doing now

**The UI already promises it and does not deliver.** `Composer.tsx:105`, on the
empty screen, reads:

> Sube un documento o pega el link de un anuncio

That copy shipped with the cronograma UX pass. Pasting a link currently does
nothing. Closing that gap is the feature.

## The terrain, verified 2026-09-10 and again 2026-09-11

**Urbania is blocked and there is no clean way in.**

```
403  /                              cf-mitigated: challenge   server: cloudflare
403  /buscar/venta-de-departamentos
403  /sitemap.xml
200  /robots.txt
```

That is a Cloudflare Managed Challenge, and it fires **from a residential IP
with a real Chrome user agent**. Railway is a datacenter ASN, which Cloudflare
scores strictly worse — so a server-side fetch from production fails a fortiori.
Its `robots.txt` also lists scrapers by name. Getting past this needs a paid
unblocking proxy or a headless browser with fingerprint evasion: an arms race,
not a feature. **Do not spend tokens re-litigating this.** Re-run the curl above
if you want to confirm it still holds; do not try to defeat it.

**Nexo Inmobiliario is open, and better than expected.**

- `200`, plain nginx, **no bot-protection layer at all**.
- `robots.txt` is `Disallow:` (empty) — it permits everything — and publishes a
  sitemap.
- `sitemap-proyectos.xml` carries **~732 listings**.
- Every listing page ships **JSON-LD `Product`** server-side. From a real one:
  `offers.lowPrice: "363906"`, `priceCurrency: "PEN"`, `areaServed` = the
  district, `brand` = the developer.
- m² and per-model prices sit in the plain HTML (`81.00 m²`, `S/499,000` …
  `S/838,000`).
- **HTML ~500 KB → stripped text ~12k chars ≈ 3.2k tokens.** A whole listing
  fits in one extraction prompt with no chunking.

## Decisions the project owner already took

1. **Urbania gets an honest refusal, not a silent failure.** Agreed wording,
   close to: *"de Urbania no puedo leer el anuncio — pégame los datos o el link
   de Nexo"*.
2. **Plus the fallback they proposed:** *"graba la página de la propiedad en
   HTML o PDF y súbela aquí"*. This sidesteps Cloudflare entirely, because the
   user's own browser already passed the challenge. A page saved as PDF is a
   print-to-PDF rendered from the DOM, so it has a text layer — the easy case.
3. **Extraction goes through the model, not per-site selectors.** Five banks
   taught this lesson in Fase B, and listing portals rename fields the same way.

## What changed since the estimate — it got cheaper

Fase B built the machinery Fase A was going to need:

- **`apps/web/src/pdf/attachSchedule.ts`** is the extraction pipe: read a
  document, send it, surface the result, handle errors. Fase A's link route is
  a sibling of it.
- **`DropZone.tsx`** and the "+" control already exist on both screens.
- **The `documento` provenance and its third legend entry exist**, so the
  panel can already display a value as read-from-a-source.
- **`runDocumentPipeline`** (`apps/api/src/pipeline/document.ts`) is the shape
  to copy for a listing extractor — including the rules that kept it honest.

Because of that, **decision 2 (the saved-page fallback) is now nearly free** —
a saved Urbania PDF goes down the existing cronograma path.

Revised estimate: roughly **0.9M–1.5M tokens**, central ~1.1M, down from the
1.2M–1.9M quoted before Fase B existed. The Urbania fallback drops from ~600k
to ~100–150k.

## The one open technical risk

**Nexo has never been fetched from a datacenter IP.** Every probe ran from the
owner's residential connection. Nexo has no bot layer, so the risk is low, but
it is not zero — and the whole feature depends on it.

The check was deliberately deferred to the start of Fase A: deploy a throwaway
probe route to Railway that fetches one listing and reports the status code.
Cheap (~40–80k), and it either de-risks the feature or kills it before any code
is written. **Do this first.**

## Questions a fresh chat must settle before writing a spec

- **What provenance does a scraped listing carry?** It is not the bank's own
  document, so `documento` may overstate it; but it is not `assumed` either.
  Fase B's rule was "never present an inference as fact" — apply it here.
- **Which fields does a listing fill?** It gives price, district, m² and
  developer — the *property* half of the panel, where the cronograma filled the
  *credit* half. `FIELD_KEYS` may already cover it.
- **What happens to a listing with several models** at different m² and prices?
  One pinned value, a choice, or a scenario each?
- **Does the pasted link replace the panel or merge into it?** Fase B learned
  this the hard way: merging per key blended two banks into one credit.
- **Is a saved HTML page in scope, or only PDF?** `readPdf.ts` handles PDFs
  only; HTML would be a second reader.

## Recommended process

The same one Fase B used, which worked:

1. `superpowers:brainstorming` — architectural path, it changes interfaces.
2. Write the spec, get it reviewed.
3. `superpowers:writing-plans`.
4. `superpowers:subagent-driven-development`, with a pre-flight conflict scan
   over the plan before dispatching task 1. In Fase B that scan caught four
   real defects in the plan before any code was written.

One lesson worth carrying: **make every implementer prove a test bites** by
breaking the code and watching it fail. Fase B shipped five assertions that
could not fail, and one survived two reviews.

## Where things stand overall

See `docs/HANDOFF.md`. Fase B is merged, its UX pass is merged, and `main`
carries both.
