import {it,expect,afterEach,vi} from "vitest";
import {POST} from "../src/app/api/analyze/route";
import {resetLimitsForTests} from "../src/lib/limits";
afterEach(()=>{vi.unstubAllEnvs();resetLimitsForTests();});
it('retrieval defaults off before reading any user body',async()=>{
 vi.stubEnv('ENCH_PUBLIC_RETRIEVAL_ENABLED','');
 const res=await POST(new Request('http://localhost/api/analyze',{method:'POST',body:'invalid'}));
 expect(res.status).toBe(503);expect(await res.json()).toMatchObject({ok:false,error:{code:'unavailable'}});
});
it('rejects oversized body before analysis',async()=>{
 vi.stubEnv('ENCH_PUBLIC_RETRIEVAL_ENABLED','true');
 const res=await POST(new Request('http://localhost/api/analyze',{method:'POST',body:JSON.stringify({domain:'x'.repeat(5000)})}));
 expect(res.status).toBe(400);
});
it('forwarded IP rotation cannot bypass the per-instance cap',async()=>{
 vi.stubEnv('ENCH_PUBLIC_RETRIEVAL_ENABLED','true');
 for(let i=0;i<10;i++){const r=await POST(new Request('http://localhost/api/analyze',{method:'POST',headers:{'x-forwarded-for':`1.2.3.${i}`},body:'{}'}));expect(r.status).toBe(400);}
 const r=await POST(new Request('http://localhost/api/analyze',{method:'POST',headers:{'x-forwarded-for':'9.8.7.6'},body:'{}'}));expect(r.status).toBe(429);
});

for(const cancel of [()=>new Promise<void>(()=>{}),()=>Promise.reject(Error('cancel rejected'))]) {
 it('oversize request terminates even if cancel hangs or rejects',async()=>{
  vi.stubEnv('ENCH_PUBLIC_RETRIEVAL_ENABLED','true');
  const body=new ReadableStream({start(c){c.enqueue(new Uint8Array(5000));},cancel});
  const req=new Request('http://localhost/api/analyze',{method:'POST',body,duplex:'half'} as RequestInit);
  const result=await Promise.race([POST(req),new Promise<null>(r=>setTimeout(()=>r(null),300))]);
  expect(result?.status).toBe(400);
 });
}
it('stalled request body terminates at its deadline',async()=>{
 vi.stubEnv('ENCH_PUBLIC_RETRIEVAL_ENABLED','true');vi.useFakeTimers();
 try {
 const body=new ReadableStream({cancel:()=>new Promise<void>(()=>{})});
 const req=new Request('http://localhost/api/analyze',{method:'POST',body,duplex:'half'} as RequestInit);
 const pending=POST(req);await vi.advanceTimersByTimeAsync(2001);expect((await pending).status).toBe(400);
 } finally {vi.useRealTimers();}
});
