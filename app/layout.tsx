import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'Order Entry - Trade Show',
  description: 'Offline order entry system for trade shows',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  )
}




