import type { Metadata } from "next"
import "@/design/theme.css"
import "./globals.css"
import { PlatformAuthProvider } from "@/lib/platform-auth-client"
import { ThemeProvider } from "@/design/ThemeProvider"

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

// Inline script that runs before any paint to apply the saved theme.
// Prevents the flash from light-mode CSS variables before JS hydrates.
const THEME_INIT_SCRIPT = `(function(){try{var s=localStorage.getItem('allternit-theme-storage');var t=s&&JSON.parse(s)&&JSON.parse(s).state&&JSON.parse(s).state.theme;var r=t==='dark'?'dark':t==='light'?'light':(window.matchMedia&&window.matchMedia('(prefers-color-scheme: dark)').matches?'dark':'light');document.documentElement.setAttribute('data-theme',r);document.documentElement.style.colorScheme=r;}catch(e){}})();`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* eslint-disable-next-line @next/next/no-sync-scripts */}
        <script dangerouslySetInnerHTML={{ __html: THEME_INIT_SCRIPT }} />
      </head>
      <body className="m-0 font-sans">
        <ThemeProvider>
          <PlatformAuthProvider>{children}</PlatformAuthProvider>
        </ThemeProvider>
      </body>
    </html>
  )
}
