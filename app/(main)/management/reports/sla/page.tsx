import { Metadata } from "next"
import SlaReportContent from "@/app/(main)/management/reports/sla/SlaReportContent"

export const metadata: Metadata = {
    title: "รายงาน SLA",
    description: "อัตราการทำงานตรงตาม SLA แยกตามระดับความสำคัญ หมวดหมู่ เจ้าหน้าที่ และช่วงเวลา",
    keywords: ["SLA", "รายงาน", "Compliance", "ศูนย์ไอที"],
}

export default function SlaReportPage() {
    return <SlaReportContent />
}
