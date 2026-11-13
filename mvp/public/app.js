const view = document.getElementById('view');
const toastEl = document.getElementById('toast');
const tipEl = document.getElementById('tip');
let meta = null;

// ---------- helpers ----------
const h = s => String(s ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const inr = n => '₹' + Number(n || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });
const pct = n => n == null ? '–' : Math.round(n * 100) + '%';
const pct1 = n => n == null ? '–' : (n * 100).toFixed(1) + '%';
const label = s => String(s || '').replace(/_/g, ' ').replace(/^./, c => c.toUpperCase());
const pill = (s, text) => `<span class="pill ${h(s)}">${h(text || label(s))}</span>`;
const plural = (n, w) => `${n} ${w}${n === 1 ? '' : 's'}`;
const STAGES = ['pre_filing', 'filed_awaiting', 'audited', 'reviewed', 'drafted', 'approved', 'filed', 'decided'];
const CAT_LABEL = { drug: 'Drugs', device: 'Devices and implants', procedure: 'Procedures and facility', investigation: 'Investigations', room: 'Room, ICU and nursing', professional_fee: 'Professional fees', consumable: 'Consumables', other: 'Other' };
const STAGE_LABEL = { pre_filing: 'Before filing', filed_awaiting: 'Filed, awaiting settlement', audited: 'To review', reviewed: 'Reviewed', drafted: 'Appeal drafted', approved: 'Approved', filed: 'Filed', decided: 'Decided' };

function toast(msg, isErr) {
  toastEl.textContent = msg;
  toastEl.className = 'toast show' + (isErr ? ' err' : '');
  clearTimeout(toast.t);
  toast.t = setTimeout(() => (toastEl.className = 'toast'), isErr ? 6000 : 2400);
}
async function api(method, url, body) {
  const res = await fetch(url, { method, headers: body ? { 'Content-Type': 'application/json' } : {}, body: body ? JSON.stringify(body) : undefined });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.error || `Request failed (${res.status})`);
  return data;
}
const guard = fn => async (...a) => { try { return await fn(...a); } catch (e) { toast(e.message, true); } };
const on = (id, fn) => { const el = document.getElementById(id); if (el) el.onclick = guard(fn); };

// hover tooltip for chart marks: any element with data-tip
document.addEventListener('mousemove', e => {
  const t = e.target.closest?.('[data-tip]');
  if (!t) return tipEl.classList.remove('show');
  tipEl.textContent = t.dataset.tip;
  tipEl.classList.add('show');
  const r = tipEl.getBoundingClientRect();
  tipEl.style.left = Math.min(window.innerWidth - r.width - 8, e.clientX + 12) + 'px';
  tipEl.style.top = Math.max(8, e.clientY - r.height - 10) + 'px';
});

function confBar(c) { return `<span class="conf" title="How sure the assessment is"><i style="--w:${Math.round((c || 0) * 100)}%"></i>${pct(c)} sure</span>`; }
function historyHint(d) {
  if (!d.history) return '';
  return `<span class="hint">Past appeals on this reason with this payer: ${d.history.won_lines} of ${d.history.decided_lines} won, ${pct(d.history.win_rate)} of value</span>`;
}

// ---------- charts ----------
function splitBar(parts, total) {
  const live = parts.filter(p => p.value > 0);
  return `<div class="split" role="img" aria-label="${h(live.map(p => `${p.name} ${inr(p.value)}`).join(', '))}">${live.map(p => `<span style="flex:${p.value};background:${p.color}" data-tip="${h(p.name)}: ${inr(p.value)} (${pct(p.value / total)})"></span>`).join('')}</div>
    <div class="legend">${parts.map(p => `<div><span class="sw" style="background:${p.color}"></span>${h(p.name)} <b>${inr(p.value)}</b><span class="faint">${pct(total ? p.value / total : 0)}</span></div>`).join('')}</div>`;
}
function barList(rows, max) {
  return `<div class="bars">${rows.map(r => `<div>${h(r.name)}</div>
    <div class="track" data-tip="${h(r.tip)}"><span style="width:${max ? (r.value / max) * 100 : 0}%;background:${r.color || 'var(--series-1)'}"></span>${r.inner != null ? `<span style="width:${max ? (r.inner / max) * 100 : 0}%;background:var(--series-1)"></span>` : ''}</div>
    <div class="val">${inr(r.value)}</div>`).join('')}</div>`;
}

// ---------- Overview ----------
async function overview() {
  const s = await api('GET', '/api/summary');
  shell(s);
  if (!s.claims) {
    view.innerHTML = `<div class="head"><div><h1>Overview</h1><p>${h(s.settings.hospital_name)}</p></div></div>
      <div class="card empty"><b>No settlement letters audited yet</b>Upload a batch of settlement letters to see what payers deducted and how much of it is worth contesting.<p><a class="btn" href="#claims">Go to Claims</a></p></div>`;
    return;
  }
  const sc = s.scorecard, a = s.actions;
  const lift = sc.settled_now != null && sc.settled_before != null ? sc.settled_now - sc.settled_before : 0;
  const todos = [
    a.prefiling_open && { n: a.prefiling_open, href: '#prefiling', t: `${a.prefiling_open === 1 ? 'Claim is' : 'Claims are'} waiting for the pre-filing check`, d: `${inr(a.prefiling_at_risk)} would be cut if filed as they are` },
    a.to_review_lines && { n: a.to_review_lines, href: '#queue', t: 'Deductions waiting for review', d: `${inr(a.to_review_amount)} possibly contestable` },
    a.ready_to_draft && { n: a.ready_to_draft, href: '#claims', t: `${a.ready_to_draft === 1 ? 'Claim is' : 'Claims are'} reviewed and ready for an appeal draft`, d: 'Open the claim and draft the letter' },
    a.drafts_to_approve && { n: a.drafts_to_approve, href: '#claims', t: `Appeal ${a.drafts_to_approve === 1 ? 'draft needs' : 'drafts need'} editing and approval`, d: 'Fill the bracketed placeholders first' },
    a.approved_to_file && { n: a.approved_to_file, href: '#claims', t: `Approved ${a.approved_to_file === 1 ? 'appeal' : 'appeals'} to file with the payer`, d: 'File on the payer portal, then mark as filed' },
    a.follow_up_due && { n: a.follow_up_due, href: '#claims', t: `Filed ${a.follow_up_due === 1 ? 'appeal has' : 'appeals have'} had no decision for ${a.follow_up_days}+ days`, d: 'Follow up with the payer', urgent: true },
    a.awaiting_decision && { n: a.awaiting_decision, href: '#claims', t: `${a.awaiting_decision === 1 ? 'Appeal' : 'Appeals'} awaiting a payer decision`, d: `${inr(s.awaiting_outcome)} outstanding` }
  ].filter(Boolean);
  const funnelMax = Math.max(s.assessed_recoverable, s.contested, 1);
  const catMax = Math.max(...s.by_category.map(c => c.amount), 1);
  view.innerHTML = `
    <div class="head"><div><h1>Overview</h1><p>${h(s.settings.hospital_name)} · ${plural(s.claims, 'claim')} audited · ${inr(s.claimed)} claimed</p></div>
      <div class="row"><a class="btn" href="#report">Audit report</a><a class="btn" href="/api/export.csv">Export CSV</a></div></div>

    <div class="grid g3" style="margin-bottom:16px">
      <div class="card stat hero"><div class="k">Share of claimed value settled</div>
        <div class="v">${pct1(sc.settled_now)}${lift > 0.0005 ? `<span class="delta">+${(lift * 100).toFixed(1)} pts</span>` : ''}</div>
        <div class="n">${pct1(sc.settled_before)} before any appeals</div></div>
      <div class="card stat"><div class="k">Days from discharge to payment</div>
        <div class="v">${sc.avg_days_to_payment ?? '–'}</div><div class="n">${sc.claims_with_dates ? `Average over ${plural(sc.claims_with_dates, 'claim')} with both dates` : 'No letters carried both dates'}</div></div>
      <div class="card stat"><div class="k">Contested deductions won back</div>
        <div class="v">${pct(sc.contested_won)}</div><div class="n">${s.decided ? `${inr(s.recovered)} of ${inr(s.decided)} decided` : 'No appeal decisions recorded yet'}</div></div>
    </div>

    <div class="grid g21" style="margin-bottom:16px">
      <div class="card"><div class="cardhead"><h2>What payers deducted: ${inr(s.deducted)}</h2><span class="muted small">${pct1(s.claimed ? s.deducted / s.claimed : 0)} of claimed value</span></div>
        ${splitBar([{ name: 'Assessed recoverable', value: s.assessed_recoverable, color: 'var(--series-1)' }, { name: 'Needs a reviewer', value: s.needs_review, color: 'var(--series-2)' }, { name: 'Valid cuts', value: s.not_recoverable, color: 'var(--series-neutral)' }], s.deducted)}</div>
      <div class="card"><h2>Next actions</h2>${todos.length ? todos.map(t => `<a class="todo ${t.urgent ? 'urgent' : ''}" href="${t.href}"><div class="n">${t.n}</div><div><b>${h(t.t)}</b><span>${h(t.d)}</span></div></a>`).join('') : '<p class="muted">Nothing waiting. Upload more letters to keep the audit going.</p>'}</div>
    </div>

    <div class="grid g2" style="margin-bottom:16px">
      <div class="card"><div class="cardhead"><h2>Recovery pipeline</h2><span class="muted small">Success fee earned: <b>${inr(s.success_fee)}</b> at ${h(s.settings.success_fee_percent)}%</span></div>
        ${barList([
          { name: 'Assessed recoverable', value: s.assessed_recoverable, tip: `Assessed recoverable: ${inr(s.assessed_recoverable)}` },
          { name: 'Contested (appeals filed)', value: s.contested, tip: `Contested: ${inr(s.contested)}` },
          { name: 'Decided by payer', value: s.decided, tip: `Decided: ${inr(s.decided)}` },
          { name: 'Won back', value: s.recovered, tip: `Won back: ${inr(s.recovered)}` }], funnelMax)}</div>
      <div class="card"><div class="cardhead"><h2>Deductions by reason</h2>
        <div class="legend small"><div><span class="sw" style="background:var(--series-1-soft)"></span>Deducted</div><div><span class="sw" style="background:var(--series-1)"></span>of which recoverable</div></div></div>
        ${barList(s.by_category.map(c => ({ name: c.category_label, value: c.amount, inner: c.assessed_recoverable, color: 'var(--series-1-soft)', tip: `${c.category_label}: ${inr(c.amount)} over ${plural(c.lines, 'line')}, ${inr(c.assessed_recoverable)} assessed recoverable` })), catMax)}</div>
    </div>

    <div class="card flush"><h2>By payer</h2><div class="scroll"><table>
      <tr><th>Payer</th><th class="num">Claims</th><th class="num">Deducted</th><th class="num">Assessed recoverable</th><th class="num">Won back</th></tr>
      ${s.by_payer.map(p => `<tr><td><b>${h(p.payer)}</b></td><td class="num">${p.claims}</td><td class="num">${inr(p.deducted)}</td><td class="num">${inr(p.assessed_recoverable)}</td><td class="num">${inr(p.recovered)}</td></tr>`).join('')}
    </table></div></div>`;
}

