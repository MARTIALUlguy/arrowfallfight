import fs from 'node:fs';
import zlib from 'node:zlib';

const file = process.argv[2];
const buf = fs.readFileSync(file);
const raw = buf.toString('latin1');

/* ---------- helpers ---------- */
function getStream(bodyStart) {
  let i = bodyStart + 'stream'.length;
  if (raw[i] === '\r') i++;
  if (raw[i] === '\n') i++;
  let end = raw.indexOf('endstream', i);
  if (end < 0) return null;
  let data = buf.subarray(i, end);
  return { data, end };
}

function inflate(data) {
  const attempts = [
    () => zlib.inflateSync(data),
    () => zlib.inflateRawSync(data),
    () => zlib.inflateSync(data, { finishFlush: zlib.constants.Z_SYNC_FLUSH }),
    () => zlib.unzipSync(data),
  ];
  for (const fn of attempts) {
    try { return fn(); } catch (e) { /* next */ }
  }
  return null;
}

function parseObjects() {
  const objs = new Map();
  const re = /(\d+)\s+(\d+)\s+obj\b/g;
  let m;
  while ((m = re.exec(raw))) {
    const num = parseInt(m[1], 10);
    const start = m.index + m[0].length;
    let body = raw.slice(start);
    const ei = body.indexOf('endobj');
    if (ei > -1) body = body.slice(0, ei);
    const si = body.indexOf('stream');
    const dict = (si > -1 ? body.slice(0, si) : body).replace(/[\r\n]+/g, ' ').trim();
    let stream = null;
    if (si > -1) {
      const s = getStream(start + si);
      if (s) {
        const inflated = /\/FlateDecode/.test(dict) ? inflate(s.data) : s.data;
        stream = inflated ? inflated.toString('latin1') : null;
      }
    }
    objs.set(num, { num, dict, stream });
  }
  return objs;
}

const objs = parseObjects();

/* ---------- expand object streams ---------- */
function expandObjStm() {
  for (const [num, o] of [...objs]) {
    if (!/\/Type\s*\/ObjStm/.test(o.dict)) continue;
    const nMatch = o.dict.match(/\/N\s+(\d+)/);
    const firstMatch = o.dict.match(/\/First\s+(\d+)/);
    if (!nMatch || !firstMatch || !o.stream) continue;
    const N = parseInt(nMatch[1], 10);
    const first = parseInt(firstMatch[1], 10);
    const header = o.stream.slice(0, first).trim().split(/\s+/).map(Number);
    for (let i = 0; i < N; i++) {
      const objNum = header[i * 2];
      const objOff = header[i * 2 + 1];
      if (objNum === undefined || objOff === undefined) continue;
      const nextOff = i + 1 < N ? header[(i + 1) * 2 + 1] : o.stream.length - first;
      const body = o.stream.slice(first + objOff, first + nextOff).trim();
      if (!objs.has(objNum)) {
        objs.set(objNum, { num: objNum, dict: body.replace(/[\r\n]+/g, ' ').trim(), stream: null });
      }
    }
  }
}
expandObjStm();

console.log('=== OBJECT TYPES ===');
const types = {};
for (const o of objs.values()) {
  const t = (o.dict.match(/\/Type\s*\/(\w+)/) || [])[1] || (o.dict.match(/\/Subtype\s*\/(\w+)/) || [])[1] || '(none)';
  types[t] = (types[t] || 0) + 1;
}
console.log(JSON.stringify(types, null, 2));

console.log('\n=== PAGES ===');
const pages = [];
for (const o of objs.values()) {
  if (/\/Type\s*\/Page[^s]/.test(o.dict)) {
    pages.push(o);
    console.log(`obj ${o.num}: ${o.dict.slice(0, 300)}`);
  }
}

console.log('\n=== FONTS ===');
for (const o of objs.values()) {
  if (/\/Subtype\s*\/(Type0|Type1|TrueType|CIDFontType\d)/.test(o.dict)) {
    console.log(`obj ${o.num}: ${o.dict.slice(0, 300)}`);
  }
}

console.log('\n=== TOCU CMAPS ===');
for (const o of objs.values()) {
  if (/\/CMapName|\/ToUnicode/.test(o.dict) || (o.stream && /begincmap/.test(o.stream))) {
    console.log(`obj ${o.num}: dict=${o.dict.slice(0, 160)} hasStream=${!!o.stream}`);
  }
}

console.log('\n=== XOBJECT ===');
for (const o of objs.values()) {
  if (/\/Subtype\s*\/Image/.test(o.dict)) {
    console.log(`obj ${o.num}: ${o.dict.slice(0, 300)}`);
  }
}

export { objs, inflate };

