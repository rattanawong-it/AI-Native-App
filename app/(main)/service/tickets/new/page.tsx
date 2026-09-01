import { Metadata } from "next"
import NewTicketContent from "@/app/(main)/service/tickets/new/NewTicketContent"

export const metadata: Metadata = {
    title: "แจ้งปัญหาใหม่",
    description: "แจ้งปัญหาหรือขอรับบริการจากศูนย์ไอที",
    keywords: ["แจ้งปัญหา", "คำขอบริการ", "Ticket", "ศูนย์ไอที"],
}

export default function NewTicketPage() {
    return <NewTicketContent />
}
