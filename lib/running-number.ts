// lib/running-number.ts
// สร้างเลขที่เอกสารแบบรันนิ่งรายเดือน — TK-256908-00001 / RQ-256908-0001
// อ้างอิง docs/spec.md §5.2, §5.6 และ F0.11
//
// ปีที่ใช้เป็น "พ.ศ." ตาม NFR4 และตรงกับตัวอย่างในไฟล์ดีไซน์ (TK-256908-042)

import { prisma } from "@/lib/prisma"

/// ส่วนนำหน้าของเลขที่ — ปรับได้ผ่าน env (M13)
const TICKET_PREFIX = process.env.TICKET_PREFIX || "TK"
const REQUEST_PREFIX = process.env.REQUEST_PREFIX || "RQ"

const BKK_OFFSET_MS = 7 * 60 * 60 * 1000

/// "256908" — ปี พ.ศ. + เดือน ตามเวลาไทย
export function periodCode(date: Date = new Date()): string {
    const bkk = new Date(date.getTime() + BKK_OFFSET_MS)
    const buddhistYear = bkk.getUTCFullYear() + 543
    const month = String(bkk.getUTCMonth() + 1).padStart(2, "0")
    return `${buddhistYear}${month}`
}

/// ดึงลำดับที่ท้ายเลขที่เอกสาร — คืน 0 ถ้ารูปแบบไม่ตรง
function sequenceOf(docNo: string): number {
    const parts = docNo.split("-")
    const n = Number(parts[parts.length - 1])
    return Number.isFinite(n) ? n : 0
}

/// จำนวนครั้งที่ยอมให้ลองใหม่เมื่อชนกัน (unique constraint)
const MAX_RETRY = 5

/// สร้างเลขที่ Ticket ถัดไปของเดือนนี้ — เช่น "TK-256908-00042"
///
/// เรียกใช้คู่กับการสร้าง Ticket เสมอ และดักกรณีชนกันด้วย `createWithRunningNumber`
export async function nextTicketNo(date: Date = new Date()): Promise<string> {
    const period = `${TICKET_PREFIX}-${periodCode(date)}-`
    const latest = await prisma.ticket.findFirst({
        where: { ticketNo: { startsWith: period } },
        orderBy: { ticketNo: "desc" },
        select: { ticketNo: true },
    })
    const next = (latest ? sequenceOf(latest.ticketNo) : 0) + 1
    return `${period}${String(next).padStart(5, "0")}`
}

/// สร้างเลขที่คำขออนุมัติถัดไปของเดือนนี้ — เช่น "RQ-256908-0007"
export async function nextRequestNo(date: Date = new Date()): Promise<string> {
    const period = `${REQUEST_PREFIX}-${periodCode(date)}-`
    const latest = await prisma.approvalRequest.findFirst({
        where: { requestNo: { startsWith: period } },
        orderBy: { requestNo: "desc" },
        select: { requestNo: true },
    })
    const next = (latest ? sequenceOf(latest.requestNo) : 0) + 1
    return `${period}${String(next).padStart(4, "0")}`
}

/// รันคำสั่งสร้างเรคคอร์ดพร้อมเลขที่รันนิ่ง และลองใหม่อัตโนมัติถ้าเลขชนกัน
///
///   const ticket = await createWithRunningNumber(nextTicketNo, (no) =>
///       prisma.ticket.create({ data: { ...input, ticketNo: no } })
///   )
export async function createWithRunningNumber<T>(
    generate: () => Promise<string>,
    create: (docNo: string) => Promise<T>
): Promise<T> {
    let lastError: unknown

    for (let attempt = 0; attempt < MAX_RETRY; attempt++) {
        const docNo = await generate()
        try {
            return await create(docNo)
        } catch (error) {
            // P2002 = unique constraint — มีคนสร้างเลขเดียวกันตัดหน้าไปแล้ว ลองใหม่
            if ((error as { code?: string }).code === "P2002") {
                lastError = error
                continue
            }
            throw error
        }
    }

    console.error("running-number: สร้างเลขที่เอกสารไม่สำเร็จหลังลองใหม่หลายครั้ง", lastError)
    throw new Error("ไม่สามารถออกเลขที่เอกสารได้ กรุณาลองใหม่อีกครั้ง")
}

/// สร้าง slug ภาษาไทย/อังกฤษสำหรับบทความ KB — ต่อท้ายด้วยรหัสสุ่มกันชน
export function slugify(title: string, suffix?: string): string {
    const base = title
        .toLowerCase()
        .trim()
        .replace(/[^\p{L}\p{N}]+/gu, "-")
        .replace(/^-+|-+$/g, "")
        .slice(0, 80)
    return suffix ? `${base}-${suffix}` : base
}
