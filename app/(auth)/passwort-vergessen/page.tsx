import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { ForgotPasswordForm } from "@/components/forgot-password-form"
import { BrandMark } from "@/components/brand-mark"

export default async function PasswortVergessenPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams

  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-xl border bg-white p-2 shadow-sm">
          <BrandMark className="size-full" priority />
        </div>
        <CardTitle className="text-2xl">Passwort vergessen</CardTitle>
        <CardDescription>
          Wir senden Ihnen einen Link zum Zurücksetzen
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {error === "link_invalid" && (
          <p className="rounded-md border border-destructive/40 bg-destructive/10 p-3 text-sm text-destructive">
            Der Link ist ungültig oder abgelaufen. Bitte fordern Sie einen neuen an.
          </p>
        )}
        <ForgotPasswordForm />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Zurück zur{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Anmeldung
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
