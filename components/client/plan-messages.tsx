"use client"

import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from "react"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { fetchPlanMessages, resolvePlanMessage, sendPlanMessage, type ClientPlanMessage } from "@/lib/data/client-plan-messages"

const MessagesContext = createContext<ClientPlanMessage[]>([])

export function PlanMessageProvider({ patientId, planId, children }: { patientId?: string; planId?: string; children: ReactNode }) {
  const [rows, setRows] = useState<ClientPlanMessage[]>([])
  useEffect(() => {
    if (!patientId && !planId) return
    let active = true
    const load = () => { void fetchPlanMessages(patientId, planId).then(data => { if (active) setRows(data) }).catch(() => { if (active) setRows([]) }) }
    load()
    const timer = setInterval(load, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [patientId, planId])
  return <MessagesContext.Provider value={rows}>{children}</MessagesContext.Provider>
}

export function PlanRequestMarker({ entryId }: { entryId: string }) {
  const rows = useContext(MessagesContext).filter(row => row.meal_entry_id === entryId && row.status === "open" && row.kind === "alternative")
  return rows.length ? <span className="block rounded bg-amber-100 px-2 py-1 text-xs text-amber-950" title={rows.map(row => row.target_label).join("; ")}>Austausch angefragt{rows.some(row => row.ingredient_id) ? " · Zutat betroffen" : ""}</span> : null
}

function MessageHistory({ rows }: { rows: ClientPlanMessage[] }) {
  return rows.map(row => <div key={row.id} className="rounded-md border bg-muted/20 p-3 text-sm">
    <p className="font-medium">{row.kind === "alternative" ? row.target_label : "Planfeedback"} · {row.status === "open" ? "Offen" : "Beantwortet"}</p>
    <p className="text-xs text-muted-foreground">{row.plan_date} · Stand {row.revision_number} · gesendet {new Date(row.created_at).toLocaleDateString("de-DE")}</p>
    <p className="mt-1 whitespace-pre-wrap break-words">{row.body || "Alternative gewünscht"}</p>
    {row.response && <p className="mt-2 whitespace-pre-wrap break-words"><strong>Antwort der Beratung:</strong> {row.response}</p>}
  </div>)
}

export function ClientAlternativeRequest({ planId, entryId, ingredients = [] }: {
  planId: string; entryId: string; ingredients?: { id: string; name: string }[]
}) {
  const [target, setTarget] = useState("")
  const [reason, setReason] = useState("")
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ClientPlanMessage[]>([])
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    try { setRows((await fetchPlanMessages(undefined, planId)).filter(row => row.meal_entry_id === entryId)); setError(false) }
    catch { setError(true) }
  }, [entryId, planId])
  // Load on expansion; avoids one request for every row on initial render.
  const openRequest = rows.some(row => row.status === "open" && (row.ingredient_id ?? "") === target)
  return <div><PlanRequestMarker entryId={entryId} /><details className="mt-2 text-xs" onToggle={event => { if (event.currentTarget.open) void load() }}>
    <summary className="cursor-pointer font-medium">Alternative anfragen</summary>
    <div className="mt-2 space-y-2" onClick={event => event.stopPropagation()}>
      <p className="text-muted-foreground">Die Anfrage wird mit deiner Ernährungsberatung geteilt. Dafür muss die Freigabe für Ernährungsdaten in deinen Einstellungen aktiv sein. Dein Plan bleibt unverändert.</p>
      {ingredients.length > 0 && <label className="block">Wofür?
        <select className="mt-1 block w-full rounded border bg-background p-2" value={target} onChange={event => setTarget(event.target.value)}>
          <option value="">Ganzes Gericht</option>
          {ingredients.map(ingredient => <option key={ingredient.id} value={ingredient.id}>{ingredient.name}</option>)}
        </select>
      </label>}
      <Textarea aria-label="Grund für die Alternative (optional)" placeholder="Grund (optional)" maxLength={3000} value={reason} onChange={event => setReason(event.target.value)} />
      <Button size="sm" disabled={busy || openRequest || error} onClick={async () => {
        setBusy(true)
        try { await sendPlanMessage(planId, reason, entryId, target || undefined); setReason(""); await load(); toast.success("Anfrage gesendet") }
        catch { toast.error("Anfrage konnte nicht gesendet werden. Prüfe deine Ernährungsdaten-Freigabe und ob der Plan noch aktuell ist.") }
        finally { setBusy(false) }
      }}>{busy ? "Wird gesendet …" : openRequest ? "Austausch angefragt" : "Anfrage senden"}</Button>
      {error && <p role="alert">Anfragen konnten nicht geladen werden. <button className="underline" onClick={() => void load()}>Erneut versuchen</button></p>}
      <MessageHistory rows={rows} />
    </div>
  </details></div>
}

