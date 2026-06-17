import Link from "next/link"
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { AuthForm } from "@/components/auth-form"
import { BrandMark } from "@/components/brand-mark"

export default function RegistrierenPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-xl border bg-white p-2 shadow-sm">
          <BrandMark className="size-full" priority />
        </div>
        <CardTitle className="text-2xl">Registrieren</CardTitle>
        <CardDescription>
          Erstellen Sie Ihr Inari-Konto
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="register" />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Bereits ein Konto?{" "}
          <Link href="/login" className="font-medium text-primary underline-offset-4 hover:underline">
            Anmelden
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
