import { Metadata } from "next"
import TicketDetailContent from "@/app/(main)/service/tickets/[id]/TicketDetailContent"

export const metadata: Metadata = {
    title: "รายละเอียด Ticket",
    description: "รายละเอียด ความคืบหน้า และประวัติการดำเนินงานของ Ticket",
    keywords: ["Ticket", "Helpdesk", "SLA", "ศูนย์ไอที"],
}

export default async function TicketDetailPage({
    params,
}: {
    params: Promise<{ id: string }>
}) {
    const { id } = await params
    return <TicketDetailContent ticketId={id} />
}
