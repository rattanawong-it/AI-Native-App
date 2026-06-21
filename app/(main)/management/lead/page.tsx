import { Metadata } from "next"
import LeadContent from "@/app/(main)/management/lead/LeadContent"

export const metadata: Metadata = {
    title: "Leads",
    description: "จัดการ Lead ที่เข้ามาจากเว็บไซต์และช่องทางต่าง ๆ",
    keywords: ["Leads", "ลีด", "AI Native App", "Lead Management"],
}

export default function LeadPage() {
  return <LeadContent />
}