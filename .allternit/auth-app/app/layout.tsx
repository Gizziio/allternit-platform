import { ClerkProvider } from "@clerk/nextjs"
import "./typography.css"

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <ClerkProvider>
      <html lang="en">
        <body className="text-body">{children}</body>
      </html>
    </ClerkProvider>
  )
}
