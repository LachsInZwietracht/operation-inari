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

export default function LoginPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex h-12 w-12 items-center justify-center rounded-lg bg-primary text-primary-foreground text-lg font-bold">
          I
        </div>
        <CardTitle className="text-2xl">Anmelden</CardTitle>
        <CardDescription>
          Melden Sie sich bei Inari an
        </CardDescription>
      </CardHeader>
      <CardContent>
        <AuthForm mode="login" />
      </CardContent>
      <CardFooter className="justify-center">
        <p className="text-sm text-muted-foreground">
          Noch kein Konto?{" "}
          <Link href="/registrieren" className="font-medium text-primary underline-offset-4 hover:underline">
            Registrieren
          </Link>
        </p>
      </CardFooter>
    </Card>
  )
}
