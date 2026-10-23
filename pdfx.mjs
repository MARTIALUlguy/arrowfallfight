import fs from 'node:fs';
import zlib from 'node:zlib';

const PDF = process.argv[2];
const OUT = process.argv[3];
const buf = fs.readFileSync(PDF);
const raw = buf.toString('latin1');

function inflate(data) {
  for (const fn of [() => zlib.inflateSync(data), () => zlib.inflateRawSync(data), () => zlib.unzipSync(data)]) {
    try { return fn(); } catch {}
  }
  return null;
}

const objects = new Map();
const objRe = /(\d+)\s+(\d+)\s+obj\b/g;
let m;
while ((m = objRe.exec(raw))) {
  const num = +m[1];
  const bodyStart = m.index + m[0].length;
  let body = raw.slice(bodyStart);
  const endObj = body.indexOf('endobj');
  if (endObj > -1) body = body.slice(0, endObj);
  const si = body.indexOf('stream');
  const dict = (si > -1 ? body.slice(0, si) : body).replace(/[\r\n]+/g, ' ').trim();
  let streamStart = -1, streamEnd = -1;
  if (si > -1) {
    let i = bodyStart + si + 'stream'.length;
    if (raw[i] === '\r') i++;
    if (raw[i] === '\n') i++;
    streamStart = i;
    const lenM = /\/Length\s+(\d+)/.exec(dict);
    if (lenM) {
      streamEnd = i + +lenM[1];
    } else {
      let e = raw.indexOf('endstream', i);
      streamEnd = e > -1 ? e : i;
      while (streamEnd > i && (raw[streamEnd - 1] === '\n' || raw[streamEnd - 1] === '\r')) streamEnd--;
    }
  }
  objects.set(num, { num, dict, streamStart, streamEnd });
}

for (const o of [...objects.values()]) {
  if (!/\/Type\s*\/ObjStm/.test(o.dict) || o.streamStart < 0) continue;
  const N = +(/\/N\s+(\d+)/.exec(o.dict) || [])[1];
  const first = +(/\/First\s+(\d+)/.exec(o.dict) || [])[1];
  if (!N || first === undefined) continue;
  const data = inflate(buf.subarray(o.streamStart, o.streamEnd));
  if (!data) continue;
  const s = data.toString('latin1');
  const hdr = s.slice(0, first).trim().split(/\s+/).map(Number);
  for (let i = 0; i < N; i++) {
    const num = hdr[i * 2], off = hdr[i * 2 + 1];
    if (num === undefined || off === undefined) continue;
    const nextOff = i + 1 < N ? hdr[(i + 1) * 2 + 1] : s.length - first;
    const body = s.slice(first + off, first + nextOff).replace(/[\r\n]+/g, ' ').trim();
    if (!objects.has(num)) objects.set(num, { num, dict: body, streamStart: -1, streamEnd: -1 });
  }
}

function getStreamText(num) {
  const o = objects.get(num);
  if (!o || o.streamStart < 0) return null;
  const data = buf.subarray(o.streamStart, o.streamEnd);
  const out = /\/(FlateDecode|ASCII85Decode)/.test(o.dict) ? inflate(data) : data;
  return out ? out.toString('latin1') : null;
}

function resolveRef(o, key) {
  if (!o) return null;
  const mm = new RegExp('/' + key + '\\s+(\\d+)\\s+0\\s+R').exec(o.dict);
  return mm ? objects.get(+mm[1]) : null;
}

