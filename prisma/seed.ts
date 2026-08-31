// Seed script: สร้าง Admin เริ่มต้น + Master Data ของระบบ ITSM
// ใช้: pnpx tsx --env-file=.env prisma/seed.ts
//
// ทุกขั้นตอนเป็น upsert — รันซ้ำได้โดยไม่สร้างข้อมูลซ้ำและไม่ทับค่าที่ admin แก้ไว้เอง

import { PrismaPg } from "@prisma/adapter-pg"
import { PrismaClient } from "../app/generated/prisma/client"

const connectionString = process.env.DATABASE_URL!

type Prisma = PrismaClient

// ==========================================
// 1) Admin เริ่มต้น (ของเดิม)
// ==========================================
async function seedAdmin(prisma: Prisma) {
    const adminEmail = process.env.ADMIN_EMAIL || "rattana.wong@krirk.ac.th"

    console.log(`\n🔍 Looking for user with email: ${adminEmail}`)

    const existingUser = await prisma.user.findUnique({
        where: { email: adminEmail },
    })

    if (existingUser) {
        if (existingUser.role === "admin") {
            console.log(`✅ User "${existingUser.name}" is already an admin.`)
        } else {
            const updated = await prisma.user.update({
                where: { email: adminEmail },
                data: { role: "admin" },
            })
            console.log(`✅ Updated "${updated.name}" (${updated.email}) role to "admin"`)
        }
    } else {
        console.log(`⚠️  No user found with email: ${adminEmail}`)
        console.log(``)
        console.log(`   Please do one of the following:`)
        console.log(`   1. Sign up at http://localhost:3000/auth/signup with this email`)
        console.log(`   2. Or set ADMIN_EMAIL in .env to an existing user's email`)
        console.log(`   Then run this seed script again: npx tsx prisma/seed.ts`)
    }
}

// ==========================================
// 2) หน่วยงาน (Department)
// ==========================================
// หมายเหตุ: รายชื่อหน่วยงานจริงยังไม่ได้รับ (spec §14 ข้อ 3)
// จึง seed เฉพาะหน่วยงานเจ้าของระบบ ที่เหลือให้ admin เพิ่มเองในหน้าจัดการผู้ใช้
const DEPARTMENTS = [
    { code: "OIT", name: "ศูนย์ไอที — ฝ่ายพัฒนาระบบสารสนเทศและเว็บไซต์" },
]

async function seedDepartments(prisma: Prisma) {
    for (const d of DEPARTMENTS) {
        await prisma.department.upsert({
            where: { code: d.code },
            update: {},
            create: d,
        })
    }
    console.log(`✅ Departments: ${DEPARTMENTS.length} รายการ`)
}

// ==========================================
// 3) ทีมงานของศูนย์ (Team)
// ==========================================
// หมายเหตุ: จำนวนเจ้าหน้าที่จริงยังไม่ได้รับ (spec §14 ข้อ 6)
// seed เป็นโครงทีมตามลักษณะงาน 3 ทีม ให้ admin ใส่สมาชิกเองภายหลัง
const TEAMS = [
    { name: "ทีมพัฒนาระบบสารสนเทศ", description: "ดูแลเว็บไซต์ ระบบสารสนเทศ และงานพัฒนาซอฟต์แวร์" },
    { name: "ทีมเครือข่ายและบัญชีผู้ใช้", description: "ดูแลเครือข่าย อินเทอร์เน็ต VPN และบัญชีผู้ใช้" },
    { name: "ทีมธุรการศูนย์", description: "ดูแลครุภัณฑ์ คำขออนุมัติ และงานธุรการของศูนย์" },
]

async function seedTeams(prisma: Prisma) {
    const result: Record<string, string> = {}
    for (const t of TEAMS) {
        const existing = await prisma.team.findFirst({ where: { name: t.name } })
        const team = existing
            ? existing
            : await prisma.team.create({ data: t })
        result[t.name] = team.id
    }
    console.log(`✅ Teams: ${TEAMS.length} ทีม`)
    return result
}

// ==========================================
// 4) Service Catalog (spec §3 ข้อ 3 — 3 หมวดหลัก ไม่รวมงานซ่อมฮาร์ดแวร์)
// ==========================================
interface CatalogSeed {
    slug: string
    name: string
    description: string
    team: string
    children: { slug: string; name: string }[]
}

