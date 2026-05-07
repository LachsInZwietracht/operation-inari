"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type Hl7ReviewActionFormProps = {
  resultId: string;
  reviewDetail: string;
};

export function Hl7ReviewActionForm({ resultId, reviewDetail }: Hl7ReviewActionFormProps) {
  const router = useRouter();
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [pending, setPending] = useState(false);

  async function submitReview(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPending(true);

    const formData = new FormData();
    formData.set("resultId", resultId);
    formData.set("reviewNote", note);

    const response = await fetch("/api/admin/integrations/hl7/review-result", {
      method: "POST",
      headers: { Accept: "application/json" },
      body: formData,
    });
    const payload = await response.json().catch(() => ({}));

    setPending(false);
    if (!response.ok) {
      setError(typeof payload.error === "string" ? payload.error : "Review-Aktion fehlgeschlagen.");
      return;
    }

    router.refresh();
  }

  return (
    <form action="/api/admin/integrations/hl7/review-result" method="post" onSubmit={submitReview} className="flex flex-wrap justify-end gap-2">
      <input type="hidden" name="resultId" value={resultId} />
      <Input
        name="reviewNote"
        value={note}
        onChange={(event) => setNote(event.target.value)}
        aria-label={`Review-Notiz fuer ${reviewDetail}`}
        placeholder="Notiz"
        className="w-40"
      />
      <Button type="submit" size="sm" variant="outline" disabled={pending}>
        {pending ? "Speichert..." : "Geprueft"}
      </Button>
      {error ? <p className="basis-full text-right text-xs text-destructive">{error}</p> : null}
    </form>
  );
}
