import { test } from 'node:test';
import assert from 'node:assert/strict';
import { collect, assess, outcome, render, safeUrl, prNumber } from './evidence.mjs';
import { fixture } from './fixtures.mjs';
test('exact current provenance is evidence ready, never merge permission', () => {
  assert.equal(outcome(fixture()), 0);
  assert.match(render(fixture()), /oprávněním ke sloučení/);
});
for (const [name, change] of Object.entries({
  missingArtifact: s => s.artifacts = [], expiredArtifact: s => s.artifacts[0].expired = true,
  wrongPR: s => s.runs[0].pull_requests[0].number = 6, noPR: s => s.runs[0].pull_requests = [],
  wrongBase: s => s.runs[0].pull_requests[0].base.sha = 'c'.repeat(40), movedBase: s => s.prEnd.base.sha = 'c'.repeat(40),
  newerAtEnd: s => s.runsEnd.push({ ...s.runsEnd[0], id: 43, run_number: 3 }),
  stale: s => s.checks[0].head_sha = 'b'.repeat(40), empty: s => s.checks = [],
  failure: s => s.checks[0].conclusion = 'failure', pending: s => s.checks[0].status = 'in_progress', skipped: s => s.jobs[0].conclusion = 'skipped',
  spoof: s => s.checks[0].app.id = 1, workflow: s => s.workflow.path = 'other.yml', workflowId: s => s.runs[0].workflow_id = 8,
  job: s => s.jobs[0].check_run_url = 'https://evil.test/check-runs/9', attempt: s => s.jobs[0].run_attempt = 2,
  rerun: s => s.runEnd.run_attempt = 2, latest: s => s.runs.push({ ...s.runs[0], id: 43, run_number: 3, status: 'queued' }),
  moved: s => s.prEnd.head.sha = 'b'.repeat(40), draft: s => s.pr.draft = true,
  self: s => s.reviews[0].user.login = 'Author', staleReview: s => s.reviews[0].commit_id = 'old',
  dismissed: s => s.reviews.push({ ...s.reviews[0], id: 2, state: 'DISMISSED' }),
  changes: s => s.reviews.push({ ...s.reviews[0], id: 2, state: 'CHANGES_REQUESTED' }),
  otherChanges: s => s.reviews.push({ ...s.reviews[0], id: 2, user: { login: 'other', type: 'User' }, state: 'CHANGES_REQUESTED' }),
})) test(`blocked: ${name}`, () => { const s = fixture(); change(s); assert.equal(outcome(s), 2); });
test('comments do not cancel an effective review; subsequent approval resolves request', () => {
  const s = fixture(); s.reviews.push({ ...s.reviews[0], id: 2, state: 'COMMENTED' }); assert.equal(assess(s).review, true);
  s.reviews.push({ ...s.reviews[0], id: 3, state: 'CHANGES_REQUESTED' }, { ...s.reviews[0], id: 4 }); assert.equal(assess(s).review, true);
});
test('partial collection fails closed and still renders', async () => {
  const s = await collect(5, async path => { if (path.endsWith('/pulls/5')) return fixture().pr; throw Error('secret must not leak'); });
  assert.equal(outcome(s), 1); assert.match(render(s), /Sběr selhal/); assert.doesNotMatch(JSON.stringify(s), /secret/);
});
test('pagination completes or fails closed at the bounded cap', async () => {
  let pages = 0;
  const s = await collect(5, async path => {
    if (path.endsWith('/pulls/5')) return fixture().pr;
    if (path.includes('/reviews?')) { pages++; return Array(100).fill(fixture().reviews[0]); }
    if (path.includes('check-runs?')) return { check_runs: [] };
    return {};
  });
  assert.equal(pages, 20); assert.equal(outcome(s), 1); assert.equal(s.reviews, null);
});
test('malicious HTML and URLs remain inert, PR body omitted', () => {
  const s = fixture(); s.pr.title = '<img src=x onerror=alert(1)>'; s.pr.body = 'RAW BODY SECRET'; s.reviews[0].user.login = '<script>bad()</script>'; s.reviews[0].html_url = 'javascript:alert(1)';
  const html = render(s); assert.doesNotMatch(html, /<img|<script|RAW BODY SECRET|href="javascript/); assert.match(html, /&lt;img/);
  for (const u of ['https://github.com.evil.test/mantesean/enchante-one/pull/5', 'https://github.com/other/repo/pull/5', 'https://github.com/mantesean/enchante-one/pull/5?x=bad', 'https://github.com/mantesean/enchante-one/pull/5/../../evil', 'http://github.com/mantesean/enchante-one/pull/5']) assert.equal(safeUrl(u), null);
  for (const n of ['0','-1','1;whoami','1.2','9007199254740993']) assert.throws(() => prNumber(n));
});
test('reported total_count mismatch is incomplete, never green', async () => {
  const s = await collect(5, async path => {
    if (path.endsWith('/pulls/5')) return fixture().pr;
    if (path.includes('check-runs?')) return { check_runs: [], total_count: 101 };
    if (path.includes('/reviews?')) return [];
    return {};
  });
  assert.equal(s.checks, null); assert.equal(outcome(s), 1);
});
test('latest submitted review wins even when its id is older', () => {
  const s = fixture();
  s.reviews.push({ ...s.reviews[0], id: 2, state: 'CHANGES_REQUESTED', submitted_at: '2026-11-19T10:00:00Z' });
  assert.equal(assess(s).review, true);
  delete s.reviews[0].submitted_at;
  assert.equal(assess(s).review, false);
});
