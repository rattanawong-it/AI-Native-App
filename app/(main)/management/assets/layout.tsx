// app/(main)/management/assets/layout.tsx
// วางตัวแสดง toast ไว้เฉพาะกลุ่มหน้าครุภัณฑ์ — แบบเดียวกับ reports/ และ service/
// จำกัดขอบเขตไว้เพื่อไม่ให้กระทบหน้าเดิมใน management/ (lead, projects, teams)

import { Toaster } from "@/components/ui/sonner"

export default function AssetsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
