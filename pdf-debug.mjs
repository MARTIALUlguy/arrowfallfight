import fs from 'node:fs';
import zlib from 'node:zlib';

const buf = fs.readFileSync(process.argv[2]);
const raw = buf.toString('latin1');

function inflate(data) {
  for (const fn of [() => zlib.inflateSync(data), () => zlib.inflateRawSync(data), () => zlib.unzipSync(data)]) {
    try { return fn(); } catch {}
  }
  return null;
}

function getStream(objNum) {
  const re = new RegExp('(^|[^0-9])' + objNum + '\\s+0\\s+obj');
  const m = re.exec(raw);
  if (!m) return null;
  let i = raw.indexOf('stream', m.index);
  i += 'stream'.length;
  if (raw[i] === '\r') i++;
  if (raw[i] === '\n') i++;
  const end = raw.indexOf('endstream', i);
  const data = buf.subarray(i, end);
  const head = raw.slice(m.index, i);
  return /\/FlateDecode/.test(head) ? inflate(data)?.toString('latin1') : data.toString('latin1');
}

console.log('########## ToUnicode obj 52 (Inter-Bold) ##########');
console.log(getStream(52));
console.log('\n########## ToUnicode obj 56 (Inter) ##########');
console.log(getStream(56));
console.log('\n########## PAGE 1 CONTENT (obj 5) first 2500 ##########');
const c = getStream(5);
console.log(c ? c.slice(0, 2500) : 'NONE');

console.log('\n########## RESOURCE OBJ 4 ##########');
const r4 = raw.match(/(^|[^0-9])4\s+0\s+obj([\s\S]{0,700})/);
console.log(r4 ? r4[2] : 'not found inline');

console.log('\n########## ALL FONT RESOURCE REFS ##########');
const fre = /\/Font\s*<<([\s\S]{0,600}?)>>/g;
let fm2;
while ((fm2 = fre.exec(raw))) console.log('FontBlock: ' + fm2[1].replace(/[\r\n]+/g, ' '));
