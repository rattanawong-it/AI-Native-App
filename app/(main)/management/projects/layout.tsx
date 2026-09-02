// app/(main)/management/projects/layout.tsx
// วางตัวแสดง toast ไว้เฉพาะกลุ่มหน้าโครงการ — แบบเดียวกับ service/, admin/ และ reports/
// จำกัดขอบเขตไว้ที่ projects/ เพื่อไม่ให้กระทบหน้าเดิมอื่นใน management/ (lead)

import { Toaster } from "@/components/ui/sonner"

export default function ProjectsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
