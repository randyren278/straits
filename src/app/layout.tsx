import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Tanker Tracker',
  description: 'Real-time tanker tracking and monitoring',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
