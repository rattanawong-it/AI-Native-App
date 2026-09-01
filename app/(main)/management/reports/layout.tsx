// app/(main)/management/reports/layout.tsx
// วางตัวแสดง toast ไว้เฉพาะกลุ่มหน้ารายงาน — แบบเดียวกับ service/ และ admin/
// จำกัดขอบเขตไว้ที่ reports/ เพื่อไม่ให้กระทบหน้าเดิมใน management/ (lead, projects, teams)

import { Toaster } from "@/components/ui/sonner"

export default function ReportsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
