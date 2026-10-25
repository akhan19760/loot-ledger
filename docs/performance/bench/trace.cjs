const fs=require('fs'); const raw=JSON.parse(fs.readFileSync(process.argv[2])); const ev=raw.traceEvents||raw;
const tname={}; const pname={};
for(const e of ev){ if(e.ph==='M'&&e.name==='thread_name') tname[e.pid+':'+e.tid]=e.args.name; if(e.ph==='M'&&e.name==='process_name') pname[e.pid]=e.args.name; }
const agg={}; let t0=Infinity,t1=0;
for(const e of ev){ if(e.ph!=='X'||!e.dur) continue; const th=tname[e.pid+':'+e.tid]||'?'; if(!/CrRendererMain|Compositor|CrGpuMain|VizCompositor|CompositorTileWorker|RasterTask/.test(th)) continue;
  t0=Math.min(t0,e.ts); t1=Math.max(t1,e.ts+e.dur);
  const thg=th.replace(/\d+$/,''); const k=thg+' | '+e.name; (agg[k]??={n:0,d:0}); agg[k].n++; agg[k].d+=e.dur/1000; }
const span=(t1-t0)/1000; console.log('trace span',span.toFixed(0),'ms');
const want=/RunTask|ThreadControllerImpl::RunTask|TaskQueueManager/;
for(const [k,v] of Object.entries(agg).filter(([k])=>!want.test(k)).sort((a,b)=>b[1].d-a[1].d).slice(0,30)) console.log(v.d.toFixed(0).padStart(7)+'ms',String(v.n).padStart(6)+'x',k);
