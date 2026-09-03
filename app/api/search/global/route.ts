// app/api/search/global/route.ts
// GET — ค้นหารวมข้าม Ticket / บทความ KB / โครงการ / ครุภัณฑ์ (F9.6)
//
// ⚠️ อย่าสับสนกับ `POST /api/search` ซึ่งเป็นการค้นเชิงความหมายในคลังเอกสาร RAG (pgvector)
//    เส้นนี้เป็นการค้นข้อความตรงๆ ข้ามตารางงานของระบบ ITSM คนละงานกันคนละเส้น
//
// สิทธิ์แยกรายแหล่ง ไม่ใช่ทั้งก้อน — ผู้ใช้ทั่วไปค้นได้แต่ Ticket ของตัวเองกับบทความสาธารณะ
// ส่วนโครงการและครุภัณฑ์เป็นของเจ้าหน้าที่ขึ้นไปตาม spec §7 แหล่งที่ไม่มีสิทธิ์จะไม่ถูก query เลย

import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { prisma } from "@/lib/prisma"
import { requireAuth, badRequest, isStaff } from "@/lib/rbac"
import { firstIssueMessage, searchParamsToObject } from "@/lib/ticket-schema"
import { kbScopeWhere } from "@/lib/kb-service"
import { TICKET_STATUS_LABEL, type TicketStatus } from "@/lib/ticket-workflow"
import { PROJECT_STATUS_LABEL, type ProjectStatus } from "@/lib/task-board"
import { ASSET_STATUS_LABEL, type AssetStatus } from "@/lib/asset-workflow"
import { KB_STATUS_LABEL, type KbStatus } from "@/lib/kb-workflow"

/// จำนวนผลลัพธ์สูงสุดต่อหนึ่งแหล่ง — หน้าค้นหารวมเป็นทางผ่าน ไม่ใช่หน้ารายการเต็ม
const PER_SOURCE = 5

const querySchema = z.object({
    q: z.string().trim().min(2, "พิมพ์คำค้นอย่างน้อย 2 ตัวอักษร").max(100),
})

export const SEARCH_SOURCES = ["ticket", "kb", "project", "asset"] as const
export type SearchSource = (typeof SEARCH_SOURCES)[number]

export interface GlobalSearchHit {
    source: SearchSource
    id: string
    title: string
    /// รหัสอ้างอิงที่คนใช้เรียกของชิ้นนั้น — เลขที่ Ticket, รหัสโครงการ, รหัสครุภัณฑ์
    code: string | null
    /// สถานะในภาษาของแหล่งนั้น
    status: string | null
    context: string | null
    href: string
}

export async function GET(request: NextRequest) {
    const guard = await requireAuth()
    if (!guard.ok) return guard.response
    const { user } = guard

    const parsed = querySchema.safeParse(searchParamsToObject(new URL(request.url)))
    if (!parsed.success) return badRequest(firstIssueMessage(parsed.error))
    const { q } = parsed.data

    const like = { contains: q, mode: "insensitive" as const }
    const staff = isStaff(user)

    try {
        const [tickets, articles, projects, assets] = await Promise.all([
            prisma.ticket.findMany({
                where: {
                    // NFR3 — ผู้ที่ไม่ใช่เจ้าหน้าที่เห็นเฉพาะใบที่ตัวเองแจ้ง
                    ...(staff ? {} : { requesterId: user.id }),
                    OR: [{ title: like }, { description: like }, { ticketNo: like }],
                },
                select: {
                    id: true,
                    ticketNo: true,
                    title: true,
                    status: true,
                    category: { select: { name: true } },
                },
                orderBy: { updatedAt: "desc" },
                take: PER_SOURCE,
            }),
            prisma.kbArticle.findMany({
                where: {
                    ...kbScopeWhere(user),
                    OR: [{ title: like }, { summary: like }, { content: like }],
                },
                select: {
                    id: true,
                    slug: true,
                    title: true,
                    summary: true,
                    status: true,
                },
                orderBy: { updatedAt: "desc" },
                take: PER_SOURCE,
            }),
            staff
                ? prisma.project.findMany({
                      where: { OR: [{ name: like }, { code: like }, { description: like }] },
                      select: { id: true, code: true, name: true, status: true },
                      orderBy: { updatedAt: "desc" },
                      take: PER_SOURCE,
                  })
                : Promise.resolve([]),
            staff
                ? prisma.asset.findMany({
                      where: {
                          OR: [
                              { name: like },
                              { assetCode: like },
                              { serialNumber: like },
                              { brand: like },
                              { model: like },
                          ],
                      },
                      select: {
                          id: true,
                          assetCode: true,
                          name: true,
                          status: true,
                          location: true,
                      },
                      orderBy: { updatedAt: "desc" },
                      take: PER_SOURCE,
                  })
                : Promise.resolve([]),
        ])

        const hits: GlobalSearchHit[] = [
            ...tickets.map((t) => ({
                source: "ticket" as const,
                id: t.id,
                title: t.title,
                code: t.ticketNo,
                status: TICKET_STATUS_LABEL[t.status as TicketStatus] ?? t.status,
                context: t.category?.name ?? null,
                href: `/service/tickets/${t.id}`,
            })),
            ...articles.map((a) => ({
                source: "kb" as const,
                id: a.id,
                title: a.title,
                code: null,
                status: KB_STATUS_LABEL[a.status as KbStatus] ?? a.status,
                context: a.summary,
                href: `/service/kb/${a.slug}`,
            })),
            ...projects.map((p) => ({
                source: "project" as const,
                id: p.id,
                title: p.name,
                code: p.code,
                status: PROJECT_STATUS_LABEL[p.status as ProjectStatus] ?? p.status,
                context: null,
                href: `/management/projects/${p.id}`,
            })),
            ...assets.map((a) => ({
                source: "asset" as const,
                id: a.id,
                title: a.name,
                code: a.assetCode,
                status: ASSET_STATUS_LABEL[a.status as AssetStatus] ?? a.status,
                context: a.location,
                href: `/management/assets/${a.id}`,
            })),
        ]

        return NextResponse.json({
            query: q,
            hits,
            counts: {
                ticket: tickets.length,
                kb: articles.length,
                project: projects.length,
                asset: assets.length,
            },
        })
    } catch (error) {
        console.error("Global search GET Error:", error)
        return NextResponse.json({ error: "ค้นหาไม่สำเร็จ" }, { status: 500 })
    }
}
