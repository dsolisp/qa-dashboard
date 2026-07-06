import fs from 'fs';
import path from 'path';

const rawDir = process.env.RAW_DIR || 'data/raw';
const outPath = process.env.OUT_PATH || 'public/data/summaries.json';

function readJson(p) {
  return JSON.parse(fs.readFileSync(p, 'utf8'));
}

function listJsonFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) out.push(...listJsonFiles(p));
    else if (entry.isFile() && entry.name.endsWith('.json')) out.push(p);
  }
  return out;
}

const files = listJsonFiles(rawDir);
const summaries = [];
for (const f of files) {
  try {
    const j = readJson(f);
    if (j && typeof j === 'object' && j.repo && j.run_id) summaries.push(j);
  } catch {
    // ignore
  }
}

summaries.sort((a, b) => String(b.timestamp || '').localeCompare(String(a.timestamp || '')));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify(summaries, null, 2));
console.log(`✅ Wrote ${outPath} (${summaries.length} summaries)`);

