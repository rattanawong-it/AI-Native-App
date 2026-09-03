import { Suspense } from "react"
import LoginForm from "@/app/(auth)/auth/signin/LoginForm"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "Sign in to your account",
  keywords: ["signin", "authentication", "login"],
  authors: [{ name: "AI Native App Team", url: "https://ai-native-app.com" }],
}

export default function SigninPage() {
  // LoginForm อ่าน ?callbackUrl ด้วย useSearchParams จึงต้องมี Suspense คั่น
  // ไม่งั้น Next จะบังคับให้ทั้งหน้าเรนเดอร์แบบ dynamic
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  )
}
