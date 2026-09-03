"use client"

import { useMemo, useState, useTransition } from "react"
import { addDays, format, isBefore, parseISO, startOfDay } from "date-fns"
import { de } from "date-fns/locale"
import { CalendarClock, Check, GripVertical, MoreHorizontal, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  createPracticeTask,
  deletePracticeTask,
  updatePracticeTask,
} from "@/lib/data/practice-tasks-client"
import type { PracticeTask, PracticeTaskPriority, PracticeTaskStatus } from "@/lib/types"
import { cn } from "@/lib/utils"

/** Drag-Payload: nur die Id, die Karte löst das Board selbst auf. */
const TASK_DRAG_ID = "application/x-inari-task"

const COLUMNS: Array<{ status: PracticeTaskStatus; label: string; hint: string; color: string }> = [
  { status: "todo", label: "Zu erledigen", hint: "Noch nicht angefangen", color: "var(--chart-4)" },
  { status: "in_progress", label: "In Arbeit", hint: "Läuft gerade", color: "var(--chart-2)" },
  { status: "done", label: "Erledigt", hint: "Abgeschlossen", color: "var(--chart-1)" },
]

const PRIORITY_LABEL: Record<PracticeTaskPriority, string> = {
  high: "Hoch",
  normal: "Normal",
  low: "Niedrig",
}

const soft = (color: string) => `color-mix(in srgb, ${color} 13%, transparent)`

/**
 * Eine Karte, die noch auf ihre Zeile aus Supabase wartet.
 *
 * Bis die da ist, hat sie nur eine lokale Id — jede Änderung würde ins Leere
 * greifen, deshalb ist sie so lange nicht bedienbar.
 */
function isDraftId(id: string): boolean {
  return id.startsWith("draft-")
}

/** Abstand zwischen zwei Karten, wenn eine ans Ende einer Spalte kommt. */
const POSITION_STEP = 1000

/**
 * Die Zielposition fuer eine Karte, die vor `beforeTask` landen soll.
 *
 * Zwischen zwei Karten ist das die Mitte der beiden Positionen — deshalb ist
 * die Spalte float8 und muss beim Verschieben nicht neu durchnummeriert
 * werden. Ohne Nachbar davor wird nach vorne bzw. hinten Luft gelassen.
 */
function positionFor(column: PracticeTask[], beforeTaskId: string | null): number {
  if (column.length === 0) return POSITION_STEP

  const index = beforeTaskId ? column.findIndex((task) => task.id === beforeTaskId) : -1
  if (index < 0) return column[column.length - 1].position + POSITION_STEP
  if (index === 0) return column[0].position - POSITION_STEP

  return (column[index - 1].position + column[index].position) / 2
}

function dueLabel(dueDate: string, today: Date): { text: string; overdue: boolean } {
  const due = parseISO(dueDate)
  const todayIso = format(today, "yyyy-MM-dd")
  const overdue = isBefore(due, startOfDay(today))

  if (dueDate === todayIso) return { text: "Heute fällig", overdue: false }
  if (dueDate === format(addDays(today, 1), "yyyy-MM-dd")) return { text: "Morgen fällig", overdue: false }

  return { text: format(due, "d. MMM", { locale: de }), overdue }
}

interface PracticeTaskBoardProps {
  initialTasks: PracticeTask[]
}

/**
 * Das Aufgabenboard des Dashboards — drei Spalten, wie in Notion.
 *
 * Verschoben wird per Drag & Drop; jede Karte hat dieselben Züge zusaetzlich
 * im Menü, weil Ziehen mit Tastatur nicht bedienbar und auf dem Tablet
 * unzuverlaessig ist (dasselbe Muster wie `intake-board-view.tsx`).
 *
 * Alle Änderungen laufen optimistisch: die Karte springt sofort, und erst
 * wenn Supabase widerspricht wird der vorherige Stand zurueckgeholt. Ein Board
 * das bei jedem Zug kurz einfriert, benutzt niemand zweimal.
 */
