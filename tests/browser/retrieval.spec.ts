import {test,expect} from '@playwright/test';
test('empty input, disabled retrieval and retry are honest',async({page})=>{
 const external:string[]=[];page.on('request',r=>{if(new URL(r.url()).hostname!=='127.0.0.1')external.push(r.url());});
 await page.goto('/');await page.getByRole('button',{name:'See your company'}).click();
 await expect(page.locator('#domain-error')).toContainText('Enter a public company domain');
 await page.getByRole('textbox',{name:'Company domain'}).fill('example.com');
 await page.getByRole('button',{name:'See your company'}).click();
 await expect(page.locator('#domain-error')).toContainText('No website was fetched');
 await expect(page.getByText('Founding Access')).toHaveCount(0);
 await page.getByRole('textbox',{name:'Company domain'}).fill('another.org');
 await page.getByRole('button',{name:'See your company'}).click();
 await expect(page.locator('#domain-error')).toContainText('Website retrieval is disabled');
 expect(external).toEqual([]);expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true);
});
test('fixture observations include limitations and usable next step',async({page})=>{
 await page.route('**/api/analyze',route=>route.fulfill({json:{ok:true,domain:'example.com',profile:{name:'TEST fixture',description:'Synthetic browser fixture',finalUrl:'https://example.com/',fetchedAt:'2026-11-19T00:00:00Z'},insights:[{id:'cta',title:'CTA-like text found in the HTML',status:'info',detail:'Visibility and destination behavior have not been verified.',evidence:'<a hidden href="/buy">Buy</a>',sourceUrl:'https://example.com/',observedAt:'2026-11-19T00:00:00Z',limitation:'Static response only; no rendered-page verification.'}],fetch:{ms:10,usedHttpFallback:false}}}));
 await page.goto('/');await page.getByRole('textbox',{name:'Company domain'}).fill('example.com');await page.getByRole('button',{name:'See your company'}).click();
 await expect(page.getByText('Static response only;', {exact:false})).toBeVisible();
 await expect(page.getByRole('heading',{name:'Choose one observation to verify'})).toBeVisible();
 await page.getByRole('button',{name:'Analyze another domain',exact:false}).click();
 await expect(page.getByRole('textbox',{name:'Company domain'})).toBeVisible();
});