// ---------- Review queue ----------
const qState = { payer: '', verdict: '', picked: new Set() };
async function queue() {
  const all = (await api('GET', '/api/deductions')).filter(d => d.review_status === 'pending');
  const payers = [...new Set(all.map(d => d.payer || 'Unknown payer'))].sort();
  const rows = all.filter(d => (!qState.payer || (d.payer || 'Unknown payer') === qState.payer) && (!qState.verdict || d.verdict === qState.verdict));
  qState.picked = new Set([...qState.picked].filter(id => rows.some(r => r.id === id)));
  const total = rows.reduce((s, d) => s + d.amount, 0);
  view.innerHTML = `
    <div class="head"><div><h1>Review queue</h1><p>${plural(rows.length, 'deduction')} waiting, ${inr(total)} in total. Sorted by expected recovery, so reviewer time goes where the money is.</p></div>
      <div class="row"><select id="qPayer" aria-label="Filter by payer"><option value="">All payers</option>${payers.map(p => `<option ${p === qState.payer ? 'selected' : ''}>${h(p)}</option>`).join('')}</select>
        <select id="qVerdict" aria-label="Filter by assessment"><option value="">All assessments</option>${meta.verdicts.map(v => `<option value="${v}" ${v === qState.verdict ? 'selected' : ''}>${h(label(v))}</option>`).join('')}</select>
        <button class="primary" id="qConfirm" ${qState.picked.size ? '' : 'disabled'}>Confirm selected (${qState.picked.size})</button></div></div>
    <div class="card flush">${rows.length ? `<div class="scroll"><table>
      <tr><th><input type="checkbox" id="qAll" aria-label="Select all" ${rows.length && qState.picked.size === rows.length ? 'checked' : ''}></th><th>Deduction</th><th>Claim</th><th class="num">Amount</th><th class="num">Expected recovery</th><th>Assessment</th><th></th></tr>
      ${rows.map(d => `<tr>
        <td><input type="checkbox" data-pick="${d.id}" aria-label="Select ${h(d.line_item)}" ${qState.picked.has(d.id) ? 'checked' : ''}></td>
        <td><b>${h(d.line_item)}</b><div class="sub">“${h(d.stated_reason || 'No reason stated')}”</div><div class="sub">${h(d.category_label)}</div>${historyHint(d)}</td>
        <td><a href="#claim/${d.claim_id}">${h(d.claim_no || d.file_name)}</a><div class="sub">${h(d.payer || 'Unknown payer')}</div></td>
        <td class="num">${inr(d.amount)}</td>
        <td class="num"><b>${inr(d.expected_value)}</b><div class="sub">${d.finding ? `${inr(d.finding.excess)} over-deducted · ` : ''}${pct(d.win_probability)} chance, from ${d.win_basis === 'history' ? 'past results' : d.win_basis === 'rules' ? 'the rules check' : 'the assessment'}</div></td>
        <td>${pill(d.verdict)}<div style="margin-top:6px">${confBar(d.confidence)}</div></td>
        <td class="num"><button class="sm" data-one="${d.id}">Confirm</button> <a class="btn sm" href="#claim/${d.claim_id}">Open</a></td></tr>`).join('')}
      </table></div>` : `<div class="empty"><b>Queue is clear</b>Every deduction has been reviewed.</div>`}</div>
    <p class="faint small" style="margin-top:12px">Confirming accepts the assessment as it stands. To change a verdict, open the claim. Expected recovery is the amount times an estimated chance of winning: this payer's past results on this reason where they exist, otherwise the assessment's own confidence. Treat it as a way to rank work, not a forecast.</p>`;
  document.getElementById('qPayer').onchange = e => { qState.payer = e.target.value; queue(); };
  document.getElementById('qVerdict').onchange = e => { qState.verdict = e.target.value; queue(); };
  const all$ = document.getElementById('qAll');
  if (all$) all$.onchange = () => { qState.picked = new Set(all$.checked ? rows.map(r => r.id) : []); queue(); };
  view.querySelectorAll('[data-pick]').forEach(c => (c.onchange = () => { const id = Number(c.dataset.pick); c.checked ? qState.picked.add(id) : qState.picked.delete(id); queue(); }));
  const confirmIds = guard(async ids => { const r = await api('POST', '/api/deductions/confirm', { ids }); toast(`${plural(r.confirmed, 'line')} confirmed`); qState.picked.clear(); await queue(); refreshBadge(); });
  view.querySelectorAll('[data-one]').forEach(b => (b.onclick = () => confirmIds([Number(b.dataset.one)])));
  on('qConfirm', () => confirmIds([...qState.picked]));
}

