// app/(main)/admin/layout.tsx
// กันสิทธิ์ทั้งกลุ่ม /admin (docs/spec.md §7.2 กลุ่ม 8-9) + วางตัวแสดง toast
//
// หน้า admin/catalog (Phase 1) เรียก toast อยู่แล้วแต่ยังไม่มีตัวแสดง จึงไม่เคยขึ้นจริง
// ไฟล์นี้ทำให้ทั้ง catalog, sla และ calendar แสดงผลการบันทึกได้

import { Toaster } from "@/components/ui/sonner"
import { requireScreen } from "@/lib/screen-guard"

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
    // กันทั้งกลุ่ม 8 (ตั้งค่าบริการ) และกลุ่ม 9 (ผู้ดูแลระบบ) ซึ่งเป็น admin เหมือนกัน
    // ก่อนหน้านี้กันไว้แค่ 3 หน้าที่เขียน guard เอง ทำให้ /admin/catalog, /admin/sla
    // และ /admin/calendar เปิดได้ด้วยการพิมพ์ URL ตรง
    await requireScreen("SYSTEM_ADMIN")

    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
