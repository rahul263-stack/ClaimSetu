// Builds architecture/claims-desk-architecture.drawio (five pages) from the definitions below.
// Usage: node tools/build-architecture.js [output.drawio] [folder for single-page viewer links]
const fs = require('fs');
const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

function page(name, w, h) {
  const cells = []; let n = 1;
  const p = {
    lane(id, label, x, y, w, h, fill, stroke, horiz = true) {
      cells.push(`<mxCell id="${id}" value="${esc(label)}" style="swimlane;html=1;startSize=${horiz ? 32 : 44};horizontal=${horiz ? 1 : 0};rounded=1;arcSize=6;fillColor=${fill};strokeColor=${stroke};fontStyle=1;fontSize=14;fontColor=#0d2b45;swimlaneFillColor=#ffffff;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    },
    box(id, parent, title, sub, x, y, w, h, fill, stroke, extra = '') {
      cells.push(`<mxCell id="${id}" value="${esc(`<b>${title}</b>` + (sub ? `<br><font style="font-size:10px">${sub}</font>` : ''))}" style="rounded=1;whiteSpace=wrap;html=1;fillColor=${fill};strokeColor=${stroke};fontSize=12;fontColor=#1c2430;spacing=4;${extra}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    },
    plain(id, parent, text, x, y, w, h, style) {
      cells.push(`<mxCell id="${id}" value="${esc(text)}" style="whiteSpace=wrap;html=1;fontSize=11;fontColor=#1c2430;${style}" vertex="1" parent="${parent}"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    },
    edge(src, tgt, label = '', style = '') {
      cells.push(`<mxCell id="e${n++}" value="${esc(label)}" style="edgeStyle=orthogonalEdgeStyle;rounded=1;html=1;strokeColor=#44546a;strokeWidth=1.5;fontSize=10;fontColor=#44546a;labelBackgroundColor=#ffffff;${style}" edge="1" parent="1" source="${src}" target="${tgt}"><mxGeometry relative="1" as="geometry"/></mxCell>`);
    },
    text(id, html, x, y, w, h, size = 11) {
      cells.push(`<mxCell id="${id}" value="${esc(html)}" style="text;html=1;align=left;verticalAlign=middle;fontSize=${size};fontColor=#0d2b45;" vertex="1" parent="1"><mxGeometry x="${x}" y="${y}" width="${w}" height="${h}" as="geometry"/></mxCell>`);
    },
    row(parent, prefix, items, x0, y, w, h, gap, fill, stroke, extra) {
      items.forEach((it, k) => p.box(prefix + (k + 1), parent, it[0], it[1], x0 + k * (w + gap), y, w, h, fill, stroke, (extra || '') + (it[2] || '')));
    },
    xml() {
      const body = `<mxGraphModel dx="1400" dy="900" grid="1" gridSize="10" guides="1" tooltips="1" connect="1" arrows="1" fold="1" page="1" pageScale="1" pageWidth="${w}" pageHeight="${h}" math="0" shadow="0"><root><mxCell id="0"/><mxCell id="1" parent="0"/>${cells.join('')}</root></mxGraphModel>`;
      const ids = [...body.matchAll(/ id="([^"]+)"/g)].map(m => m[1]);
      const dangling = [...body.matchAll(/(?:source|target|parent)="([^"]+)"/g)].map(m => m[1]).filter(r => !ids.includes(r));
      console.log(name, 'cells', ids.length, 'dupes', ids.length - new Set(ids).size, 'dangling', dangling.length);
      return { name, body };
    }
  };
  return p;
}

const KEY = 'strokeWidth=3;strokeColor=#b8860b;fillColor=#fff8dc;';
// ---------- Page 1: platform architecture ----------
const a = page('1 Platform architecture', 1730, 925);
a.text('title', '<b>ClaimSetu: 360 platform architecture</b><br><font style="font-size:12px">AI does the routine work at every stage; people approve submissions and handle clinical disputes</font>', 40, 5, 900, 55, 20);
a.lane('X', 'External systems', 40, 70, 230, 795, '#fde9d9', '#c55a11');
[['Hospital information and billing system', 'Admissions, bills, discharge summaries'],
 ['Insurer and TPA portals', 'Pre-authorisation, claims, queries'],
 ['NHCX gateway', 'National claims exchange, FHIR APIs'],
 ['Claims networks', 'IHX, Medi Assist provider rails'],
 ['Government scheme portals', 'PM-JAY and state schemes (later phase)'],
 ['Bank statements and payment advice', 'Settlement amounts and dates'],
 ['Email, SMS and WhatsApp', 'Payer queries, patient and doctor prompts']
].forEach((it, k) => a.box('X' + (k + 1), 'X', it[0], it[1], 20, 45 + k * 92, 190, 72, '#ffffff', '#c55a11'));
a.lane('A', 'People and channels', 290, 70, 1150, 130, '#dae8fc', '#3a6ea5');
a.row('A', 'A', [['Hospital claims desk', 'Web app: upload, track, respond'], ['Treating doctor', 'Mobile prompts for missing clinical notes'], ['Hospital finance head', 'Scorecard: % settled, days to payment, deductions won back', KEY], ['Our operations team', 'We run the desk: reviewers, coders, appeals', KEY]], 30, 45, 250, 65, 30, '#ffffff', '#3a6ea5');
a.lane('B', 'Workflow modules: the seven stages of a claim', 290, 240, 1150, 180, '#d5f0e6', '#1f7a6d');
a.row('B', 'B', [['1. Intake hub', 'Letters, bills, summaries; linked by claim number'], ['2. Claim file builder', 'Deductions, bill lines, clinical facts'], ['3. Payer rules engine', 'Check against policy and tariff'], ['4. Gap finder', 'List missing evidence, ask owner'], ['5. Submission composer', 'Assemble pre-auth and final packets'], ['6. Channel layer', 'File with approval, log everything'], ['7. Query and appeals desk', 'Answer queries, reconcile, appeal']], 31, 75, 140, 85, 18, '#ffffff', '#1f7a6d');
a.lane('C', 'Shared platform services', 290, 460, 1150, 245, '#e8def8', '#6b4fa0');
a.row('C', 'C', [['Integration adapters', 'Portal automation, NHCX, HIS connectors'], ['Case orchestrator', 'State machine, deadline clocks (1h / 3h)'], ['Document AI', 'OCR, LLM extraction, source citations'], ['Human review queue', 'Confidence routing, maker and checker'], ['Rules management', 'One rule file per payer: terms, rates'], ['Deduction predictor', 'Flags likely cuts before filing', KEY], ['Outcome metering', 'Recovered amounts, success-fee billing', KEY]], 31, 50, 140, 84, 18, '#ffffff', '#6b4fa0');
a.row('C', 'K', [['Schema registry', '39 clinical properties, one file per domain'], ['Entity catalogues', 'Drugs, devices, procedures: one canonical name each', KEY], ['Bill checks', 'Duplicates, often non-payable, price outliers'], ['Price analytics', 'Billed against cut; unit-price spread', KEY], ['Priority scoring', 'Ranks work by expected recovery']], 31, 146, 200, 80, 22, '#ffffff', '#6b4fa0');
a.lane('D', 'Data layer (hosted in India, encrypted)', 290, 745, 1150, 120, '#fff2cc', '#b8860b');
a.row('D', 'D', [['Claim ledger', 'Queries, deductions, payments'], ['Bill lines', 'Every charge, priced', KEY], ['Clinical facts', 'With source text'], ['Document store', 'Scans, bills, letters'], ['Payer rules library', 'Limits, exclusions, rates'], ['Denial knowledge base', 'Payer, reason, result', KEY], ['Audit log', 'Who did what, when']], 31, 44, 140, 62, 18, '#ffffff', '#b8860b');
a.lane('S', 'Trust and compliance', 1460, 70, 230, 795, '#f8d7da', '#a94442');
[['Patient consent and notices', 'DPDP Act duties from May 2027'],
 ['Hospital authorisation', 'Written mandate to act on its behalf'],
 ['Approval before every submission', 'No filing without hospital sign-off'],
 ['Role-based access', 'Least privilege, masked identifiers'],
 ['Incident response', '72-hour breach report, CERT-In 6 hours'],
 ['Clinical safety rule', 'Never create or alter clinical facts'],
 ['Hospital-side only', 'No revenue from insurers, ever', KEY]
].forEach((it, k) => a.box('S' + (k + 1), 'S', it[0], it[1], 20, 45 + k * 92, 190, 72, '#ffffff', '#a94442', it[2] || ''));
for (let k = 1; k < 7; k++) a.edge('B' + k, 'B' + (k + 1));
a.edge('A', 'B', 'cases, approvals, answers', 'exitX=0.5;exitY=1;entryX=0.5;entryY=0;');
a.edge('B', 'C', 'every stage calls shared services', 'exitX=0.5;exitY=1;entryX=0.5;entryY=0;startArrow=classic;');
a.edge('C', 'D', 'read and write', 'exitX=0.5;exitY=1;entryX=0.5;entryY=0;startArrow=classic;');
a.edge('X', 'B1', '', 'exitX=1;exitY=0.361;entryX=0;entryY=0.5;');
a.edge('C1', 'X', '', 'exitX=0;exitY=0.5;entryX=1;entryY=0.606;startArrow=classic;');
a.edge('B7', 'B3', 'denial outcomes update the rules', 'exitX=0.5;exitY=0;entryX=0.5;entryY=0;dashed=1;strokeColor=#1f7a6d;fontColor=#1f7a6d;');
a.text('legend', 'Solid arrows: flow of work and data. Dashed arrow: learning loop. Left: systems we connect to. Right: controls that apply to every layer. <b>Gold outline: what makes the platform hard to copy (see page 4). Build status of every part is on page 5.</b>', 40, 880, 1500, 24);

// ---------- Page 2: claim lifecycle ----------
const b = page('2 Claim lifecycle', 2480, 720);
const AI = ['#d5f0e6', '#1f7a6d'], HO = ['#dae8fc', '#3a6ea5'], RV = ['#e8def8', '#6b4fa0'], PY = ['#fde9d9', '#c55a11'];
b.text('t2', '<b>One cashless claim, from admission to settlement</b><br><font style="font-size:12px">Green: done by the platform. Blue: hospital. Purple: our reviewers. Orange: insurer or TPA.</font>', 40, 5, 1100, 55, 20);
const LW = 2400, LH = 135;
[['LH', 'Hospital', HO], ['LP', 'Platform (AI)', AI], ['LR', 'Our reviewers', RV], ['LY', 'Insurer or TPA', PY]].forEach((l, r) => b.lane(l[0], l[1], 40, 70 + r * LH, LW, LH, l[2][0], l[2][1], false));
const cx = c => 62 + c * 155;
const node = (id, lane, c, title, col) => b.box(id, lane, title, '', cx(c), 37, 130, 62, col[0], col[1], 'fontSize=11;');
const dia = (id, lane, c, title, col) => b.plain(id, lane, `<b>${title}</b>`, cx(c) - 5, 28, 140, 80, `rhombus;fillColor=${col[0]};strokeColor=${col[1]};fontSize=10;spacing=2;`);
node('n1', 'LH', 0, 'Upload admission documents', HO);
node('n2', 'LP', 1, 'Extract and build the claim file', AI);
node('n3', 'LP', 2, 'Check against payer rules', AI);
dia('d1', 'LP', 3, 'Gaps or low confidence?', AI);
node('n4', 'LH', 3, 'Doctor or desk supplies missing evidence', HO);
node('n5', 'LR', 3, 'Reviewer verifies uncertain fields', RV);
node('n6', 'LP', 4, 'Compose pre-authorisation packet', AI);
node('n7', 'LH', 5, 'Hospital approves the packet', HO);
node('n8', 'LP', 6, 'Submit through portal or NHCX', AI);
node('n9', 'LY', 6, 'Payer decides (1-hour rule)', PY);
dia('d2', 'LY', 7, 'Query raised?', PY);
node('n10', 'LP', 8, 'Draft the query answer', AI);
node('n11', 'LR', 8, 'Reviewer approves the answer', RV);
node('n12', 'LP', 9, 'At discharge: compose final bill packet', AI);
node('n13', 'LH', 10, 'Hospital approves the final claim', HO);
node('n14', 'LP', 11, 'Submit the final claim', AI);
node('n15', 'LY', 11, 'Payer authorises discharge (3-hour rule), then pays', PY);
node('n16', 'LP', 12, 'Reconcile payment against the bank', AI);
dia('d3', 'LP', 13, 'Short-paid or denied?', AI);
node('n20', 'LH', 13, 'Case closed; finance sees the result', HO);
node('n17', 'LP', 14, 'Draft appeal with evidence', AI);
node('n18', 'LR', 14, 'Specialist reviews the appeal', RV);
node('n19', 'LY', 14, 'Appeal filed; outcome recorded', PY);
const R = 'exitX=1;exitY=0.5;', L = 'entryX=0;entryY=0.5;', T = 'exitX=0.5;exitY=0;', Bt = 'exitX=0.5;exitY=1;', eT = 'entryX=0.5;entryY=0;', eB = 'entryX=0.5;entryY=1;';
b.edge('n1', 'n2', '', Bt + L);
b.edge('n2', 'n3', '', R + L);
b.edge('n3', 'd1', '', R + L);
b.edge('d1', 'n4', 'gaps', T + eB);
b.edge('n4', 'n3', 'recheck', 'exitX=0;exitY=0.5;' + eT);
b.edge('d1', 'n5', 'low confidence', Bt + eT);
b.edge('n5', 'n6', '', R + eB);
b.edge('d1', 'n6', 'clean', R + L);
b.edge('n6', 'n7', '', R + eB);
b.edge('n7', 'n8', '', R + eT);
b.edge('n8', 'n9', '', Bt + eT);
b.edge('n9', 'd2', '', R + L);
b.edge('d2', 'n10', 'yes', T + L);
b.edge('n10', 'n11', '', Bt + eT);
b.edge('n11', 'd2', 'resubmit', Bt + 'entryX=1;entryY=0.5;');
b.edge('d2', 'n12', 'no', Bt + eB + 'jettySize=14;');
b.edge('n12', 'n13', '', R + eB);
b.edge('n13', 'n14', '', R + eT);
b.edge('n14', 'n15', '', Bt + eT);
b.edge('n15', 'n16', '', R + eB);
b.edge('n16', 'd3', '', R + L);
b.edge('d3', 'n20', 'no', T + eB);
b.edge('d3', 'n17', 'yes', R + L);
b.edge('n17', 'n18', '', Bt + eT);
b.edge('n18', 'n19', '', Bt + eT);
b.text('l2', 'Every appeal outcome and reviewer correction is written to the denial knowledge base, which tightens the rules check for the next claim.', 40, 70 + 4 * LH + 12, 1300, 24);

// ---------- Page 3: build phases ----------
const c = page('3 Build phases', 1500, 640);
c.text('t3', '<b>What to build, in what order</b><br><font style="font-size:12px">Phase timings are proposals from the report, not validated commitments</font>', 40, 5, 1000, 55, 20);
const ph = [
  ['P1', 'Phase 1 (months 0-3): deduction and denial audit', AI, [['Settlement letter and bill upload', 'Bulk upload, no hospital integration needed'], ['Deduction extraction', 'Each disallowed line, amount and stated reason'], ['Recoverable or not', 'Classify against policy terms and tariff'], ['Appeal drafts', 'Evidence-linked letters for reviewer sign-off'], ['Recovery tracker', 'Amount contested, won, pending; basis for the success fee']]],
  ['P2', 'Phase 2 (months 3-12): live claims desk', HO, [['Intake and claim file builder', 'Live admissions, document checklist'], ['Payer rules engine and gap finder', 'Top 5 payers first, then widen'], ['Submission with hospital approval', 'Operator-driven portal filing, NHCX where live'], ['Query handling against the clock', '1-hour and 3-hour deadline tracking'], ['Review console', 'Confidence routing, maker and checker']]],
  ['P3', 'Phase 3 (months 12-24): scale and expand', RV, [['Hospital system connectors', 'Direct feeds replace uploads'], ['Reconciliation with bank data', 'Automatic short-payment detection'], ['Government scheme claims', 'PM-JAY and state scheme workflows'], ['Receivables financing partner', 'Lender uses the claim ledger as underwriting data'], ['US revenue-cycle delivery', 'Same engine, offshore delivery team']]]
];
ph.forEach((p3, k) => {
  c.lane(p3[0], p3[1], 40 + k * 480, 70, 450, 520, p3[2][0], p3[2][1]);
  p3[3].forEach((it, j) => c.box(p3[0] + 'b' + j, p3[0], it[0], it[1], 25, 50 + j * 92, 400, 72, '#ffffff', p3[2][1]));
});
c.edge('P1', 'P2', '', 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;strokeWidth=2.5;');
c.edge('P2', 'P3', '', 'exitX=1;exitY=0.5;entryX=0;entryY=0.5;strokeWidth=2.5;');
c.text('l3', 'Phase 1 needs no payer or hospital system integration, so it tests the two riskiest assumptions first: that deductions are recoverable and that hospitals will pay a success fee.', 40, 600, 1400, 24);

// ---------- Page 4: defensibility ----------
const d = page('4 Why it is hard to copy', 1500, 760);
d.text('t4', '<b>Five positions that make the platform hard to copy</b><br><font style="font-size:12px">Each one is built into a named part of the platform (gold outline on page 1), not added as a feature</font>', 40, 5, 1100, 55, 20);
const cols = [[40, 290, 'Position'], [350, 520, 'Where it lives in the platform'], [890, 570, 'Why competitors struggle to follow']];
cols.forEach((cl, k) => d.plain('h' + k, '1', `<b>${cl[2]}</b>`, cl[0], 75, cl[1], 36, 'rounded=1;fillColor=#0d2b45;strokeColor=#0d2b45;fontColor=#ffffff;fontSize=13;'));
[['1. Paid only on money recovered', 'Deduction audit as the entry product (page 3, phase 1). Outcome metering measures what was contested and won, and bills the success fee from the claim ledger.', 'Vendors selling software licences or financing earn whether or not the claim is paid, so matching this means changing their revenue model.'],
 ['2. Own the denial data', 'Denial knowledge base records payer, procedure, stated reason and appeal result. The deduction predictor uses it to flag likely cuts before filing. Stage 7 feeds outcomes back to stage 3.', 'No public dataset exists. It only accumulates by handling claims, so a later entrant starts from zero.'],
 ['3. Hospital-side only', 'A standing rule in trust and compliance: no revenue from insurers. Every engagement runs under a written hospital mandate.', 'Networks and administrators paid by insurers cannot credibly contest a deduction on the hospital\'s behalf.'],
 ['4. Narrow and deep first', 'Payer rules library built for the top five payers and two or three specialties in one city, with every rule versioned in rules management.', 'Generic products cover every payer adequately. Depth per payer and procedure only comes from repetition.'],
 ['5. Operator, not a tool', 'Our operations team runs the desk through the review console and human review queue. The case orchestrator tracks the 1-hour and 3-hour deadlines.', 'A software vendor would have to build a delivery team and carry service commitments.']
].forEach((r, j) => {
  const y = 123 + j * 96;
  d.plain('r' + j + 'a', '1', `<b>${r[0]}</b>`, cols[0][0], y, cols[0][1], 84, 'rounded=1;fillColor=#fff8dc;strokeColor=#b8860b;strokeWidth=3;fontSize=13;spacing=8;');
  d.plain('r' + j + 'b', '1', r[1], cols[1][0], y, cols[1][1], 84, 'rounded=1;fillColor=#ffffff;strokeColor=#6b4fa0;align=left;spacing=10;fontSize=12;');
  d.plain('r' + j + 'c', '1', r[2], cols[2][0], y, cols[2][1], 84, 'rounded=1;fillColor=#ffffff;strokeColor=#a94442;align=left;spacing=10;fontSize=12;');
});
d.plain('proof', '1', '<b>Proof, published for every hospital</b><br>Share of claimed value settled. Days from discharge to payment. Share of contested deductions won back. Each compared with the hospital\'s own baseline before we started.', 40, 615, 690, 90, 'rounded=1;fillColor=#d5f0e6;strokeColor=#1f7a6d;align=left;spacing=10;fontSize=12;');
d.plain('caveat', '1', '<b>What this depends on</b><br>Positions 1 and 2 assume deductions are recoverable, which is not yet confirmed. If the first audits show most cuts are valid contractual ones, the product shifts to preventing deductions before filing.', 770, 615, 690, 90, 'rounded=1;fillColor=#fde9d9;strokeColor=#c55a11;align=left;spacing=10;fontSize=12;');

// ---------- Page 5: build status ----------
const e = page('5 Build status', 1560, 930);
e.text('t5', '<b>Where the build stands</b><br><font style="font-size:12px">Status of each part of the architecture after the current MVP. "Tested" means run end to end on synthetic sample documents, not on real hospital data.</font>', 40, 5, 1300, 55, 20);
const cols5 = [
  ['S1', 'Built and tested in demo mode', AI, [['Intake of three document types', 'Settlement letter, itemised bill, discharge summary; linked by claim number'], ['Deduction assessment', 'Keyword rules; every verdict goes to a reviewer'], ['Review queue and priority scoring', 'Sorted by expected recovery, bulk confirm'], ['Appeal workflow', 'Draft, edit, approve, mark filed; placeholders block approval'], ['Outcome metering', 'Won, partly won, lost; success fee'], ['Denial knowledge base', 'Payer by reason, with win rates'], ['Schema registry and catalogues', '39 properties, 4 domains, 29 catalogue entries'], ['Bill checks and price analytics', 'Duplicates, price spread, billed against cut'], ['Audit report, CSV export, activity log', 'Printable summary for the hospital'], ['Payer rules engine (synthetic rules)', 'Terms allow against payer cut'], ['Pre-filing check', 'Fix, collect, attach checklist; prediction kept for comparison']]],
  ['S2', 'Written but never run on real input', HO, [['Reading real PDFs and scans', 'Letters, bills and summaries through Claude; needs an API key'], ['AI-written appeal letters', 'Template letters are used until then'], ['Document type and domain detection', 'Runs on sample text only so far']]],
  ['S3', 'Not built yet', PY, [['Real payer rule files', 'Actual policy schedules and signed tariffs, per payer'], ['Submission composer', 'Pre-authorisation and final claim packets'], ['Channel layer', 'Payer portals, NHCX, claims networks'], ['Hospital system connectors', 'Uploads only today'], ['Deduction predictor', 'Needs recorded outcomes first'], ['Standard codes in catalogues', 'Left blank until verified'], ['Logins, roles, encryption', 'Single user on one machine today'], ['Multi-hospital accounts and benchmarks', 'Needs a consent and anonymisation model'], ['Government scheme claims', 'PM-JAY and state schemes']]]
];
cols5.forEach((col, k) => {
  e.lane(col[0], col[1], 40 + k * 500, 70, 470, 786, col[2][0], col[2][1]);
  col[3].forEach((it, j) => e.box(col[0] + 'b' + j, col[0], it[0], it[1], 20, 48 + j * 66, 430, 56, '#ffffff', col[2][1]));
});
e.text('l5', 'In terms of the seven workflow stages: stages 1 and 2 (collect, extract) and stage 7 (appeals, reconciliation by hand) work in demo form. Stages 3 and 4 (rules check, gap finding before filing) work on invented payer terms. Stages 5 and 6 (composing and filing a live claim) are not built.', 40, 868, 1480, 40);

const pages = [a.xml(), b.xml(), c.xml(), d.xml(), e.xml()];
const outFile = process.argv[2] || require('path').join(__dirname, '..', 'architecture', 'claims-desk-architecture.drawio');
fs.writeFileSync(outFile, `<mxfile host="app.diagrams.net">${pages.map((p, i) => `<diagram id="p${i + 1}" name="${esc(p.name)}">${p.body}</diagram>`).join('')}</mxfile>`);
// single-page files for render checks
if (process.argv[3]) pages.forEach((p, i) => fs.writeFileSync(`${process.argv[3]}/page${i + 1}.url`, 'https://viewer.diagrams.net/?lightbox=1&nav=0&toolbar=0#R' + encodeURIComponent(`<mxfile><diagram name="p">${p.body}</diagram></mxfile>`)));