// ---------- Claims ----------
const cState = { q: '', stage: '' };
async function claims() {
  const [list, s] = await Promise.all([api('GET', '/api/claims'), api('GET', '/api/summary')]);
  shell(s);
  const demo = s.mode === 'demo';
  view.innerHTML = `
    <div class="head"><div><h1>Claims</h1><p>Upload settlement letters, itemised bills and discharge summaries. Documents with the same claim number are linked automatically.</p></div>
      <button id="samples">Load sample documents</button></div>
    ${demo ? `<div class="banner"><div><b>Demo mode.</b> No Claude credentials are configured, so only text files in the sample layout can be read, using fixed rules. Set <code>ANTHROPIC_API_KEY</code> and restart to read real letters, PDFs and scans.</div></div>` : ''}
    <div id="drop" class="drop" style="margin-bottom:16px"><b>Drop settlement letters, bills and discharge summaries here</b> or <a href="#" id="pick">choose files</a>
      <div class="small faint" style="margin-top:4px">${demo ? 'Text files (.txt) in demo mode' : 'PDF, image or text'} · several at once is fine</div>
      <input id="file" type="file" multiple hidden accept="${demo ? '.txt,text/plain' : '.pdf,.png,.jpg,.jpeg,.webp,.txt'}"></div>
    <div class="card flush"><div class="cardhead" style="padding-bottom:4px"><h2>${plural(list.length, 'claim')}</h2>
      <div class="row"><input type="search" id="cq" placeholder="Search claim, payer or procedure" value="${h(cState.q)}" aria-label="Search claims">
        <select id="cs" aria-label="Filter by stage"><option value="">All stages</option>${STAGES.map(st => `<option value="${st}" ${st === cState.stage ? 'selected' : ''}>${STAGE_LABEL[st]}</option>`).join('')}</select></div></div>
      <div id="claimRows"></div></div>`;
  const draw = () => {
    const q = cState.q.toLowerCase();
    const rows = list.filter(c => (!cState.stage || c.stage === cState.stage) && (!q || [c.claim_no, c.payer, c.procedure_name, c.file_name].some(v => String(v || '').toLowerCase().includes(q))));
    document.getElementById('claimRows').innerHTML = rows.length ? `<div class="scroll"><table>
      <tr><th>Claim</th><th>Payer</th><th>Procedure</th><th class="num">Claimed</th><th class="num">Deducted</th><th class="num">Recoverable</th><th class="num">Won back</th><th>Stage</th></tr>
      ${rows.map(c => `<tr class="click" data-id="${c.id}">
        <td><a href="#claim/${c.id}"><b>${h(c.claim_no || c.file_name)}</b></a><div class="sub">${h(c.file_name)}</div></td>
        <td>${h(c.payer || '–')}</td><td>${h(c.procedure_name || '–')}</td>
        <td class="num">${inr(c.claimed_amount)}</td><td class="num">${inr(c.deducted)}</td><td class="num">${inr(c.assessed_recoverable)}</td><td class="num">${inr(c.recovered)}</td>
        <td>${pill(c.stage === 'pre_filing' ? 'pending' : c.stage === 'filed_awaiting' ? 'filed' : c.stage, STAGE_LABEL[c.stage])}<div class="sub">${['settlement', 'bill', 'summary'].filter(t => (c.doc_types || '').includes(t)).length} of 3 documents</div>${c.stage === 'audited' ? `<div class="sub">${c.pending_review} of ${c.deduction_count} to review</div>` : ''}${c.stage === 'filed' ? `<div class="sub">${c.days_since_filed} day${c.days_since_filed === 1 ? '' : 's'} since filing</div>` : ''}</td></tr>`).join('')}
      </table></div>` : `<div class="empty">${list.length ? 'No claims match the filter.' : '<b>No claims yet</b>Upload letters above, or load the sample set to try the flow.'}</div>`;
    view.querySelectorAll('tr.click').forEach(tr => (tr.onclick = () => (location.hash = '#claim/' + tr.dataset.id)));
  };
  draw();
  document.getElementById('cq').oninput = e => { cState.q = e.target.value; draw(); };
  document.getElementById('cs').onchange = e => { cState.stage = e.target.value; draw(); };
  const report = r => {
    const bad = r.results.filter(x => !x.ok);
    if (bad.length) toast(`${r.results.length - bad.length} read, ${bad.length} failed: ${bad[0].error}`, true);
    else toast(`${plural(r.results.length, 'document')} read`);
    claims();
  };
  const upload = guard(async files => {
    if (!files.length) return;
    toast(`Reading ${plural(files.length, 'file')}…`);
    const payload = await Promise.all([...files].map(async f => ({ name: f.name, type: f.type, dataBase64: await toBase64(f) })));
    report(await api('POST', '/api/claims/upload', { files: payload }));
  });
  const drop = document.getElementById('drop'), file = document.getElementById('file');
  document.getElementById('pick').onclick = e => { e.preventDefault(); file.click(); };
  file.onchange = e => upload(e.target.files);
  drop.ondragover = e => { e.preventDefault(); drop.classList.add('over'); };
  drop.ondragleave = () => drop.classList.remove('over');
  drop.ondrop = e => { e.preventDefault(); drop.classList.remove('over'); upload(e.dataTransfer.files); };
  on('samples', async () => { const r = await api('POST', '/api/samples/load'); const ok = r.results.filter(x => x.ok).length; toast(ok ? `${plural(ok, 'sample document')} loaded` : 'Samples are already loaded', !ok); claims(); refreshBadge(); });
}
function toBase64(file) {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result).split(',')[1] || '');
    r.onerror = () => reject(new Error('Could not read ' + file.name));
    r.readAsDataURL(file);
  });
}