export function PracticeTaskBoard({ initialTasks }: PracticeTaskBoardProps) {
  const [tasks, setTasks] = useState<PracticeTask[]>(initialTasks)
  const [draggingId, setDraggingId] = useState<string | null>(null)
  const [, startTransition] = useTransition()
  const [today] = useState(() => new Date())

  const columns = useMemo(() => {
    const sorted = [...tasks].sort(
      (a, b) => a.position - b.position || a.createdAt.localeCompare(b.createdAt),
    )
    return COLUMNS.map((column) => ({
      ...column,
      tasks: sorted.filter((task) => task.status === column.status),
    }))
  }, [tasks])

  /** Optimistisch anwenden, bei Fehler den Stand von vorher wiederherstellen. */
  function run(next: (current: PracticeTask[]) => PracticeTask[], persist: () => Promise<unknown>, failure: string) {
    const previous = tasks
    setTasks(next)
    startTransition(() => {
      persist().catch((error) => {
        console.warn(failure, error)
        setTasks(previous)
        toast.error(failure)
      })
    })
  }

  function moveTask(taskId: string, status: PracticeTaskStatus, beforeTaskId: string | null) {
    const task = tasks.find((candidate) => candidate.id === taskId)
    if (!task || isDraftId(taskId) || beforeTaskId === taskId) return

    const target = columns.find((column) => column.status === status)?.tasks ?? []
    // Ans Ende der eigenen Spalte gezogen heisst: nichts passiert.
    if (task.status === status && beforeTaskId === null && target.at(-1)?.id === taskId) return

    const position = positionFor(target.filter((entry) => entry.id !== taskId), beforeTaskId)
    const completedAt = status === "done" ? new Date().toISOString() : undefined

    run(
      (current) =>
        current.map((entry) =>
          entry.id === taskId ? { ...entry, status, position, completedAt } : entry,
        ),
      () => updatePracticeTask(taskId, { status, position }),
      "Aufgabe konnte nicht verschoben werden.",
    )
  }

  function setPriority(taskId: string, priority: PracticeTaskPriority) {
    if (isDraftId(taskId)) return
    run(
      (current) => current.map((entry) => (entry.id === taskId ? { ...entry, priority } : entry)),
      () => updatePracticeTask(taskId, { priority }),
      "Priorität konnte nicht gespeichert werden.",
    )
  }

  function setDueDate(taskId: string, dueDate: string | undefined) {
    if (isDraftId(taskId)) return
    run(
      (current) => current.map((entry) => (entry.id === taskId ? { ...entry, dueDate } : entry)),
      () => updatePracticeTask(taskId, { dueDate: dueDate ?? "" }),
      "Fälligkeit konnte nicht gespeichert werden.",
    )
  }

  function removeTask(taskId: string) {
    if (isDraftId(taskId)) return
    run(
      (current) => current.filter((entry) => entry.id !== taskId),
      () => deletePracticeTask(taskId),
      "Aufgabe konnte nicht gelöscht werden.",
    )
  }

  async function addTask(status: PracticeTaskStatus, title: string) {
    const column = columns.find((entry) => entry.status === status)?.tasks ?? []
    const position = positionFor(column, null)
    // Die neue Karte bekommt vorläufig eine lokale Id und wird durch die
    // Zeile aus Supabase ersetzt, sobald sie da ist.
    const draftId = `draft-${Date.now()}`
    const now = new Date().toISOString()
    const draft: PracticeTask = {
      id: draftId,
      title,
      status,
      priority: "normal",
      position,
      createdAt: now,
      updatedAt: now,
    }

    setTasks((current) => [...current, draft])

    try {
      const saved = await createPracticeTask({ title, status, position })
      setTasks((current) => current.map((entry) => (entry.id === draftId ? saved : entry)))
    } catch (error) {
      console.warn("Aufgabe konnte nicht angelegt werden.", error)
      setTasks((current) => current.filter((entry) => entry.id !== draftId))
      toast.error("Aufgabe konnte nicht angelegt werden.")
    }
  }

  return (
    <div className="-mx-1 overflow-x-auto px-1 pb-1">
      <div className="flex snap-x gap-4">
        {columns.map((column) => (
          <TaskColumn
            key={column.status}
            column={column}
            today={today}
            draggingId={draggingId}
            onDragStateChange={setDraggingId}
            onDropTask={moveTask}
            onAdd={addTask}
            onMove={moveTask}
            onPriority={setPriority}
            onDueDate={setDueDate}
            onDelete={removeTask}
          />
        ))}
      </div>
    </div>
  )
}

interface TaskColumnProps {
  column: { status: PracticeTaskStatus; label: string; hint: string; color: string; tasks: PracticeTask[] }
  today: Date
  draggingId: string | null
  onDragStateChange: (id: string | null) => void
  onDropTask: (taskId: string, status: PracticeTaskStatus, beforeTaskId: string | null) => void
  onAdd: (status: PracticeTaskStatus, title: string) => void
  onMove: (taskId: string, status: PracticeTaskStatus, beforeTaskId: string | null) => void
  onPriority: (taskId: string, priority: PracticeTaskPriority) => void
  onDueDate: (taskId: string, dueDate: string | undefined) => void
  onDelete: (taskId: string) => void
}

