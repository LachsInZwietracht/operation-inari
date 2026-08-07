import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Ernährungs-Onboarding — Inari",
  description:
    "Beantworten Sie ein paar Fragen zu Ihren Zielen, Vorlieben und Ihrem Alltag, damit Ihre Ernährungsberatung einen passenden Plan erstellen kann.",
};

export default function OnboardingLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="min-h-screen bg-background font-sans antialiased">
      <ThemeProvider
        attribute="class"
        defaultTheme="light"
        enableSystem={false}
        disableTransitionOnChange
      >
        <main className="mx-auto max-w-lg px-4 py-8">{children}</main>
        <Toaster />
      </ThemeProvider>
    </div>
  );
}
