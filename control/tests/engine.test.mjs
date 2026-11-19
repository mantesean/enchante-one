import test from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import * as engine from '../src/engine.mjs';
for (const name of ['validateIntent', 'createTask', 'transition', 'saveTask', 'loadTask', 'updateTask']) {
  test(`${name} fails closed even with forged approval`, () => {
    assert.throws(() => engine[name]({id:'../sentinel',state:'approved',approval:'founder'}, 'released', {actor:'founder',evidence:'forged'}), /retired/);
  });
}
test('retired writer cannot overwrite existing evidence', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'ench-retired-'));
  const file = join(dir, 'sentinel.json');
  await writeFile(file, 'original');
  assert.throws(() => engine.updateTask({id:'sentinel',state:'released'},dir), /retired/);
  assert.equal(await readFile(file,'utf8'),'original');
});
for(const command of ['intent','status','advance']) {
  test(`CLI ${command} rejects forged ENCH_ACTOR`, () => {
    const result=spawnSync(process.execPath,['control/src/cli.mjs',command,'../sentinel','released'],{env:{...process.env,ENCH_ACTOR:'founder'},encoding:'utf8'});
    assert.equal(result.status,1); assert.match(result.stderr,/retired/); assert.equal(result.stdout,'');
  });
}
