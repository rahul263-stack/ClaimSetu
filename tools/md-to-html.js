// Minimal Markdown -> styled HTML converter for the report (headings, lists, tables, quotes, code, links).
// Usage: node tools/md-to-html.js input.md output.html [title]  (build-report-pdf.js calls this)
const fs = require('fs');
const [,, src, out, titleArg] = process.argv;
const md = fs.readFileSync(src, 'utf8').replace(/\r\n/g, '\n');

const esc = s => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

function inline(s) {
  const codes = [];
  s = s.replace(/`([^`]+)`/g, (_, c) => { codes.push('<code>' + esc(c) + '</code>'); return '\u0000' + (codes.length - 1) + '\u0000'; });
  s = esc(s);
  s = s.replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, (_, t, u) => `<a href="${u.replace(/"/g, '%22')}">${t}</a>`);
  s = s.replace(/&lt;(https?:\/\/[^\s&]+)&gt;/g, '<a href="$1">$1</a>');
  s = s.replace(/\*\*([^*]+(?:\*[^*]+)*?)\*\*/g, '<strong>$1</strong>');
  s = s.replace(/(^|[^*\w])\*([^*\s][^*]*?)\*(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/(^|[^_\w])_([^_\s][^_]*?)_(?!\w)/g, '$1<em>$2</em>');
  s = s.replace(/\u0000(\d+)\u0000/g, (_, i) => codes[+i]);
  return s;
}

const lines = md.split('\n');
let html = '', i = 0, title = titleArg || '';
const isTableSep = l => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l) && l.includes('-') && l.includes('|');
const cells = l => l.trim().replace(/^\|/, '').replace(/\|$/, '').split(/(?<!\\)\|/).map(c => c.trim().replace(/\\\|/g, '|'));
const listRe = /^(\s*)([-*+]|\d+[.)])\s+(.*)$/;

function parseList(baseIndent) {
  const first = lines[i].match(listRe);
  const ordered = /\d/.test(first[2]);
  let h = ordered ? '<ol>' : '<ul>';
  while (i < lines.length) {
    const m = lines[i].match(listRe);
    if (!m) break;
    const ind = m[1].length;
    if (ind < baseIndent) break;
    if (ind > baseIndent) { break; }
    let text = m[3];
    i++;
    let sub = '';
    while (i < lines.length) {
      const l = lines[i];
      const m2 = l.match(listRe);
      if (m2) {
        if (m2[1].length > baseIndent) { sub += parseList(m2[1].length); continue; }
        break;
      }
      if (l.trim() === '') {
        // blank: continue list only if next non-blank is a list item at >= baseIndent
        let j = i; while (j < lines.length && lines[j].trim() === '') j++;
        const m3 = j < lines.length && lines[j].match(listRe);
        if (m3 && m3[1].length >= baseIndent) { i = j; continue; }
        break;
      }
      if (/^\s+/.test(l)) { text += ' ' + l.trim(); i++; continue; }
      break;
    }
    h += '<li>' + inline(text) + sub + '</li>';
  }
  return h + (ordered ? '</ol>' : '</ul>');
}

