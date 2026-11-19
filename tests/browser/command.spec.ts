import { expect, test } from '@playwright/test';
import { render } from '../../command/evidence.mjs';
import { fixture } from '../../command/fixtures.mjs';
for (const failure of [false, true]) {
  test(`COMMAND TEST fixtures ${failure ? 'failure' : 'report'}`, async ({ page }, testInfo) => {
    const s = fixture();
    if (failure) { s.failures.push('TEST fixtures: Sběr selhal'); s.checks = []; }
    s.pr.title = 'TEST fixtures <img src=x onerror=alert(1)>';
    const requests: string[] = [];
    page.on('request', r => requests.push(r.url()));
    await page.setContent(render(s));
    await expect(page.getByText('TEST fixtures — syntetická data, žádný živý sběr')).toBeVisible();
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(failure ? 'Nejdříve doplnit důkazy' : 'Metadata připravena k lidské kontrole');
    await expect(page.getByRole('link', { name: 'Otevřít review na GitHubu' })).toHaveAttribute('href', 'https://github.com/mantesean/enchante-one/pull/5/files');
    await expect(page.locator('img,script,button')).toHaveCount(0);
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true);
    await testInfo.attach('command', { body: await page.screenshot({ fullPage: true, path: testInfo.outputPath("command-full.png") }), contentType: 'image/png' });
    await page.getByText('Identita a technický původ', { exact: true }).click();
    await expect(page.getByText('Neznámá — běh aplikace nebyl pozorován.')).toBeVisible();
    await page.getByText('Přesné zdroje sběru a časy (UTC)', { exact: true }).click();
    await expect(page.locator('li').filter({ hasText: 'https://api.github.com/repos/mantesean/enchante-one/pulls/5' })).toBeVisible();
    expect(requests).toEqual([]);
  });
}
