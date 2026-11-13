# ClaimSetu: hospital claims desk audit MVP

ClaimSetu is an audit and recovery workspace for hospital cashless claims. A hospital uploads insurer settlement letters; the tool lists every deduction, assesses whether it is worth contesting, drafts the appeal for a reviewer to sign off, and tracks what is won back and the success fee earned.

## Run it

Requires Node.js 22.13 or later.

```bash
npm install
```

```bash
npm start
```

Open http://localhost:4173 and click **Load sample documents** on the Claims page.

## Two reading modes

| Mode | When | What it reads | How it assesses |
|---|---|---|---|
| Demo | No Claude credentials set | Text files in the layout used in `samples/` | Fixed keyword rules in `rules.js` |
| Claude | `ANTHROPIC_API_KEY` is set | PDFs, scanned images and text in any layout | Claude (`claude-opus-5-5`), guided by the same category list |

To switch on Claude reading, set the key and restart:

```bash
export ANTHROPIC_API_KEY=your-key
```

The Claude path has been checked against the SDK's types but has not been run against the live API. Test it on a few letters before relying on it.

Server-side refusal fallback is enabled on the Claude calls, so a safety-classifier decline is retried on another model instead of failing the upload. To turn it off, remove `betas` and `fallbacks` in `extract.js`.

## Workflow

1. **Upload** settlement letters (several at once).
2. **Review** each deduction: confirm the assessment or change the verdict. Only reviewed, recoverable lines go into an appeal.
3. **Draft appeal**: edit the letter and fill every `[bracketed]` placeholder. The tool refuses to approve a letter that still has placeholders.
4. **Approve**, file the letter through the payer's own portal, then **Mark as filed**. This tool does not send anything to a payer.
5. **Record outcomes** per deduction (won, partly won, lost). The dashboard and the denial knowledge base update.

## Three documents per claim

The app reads three kinds of document and links them by claim number, in any order:

| Document | What is read | Where it shows |
|---|---|---|
| Settlement letter | Each deduction and the payer's reason | Deductions, review queue, appeals |
| Itemised bill | Every billed line with quantity and unit price, sorted into drug, device, procedure, investigation, room, fee, consumable | Bill view, bill checks, price analytics |
| Discharge summary | Clinical facts defined in the schema registry, each with its source text | Clinical facts on the claim |

**Schema registry.** `schemas/` holds one core schema and one file per clinical domain (cardiac, orthopaedic, maternity, general surgery): 39 properties in total. Add a domain by adding a file.

**Catalogues.** `catalogues/` maps bill wording to one canonical drug, device or procedure. Entries carry a name and class only; standard codes are deliberately blank until each is verified against the official code set.

**What the linked data gives you**
- Each deduction shows the bill lines it most likely refers to and what share of the billed amount was cut. The link is by matching words, then by charge type, so it is approximate.
- Bill checks flag possible duplicate lines, categories payers often treat as non-payable, and unit prices well above the hospital's own usual price.
- Price analytics compares unit prices for the same drug or device across bills, and shows billed against cut by payer and charge type.
- The review queue is sorted by expected recovery: the amount times an estimated chance of winning. The estimate is a ranking aid, not a forecast.

## Payer rules engine

`rules/payers/` holds one file per payer: policy terms (room rent cap, co-payment, sub-limits), the rates agreed with the hospital, what the payer does not pay for, usual length of stay, and required documents.

For every deduction the engine works out what the payer was entitled to cut under those terms and compares it with what it actually cut. The difference is shown as over-deducted, with the arithmetic and the evidence to attach. Appeals contest only the over-deducted part and use the finding as the argument. The same rules run on the bill before filing and list what would be cut.

**The three rule files shipped here are synthetic.** I wrote them to fit the sample documents, so the findings on the samples prove the mechanism works, not that the rules are right. Real use needs each patient's policy schedule and the hospital's signed tariff with each payer. Today terms are held per payer; in practice room rent caps, co-payments and sub-limits belong to the individual policy.

## Pre-filing check

Upload the itemised bill and discharge summary for a claim that has not been settled, and it appears on the **Pre-filing check** screen. The bill is run against the payer's terms and each finding is sorted by what to do about it:

| Group | Meaning | Examples |
|---|---|---|
| Correct the bill | The bill itself is wrong | Duplicate line, item above the agreed rate |
| Collect from the patient | The payer will not pay this | Co-payment, room rent above the cap, non-payable items, amount above a sub-limit |
| Attach to the claim file | Payable only with a document | Report for a billed investigation, justification for a longer stay or an ICU day |

Each claim shows the amount billed, what to expect from the payer, the patient's share, and what would be cut if it were filed as it stands. Tick items off as they are dealt with. **Mark as filed** freezes the prediction; when the settlement letter is later uploaded, the claim page shows the predicted cut beside the actual one.

The bill must name the payer (or you pick it on the claim), and that payer needs a rule file. Ticking an item records that someone dealt with it; the app does not edit the bill itself.

## Screens

| Screen | What it is for |
|---|---|
| Overview | The three scorecard numbers (share of claimed value settled, days to payment, contested deductions won back), where deductions fall, the recovery pipeline, and next actions |
| Review queue | Every unreviewed deduction across all claims, largest first, with bulk confirm |
| Claims | Upload, search and filter by stage |
| Claim detail | Progress steps, per-deduction verdict, evidence checklist, past results for the same payer and reason, appeal editor with a list of unfilled placeholders |
| Denial knowledge | Payer by reason: lines, value, appeals decided and win rate |
| Audit report | A printable summary to hand to the hospital (print or save as PDF) |

A CSV of every deduction is available from the Overview screen.

## Files

| File | Purpose |
|---|---|
| `server.js` | HTTP server, API routes, business rules |
| `extract.js` | Letter reading and appeal drafting (Claude and demo paths) |
| `rules.js` | Deduction categories and default assessments |
| `db.js` | SQLite schema (`data/claims.db`, created on first run) |
| `public/` | Web interface |
| `samples/` | Synthetic settlement letters for the demo |

## Before using real patient data

- **The category rules are starting assumptions.** They have not been validated against real policies or tariffs. Treat every assessment as a prompt for a reviewer, not a decision.
- **No login.** The server listens on localhost only and has no user accounts or access control.
- **Patient data leaves the machine in Claude mode.** Letters are sent to the Claude API. Get the hospital's written authorisation and confirm the consent basis before uploading real letters.
- **Data is stored unencrypted** in `data/claims.db`.
- **The sample documents are invented.** Payer names, claim numbers and amounts are synthetic.

## Not built yet

Hospital billing system integration, payer portal filing, bill-versus-tariff line matching, multi-hospital accounts, and the deduction predictor (it needs recorded outcomes first).