const CATALOG: CatalogSeed[] = [
    {
        slug: "web-and-mis",
        name: "เว็บไซต์ & ระบบสารสนเทศ",
        description: "ปัญหาและคำขอเกี่ยวกับเว็บไซต์ ระบบสารสนเทศ และงานพัฒนาซอฟต์แวร์",
        team: "ทีมพัฒนาระบบสารสนเทศ",
        children: [
            { slug: "website", name: "เว็บไซต์มหาวิทยาลัย / คณะ" },
            { slug: "mis", name: "ระบบสารสนเทศภายใน" },
            { slug: "elearning", name: "ระบบ e-Learning" },
            { slug: "system-request", name: "ขอพัฒนา / ปรับปรุงระบบ" },
            { slug: "system-bug", name: "แจ้งข้อผิดพลาดของระบบ" },
        ],
    },
    {
        slug: "network-and-account",
        name: "เครือข่าย & บัญชีผู้ใช้",
        description: "ปัญหาการเชื่อมต่อเครือข่าย บัญชีผู้ใช้ และสิทธิ์การเข้าถึงระบบ",
        team: "ทีมเครือข่ายและบัญชีผู้ใช้",
        children: [
            { slug: "network-wifi", name: "อินเทอร์เน็ต / WiFi" },
            { slug: "network-vpn", name: "VPN" },
            { slug: "account-password", name: "บัญชีผู้ใช้ & รหัสผ่าน" },
            { slug: "account-permission", name: "สิทธิ์การเข้าถึงระบบ" },
            { slug: "email", name: "อีเมลองค์กร" },
        ],
    },
    {
        slug: "office-admin",
        name: "งานธุรการศูนย์",
        description: "คำขอเบิกวัสดุ จัดซื้อ ขอข้อมูล และงานธุรการอื่นของศูนย์ไอที",
        team: "ทีมธุรการศูนย์",
        children: [
            { slug: "supply-request", name: "เบิกวัสดุ / อุปกรณ์" },
            { slug: "purchase-request", name: "คำขอจัดซื้อ" },
            { slug: "data-request", name: "ขอข้อมูล / รายงาน" },
            { slug: "other", name: "อื่นๆ" },
        ],
    },
]

async function seedCatalog(prisma: Prisma, teamIds: Record<string, string>) {
    let count = 0
    for (const [i, parent] of CATALOG.entries()) {
        const created = await prisma.serviceCategory.upsert({
            where: { slug: parent.slug },
            update: {},
            create: {
                slug: parent.slug,
                name: parent.name,
                description: parent.description,
                defaultTeamId: teamIds[parent.team],
                sortOrder: i + 1,
            },
        })
        count++

        for (const [j, child] of parent.children.entries()) {
            await prisma.serviceCategory.upsert({
                where: { slug: child.slug },
                update: {},
                create: {
                    slug: child.slug,
                    name: child.name,
                    parentId: created.id,
                    defaultTeamId: teamIds[parent.team],
                    sortOrder: j + 1,
                },
            })
            count++
        }
    }
    console.log(`✅ Service Catalog: ${count} หมวด (3 หมวดหลัก + หมวดย่อย)`)
}

// ==========================================
// 5) SLA Policy (spec §5.2 — หน่วยเป็น "นาทีทำการ")
// ==========================================
// 1 วันทำการ = 8 ชม. = 480 นาที (จ.–ศ. 08:30–16:30)
const SLA_POLICIES = [
    { priority: "critical", name: "SLA — Critical", responseMinutes: 30, resolutionMinutes: 240 },   // 4 ชม.ทำการ
    { priority: "high", name: "SLA — High", responseMinutes: 60, resolutionMinutes: 480 },           // 1 วันทำการ
    { priority: "medium", name: "SLA — Medium", responseMinutes: 240, resolutionMinutes: 1440 },     // 3 วันทำการ
    { priority: "low", name: "SLA — Low", responseMinutes: 480, resolutionMinutes: 3360 },           // 7 วันทำการ
]

async function seedSlaPolicies(prisma: Prisma) {
    // ใช้ findFirst แทน upsert เพราะ categoryId เป็น null — Postgres ถือว่า NULL แต่ละแถวต่างกัน
    // จึงพึ่ง unique constraint ไม่ได้
    for (const p of SLA_POLICIES) {
        const existing = await prisma.slaPolicy.findFirst({
            where: { priority: p.priority, categoryId: null },
        })
        if (!existing) await prisma.slaPolicy.create({ data: p })
    }
    console.log(`✅ SLA Policy: ${SLA_POLICIES.length} ระดับ`)
}

// ==========================================
// 6) เวลาทำการ (BusinessHour) — จ.–ศ. 08:30–16:30
// ==========================================
async function seedBusinessHours(prisma: Prisma) {
    const start = process.env.DEFAULT_WORK_START || "08:30"
    const end = process.env.DEFAULT_WORK_END || "16:30"

    for (let dayOfWeek = 0; dayOfWeek <= 6; dayOfWeek++) {
        const isWorkingDay = dayOfWeek >= 1 && dayOfWeek <= 5
        await prisma.businessHour.upsert({
            where: { dayOfWeek },
            update: {},
            create: { dayOfWeek, startTime: start, endTime: end, isWorkingDay },
        })
    }
    console.log(`✅ Business Hours: จ.–ศ. ${start}–${end}`)
}

