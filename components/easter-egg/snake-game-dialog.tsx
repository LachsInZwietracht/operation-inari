"use client"

/**
 * Nutri-Snake — the Konami-code easter egg.
 *
 * Classic snake with a dietitian twist: broccoli makes you grow, donuts are
 * worth triple points but speed the game up. Highscore persists locally.
 * Rendering happens on a canvas; React state only tracks score/status so the
 * game loop never re-renders the tree per tick.
 */

import { useCallback, useEffect, useRef, useState } from "react"

import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

const GRID = 20
const CELL = 24
const BOARD = GRID * CELL
const START_TICK_MS = 160
const MIN_TICK_MS = 60
const BROCCOLI_POINTS = 10
const DONUT_POINTS = 30
/** Every donut eaten shortens the tick — the sugar rush. */
const DONUT_SPEEDUP = 0.85
/** Chance that the next spawned food is a donut instead of broccoli. */
const DONUT_CHANCE = 0.25
const HIGHSCORE_KEY = "inari-snake-highscore"

type Cell = { x: number; y: number }
type Direction = "up" | "down" | "left" | "right"
type FoodKind = "broccoli" | "donut"
type GameStatus = "idle" | "running" | "paused" | "over"

const DIRECTION_VECTORS: Record<Direction, Cell> = {
  up: { x: 0, y: -1 },
  down: { x: 0, y: 1 },
  left: { x: -1, y: 0 },
  right: { x: 1, y: 0 },
}

const OPPOSITE: Record<Direction, Direction> = {
  up: "down",
  down: "up",
  left: "right",
  right: "left",
}

const KEY_DIRECTIONS: Record<string, Direction> = {
  ArrowUp: "up",
  ArrowDown: "down",
  ArrowLeft: "left",
  ArrowRight: "right",
  KeyW: "up",
  KeyS: "down",
  KeyA: "left",
  KeyD: "right",
}

interface GameState {
  snake: Cell[]
  direction: Direction
  /** Buffered next turns so quick double-taps (e.g. up→left) both register. */
  directionQueue: Direction[]
  food: Cell
  foodKind: FoodKind
  tickMs: number
  score: number
}

function randomFreeCell(occupied: Cell[]): Cell {
  const taken = new Set(occupied.map((cell) => `${cell.x},${cell.y}`))
  let cell: Cell
  do {
    cell = {
      x: Math.floor(Math.random() * GRID),
      y: Math.floor(Math.random() * GRID),
    }
  } while (taken.has(`${cell.x},${cell.y}`))
  return cell
}

function createInitialState(): GameState {
  const snake: Cell[] = [
    { x: 8, y: 10 },
    { x: 7, y: 10 },
    { x: 6, y: 10 },
  ]
  return {
    snake,
    direction: "right",
    directionQueue: [],
    food: randomFreeCell(snake),
    foodKind: "broccoli",
    tickMs: START_TICK_MS,
    score: 0,
  }
}

function readHighscore(): number {
  try {
    return Number(window.localStorage.getItem(HIGHSCORE_KEY)) || 0
  } catch {
    return 0
  }
}

function resolveThemeColor(variable: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement)
    .getPropertyValue(variable)
    .trim()
  return value || fallback
}

