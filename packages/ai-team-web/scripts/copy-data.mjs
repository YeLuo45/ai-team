// Build-time script: copies data/*.json → public/data/team.json
// Combines all 5 entity files into a single team.json for the web.

import { promises as fs } from 'node:fs';
import path from 'node:path';

const ROOT = path.resolve(process.cwd(), '../..');
const SRC_DIR = path.join(ROOT, 'data');
const OUT_DIR = path.resolve(process.cwd(), 'public/data');
const OUT_FILE = path.join(OUT_DIR, 'team.json');

async function readJson(name, fallback = []) {
  try {
    const buf = await fs.readFile(path.join(SRC_DIR, name), 'utf-8');
    return JSON.parse(buf);
  } catch {
    return fallback;
  }
}

async function main() {
  await fs.mkdir(OUT_DIR, { recursive: true });
  const data = {
    candidates: await readJson('candidates.json'),
    members: await readJson('members.json'),
    interviews: await readJson('interviews.json'),
    trainings: await readJson('trainings.json'),
    reviews: await readJson('reviews.json'),
    generatedAt: new Date().toISOString(),
  };
  await fs.writeFile(OUT_FILE, JSON.stringify(data, null, 2), 'utf-8');
  console.log(`✓ Wrote ${OUT_FILE} (${data.candidates.length} candidates, ${data.members.length} members, ${data.interviews.length} interviews)`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
