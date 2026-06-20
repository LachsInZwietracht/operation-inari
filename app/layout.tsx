import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { ThemeProvider } from "@/components/theme-provider";
import { Toaster } from "@/components/ui/sonner";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const DEFAULT_METADATA_BASE_URL = "http://localhost:3000";

function resolveMetadataBase() {
  const configuredUrl =
    [
      process.env.NEXT_PUBLIC_SITE_URL,
      process.env.VERCEL_PROJECT_PRODUCTION_URL,
      process.env.VERCEL_URL,
    ].find((value): value is string => Boolean(value?.trim())) ??
    DEFAULT_METADATA_BASE_URL;

  return new URL(
    /^https?:\/\//.test(configuredUrl) ? configuredUrl : `https://${configuredUrl}`,
  );
}

export const metadata: Metadata = {
  metadataBase: resolveMetadataBase(),
  title: "Inari — Ernährungsberatung",
  description: "Professionelle Software für Ernährungsberatung und Diätetik",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon/favicon.ico", sizes: "any" },
      { url: "/favicon/favicon.svg", type: "image/svg+xml" },
      { url: "/favicon/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: [
      { url: "/app-icons/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      {
        rel: "mask-icon",
        url: "/favicon/safari-pinned-tab.svg",
        color: "#08772C",
      },
    ],
  },
  openGraph: {
    title: "Inari — Ernährungsberatung",
    description: "Professionelle Software für Ernährungsberatung und Diätetik",
    images: [
      {
        url: "/social/og-image-1200x630.png",
        width: 1200,
        height: 630,
        alt: "Inari",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Inari — Ernährungsberatung",
    description: "Professionelle Software für Ernährungsberatung und Diätetik",
    images: ["/social/twitter-card-1200x600.png"],
  },
  other: {
    "msapplication-TileColor": "#FFFFFF",
    "msapplication-TileImage": "/app-icons/mstile-150x150.png",
  },
};

export const viewport: Viewport = {
  themeColor: "#08772C",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="de" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased`}
      >
        <ThemeProvider
          attribute="class"
          defaultTheme="system"
          enableSystem
          disableTransitionOnChange
        >
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
