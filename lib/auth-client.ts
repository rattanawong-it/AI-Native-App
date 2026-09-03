import { createAuthClient } from "better-auth/react"
import { adminClient, twoFactorClient } from "better-auth/client/plugins"
import { ac, admin, manager, agent, user, student } from "./permissions"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    adminClient({
      ac,
      // ต้องลงทะเบียนให้ครบทั้ง 5 role เท่าที่ lib/auth.ts ฝั่ง server ลงทะเบียนไว้
      // เดิมมีแค่ 3 ตัว ฝั่ง client จึงตรวจสิทธิ์ของ agent/student ไม่ได้
      roles: { admin, manager, agent, user, student },
    }),
    twoFactorClient({
      onTwoFactorRedirect() {
        // เมื่อ Sign-in สำเร็จแต่ต้องยืนยัน 2FA → redirect ไปหน้า verify
        window.location.href = "/auth/verify-2fa"
      },
    }),
  ],
})

export const { signIn, signUp, signOut, useSession } = authClient