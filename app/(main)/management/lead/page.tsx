import { Metadata } from "next"
import LeadContent from "@/app/(main)/management/lead/LeadContent"
import { requireScreen } from "@/lib/screen-guard"

export const metadata: Metadata = {
    title: "Leads",
    description: "จัดการ Lead ที่เข้ามาจากเว็บไซต์และช่องทางต่าง ๆ",
    keywords: ["Leads", "ลีด", "AI Native App", "Lead Management"],
}

export default async function LeadPage() {
  // ข้อยกเว้นของกลุ่ม /management — หน้านี้เป็นกลุ่ม 7 (ลูกค้าสัมพันธ์) ที่ต้อง manager ขึ้นไป
  // ส่วน layout ครอบด้านนอกกันไว้แค่ agent (docs/spec.md §7.2)
  await requireScreen("CRM")
  return <LeadContent />
}