import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { UpdatePasswordForm } from "@/components/update-password-form"
import { BrandMark } from "@/components/brand-mark"

export default function PasswortZuruecksetzenPage() {
  return (
    <Card>
      <CardHeader className="text-center">
        <div className="mx-auto mb-2 flex size-14 items-center justify-center rounded-xl border bg-white p-2 shadow-sm">
          <BrandMark className="size-full" priority />
        </div>
        <CardTitle className="text-2xl">Neues Passwort</CardTitle>
        <CardDescription>
          Legen Sie ein neues Passwort für Ihr Konto fest
        </CardDescription>
      </CardHeader>
      <CardContent>
        <UpdatePasswordForm />
      </CardContent>
    </Card>
  )
}
