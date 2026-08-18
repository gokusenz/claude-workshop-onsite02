import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // ปักรากไว้ที่โฟลเดอร์นี้ ไม่งั้น Turbopack ไปเจอ package-lock.json ใน home แล้วเตือนทุกครั้ง
  turbopack: { root: __dirname },
}

export default nextConfig
