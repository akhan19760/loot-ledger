import { useSyncExternalStore } from "react"

// Sound effects, synthesized with the Web Audio API: no files to download, and each one
// is a few oscillators or a burst of filtered noise. Browsers only allow audio after the
// reader has interacted with the page, so nothing plays before the first click or key.

export type Sound = "hover" | "click" | "on" | "off" | "open" | "close" | "tick"

const KEY = "lootledger-sound" // "off" when muted; on by default
const VOLUME = 0.6

let enabled = (() => {
  try {
    return localStorage.getItem(KEY) !== "off"
  } catch {
    return true
  }
})()
const listeners = new Set<() => void>()

let ctx: AudioContext | null = null
let master: GainNode
let noise: AudioBuffer

/** The audio graph, made on the first interaction (browsers block audio before one). */
function audio() {
  if (!ctx) {
    ctx = new AudioContext()
    master = ctx.createGain()
    master.gain.value = VOLUME
    master.connect(ctx.destination)
    noise = ctx.createBuffer(1, ctx.sampleRate, ctx.sampleRate)
    const data = noise.getChannelData(0)
    for (let i = 0; i < data.length; i++) data[i] = Math.random() * 2 - 1
  }
  if (ctx.state === "suspended") void ctx.resume()
  return ctx
}

/** Start audio on the first click, tap or key (the only events that may start it). */
export function unlockAudio() {
  if (enabled) audio()
}

interface Envelope {
  /** Seconds from now. */
  at?: number
  /** Seconds, attack to silence. */
  dur: number
  gain: number
}

/** One oscillator: a pitch, optionally sliding to another, with a quick attack and decay. */
function tone(ac: AudioContext, freq: number, { at = 0, dur, gain, to, type = "sine" }: Envelope & { to?: number; type?: OscillatorType }) {
  const t = ac.currentTime + at
  const osc = ac.createOscillator()
  osc.type = type
  osc.frequency.setValueAtTime(freq, t)
  if (to) osc.frequency.exponentialRampToValueAtTime(to, t + dur)
  osc.connect(envelope(ac, t, dur, gain))
  osc.start(t)
  osc.stop(t + dur + 0.02)
}

/** Filtered noise: a click when short, a whoosh when long and swept. */
function hiss(ac: AudioContext, freq: number, { at = 0, dur, gain, to, filter = "bandpass", q = 1 }: Envelope & { to?: number; filter?: BiquadFilterType; q?: number }) {
  const t = ac.currentTime + at
  const src = ac.createBufferSource()
  src.buffer = noise
  const f = ac.createBiquadFilter()
  f.type = filter
  f.Q.value = q
  f.frequency.setValueAtTime(freq, t)
  if (to) f.frequency.exponentialRampToValueAtTime(to, t + dur)
  src.connect(f).connect(envelope(ac, t, dur, gain))
  src.start(t, Math.random() * 0.5)
  src.stop(t + dur + 0.02)
}

function envelope(ac: AudioContext, t: number, dur: number, gain: number) {
  const g = ac.createGain()
  g.gain.setValueAtTime(0.0001, t)
  g.gain.exponentialRampToValueAtTime(gain, t + Math.min(0.006, dur / 4))
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur)
  g.connect(master)
  return g
}

const SOUNDS: Record<Sound, (ac: AudioContext, strength: number) => void> = {
  // A faint high tick as the pointer reaches something clickable.
  hover: (ac) => tone(ac, 1900 * (0.97 + Math.random() * 0.06), { dur: 0.04, gain: 0.03, to: 2300 }),
  // A soft press: a falling blip over a tiny noise transient.
  click: (ac) => {
    tone(ac, 520, { dur: 0.09, gain: 0.14, to: 260, type: "triangle" })
    hiss(ac, 2800, { dur: 0.02, gain: 0.06, filter: "highpass" })
  },
  // Something switched on (a chip, a filter, the wishlist): two notes up.
  on: (ac) => {
    tone(ac, 660, { dur: 0.08, gain: 0.1, type: "triangle" })
    tone(ac, 990, { at: 0.06, dur: 0.14, gain: 0.1, type: "triangle" })
  },
  // ...and off: two notes down.
  off: (ac) => {
    tone(ac, 880, { dur: 0.07, gain: 0.09, type: "triangle" })
    tone(ac, 587, { at: 0.05, dur: 0.12, gain: 0.09, type: "triangle" })
  },
  // A dialog opens: a rising whoosh with a soft tone under it.
  open: (ac) => {
    hiss(ac, 300, { dur: 0.3, gain: 0.1, to: 2600, q: 0.8 })
    tone(ac, 392, { at: 0.02, dur: 0.26, gain: 0.04, to: 784 })
  },
  // ...and closes: the same, falling.
  close: (ac) => {
    hiss(ac, 2400, { dur: 0.24, gain: 0.08, to: 300, q: 0.8 })
    tone(ac, 700, { dur: 0.2, gain: 0.035, to: 350 })
  },
  // A notch of a scroll wheel; `strength` (0–1) follows the scroll speed.
  tick: (ac, strength) => hiss(ac, 1800 + strength * 1400, { dur: 0.014, gain: 0.015 + strength * 0.035, q: 4 }),
}

/** Play a sound, if sound is on and the page has been interacted with. */
export function play(sound: Sound, strength = 1) {
  if (!enabled || !ctx || ctx.state !== "running" || document.hidden) return
  SOUNDS[sound](ctx, Math.min(1, Math.max(0, strength)))
}

function setEnabled(next: boolean) {
  enabled = next
  try {
    localStorage.setItem(KEY, next ? "on" : "off")
  } catch {
    // Storage blocked: the choice lasts until reload.
  }
  listeners.forEach((l) => l())
}

/** Whether sound is on (remembered per browser), and a toggle that confirms with a sound. */
export function useSound() {
  const on = useSyncExternalStore(
    (l) => {
      listeners.add(l)
      return () => void listeners.delete(l)
    },
    () => enabled,
  )
  const toggle = () => {
    setEnabled(!on)
    if (on) return
    const ac = audio()
    if (ac.state === "running") play("on")
    else void ac.resume().then(() => play("on"))
  }
  return { on, toggle }
}