/* ---------------- fonts ---------------- */
function parseToUnicode(streamText) {
  const map = new Map();
  if (!streamText) return map;
  let mm;
  const bfcharRe = /beginbfchar([\s\S]*?)endbfchar/g;
  while ((mm = bfcharRe.exec(streamText))) {
    const pairRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>/g;
    let p;
    while ((p = pairRe.exec(mm[1]))) {
      const src = parseInt(p[1], 16);
      const hex = p[2];
      let dst = '';
      for (let i = 0; i + 4 <= hex.length; i += 4) dst += String.fromCharCode(parseInt(hex.substr(i, 4), 16));
      map.set(src, dst);
    }
  }
  const bfrangeRe = /beginbfrange([\s\S]*?)endbfrange/g;
  while ((mm = bfrangeRe.exec(streamText))) {
    const rangeRe = /<([0-9A-Fa-f]+)>\s*<([0-9A-Fa-f]+)>\s*(?:<([0-9A-Fa-f]+)>|\[([\s\S]*?)\])/g;
    let p;
    while ((p = rangeRe.exec(mm[1]))) {
      const lo = parseInt(p[1], 16), hi = parseInt(p[2], 16);
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

function buildFonts(pageObj) {
  const fonts = {};
  const resObj = resolveRef(pageObj, 'Resources');
  if (!resObj) return fonts;
  let fontRes = resolveRef(resObj, 'Font');
  if (!fontRes) {
    const inline = /\/Font\s+(\d+)\s+0\s+R/.exec(resObj.dict);
    if (inline) fontRes = objects.get(+inline[1]);
  }
  if (!fontRes) return fonts;
  const re = /\/([A-Za-z0-9#+._-]+)\s+(\d+)\s+0\s+R/g;
  let mm;
  while ((mm = re.exec(fontRes.dict))) {
    const f = objects.get(+mm[2]);
    if (!f) continue;
    const tu = resolveRef(f, 'ToUnicode');
    fonts[mm[1]] = {
      map: parseToUnicode(tu ? getStreamText(tu.num) : null),
      twoByte: /\/(Identity-H|Identity-V)/.test(f.dict) || /\/Type0/.test(f.dict),
    };
  }
  return fonts;
}

function decodeHex(hex, font) {
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

/* ---------------- text extraction ---------------- */
function extractPage(pageObj) {
  const fonts = buildFonts(pageObj);
  const parts = [];
  const cref = resolveRef(pageObj, 'Contents');
  if (cref && cref.streamStart >= 0) {
    parts.push(getStreamText(cref.num) || '');
  } else {
    const arr = /\/Contents\s*\[([\s\S]*?)\]/.exec(pageObj.dict);
    if (arr) {
      const re = /(\d+)\s+0\s+R/g;
      let mm;
      while ((mm = re.exec(arr[1]))) parts.push(getStreamText(+mm[1]) || '');
    }
  }
  const cs = parts.join('\n');
  const items = [];
  let curFont = null;
  let fontSize = 10;
  let tm = null;
  let leading = 0;
  const stack = [];

  const tokenRe = /<([0-9A-Fa-f\s]*)>|\((?:\\.|[^\\)])*\)|\/[A-Za-z0-9#+._-]+|-?\d*\.?\d+|[A-Za-z'"*]+/g;
  let m;
  let args = [];
  while ((m = tokenRe.exec(cs))) {
    const t = m[0];
    if (t[0] === '<' && t[1] !== '<') { args.push({ t: 'hex', v: m[1].replace(/\s+/g, '') }); continue; }
    if (t[0] === '(') { args.push({ t: 'str', v: t.slice(1, -1) }); continue; }
    if (t[0] === '/') { args.push({ t: 'name', v: t.slice(1) }); continue; }
    if (/^-?\d*\.?\d+$/.test(t)) { args.push({ t: 'num', v: parseFloat(t) }); continue; }

    const op = t;
    if (op === 'Tf') {
      const nm = args.filter(a => a.t === 'name').pop();
      curFont = nm ? fonts[nm.v] : null;
      const nums = args.filter(a => a.t === 'num').map(a => a.v);
      if (nums.length) fontSize = Math.abs(nums[nums.length - 1]);
    } else if (op === 'Tm') {
      const nums = args.filter(a => a.t === 'num').map(a => a.v);
      if (nums.length >= 6) tm = { x: nums[4], y: nums[5], sy: nums[3] || 10 };
    } else if (op === 'Td' || op === 'TD') {
      const nums = args.filter(a => a.t === 'num').map(a => a.v);
      if (nums.length >= 2 && tm) { tm.x += nums[0]; tm.y += nums[1]; if (op === 'TD') leading = -nums[1]; }
    } else if (op === 'TL') {
      const nums = args.filter(a => a.t === 'num').map(a => a.v);
      if (nums.length) leading = nums[0];
    } else if (op === 'T*') {
      if (tm) tm.y -= leading;
    } else if (op === 'BT') {
      tm = null; leading = 0;
    } else if (op === 'q') {
      stack.push(tm ? { ...tm } : null);
    } else if (op === 'Q') {
      tm = stack.pop() || tm;
    } else if (op === 'Tj' || op === 'TJ' || op === "'" || op === '"') {
      let text = '';
      if (op === 'TJ') {
        for (const a of args) {
          if (a.t === 'hex') text += decodeHex(a.v, curFont);
          else if (a.t === 'str') text += a.v;
          else if (a.t === 'num' && a.v < -180) text += ' ';
        }
      } else {
        const s = args.filter(a => a.t === 'hex' || a.t === 'str').pop();
        if (s) text = s.t === 'hex' ? decodeHex(s.v, curFont) : s.v;
        if ((op === "'" || op === '"') && tm) tm.y -= leading;
      }
      if (text && tm) items.push({ x: tm.x, y: tm.y, text, size: fontSize });
    }
    args = [];
  }
  return items;
}

function render(items) {
  const rows = new Map();
  for (const it of items) {
    const key = Math.round(it.y / 3) * 3;
    if (!rows.has(key)) rows.set(key, []);
    rows.get(key).push(it);
  }
  // WeasyPrint emits a flipped CTM: smaller tm.y == higher on the page.
  const keys = [...rows.keys()].sort((a, b) => a - b);
  const lines = [];
  for (const k of keys) {
    const arr = rows.get(k).sort((a, b) => a.x - b.x);
    let line = '';
    let lastEnd = null;
    for (const it of arr) {
      if (lastEnd !== null && it.x - lastEnd > it.size * 0.3) line += '  ';
      line += it.text;
      lastEnd = it.x + it.text.length * it.size * 0.5;
    }
    lines.push(line.replace(/\s+$/, ''));
  }
  return lines.join('\n');
}

/* ---------------- main ---------------- */
const pages = [...objects.values()]
  .filter(o => /\/Type\s*\/Page[^s]/.test(o.dict))
  .sort((a, b) => a.num - b.num);

if (process.env.DUMP_Y) {
  const items = extractPage(pages[0]);
  const dbg = items.slice(0, 25).map(i => `y=${i.y.toFixed(1)} x=${i.x.toFixed(1)} s=${i.size.toFixed(1)} :: ${i.text.slice(0, 40)}`);
  fs.writeFileSync('dumpy.txt', dbg.join('\n'), 'utf8');
}

const out = [];
let pn = 0;
for (const p of pages) {
  pn++;
  out.push(`\n\n========== PAGE ${pn} ==========\n`);
  out.push(render(extractPage(p)));
}
fs.writeFileSync(OUT, out.join('\n'), 'utf8');
console.log('OK pages=' + pages.length + ' chars=' + out.join('\n').length);


