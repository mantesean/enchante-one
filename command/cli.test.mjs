import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, writeFile, readdir, readFile, rm, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
import { fixture } from './fixtures.mjs';
const exec = promisify(execFile);
for (const mode of ['ready', 'blocked', 'failure']) test(`CLI ${mode}: immutable reports and deterministic exit`, async () => {
  const dir = await mkdtemp(join(tmpdir(), 'command-test-'));
  try {
    const s = fixture(); if (mode === 'blocked') s.pr.draft = true;
    await writeFile(join(dir, 'data.json'), JSON.stringify(s));
    await writeFile(join(dir, 'gh'), `#!${process.execPath}
const fs = require('node:fs');
const s = JSON.parse(fs.readFileSync(process.env.TEST_COMMAND_DATA, 'utf8'));
const args = process.argv.slice(2);
if (args.slice(0,5).join(' ') !== 'api --hostname github.com --method GET' || args.length !== 6) process.exit(99);
const path = args[5];
if (!path.startsWith('repos/mantesean/enchante-one/')) process.exit(99);
if (process.env.TEST_COMMAND_MODE === 'failure') process.exit(1);
let data;
if (path.endsWith('/pulls/5')) data = s.pr;
else if (path.endsWith('/workflows/ci.yml')) data = s.workflow;
else if (path.includes('/check-runs?')) data = {check_runs:s.checks};
else if (path.includes('/reviews?')) data = s.reviews;
else if (path.includes('/workflows/7/runs?')) data = {workflow_runs:s.runs};
else if (path.includes('/attempts/1/jobs?')) data = {jobs:s.jobs};
else if (path.includes('/artifacts?')) data = {artifacts:s.artifacts};
else if (path.endsWith('/runs/42')) data = s.runEnd;
else process.exit(99);
process.stdout.write(JSON.stringify(data));
`, { mode: 0o755 });
    const out = join(dir, 'output');
    let code = 0;
    try { await exec(process.execPath, [resolve('command/collect.mjs'), '5', out], { env: { ...process.env, PATH: `${dir}:${process.env.PATH}`, TEST_COMMAND_DATA: join(dir, 'data.json'), TEST_COMMAND_MODE: mode } }); }
    catch (e) { code = e.code; }
    assert.equal(code, { ready: 0, blocked: 2, failure: 1 }[mode]);
    const files = await readdir(out); assert.equal(files.length, 2);
    for (const name of files) assert.equal((await stat(join(out, name))).mode & 0o222, 0);
    const html = await readFile(join(out, files.find(f => f.endsWith('.html'))), 'utf8');
    assert.match(html, /ENCH COMMAND/);
    assert.match(html, mode === 'ready' ? /Metadata připravena/ : /Nejdříve doplnit/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
