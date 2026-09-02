import { Metadata } from "next"
import RequestContent from "@/app/(main)/management/requests/RequestContent"

export const metadata: Metadata = {
    title: "คำขออนุมัติ",
    description: "คำขอจัดซื้อ เบิกวัสดุ และงบประมาณ — ยื่น ติดตาม และอนุมัติตามลำดับขั้น",
    keywords: ["คำขออนุมัติ", "จัดซื้อ", "เบิกวัสดุ", "งบประมาณ", "ศูนย์ไอที"],
}

export default function RequestsPage() {
    return <RequestContent />
}
