// app/api/sla-policies/route.ts
// GET  — รายการนโยบาย SLA ทั้งหมด (เจ้าหน้าที่ขึ้นไปอ่านได้ ใช้ดูกำหนดเวลาที่ระบบใช้จริง)
// POST — เพิ่มนโยบายใหม่ (F4.1 — admin เท่านั้น ตาม spec §7 "ตั้งค่า SLA / Catalog / ปฏิทิน")
// ผ่าน NFR1 (ตรวจ session) · NFR2 (zod)

import { NextRequest, NextResponse } from "next/server"
import { prisma } from "@/lib/prisma"
import { requireRole, badRequest } from "@/lib/rbac"
import { PRIORITY_WEIGHT, type Priority } from "@/lib/priority"
import { firstIssueMessage } from "@/lib/ticket-schema"
import { createSlaPolicySchema } from "@/lib/sla-schema"
import { slaPolicySelect, type SlaPolicyRow } from "@/lib/sla-service"

/// เรียงวิกฤต → ต่ำ แล้วให้ "นโยบายรวม" มาก่อนนโยบายเฉพาะหมวด
function sortPolicies(rows: SlaPolicyRow[]): SlaPolicyRow[] {
    return [...rows].sort((a, b) => {
        const w =
            (PRIORITY_WEIGHT[b.priority as Priority] ?? 0) -
            (PRIORITY_WEIGHT[a.priority as Priority] ?? 0)
        if (w !== 0) return w
        if (!a.categoryId && b.categoryId) return -1
        if (a.categoryId && !b.categoryId) return 1
        return (a.category?.name ?? "").localeCompare(b.category?.name ?? "", "th")
    })
}

export async function GET() {
    const guard = await requireRole(["agent", "manager", "admin"])
    if (!guard.ok) return guard.response

    try {
        const policies = await prisma.slaPolicy.findMany({ select: slaPolicySelect })
        return NextResponse.json({ policies: sortPolicies(policies) })
    } catch (error) {
        console.error("SlaPolicy GET Error:", error)
        return NextResponse.json({ error: "ไม่สามารถโหลดนโยบาย SLA ได้" }, { status: 500 })
    }
}

export async function POST(request: NextRequest) {
    const guard = await requireRole(["admin"])
    if (!guard.ok) return guard.response

    let body: unknown
    try {
        body = await request.json()
    } catch {
        return badRequest("รูปแบบข้อมูลไม่ถูกต้อง")
    }

    const parsed = createSlaPolicySchema.safeParse(body)
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const input = parsed.data
    const categoryId = input.categoryId ?? null

    try {
        if (categoryId) {
            const category = await prisma.serviceCategory.findUnique({
                where: { id: categoryId },
                select: { id: true },
            })
            if (!category) return badRequest("ไม่พบหมวดหมู่ที่เลือก")
        }

        // unique([priority, categoryId]) พึ่งไม่ได้เมื่อ categoryId เป็น null
        // เพราะ Postgres ถือว่า NULL แต่ละแถวต่างกัน จึงต้องตรวจซ้ำเอง (เหมือนใน seed)
        const duplicate = await prisma.slaPolicy.findFirst({
            where: { priority: input.priority, categoryId },
            select: { id: true },
        })
        if (duplicate) {
            return badRequest(
                categoryId
                    ? "มีนโยบายของระดับความสำคัญนี้ในหมวดหมู่ที่เลือกอยู่แล้ว"
                    : "มีนโยบายรวมของระดับความสำคัญนี้อยู่แล้ว"
            )
        }

        const policy = await prisma.slaPolicy.create({
            data: {
                name: input.name,
                priority: input.priority,
                categoryId,
                responseMinutes: input.responseMinutes,
                resolutionMinutes: input.resolutionMinutes,
                active: input.active,
            },
            select: slaPolicySelect,
        })

        return NextResponse.json({ policy }, { status: 201 })
    } catch (error) {
        console.error("SlaPolicy POST Error:", error)
        return NextResponse.json({ error: "ไม่สามารถบันทึกนโยบาย SLA ได้" }, { status: 500 })
    }
}
