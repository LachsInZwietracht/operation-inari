"use client";

import { useState, useTransition } from "react";
import { Upload } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import type { FoodBrowserResult } from "@/lib/types";

interface BulkRow {
  sourceBls: string;
  targetBls: string;
  reason: string;
}

interface BulkResult {
  sourceBls: string;
  targetBls: string;
  status: "success" | "error";
  message: string;
}

function parseCsv(text: string): BulkRow[] {
  const lines = text.trim().split("\n");
  const rows: BulkRow[] = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line || (i === 0 && /source.*target/i.test(line))) continue;
    const parts = line.split(/[;,\t]/);
    if (parts.length < 2) continue;
    rows.push({
      sourceBls: parts[0].trim(),
      targetBls: parts[1].trim(),
      reason: parts[2]?.trim() ?? "",
    });
  }
  return rows;
}

async function resolveBls(blsCode: string): Promise<string | null> {
  const params = new URLSearchParams({
    q: blsCode,
    mode: "code",
    page: "1",
    pageSize: "1",
  });
  const res = await fetch(`/api/foods/browser?${params.toString()}`);
  if (!res.ok) return null;
  const result = (await res.json()) as FoodBrowserResult;
  return result.foods[0]?.id ?? null;
}

export function BulkReplacementForm() {
  const [rows, setRows] = useState<BulkRow[]>([]);
  const [results, setResults] = useState<BulkResult[]>([]);
  const [isPending, startTransition] = useTransition();

  function handleFile(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      setRows(parseCsv(text));
      setResults([]);
    };
    reader.readAsText(file);
  }

  function handleRun() {
    startTransition(async () => {
      const newResults: BulkResult[] = [];

      for (const row of rows) {
        try {
          const [sourceId, targetId] = await Promise.all([
            resolveBls(row.sourceBls),
            resolveBls(row.targetBls),
          ]);

          if (!sourceId) {
            newResults.push({ ...row, status: "error", message: `Quell-BLS-Code '${row.sourceBls}' nicht gefunden.` });
            continue;
          }
          if (!targetId) {
            newResults.push({ ...row, status: "error", message: `Ziel-BLS-Code '${row.targetBls}' nicht gefunden.` });
            continue;
          }

          const res = await fetch("/api/foods/replace", {
            method: "POST",
            body: JSON.stringify({
              sourceFoodId: sourceId,
              targetFoodId: targetId,
              reason: row.reason || `Massenersetzung: ${row.sourceBls} -> ${row.targetBls}`,
            }),
            headers: { "Content-Type": "application/json" },
          });

          if (!res.ok) {
            newResults.push({ ...row, status: "error", message: "Ersetzung fehlgeschlagen." });
          } else {
            const data = await res.json();
            const total = (data.recipeIngredientsUpdated ?? 0) + (data.mealEntriesUpdated ?? 0) + (data.protocolEntriesUpdated ?? 0);
            newResults.push({ ...row, status: "success", message: `${total} Referenzen ersetzt.` });
          }
        } catch {
          newResults.push({ ...row, status: "error", message: "Unerwarteter Fehler." });
        }
      }

      setResults(newResults);
    });
  }

  return (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="bulk-csv-upload">CSV-Datei hochladen</Label>
        <p className="text-xs text-muted-foreground">
          Format: <code>source_bls_code;target_bls_code;reason</code> (Semikolon-, Komma- oder Tab-getrennt). Kopfzeile optional.
        </p>
        <input
          id="bulk-csv-upload"
          type="file"
          accept=".csv,.txt,.tsv"
          onChange={handleFile}
          className="block w-full text-sm text-muted-foreground file:mr-4 file:rounded-md file:border-0 file:bg-primary file:px-4 file:py-2 file:text-sm file:font-medium file:text-primary-foreground hover:file:bg-primary/90"
        />
      </div>

      {rows.length > 0 ? (
        <div className="space-y-3">
          <p className="text-sm font-medium">{rows.length} Ersetzungspaare erkannt</p>
          <div className="max-h-48 overflow-y-auto rounded-md border text-sm">
            <table className="w-full">
              <thead className="sticky top-0 bg-muted/80">
                <tr className="border-b">
                  <th className="px-3 py-1.5 text-left font-medium">Quelle</th>
                  <th className="px-3 py-1.5 text-left font-medium">Ziel</th>
                  <th className="px-3 py-1.5 text-left font-medium">Begruendung</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {rows.map((row, i) => (
                  <tr key={i}>
                    <td className="px-3 py-1 font-mono text-xs">{row.sourceBls}</td>
                    <td className="px-3 py-1 font-mono text-xs">{row.targetBls}</td>
                    <td className="px-3 py-1 text-muted-foreground">{row.reason || "–"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <Button onClick={handleRun} disabled={isPending}>
            <Upload className="mr-2 h-4 w-4" />
            {isPending ? "Verarbeite..." : `${rows.length} Ersetzungen ausfuehren`}
          </Button>
        </div>
      ) : null}

      {results.length > 0 ? (
        <div className="space-y-2">
          <p className="text-sm font-medium">Ergebnis</p>
          <div className="max-h-48 overflow-y-auto rounded-md border text-sm divide-y">
            {results.map((r, i) => (
              <div key={i} className={`px-3 py-2 ${r.status === "error" ? "bg-destructive/5" : "bg-emerald-50"}`}>
                <span className="font-mono text-xs">{r.sourceBls} → {r.targetBls}</span>
                <span className={`ml-2 text-xs ${r.status === "error" ? "text-destructive" : "text-emerald-700"}`}>
                  {r.message}
                </span>
              </div>
            ))}
          </div>
        </div>
      ) : null}
    </div>
  );
}