function TaskColumn({
  column,
  today,
  draggingId,
  onDragStateChange,
  onDropTask,
  onAdd,
  onMove,
  onPriority,
  onDueDate,
  onDelete,
}: TaskColumnProps) {
  const [isOver, setIsOver] = useState(false)
  const [draft, setDraft] = useState("")
  const [composing, setComposing] = useState(false)

  const draggedFromElsewhere = draggingId !== null && !column.tasks.some((task) => task.id === draggingId)
  const showDropTarget = isOver && draggingId !== null

  function submitDraft() {
    const title = draft.trim()
    if (!title) {
      setComposing(false)
      return
    }
    onAdd(column.status, title)
    setDraft("")
  }

  return (
    <section
      aria-label={column.label}
      className={cn(
        "flex w-[280px] shrink-0 grow basis-[280px] snap-start flex-col rounded-xl px-1.5 pb-2 transition-colors",
        showDropTarget && "bg-muted",
      )}
      style={showDropTarget ? { boxShadow: `inset 0 0 0 2px ${column.color}` } : undefined}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(TASK_DRAG_ID)) return
        // Ohne preventDefault verweigert der Browser den Drop komplett.
        event.preventDefault()
        event.dataTransfer.dropEffect = "move"
        setIsOver(true)
      }}
      onDragLeave={(event) => {
        // Wechsel zwischen den eigenen Kindern feuert ebenfalls dragleave.
        if (event.currentTarget.contains(event.relatedTarget as Node | null)) return
        setIsOver(false)
      }}
      onDrop={(event) => {
        const taskId = event.dataTransfer.getData(TASK_DRAG_ID)
        setIsOver(false)
        if (!taskId) return
        event.preventDefault()
        onDropTask(taskId, column.status, null)
      }}
    >
      <div className="flex items-center gap-2 border-b pb-2">
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: column.color }} aria-hidden="true" />
        <span className="truncate text-[12.5px] font-bold">{column.label}</span>
        <span className="ml-auto font-mono text-[11px] tabular-nums text-muted-foreground">{column.tasks.length}</span>
      </div>

      <div className="flex flex-1 flex-col gap-2 pt-3">
        {column.tasks.map((task) => (
          <TaskCard
            key={task.id}
            task={task}
            today={today}
            isDragging={draggingId === task.id}
            pending={isDraftId(task.id)}
            onDragStateChange={onDragStateChange}
            onDropBefore={(draggedId) => onDropTask(draggedId, column.status, task.id)}
            onMove={onMove}
            onPriority={onPriority}
            onDueDate={onDueDate}
            onDelete={onDelete}
          />
        ))}

        {column.tasks.length === 0 ? (
          <p
            className={cn(
              "rounded-xl py-6 text-center text-[11.5px] text-muted-foreground transition-colors",
              draggedFromElsewhere && "border border-dashed",
            )}
          >
            {draggedFromElsewhere ? "Hierher ziehen" : column.hint}
          </p>
        ) : null}

        {composing ? (
          <form
            onSubmit={(event) => {
              event.preventDefault()
              submitDraft()
            }}
          >
            <input
              autoFocus
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onBlur={submitDraft}
              onKeyDown={(event) => {
                if (event.key === "Escape") {
                  setDraft("")
                  setComposing(false)
                }
              }}
              placeholder="Was ist zu tun?"
              aria-label={`Neue Aufgabe in ${column.label}`}
              className="w-full rounded-xl border bg-card px-3 py-2 text-[13px] outline-none focus-visible:ring-2 focus-visible:ring-ring"
            />
          </form>
        ) : (
          <button
            type="button"
            onClick={() => setComposing(true)}
            aria-label={`Aufgabe in ${column.label} hinzufügen`}
            className="flex items-center gap-1.5 rounded-xl px-2 py-2 text-[12.5px] font-semibold text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <Plus className="size-4" /> Aufgabe
          </button>
        )}
      </div>
    </section>
  )
}

interface TaskCardProps {
  task: PracticeTask
  today: Date
  isDragging: boolean
  /** Noch nicht gespeichert — die Karte nimmt bis dahin keine Befehle an. */
  pending: boolean
  onDragStateChange: (id: string | null) => void
  onDropBefore: (draggedId: string) => void
  onMove: (taskId: string, status: PracticeTaskStatus, beforeTaskId: string | null) => void
  onPriority: (taskId: string, priority: PracticeTaskPriority) => void
  onDueDate: (taskId: string, dueDate: string | undefined) => void
  onDelete: (taskId: string) => void
}

