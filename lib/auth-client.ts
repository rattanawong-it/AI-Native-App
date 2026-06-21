import { createAuthClient } from "better-auth/react"
import { adminClient, twoFactorClient } from "better-auth/client/plugins"
import { ac, admin, manager, user } from "./permissions"

export const authClient = createAuthClient({
  baseURL: process.env.NEXT_PUBLIC_BETTER_AUTH_URL || "http://localhost:3000",
  plugins: [
    adminClient({
      ac,
      roles: { admin, manager, user },
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