// ---------- Claim detail ----------
async function claim(id, data) {
  const keepScroll = data ? window.scrollY : 0;
  const raw = data || await api('GET', '/api/claims/' + id);
  if (raw.claim.source === 'stub') return prefilingClaim(id, raw, keepScroll);
  const { claim: c, deductions, appeal, bill = [], bill_checks = [], facts = [], documents = [], pre_submission = [], has_payer_rules } = raw;
  const overDeducted = deductions.reduce((s, d) => s + (d.finding ? d.finding.excess : 0), 0);
  const have = t => documents.some(d => d.doc_type === t);
  const billTotal = bill.reduce((s, l) => s + l.amount, 0);
  const flagged = new Map(); bill_checks.forEach(f => flagged.set(f.line_id, f.kind));
  const billCats = Object.keys(CAT_LABEL).filter(k => bill.some(l => l.category === k));
  const total = deductions.reduce((s, d) => s + d.amount, 0);
  const filed = appeal && appeal.status === 'filed';
  const contestable = d => ['recoverable', 'partly_recoverable'].includes(d.verdict);
  const ready = deductions.filter(d => contestable(d) && d.review_status !== 'pending');
  const pending = deductions.filter(d => d.review_status === 'pending').length;
  const inAppeal = appeal ? deductions.filter(d => d.appeal_id === appeal.id) : [];
  const stage = filed ? (inAppeal.every(d => d.outcome) ? 'decided' : 'filed') : appeal ? (appeal.status === 'approved' ? 'approved' : 'drafted') : pending ? 'audited' : 'reviewed';
  const at = ['audited', 'reviewed', 'drafted', 'approved', 'filed', 'decided'].indexOf(stage);
  const placeholders = appeal ? [...new Set(appeal.body.match(/\[[^\]]+\]/g) || [])] : [];
  const won = deductions.reduce((s, d) => s + d.recovered_amount, 0);

  view.innerHTML = `
    <a class="crumb" href="#claims">← All claims</a>
    <div class="head"><div><h1>${h(c.claim_no || c.file_name)}</h1><p>${h(c.payer || 'Unknown payer')}${c.tpa ? ' · ' + h(c.tpa) : ''} · read by ${c.source === 'claude' ? 'Claude' : 'demo rules'} from ${h(c.file_name)}</p></div>
      <button class="ghost danger" id="del">Delete claim</button></div>
    <ol class="steps">${['Audited', 'Reviewed', 'Appeal drafted', 'Approved', 'Filed', 'Decided'].map((n, i) => `<li class="${i < at || stage === 'decided' ? 'done' : i === at ? 'now' : ''}">${n}</li>`).join('')}</ol>
    <div class="docs">${[['settlement', 'Settlement letter'], ['bill', 'Itemised bill'], ['summary', 'Discharge summary']].map(([t, n]) => `<span class="doc ${have(t) ? 'have' : ''}">${have(t) ? '✓' : '○'} ${n}${have(t) ? '' : ' not uploaded'}</span>`).join('')}</div>
    <div class="card facts" style="margin-bottom:16px">
      <div><span>Patient reference</span><b>${h(c.patient_ref || '–')}</b></div><div><span>Procedure</span><b>${h(c.procedure_name || '–')}</b></div>
      <div><span>Admission to discharge</span><b>${h(c.admission_date || '–')} → ${h(c.discharge_date || '–')}</b></div><div><span>Settled on</span><b>${h(c.settlement_date || '–')}</b></div>
      <div><span>Claimed</span><b>${inr(c.claimed_amount)}</b></div><div><span>Approved</span><b>${inr(c.approved_amount)}</b></div>
      <div><span>Deducted</span><b>${inr(total)}</b></div><div><span>Won back</span><b>${inr(won)}</b></div>
    </div>

    ${facts.length ? `<div class="card" style="margin-bottom:16px"><div class="cardhead"><h2>Clinical facts <span class="tag">${h(c.clinical_domain_label || 'General')}</span></h2><span class="muted small">${facts.length} properties read from the discharge summary · hover for the source text</span></div>
      <div class="factgrid">${facts.map(f => `<div class="fact" data-tip="Source: ${h(f.quote || 'not recorded')} · ${pct(f.confidence)} sure"><span>${h(f.label)}${f.grp !== 'core' ? ' ·' : ''}</span><b>${h(f.value)}</b></div>`).join('')}</div></div>` : ''}

    ${bill.length ? `<div class="card flush" style="margin-bottom:16px"><div class="cardhead"><h2>Itemised bill: ${inr(billTotal)}</h2><span class="muted small">${bill.length} lines · ${bill.filter(l => l.entity_id).length} matched to the catalogues</span></div>
      ${bill_checks.length ? `<div style="padding:0 20px 14px">${bill_checks.map(f => `<div class="flag"><b>${f.kind === 'duplicate' ? 'Possible duplicate' : f.kind === 'price' ? 'Price outlier' : 'Often non-payable'}</b><span>${h(f.text)}</span></div>`).join('')}</div>` : ''}
      <details><summary style="padding:0 20px 14px;cursor:pointer;color:var(--info)">Show all bill lines</summary><div class="scroll"><table>
      <tr><th>Line</th><th>Matched to</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
      ${billCats.map(k => { const ls = bill.filter(l => l.category === k); return `<tr class="grouphead"><td colspan="4">${CAT_LABEL[k]}</td><td class="num">${inr(ls.reduce((s, l) => s + l.amount, 0))}</td></tr>` + ls.map(l => `<tr><td>${h(l.description)}${flagged.has(l.id) ? ` <span class="pill pending">${flagged.get(l.id) === 'duplicate' ? 'Duplicate?' : flagged.get(l.id) === 'price' ? 'Price outlier' : 'Often non-payable'}</span>` : ''}</td><td>${l.canonical_name ? `${h(l.canonical_name)}<span class="tag">${h(l.entity_class)}</span>` : '<span class="faint">–</span>'}</td><td class="num">${l.quantity ?? '–'}</td><td class="num">${l.unit_price != null ? inr(l.unit_price) : '–'}</td><td class="num">${inr(l.amount)}</td></tr>`).join(''); }).join('')}
      </table></div></details></div>` : ''}

    ${pre_submission.length ? `<div class="card" style="margin-bottom:16px"><div class="cardhead"><h2>What the rules would flag before filing</h2><span class="muted small">Run on the bill and summary against this payer's terms</span></div>
      <table>${pre_submission.map(f => `<tr><td style="white-space:nowrap"><b>${h(f.kind)}</b></td><td>${h(f.text)}</td><td class="num">${f.amount != null ? inr(f.amount) : f.risk ? inr(f.risk) + ' at risk' : ''}</td></tr>`).join('')}</table>
      ${c.predicted_cut != null ? `<p class="muted small" style="margin:12px 0 0">When this claim was filed the pre-filing check predicted ${inr(c.predicted_cut)} of cuts. The payer cut ${inr(total)}.</p>` : ''}</div>` : ''}

    <div class="card" style="margin-bottom:16px"><div class="cardhead"><h2>Deductions (${deductions.length})</h2>
      <span class="muted small">${pending ? `${pending} still to review` : 'All reviewed'}${has_payer_rules ? ` · rules say ${inr(overDeducted)} was over-deducted` : ''}</span></div>
      ${deductions.map(d => `<div class="ded">
        <div>
          <div class="top"><h3>${h(d.line_item)}</h3><div class="amt">${inr(d.amount)}</div></div>
          <div class="quote">Payer: “${h(d.stated_reason || 'no reason stated')}”</div>
          <p class="why">${h(d.rationale)}</p>
          <div class="row">${pill(d.verdict)}<span class="faint small">${h(d.category_label)}</span>${confBar(d.confidence)}</div>
          ${historyHint(d)}
          ${d.finding ? `<div class="rulebox"><b>Rules check: ${h(d.finding.rule)}</b> ${pill(d.finding.verdict)}${d.finding.certain ? '' : ' <span class="faint small">needs a manual check</span>'}
            <div class="nums"><div><span>Payer cut</span><b>${inr(d.finding.payer_cut)}</b></div><div><span>Terms allow</span><b>${inr(d.finding.permitted_cut)}</b></div><div><span>Over-deducted</span><b style="color:${d.finding.excess ? 'var(--good)' : 'inherit'}">${inr(d.finding.excess)}</b></div></div>
            <div>${h(d.finding.explanation)}</div>
            ${!filed && d.review_status === 'pending' ? `<div style="margin-top:8px"><button class="sm" data-set="${d.id}" data-v="${d.finding.verdict}">Use this verdict</button></div>` : ''}</div>` : has_payer_rules ? '<div class="rel faint">No rule on file covers this cut.</div>' : ''}
          ${d.related ? `<div class="rel">On the bill: ${plural(d.related.count, 'related line')} worth <b>${inr(d.related.billed)}</b>, so this cut is ${pct(d.amount / d.related.billed)} of what was billed${d.related.basis === 'category' ? ' in that category' : ''}.</div>` : ''}
        </div>
        <div class="side2">
          <p class="lab">Reviewer verdict ${d.review_status !== 'pending' ? `<span class="faint">· ${h(d.review_status)}</span>` : ''}</p>
          <div class="seg" role="group" aria-label="Verdict for ${h(d.line_item)}">${[['recoverable', 'Recover'], ['partly_recoverable', 'Partly'], ['needs_review', 'Unsure'], ['not_recoverable', 'Valid cut']].map(([v, t]) => `<button data-set="${d.id}" data-v="${v}" class="${d.review_status !== 'pending' && d.verdict === v ? 'on' : ''}" ${filed ? 'disabled' : ''} title="${h(label(v))}">${t}</button>`).join('')}</div>
          ${d.review_status === 'pending' && !filed ? `<div><button class="sm primary" data-set="${d.id}" data-v="${d.verdict}">Confirm “${h(label(d.verdict))}”</button></div>` : ''}
          ${d.evidence_needed.length && contestable(d) ? `<p class="lab" style="margin-top:12px">Evidence to attach (${d.evidence_done.length} of ${d.evidence_needed.length})</p>
            <ul class="checks">${d.evidence_needed.map(e => `<li><label><input type="checkbox" data-ev="${d.id}" value="${h(e)}" ${d.evidence_done.includes(e) ? 'checked' : ''}>${h(e)}</label></li>`).join('')}</ul>` : ''}
          ${filed && d.appeal_id === appeal.id ? `<p class="lab" style="margin-top:12px">Payer decision</p>
            <select data-outcome="${d.id}" aria-label="Outcome for ${h(d.line_item)}"><option value="">Awaiting decision</option>${meta.outcomes.map(o => `<option value="${o}" ${o === d.outcome ? 'selected' : ''}>${h(label(o))}</option>`).join('')}</select>
            ${d.outcome ? `<div class="sub">Won back ${inr(d.recovered_amount)}</div>` : ''}` : ''}
        </div></div>`).join('')}
    </div>

    <div class="card"><div class="cardhead"><h2>Appeal letter ${appeal ? pill(appeal.status) : ''}${filed && appeal.days_since_filed != null ? ` <span class="faint small" style="font-weight:400">filed ${appeal.days_since_filed} day${appeal.days_since_filed === 1 ? '' : 's'} ago</span>` : ''}</h2>
      <div class="row">${!filed ? `<button id="draft" ${ready.length ? '' : 'disabled'}>${appeal ? 'Redraft' : 'Draft appeal'}</button>` : ''}
        ${appeal ? `<button id="copy">Copy</button>` : ''}
        ${appeal && appeal.status === 'draft' ? `<button id="save">Save edits</button><button class="primary" id="approve">Approve</button>` : ''}
        ${appeal && appeal.status === 'approved' ? `<button id="reopen">Back to draft</button><button class="primary" id="filed">Mark as filed</button>` : ''}</div></div>
      ${appeal ? `<p class="muted small" style="margin-top:0">Covers ${plural(inAppeal.length, 'deduction')} worth ${inr(inAppeal.reduce((s, d) => s + d.amount, 0))}. Drafted by ${appeal.source === 'claude' ? 'Claude' : 'template'}. This tool does not send the letter: file it on the payer's portal, then mark it as filed.</p>
        ${appeal.status === 'draft' ? `<div id="ph"></div>` : ''}
        <textarea class="letter" id="body" ${appeal.status !== 'draft' ? 'readonly' : ''} aria-label="Appeal letter">${h(appeal.body)}</textarea>`
      : `<p class="muted" style="margin:0">${ready.length ? `${plural(ready.length, 'reviewed line')} worth ${inr(ready.reduce((s, d) => s + d.amount, 0))} can go into an appeal.` : 'Review the deductions above. Lines confirmed as recoverable go into the appeal.'}</p>`}</div>`;

  if (keepScroll) window.scrollTo(0, keepScroll);
  const refresh = d => d && claim(id, d);
  view.querySelectorAll('[data-set]').forEach(b => (b.onclick = guard(async () => { refresh(await api('PATCH', '/api/deductions/' + b.dataset.set, { verdict: b.dataset.v })); refreshBadge(); })));
  view.querySelectorAll('[data-ev]').forEach(cb => (cb.onchange = guard(async () => {
    const done = [...view.querySelectorAll(`[data-ev="${cb.dataset.ev}"]:checked`)].map(x => x.value);
    refresh(await api('PATCH', '/api/deductions/' + cb.dataset.ev, { evidence_done: done }));
  })));
  view.querySelectorAll('[data-outcome]').forEach(sel => (sel.onchange = guard(async () => {
    const d = deductions.find(x => x.id === Number(sel.dataset.outcome));
    const body = { outcome: sel.value || null };
    if (sel.value === 'partly_won') {
      const v = prompt(`Amount won back of ${inr(d.amount)} (rupees):`);
      if (v === null) return claim(id);
      body.recovered_amount = Number(v);
    }
    refresh(await api('PATCH', '/api/deductions/' + d.id, body)); toast('Outcome recorded');
  })));
  const bodyEl = document.getElementById('body');
  const drawPh = () => {
    const el = document.getElementById('ph'); if (!el) return;
    const left = [...new Set(bodyEl.value.match(/\[[^\]]+\]/g) || [])];
    el.innerHTML = left.length ? `<div class="small" style="font-weight:600">${plural(left.length, 'placeholder')} still to fill before approving:</div><div class="chips">${left.map(p => `<span class="chip">${h(p)}</span>`).join('')}</div>` : `<div class="small" style="color:var(--good);font-weight:600;margin-bottom:10px">✓ No placeholders left. Ready to approve.</div>`;
  };
  if (bodyEl) { drawPh(); bodyEl.oninput = drawPh; }
  on('draft', async () => { toast('Drafting…'); refresh(await api('POST', `/api/claims/${id}/appeal`)); toast('Draft ready'); });
  on('copy', async () => { await navigator.clipboard.writeText(bodyEl.value); toast('Letter copied'); });
  on('save', async () => { refresh(await api('PUT', '/api/appeals/' + appeal.id, { body: bodyEl.value })); toast('Saved'); });
  on('approve', async () => { refresh(await api('PUT', '/api/appeals/' + appeal.id, { body: bodyEl.value, status: 'approved' })); toast('Approved'); });
  on('reopen', async () => refresh(await api('PUT', '/api/appeals/' + appeal.id, { status: 'draft' })));
  on('filed', async () => { if (confirm('Mark this appeal as filed with the payer? It cannot be edited afterwards.')) { refresh(await api('PUT', '/api/appeals/' + appeal.id, { status: 'filed' })); toast('Marked as filed'); } });
  on('del', async () => { if (confirm('Delete this claim and its deductions?')) { await api('DELETE', '/api/claims/' + id); location.hash = '#claims'; } });
}

