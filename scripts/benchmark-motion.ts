/** Paired CPU benchmark of the actual frame builder and Nowcaster.
 * BASELINE_ROOT=/tmp/straits-perf-baseline-c77c098 npx tsx scripts/benchmark-motion.ts
 * Deterministic synthetic moving tracks; this measures frame construction,
 * not whole-page FPS. Alternates baseline/candidate order, keeps every sample.
 */
import { resolve } from 'node:path';
import { readFile, writeFile } from 'node:fs/promises';
import { encodeSeries } from '../src/lib/tracks/codec';
import { Nowcaster } from '../src/lib/tracks/nowcast';
import type { TrackPayload } from '../src/lib/tracks/types';
import type { MapVessel } from '../src/lib/map/map-vessel';

const baseline = await import(resolve(process.env.BASELINE_ROOT ?? '/tmp/straits-perf-baseline-c77c098', 'src/lib/tracks/frame.ts'));
const candidate = await import('../src/lib/tracks/frame');
const count = Number(process.env.VESSELS ?? 3000);
let vessels: MapVessel[] = [];
let tracks: TrackPayload[] = [];
let tMin = 1030;
if (process.env.OBSERVED_DIR) {
  const dir = process.env.OBSERVED_DIR;
  const observedTracks = JSON.parse(await readFile(`${dir}/observed-tracks.json`, 'utf8')).value;
  vessels = JSON.parse(await readFile(`${dir}/observed-vessels.json`, 'utf8')).value.vessels;
  tracks = observedTracks.vessels;
  tMin = Date.parse(observedTracks.generatedAt) / 60000;
}
for (let i = 0; !process.env.OBSERVED_DIR && i < count; i++) {
  const lon = 43 + (i % 100) * .2, lat = 12 + Math.floor(i / 100) * .55;
  const mmsi = String(200000000 + i);
  vessels.push({ imo: null, mmsi, name: mmsi, flag: null, shipType: 80, destination: null, lastSeen: null, isSanctioned: false, sanctioningAuthority: null, sanctionReason: null, sanctionRiskCategory: null, anomalyType: null, anomalyConfidence: null, position: { time: '2026-10-14T00:00:00Z', latitude: lat, longitude: lon, speed: 12, course: 90, heading: 90, navStatus: 0, lowConfidence: false } });
  tracks.push({ mmsi, tier: (i % 3) as 0|1|2, score: 90, parts: [30,25,15,15,5], state: 'underway', sog: 12, cog: 90, lastRealAt: 1000, method: 'hybrid', tau: null, uncert: .03,
    path: encodeSeries(Array.from({length:61},(_,k)=>[1000+k*6,lat,lon+k*.02])), trail: encodeSeries(Array.from({length:121},(_,k)=>[640+k*3,lat,lon-.4+k*.0033])), cleaning: {kept:121,rejected:0,inland:0,rerouted:0} });
}
const nc = new Nowcaster(); nc.ingest(tracks,tMin);
const byMmsi = new Map(tracks.map(p=>[p.mmsi,p]));
const output = [];
for(const zoom of [5,7.5,10]) {
  const scale = 512 * 2 ** zoom;
  const mercatorY = (lat:number) => (1-Math.log(Math.tan(Math.PI/4+lat*Math.PI/360))/Math.PI)/2;
  const project = (lon:number,lat:number) => ({x:640+(lon-56)/360*scale,y:400+(mercatorY(lat)-mercatorY(25))*scale});
  const input = {vessels,nc,byMmsi,tMin,zoom,project,selected:null};
  // Match the baseline renderer's visibility thresholds, independently of the candidate.
  const smooth = (a:number,b:number) => { const u=Math.max(0,Math.min(1,(zoom-a)/(b-a))); return u*u*(3-2*u); };
  const visible = (f:ReturnType<typeof candidate.buildFrame>) => ({...f,
    tails:smooth(5.8,6.8)>.01 ? f.tails : [], ahead:smooth(6.6,7.6)>.01 ? f.ahead : [],
    rings:smooth(8.3,9.2)>.01 ? f.rings : [], glow:f.glowMix>.01 ? f.glow : [],
  });
  if(JSON.stringify(visible(baseline.buildFrame(input)))!==JSON.stringify(visible(candidate.buildFrame(input)))) throw new Error('Visible frame changed at zoom '+zoom);
  for(let i=0;i<3;i++) { baseline.buildFrame(input); candidate.buildFrame(input); }
  const samples:{arm:string,ms:number,ships:number,projections:number}[]=[];
  for(let trial=0;trial<20;trial++) {
    for(const [arm,mod] of trial%2 ? [['candidate',candidate],['baseline',baseline]] as const : [['baseline',baseline],['candidate',candidate]] as const) {
      let projections=0,ships=0;
      const start=performance.now();
      for(let frame=0;frame<3;frame++) {
        const f=mod.buildFrame({...input,tMin:tMin+frame*.0001,project:(lon:number,lat:number)=>{projections++;return project(lon,lat);}});
        ships=f.ships.length;
      }
      samples.push({arm,ms:(performance.now()-start)/3,ships,projections:projections/3});
    }
  }
  const med=(arm:string)=>{const v=samples.filter(s=>s.arm===arm).map(s=>s.ms).sort((a,b)=>a-b);return {p50:v[10],p95:v[19],n:v.length};};
  const result={zoom,vessels:vessels.length,tracks:tracks.length,fixture:process.env.OBSERVED_DIR ? 'observed' : 'synthetic',baseline:med('baseline'),candidate:med('candidate'),samples};
  output.push(result);console.log(JSON.stringify({...result,samples:undefined}));
}
await writeFile(process.env.OUT_FILE ?? 'artifacts/performance/2026-10-14/motion.json',JSON.stringify(output,null,2));
