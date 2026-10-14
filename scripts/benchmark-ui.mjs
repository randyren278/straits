/** Production-build lab journeys through Umbra/WebKit. No remote writes.
 * BASE_URL=http://localhost:3101 LABEL=baseline RUNS=5 node scripts/benchmark-ui.mjs
 * Each run uses a fresh scratch profile. Startup uses the app's own marks;
 * transitions end at populated DOM, not just URL change. Raw samples are retained.
 */
import { execFileSync } from 'node:child_process';
import { mkdir, readFile, writeFile } from 'node:fs/promises';

const base = process.env.BASE_URL ?? 'http://localhost:3101';
const label = process.env.LABEL ?? 'baseline';
const runs = Number(process.env.RUNS ?? 5);
const measurePaint = process.env.MEASURE_PAINT === '1';
const includeCanary = process.env.INCLUDE_CANARY === '1';
const intentMs = Number(process.env.INTENT_MS ?? 0);
const out = process.env.OUT_DIR ?? 'artifacts/performance/2026-10-14';
const targets = JSON.parse(process.env.TARGETS ?? JSON.stringify([{ label, base, root: process.cwd() }]));
await mkdir(out, { recursive: true });
const script = `
const frames = () => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
async function waitFor(check) {
  const end = performance.now()+30000;
  while(!check()) {
    if(performance.now()>end) throw new Error('Timed out: '+location.pathname+' '+document.querySelector('main')?.innerText.slice(0,400));
    await new Promise(resolve=>setTimeout(resolve,10));
  }
  await frames();
}
const ready = {
  '/dashboard': () => document.querySelector('[data-testid="vessel-map-surface"][data-reveal-state="ready"]'),
  '/analytics': () => document.querySelectorAll('.recharts-wrapper').length>=4 && !document.body.innerText.includes('Loading analytics'),
  '/fleet': () => document.querySelector('tbody tr') && !/loading fleet/i.test(document.body.innerText),
  '/about': () => location.pathname==='/about' && document.querySelector('main'),
  '/investigations': () => document.querySelector('main [aria-busy="false"] h3'),
  '/coverage': () => document.querySelector('[aria-label="48-hour hourly collection heatstrip"]')?.children.length===48,
  '/scenarios': () => document.querySelector('[aria-label="Editable route comparison"]'),
  '/investigations/following': () => document.querySelector('main') && !document.body.innerText.includes('Checking current'),
  '/investigations/encounters': () => document.querySelector('main') && !document.body.innerText.includes('Loading the encounter ledger'),
};
const resources = () => performance.getEntriesByType('resource').filter(e=>e.name.includes('/api/')).map(e=>({path:new URL(e.name).pathname,query:new URL(e.name).search,start:e.startTime,end:e.responseEnd,ms:e.duration,bytes:e.decodedBodySize}));
const results={startup:{}, transitions:[], actions:[],scroll:null};
await waitFor(ready['/dashboard']);
results.startup={marks:performance.getEntriesByType('mark').map(e=>({name:e.name,ms:e.startTime})),navigation:performance.getEntriesByType('navigation')[0]?.toJSON(),resources:resources(),nodes:document.querySelectorAll('*').length,scriptBytes:performance.getEntriesByType('resource').filter(e=>e.initiatorType==='script').reduce((sum,e)=>sum+e.decodedBodySize,0)};
const painted = () => document.querySelectorAll('.recharts-area-curve').length>=8 && !document.querySelector('.recharts-area clipPath');
async function navigate(path,kind='first') {
  const link=[...document.querySelectorAll('a')].find(a=>a.getAttribute('href')===path);
  if(!link) throw new Error('No navigation link to '+path);
  const intentStart=performance.now();
  if(${intentMs}>0) {
    link.dispatchEvent(new MouseEvent('mouseover',{bubbles:true}));
    await new Promise(resolve=>setTimeout(resolve,${intentMs}));
  }
  const before=resources().length,start=performance.now();
  link.click();
  await frames();
  await waitFor(()=>location.pathname===path && ready[path]());
  const result={path,kind,ms:performance.now()-start,requests:resources().slice(before),nodes:document.querySelectorAll('*').length};
  if(${measurePaint} && path==='/analytics') { await waitFor(painted); result.paintMs=performance.now()-start; }
  result.intentToReadyMs=performance.now()-intentStart;
  results.transitions.push(result);
}
async function range(value) {
  const button=[...document.querySelectorAll('button')].find(b=>b.textContent.trim().toLowerCase()===value.replace('d',' days'));
  if(!button) throw new Error('No range button '+value);
  const before=resources().length,start=performance.now();
  button.click();
  await frames();
  await waitFor(ready['/analytics']);
  const result={action:'range-'+value,ms:performance.now()-start,requests:resources().slice(before)};
  if(${measurePaint}) { await waitFor(painted); result.paintMs=performance.now()-start; }
  results.actions.push(result);
}
await navigate('/analytics');
await range('90d');
await range('30d');
const gaps=[], scroller=document.scrollingElement;
let prev=0,offset=0;
for(let i=0;i<180;i++) {
  const now=await new Promise(requestAnimationFrame);
  if(prev) gaps.push(now-prev); prev=now;
  offset+=12; scroller.scrollTop=offset%(scroller.scrollHeight-innerHeight);
}
gaps.sort((a,b)=>a-b);
results.scroll={frames:gaps.length,p50:gaps[Math.floor(gaps.length*.5)],p95:gaps[Math.floor(gaps.length*.95)],over34ms:gaps.filter(n=>n>34).length,over50ms:gaps.filter(n=>n>50).length,gaps,scrollHeight:scroller.scrollHeight};
await navigate('/fleet');
for(const direction of ['Next page','Previous page','Next page','Previous page']) {
  const button=document.querySelector('button[aria-label="'+direction+'"]');
  if(!button) continue;
  const before=resources().length,start=performance.now(); button.click();
  await frames();
  await waitFor(ready['/fleet']);
  results.actions.push({action:direction,ms:performance.now()-start,requests:resources().slice(before)});
}
await navigate('/about');
await navigate('/analytics','revisit');
await navigate('/fleet','revisit');
if(${includeCanary}) {
  await navigate('/investigations');
  await navigate('/coverage');
  await navigate('/scenarios');
  await navigate('/investigations/following');
  await navigate('/investigations','revisit');
  await navigate('/investigations/encounters');
  const caseLink=document.querySelector('main a[href^="/investigations/encounters/"]');
  if(caseLink) {
    const start=performance.now(),before=resources().length,path=new URL(caseLink.href).pathname;
    caseLink.click(); await frames();
    await waitFor(()=>location.pathname===path && document.querySelector('[data-testid="encounter-coordinate-plot"]'));
    results.transitions.push({path,kind:'case',ms:performance.now()-start,requests:resources().slice(before)});
  }
  await navigate('/investigations','return');
  await navigate('/coverage','revisit');
}
return results;
`;
const results = new Map(targets.map(target => [target.label, []]));
for (let run = 0; run < runs; run++) {
 for (const target of run % 2 ? [...targets].reverse() : targets) {
  const { label, base } = target;
  const profile = `scratch-straits-${label}-${Date.now()}-${run}`;
  try {
    execFileSync('umbra', ['--profile', profile, 'open', 'about:blank'], { stdio: 'ignore' });
    execFileSync('umbra', ['--profile', profile, 'viewport', '1280', '900'], { stdio: 'ignore' });
    execFileSync('umbra', ['--profile', profile, 'open', `${base}/dashboard`], { stdio: 'ignore' });
    const output = execFileSync('umbra', ['--profile', profile, 'eval', '--timeout', '90', '--json'], { input: script, encoding: 'utf8', maxBuffer: 4_000_000 });
    const parsed = JSON.parse(output);
    if (parsed.error || !parsed.value?.startup) throw new Error(output);
    const buildId = target.root ? (await readFile(`${target.root}/.next/BUILD_ID`, 'utf8')).trim() : null;
    const sample = { label, run, base, buildId, at: new Date().toISOString(), viewport: '1280x900', intentMs, ...parsed.value };
    const samples = results.get(label);
    samples.push(sample);
    await writeFile(`${out}/${label}-ui.json`, JSON.stringify(samples, null, 2));
    console.log(JSON.stringify({ label, run, startup: sample.startup.marks, scriptBytes:sample.startup.scriptBytes, transitions: sample.transitions.map(t=>({path:t.path,kind:t.kind,ms:t.ms,paintMs:t.paintMs,api:t.requests.length})),actions:sample.actions.map(a=>({action:a.action,ms:a.ms,paintMs:a.paintMs,api:a.requests.length})),scroll:{...sample.scroll,gaps:undefined} }));
  } finally {
    execFileSync('umbra', ['--profile', profile, 'stop'], { stdio: 'ignore' });
  }
 }
}