// ---------- Knowledge ----------
async function knowledge() {
  const rows = await api('GET', '/api/knowledge');
  view.innerHTML = `<div class="head"><div><h1>Denial knowledge</h1><p>What each payer deducts, for which reason, and how often contesting it works. It fills in as claims are audited and outcomes recorded.</p></div></div>
    <div class="card flush">${rows.length ? `<div class="scroll"><table>
      <tr><th>Payer</th><th>Reason</th><th class="num">Lines</th><th class="num">Deducted</th><th class="num">Appeals decided</th><th class="num">Won back</th><th>Win rate by value</th></tr>
      ${rows.map(r => `<tr><td><b>${h(r.payer)}</b></td><td>${h(r.category_label)}</td><td class="num">${r.lines}</td><td class="num">${inr(r.amount)}</td>
        <td class="num">${r.decided_lines ? `${r.won_lines} of ${r.decided_lines} won` : '<span class="faint">none yet</span>'}</td><td class="num">${inr(r.recovered)}</td>
        <td>${r.win_rate == null ? '<span class="faint">–</span>' : `<div class="row" style="gap:8px;flex-wrap:nowrap"><div style="width:90px;height:8px;background:var(--line);border-radius:4px;overflow:hidden" data-tip="${pct(r.win_rate)} of decided value won back"><div style="width:${r.win_rate * 100}%;height:100%;background:var(--series-1)"></div></div><b class="num">${pct(r.win_rate)}</b></div>`}</td></tr>`).join('')}
      </table></div>` : `<div class="empty"><b>Nothing recorded yet</b>Audit some letters to start building the record.</div>`}</div>`;
}

// ---------- Printable audit report ----------
async function report() {
  const [s, all] = await Promise.all([api('GET', '/api/summary'), api('GET', '/api/deductions')]);
  if (!s.claims) { view.innerHTML = `<div class="head"><div><h1>Audit report</h1></div></div><div class="card empty"><b>Nothing to report yet</b>Audit some settlement letters first.</div>`; return; }
  const top = all.filter(d => ['recoverable', 'partly_recoverable'].includes(d.verdict)).slice(0, 10);
  const today = new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' });
  view.innerHTML = `<div class="report">
    <div class="head noprint"><div><h1>Audit report</h1><p>A summary to hand to the hospital. Print it or save it as a PDF.</p></div><button class="primary" id="print">Print or save as PDF</button></div>
    <div class="card" style="padding:34px 38px">
      <div class="faint small">Deduction and denial audit · ${today}</div>
      <h1 style="margin-top:6px">${h(s.settings.hospital_name)}</h1>
      <p class="muted" style="margin:6px 0 0">${plural(s.claims, 'cashless claim')} reviewed, with ${inr(s.claimed)} claimed and ${inr(s.approved)} approved by payers.</p>
      <section><div class="big">
        <div class="stat"><div class="k">Deducted by payers</div><div class="v">${inr(s.deducted)}</div><div class="n">${pct1(s.claimed ? s.deducted / s.claimed : 0)} of claimed value</div></div>
        <div class="stat"><div class="k">Assessed as recoverable</div><div class="v">${inr(s.assessed_recoverable)}</div><div class="n">${pct(s.deducted ? s.assessed_recoverable / s.deducted : 0)} of deductions</div></div>
        <div class="stat"><div class="k">Needs a closer look</div><div class="v">${inr(s.needs_review)}</div><div class="n">Depends on policy or tariff</div></div></div></section>
      <section><h2>Where the deductions fall</h2>${splitBar([{ name: 'Assessed recoverable', value: s.assessed_recoverable, color: 'var(--series-1)' }, { name: 'Needs a reviewer', value: s.needs_review, color: 'var(--series-2)' }, { name: 'Valid cuts', value: s.not_recoverable, color: 'var(--series-neutral)' }], s.deducted)}</section>
      <section><h2>By reason</h2><table><tr><th>Reason</th><th class="num">Lines</th><th class="num">Deducted</th><th class="num">Assessed recoverable</th></tr>
        ${s.by_category.map(c => `<tr><td>${h(c.category_label)}</td><td class="num">${c.lines}</td><td class="num">${inr(c.amount)}</td><td class="num">${inr(c.assessed_recoverable)}</td></tr>`).join('')}</table></section>
      <section><h2>By payer</h2><table><tr><th>Payer</th><th class="num">Claims</th><th class="num">Deducted</th><th class="num">Assessed recoverable</th><th class="num">Won back so far</th></tr>
        ${s.by_payer.map(p => `<tr><td>${h(p.payer)}</td><td class="num">${p.claims}</td><td class="num">${inr(p.deducted)}</td><td class="num">${inr(p.assessed_recoverable)}</td><td class="num">${inr(p.recovered)}</td></tr>`).join('')}</table></section>
      <section><h2>Largest recoverable lines</h2>${top.length ? `<table><tr><th>Claim</th><th>Line and payer's reason</th><th class="num">Amount</th><th>Status</th></tr>
        ${top.map(d => `<tr><td>${h(d.claim_no || d.file_name)}<div class="sub">${h(d.payer || '')}</div></td><td>${h(d.line_item)}<div class="sub">${h(d.stated_reason || '')}</div></td><td class="num">${inr(d.amount)}</td><td>${d.outcome ? label(d.outcome) : d.appeal_status === 'filed' ? 'Appeal filed' : d.review_status === 'pending' ? 'To review' : 'Reviewed'}</td></tr>`).join('')}</table>` : '<p class="muted">No lines assessed as recoverable.</p>'}</section>
      <section><h2>Recovery so far</h2><p style="margin:0">${s.contested ? `${inr(s.contested)} has been contested. ${s.decided ? `Payers have decided on ${inr(s.decided)} of it and ${inr(s.recovered)} was won back (${pct(s.win_rate)} by value).` : 'No decisions have come back yet.'} The success fee on amounts won back, at ${h(s.settings.success_fee_percent)}%, is ${inr(s.success_fee)}.` : 'No appeals have been filed yet.'}</p></section>
      <section><h2>How to read this</h2><p class="muted small" style="margin:0">“Assessed as recoverable” is an initial assessment from the payer's stated reason, ${s.lines_pending_review ? `and ${plural(s.lines_pending_review, 'line')} still awaits a reviewer. ` : 'confirmed by a reviewer. '}It is not a promise of recovery: the outcome depends on the policy wording, the agreed tariff and the evidence the hospital can supply. “Valid cuts” are the patient's share, policy limits and listed exclusions.</p></section>
    </div></div>`;
  on('print', () => window.print());
}

