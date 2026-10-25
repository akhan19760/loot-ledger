// Desktop grid scroll: frame times, scroll-step evenness (jitter), what runs in long frames,
// how often <html>.scrolling-fast flips, card mounts and hover activity.
// Usage: node grid-bench.cjs <pointer: center|edge> [notches]
const puppeteer = require("puppeteer-core")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const [, , pointer = "center", notchArg = "40"] = process.argv

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false,
    defaultViewport: null,
    args: ["--window-size=1456,1040", "--no-first-run", "--disable-extensions"],
  })
  const page = (await browser.pages())[0]
  await page.setViewport({ width: 1440, height: 900 })
  const cdp = await page.createCDPSession()
  await cdp.send("Performance.enable")
  await page.evaluateOnNewDocument(() => {
    const w = window
    Object.assign(w, { __rec: false, __frames: [], __loaf: [], __flips: 0, __mounts: 0, __hovers: 0, __blank: 0 })
    let last = 0
    let lastY = 0
    const tick = (t) => {
      if (w.__rec && last) {
        w.__frames.push({ dt: t - last, dy: scrollY - lastY })
        // A blank row: where the grid spans the screen's bottom edge, no card is drawn there.
        const grid = document.querySelector("[data-game-card]")?.closest("div.relative[style]")
        const r = grid?.getBoundingClientRect()
        if (r && r.top < innerHeight - 40 && r.bottom > innerHeight) {
          const el = document.elementFromPoint(r.left + 20, innerHeight - 30)
          if (!el?.closest("[data-game-card]")) w.__blank++
        }
      }
      last = t
      lastY = scrollY
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    new PerformanceObserver((l) => {
      for (const e of l.getEntries())
        if (w.__rec) w.__loaf.push({ d: e.duration, render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0, scripts: e.scripts.map((s) => ({ d: s.duration, k: `${s.invoker} ${(s.sourceURL || "").split("/").pop()}:${s.sourceFunctionName}`, fl: s.forcedStyleAndLayoutDuration })) })
    }).observe({ type: "long-animation-frame" })
    addEventListener("DOMContentLoaded", () => {
      new MutationObserver((ms) => w.__rec && (w.__flips += ms.length)).observe(document.documentElement, { attributes: true, attributeFilter: ["class"] })
      new MutationObserver((ms) => {
        if (!w.__rec) return
        for (const m of ms) for (const n of m.addedNodes) if (n.nodeType === 1 && n.querySelector?.("[data-game-card]")) w.__mounts++
      }).observe(document.body, { childList: true, subtree: true })
      document.addEventListener("pointerover", (e) => w.__rec && e.target.closest?.("[data-game-card]") && w.__hovers++, true)
    })
  })
  if (process.env.BLOCK3D) {
    await page.setRequestInterception(true)
    page.on("request", (q) => (/controller-scene|\/3d\//.test(q.url()) ? q.abort() : q.continue()))
  }
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]))

  await page.goto(process.env.URL || "http://localhost:4173/", { waitUntil: "networkidle2" })
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /start/i.test(b.textContent) && document.activeElement === b), { timeout: 60000 }).catch(() => {})
  await page.keyboard.press("Enter")
  await sleep(5000)
  // Start with the grid's top at the top of the screen.
  await page.evaluate(() => {
    const top = document.querySelector("[data-game-card]").getBoundingClientRect().top + scrollY - 100
    window.scrollTo(0, top)
  })
  await sleep(2500)
  if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS })
  if (process.env.JS) await page.evaluate(process.env.JS)
  await page.mouse.move(pointer === "center" ? 720 : 1438, pointer === "center" ? 450 : 898)
  await sleep(500)

  await page.evaluate(() => Object.assign(window, { __rec: true, __frames: [], __loaf: [], __flips: 0, __mounts: 0, __hovers: 0, __blank: 0 }))
  const m0 = await metrics()
  // A mouse wheel: 120px notches, a few per second with pauses, like reading while scrolling.
  for (let i = 0; i < +notchArg; i++) {
    await page.mouse.wheel({ deltaY: 120 })
    await sleep(i % 4 === 3 ? 600 : 90)
  }
  await sleep(1200)
  const m1 = await metrics()
  const r = await page.evaluate(() => {
    window.__rec = false
    return { frames: window.__frames, loaf: window.__loaf, flips: window.__flips, mounts: window.__mounts, hovers: window.__hovers, blank: window.__blank }
  })

  const moving = r.frames.filter((f) => Math.abs(f.dy) > 0.5)
  const dts = moving.map((f) => f.dt).sort((a, b) => a - b)
  // Jitter: a frame whose scroll step is far off its neighbours' (Lenis eases smoothly, so
  // steps should change gradually; a long frame makes the next step jump to catch up).
  let jumps = 0
  for (let i = 1; i < moving.length - 1; i++) {
    const a = Math.abs(moving[i - 1].dy), b = Math.abs(moving[i].dy), c = Math.abs(moving[i + 1].dy)
    if (b > 1.6 * Math.max(a, c) && b - Math.max(a, c) > 4) jumps++
  }
  // Repeated frames: no scroll movement between two moving frames (a stall mid-glide).
  let stalls = 0
  for (let i = 1; i < r.frames.length - 1; i++) if (Math.abs(r.frames[i].dy) < 0.5 && Math.abs(r.frames[i - 1].dy) > 2 && Math.abs(r.frames[i + 1].dy) > 2) stalls++
  const longFrames = moving.filter((f) => f.dt > 20).length
  console.log(`\n=== grid scroll, pointer ${pointer}`)
  console.log(`moving frames ${moving.length}: p50 ${dts[dts.length >> 1].toFixed(1)} p95 ${dts[Math.floor(dts.length * 0.95)].toFixed(1)} p99 ${dts[Math.floor(dts.length * 0.99)].toFixed(1)} max ${dts[dts.length - 1].toFixed(0)}ms | dropped-frame moments ${longFrames} (${((longFrames / moving.length) * 100).toFixed(1)}%)`)
  console.log(`scroll-step jumps (catch-up after a slow frame) ${jumps}, mid-glide stalls ${stalls}`)
  console.log(`<html> class flips ${r.flips}, card rows mounted ${r.mounts}, card hovers ${r.hovers}, frames with a blank row at the bottom ${r.blank}`)
  console.log(`main thread: script ${((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(0)}ms, style ${((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000).toFixed(0)}ms (${m1.RecalcStyleCount - m0.RecalcStyleCount}x), layout ${((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(0)}ms (${m1.LayoutCount - m0.LayoutCount}x)`)
  const agg = {}
  for (const l of r.loaf) {
    for (const s of l.scripts) ((agg[s.k] ??= { n: 0, d: 0, fl: 0 }).n++, (agg[s.k].d += s.d), (agg[s.k].fl += s.fl))
    ;((agg["(rendering: style/layout/paint)"] ??= { n: 0, d: 0, fl: 0 }).n++, (agg["(rendering: style/layout/paint)"].d += l.render))
  }
  console.log(`long animation frames (>50ms): ${r.loaf.length}, ${r.loaf.map((l) => Math.round(l.d)).join(",")}`)
  for (const [k, v] of Object.entries(agg).sort((a, b) => b[1].d - a[1].d).slice(0, 8)) console.log(`  ${v.d.toFixed(0).padStart(5)}ms ${v.n}x forced-layout ${v.fl.toFixed(0)}ms  ${k}`)
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
