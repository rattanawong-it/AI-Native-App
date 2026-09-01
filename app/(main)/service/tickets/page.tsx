import { Metadata } from "next"
import TicketListContent from "@/app/(main)/service/tickets/TicketListContent"

export const metadata: Metadata = {
    title: "Ticket ทั้งหมด",
    description: "จัดการและติดตาม Helpdesk Ticket ทั้งหมดในระบบ",
    keywords: ["Ticket", "Helpdesk", "แจ้งปัญหา", "ศูนย์ไอที"],
}

export default function TicketListPage() {
    return <TicketListContent />
}