// ---------- Log and settings ----------
async function log() {
  const rows = await api('GET', '/api/audit');
  view.innerHTML = `<div class="head"><div><h1>Activity log</h1><p>Every reading, review decision and letter change, most recent first.</p></div></div>
    <div class="card flush">${rows.length ? `<div class="scroll"><table><tr><th>When</th><th>Who</th><th>Action</th><th>Detail</th></tr>
      ${rows.map(r => `<tr><td class="small" style="white-space:nowrap">${h(new Date(r.ts).toLocaleString())}</td><td>${h(r.actor)}</td><td>${h(label(r.action))} ${h(r.entity)}${r.entity_id ? ' #' + r.entity_id : ''}</td><td class="muted">${h(r.detail || '')}</td></tr>`).join('')}
      </table></div>` : `<div class="empty">No activity yet.</div>`}</div>`;
}
async function settings() {
  const s = (await api('GET', '/api/summary')).settings;
  view.innerHTML = `<div class="head"><div><h1>Settings</h1><p>Used in appeal letters, the activity log and the fee calculation.</p></div></div>
    <div class="card stack" style="max-width:520px">
      <div><label class="f" for="hn">Hospital name</label><input type="text" id="hn" value="${h(s.hospital_name)}" style="width:100%"></div>
      <div><label class="f" for="rn">Reviewer name</label><input type="text" id="rn" value="${h(s.reviewer_name)}" style="width:100%"></div>
      <div><label class="f" for="fee">Success fee (% of amount won back)</label><input type="number" id="fee" min="0" max="100" step="0.5" value="${h(s.success_fee_percent)}"></div>
      <div><button class="primary" id="saveSettings">Save</button></div></div>`;
  on('saveSettings', async () => {
    await api('PUT', '/api/settings', { hospital_name: document.getElementById('hn').value, reviewer_name: document.getElementById('rn').value, success_fee_percent: document.getElementById('fee').value });
    toast('Settings saved');
  });
}

// ---------- Shell ----------
function shell(s) {
  const el = document.getElementById('mode');
  el.innerHTML = s.mode === 'claude' ? '<b>Claude reading on</b>PDFs, scans and text' : '<b>Demo mode</b>Sample text files only';
  document.getElementById('navQueue').textContent = s.actions?.to_review_lines || '';
  document.getElementById('navPre').textContent = s.actions?.prefiling_open || '';
}
const refreshBadge = () => api('GET', '/api/summary').then(shell).catch(() => {});

// ---------- Price analytics ----------
async function prices() {
  const p = await api('GET', '/api/prices');
  if (!p.bill_lines) { view.innerHTML = `<div class="head"><div><h1>Price analytics</h1></div></div><div class="card empty"><b>No itemised bills yet</b>Upload itemised bills on the Claims screen. Prices are compared once bills are read.</div>`; return; }
  const table = (type, title, note) => {
    const rows = p.entities.filter(e => e.entity_type === type && (type !== 'procedure' || e.claims > 1));
    if (!rows.length) return '';
    return `<div class="card flush" style="margin-bottom:16px"><div class="cardhead"><h2>${title}</h2><span class="muted small">${note}</span></div><div class="scroll"><table>
      <tr><th>Item</th><th class="num">Claims</th><th class="num">Qty</th><th class="num">Lowest</th><th class="num">Highest</th><th>Unit prices billed</th><th class="num">Spread</th></tr>
      ${rows.map(e => `<tr><td><b>${h(e.name)}</b><span class="tag">${h(e.entity_class)}</span></td><td class="num">${e.claims}</td><td class="num">${e.quantity}</td><td class="num">${inr(e.min)}</td><td class="num">${inr(e.max)}</td>
        <td><div class="range">${e.points.map(pt => `<i style="left:${e.max > e.min ? ((pt.unit_price - e.min) / (e.max - e.min)) * 100 : 50}%" data-tip="${inr(pt.unit_price)} a unit, billed to ${h(pt.payer)}"></i>`).join('')}</div></td>
        <td class="num">${e.claims > 1 ? (e.spread > 0.2 ? `<span class="pill pending">+${pct(e.spread)}</span>` : '+' + pct(e.spread)) : '<span class="faint">one claim</span>'}</td></tr>`).join('')}
      </table></div></div>`;
  };
  view.innerHTML = `<div class="head"><div><h1>Price analytics</h1><p>${plural(p.bills, 'bill')} and ${plural(p.bill_lines, 'line')} read. What the hospital bills for each item, and how much of each kind of charge payers cut.</p></div></div>
    <div class="card flush" style="margin-bottom:16px"><div class="cardhead"><h2>Billed against cut, by payer and charge type</h2><span class="muted small">${p.unlinked_cut ? `${inr(p.unlinked_cut)} of cuts are policy-level (co-pay, limits) and tie to no bill line` : ''}</span></div><div class="scroll"><table>
      <tr><th>Payer</th><th>Charge type</th><th class="num">Billed</th><th class="num">Cut</th><th>Share cut</th></tr>
      ${p.categories.map(c => `<tr><td><b>${h(c.payer)}</b></td><td>${h(CAT_LABEL[c.category] || c.category)}</td><td class="num">${inr(c.billed)}</td><td class="num">${inr(c.cut)}</td>
        <td><div class="row" style="gap:8px;flex-wrap:nowrap"><div style="width:120px;height:8px;background:var(--line);border-radius:4px;overflow:hidden" data-tip="${inr(c.cut)} cut of ${inr(c.billed)} billed"><div style="width:${Math.min(100, c.cut_rate * 100)}%;height:100%;background:var(--series-1)"></div></div><b class="num">${pct(c.cut_rate)}</b></div></td></tr>`).join('')}
    </table></div></div>
    ${table('drug', 'Drugs', 'Same generic, different unit prices across bills')}
    ${table('device', 'Devices and implants', 'Unit price per device type')}
    ${table('procedure', 'Procedures and services', 'Only items billed on more than one claim')}
    <div class="card flush"><h2>Approval rate by procedure</h2><div class="scroll"><table>
      <tr><th>Procedure</th><th>Payer</th><th class="num">Claims</th><th class="num">Claimed</th><th class="num">Approved</th><th class="num">Approved share</th></tr>
      ${p.procedures.map(r => `<tr><td><b>${h(r.procedure_name)}</b></td><td>${h(r.payer)}</td><td class="num">${r.claims}</td><td class="num">${inr(r.claimed)}</td><td class="num">${inr(r.approved)}</td><td class="num">${pct(r.approval_rate)}</td></tr>`).join('')}
    </table></div></div>
    <p class="faint small" style="margin-top:12px">Cuts are tied to bill lines by matching wording, then by charge type, so the link is approximate. A wide price spread can be legitimate (different strengths, brands or contracts) and is a prompt to check, not a finding.</p>`;
}

