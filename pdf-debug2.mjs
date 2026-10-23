import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync(process.argv[2]);
const raw = buf.toString('latin1');
const out = [];
const log = (...a) => out.push(a.join(' '));

function inflate(data) {
  for (const fn of [() => zlib.inflateSync(data), () => zlib.inflateRawSync(data), () => zlib.unzipSync(data)]) {
    try { return fn(); } catch {}
  }
  return null;
}

/* find every "N G obj" occurrence */
const re = /(\d+)\s+(\d+)\s+obj\b/g;
let m;
const found = [];
while ((m = re.exec(raw))) found.push({ num: +m[1], at: m.index, after: m.index + m[0].length });
log('OBJ HEADERS FOUND: ' + found.map(o => o.num).join(','));
log('has obj 4 header: ' + found.some(o => o.num === 4));
if (found.some(o => o.num === 4)) {
  const o4 = found.find(o => o.num === 4);
  log('OBJ 4 RAW: ' + raw.slice(o4.at, o4.at + 500).replace(/[\r\n]+/g, ' '));
}

/* objstm expansion */
const objstm = found.find(o => raw.slice(o.at, o.at + 300).includes('/ObjStm'));
if (objstm) {
  let i = raw.indexOf('stream', objstm.at) + 6;
  if (raw[i] === '\r') i++;
  if (raw[i] === '\n') i++;
  const end = raw.indexOf('endstream', i);
  const data = inflate(buf.subarray(i, end));
  const head = raw.slice(objstm.at, i);
  log('OBJSTM HEADER: ' + head.replace(/[\r\n]+/g, ' ').slice(0, 200));
  if (data) {
    const s = data.toString('latin1');
    const N = +(/[/]N\s+(\d+)/.exec(head) || [])[1];
    const first = +(/[/]First\s+(\d+)/.exec(head) || [])[1];
    log('OBJSTM N=' + N + ' First=' + first + ' slen=' + s.length);
    const hdr = s.slice(0, first).trim().split(/\s+/).map(Number);
    log('OBJSTM HEADER NUMS: ' + hdr.slice(0, 40).join(','));
    for (let i2 = 0; i2 < N; i2++) {
      const num = hdr[i2 * 2], off = hdr[i2 * 2 + 1];
      if (num === undefined) break;
      const nextOff = i2 + 1 < N ? hdr[(i2 + 1) * 2 + 1] : s.length - first;
      const body = s.slice(first + off, first + nextOff).replace(/[\r\n]+/g, ' ').trim();
      log('  -> obj ' + num + ' : ' + body.slice(0, 260));
    }
  }
}

fs.writeFileSync(process.argv[3] || 'pdf-debug2.txt', out.join('\n'), 'utf8');
console.log('ok');
