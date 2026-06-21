import { Metadata } from "next"
import ForgotPasswordForm from "./ForgotPasswordForm"

export const metadata: Metadata = {
    title: "ลืมรหัสผ่าน",
    description:
        "รีเซ็ตรหัสผ่าน AI Native App — กรอกอีเมลเพื่อรับลิงก์สำหรับตั้งรหัสผ่านใหม่ ระบบจะส่งอีเมลยืนยันให้ภายในไม่กี่วินาที",
    keywords: [
        "ลืมรหัสผ่าน",
        "Forgot Password",
        "รีเซ็ตรหัสผ่าน",
        "Reset Password",
        "AI Native App",
        "Better Auth",
        "กู้คืนบัญชี",
        "Account Recovery",
    ],
}

export default function ForgotPasswordPage() {
    return <ForgotPasswordForm />
}