// ---------- Pre-filing check ----------
const ACTION = { collect: ['Collect from the patient', 'Patient billed'], fix: ['Correct the bill', 'Bill corrected'], attach: ['Attach to the claim file', 'Attached'] };

async function prefiling() {
  const list = await api('GET', '/api/prefiling');
  const open = list.filter(c => !c.submitted_at), filed = list.filter(c => c.submitted_at);
  const t = open.reduce((a, c) => ({ billed: a.billed + c.billed, risk: a.risk + c.at_risk, patient: a.patient + c.patient_share, fix: a.fix + c.bill_corrections }), { billed: 0, risk: 0, patient: 0, fix: 0 });
  const row = c => `<tr class="click" data-id="${c.id}"><td><a href="#claim/${c.id}"><b>${h(c.claim_no)}</b></a><div class="sub">${h(c.procedure_name || 'Procedure not read yet')}</div></td>
    <td>${h(c.payer || 'Payer not set')}${c.payer && !c.has_rules ? ' <span class="pill pending">no rule file</span>' : ''}<div class="sub">${c.has_bill ? 'Bill' : 'No bill'} · ${c.has_summary ? 'summary' : 'no summary'}</div></td>
    <td class="num">${inr(c.billed)}</td><td class="num">${inr(c.expected_from_payer)}</td><td class="num">${inr(c.patient_share)}</td>
    <td class="num"><b>${inr(c.submitted_at ? c.predicted_cut : c.at_risk)}</b></td>
    <td>${c.submitted_at ? pill('filed', 'Filed') : c.ready ? pill('recoverable', 'Ready to file') : `<div class="row" style="gap:8px;flex-wrap:nowrap"><div class="meter"><i style="width:${c.total ? ((c.total - c.open) / c.total) * 100 : 0}%"></i></div><span class="small">${c.total - c.open} of ${c.total}</span></div>`}</td></tr>`;
  view.innerHTML = `<div class="head"><div><h1>Pre-filing check</h1><p>Claims not yet sent to the payer. Each bill is checked against the payer's terms so cuts are fixed before filing, not appealed afterwards.</p></div><a class="btn" href="#claims">Upload a bill</a></div>
    ${open.length ? `<div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><div class="k">Billed, not yet filed</div><div class="v">${inr(t.billed)}</div><div class="n">${plural(open.length, 'claim')}</div></div>
      <div class="card stat hero"><div class="k">Would be cut if filed now</div><div class="v">${inr(t.risk)}</div><div class="n">${pct(t.billed ? t.risk / t.billed : 0)} of the amount billed</div></div>
      <div class="card stat"><div class="k">Belongs on patients' bills</div><div class="v">${inr(t.patient)}</div><div class="n">Co-pay, caps, non-payable items</div></div>
      <div class="card stat"><div class="k">Billing errors to correct</div><div class="v">${inr(t.fix)}</div><div class="n">Duplicates, above agreed rate</div></div></div>` : ''}
    <div class="card flush" style="margin-bottom:16px"><h2>To check before filing</h2>${open.length ? `<div class="scroll"><table>
      <tr><th>Claim</th><th>Payer</th><th class="num">Billed</th><th class="num">Expected from payer</th><th class="num">Patient share</th><th class="num">At risk now</th><th>Checklist</th></tr>${open.map(row).join('')}</table></div>`
      : `<div class="empty"><b>Nothing waiting</b>Upload an itemised bill and discharge summary for a claim that has not been settled, and it appears here.</div>`}</div>
    ${filed.length ? `<div class="card flush"><h2>Filed, awaiting settlement</h2><div class="scroll"><table>
      <tr><th>Claim</th><th>Payer</th><th class="num">Billed</th><th class="num">Expected from payer</th><th class="num">Patient share</th><th class="num">Predicted cut</th><th>Status</th></tr>${filed.map(row).join('')}</table></div></div>` : ''}
    <p class="faint small" style="margin-top:12px">Predictions come from the payer rule files, which are synthetic in this demo. When the settlement letter for a filed claim is uploaded, the claim page compares the predicted cut with the actual one.</p>`;
  view.querySelectorAll('tr.click').forEach(tr => (tr.onclick = () => (location.hash = '#claim/' + tr.dataset.id)));
}

function prefilingClaim(id, raw, keepScroll) {
  const { claim: c, bill = [], facts = [], documents = [], prefiling: p, has_payer_rules, payer_options = [] } = raw;
  const have = t => documents.some(d => d.doc_type === t);
  const filed = Boolean(c.submitted_at);
  const options = [...new Set([c.payer, ...payer_options].filter(Boolean))];
  const group = action => { const fs = p.flags.filter(f => f.action === action); return fs.length ? `<div class="grouplab">${ACTION[action][0]}</div>` + fs.map(f => `<label class="checkrow ${f.done ? 'done' : ''}">
      <input type="checkbox" data-flag="${h(f.key)}" ${f.done ? 'checked' : ''} ${filed ? 'disabled' : ''} aria-label="${h(f.kind)}">
      <div><b>${h(f.kind)}</b><div class="t">${h(f.text)}</div></div>
      <div class="a">${inr(f.amount ?? f.risk ?? 0)}<span>${f.done ? ACTION[action][1] : f.amount != null ? 'will be cut' : 'at risk'}</span></div></label>`).join('') : ''; };
  view.innerHTML = `
    <a class="crumb" href="#prefiling">← Pre-filing check</a>
    <div class="head"><div><h1>${h(c.claim_no || c.file_name)}</h1><p>${filed ? `Filed on ${h(new Date(c.submitted_at).toLocaleDateString())}. Upload the settlement letter when it arrives.` : 'Not yet filed with the payer.'} ${h(c.procedure_name || '')}</p></div>
      <div class="row"><label class="small muted" for="payerSel">Payer</label><select id="payerSel" ${filed ? 'disabled' : ''}>${c.payer ? '' : '<option value="">Choose a payer</option>'}${options.map(o => `<option ${o === c.payer ? 'selected' : ''}>${h(o)}</option>`).join('')}</select>
        <button class="ghost danger" id="del">Delete</button></div></div>
    <div class="docs">${[['bill', 'Itemised bill'], ['summary', 'Discharge summary']].map(([t, n]) => `<span class="doc ${have(t) ? 'have' : ''}">${have(t) ? '✓' : '○'} ${n}${have(t) ? '' : ' not uploaded'}</span>`).join('')}${facts.length ? `<span class="doc">${facts.length} clinical facts read · ${h(c.clinical_domain_label || 'General')}</span>` : ''}</div>
    ${!bill.length ? '<div class="card empty"><b>No itemised bill yet</b>Upload the bill for this claim on the Claims screen to run the check.</div>' : !has_payer_rules ? `<div class="banner"><div><b>${c.payer ? 'No rule file for this payer.' : 'Choose the payer.'}</b> The check needs the payer's terms. Pick a payer above, or add a file to <code>rules/payers/</code>.</div></div>` : `
    <div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><div class="k">Billed</div><div class="v">${inr(p.billed)}</div></div>
      <div class="card stat"><div class="k">Expected from the payer</div><div class="v">${inr(p.expected_from_payer)}</div><div class="n">After corrections and patient share</div></div>
      <div class="card stat"><div class="k">Collect from the patient</div><div class="v">${inr(p.patient_share)}</div></div>
      <div class="card stat hero"><div class="k">${filed ? 'Predicted cut at filing' : 'Would be cut if filed now'}</div><div class="v">${inr(filed ? c.predicted_cut : p.at_risk)}</div><div class="n">${filed ? 'Frozen when marked as filed' : `${p.open} of ${p.total} items still open`}</div></div></div>
    <div class="card"><div class="cardhead"><h2>Checklist before filing</h2>
      <div class="row">${p.total ? `<div class="meter" style="width:140px"><i style="width:${((p.total - p.open) / p.total) * 100}%"></i></div><span class="small muted">${p.total - p.open} of ${p.total} done</span>` : ''}
        ${filed ? pill('filed', 'Filed') : `<button class="primary" id="submit">${p.ready ? 'Mark as filed' : 'File anyway'}</button>`}</div></div>
      ${p.total ? group('fix') + group('collect') + group('attach') : '<p class="muted" style="margin:0">The rules found nothing to fix on this bill.</p>'}</div>`}
    ${bill.length ? `<div class="card flush" style="margin-top:16px"><details><summary style="padding:16px 20px;cursor:pointer;font-weight:650">Itemised bill: ${inr(p.billed)} · ${bill.length} lines</summary><div class="scroll"><table>
      <tr><th>Line</th><th>Type</th><th class="num">Qty</th><th class="num">Unit price</th><th class="num">Amount</th></tr>
      ${bill.map(l => `<tr><td>${h(l.description)}${l.canonical_name ? `<span class="tag">${h(l.canonical_name)}</span>` : ''}</td><td>${h(CAT_LABEL[l.category] || l.category)}</td><td class="num">${l.quantity ?? '–'}</td><td class="num">${l.unit_price != null ? inr(l.unit_price) : '–'}</td><td class="num">${inr(l.amount)}</td></tr>`).join('')}</table></div></details></div>` : ''}`;
  if (keepScroll) window.scrollTo(0, keepScroll);
  const refresh = d => { if (d) { claim(id, d); refreshBadge(); } };
  view.querySelectorAll('[data-flag]').forEach(cb => (cb.onchange = guard(async () => refresh(await api('POST', `/api/claims/${id}/prefiling`, { key: cb.dataset.flag, done: cb.checked })))));
  document.getElementById('payerSel').onchange = guard(async e => { if (e.target.value) refresh(await api('PATCH', '/api/claims/' + id, { payer: e.target.value })); });
  on('submit', async () => { if (confirm(p.ready ? 'Mark this claim as filed with the payer?' : `${plural(p.open, 'item')} still open, worth ${inr(p.at_risk)}. Mark as filed anyway?`)) { refresh(await api('POST', `/api/claims/${id}/submit`)); toast('Marked as filed'); } });
  on('del', async () => { if (confirm('Delete this claim and its documents?')) { await api('DELETE', '/api/claims/' + id); location.hash = '#prefiling'; } });
}

