import { Metadata } from "next"
import SummaryReportContent from "@/app/(main)/management/reports/summary/SummaryReportContent"

export const metadata: Metadata = {
    title: "รายงานสรุปผลการดำเนินงาน",
    description:
        "รายงานประจำเดือน / ไตรมาส ของศูนย์เทคโนโลยีสารสนเทศ — Ticket, SLA, ภาระงาน, โครงการ, ครุภัณฑ์และคำขออนุมัติ",
    keywords: ["รายงาน", "ประจำเดือน", "ไตรมาส", "SLA", "ศูนย์ไอที"],
}

export default function SummaryReportPage() {
    return <SummaryReportContent />
}
