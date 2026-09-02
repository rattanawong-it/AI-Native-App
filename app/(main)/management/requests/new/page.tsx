import { Metadata } from "next"
import RequestFormContent from "@/app/(main)/management/requests/new/RequestFormContent"

export const metadata: Metadata = {
    title: "สร้างคำขออนุมัติ",
    description: "กรอกคำขอจัดซื้อ เบิกวัสดุ หรืองบประมาณ พร้อมกำหนดผู้อนุมัติตามลำดับขั้น",
}

export default function NewRequestPage() {
    return <RequestFormContent />
}
