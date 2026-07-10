import type { Metadata } from 'next'
import { Inter, Source_Serif_4 } from 'next/font/google'
import { Toaster } from 'sonner'
import { APP_TITLE } from '@/lib/branding'
import './globals.css'

const inter = Inter({ subsets: ['latin'], variable: '--font-inter' })
const sourceSerif = Source_Serif_4({
  subsets: ['latin'],
  variable: '--font-serif-display',
  weight: ['400', '600', '700'],
})

export const metadata: Metadata = {
  title: `${APP_TITLE} - Transport Portal`,
  description: 'Transport company portal for dispatches, drivers, OTPs, and invoices',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${sourceSerif.variable}`} suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('ultrafreight-theme');if(t==='dark'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}}catch(e){}})()`,
          }}
        />
      </head>
      <body className="font-sans antialiased">
        {children}
        <Toaster position="top-right" richColors closeButton />
      </body>
    </html>
  )
}
