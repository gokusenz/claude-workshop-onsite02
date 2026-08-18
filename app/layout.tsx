import type { Metadata, Viewport } from 'next'
import { Noto_Sans_Thai } from 'next/font/google'
import './globals.css'

// ไม่ระบุ weight โดยตั้งใจ — Noto Sans Thai เป็น variable font ได้น้ำหนักครบในไฟล์เดียว
const notoSansThai = Noto_Sans_Thai({
  subsets: ['thai', 'latin'],
  variable: '--font-noto-sans-thai',
  display: 'swap',
})

export const metadata: Metadata = {
  title: 'กรีนสแมช เทนนิส — จองคิวสนาม',
}

export const viewport: Viewport = {
  colorScheme: 'dark',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={notoSansThai.variable}>
      <body className="bg-ink text-slate-100 font-sans min-h-screen">{children}</body>
    </html>
  )
}
