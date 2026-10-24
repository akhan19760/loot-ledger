// Scroll-animation benchmark: drives Lenis with real wheel events and records frame timing,
// long animation frames (LoAF), layout/style counts and a DevTools trace.
// Usage: node scroll-bench.cjs <profile: desktop|mobile> <outdir>
const puppeteer = require("puppeteer-core")
const fs = require("fs")
const path = require("path")

const PROFILES = {
  desktop: { width: 1440, height: 900, dpr: 1, cpu: 1, notch: 120, gap: 50 },
  // Mid-tier phone stand-in: phone viewport at DPR 3, 4x CPU slowdown (Lighthouse's mobile CPU factor).
  mobile: { width: 390, height: 844, dpr: 3, cpu: 4, notch: 120, gap: 50 },
}
const [, , name = "desktop", outdir = "."] = process.argv
const P = PROFILES[name]
const URL = process.env.URL || "http://localhost:4173/"

const sleep = (ms) => new Promise((r) => setTimeout(r, ms))

;(async () => {
  const browser = await puppeteer.launch({
    executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe",
    headless: false, // real GPU compositing and WebGL, as users get
    defaultViewport: null,
    args: [`--window-size=${P.width + 16},${P.height + 140}`, "--no-first-run", "--disable-extensions"],
  })
  const page = (await browser.pages())[0]
  await page.setViewport({ width: P.width, height: P.height, deviceScaleFactor: P.dpr, isMobile: false })
  const cdp = await page.createCDPSession()
  await cdp.send("Performance.enable")
  if (P.cpu > 1) await cdp.send("Emulation.setCPUThrottlingRate", { rate: P.cpu })

  // Collectors installed before any page script runs.
  await page.evaluateOnNewDocument(() => {
    const w = window
    w.__frames = []
    w.__loaf = []
    w.__shifts = []
    w.__rec = false
    let last = 0
    const tick = (t) => {
      if (w.__rec && last) w.__frames.push({ dt: t - last, y: scrollY, t })
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
    try {
      new PerformanceObserver((l) => {
        for (const e of l.getEntries())
          if (w.__rec)
            w.__loaf.push({
              d: e.duration,
              block: e.blockingDuration,
              render: e.renderStart ? e.startTime + e.duration - e.renderStart : 0,
              styleLayout: e.styleAndLayoutStart ? e.startTime + e.duration - e.styleAndLayoutStart : 0,
              y: scrollY,
              scripts: e.scripts.map((s) => ({ d: s.duration, inv: s.invoker, src: (s.sourceURL || "").split("/").pop() + ":" + s.sourceFunctionName, fl: s.forcedStyleAndLayoutDuration })),
            })
      }).observe({ type: "long-animation-frame", buffered: false })
      new PerformanceObserver((l) => {
        for (const e of l.getEntries()) if (w.__rec) w.__shifts.push({ v: e.value, y: scrollY, src: e.sources?.map((s) => s.node?.className?.toString().slice(0, 60)) })
      }).observe({ type: "layout-shift" })
    } catch {}
  })

  const metrics = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((m) => [m.name, m.value]))

  await page.goto(URL, { waitUntil: "networkidle2", timeout: 120000 })
  // Wait for the loading screen's START, then press it.
  await page.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /start/i.test(b.textContent) && document.activeElement === b), { timeout: 60000 }).catch(() => {})
  await page.keyboard.press("Enter")
  await sleep(4000) // hand-off and hero entrance

  // Section boundaries in page coordinates.
  const bounds = await page.evaluate(() => {
    const abs = (el) => (el ? el.getBoundingClientRect().top + scrollY : null)
    return { hero: abs(document.querySelector("#hero-title")?.closest("section")), footer: abs(document.querySelector("footer")), height: document.documentElement.scrollHeight, vh: innerHeight }
  })

  const segment = async (label, fn) => {
    await page.evaluate(() => {
      window.__frames = []
      window.__loaf = []
      window.__shifts = []
      window.__rec = true
    })
    const m0 = await metrics()
    const t0 = Date.now()
    await fn()
    const wall = Date.now() - t0
    const m1 = await metrics()
    const data = await page.evaluate(() => {
      window.__rec = false
      return { frames: window.__frames, loaf: window.__loaf, shifts: window.__shifts }
    })
    const d = (k) => +(m1[k] - m0[k]).toFixed(3)
    return {
      label,
      wallMs: wall,
      cdp: {
        TaskDuration: d("TaskDuration"),
        ScriptDuration: d("ScriptDuration"),
        LayoutDuration: d("LayoutDuration"),
        RecalcStyleDuration: d("RecalcStyleDuration"),
        LayoutCount: d("LayoutCount"),
        RecalcStyleCount: d("RecalcStyleCount"),
        JSHeapUsedMB: +(m1.JSHeapUsedSize / 1048576).toFixed(1),
        Nodes: m1.Nodes,
      },
      ...data,
    }
  }

  if (process.env.CSS) await page.addStyleTag({ content: process.env.CSS })
  const results = []
  results.push(await segment("idle-top-3s", () => sleep(3000)))
  if (process.env.IDLEONLY) { fs.writeFileSync(path.join(outdir, `scroll-${name}.json`), JSON.stringify({ profile: P, bounds, gpu: "-", results }, null, 1)); await browser.close(); return }

  await page.mouse.move(P.width - 2, P.height - 2) // park the pointer at the edge: no hover effects
  if (!process.env.NOTRACE) await cdp.send("Tracing.start", {
    categories: "devtools.timeline,disabled-by-default-devtools.timeline,disabled-by-default-devtools.timeline.frame,blink.user_timing,gpu,cc,viz,latencyInfo",
    transferMode: "ReturnAsStream",
  })
  results.push(
    await segment("scroll-down", async () => {
      let lastY = -1
      let still = 0
      for (let i = 0; i < 2000 && still < 30; i++) {
        await page.mouse.wheel({ deltaY: P.notch })
        await sleep(P.gap)
        const y = await page.evaluate(() => scrollY)
        still = Math.abs(y - lastY) < 1 ? still + 1 : 0
        lastY = y
      }
      await sleep(1500) // let Lenis and the controller settle
    }),
  )
  if (!process.env.NOTRACE) { const traceDone = new Promise((res) => cdp.once("Tracing.tracingComplete", res))
  await cdp.send("Tracing.end")
  const { stream } = await traceDone
  const chunks = []
  for (;;) {
    const r = await cdp.send("IO.read", { handle: stream })
    chunks.push(r.base64Encoded ? Buffer.from(r.data, "base64") : Buffer.from(r.data))
    if (r.eof) break
  }
  await cdp.send("IO.close", { handle: stream })
  fs.writeFileSync(path.join(outdir, `trace-${name}.json`), Buffer.concat(chunks)) }

  results.push(await segment("idle-bottom-3s", () => sleep(3000)))
  results.push(
    await segment("scroll-up-fast", async () => {
      for (let i = 0; i < 400; i++) {
        await page.mouse.wheel({ deltaY: -P.notch * 4 })
        await sleep(30)
        if (i % 10 === 0 && (await page.evaluate(() => scrollY)) < 5) break
      }
      await sleep(1500)
    }),
  )

  const gpu = await page.evaluate(() => {
    const gl = document.createElement("canvas").getContext("webgl")
    const ext = gl?.getExtension("WEBGL_debug_renderer_info")
    return ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : "unknown"
  })
  fs.writeFileSync(path.join(outdir, `scroll-${name}.json`), JSON.stringify({ profile: P, bounds, gpu, results }, null, 1))
  console.log("done", name, bounds, gpu)
  await browser.close()
})().catch((e) => {
  console.error(e)
  process.exit(1)
})
