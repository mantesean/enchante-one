import { mkdir, writeFile } from 'node:fs/promises';
import { resolve, join } from 'node:path';
import { collect, render, prNumber, outcome } from './evidence.mjs';
const args = process.argv.slice(2);
if (args.length !== 2) throw new Error('Usage: node command/collect.mjs <positive PR number> <output directory>');
const number = prNumber(args[0]);
const dir = resolve(args[1]);
await mkdir(dir, { recursive: true });
const snapshot = await collect(number);
const stem = `pr-${number}-${snapshot.fetchedAt.replaceAll(':', '-')}`;
for (const [ext, data] of [['json', JSON.stringify(snapshot, null, 2)], ['html', render(snapshot)]]) {
  const file = join(dir, `${stem}.${ext}`);
  await writeFile(file, data, { flag: 'wx', mode: 0o444 });
  console.log(file);
}
process.exitCode = outcome(snapshot);
