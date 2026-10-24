// Summarize scroll-bench output: frame stats per segment and per page section, worst LoAFs.
const fs = require("fs")
const file = process.argv[2]
const { profile, bounds, gpu, results } = JSON.parse(fs.readFileSync(file))
console.log(`\n######## ${file}  ${profile.width}x${profile.height}@${profile.dpr}x cpu/${profile.cpu}  gpu=${gpu}`)
console.log("bounds", bounds)

const pct = (a, p) => (a.length ? a.slice().sort((x, y) => x - y)[Math.min(a.length - 1, Math.floor((p / 100) * a.length))] : 0)
const stats = (frames) => {
  const dts = frames.map((f) => f.dt)
  if (!dts.length) return "no frames"
  const total = dts.reduce((a, b) => a + b, 0)
  // Vsync interval estimated from the fastest frames.
  const vsync = pct(dts, 10)
  const dropped = dts.reduce((s, dt) => s + Math.max(0, Math.round(dt / vsync) - 1), 0)
  const expected = Math.round(total / vsync)
  return `frames=${dts.length} fps=${((dts.length / total) * 1000).toFixed(1)} vsync≈${vsync.toFixed(1)}ms p50=${pct(dts, 50).toFixed(1)} p95=${pct(dts, 95).toFixed(1)} p99=${pct(dts, 99).toFixed(1)} max=${Math.max(...dts).toFixed(0)} | >33ms:${dts.filter((d) => d > 33.4).length} >50ms:${dts.filter((d) => d > 50).length} | dropped≈${dropped}/${expected} (${((dropped / expected) * 100).toFixed(1)}%)`
}

const sectionOf = (y) => {
  const mid = y + bounds.vh / 2
  if (mid < bounds.vh * 1.0) return "1-hero"
  if (y + bounds.vh < bounds.footer) return "2-grid"
  if (y + bounds.vh * 0.85 < bounds.footer) return "3-grid→footer"
  return "4-footer(controller)"
}

for (const r of results) {
  console.log(`\n== ${r.label} (${r.wallMs}ms wall)`)
  console.log("  all:", stats(r.frames))
  if (r.label.startsWith("scroll")) {
    const by = {}
    for (const f of r.frames) (by[sectionOf(f.y)] ??= []).push(f)
    for (const k of Object.keys(by).sort()) console.log(`  ${k.padEnd(22)}`, stats(by[k]))
  }
  const c = r.cdp
  const sec = r.wallMs / 1000
  console.log(
    `  main thread busy ${((c.TaskDuration / sec) * 100).toFixed(0)}% | script ${(c.ScriptDuration * 1000).toFixed(0)}ms style ${(c.RecalcStyleDuration * 1000).toFixed(0)}ms (${c.RecalcStyleCount}x) layout ${(c.LayoutDuration * 1000).toFixed(0)}ms (${c.LayoutCount}x) | heap ${c.JSHeapUsedMB}MB nodes ${c.Nodes}`,
  )
  console.log(`  LoAF (>50ms): ${r.loaf.length}, total ${r.loaf.reduce((s, l) => s + l.d, 0).toFixed(0)}ms; layout shifts during: ${r.shifts.length} (Σ ${r.shifts.reduce((s, x) => s + x.v, 0).toFixed(4)})`)
  const agg = {}
  for (const l of r.loaf) {
    const sec = sectionOf(l.y)
    for (const s of l.scripts) {
      const k = `${s.inv} @ ${s.src}`
      agg[k] ??= { n: 0, d: 0, fl: 0 }
      agg[k].n++
      agg[k].d += s.d
      agg[k].fl += s.fl || 0
    }
    ;(agg["__render"] ??= { n: 0, d: 0, fl: 0 }).d += l.render
    agg["__render"].n++
    ;(agg["__styleLayout"] ??= { n: 0, d: 0, fl: 0 }).d += l.styleLayout
    ;(agg["__sec:" + sec] ??= { n: 0, d: 0, fl: 0 }).d += l.d
    agg["__sec:" + sec].n++
  }
  for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].d - a[1].d).slice(0, 14))
    console.log(`    ${v.d.toFixed(0).padStart(6)}ms ${String(v.n).padStart(4)}x  forcedLayout ${v.fl.toFixed(0)}ms  ${k.slice(0, 110)}`)
}
