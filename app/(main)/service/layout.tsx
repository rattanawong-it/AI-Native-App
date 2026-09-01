// app/(main)/service/layout.tsx
// วางตัวแสดง toast ไว้ที่กลุ่มหน้า service เท่านั้น เพื่อไม่ต้องแตะ layout เดิมของแอป

import { Toaster } from "@/components/ui/sonner"

export default function ServiceLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
