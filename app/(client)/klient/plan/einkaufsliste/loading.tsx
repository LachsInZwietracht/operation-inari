export default function Loading() {
  return <div role="status" className="space-y-6 py-8">
    <p className="text-sm text-muted-foreground">Deine Einkaufsliste wird zusammengestellt …</p>
    <div className="h-12 animate-pulse rounded-xl bg-muted" />
    <div className="h-64 animate-pulse rounded-2xl bg-muted" />
  </div>
}
