<div align="center">
<h1>ClaimSetu</h1>
<p><strong>A hospital-side workspace for reviewing claim deductions and tracking appeals.</strong></p>
<p>Turn settlement letters, bills, and discharge summaries into a reviewer-led claims audit.</p>
<p><a href="#quick-start">Run the demo</a> · <a href="mvp/README.md">MVP guide</a> · <a href="architecture/claims-desk-architecture.drawio">Architecture</a></p>
</div>

> [!WARNING]
> **Prototype only. Do not use real patient information.** The demo uses invented documents and synthetic payer rules. The app has no login, stores data unencrypted, and has not been validated for clinical, financial, or operational decisions.

## What it does

ClaimSetu is an early MVP for hospital teams auditing cashless insurance claims. It brings three documents together by claim number, highlights payer deductions for human review, and keeps the appeal and outcome in one workflow.

| Review | Prepare | Track |
|---|---|---|
| Extract deductions and stated reasons from settlement letters | Check bills against configurable payer terms | Follow claims from upload through review and appeal outcome |
| Link bill lines and discharge-summary facts to a claim | Draft an appeal for a reviewer to edit and approve | Compare billed amounts, payer cuts, and recorded recoveries |
| Flag possible duplicates, non-payable items, and unusual prices | Keep evidence notes alongside each deduction | Review payer and reason trends in the denial knowledge base |

## Claim workflow

```mermaid
flowchart LR
A[Settlement letter, bill, summary] --> B[Link by claim number]
B --> C[Extract and check]
C --> D[Human reviews deductions]
D --> E[Draft appeal]
E --> F[Hospital edits and approves]
F --> G[File manually with payer]
G --> H[Record outcome]
H --> I[Recovery and payer analytics]
```

ClaimSetu **does not submit claims or appeals to payers**. Filing remains a manual action by the hospital.

## Quick start

**Requirements:** Node.js 22.13 or later.

```powershell
cd mvp
npm install
npm start
```

Open [http://localhost:4173](http://localhost:4173), go to **Claims**, and choose **Load sample letters**. The local demo uses fixed keyword rules and does not need an API key.

### Optional document extraction

With an Anthropic API key, the app can process PDFs, scans, and text in varied layouts. In PowerShell, set the key for the current terminal session before starting the app:

```powershell
$env:ANTHROPIC_API_KEY = "your-key"
npm start
```

Documents uploaded in this mode are sent to the Anthropic API. The live API path has not been tested end to end; use synthetic documents only while evaluating it. See the [MVP guide](mvp/README.md) for details.

## What is and is not implemented

- **Implemented for demo:** document upload, claim linking, deduction review, synthetic payer-rule checks, appeal drafting, pre-filing checks, analytics, and CSV export.
- **Human-controlled:** reviewers confirm assessments; a hospital edits and approves appeals; filing and payer follow-up happen outside the app.
- **Not production-ready:** authentication, encrypted storage, real payer rules and tariffs, hospital-system integrations, and automated payer submission are not provided.

## Project map

- [`mvp/`](mvp/) — runnable Node.js application and [setup guide](mvp/README.md)
- [`architecture/`](architecture/) — platform and workflow diagram
- [`reports/`](reports/) — product thesis and operating model
- [`research_notes/`](research_notes/) — supporting market and regulatory research

The sample claims, patient references, payer names, and payer rules are synthetic. Findings from the demo illustrate the workflow only; they are not evidence that a deduction is recoverable.