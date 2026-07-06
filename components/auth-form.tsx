"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { z } from "zod"
import { toast } from "sonner"
import { Loader2, ShieldCheck } from "lucide-react"

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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/types"
import type { SsoDomainResolution } from "@/lib/types"

const authSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  password: z.string().min(6, "Passwort muss mindestens 6 Zeichen lang sein"),
  firstName: z.string(),
  lastName: z.string(),
  role: z.enum(["ernaehrungsberater", "admin", "assistent"] as const),
})

type AuthFormValues = z.infer<typeof authSchema>

const ROLE_LABELS: Record<UserRole, string> = {
  ernaehrungsberater: "Ernährungsberater/in",
  admin: "Administrator",
  assistent: "Assistent/in",
}

interface AuthFormProps {
  mode: "login" | "register"
}

const SSO_RESOLVE_DEBOUNCE_MS = 400

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoResolution, setSsoResolution] = useState<SsoDomainResolution | null>(null)
  const isRegister = mode === "register"

  useEffect(() => {
    if (isRegister || typeof window === "undefined") return
    const params = new URLSearchParams(window.location.search)
    const ssoError = params.get("sso_error")
    if (ssoError) {
      toast.error("SSO-Anmeldung konnte nicht abgeschlossen werden. Bitte pruefen Sie die IdP-Zuordnung oder nutzen Sie den Passwortlogin.")
    }
  }, [isRegister])

  const form = useForm<AuthFormValues>({
    resolver: zodResolver(authSchema),
    defaultValues: {
      email: "",
      password: "",
      firstName: "",
      lastName: "",
      role: "ernaehrungsberater",
    },
  })

  const email = form.watch("email")
  const emailDomain = email?.trim().toLowerCase().split("@")[1] ?? ""

  useEffect(() => {
    if (isRegister) return
    if (!emailDomain || !emailDomain.includes(".")) {
      setSsoResolution(null)
      return
    }
    if (emailDomain === ssoResolution?.domain) return

    const controller = new AbortController()
    const timer = setTimeout(async () => {
      try {
        const response = await fetch(`/api/sso/resolve?email=${encodeURIComponent(`login@${emailDomain}`)}`, {
          headers: { accept: "application/json" },
          signal: controller.signal,
        })
        if (!response.ok) return
        const resolution = (await response.json()) as SsoDomainResolution
        setSsoResolution(resolution)
      } catch {
        // Auflösung ist Best-Effort; Passwortlogin bleibt immer verfügbar.
      }
    }, SSO_RESOLVE_DEBOUNCE_MS)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [emailDomain, isRegister, ssoResolution?.domain])

  async function onSubmit(values: AuthFormValues) {
    setLoading(true)
    const supabase = createClient()

    try {
      if (isRegister) {
        const { error } = await supabase.auth.signUp({
          email: values.email,
          password: values.password,
          options: {
            data: {
              first_name: values.firstName,
              last_name: values.lastName,
              role: values.role,
            },
          },
        })

        if (error) {
          toast.error(error.message)
          return
        }

        toast.success("Registrierung erfolgreich! Bitte bestätigen Sie Ihre E-Mail.")
        router.push("/login")
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })

        if (error) {
          toast.error("E-Mail oder Passwort ist falsch.")
          return
        }

        toast.success("Erfolgreich angemeldet!")
        router.push("/dashboard")
        router.refresh()
      }
    } finally {
      setLoading(false)
    }
  }

  async function handleSsoIntent() {
    if (!ssoResolution?.matched) return
    setSsoLoading(true)
    const supabase = createClient()
    const redirectTo = `${window.location.origin}/auth/sso/callback`
    const { data, error } = await supabase.auth.signInWithSSO({
      domain: ssoResolution.domain ?? form.getValues("email").split("@")[1],
      options: { redirectTo },
    })

    if (error) {
      setSsoLoading(false)
      toast.error(error.message)
      return
    }
    if (data?.url) {
      window.location.href = data.url
      return
    }

    setSsoLoading(false)
    toast.error("SSO-Provider konnte keine Weiterleitung starten.")
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        {isRegister && (
          <div className="grid gap-4 sm:grid-cols-2">
            <FormField
              control={form.control}
              name="firstName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Vorname</FormLabel>
                  <FormControl>
                    <Input placeholder="Vorname" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="lastName"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nachname</FormLabel>
                  <FormControl>
                    <Input placeholder="Nachname" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>
        )}

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

        {!isRegister && ssoResolution?.matched && (
          <div className="rounded-md border bg-muted p-3 text-sm">
            <div className="flex items-center gap-2 font-medium">
              <ShieldCheck className="h-4 w-4" />
              Klinik-SSO verfuegbar
            </div>
            <p className="mt-1 text-xs text-muted-foreground">
              {ssoResolution.displayName} · {ssoResolution.organizationName ?? "Organisation"} · {ssoResolution.providerType?.toUpperCase()} · Domain {ssoResolution.domain}
            </p>
            <Button type="button" className="mt-3 w-full" variant="secondary" onClick={() => void handleSsoIntent()} disabled={ssoLoading}>
              {ssoLoading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Mit SSO anmelden
            </Button>
          </div>
        )}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <div className="flex items-center justify-between">
                <FormLabel>Passwort</FormLabel>
                {!isRegister && (
                  <Link
                    href="/passwort-vergessen"
                    className="text-xs font-medium text-primary underline-offset-4 hover:underline"
                  >
                    Passwort vergessen?
                  </Link>
                )}
              </div>
              <FormControl>
                <Input type="password" placeholder="••••••••" {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {isRegister && (
          <FormField
            control={form.control}
            name="role"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Rolle</FormLabel>
                <Select onValueChange={field.onChange} value={field.value}>
                  <FormControl>
                    <SelectTrigger className="w-full">
                      <SelectValue />
                    </SelectTrigger>
                  </FormControl>
                  <SelectContent>
                    {(Object.entries(ROLE_LABELS) as [UserRole, string][]).map(
                      ([value, label]) => (
                        <SelectItem key={value} value={value}>
                          {label}
                        </SelectItem>
                      ),
                    )}
                  </SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )}
          />
        )}

        <Button type="submit" className="w-full" disabled={loading}>
          {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
          {isRegister ? "Registrieren" : "Anmelden"}
        </Button>
      </form>
    </Form>
  )
}
