// app/(main)/management/layout.tsx
// กันสิทธิ์กลุ่ม /management ทั้งหมดไว้ที่ agent ขึ้นไป
// ครอบคลุมกลุ่ม 5 (งานธุรการศูนย์), 6 (งานพัฒนา) และ 4 บางส่วน (จัดการบทความ KB)
// ตาม docs/spec.md §7.2
//
// /management/lead เป็นข้อยกเว้น — เป็นกลุ่ม 7 ที่ต้อง manager ขึ้นไป
// จึงเรียก requireScreen("CRM") ซ้ำอีกชั้นในหน้าตัวเอง

import { requireScreen } from "@/lib/screen-guard"

export default async function ManagementLayout({ children }: { children: React.ReactNode }) {
    await requireScreen("OPERATIONS")
    return <>{children}</>
}
