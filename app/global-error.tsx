"use client"

import { useEffect } from "react"

/**
 * Last-resort boundary for failures in the root layout itself.
 *
 * This one replaces the entire document, so it cannot use the app's providers,
 * fonts or components — it ships its own markup and inline styles on purpose.
 * Everything else is caught by app/(app)/error.tsx, which keeps the shell.
 */
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    console.error("Root layout error:", error)
  }, [error])

  return (
    <html lang="de">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#fbfbf9",
          color: "#16181a",
          fontFamily: "system-ui, -apple-system, sans-serif",
          textAlign: "center",
          padding: "24px",
        }}
      >
        <div style={{ maxWidth: "28rem" }}>
          <h1 style={{ fontSize: "15px", fontWeight: 500, margin: "0 0 8px" }}>
            Inari konnte nicht gestartet werden
          </h1>
          <p style={{ fontSize: "13px", color: "#5f6663", margin: "0 0 20px" }}>
            Ein unerwarteter Fehler hat die Anwendung angehalten. Ein Neuladen behebt das
            in den meisten Fällen.
          </p>
          <button
            type="button"
            onClick={reset}
            style={{
              fontSize: "13px",
              padding: "8px 16px",
              borderRadius: "6px",
              border: "1px solid #e5e5e0",
              background: "#ffffff",
              color: "inherit",
              cursor: "pointer",
            }}
          >
            Neu laden
          </button>
        </div>
      </body>
    </html>
  )
}
