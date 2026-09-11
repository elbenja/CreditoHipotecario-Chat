# Fase B — known follow-ups

Recorded at the end of the cronograma implementation (branch `fase-b-cronograma`,
23 commits, 351 tests). Each of these was found during review, judged not worth
blocking the merge, and deliberately left. None is a regression: they are either
pre-existing, unreachable today, or cosmetic.

Nothing here is urgent. It exists so these decisions do not have to be
rediscovered.

## Deliberately not built

**Drag and drop.** ~~The spec's flow says "attach button in the composer, plus
drag and drop", and only the button was built.~~ Built 2026-09-11 in the
cronograma UX pass (`DropZone`, branch `ux-composer-cronograma`), after PR #4
merged. Kept out of Fase B's final fix wave on purpose at the time: that wave
carried four correctness fixes, and the process allows exactly one.

## Worth fixing when the area is next touched

**A second upload silently discards manual edits.** A confirmed extraction now
replaces the mortgage group (it used to merge per key, which was worse — it
blended two banks). But a user who corrected a figure by hand and then uploads a
second schedule loses that correction with no warning. Tracking `userEdited` for
mortgage keys was deliberately not added, because nothing consumes it yet; the
honest fix is a prompt, not more state.

**A stale derived down payment survives.** If a second upload carries no
`montoFinanciado`, a `fields.inicial` derived from the *first* upload is not
cleared — the `if (inicial && …)` gate only ever sets, never unsets. Pre-existing.

**`bareValue` builds regexes from data.** `PRESENTATION`'s prefix and suffix are
interpolated unescaped into `new RegExp`. Safe today — `S/`, `%` and `cuotas`
carry no metacharacters, and the map is a hardcoded constant, so nothing
attacker-controlled reaches it. A landmine for whoever adds a field containing
`.`, `$`, `+` or `(`.

**A suffix mid-string is not stripped.** `"8.99% aprox"` pins as value
`"8.99% aprox"` *with* suffix `%`, rendering `8.99% aprox %` — a unit inside
`value`, which the panel's own rule forbids. The prompt tells the model to
return clean values, so this needs a malformed reply to surface.

**`toNumber` and three-decimal commas.** A comma-decimal value with exactly
three fractional digits (`"1,234"` meaning 1.234) reads as thousands-grouped
1234. Unreachable today because every caller passes two-decimal currency, but a
trap if the helper is reused.

## Test-coverage gaps

**No test combines editing the financed amount in the modal with checking the
derived down payment.** The data flow is unambiguous in code — `deriveInicial`
reads from `action.fields`, the modal-confirmed values — so this is a coverage
gap rather than a suspected defect.

**The image route is untested end to end.** Render size, payload transport and
the model's reply for the three scanned banks are covered only by the manual
verification run. This is the riskiest remaining path in the feature.

## Cosmetic

- `data:image/jpeg;base64,` with an empty payload passes the API's guard. No
  request-forgery vector; it just fails downstream as a malformed image.
- The `MortgageGroup` test named "shows the count while collapsed" is weakly
  named — the count renders regardless of open state — though it still fails if
  the count is dropped.

## Closed by the final fix wave

The fixture README's relative path, the unused `vi` import, the dead local in
`readPdf.test.ts`, and the hardcoded error `kind` were all fixed. The PII
count-invariant limitation (it detects a redaction marker disappearing, not PII
resurfacing somewhere new) stands as designed — the alternative was hardcoding
real identifiers into a committed test.