/* ---------- ToUnicode CMap parsing ---------- */
function parseToUnicode(stream) {
  const map = new Map();
  if (!stream) return map;
  let m;
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((m = bfcharRe.exec(stream))) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = pairRe.exec(m[1]))) {
      const src = parseInt(p[1], 16);
      const hex = p[2];
      let dst = '';
      for (let i = 0; i + 4 <= hex.length; i += 4) dst += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
      map.set(src, dst);
    }
  }
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((m = bfrangeRe.exec(stream))) {
    const rangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let p;
    while ((p = rangeRe.exec(m[1]))) {
      const lo = parseInt(p[1], 16);
      const hi = parseInt(p[2], 16);
      if (p[3]) {
        const base = parseInt(p[3], 16);
        for (let c = lo; c <= hi && c - lo < 65536; c++) map.set(c, String.fromCharCode(base + (c - lo)));
      } else if (p[4] !== undefined) {
        const items = p[4].match(/<([0-9A-Fa-f]+)>/g) || [];
        items.forEach((it, idx) => {
          const hex = it.replace(/[<>]/g, '');
          let dst = '';
          for (let i = 0; i + 4 <= hex.length; i += 4) dst += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
          map.set(lo + idx, dst);
        });
      }
    }
  }
  return map;
}


/* ---------- font table ---------- */
function buildFontTable() {
  const fonts = {};
  const res = objs.get(4);
  if (!res) return fonts;
  const fm = res.dict.match(/\/Font\s*<<([\s\S]*?)>>/);
  if (!fm) return fonts;
  const re = /\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+0\s+R/g;
  let m;
  while ((m = re.exec(fm[1]))) {
    const f = objs.get(parseInt(m[2], 10));
    if (!f) continue;
    const tu = f.dict.match(/\/ToUnicode\s+(\d+)\s+0\s+R/);
    fonts[m[1]] = {
      map: tu ? parseToUnicode(objs.get(parseInt(tu[1], 10))?.stream) : new Map(),
      twoByte: /\/Identity-H/.test(f.dict) || /\/Type0/.test(f.dict),
    };
  }
  return fonts;
}
const fontTable = buildFontTable();

function decodeString(hex, font) {
  let out = '';
  if (font && font.twoByte) {
    for (let i = 0; i + 4 <= hex.length; i += 4) {
      const code = parseInt(hex.substr(i, 4), 16);
      out += font.map.has(code) ? font.map.get(code) : '';
    }
  } else {
    for (let i = 0; i + 2 <= hex.length; i += 2) {
      const code = parseInt(hex.substr(i, 2), 16);
      out += font && font.map.has(code) ? font.map.get(code) : String.fromCharCode(code);
    }
  }
  return out;
}


/* ---------- content stream text extraction ---------- */
function extractPageText(cs) {
  if (!cs) return '';
  const lines = [];
  let cur = '';
  let curFont = null;
  const tokenRe = /<([0-9A-Fa-f\s]*)>|\((?:\\.|[^\\)])*\)|\/[A-Za-z0-9#+._-]+|-?[\d.]+|[A-Za-z'"*]+/g;
  let m;
  let operands = [];
  while ((m = tokenRe.exec(cs))) {
    const t = m[0];
    if (t[0] === '<' && t.length > 1 && t[1] !== '<') {
      operands.push({ t: 'hex', v: m[1].replace(/\s+/g, '') });
      continue;
    }
    if (t[0] === '(') {
      operands.push({ t: 'str', v: t.slice(1, -1).replace(/\\([nrtbf()\\])/g, (_, c) => ({ n: '\n', r: '\r', t: '\t', b: '\b', f: '\f' }[c] || c)) });
      continue;
    }
    if (t[0] === '/') { operands.push({ t: 'name', v: t.slice(1) }); continue; }
    if (/^-?[\d.]+$/.test(t)) { operands.push({ t: 'num', v: parseFloat(t) }); continue; }
    const op = t;
    if (op === 'Tf') {
      const nm = operands.filter(o => o.t === 'name').pop();
      curFont = nm ? fontTable[nm.v] : null;
    } else if (op === 'Tj') {
      const s = operands.filter(o => o.t === 'hex' || o.t === 'str').pop();
      if (s) cur += s.t === 'hex' ? decodeString(s.v, curFont) : s.v;
    } else if (op === 'TJ') {
      for (const o of operands) {
        if (o.t === 'hex') cur += decodeString(o.v, curFont);
        else if (o.t === 'str') cur += o.v;
        else if (o.t === 'num' && o.v < -180) cur += ' ';
      }
    } else if (op === 'T*' || op === 'Td' || op === 'TD' || op === 'Tm' || op === 'ET' || op === 'BT') {
      if (cur.trim()) { lines.push(cur.replace(/\s+$/, '')); cur = ''; }
    }
    operands = [];
  }
  if (cur.trim()) lines.push(cur.replace(/\s+$/, ''));
  return lines.join('\n');
}

console.log('\n\n############ PAGE TEXT ############');
const pageObjs = [...objs.values()].filter(o => /\/Type\s*\/Page[^s]/.test(o.dict)).sort((a, b) => a.num - b.num);
let pageNo = 0;
const out = [];
for (const p of pageObjs) {
  pageNo++;
  const cm = p.dict.match(/\/Contents\s+(\d+)\s+0\s+R/);
  const content = cm ? objs.get(parseInt(cm[1], 10))?.stream : null;
  out.push(`\n========== PAGE ${pageNo} ==========\n`);
  out.push(extractPageText(content));
}
const target = process.argv[3];
if (target) {
  fs.writeFileSync(target, out.join('\n'), 'utf8');
  console.log('written: ' + target + ' (' + out.join('\n').length + ' chars)');
} else {
  console.log(out.join('\n'));
}

