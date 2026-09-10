// lib/google-directory.ts
// ค้นหาบุคลากรจาก Google Workspace Directory ของมหาวิทยาลัย (People API)
// ใช้กับช่อง "ผู้แจ้ง" ในโหมดบันทึกแทน (F1.10) — อ้างอิง docs/spec.md §19
//
// ใช้ access token ของ "เจ้าหน้าที่ที่ล็อกอินอยู่" ซึ่งกดเชื่อมต่อ Google พร้อม scope
// directory.readonly ไว้แล้ว (ขอเพิ่มผ่าน authClient.linkSocial) — ไม่ต้องใช้ service account
// หรือสิทธิ์ super admin · เรียก REST ด้วย fetch ตรงๆ เพื่อไม่ต้องเพิ่ม dependency (M11)

import { auth } from "@/lib/auth"
import { prisma } from "@/lib/prisma"
import { DIRECTORY_SCOPE, type DirectoryPerson, type DirectoryStatus } from "@/lib/ticket-types"

/// โดเมนของมหาวิทยาลัย — รับเฉพาะอีเมลโดเมนนี้ กันไม่ให้สร้างบัญชีจากอีเมลภายนอก (M13)
export const WORKSPACE_DOMAIN = (process.env.GOOGLE_WORKSPACE_DOMAIN || "krirk.ac.th").toLowerCase()

const SEARCH_URL = "https://people.googleapis.com/v1/people:searchDirectoryPeople"
const READ_MASK = "names,emailAddresses,photos,organizations,externalIds"
const PAGE_SIZE = 20

type TokenResult = { status: "ok"; token: string } | { status: Exclude<DirectoryStatus, "ok"> }

/// ดึง access token ของผู้ใช้ที่ใช้ค้น Directory ได้ — ต่ออายุให้เองถ้ามี refresh token
export async function getDirectoryToken(userId: string): Promise<TokenResult> {
    const account = await prisma.account.findFirst({
        where: { userId, providerId: "google" },
        select: { scope: true },
    })
    if (!account) return { status: "not_linked" }
    if (!hasDirectoryScope(account.scope)) return { status: "missing_scope" }

    try {
        const tokens = await auth.api.getAccessToken({ body: { providerId: "google", userId } })
        // getAccessToken คืน token เดิมกลับมาแม้หมดอายุแล้ว ถ้าไม่มี refresh token ให้ต่ออายุ
        const expiresAt = tokens.accessTokenExpiresAt ? new Date(tokens.accessTokenExpiresAt) : null
        if (!tokens.accessToken || (expiresAt && expiresAt.getTime() <= Date.now())) {
            return { status: "expired" }
        }
        return { status: "ok", token: tokens.accessToken }
    } catch (error) {
        console.error("google-directory: ต่ออายุ token ไม่สำเร็จ", error)
        return { status: "expired" }
    }
}

/// Better Auth เก็บ scope คั่นด้วย comma (บางกรณีเป็นช่องว่าง) จึงแยกทั้งสองแบบ
function hasDirectoryScope(scope: string | null): boolean {
    return (scope ?? "").split(/[,\s]+/).includes(DIRECTORY_SCOPE)
}

/// อีเมลอยู่ในโดเมนมหาวิทยาลัยหรือไม่
export function isWorkspaceEmail(email: string): boolean {
    return email.toLowerCase().endsWith(`@${WORKSPACE_DOMAIN}`)
}

type SearchResult =
    | { status: "ok"; people: DirectoryPerson[] }
    | { status: "expired" | "unavailable" }

/// ค้นบุคลากรด้วยชื่อหรืออีเมล — Google จับคู่แบบขึ้นต้นคำ (prefix)
export async function searchDirectory(token: string, query: string): Promise<SearchResult> {
    const url = new URL(SEARCH_URL)
    url.searchParams.set("query", query)
    url.searchParams.set("readMask", READ_MASK)
    url.searchParams.set("sources", "DIRECTORY_SOURCE_TYPE_DOMAIN_PROFILE")
    url.searchParams.set("pageSize", String(PAGE_SIZE))

    let res: Response
    try {
        res = await fetch(url, {
            headers: { Authorization: `Bearer ${token}` },
            cache: "no-store",
        })
    } catch (error) {
        console.error("google-directory: เชื่อมต่อ People API ไม่สำเร็จ", error)
        return { status: "unavailable" }
    }

    // 401 = token ถูกเพิกถอนหรือหมดอายุ ต้องให้เจ้าหน้าที่เชื่อมต่อใหม่
    if (res.status === 401) return { status: "expired" }
    if (!res.ok) {
        console.error("google-directory: People API ตอบ", res.status, await res.text())
        return { status: "unavailable" }
    }

    const data = (await res.json()) as { people?: GooglePerson[] }
    const people = (data.people ?? [])
        .map(toDirectoryPerson)
        .filter((p): p is DirectoryPerson => p !== null && isWorkspaceEmail(p.email))
    return { status: "ok", people }
}

