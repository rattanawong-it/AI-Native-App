import { Metadata } from "next"
import SignupForm from "./SignupForm"

export const metadata: Metadata = {
    title: "สมัครสมาชิก",
    description:
        "สมัครสมาชิก AI Native App — สร้างบัญชีเพื่อเข้าถึง RAG Chatbot อัจฉริยะ, Knowledge Base Management และระบบ AI ครบวงจร รองรับ Social Login ผ่าน Google, GitHub และ LINE",
    keywords: [
        "สมัครสมาชิก",
        "Sign Up",
        "สร้างบัญชี",
        "AI Native App",
        "Better Auth",
        "Next.js 16",
        "RAG Chatbot",
        "Knowledge Base",
        "AI Application",
        "ระบบสมาชิก",
    ],
}

export default function SignUpPage() {
    return <SignupForm />
}