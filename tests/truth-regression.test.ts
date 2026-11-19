import {it,expect} from "vitest";
import {extractPage} from "../src/lib/extract";
import {deriveInsights} from "../src/lib/insights";
const now=new Date("2026-11-19T00:00:00Z");
for(const html of ['<a href="/kontakt">Kontaktujte nás</a>','<a href="/buy" hidden>Buy</a>','<button disabled>Buy</button>','<div id="app"></div><script>/* client-rendered CTA */</script>']) {
 it(`does not infer customer experience from ${html}`,()=>{
 const findings=deriveInsights({domain:"example.com",finalUrl:"https://example.com/",usedHttpFallback:false,headers:{},ms:100,page:extractPage(html)},now);
 const cta=findings.find(i=>i.id==='cta')!;
 expect(cta.title).not.toMatch(/Visitors have|No clear way/);
 expect(cta.detail).toMatch(/heuristic|heuristic/i);
 for(const i of findings){expect(i.observedAt).toBe(now.toISOString());expect(i.limitation).toContain('no rendered-page');}
 });
}
