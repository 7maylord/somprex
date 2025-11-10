import type { Metadata } from "next";
import { Geist, Geist_Mono, Inter } from "next/font/google";
import "./globals.css";
import { Providers } from '@/lib/provider'
import { Toaster } from 'sonner'


const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

const inter = Inter({ subsets: ['latin'] })

export const metadata: Metadata = {
  title: 'Somnia Prediction Markets',
  description: 'Multi-event prediction markets powered by Somnia Data Streams',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en">
      <body className={inter.className}>
        <Providers>
          {children}
          <Toaster
            position="top-right"
            duration={4000}
            toastOptions={{
              style: {
                background: '#1f2937',
                color: '#fff',
              },
            }}
          />
        </Providers>
      </body>
    </html>
  )
}