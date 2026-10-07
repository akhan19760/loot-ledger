import { useEffect, useState } from "react"
import { AnimatePresence, m } from "motion/react"
import { Check, Link, MessageCircle, Share2 } from "lucide-react"
import { sharePath, shareText, type Game } from "@ugs/shared"
import { RollText } from "@/components/motion/roll-text"
import { Button } from "@/components/ui/button"
import { ease } from "@/lib/motion"

/** Phones and tablets: their share sheet lists WhatsApp and every other app. Desktops get the buttons. */
const hasShareSheet = () => typeof navigator.share === "function" && matchMedia("(hover: none)").matches

/**
 * Share a game: a /g/ link whose preview in WhatsApp (or anywhere) shows the cover and
 * today's cheapest price, with a message saying the same. On a phone this opens the share
 * sheet; elsewhere it shows "WhatsApp" and "Copy link".
 */
export function ShareButton({ game, storeNames }: { game: Game; storeNames: Map<string, string> }) {
  const [open, setOpen] = useState(false)
  const [copied, setCopied] = useState(false)
  const sheet = hasShareSheet()
  const url = location.origin + sharePath(game.id)
  const { title, message } = shareText(game, (id) => storeNames.get(id) ?? id)

  useEffect(() => {
    if (!copied) return
    const t = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(t)
  }, [copied])

  const share = async () => {
    if (sheet) {
      try {
        await navigator.share({ title, text: message, url })
        return
      } catch (e) {
        if ((e as DOMException).name === "AbortError") return // closed the sheet
      }
    }
    setOpen((o) => !o)
  }

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(url)
      setCopied(true)
    } catch {
      // No clipboard access (an insecure origin, say): WhatsApp still works.
    }
  }

  return (
    <div className="flex flex-wrap gap-2">
      <Button variant={open ? "default" : "secondary"} size="sm" aria-expanded={sheet ? undefined : open} onClick={share}>
        <Share2 />
        <RollText>Share</RollText>
      </Button>
      <AnimatePresence initial={false}>
        {open && (
          <m.div
            className="flex flex-wrap gap-2"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12, transition: { duration: 0.2 } }}
            transition={{ duration: 0.4, ease: ease.wg }}
          >
            <Button asChild variant="secondary" size="sm">
              <a href={`https://wa.me/?text=${encodeURIComponent(`${message} ${url}`)}`} target="_blank" rel="noopener">
                <MessageCircle />
                <RollText>WhatsApp</RollText>
              </a>
            </Button>
            <Button variant="secondary" size="sm" onClick={copy}>
              {copied ? <Check /> : <Link />}
              <RollText>{copied ? "Link copied" : "Copy link"}</RollText>
            </Button>
          </m.div>
        )}
      </AnimatePresence>
    </div>
  )
}