// ---------- Payer rules ----------
async function rules() {
  const r = await api('GET', '/api/payer-rules');
  const t = r.backtest.reduce((a, b) => ({ cut: a.cut + b.cut, permitted: a.permitted + b.permitted, over: a.over + b.over_deducted, none: a.none + b.no_rule }), { cut: 0, permitted: 0, over: 0, none: 0 });
  view.innerHTML = `<div class="head"><div><h1>Payer rules</h1><p>Each payer's policy terms and agreed rates, and what they say the payer was entitled to cut on every audited claim.</p></div></div>
    <div class="banner"><div><b>These rule files are synthetic.</b> They are invented terms for the demo payers. Findings mean something only once each file holds the real policy schedule and the hospital's signed tariff.</div></div>
    ${r.backtest.length ? `<div class="grid g4" style="margin-bottom:16px">
      <div class="card stat"><div class="k">Payers cut</div><div class="v">${inr(t.cut)}</div></div>
      <div class="card stat"><div class="k">Terms allow</div><div class="v">${inr(t.permitted)}</div></div>
      <div class="card stat hero"><div class="k">Over-deducted per the rules</div><div class="v">${inr(t.over)}</div><div class="n">${pct(t.cut ? t.over / t.cut : 0)} of all cuts</div></div>
      <div class="card stat"><div class="k">Cuts no rule covers</div><div class="v">${inr(t.none)}</div><div class="n">Need a reviewer</div></div></div>
    <div class="card flush" style="margin-bottom:16px"><h2>Claim by claim</h2><div class="scroll"><table>
      <tr><th>Claim</th><th>Payer</th><th class="num">Payer cut</th><th class="num">Terms allow</th><th class="num">Over-deducted</th><th class="num">No rule</th><th class="num">Lines covered</th></tr>
      ${r.backtest.map(b => `<tr class="click" data-id="${b.claim_id}"><td><a href="#claim/${b.claim_id}"><b>${h(b.claim_no)}</b></a></td><td>${h(b.payer || '–')}${b.has_rules ? '' : ' <span class="pill pending">no rule file</span>'}</td><td class="num">${inr(b.cut)}</td><td class="num">${inr(b.permitted)}</td><td class="num"><b>${inr(b.over_deducted)}</b></td><td class="num">${inr(b.no_rule)}</td><td class="num">${b.lines_covered} of ${b.lines}</td></tr>`).join('')}
    </table></div></div>` : ''}
    ${r.payers.map(p => `<div class="card" style="margin-bottom:16px"><div class="cardhead"><h2>${h(p.payer)}</h2><span class="muted small"><code>rules/payers/${h(p.file)}</code></span></div>
      <div class="facts">
        <div><span>Room rent cap</span><b>${p.policy.room_rent_per_day ? inr(p.policy.room_rent_per_day) + ' a day' : 'None'}</b></div>
        <div><span>Proportionate deduction</span><b>${p.policy.proportionate_deduction ? 'Yes' : 'No'}</b></div>
        <div><span>Co-payment</span><b>${p.policy.copay_percent ? p.policy.copay_percent + '%' : 'None'}</b></div>
        <div><span>Sub-limits</span><b>${p.policy.sub_limits.length ? p.policy.sub_limits.map(s => `${h(s.label)}: ${inr(s.limit)}`).join(', ') : 'None'}</b></div>
        <div><span>Not paid for</span><b>${h((p.non_payable?.categories || []).map(c => CAT_LABEL[c] || c).join(', ') || 'Nothing listed')}</b></div>
        <div><span>Usual stay</span><b>${h((p.stay || []).map(s => `${label(s.procedure)}: ${s.max_days} days`).join(', ') || '–')}</b></div>
        <div><span>Agreed rates</span><b>${(p.agreed_rates || []).map(a => `${h(a.label)}: ${inr(a.rate)}`).join(', ') || 'None on file'}</b></div>
        <div><span>Documents required</span><b>${h((p.required_documents || []).map(d => d.document).join(', ') || '–')}</b></div>
      </div></div>`).join('')}`;
  view.querySelectorAll('tr.click').forEach(tr => (tr.onclick = () => (location.hash = '#claim/' + tr.dataset.id)));
}

// ---------- Schema registry ----------
async function schemas() {
  const r = await api('GET', '/api/registry');
  const props = ps => `<div class="factgrid">${ps.map(p => `<div class="fact" style="cursor:default"><span>${h(p.type === 'number' ? 'Number' : 'Text')}</span><b>${h(p.label)}</b><div class="sub">${h(p.description)}</div></div>`).join('')}</div>`;
  view.innerHTML = `<div class="head"><div><h1>Schemas</h1><p>${r.total_properties} clinical properties across ${r.domains.length} domains, and ${r.catalogues.reduce((s, c) => s + c.entries.length, 0)} catalogue entries. Each is a file in <code>schemas/</code> or <code>catalogues/</code>; adding one needs no code change.</p></div></div>
    <div class="card" style="margin-bottom:16px"><div class="cardhead"><h2>${h(r.core.label)}</h2><span class="muted small">${r.core.properties.length} properties</span></div>${props(r.core.properties)}</div>
    ${r.domains.map(d => `<div class="card" style="margin-bottom:16px"><div class="cardhead"><h2>${h(d.label)}</h2><span class="muted small">${d.properties.length} more properties</span></div>${props(d.properties)}</div>`).join('')}
    <div class="grid g3">${r.catalogues.map(c => `<div class="card"><div class="cardhead"><h2>${h(label(c.type))} catalogue</h2><span class="muted small">${c.entries.length} entries</span></div>
      ${c.entries.map(e => `<div style="padding:5px 0;border-bottom:1px solid var(--line-2)">${h(e.name)}<span class="tag">${h(e.class)}</span></div>`).join('')}</div>`).join('')}</div>
    <p class="faint small" style="margin-top:12px">Catalogue entries carry a canonical name and class only. Standard codes (diagnosis, procedure, drug) are left blank until each is checked against the official code set.</p>`;
}

const routes = { overview, prefiling, queue, claims, rules, prices, knowledge, report, schemas, log, settings };
async function render() {
  const [name, arg] = (location.hash.slice(1) || 'overview').split('/');
  const active = name === 'claim' ? 'claims' : routes[name] ? name : 'overview';
  document.querySelectorAll('#nav a').forEach(a => a.classList.toggle('on', a.getAttribute('href') === '#' + active));
  window.scrollTo(0, 0);
  try {
    if (!meta) meta = await api('GET', '/api/meta');
    if (name === 'claim') await claim(Number(arg));
    else await (routes[name] || overview)();
  } catch (e) {
    view.innerHTML = `<div class="card empty"><b>Something went wrong</b>${h(e.message)}</div>`;
  }
}
window.addEventListener('hashchange', render);
render();
refreshBadge();
