"use client"

import { useState } from "react"
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

export function AuthForm({ mode }: AuthFormProps) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [ssoLoading, setSsoLoading] = useState(false)
  const [ssoResolution, setSsoResolution] = useState<SsoDomainResolution | null>(null)
  const isRegister = mode === "register"

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

  async function resolveSso() {
    const email = form.getValues("email").trim()
    if (!email || !email.includes("@")) {
      form.setError("email", { message: "Bitte zuerst eine gueltige E-Mail-Adresse eingeben." })
      return
    }

    setSsoLoading(true)
    setSsoResolution(null)
    try {
      const response = await fetch(`/api/sso/resolve?email=${encodeURIComponent(email)}`, {
        headers: { accept: "application/json" },
      })
      if (!response.ok) throw new Error(await response.text())
      const resolution = (await response.json()) as SsoDomainResolution
      setSsoResolution(resolution)
      if (!resolution.matched) {
        toast.info("Fuer diese Domain ist noch kein aktiver SSO-Provider hinterlegt.")
      }
    } catch (error) {
      toast.error((error as Error).message || "SSO-Pruefung fehlgeschlagen.")
    } finally {
      setSsoLoading(false)
    }
  }

  function handleSsoIntent() {
    if (!ssoResolution?.matched) return
    toast.info("SSO-Konfiguration gefunden. Der Provider-Handoff wird im naechsten Integrationsschritt aktiviert.")
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

        {!isRegister && (
          <div className="rounded-md border p-3">
            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
              <div className="text-sm">
                <p className="font-medium">Klinik-SSO</p>
                <p className="text-xs text-muted-foreground">Domain pruefen und vorbereiteten OIDC-/SAML-Pfad anzeigen.</p>
              </div>
              <Button type="button" variant="outline" onClick={() => void resolveSso()} disabled={ssoLoading}>
                {ssoLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <ShieldCheck className="mr-2 h-4 w-4" />}
                SSO pruefen
              </Button>
            </div>
            {ssoResolution?.matched ? (
              <div className="mt-3 rounded-md bg-muted p-3 text-sm">
                <p className="font-medium">{ssoResolution.displayName} gefunden</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {ssoResolution.organizationName ?? "Organisation"} · {ssoResolution.providerType?.toUpperCase()} · Domain {ssoResolution.domain}
                </p>
                <Button type="button" className="mt-3 w-full" variant="secondary" onClick={handleSsoIntent}>
                  Mit SSO anmelden
                </Button>
              </div>
            ) : ssoResolution ? (
              <p className="mt-3 text-xs text-muted-foreground">
                Fuer diese Domain ist kein aktiver SSO-Provider konfiguriert. Passwortlogin bleibt verfuegbar.
              </p>
            ) : null}
          </div>
        )}

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
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
