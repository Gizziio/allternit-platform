import type { Metadata } from "next"
import "@/design/theme.css"
import "./globals.css"
import { PlatformAuthProvider } from "@/lib/platform-auth-client"

export const metadata: Metadata = {
  title: "Allternit Platform",
  description: "AI-powered autonomous coding platform",
  icons: { icon: "/favicon.svg" },
  openGraph: {
    title: "Allternit Platform",
    description: "AI-powered autonomous coding platform",
    type: "website",
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body className="m-0 font-sans">
        <PlatformAuthProvider>{children}</PlatformAuthProvider>
      </body>
    </html>
  )
}
