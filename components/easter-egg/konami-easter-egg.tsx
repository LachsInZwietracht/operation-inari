"use client"

import dynamic from "next/dynamic"
import { useState } from "react"

import { useKonamiCode } from "@/hooks/use-konami-code"

// The game ships zero bytes until someone actually types the code.
const SnakeGameDialog = dynamic(
  () =>
    import("@/components/easter-egg/snake-game-dialog").then(
      (module) => module.SnakeGameDialog,
    ),
  { ssr: false },
)

/** Mounts an invisible Konami-code listener that opens Nutri-Snake. */
export function KonamiEasterEgg() {
  const [unlocked, setUnlocked] = useState(false)
  const [open, setOpen] = useState(false)

  useKonamiCode(() => {
    setUnlocked(true)
    setOpen(true)
  })

  if (!unlocked) return null

  return <SnakeGameDialog open={open} onOpenChange={setOpen} />
}
