// Hover cost: with the page still, sweep the pointer across a row of cards and back,
// twice, and record frame times plus style/layout/paint work. Usage: URL=... node hover-bench.cjs
const puppeteer = require("puppeteer-core")
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const URL = process.env.URL || "http://localhost:4173/"

;(async () => {
  const b = await puppeteer.launch({ executablePath: "C:/Program Files/Google/Chrome/Application/chrome.exe", headless: false, defaultViewport: null, args: ["--window-size=1456,1040"] })
  const p = (await b.pages())[0]
  await p.setViewport({ width: 1440, height: 900 })
  const cdp = await p.createCDPSession()
  await cdp.send("Performance.enable")
  await p.evaluateOnNewDocument(() => {
    const w = window
    Object.assign(w, { __rec: false, __frames: [] })
    let last = 0
    const tick = (t) => {
      if (w.__rec && last) w.__frames.push(t - last)
      last = t
      requestAnimationFrame(tick)
    }
    requestAnimationFrame(tick)
  })
  await p.goto(URL, { waitUntil: "networkidle2" })
  await p.waitForFunction(() => [...document.querySelectorAll("button")].some((b) => /start/i.test(b.textContent) && document.activeElement === b), { timeout: 60000 }).catch(() => {})
  await p.keyboard.press("Enter")
  await sleep(4000)
  await p.mouse.move(1438, 10)
  await p.evaluate(() => document.querySelector("[data-game-card]").scrollIntoView({ block: "center" }))
  await sleep(3000)
  const y = await p.evaluate(() => { const b = document.querySelector("[data-game-card]").getBoundingClientRect(); return b.top + b.height * 0.6 })
  const m = async () => Object.fromEntries((await cdp.send("Performance.getMetrics")).metrics.map((x) => [x.name, x.value]))
  await p.evaluate(() => Object.assign(window, { __rec: true, __frames: [] }))
  const m0 = await m()
  for (let pass = 0; pass < 4; pass++)
    for (let i = 0; i <= 120; i++) {
      const t = pass % 2 ? 120 - i : i
      await p.mouse.move(20 + t * 11.7, y)
      await sleep(16)
    }
  await sleep(1000)
  const m1 = await m()
  const f = await p.evaluate(() => ((window.__rec = false), window.__frames))
  const s = [...f].sort((a, b) => a - b)
  const d = (k) => ((m1[k] - m0[k]) * 1000).toFixed(0)
  console.log(`${URL}: frames ${f.length}, p50 ${s[f.length >> 1].toFixed(1)} p95 ${s[Math.floor(f.length * 0.95)].toFixed(1)} max ${s[f.length - 1].toFixed(0)} | >20ms ${f.filter((x) => x > 20).length} (${((f.filter((x) => x > 20).length / f.length) * 100).toFixed(1)}%) | style ${d("RecalcStyleDuration")}ms layout ${d("LayoutDuration")}ms (${m1.LayoutCount - m0.LayoutCount}x) script ${d("ScriptDuration")}ms`)
  await b.close()
})()
