import type { Metadata } from "next";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

export const metadata: Metadata = {
  title: "Ernährungsprotokoll ausfüllen — Inari",
  description:
    "Füllen Sie Ihr Ernährungsprotokoll aus und senden Sie es an Ihre Ernährungsberatung.",
};

export default function ProtokollLayout({
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
