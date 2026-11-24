# Dito: two journeys to test and demo

Two scripted runs through the app. Journey A is the public guided demo, the one a reviewer sees. Journey B uses the password and covers what the guide skips: your own wording, a percentage down payment, editing the panel and recalculating.

Each step says what to do, what should appear, and the figure to check. Expected figures come from the payment formula, not from a previous run of the app, so a mismatch is a real bug.

**Conventions behind every figure:** the rate is a TEA (effective annual). Monthly rate = (1 + TEA)^(1/12) − 1, never TEA ÷ 12. Payment is a fixed-rate annuity, paid monthly in arrears. Insurance and fees are excluded. Amounts are rounded to the whole sol for display, and a difference is the difference of the two rounded amounts.

## Before you start

- **Local:** run `pnpm dev` from the repo root, then open the web URL it prints. The password is `PASSWORD_DITO` from your `.env`.
- **English:** the app follows the browser language. Switch it from the account menu (top right) → Language.
- **Clean start:** click **New** in the side navigation. To go back to the password screen, use the account menu → **Sign out** (it reads **Enter password** in demo mode).
- **Demo limits:** 12 questions per demo session, 3 demo sessions per IP per day, 150 questions a day across everyone. The counters live in the API's memory, so restarting the local API resets them.

---

## Journey A: guided demo (about 3 minutes, no password)

The reviewer's path. It shows the conversation becoming structured data, a correct payment, a comparison and a saved result.

| # | Do | You should see | Check |
|---|---|---|---|
| 1 | On the password screen click **Try the demo**. | The empty screen with the sample apartment quoted and a **Start the sample** button. No attach (+) button. | The demo starts without a password. |
| 2 | Click **Start the sample**. | Panel pins **Location** Miraflores, **Price** S/ 250,000, **Down payment** S/ 50,000, all marked "You said it". Guide moves to *step 2 of 4*; questions left drops to 11. | Nothing you said is asked for again. |
| 3 | Click the guide's chip **8% TEA over 20 years**. | An **Analysis** with a **Monthly payment** card. Panel adds **Rate** 8 and **Term** 20 years. Guide: *step 3 of 4*, 10 left. | Payment **S/ 1,638**. If it mentions totals: financed S/ 200,000, interest S/ 193,192, total paid S/ 393,192. The card says fixed rate, excludes insurance and fees. |
| 4 | Click the chip **What if I increase my down payment to S/ 75,000?** | Cards rise in one after another. A strip in the panel: "I updated one detail · Down payment ~~50,000~~ → 75,000" with **Undo**. A scenario card with a **Save** button. Guide: *step 4 of 4*, 9 left. | New payment **S/ 1,434**, delta **↓ S/ 204**. Interest S/ 169,043, so **S/ 24,149** less. Extra cash up front S/ 25,000. |
| 5 | Click **Save** on the scenario card. | The card shrinks away and appears under **Saved scenarios** in the panel (on a phone: "1 saved scenario" in the bottom sheet). Guide says the guided path is done. | The saved card shows the S/ 75,000 case and its payment. |
| 6 | Reload the page. | Same conversation, panel and saved scenario. | Nothing is lost on reload. |

**Optional extras with the questions left:**
- Type *What if I pull a lever* → 2–3 scenario cards, each changing one thing. With the S/ 75,000 down payment pinned, a 15-year term would be S/ 1,644 and a 7% TEA S/ 1,334.
- Drag a PDF onto the chat → no upload; reading documents isn't part of the demo.
- Keep asking until the count reaches 0 → a **Demo mode** notice with no Retry button; the conversation, panel and saved scenario stay usable.

---

## Journey B: your own words, corrections and recalculation (about 5 minutes, password)

The trust path. It shows that Dito keeps track of what you said versus what it assumed, asks before guessing, and that the panel stays in charge after an edit.

| # | Do | You should see | Check |
|---|---|---|---|
| 1 | Unlock with the password and click **New**. Type: *We're looking at a 3-bedroom in Surco for S/ 380,000. We'd put 20% down.* | A short confirmation. Panel pins **Location** Surco, **Price** S/ 380,000, **Down payment** 20 %. No analysis yet. | The down payment stays a percentage; it isn't silently turned into soles. |
| 2 | Type: *How much would we pay per month?* | Dito asks for the missing rate and/or term instead of inventing them. If it offers typical values, they are offered, not pinned. | Nothing appears as "I assumed it" until you accept it. |
| 3 | Answer: *8.5% TEA, 25 years.* | Analysis with the payment card. Panel adds **Rate** 8.5 and **Term** 25. | Financed **S/ 304,000** (20% = S/ 76,000). Payment **S/ 2,384**. Interest S/ 411,158. |
| 4 | Ambiguity probe. Type: *Make it 25.* | The goal is a short clarifying question: 25 years, or 25% down? | **Record what actually happens.** No rule targets this yet, so it may guess. A silent change to both values is a fail. |
| 5 | In the panel, change **Term** from 25 to **20** and press Enter. | An amber band: "You changed the term. The numbers above are from before." with **Recalculate**. Old cards stay in the chat. | The old figures are visibly flagged as out of date, not silently kept. |
| 6 | Click **Recalculate**. | A new analysis below the old one. The band disappears. The term stays 20. | Payment **S/ 2,578**: S/ 194 more a month. Interest S/ 314,730: S/ 96,428 less. The panel is **not** offered a revert to 25. |
| 7 | Type: *Compare that with negotiating the rate down to 7.5% at 25 years.* | A scenario card for the alternative, compared against the current case. | 7.5% over 25 years: **S/ 2,198**. |
| 8 | Save the scenario you prefer, then reload. | It sits under **Saved scenarios** after the reload. | — |

**Expected figures for this property** (S/ 380,000, 20% down = S/ 76,000, so S/ 304,000 financed):

| Scenario | Monthly payment | Total interest |
|---|---|---|
| 8.5% TEA, 25 years | S/ 2,384 | S/ 411,158 |
| 8.5% TEA, 20 years | S/ 2,578 | S/ 314,730 |
| 7.5% TEA, 25 years | S/ 2,198 | S/ 355,429 |
| 8.5% TEA, 25 years, 30% down (S/ 114,000) | S/ 2,086 | S/ 359,763 |

---

## Known rough edges (as of 2026-11-25)

- **A what-if replaces the active down payment.** After Journey A step 4 the panel says S/ 75,000; the S/ 50,000 case survives only in the chat and as the "↓ S/ 204" comparison. There is no side-by-side view of both scenarios yet.
- **A saved scenario keeps only a title and one figure**, not the full set of inputs and assumptions.
- **Save as property does nothing yet.**
- **The sample's first answer is "Done, I got the property details"** even though the sample asks a question; the guide's next step covers it.
- **Prose can still contain a figure the model wrote itself.** The server asks again when it spots one; if the retry still has one, the answer is shown anyway. Payment cards are always computed.
- **Not yet tried live:** the demo's limit-reached notice, either journey in Spanish, Journey B steps 4–8, and a keyboard-only run.

## Log

Write down what happened, not what should have happened. The goal's test: can the person say what changed between the scenarios, which values were assumed, and where the saved result is?

| Date | Who | Journey | Device | Finished without help? | What broke or confused them | Changed afterwards |
|---|---|---|---|---|---|---|
| | | | | | | |
