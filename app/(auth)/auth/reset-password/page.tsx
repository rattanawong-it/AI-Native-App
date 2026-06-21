import { Metadata } from "next"
import ResetPasswordForm from "./ResetPasswordForm"

export const metadata: Metadata = {
    title: "ตั้งรหัสผ่านใหม่",
    description:
        "ตั้งรหัสผ่านใหม่ AI Native App — กรอกรหัสผ่านใหม่เพื่อเข้าสู่ระบบอีกครั้ง",
}

export default function ResetPasswordPage() {
    return <ResetPasswordForm />
}
