import { clsx, type ClassValue } from "clsx"
import { twMerge } from "tailwind-merge"

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export function downloadCsv(filename: string, rows: string[][]) {
  if (typeof window === "undefined") return
  const csv = rows
    .map((row) => row.map((cell) => `"${String(cell ?? "").replace(/"/g, '""')}"`).join(";"))
    .join("\n")
  const blob = new Blob([csv], { type: "text/csv;charset=utf-8" })
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = `${filename}.csv`
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export function downloadBlob(filename: string, blob: Blob) {
  if (typeof window === "undefined") return
  const url = URL.createObjectURL(blob)
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  link.remove()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}

export async function downloadResponseFile(response: Response, fallbackFilename: string) {
  if (!response.ok) {
    const message = await response.text()
    throw new Error(message || "Download failed")
  }

  const contentDisposition = response.headers.get("content-disposition")
  const filenameMatch = contentDisposition?.match(/filename="?([^"]+)"?/)
  const filename = filenameMatch?.[1] ?? fallbackFilename
  const blob = await response.blob()
  downloadBlob(filename, blob)
}