export function ClientPlanFeedback({ planId }: { planId: string }) {
  const [values, setValues] = useState(["", "", ""])
  const [busy, setBusy] = useState(false)
  const [rows, setRows] = useState<ClientPlanMessage[]>([])
  const [error, setError] = useState(false)
  const load = useCallback(async () => {
    try { setRows((await fetchPlanMessages(undefined, planId)).filter(row => row.kind === "feedback")); setError(false) }
    catch { setError(true) }
  }, [planId])
  useEffect(() => {
    let active = true
    void fetchPlanMessages(undefined, planId).then(data => { if (active) { setRows(data.filter(row => row.kind === "feedback")); setError(false) } }).catch(() => { if (active) setError(true) })
    return () => { active = false }
  }, [planId])
  const labels = ["Das hat geklappt", "Das war schwierig", "Davon wünsche ich mir mehr"]
  return <Card><CardHeader><CardTitle className="text-base">Feedback zu diesem Plantag</CardTitle></CardHeader>
    <CardContent className="space-y-3">
      <p className="text-sm text-muted-foreground">Freiwillig: Deine Beratung sieht diese Rückmeldung vor der nächsten Planung. Die Freigabe für Ernährungsdaten muss dafür aktiv sein.</p>
      {labels.map((label, index) => <label className="block space-y-1 text-sm" key={label}><span>{label}</span><Textarea maxLength={900} value={values[index]} onChange={event => setValues(previous => previous.map((value, i) => i === index ? event.target.value : value))} /></label>)}
      <Button disabled={busy || !values.some(value => value.trim())} onClick={async () => {
        setBusy(true)
        try { await sendPlanMessage(planId, values.map((value, i) => value.trim() ? `${labels[i]}: ${value.trim()}` : "").filter(Boolean).join("\n\n")); setValues(["", "", ""]); await load(); toast.success("Feedback gesendet") }
        catch { toast.error("Feedback konnte nicht gesendet werden. Prüfe deine Ernährungsdaten-Freigabe und ob der Plan noch aktuell ist.") }
        finally { setBusy(false) }
      }}>{busy ? "Wird gesendet …" : "Feedback senden"}</Button>
      {error && <p role="alert" className="text-sm">Bisheriges Feedback konnte nicht geladen werden. <button className="underline" onClick={() => void load()}>Erneut versuchen</button></p>}
      <MessageHistory rows={rows} />
    </CardContent></Card>
}

function CounselorMessage({ row, refresh, showPatient }: { row: ClientPlanMessage; refresh: () => Promise<void>; showPatient: boolean }) {
  const [response, setResponse] = useState("")
  const [busy, setBusy] = useState(false)
  return <div className="space-y-2"><MessageHistory rows={[row]} />
    <Link className="text-sm underline" href={`/patienten/${row.patient_id}?tab=ernaehrungsplan`}>{showPatient ? `${row.patients?.first_name ?? "Patient"} ${row.patients?.last_name ?? ""} · Ernährungspläne öffnen` : "Ernährungspläne öffnen"}</Link>
    {row.status === "open" && <details><summary className="cursor-pointer text-sm font-medium">Antworten &amp; abschließen</summary>
      <div className="mt-2 space-y-2"><p className="text-xs text-muted-foreground">Planänderungen zuerst als Revision vorbereiten und freigeben. Diese Antwort ändert den Plan nicht.</p>
        <Textarea aria-label="Antwort der Beratung" maxLength={2000} value={response} onChange={event => setResponse(event.target.value)} placeholder="Was wurde angepasst oder vereinbart?" />
        <Button size="sm" disabled={busy || !response.trim()} onClick={async () => {
          setBusy(true)
          try { await resolvePlanMessage(row.id, response); await refresh(); toast.success("Antwort gespeichert") }
          catch { toast.error("Antwort konnte nicht gespeichert werden.") }
          finally { setBusy(false) }
        }}>{busy ? "Wird gespeichert …" : "Antwort senden & abschließen"}</Button>
      </div></details>}
  </div>
}

export function CounselorPlanMessages({ patientId }: { patientId?: string }) {
  const [rows, setRows] = useState<ClientPlanMessage[]>([])
  const [error, setError] = useState(false)
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    try { setRows(await fetchPlanMessages(patientId)); setError(false) }
    catch { setError(true) }
    finally { setLoading(false) }
  }, [patientId])
  useEffect(() => {
    let active = true
    const refresh = () => { void fetchPlanMessages(patientId).then(data => { if (active) { setRows(data); setError(false) } }).catch(() => { if (active) setError(true) }).finally(() => { if (active) setLoading(false) }) }
    refresh()
    const timer = setInterval(refresh, 60000)
    return () => { active = false; clearInterval(timer) }
  }, [patientId])
  const visible = patientId ? rows : rows.filter(row => row.kind === "alternative" && row.status === "open")
  return <Card><CardHeader><CardTitle className="text-base">{patientId ? "Anfragen & Planfeedback" : "Offene Alternativanfragen"}</CardTitle></CardHeader>
    <CardContent className="space-y-4">
      {error ? <p role="alert" className="text-sm">Rückmeldungen konnten nicht geladen werden. <button className="underline" onClick={() => void load()}>Erneut versuchen</button></p>
        : loading ? <p className="text-sm text-muted-foreground">Rückmeldungen werden geladen …</p>
        : visible.length ? visible.map(row => <CounselorMessage key={row.id} row={row} refresh={load} showPatient={!patientId} />)
        : <p className="text-sm text-muted-foreground">{patientId ? "Noch keine geteilten Rückmeldungen. Sichtbar bei aktiver Verknüpfung und Ernährungsdaten-Freigabe." : "Keine offenen geteilten Anfragen."}</p>}
      {rows.length === 200 && <p className="text-xs text-muted-foreground">Die letzten 200 Rückmeldungen werden angezeigt.</p>}
    </CardContent></Card>
}
