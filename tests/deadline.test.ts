import {describe,it,expect} from 'vitest';
import {safeFetch, type Transport, type Resolver} from '../src/lib/ssrf';
import {analyzeDomain} from '../src/lib/analyze';
const resolver:Resolver=async()=>[{address:'93.184.215.14',family:4}];
const never=()=>new Promise<never>(()=>{});
const good:Transport=async()=>({status:200,headers:{},readBody:async()=>Buffer.from('<title>Test</title>'),discard:()=>{}});
const pause=(ms:number)=>new Promise(r=>setTimeout(r,ms));
describe('bounded retrieval',()=>{
 for(const stage of ['dns','headers','body']) it(`bounds stalled ${stage}`,async()=>{
  const started=Date.now(); let discarded=false;
  await expect(safeFetch('https://example.com',{timeoutMs:25,resolver:stage==='dns'?never:resolver,transport:stage==='headers'?never:async()=>({status:200,headers:{},readBody:stage==='body'?never:async()=>Buffer.alloc(0),discard:()=>{discarded=true;}})})).rejects.toMatchObject({code:'timeout'});
  expect(Date.now()-started).toBeLessThan(500);
  if(stage==='body')expect(discarded).toBe(true);
 });
 it('pre-abort performs no DNS or network work',async()=>{
  const c=new AbortController();c.abort();let called=false;
  await expect(safeFetch('https://example.com',{signal:c.signal,resolver:async()=>{called=true;return resolver('example.com');},transport:good})).rejects.toMatchObject({code:'timeout'});
  expect(called).toBe(false);
 });
 it('late DNS resolution cannot start transport',async()=>{
  let calls=0;
  await expect(safeFetch('https://example.com',{timeoutMs:10,resolver:async()=>{await pause(60);return resolver('example.com');},transport:async r=>{calls++;return good(r);}})).rejects.toMatchObject({code:'timeout'});
  await pause(80);expect(calls).toBe(0);
 });
 it('discards transport that resolves after deadline',async()=>{
  let discarded=false;
  await expect(safeFetch('https://example.com',{timeoutMs:10,resolver,transport:async()=>{await pause(60);return {status:200,headers:{},readBody:never,discard:()=>{discarded=true;}};}})).rejects.toMatchObject({code:'timeout'});
  await pause(80);expect(discarded).toBe(true);
 });
 it('shares deadline across apex and www attempt',async()=>{
  const started=Date.now();const seen:string[]=[];
  const result=await analyzeDomain('example.com',{timeoutMs:40,resolver:async host=>{seen.push(host);await pause(25);if(host==='example.com')throw Error('no DNS');return resolver(host);},transport:good});
  expect(result).toMatchObject({ok:false,error:{code:'timeout'}});expect(Date.now()-started).toBeLessThan(500);expect(seen).toEqual(['example.com','www.example.com']);
 });
 it('never downgrades a failed TLS connection to HTTP',async()=>{
  const seen:string[]=[];
  const result=await analyzeDomain('example.com',{resolver,transport:async r=>{seen.push(r.url.protocol);throw Object.assign(Error('certificate invalid'),{code:'CERT_HAS_EXPIRED'});}});
  expect(result.ok).toBe(false);expect(seen).toEqual(['https:']);
 });
});

it('rejects HTTPS to HTTP redirects without contacting the new target',async()=>{
 let calls=0;
 await expect(safeFetch('https://example.com',{resolver,transport:async()=>{calls++;return {status:302,headers:{location:'http://example.com/'},readBody:never,discard:()=>{}};}})).rejects.toMatchObject({code:'bad_scheme'});
 expect(calls).toBe(1);
});
