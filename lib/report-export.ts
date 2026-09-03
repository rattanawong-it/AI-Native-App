// lib/report-export.ts
// สร้างสมุดงาน Excel ของรายงานสรุปประจำเดือน / ไตรมาส (F7.22)
//
// อยู่ใน lib/ ไม่ใช่ในไฟล์ route เพราะเป็นตรรกะล้วน — ทดสอบแยกได้โดยไม่ต้องมี session
// และรับ SummaryReport ที่คำนวณเสร็จแล้วเข้ามา จึงได้ตัวเลขชุดเดียวกับที่หน้าจอแสดง

import ExcelJS from "exceljs"
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/task-board"
import type { CountGroup, Metric, SummaryReport } from "@/lib/report-types"

/// "—" เมื่อยังไม่มีข้อมูลเทียบ · "+12 (+8.5%)" เมื่อมี
function deltaText(m: Metric): string {
    if (m.delta === null) return "—"
    const sign = m.delta > 0 ? "+" : ""
    const pct = m.percent === null ? "" : ` (${sign}${m.percent}%)`
    return `${sign}${m.delta}${pct}`
}

function rateText(rate: number | null): string {
    return rate === null ? "—" : `${rate}%`
}

/// ตกแต่งหัวตารางให้เหมือนกันทุกชีต
function styleHeader(sheet: ExcelJS.Worksheet): void {
    sheet.getRow(1).font = { bold: true }
    sheet.getRow(1).alignment = { vertical: "middle" }
    sheet.views = [{ state: "frozen", ySplit: 1 }]
}

/// ชีตแบบ "กลุ่ม / จำนวน / สัดส่วน" ที่ใช้ซ้ำหลายมิติ
function addGroupSheet(
    workbook: ExcelJS.Workbook,
    name: string,
    header: string,
    groups: CountGroup[]
): void {
    const sheet = workbook.addWorksheet(name)
    sheet.columns = [
        { header, key: "label", width: 34 },
        { header: "จำนวน", key: "count", width: 12 },
        { header: "สัดส่วน", key: "share", width: 12 },
    ]
    styleHeader(sheet)

    const total = groups.reduce((sum, g) => sum + g.count, 0)
    for (const g of groups) {
        sheet.addRow({
            label: g.label,
            count: g.count,
            share: total > 0 ? `${Math.round((g.count / total) * 1000) / 10}%` : "—",
        })
    }
}

