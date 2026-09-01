// app/(main)/admin/layout.tsx
// วางตัวแสดง toast ไว้ที่กลุ่มหน้า admin — แบบเดียวกับ app/(main)/service/layout.tsx
// เพื่อไม่ต้องแตะ layout เดิมของแอป
//
// หน้า admin/catalog (Phase 1) เรียก toast อยู่แล้วแต่ยังไม่มีตัวแสดง จึงไม่เคยขึ้นจริง
// ไฟล์นี้ทำให้ทั้ง catalog, sla และ calendar แสดงผลการบันทึกได้

import { Toaster } from "@/components/ui/sonner"

export default function AdminLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