function TaskCard({
  task,
  today,
  isDragging,
  pending,
  onDragStateChange,
  onDropBefore,
  onMove,
  onPriority,
  onDueDate,
  onDelete,
}: TaskCardProps) {
  const [isOver, setIsOver] = useState(false)
  const done = task.status === "done"
  const due = task.dueDate ? dueLabel(task.dueDate, today) : null

  return (
    <article
      draggable={!pending}
      data-task-status={task.status}
      aria-busy={pending || undefined}
      onDragStart={(event) => {
        event.dataTransfer.setData(TASK_DRAG_ID, task.id)
        event.dataTransfer.effectAllowed = "move"
        onDragStateChange(task.id)
      }}
      onDragEnd={() => onDragStateChange(null)}
      onDragOver={(event) => {
        if (!event.dataTransfer.types.includes(TASK_DRAG_ID)) return
        event.preventDefault()
        setIsOver(true)
      }}
      onDragLeave={() => setIsOver(false)}
      onDrop={(event) => {
        const draggedId = event.dataTransfer.getData(TASK_DRAG_ID)
        setIsOver(false)
        if (!draggedId || draggedId === task.id) return
        // Der Drop auf einer Karte sortiert davor ein; das Spalten-Handler
        // darunter würde nur ans Ende hängen.
        event.preventDefault()
        event.stopPropagation()
        onDropBefore(draggedId)
      }}
      className={cn(
        "group rounded-xl border bg-card p-3 transition-colors hover:bg-muted/60",
        (isDragging || pending) && "opacity-40",
        isOver && "border-t-2 border-t-primary",
      )}
    >
      <div className="flex items-start gap-1.5">
        <GripVertical
          className="mt-0.5 size-3.5 shrink-0 cursor-grab text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100"
          aria-hidden="true"
        />

        <div className="min-w-0 flex-1">
          <p className={cn("text-[13.5px] font-semibold break-words", done && "text-muted-foreground line-through")}>
            {task.title}
          </p>
          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1">
            {task.priority === "high" && !done ? (
              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-destructive">
                <span className="size-1.5 rounded-full bg-destructive" /> Hoch
              </span>
            ) : null}
            {due ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-[11px] font-semibold",
                  due.overdue && !done ? "text-destructive" : "text-muted-foreground",
                )}
                style={
                  due.overdue && !done
                    ? { backgroundColor: soft("var(--destructive)") }
                    : { backgroundColor: soft("var(--muted-foreground)") }
                }
              >
                <CalendarClock className="size-3" /> {due.text}
              </span>
            ) : null}
          </div>
        </div>

        <div className={cn("flex shrink-0 items-center gap-0.5", pending && "invisible")}>
          {!done ? (
            <button
              type="button"
              onClick={() => onMove(task.id, "done", null)}
              aria-label={`"${task.title}" als erledigt markieren`}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground opacity-0 transition-opacity hover:bg-background hover:text-primary focus-visible:opacity-100 group-hover:opacity-100"
            >
              <Check className="size-4" />
            </button>
          ) : null}

          <DropdownMenu>
            <DropdownMenuTrigger
              aria-label={`Aktionen für "${task.title}"`}
              className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-background data-[state=open]:bg-background"
            >
              <MoreHorizontal className="size-4" />
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-52">
              <DropdownMenuLabel>Verschieben</DropdownMenuLabel>
              {COLUMNS.filter((column) => column.status !== task.status).map((column) => (
                <DropdownMenuItem key={column.status} onSelect={() => onMove(task.id, column.status, null)}>
                  {column.label}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Priorität</DropdownMenuLabel>
              {(["high", "normal", "low"] as const).map((priority) => (
                <DropdownMenuItem
                  key={priority}
                  onSelect={() => onPriority(task.id, priority)}
                  className={cn(task.priority === priority && "font-semibold")}
                >
                  {PRIORITY_LABEL[priority]}
                </DropdownMenuItem>
              ))}

              <DropdownMenuSeparator />
              <DropdownMenuLabel>Fällig</DropdownMenuLabel>
              <DropdownMenuItem onSelect={() => onDueDate(task.id, format(today, "yyyy-MM-dd"))}>Heute</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDueDate(task.id, format(addDays(today, 1), "yyyy-MM-dd"))}>Morgen</DropdownMenuItem>
              <DropdownMenuItem onSelect={() => onDueDate(task.id, format(addDays(today, 7), "yyyy-MM-dd"))}>In einer Woche</DropdownMenuItem>
              {task.dueDate ? (
                <DropdownMenuItem onSelect={() => onDueDate(task.id, undefined)}>Kein Datum</DropdownMenuItem>
              ) : null}

              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onSelect={() => onDelete(task.id)}>
                <Trash2 className="size-4" /> Löschen
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </article>
  )
}