export function SnakeGameDialog({
  open,
  onOpenChange,
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const stateRef = useRef<GameState>(createInitialState())
  const statusRef = useRef<GameStatus>("idle")
  const [status, setStatus] = useState<GameStatus>("idle")
  const [score, setScore] = useState(0)
  const [highscore, setHighscore] = useState(0)

  const updateStatus = useCallback((next: GameStatus) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  useEffect(() => {
    if (open) setHighscore(readHighscore())
  }, [open])

  const draw = useCallback(() => {
    const canvas = canvasRef.current
    const context = canvas?.getContext("2d")
    if (!canvas || !context) return

    const snakeColor = resolveThemeColor("--primary", "#22c55e")
    const gridColor = resolveThemeColor("--border", "rgba(128,128,128,0.25)")
    const state = stateRef.current

    context.clearRect(0, 0, BOARD, BOARD)

    // Subtle checkerboard so movement is readable on any theme surface.
    context.fillStyle = gridColor
    context.globalAlpha = 0.18
    for (let x = 0; x < GRID; x++) {
      for (let y = 0; y < GRID; y++) {
        if ((x + y) % 2 === 0) context.fillRect(x * CELL, y * CELL, CELL, CELL)
      }
    }
    context.globalAlpha = 1

    // Food as emoji — instantly readable, zero sprite work.
    context.font = `${CELL - 3}px sans-serif`
    context.textAlign = "center"
    context.textBaseline = "middle"
    context.fillText(
      state.foodKind === "broccoli" ? "🥦" : "🍩",
      state.food.x * CELL + CELL / 2,
      state.food.y * CELL + CELL / 2 + 1,
    )

    state.snake.forEach((segment, index) => {
      const inset = index === 0 ? 1 : 2
      context.fillStyle = snakeColor
      context.globalAlpha = index === 0 ? 1 : Math.max(0.45, 1 - index * 0.03)
      context.beginPath()
      context.roundRect(
        segment.x * CELL + inset,
        segment.y * CELL + inset,
        CELL - inset * 2,
        CELL - inset * 2,
        index === 0 ? 7 : 5,
      )
      context.fill()
    })
    context.globalAlpha = 1

    // Eyes on the head, looking where the snake goes.
    const head = state.snake[0]
    const vector = DIRECTION_VECTORS[state.direction]
    const centerX = head.x * CELL + CELL / 2 + vector.x * 4
    const centerY = head.y * CELL + CELL / 2 + vector.y * 4
    const sideways = { x: vector.y, y: vector.x }
    context.fillStyle = "#ffffff"
    for (const side of [-1, 1]) {
      context.beginPath()
      context.arc(
        centerX + sideways.x * 4 * side,
        centerY + sideways.y * 4 * side,
        2.4,
        0,
        Math.PI * 2,
      )
      context.fill()
    }
  }, [])

  const endGame = useCallback(() => {
    updateStatus("over")
    const finalScore = stateRef.current.score
    setHighscore((previous) => {
      if (finalScore <= previous) return previous
      try {
        window.localStorage.setItem(HIGHSCORE_KEY, String(finalScore))
      } catch {
        // Private mode — the run still counts, it just isn't remembered.
      }
      return finalScore
    })
  }, [updateStatus])

  const tick = useCallback(() => {
    const state = stateRef.current

    const nextDirection = state.directionQueue.shift()
    if (nextDirection) state.direction = nextDirection

    const vector = DIRECTION_VECTORS[state.direction]
    const head = state.snake[0]
    const nextHead = { x: head.x + vector.x, y: head.y + vector.y }

    const hitsWall =
      nextHead.x < 0 || nextHead.x >= GRID || nextHead.y < 0 || nextHead.y >= GRID
    // The tail cell moves away this tick, so it is not a collision.
    const body = state.snake.slice(0, -1)
    const hitsSelf = body.some(
      (segment) => segment.x === nextHead.x && segment.y === nextHead.y,
    )
    if (hitsWall || hitsSelf) {
      endGame()
      return
    }

    state.snake.unshift(nextHead)

    const ate = nextHead.x === state.food.x && nextHead.y === state.food.y
    if (ate) {
      if (state.foodKind === "broccoli") {
        state.score += BROCCOLI_POINTS
        // Growing: keep the tail.
      } else {
        state.score += DONUT_POINTS
        state.tickMs = Math.max(MIN_TICK_MS, state.tickMs * DONUT_SPEEDUP)
        state.snake.pop()
      }
      state.food = randomFreeCell(state.snake)
      state.foodKind = Math.random() < DONUT_CHANCE ? "donut" : "broccoli"
      setScore(state.score)
    } else {
      state.snake.pop()
    }

    draw()
  }, [draw, endGame])

  const startGame = useCallback(() => {
    stateRef.current = createInitialState()
    setScore(0)
    updateStatus("running")
    draw()
  }, [draw, updateStatus])

  // Game loop — rAF with an accumulator so donut speed-ups apply mid-run.
  useEffect(() => {
    if (!open || status !== "running") return
    let frame = 0
    let last = performance.now()
    let elapsed = 0

    const loop = (now: number) => {
      elapsed += now - last
      last = now
      if (elapsed >= stateRef.current.tickMs) {
        elapsed = 0
        tick()
      }
      if (statusRef.current === "running") frame = requestAnimationFrame(loop)
    }

    frame = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(frame)
  }, [open, status, tick])

  // Controls.
  useEffect(() => {
    if (!open) return

    const handleKeyDown = (event: KeyboardEvent) => {
      const direction = KEY_DIRECTIONS[event.code]
      const currentStatus = statusRef.current

      if (direction) {
        event.preventDefault()
        if (currentStatus === "running") {
          const state = stateRef.current
          const reference =
            state.directionQueue[state.directionQueue.length - 1] ?? state.direction
          if (direction !== reference && direction !== OPPOSITE[reference]) {
            state.directionQueue.push(direction)
          }
        } else if (currentStatus === "idle" || currentStatus === "over") {
          startGame()
        }
        return
      }

      if (event.code === "Space" || event.code === "Enter") {
        event.preventDefault()
        if (currentStatus === "running") updateStatus("paused")
        else if (currentStatus === "paused") updateStatus("running")
        else startGame()
      }
    }

    window.addEventListener("keydown", handleKeyDown)
    return () => window.removeEventListener("keydown", handleKeyDown)
  }, [open, startGame, updateStatus])

  // Initial board once the canvas exists.
  useEffect(() => {
    if (open) draw()
  }, [open, draw])

  const overlay =
    status === "idle" ? (
      <>
        <p className="text-lg font-bold">Bereit?</p>
        <p className="text-sm text-muted-foreground">
          Pfeiltasten oder WASD zum Steuern
        </p>
        <Button size="sm" onClick={startGame}>
          Los geht&apos;s
        </Button>
      </>
    ) : status === "paused" ? (
      <>
        <p className="text-lg font-bold">Pause</p>
        <p className="text-sm text-muted-foreground">Leertaste zum Weiterspielen</p>
      </>
    ) : status === "over" ? (
      <>
        <p className="text-lg font-bold">Game Over</p>
        <p className="text-sm text-muted-foreground">
          {score >= highscore && score > 0
            ? "Neuer Rekord! 🎉"
            : `${score} Punkte — Rekord: ${highscore}`}
        </p>
        <Button size="sm" onClick={startGame}>
          Nochmal
        </Button>
      </>
    ) : null

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-fit max-w-[95vw] gap-3">
        <DialogHeader>
          <DialogTitle>🐍 Nutri-Snake</DialogTitle>
          <DialogDescription>
            Konami-Code gefunden! Brokkoli macht dich lang, Donuts geben
            Extrapunkte — und Tempo. Ernährungsberatung in einem Satz.
          </DialogDescription>
        </DialogHeader>

        <div className="flex items-center justify-between font-mono text-sm tabular-nums">
          <span>
            Punkte: <strong>{score}</strong>
          </span>
          <span className="text-muted-foreground">Rekord: {highscore}</span>
        </div>

        <div className="relative">
          <canvas
            ref={canvasRef}
            width={BOARD}
            height={BOARD}
            className="block max-w-full rounded-lg border bg-muted/40"
            style={{ aspectRatio: "1 / 1" }}
          />
          {overlay ? (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-lg bg-background/80 backdrop-blur-[2px]">
              {overlay}
            </div>
          ) : null}
        </div>

        <p className="text-center text-xs text-muted-foreground">
          Pfeiltasten/WASD steuern · Leertaste pausiert
        </p>
      </DialogContent>
    </Dialog>
  )
}
