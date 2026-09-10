// app/(main)/management/departments/layout.tsx
// กันสิทธิ์หน้าทะเบียนหน่วยงานไว้ที่หัวหน้าขึ้นไป — layout ของ /management กันไว้แค่ agent
// จึงต้องกันซ้ำอีกชั้นแบบเดียวกับ /management/lead + วางตัวแสดง toast เฉพาะกลุ่มนี้

import { Toaster } from "@/components/ui/sonner"
import { requireScreen } from "@/lib/screen-guard"

export default async function DepartmentsLayout({ children }: { children: React.ReactNode }) {
    await requireScreen("ORG_CONFIG")

    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
