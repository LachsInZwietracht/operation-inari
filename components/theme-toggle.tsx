"use client"

import { useRef } from "react"
import { flushSync } from "react-dom"
import { Moon, Sun } from "lucide-react"
import { useTheme } from "next-themes"
import { Button } from "@/components/ui/button"

type ViewTransitionDocument = Document & {
  startViewTransition?: (callback: () => void) => { finished: Promise<void> }
}

export function ThemeToggle() {
  const { setTheme, resolvedTheme } = useTheme()
  const buttonRef = useRef<HTMLButtonElement>(null)

  function toggleTheme() {
    const nextTheme = resolvedTheme === "dark" ? "light" : "dark"
    const doc = document as ViewTransitionDocument

    if (!doc.startViewTransition) {
      setTheme(nextTheme)
      return
    }

    const root = document.documentElement
    const rect = buttonRef.current?.getBoundingClientRect()
    if (rect) {
      root.style.setProperty("--theme-switch-x", `${rect.left + rect.width / 2}px`)
      root.style.setProperty("--theme-switch-y", `${rect.top + rect.height / 2}px`)
    }

    root.setAttribute("data-theme-switching", "")
    const transition = doc.startViewTransition(() => {
      flushSync(() => setTheme(nextTheme))
    })
    void transition.finished.finally(() => {
      root.removeAttribute("data-theme-switching")
    })
  }

  return (
    <Button
      ref={buttonRef}
      variant="ghost"
      size="icon"
      onClick={toggleTheme}
      aria-label="Design wechseln"
    >
      <Sun className="size-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
      <Moon className="absolute size-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
      <span className="sr-only">Design wechseln</span>
    </Button>
  )
}
