import { Metadata } from "next"
import WorkloadReportContent from "@/app/(main)/management/reports/workload/WorkloadReportContent"

export const metadata: Metadata = {
    title: "รายงานภาระงานเจ้าหน้าที่",
    description: "เวลาทำงาน (นาที) ที่บันทึกไว้รายคน แยกตามช่วงเวลาและประเภทงาน",
    keywords: ["ภาระงาน", "Time Log", "รายงาน", "ศูนย์ไอที"],
}

export default function WorkloadReportPage() {
    return <WorkloadReportContent />
}
