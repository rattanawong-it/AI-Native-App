import { Metadata } from "next"
import SlaContent from "@/app/(main)/admin/sla/SlaContent"

export const metadata: Metadata = {
    title: "SLA Policy",
    description: "ตั้งค่าเวลาตอบกลับและเวลาแก้ไขตามระดับความสำคัญและหมวดหมู่บริการ",
    keywords: ["SLA", "ข้อตกลงระดับการให้บริการ", "ศูนย์ไอที"],
}

export default function SlaPage() {
    return <SlaContent />
}