/// โครงสร้าง Person ของ People API เฉพาะฟิลด์ที่ขอใน READ_MASK
interface GooglePerson {
    names?: { displayName?: string; metadata?: { primary?: boolean } }[]
    emailAddresses?: { value?: string; metadata?: { primary?: boolean } }[]
    photos?: { url?: string; default?: boolean }[]
    organizations?: { title?: string; department?: string; metadata?: { primary?: boolean } }[]
    externalIds?: { value?: string }[]
}

/// เลือกค่าที่ Google ติดธง primary ไว้ ถ้าไม่มีก็เอาตัวแรก
function primary<T extends { metadata?: { primary?: boolean } }>(items?: T[]): T | undefined {
    return items?.find((i) => i.metadata?.primary) ?? items?.[0]
}

function toDirectoryPerson(p: GooglePerson): DirectoryPerson | null {
    const email = primary(p.emailAddresses)?.value?.trim().toLowerCase()
    if (!email) return null
    const org = primary(p.organizations)
    // รูปตั้งต้น (ตัวอักษรย่อ) ไม่มีประโยชน์ ใช้ avatar ของระบบแทน
    const photo = p.photos?.find((ph) => !ph.default)?.url ?? null
    return {
        email,
        name: primary(p.names)?.displayName?.trim() || email,
        image: photo,
        position: org?.title?.trim() || null,
        department: org?.department?.trim() || null,
        employeeCode: p.externalIds?.[0]?.value?.trim() || null,
    }
}

type EnsureResult =
    | { ok: true; userId: string; created: boolean }
    | { ok: false; status: Exclude<DirectoryStatus, "ok"> | "not_found"; message: string }

const STATUS_MESSAGE: Record<Exclude<DirectoryStatus, "ok">, string> = {
    not_linked: "กรุณาเชื่อมต่อบัญชี Google ก่อนเลือกผู้แจ้งจากรายชื่อมหาวิทยาลัย",
    missing_scope: "กรุณาอนุญาตให้ระบบอ่านรายชื่อบุคลากรจาก Google ก่อน",
    expired: "การเชื่อมต่อ Google หมดอายุ กรุณาเชื่อมต่อใหม่",
    unavailable: "ไม่สามารถตรวจสอบรายชื่อกับ Google ได้ในขณะนี้",
}

/// หา User ของผู้แจ้งจากอีเมล — ถ้ายังไม่มีบัญชี ให้ยืนยันกับ Directory แล้วสร้างให้
///
/// ข้อมูลที่ใช้สร้างบัญชีมาจาก Google ที่ server ค้นซ้ำเองเท่านั้น
/// ไม่เชื่อชื่อ/อีเมลที่ client ส่งมา กันเจ้าหน้าที่สร้างบัญชีมั่วนอกรายชื่อมหาวิทยาลัย
export async function ensureRequesterFromDirectory(
    staffUserId: string,
    rawEmail: string
): Promise<EnsureResult> {
    const email = rawEmail.trim().toLowerCase()

    const existing = await findUserByEmail(email)
    if (existing) return { ok: true, userId: existing, created: false }

    if (!isWorkspaceEmail(email)) {
        return {
            ok: false,
            status: "not_found",
            message: `รับเฉพาะอีเมล @${WORKSPACE_DOMAIN} ที่อยู่ในรายชื่อมหาวิทยาลัย`,
        }
    }

    const token = await getDirectoryToken(staffUserId)
    if (token.status !== "ok") {
        return { ok: false, status: token.status, message: STATUS_MESSAGE[token.status] }
    }

    const found = await searchDirectory(token.token, email)
    if (found.status !== "ok") {
        return { ok: false, status: found.status, message: STATUS_MESSAGE[found.status] }
    }

    const person = found.people.find((p) => p.email === email)
    if (!person) {
        return { ok: false, status: "not_found", message: "ไม่พบอีเมลนี้ในรายชื่อบุคลากรของมหาวิทยาลัย" }
    }

    try {
        const user = await prisma.user.create({
            data: {
                name: person.name,
                email: person.email,
                // ยืนยันตัวตนผ่าน Directory ของมหาวิทยาลัยแล้ว — ล็อกอินด้วย Google ภายหลังจะผูกบัญชีให้เอง
                emailVerified: true,
                image: person.image,
                role: "user",
                position: person.position,
                employeeCode: person.employeeCode,
            },
            select: { id: true },
        })
        return { ok: true, userId: user.id, created: true }
    } catch (error) {
        // P2002 = มีเจ้าหน้าที่อีกคนสร้างบัญชีอีเมลเดียวกันตัดหน้าไปแล้ว — ใช้บัญชีนั้น
        if ((error as { code?: string }).code === "P2002") {
            const raced = await findUserByEmail(email)
            if (raced) return { ok: true, userId: raced, created: false }
        }
        throw error
    }
}

async function findUserByEmail(email: string): Promise<string | null> {
    const user = await prisma.user.findFirst({
        where: { email: { equals: email, mode: "insensitive" } },
        select: { id: true },
    })
    return user?.id ?? null
}
