// Dialog open/close benchmark (desktop): per-frame timing, page width, grid offset,
// the flying panel's box, LoAFs and layout counts for each open and close.
const puppeteer = require("puppeteer-core")
const fs = require("fs")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

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
    w.__rec = false
    w.__frames = []
    w.__loaf = []
    let last = 0
    const tick = (t) => {
      if (w.__rec && last) {
        const grid = document.querySelector("[data-game-card]")?.getBoundingClientRect()
        const fly = document.querySelector("div.fixed.z-\\[60\\]")?.getBoundingClientRect()
        w.__frames.push({ dt: t - last, cw: document.documentElement.clientWidth, gx: grid ? Math.round(grid.left * 10) / 10 : null, y: scrollY, fly: fly ? [Math.round(fly.left), Math.round(fly.top), Math.round(fly.width)] : null, html: document.documentElement.className })
      }
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    new PerformanceObserver((l) => {
      for (const e of l.getEntries()) if (w.__rec) w.__loaf.push({ d: Math.round(e.duration), styleLayout: Math.round(e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0), scripts: e.scripts.map((s) => `${Math.round(s.duration)}ms ${s.invoker} ${(s.sourceURL || "").split("/").pop()}:${s.sourceFunctionName} fl=${Math.round(s.forcedStyleAndLayoutDuration)}`) })
    }).observe({ type: "long-animation-frame" })
  })
  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]))

  await page.goto("http://localhost:4173/", { waitUntil: "networkidle2" })
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /start/i.test(b.textContent) && document.activeElement === b), { timeout: 60000 }).catch(() => {})
  await page.keyboard.press("Enter")
  await sleep(5000)
  // Into the grid, let cards reveal and the dialog chunk prefetch.
  await page.evaluate(() => document.querySelector("[data-game-card]")?.scrollIntoView({ block: "center" }))
  await page.mouse.move(1430, 890)
  await sleep(3000)

  const record = async (label, action, ms) => {
    await page.evaluate(() => {
      window.__frames = []
      window.__loaf = []
      window.__rec = true
    })
    const m0 = await metrics()
    await action()
    await sleep(ms)
    const m1 = await metrics()
    const data = await page.evaluate(() => {
      window.__rec = false
      return { frames: window.__frames, loaf: window.__loaf }
    })
    const dts = data.frames.map((f) => f.dt)
    const sorted = [...dts].sort((a, b) => a - b)
    const widths = [...new Set(data.frames.map((f) => f.cw))]
    const gxs = [...new Set(data.frames.map((f) => f.gx))]
    const ys = [...new Set(data.frames.map((f) => Math.round(f.y)))]
    console.log(`\n== ${label}`)
    console.log(`  frames ${dts.length}, p50 ${sorted[dts.length >> 1]?.toFixed(1)} p95 ${sorted[Math.floor(dts.length * 0.95)]?.toFixed(1)} max ${Math.max(...dts).toFixed(0)}ms, >20ms: ${dts.filter((d) => d > 20).length}`)
    console.log(`  layouts ${m1.LayoutCount - m0.LayoutCount} (${((m1.LayoutDuration - m0.LayoutDuration) * 1000).toFixed(0)}ms), style ${m1.RecalcStyleCount - m0.RecalcStyleCount} (${((m1.RecalcStyleDuration - m0.RecalcStyleDuration) * 1000).toFixed(0)}ms), script ${((m1.ScriptDuration - m0.ScriptDuration) * 1000).toFixed(0)}ms`)
    console.log(`  page width over time: ${widths.join(" → ")} | first card left: ${gxs.join(" → ")} | scrollY: ${ys.join(" → ")}`)
    const flights = data.frames.filter((f) => f.fly)
    if (flights.length) {
      const w = flights.map((f) => f.fly[2])
      const steps = w.slice(1).map((v, i) => v - w[i])
      console.log(`  panel frames ${flights.length}; width steps (px/frame): ${steps.join(",")}`)
      console.log(`  panel frame times: ${data.frames.map((f) => (f.fly ? Math.round(f.dt) : ".")).join(" ")}`)
    }
    for (const l of data.loaf) console.log(`  LoAF ${l.d}ms (style+layout ${l.styleLayout}ms): ${l.scripts.slice(0, 4).join(" | ")}`)
  }

  if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS })
  const cards = await page.$$eval("[data-game-card]", (els) =>
    els.filter((e) => { const r = e.getBoundingClientRect(); return r.top > 100 && r.bottom < innerHeight - 20 }).map((e) => e.getAttribute("data-game-card")),
  )
  const open = (id) => async () => {
    const r = await page.$eval(`[data-game-card="${id}"]`, (e) => { const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 } })
    await page.mouse.click(r.x, r.y)
  }
  const close = async () => page.keyboard.press("Escape")

  for (const [i, id] of cards.slice(0, 2).entries()) {
    await record(`open #${i + 1} (${id}, uncached)`, open(id), 1600)
    await record(`close #${i + 1}`, close, 1200)
    await page.mouse.move(1430, 890)
    await sleep(800)
  }
  await record(`open #3 (${cards[0]}, cached)`, open(cards[0]), 1600)
  await record("close #3", close, 1200)

  if (process.env.TRACE) {
    await page.mouse.move(1430, 890)
    await sleep(800)
    await cdp.send("Tracing.start", { categories: "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,gpu,cc,viz", transferMode: "ReturnAsStream" })
    await open(cards[1])()
    await sleep(1600)
    await close()
    await sleep(1200)
    const done = new Promise((res) => cdp.once("Tracing.tracingComplete", res))
    await cdp.send("Tracing.end")
    const { stream } = await done
    const chunks = []
    for (;;) {
      const r = await cdp.send("IO.read", { handle: stream })
      chunks.push(r.base64Encoded ? Buffer.from(r.data, "base64") : Buffer.from(r.data))
      if (r.eof) break
    }
    fs.writeFileSync("trace-dialog.json", Buffer.concat(chunks))
  }
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
