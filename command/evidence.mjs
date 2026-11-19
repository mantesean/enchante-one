import { execFile } from 'node:child_process';
import { promisify } from 'node:util';
const exec = promisify(execFile);
export const REPO = 'mantesean/enchante-one';
const root = `repos/${REPO}`;
export function prNumber(value) {
  if (!/^[1-9]\d*$/.test(String(value)) || !Number.isSafeInteger(Number(value))) throw new Error('Expected a positive PR number');
  return Number(value);
}
async function ghGet(path) {
  const { stdout } = await exec('gh', ['api', '--hostname', 'github.com', '--method', 'GET', path], {
    timeout: 20000, maxBuffer: 4 * 1024 * 1024, encoding: 'utf8',
    env: { ...process.env, GH_PROMPT_DISABLED: '1', GH_PAGER: 'cat' },
  });
  return JSON.parse(stdout);
}
export async function collect(number, get = ghGet) {
  number = prNumber(number);
  const s = { number, fetchedAt: new Date().toISOString(), sources: [], failures: [], runtime: 'unknown' };
  async function read(path) {
    const source = { endpoint: `https://api.github.com/${path}`, fetchedAt: new Date().toISOString() };
    s.sources.push(source);
    try { return await get(path); } catch { source.failed = true; s.failures.push(`Sběr selhal: ${path}`); return null; }
  }
  async function list(path, key) {
    const all = [];
    for (let page = 1; page <= 20; page++) {
      const data = await read(`${path}${path.includes('?') ? '&' : '?'}per_page=100&page=${page}`);
      const rows = key ? data?.[key] : data;
      if (!Array.isArray(rows)) { s.failures.push(`Neúplná kolekce: ${path}`); return null; }
      all.push(...rows);
      if (rows.length < 100) {
        if (key && Number.isInteger(data.total_count) && data.total_count !== all.length) {
          s.failures.push(`Počet položek nesouhlasí: ${path}`); return null;
        }
        return all;
      }
    }
    s.failures.push(`Limit stránkování: ${path}`); return null;
  }
  s.pr = await read(`${root}/pulls/${number}`);
  const sha = s.pr?.head?.sha;
  if (/^[a-f0-9]{40}$/.test(sha) && /^[a-f0-9]{40}$/.test(s.pr?.base?.sha) && s.pr?.base?.repo?.full_name === REPO && s.pr?.base?.repo?.private === false) {
    s.workflow = await read(`${root}/actions/workflows/ci.yml`);
    s.checks = await list(`${root}/commits/${sha}/check-runs?filter=latest`, 'check_runs');
    s.reviews = await list(`${root}/pulls/${number}/reviews`);
    if (Number.isSafeInteger(s.workflow?.id)) {
      s.runs = await list(`${root}/actions/workflows/${s.workflow.id}/runs?head_sha=${sha}&event=pull_request`, 'workflow_runs');
      const run = latestRun(s);
      if (run && Number.isSafeInteger(run.id) && Number.isSafeInteger(run.run_attempt)) {
        s.jobs = await list(`${root}/actions/runs/${run.id}/attempts/${run.run_attempt}/jobs`, 'jobs');
        s.artifacts = await list(`${root}/actions/runs/${run.id}/artifacts`, 'artifacts');
        s.runEnd = await read(`${root}/actions/runs/${run.id}`);
        s.runsEnd = await list(`${root}/actions/workflows/${s.workflow.id}/runs?head_sha=${sha}&event=pull_request`, 'workflow_runs');
      }
    }
    s.prEnd = await read(`${root}/pulls/${number}`);
  } else s.failures.push('Veřejný cílový repozitář nebo SHA nebyl ověřen.');
  s.completedAt = new Date().toISOString();
  return s;
}
function latestRun(s) {
  return s.runs?.filter(r => r.head_sha === s.pr?.head?.sha && r.workflow_id === s.workflow?.id && r.event === 'pull_request')
    .sort((a,b) => b.run_number - a.run_number || b.run_attempt - a.run_attempt)[0];
}
function associatedRun(run, s) {
  return run?.pull_requests?.some(p => p.number === s.number && p.base?.sha === s.pr?.base?.sha && p.head?.sha === s.pr?.head?.sha) === true;
}
export function assess(s) {
  const blockers = [...s.failures];
  const sha = s.pr?.head?.sha;
  if (!sha || s.prEnd?.head?.sha !== sha) blockers.push('Head SHA se změnilo nebo nebylo znovu ověřeno.');
  if (!s.pr?.base?.sha || s.prEnd?.base?.sha !== s.pr.base.sha) blockers.push('Base SHA se změnilo nebo nebylo znovu ověřeno.');
  if (s.pr?.draft !== false || s.prEnd?.draft !== false) blockers.push('PR je draft nebo stav není známý.');
  if (s.pr?.state !== 'open' || s.prEnd?.state !== 'open') blockers.push('PR není ověřeno jako otevřené.');
  const run = latestRun(s);
  const lastRun = latestRun({ ...s, runs: s.runsEnd });
  const jobs = s.jobs?.filter(j => j.name === 'verify');
  const job = jobs?.length === 1 ? jobs[0] : null;
  const check = s.checks?.find(c => job?.check_run_url === `https://api.github.com/${root}/check-runs/${c.id}`);
  const pilot = associatedRun(run, s) && associatedRun(lastRun, s) && associatedRun(s.runEnd, s) && s.workflow?.name === 'Pilot checks' && s.workflow?.path === '.github/workflows/ci.yml' &&
    run?.path === '.github/workflows/ci.yml' && run?.status === 'completed' && run?.conclusion === 'success' &&
    lastRun?.id === run?.id && lastRun?.run_attempt === run?.run_attempt &&
    s.runEnd?.workflow_id === s.workflow?.id && s.runEnd?.path === '.github/workflows/ci.yml' && s.runEnd?.id === run?.id && s.runEnd?.head_sha === sha && s.runEnd?.run_attempt === run?.run_attempt && s.runEnd?.status === 'completed' && s.runEnd?.conclusion === 'success' &&
    job?.run_id === run?.id && job?.head_sha === sha && job?.run_attempt === run?.run_attempt && job?.status === 'completed' && job?.conclusion === 'success' &&
    check?.name === 'verify' && check?.head_sha === sha && check?.app?.id === 15368 && check?.app?.slug === 'github-actions' && check?.status === 'completed' && check?.conclusion === 'success';
  if (!pilot) blockers.push('Pilot checks / verify: chybí aktuální úspěch s ověřeným původem a posledním pokusem.');
  const reviewTimesKnown = (s.reviews ?? []).every(r => !['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state) || Number.isFinite(Date.parse(r.submitted_at)));
  const effective = new Map();
  for (const r of [...(s.reviews ?? [])].sort((a,b) => Date.parse(a.submitted_at) - Date.parse(b.submitted_at) || a.id - b.id)) {
    if (r.user?.login && ['APPROVED','CHANGES_REQUESTED','DISMISSED'].includes(r.state)) effective.set(r.user.login.toLowerCase(), r);
  }
  const independent = [...effective.values()].filter(r => r.user?.type === 'User' && ['OWNER', 'MEMBER', 'COLLABORATOR'].includes(r.author_association) && r.user.login.toLowerCase() !== s.pr?.user?.login?.toLowerCase());
  const review = reviewTimesKnown && Boolean(s.pr?.user?.login) && Array.isArray(s.reviews) && independent.some(r => r.state === 'APPROVED' && r.commit_id === sha) && !independent.some(r => r.state === 'CHANGES_REQUESTED');
  if (!browserArtifacts(s, run).length) blockers.push('Chybí dostupná metadata browser-results archivu pro tento běh a SHA.');
  if (!review) blockers.push('Chybí aktuální nezávislá review bez nevyřešených požadavků na změny.');
  return { blockers, pilot: Boolean(pilot), review: Boolean(review), run, effective: [...effective.values()] };
}
function browserArtifacts(s, run) {
  return (s.artifacts ?? []).filter(x => x.name === 'browser-results' && x.expired === false && x.size_in_bytes > 0 && x.workflow_run?.head_sha === s.pr?.head?.sha && x.workflow_run?.id === run?.id && Number.isSafeInteger(x.id));
}
export function safeUrl(value) {
  return typeof value === 'string' && /^https:\/\/github\.com\/mantesean\/enchante-one\/(?:pull\/[1-9]\d*(?:\/(?:files|checks))?|actions\/runs\/[1-9]\d*(?:\/(?:job|artifacts)\/[1-9]\d*)?)(?:#[a-zA-Z0-9_-]+)?$/.test(value) ? value : null;
}
export const escape = value => String(value ?? 'neznámé').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const link = (url, label) => safeUrl(url) ? `<a href="${escape(url)}" rel="noreferrer">${escape(label)}</a>` : escape(label);
export function render(s) {
  const a = assess(s);
  const pr = `https://github.com/${REPO}/pull/${prNumber(s.number)}`;
  const artifacts = browserArtifacts(s, a.run);
  return `<!doctype html>
<html lang="cs">
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src 'unsafe-inline'; base-uri 'none'; form-action 'none'">
<title>ENCH COMMAND — důkazy PR</title>
<style>body{margin:0;background:#f7f8f9;color:#22272b;font:17px/1.6 system-ui}main{max-width:920px;margin:auto;padding:36px 24px}header{letter-spacing:.15em;font-weight:700}section{background:white;border:1px solid #dbe1e4;padding:24px;margin:24px 0;border-radius:12px}h1{font-size:clamp(28px,5vw,44px);line-height:1.15}h2{font-size:22px}a{color:#185746;overflow-wrap:anywhere}p,li,dd,code{overflow-wrap:anywhere}dt{font-weight:650}dd{margin:0 0 12px}.action{display:inline-block;background:#185746;color:white;padding:12px 18px;border-radius:6px}small{color:#4d5a54}</style>
<main>
<header>ENCH COMMAND</header>
<p>${s.fixture ? '<strong>TEST fixtures — syntetická data, žádný živý sběr</strong>' : 'Jednorázový snapshot — není živý'}</p>
<h1>${a.blockers.length ? 'Nejdříve doplnit důkazy' : 'Metadata připravena k lidské kontrole'}</h1>
<p>Snímek pořízen: ${escape(new Date(s.fetchedAt).toLocaleString('cs-CZ', { timeZone: 'Europe/Prague' }))} (Europe/Prague). Není živý.</p>
<p>PR #${s.number}: ${escape(s.pr?.title)}</p>
<p>Žádné testy ani review nejsou lidským souhlasem nebo oprávněním ke sloučení či nasazení.</p>
<a class="action" href="${pr}/files" rel="noreferrer">Otevřít review na GitHubu</a>
<section>
<h2>Rozhodnutí a blokery</h2>${a.blockers.length ? `<ul>${a.blockers.map(b => `<li>${escape(b)}</li>`).join('')}</ul>` : '<p>Sběr doložil kontrolovatelná metadata, nikoli obsah browser archivu. Rozhodnutí zůstává na člověku.</p>'}<p>Jistota: ${a.blockers.length ? 'neúplné nebo nevyhovující důkazy' : 'ověřené vazby v okamžiku sběru'}. Pozdější změny nejsou zachyceny.</p>
</section>
<section>
<details>
<summary>Identita a technický původ</summary>
<dl>
<dt>Zdroj PR</dt>
<dd>${link(pr,pr)}</dd>
<dt>SHA na začátku / konci</dt>
<dd>${escape(s.pr?.head?.sha)} / ${escape(s.prEnd?.head?.sha)}</dd>
<dt>Base SHA na začátku / konci</dt>
<dd>${escape(s.pr?.base?.sha)} / ${escape(s.prEnd?.base?.sha)}</dd>
<dt>Workflow ID / cesta</dt>
<dd>${escape(s.workflow?.id)} / ${escape(s.workflow?.path)}</dd>
<dt>Běh / pokus</dt>
<dd>${escape(a.run?.id)} / ${escape(a.run?.run_attempt)}</dd>
<dt>Joby a check identity</dt>
<dd>${(s.jobs ?? []).map(j => `${escape(j.name)} · job ${escape(j.id)} · ${escape(j.check_run_url)} · ${escape(j.status)} / ${escape(j.conclusion)}`).join('<br>')}</dd>
<dt>Check aplikace</dt>
<dd>${(s.checks ?? []).map(c => `${escape(c.id)} · ${escape(c.app?.slug)} / ${escape(c.app?.id)}`).join('<br>')}</dd>
<dt>Draft</dt>
<dd>${escape(s.pr?.draft)}</dd>
<dt>Sběr od / do (UTC)</dt>
<dd>${escape(s.fetchedAt)} / ${escape(s.completedAt)}</dd>
<dt>Runtime readiness</dt>
<dd>Neznámá — běh aplikace nebyl pozorován.</dd>
</dl>
</details>
</section>
<section>
<h2>Pilot checks / verify</h2>
<p>${a.pilot ? 'Ověřený úspěch pro zachycené SHA' : 'Neověřeno / nevyhovuje'}</p>
<p>${link(a.run?.html_url,a.run?.html_url ?? 'Zdroj běhu není dostupný')}</p>
<h2>GitHub review</h2>
<p>Formální GitHub approval od jiného účtu je oddělené od modelové kritiky. Modelový posudek sám není GitHub approval ani souhlas zakladatele.</p>
<p>${a.review ? 'GitHub approval od jiného účtu doloženo' : 'Neověřeno / nevyhovuje'}</p>
<details>
<summary>Podrobnosti review a SHA</summary>
<ul>${a.effective.map(r => `<li>${escape(r.user.login)} · ${escape(r.state)} · SHA ${escape(r.commit_id)} · ${link(r.html_url,r.html_url ?? 'odkaz neověřen')}</li>`).join('')}</ul>
</details>
</section>
<section>
<h2>Browser evidence</h2>${artifacts.length ? artifacts.map(x => `<p>${link(`https://github.com/${REPO}/actions/runs/${a.run.id}/artifacts/${x.id}`, 'browser-results')} — metadata potvrzují dostupný archiv pro SHA; obsah ani screenshoty nebyly staženy či ověřeny. Příslušnost k poslednímu pokusu není prokázána.</p>`).join('') : '<p>Neznámé — dostupný archiv pro aktuální SHA nebyl ověřen.</p>'}</section>
<section>
<details>
<summary>Přesné zdroje sběru a časy (UTC)</summary>
<p>API adresy jsou uvedeny jako text. Selhání jsou součástí blockerů; neexistuje demo fallback.</p>
<ul>${s.sources.map(x => `<li>${escape(x.endpoint)} · ${escape(x.fetchedAt)} · ${x.failed ? 'SELHÁNÍ' : 'odpověď přijata'}</li>`).join('')}</ul>
</details>
</section>
<footer>Lokální evidence adapter. Bez trvalého dohledu GPT, bez externích změn. Tělo PR se nezobrazuje.</footer>
</main>
</html>`;
}

export const outcome = s => s.failures.length ? 1 : assess(s).blockers.length ? 2 : 0;
