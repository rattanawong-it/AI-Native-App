import { Metadata } from "next"
import Link from "next/link"
import { BarChart3, Timer, Users, ArrowRight, type LucideIcon } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
    title: "รายงาน",
    description: "รายงานของศูนย์เทคโนโลยีสารสนเทศ",
    keywords: ["รายงาน", "ศูนย์ไอที"],
}

interface ReportLink {
    href: string
    title: string
    description: string
    icon: LucideIcon
    /// รายงานหลักที่ใช้ส่งผู้บริหาร — วางเต็มความกว้างไว้บนสุด
    featured?: boolean
}

/// รายงานที่เปิดใช้งานแล้ว — เพิ่มรายการที่นี่เมื่อทำรายงานเฟสถัดไปเสร็จ
const REPORTS: ReportLink[] = [
    {
        href: "/management/reports/summary",
        title: "รายงานสรุปผลการดำเนินงาน (รายเดือน / ไตรมาส)",
        description:
            "รายงานฉบับเดียวที่รวม Ticket, SLA, ภาระงานเจ้าหน้าที่, ความคืบหน้าโครงการ, ครุภัณฑ์และคำขออนุมัติ พร้อมกราฟแนวโน้ม ส่งออก Excel และพิมพ์เป็น PDF ได้",
        icon: BarChart3,
        featured: true,
    },
    {
        href: "/management/reports/sla",
        title: "รายงาน SLA Compliance",
        description:
            "% การตอบกลับและแก้ไขตรงตามกำหนด แยกตามระดับความสำคัญ หมวดหมู่ เจ้าหน้าที่ และช่วงเวลา พร้อมรายการ Ticket ที่เกินกำหนด",
        icon: Timer,
    },
    {
        href: "/management/reports/workload",
        title: "รายงานภาระงานเจ้าหน้าที่",
        description:
            "ชั่วโมงทำงานที่บันทึกไว้รายคน รายวัน/สัปดาห์/เดือน พร้อมจำนวน Ticket ที่ยังค้างอยู่ในมือ (หัวหน้าขึ้นไป)",
        icon: Users,
    },
]

export default function ReportsPage() {
    const featured = REPORTS.filter((r) => r.featured)
    const rest = REPORTS.filter((r) => !r.featured)

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">รายงาน</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    รายงานที่ออกจากข้อมูลจริงในระบบ · เจ้าหน้าที่เห็นเฉพาะงานของตัวเอง
                    หัวหน้าขึ้นไปเห็นทั้งศูนย์
                </p>
            </div>

            <div className="space-y-4">
                {featured.map((r) => (
                    <ReportCard key={r.href} report={r} />
                ))}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {rest.map((r) => (
                    <ReportCard key={r.href} report={r} />
                ))}
            </div>
        </div>
    )
}

function ReportCard({ report }: { report: ReportLink }) {
    const Icon = report.icon

    return (
        <Link href={report.href} className="block">
            <Card
                className={`hover:border-primary/40 h-full transition-colors ${
                    report.featured ? "border-primary/30" : ""
                }`}
            >
                <CardContent className="flex gap-4">
                    <Icon className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                    <div className="min-w-0">
                        <p className="flex items-center gap-1.5 font-medium">
                            {report.title}
                            <ArrowRight className="size-4 shrink-0" />
                        </p>
                        <p className="text-muted-foreground mt-1 text-sm">{report.description}</p>
                    </div>
                </CardContent>
            </Card>
        </Link>
    )
}