export function buildWorkbook(report: SummaryReport): ExcelJS.Workbook {
    const workbook = new ExcelJS.Workbook()
    workbook.creator = "ระบบบริหารงานบริการศูนย์ไอที"
    workbook.created = new Date()

    // ── ชีต 1: สรุปผู้บริหาร ──
    const overview = workbook.addWorksheet("สรุปภาพรวม")
    overview.columns = [
        { header: "รายการ", key: "label", width: 34 },
        { header: "ช่วงที่เลือก", key: "value", width: 18 },
        { header: "ช่วงก่อนหน้า", key: "previous", width: 18 },
        { header: "เปลี่ยนแปลง", key: "delta", width: 20 },
    ]
    styleHeader(overview)

    const metricRow = (label: string, m: Metric) =>
        overview.addRow({
            label,
            value: m.value,
            previous: m.previous ?? "—",
            delta: deltaText(m),
        })

    metricRow("Ticket รับเข้า", report.tickets.created)
    metricRow("Ticket แก้ไขแล้ว", report.tickets.resolved)
    metricRow("Ticket ปิดงาน", report.tickets.closed)
    metricRow("Ticket ค้าง ณ สิ้นช่วง", report.tickets.pending)
    overview.addRow({
        label: "เวลาเฉลี่ยที่ใช้แก้ไข (ชั่วโมง)",
        value: report.tickets.avgResolutionHours ?? "—",
        previous: "—",
        delta: "—",
    })
    overview.addRow({
        label: "SLA ตอบกลับตรงเวลา",
        value: rateText(report.sla.responseRate),
        previous: "—",
        delta: "—",
    })
    overview.addRow({
        label: "SLA แก้ไขตรงเวลา",
        value: rateText(report.sla.resolutionRate),
        previous: rateText(report.sla.previousResolutionRate),
        delta:
            report.sla.resolutionRate !== null && report.sla.previousResolutionRate !== null
                ? `${report.sla.resolutionRate - report.sla.previousResolutionRate > 0 ? "+" : ""}${
                      Math.round(
                          (report.sla.resolutionRate - report.sla.previousResolutionRate) * 10
                      ) / 10
                  } จุด`
                : "—",
    })
    overview.addRow({
        label: "ครั้งที่เกินกำหนด SLA",
        value: report.sla.breached,
        previous: "—",
        delta: "—",
    })
    overview.addRow({
        label: "ชั่วโมงทำงานที่บันทึกไว้",
        value: report.workload.totalHours,
        previous: "—",
        delta: "—",
    })
    metricRow("Task ที่ปิดได้", report.projects.tasksDone)
    metricRow("ครุภัณฑ์ที่รับเข้า", report.assets.purchased)
    overview.addRow({
        label: "มูลค่าครุภัณฑ์ที่รับเข้า (บาท)",
        value: report.assets.purchasedValue,
        previous: "—",
        delta: "—",
    })
    overview.addRow({
        label: "ครุภัณฑ์ใกล้หมดประกัน (90 วัน)",
        value: report.assets.warrantyExpiring,
        previous: "—",
        delta: "—",
    })
    metricRow("คำขออนุมัติที่ยื่นเข้ามา", report.approvals.created)
    metricRow("คำขอที่อนุมัติแล้ว", report.approvals.approved)
    metricRow("คำขอที่ไม่อนุมัติ", report.approvals.rejected)
    overview.addRow({
        label: "มูลค่าคำขอที่อนุมัติ (บาท)",
        value: report.approvals.approvedAmount,
        previous: "—",
        delta: "—",
    })

    // ── ชีต 2–5: สัดส่วน Ticket ตามมิติต่างๆ ──
    addGroupSheet(workbook, "Ticket ตามหมวดหมู่", "หมวดหมู่บริการ", report.tickets.byCategory)
    addGroupSheet(workbook, "Ticket ตามความสำคัญ", "ระดับความสำคัญ", report.tickets.byPriority)
    addGroupSheet(workbook, "Ticket ตามช่องทาง", "ช่องทางที่แจ้ง", report.tickets.byChannel)
    addGroupSheet(workbook, "Ticket ตามสถานะ", "สถานะปัจจุบัน", report.tickets.byStatus)

    // ── ชีต 6: ภาระงานเจ้าหน้าที่ ──
    const workload = workbook.addWorksheet("ภาระงานเจ้าหน้าที่")
    workload.columns = [
        { header: "เจ้าหน้าที่", key: "name", width: 28 },
        { header: "ได้รับมอบหมาย", key: "assigned", width: 16 },
        { header: "แก้ไขแล้ว", key: "resolved", width: 14 },
        { header: "ค้างในมือตอนนี้", key: "openNow", width: 16 },
        { header: "ชั่วโมงที่บันทึก", key: "hours", width: 16 },
    ]
    styleHeader(workload)
    for (const r of report.workload.rows) {
        workload.addRow({
            name: r.name,
            assigned: r.assigned,
            resolved: r.resolved,
            openNow: r.openNow,
            hours: r.hours,
        })
    }

    // ── ชีต 7: ความคืบหน้าโครงการ ──
    const projects = workbook.addWorksheet("ความคืบหน้าโครงการ")
    projects.columns = [
        { header: "รหัส", key: "code", width: 14 },
        { header: "ชื่อโครงการ", key: "name", width: 38 },
        { header: "สถานะ", key: "status", width: 16 },
        { header: "ความคืบหน้า", key: "progress", width: 14 },
        { header: "งานทั้งหมด", key: "totalTasks", width: 14 },
        { header: "งานที่เสร็จ", key: "doneTasks", width: 14 },
        { header: "งานเลยกำหนด", key: "overdueTasks", width: 14 },
        { header: "ชั่วโมงในช่วงนี้", key: "hours", width: 16 },
    ]
    styleHeader(projects)
    for (const p of report.projects.rows) {
        projects.addRow({
            code: p.code,
            name: p.name,
            status: PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status,
            progress: `${p.progress}%`,
            totalTasks: p.totalTasks,
            doneTasks: p.doneTasks,
            overdueTasks: p.overdueTasks,
            hours: p.hours,
        })
    }

    // ── ชีต 8–9: ครุภัณฑ์ + คำขออนุมัติ ──
    addGroupSheet(workbook, "ครุภัณฑ์ตามสถานะ", "สถานะครุภัณฑ์", report.assets.byStatus)
    addGroupSheet(workbook, "คำขอตามประเภท", "ประเภทคำขอ", report.approvals.byType)

    // ── ชีต 10: แนวโน้ม ──
    const trend = workbook.addWorksheet("แนวโน้ม")
    trend.columns = [
        {
            header: report.trend.granularity === "day" ? "วันที่" : "เดือน",
            key: "label",
            width: 18,
        },
        { header: "รับเข้า", key: "created", width: 12 },
        { header: "แก้ไขแล้ว", key: "resolved", width: 12 },
        { header: "SLA แก้ไขตรงเวลา", key: "slaRate", width: 18 },
    ]
    styleHeader(trend)
    for (const p of report.trend.points) {
        trend.addRow({
            label: p.label,
            created: p.created,
            resolved: p.resolved,
            slaRate: rateText(p.slaRate),
        })
    }

    // ── ชีต 11: ที่มาของรายงาน ──
    const meta = workbook.addWorksheet("ข้อมูลรายงาน")
    meta.columns = [
        { header: "หัวข้อ", key: "label", width: 26 },
        { header: "ค่า", key: "value", width: 50 },
    ]
    styleHeader(meta)
    meta.addRow({ label: "ช่วงที่เลือก", value: report.period.label })
    meta.addRow({ label: "ตั้งแต่วันที่", value: report.period.from })
    meta.addRow({ label: "ถึงวันที่", value: report.period.to })
    meta.addRow({ label: "ช่วงที่ใช้เทียบ", value: report.previousPeriod?.label ?? "—" })
    meta.addRow({
        label: "ขอบเขตข้อมูล",
        value: report.scope === "all" ? "ทั้งศูนย์" : "เฉพาะงานของผู้ออกรายงาน",
    })
    meta.addRow({
        label: "ออกรายงานเมื่อ",
        value: new Date(report.generatedAt).toLocaleString("th-TH", {
            timeZone: "Asia/Bangkok",
            dateStyle: "long",
            timeStyle: "short",
        }),
    })
    if (report.truncated) {
        meta.addRow({
            label: "หมายเหตุ",
            value: "ข้อมูลถูกตัดที่เพดานจำนวนแถว — ตัวเลขในรายงานนี้ยังไม่ครบทั้งช่วง",
        })
    }

    return workbook
}