while (i < lines.length) {
  const l = lines[i];
  if (l.trim() === '') { i++; continue; }
  if (/^```/.test(l)) {
    let buf = []; i++;
    while (i < lines.length && !/^```/.test(lines[i])) buf.push(lines[i++]);
    i++; html += '<pre>' + esc(buf.join('\n')) + '</pre>'; continue;
  }
  const hm = l.match(/^(#{1,6})\s+(.*?)\s*#*$/);
  if (hm) {
    const n = hm[1].length;
    if (n === 1 && !title) title = hm[2];
    html += `<h${n}>${inline(hm[2])}</h${n}>`; i++; continue;
  }
  if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(l)) { html += '<hr>'; i++; continue; }
  if (l.includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1])) {
    const head = cells(l); i += 2;
    let t = '<table><thead><tr>' + head.map(c => '<th>' + inline(c) + '</th>').join('') + '</tr></thead><tbody>';
    while (i < lines.length && lines[i].includes('|') && lines[i].trim() !== '') {
      const row = cells(lines[i]);
      t += '<tr>' + head.map((_, k) => '<td>' + inline(row[k] || '') + '</td>').join('') + '</tr>'; i++;
    }
    html += t + '</tbody></table>'; continue;
  }
  if (/^\s*>/.test(l)) {
    let buf = [];
    while (i < lines.length && /^\s*>/.test(lines[i])) buf.push(lines[i++].replace(/^\s*>\s?/, ''));
    html += '<blockquote><p>' + inline(buf.join(' ')) + '</p></blockquote>'; continue;
  }
  if (listRe.test(l)) { html += parseList(l.match(listRe)[1].length); continue; }
  let buf = [];
  while (i < lines.length && lines[i].trim() !== '' && !/^(#{1,6})\s/.test(lines[i]) && !/^```/.test(lines[i]) && !listRe.test(lines[i]) && !/^\s*>/.test(lines[i]) && !(lines[i].includes('|') && i + 1 < lines.length && isTableSep(lines[i + 1]))) buf.push(lines[i++].trim());
  html += '<p>' + inline(buf.join(' ')) + '</p>';
}

const css = `
@page { size: A4; margin: 20mm 17mm 20mm 17mm; }
* { box-sizing: border-box; }
body { font-family: "Segoe UI", "Nirmala UI", Arial, sans-serif; font-size: 10.4pt; line-height: 1.5; color: #1c2430; margin: 0; }
h1 { font-size: 24pt; line-height: 1.15; color: #0d2b45; margin: 0 0 6pt; letter-spacing: -0.3pt; }
h2 { font-size: 15pt; color: #0d2b45; margin: 22pt 0 7pt; padding-bottom: 4pt; border-bottom: 1.5pt solid #1f7a6d; break-after: avoid; }
h3 { font-size: 11.8pt; color: #14506b; margin: 15pt 0 5pt; break-after: avoid; }
h4 { font-size: 10.6pt; color: #14506b; margin: 11pt 0 4pt; break-after: avoid; }
p { margin: 0 0 7pt; orphans: 3; widows: 3; }
ul, ol { margin: 0 0 8pt; padding-left: 17pt; }
li { margin-bottom: 3pt; }
li > ul, li > ol { margin-top: 3pt; margin-bottom: 2pt; }
a { color: #14607a; text-decoration: none; overflow-wrap: anywhere; }
strong { color: #0f2233; }
code { font-family: Consolas, monospace; font-size: 9.2pt; background: #eef2f5; padding: 0 2pt; border-radius: 2pt; }
pre { font-family: Consolas, monospace; font-size: 8.8pt; background: #f3f6f8; padding: 8pt; border-radius: 3pt; white-space: pre-wrap; }
blockquote { margin: 8pt 0; padding: 7pt 11pt; background: #eef6f4; border-left: 3pt solid #1f7a6d; }
blockquote p { margin: 0; }
hr { border: 0; border-top: 0.75pt solid #c9d3da; margin: 14pt 0; }
table { width: 100%; border-collapse: collapse; margin: 8pt 0 12pt; font-size: 8.9pt; line-height: 1.38; }
thead { display: table-header-group; }
th { background: #0d2b45; color: #fff; text-align: left; padding: 5pt 6pt; font-weight: 600; vertical-align: bottom; }
td { padding: 4.5pt 6pt; border-bottom: 0.5pt solid #d5dde3; vertical-align: top; overflow-wrap: anywhere; }
tbody tr:nth-child(even) td { background: #f5f8fa; }
tr { break-inside: avoid; }
`;
fs.writeFileSync(out, `<!doctype html><html lang="en"><head><meta charset="utf-8"><title>${esc(title)}</title><style>${css}</style></head><body>${html}</body></html>`);
console.log('ok', html.length);
