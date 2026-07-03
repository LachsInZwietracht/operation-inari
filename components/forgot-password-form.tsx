"use client"

import { useState } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, MailCheck } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { createClient } from "@/lib/supabase/client"

const forgotPasswordSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
})

type ForgotPasswordValues = z.infer<typeof forgotPasswordSchema>

export function ForgotPasswordForm() {
  const [loading, setLoading] = useState(false)
  const [submittedEmail, setSubmittedEmail] = useState<string | null>(null)

  const form = useForm<ForgotPasswordValues>({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: "" },
  })

  async function onSubmit(values: ForgotPasswordValues) {
    setLoading(true)
    const supabase = createClient()

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(values.email, {
        redirectTo: `${window.location.origin}/auth/confirm?next=/passwort-zuruecksetzen`,
      })

      if (error) {
        toast.error("Der Link konnte nicht gesendet werden. Bitte versuchen Sie es später erneut.")
        return
      }

      setSubmittedEmail(values.email)
    } finally {
      setLoading(false)
    }
  }

  if (submittedEmail) {
    return (
      <div className="flex flex-col items-center gap-3 rounded-md border bg-muted/40 p-6 text-center">
        <MailCheck className="size-8 text-primary" />
        <p className="text-sm font-medium">E-Mail unterwegs</p>
        <p className="text-sm text-muted-foreground">
          Falls ein Konto für <span className="font-medium">{submittedEmail}</span> existiert,
          haben wir Ihnen einen Link zum Zurücksetzen des Passworts gesendet. Prüfen Sie auch
          Ihren Spam-Ordner.
        </p>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail</FormLabel>
              <FormControl>
                <Input type="email" placeholder="ihre@email.de" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          Link zum Zurücksetzen senden
        </Button>
      </form>
    </Form>
  )
}
