import { Metadata } from "next"
import Link from "next/link"
import { BarChart3, Timer, ArrowRight } from "lucide-react"
import { Card, CardContent } from "@/components/ui/card"

export const metadata: Metadata = {
    title: "รายงาน",
    description: "รายงานของศูนย์เทคโนโลยีสารสนเทศ",
    keywords: ["รายงาน", "ศูนย์ไอที"],
}

/// รายงานที่เปิดใช้งานแล้ว — เพิ่มรายการที่นี่เมื่อทำรายงานเฟสถัดไปเสร็จ
const REPORTS = [
    {
        href: "/management/reports/sla",
        title: "รายงาน SLA Compliance",
        description:
            "% การตอบกลับและแก้ไขตรงตามกำหนด แยกตามระดับความสำคัญ หมวดหมู่ เจ้าหน้าที่ และช่วงเวลา พร้อมรายการ Ticket ที่เกินกำหนด",
    },
    {
        href: "/management/reports/workload",
        title: "รายงานภาระงานเจ้าหน้าที่",
        description:
            "ชั่วโมงทำงานที่บันทึกไว้รายคน รายวัน/สัปดาห์/เดือน พร้อมจำนวน Ticket ที่ยังค้างอยู่ในมือ (หัวหน้าขึ้นไป)",
    },
]

export default function ReportsPage() {
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-2xl font-semibold tracking-tight">รายงาน</h1>
                <p className="text-muted-foreground mt-1 text-sm">
                    รายงานที่ออกจากข้อมูลจริงในระบบ · เจ้าหน้าที่เห็นเฉพาะงานของตัวเอง
                    หัวหน้าขึ้นไปเห็นทั้งศูนย์
                </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
                {REPORTS.map((r) => (
                    <Link key={r.href} href={r.href} className="block">
                        <Card className="hover:border-primary/40 h-full transition-colors">
                            <CardContent className="flex gap-4">
                                <Timer className="text-muted-foreground mt-0.5 size-5 shrink-0" />
                                <div className="min-w-0">
                                    <p className="flex items-center gap-1.5 font-medium">
                                        {r.title}
                                        <ArrowRight className="size-4" />
                                    </p>
                                    <p className="text-muted-foreground mt-1 text-sm">
                                        {r.description}
                                    </p>
                                </div>
                            </CardContent>
                        </Card>
                    </Link>
                ))}
            </div>

            <Card>
                <CardContent className="text-muted-foreground flex gap-3 text-sm">
                    <BarChart3 className="mt-0.5 size-4 shrink-0 opacity-60" />
                    <span>
                        รายงานประจำเดือน / ไตรมาส ภาระงานรายบุคคล และการส่งออกรายงานรวม
                        จะเพิ่มในเฟสถัดไปตามแผนพัฒนา (spec §11 เฟส 8)
                    </span>
                </CardContent>
            </Card>
        </div>
    )
}
