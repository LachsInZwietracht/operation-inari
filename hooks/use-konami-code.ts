"use client"

import { useEffect, useRef } from "react"

const KONAMI_SEQUENCE = [
  "ArrowUp",
  "ArrowUp",
  "ArrowDown",
  "ArrowDown",
  "ArrowLeft",
  "ArrowRight",
  "ArrowLeft",
  "ArrowRight",
  "KeyB",
  "KeyA",
] as const

function isTypingTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) return false
  if (target.isContentEditable) return true
  const tag = target.tagName
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT"
}

/**
 * Fires `onUnlock` when the user types the Konami code
 * (↑ ↑ ↓ ↓ ← → ← → B A) anywhere outside a text field.
 */
export function useKonamiCode(onUnlock: () => void) {
  const progressRef = useRef(0)
  const onUnlockRef = useRef(onUnlock)

  useEffect(() => {
    onUnlockRef.current = onUnlock
  }, [onUnlock])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.metaKey || event.ctrlKey || event.altKey) return
      if (isTypingTarget(event.target)) {
        progressRef.current = 0
        return
      }

      const expected = KONAMI_SEQUENCE[progressRef.current]
      if (event.code === expected) {
        progressRef.current += 1
        if (progressRef.current === KONAMI_SEQUENCE.length) {
          progressRef.current = 0
          onUnlockRef.current()
        }
      } else {
        // A wrong key restarts the hunt; ArrowUp can still begin a new attempt.
        progressRef.current = event.code === KONAMI_SEQUENCE[0] ? 1 : 0
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [])
}