// ==========================================
// 7) วันหยุด (Holiday)
// ==========================================
// วันหยุดวันที่ตายตัว — ตั้ง isRecurring = true ใช้ซ้ำได้ทุกปี
const FIXED_HOLIDAYS: [string, string][] = [
    ["01-01", "วันขึ้นปีใหม่"],
    ["04-06", "วันจักรี"],
    ["04-13", "วันสงกรานต์"],
    ["04-14", "วันสงกรานต์"],
    ["04-15", "วันสงกรานต์"],
    ["05-01", "วันแรงงานแห่งชาติ"],
    ["05-04", "วันฉัตรมงคล"],
    ["06-03", "วันเฉลิมพระชนมพรรษา สมเด็จพระนางเจ้าฯ พระบรมราชินี"],
    ["07-28", "วันเฉลิมพระชนมพรรษา พระบาทสมเด็จพระเจ้าอยู่หัว"],
    ["08-12", "วันแม่แห่งชาติ"],
    ["10-13", "วันนวมินทรมหาราช"],
    ["10-23", "วันปิยมหาราช"],
    ["12-05", "วันพ่อแห่งชาติ / วันชาติ"],
    ["12-10", "วันรัฐธรรมนูญ"],
    ["12-31", "วันสิ้นปี"],
]

// ⚠️ วันหยุดทางจันทรคติเปลี่ยนทุกปี — ค่าด้านล่างเป็นของปี พ.ศ. 2569 (ค.ศ. 2026)
//    ต้องตรวจสอบกับประกาศสำนักนายกรัฐมนตรีและปรับในหน้า admin/calendar ทุกปี
const LUNAR_HOLIDAYS_2026: [string, string][] = [
    ["2026-03-03", "วันมาฆบูชา"],
    ["2026-06-01", "วันวิสาขบูชา (ชดเชย)"],
    ["2026-07-29", "วันอาสาฬหบูชา"],
    ["2026-07-30", "วันเข้าพรรษา"],
]

/// สร้าง Date ที่เป็นเที่ยงคืน UTC เพื่อให้ตรงกับคอลัมน์ @db.Date
function utcDate(iso: string): Date {
    return new Date(`${iso}T00:00:00.000Z`)
}

async function seedHolidays(prisma: Prisma) {
    const anchorYear = 2026 // ปีอ้างอิงของวันหยุดแบบเกิดซ้ำ

    for (const [mmdd, name] of FIXED_HOLIDAYS) {
        const date = utcDate(`${anchorYear}-${mmdd}`)
        await prisma.holiday.upsert({
            where: { date },
            update: {},
            create: { date, name, isRecurring: true },
        })
    }

    for (const [iso, name] of LUNAR_HOLIDAYS_2026) {
        const date = utcDate(iso)
        await prisma.holiday.upsert({
            where: { date },
            update: {},
            create: { date, name, isRecurring: false },
        })
    }

    console.log(
        `✅ Holidays: ${FIXED_HOLIDAYS.length} วันตายตัว (เกิดซ้ำทุกปี) + ${LUNAR_HOLIDAYS_2026.length} วันทางจันทรคติ (พ.ศ. 2569)`
    )
}

// ==========================================
// 8) ค่าตั้งค่าระบบ (AppSetting)
// ==========================================
const APP_SETTINGS: { key: string; value: unknown; description: string }[] = [
    { key: "ticket.auto_assign", value: true, description: "มอบหมายเจ้าหน้าที่อัตโนมัติตามหมวดหมู่บริการ" },
    { key: "ticket.require_worklog_on_resolve", value: true, description: "บังคับบันทึก Time Log ก่อนเปลี่ยนสถานะเป็น resolved" },
    { key: "ticket.allow_student_create", value: true, description: "อนุญาตให้นักศึกษาแจ้งปัญหาผ่านเว็บ" },
    { key: "notification.channels", value: ["inapp", "email", "line"], description: "ช่องทางแจ้งเตือนที่เปิดใช้งานทั้งระบบ" },
    { key: "sla.at_risk_threshold", value: 0.75, description: "สัดส่วนเวลาที่ใช้ไปแล้วซึ่งถือว่าเสี่ยงเกิน SLA" },
    { key: "upload.allowed_types", value: ["jpg", "jpeg", "png", "pdf", "docx", "xlsx", "zip"], description: "ชนิดไฟล์แนบที่อนุญาต (NFR10)" },
]

async function seedAppSettings(prisma: Prisma) {
    for (const s of APP_SETTINGS) {
        await prisma.appSetting.upsert({
            where: { key: s.key },
            update: {},
            create: { key: s.key, value: s.value as never, description: s.description },
        })
    }
    console.log(`✅ App Settings: ${APP_SETTINGS.length} รายการ`)
}

// ==========================================
// Main
// ==========================================
async function main() {
    const adapter = new PrismaPg({ connectionString })
    const prisma = new PrismaClient({ adapter })

    await seedAdmin(prisma)

    console.log(`\n📦 Seeding ITSM master data...`)
    await seedDepartments(prisma)
    const teamIds = await seedTeams(prisma)
    await seedCatalog(prisma, teamIds)
    await seedSlaPolicies(prisma)
    await seedBusinessHours(prisma)
    await seedHolidays(prisma)
    await seedAppSettings(prisma)

    console.log(`\n🎉 Seed เสร็จสมบูรณ์\n`)
    await prisma.$disconnect()
}

main().catch((e) => {
    console.error("❌ Seed failed:", e)
    process.exit(1)
})
