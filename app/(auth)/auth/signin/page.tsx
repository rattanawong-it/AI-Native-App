import LoginForm from "@/app/(auth)/auth/signin/LoginForm"
import type { Metadata } from "next"

export const metadata: Metadata = {
  title: "เข้าสู่ระบบ",
  description: "Sign in to your account",
  keywords: ["signin", "authentication", "login"],
  authors: [{ name: "AI Native App Team", url: "https://ai-native-app.com" }],
}

export default function SigninPage() {
  return <LoginForm />
}
