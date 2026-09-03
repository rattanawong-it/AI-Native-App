// middleware.ts
// ชั้นแรกของการกันหน้าจอ — ตีกลับผู้ที่ยังไม่ login ตั้งแต่ขอบ ก่อนเข้าถึง Server Component ใดๆ
// อ้างอิงผังกลุ่มสิทธิ์ใน docs/spec.md §7.2 ผ่าน lib/screen-access.ts
//
// ── ทำไมที่นี่ไม่ตรวจ role ──────────────────────────────────────────────
// middleware ทำงานบน edge runtime และเข้าถึงฐานข้อมูลไม่ได้ ส่วน cookie ของ better-auth
// เก็บแค่ session token ไม่ได้เก็บ role จึงตรวจได้เพียงว่า "มี session token หรือไม่"
// การตรวจ role จริงอยู่ที่ requireScreen() ใน lib/screen-guard.ts ซึ่งเรียกจาก layout/page
//
// getSessionCookie ตรวจแค่การมีอยู่ของ cookie ไม่ได้ยืนยันว่า session ยังไม่หมดอายุ
// (better-auth เองก็ระบุไว้ว่าเป็นการเช็คแบบ optimistic) จึงเป็นการกรองชั้นแรกเท่านั้น
// ไม่ใช่ตัวควบคุมการเข้าถึง — ห้ามถอดการตรวจฝั่ง layout/page ออกโดยพึ่งไฟล์นี้อย่างเดียว

import { NextResponse, type NextRequest } from "next/server"
import { getSessionCookie } from "better-auth/cookies"
import { isPublicPath } from "@/lib/screen-access"

export function middleware(request: NextRequest) {
    const { pathname, search } = request.nextUrl

    if (isPublicPath(pathname)) return NextResponse.next()

    if (!getSessionCookie(request)) {
        const signin = new URL("/auth/signin", request.url)
        // พากลับมาที่หน้าเดิมหลัง login สำเร็จ (คงพารามิเตอร์ของหน้าเดิมไว้ด้วย)
        signin.searchParams.set("callbackUrl", pathname + search)
        return NextResponse.redirect(signin)
    }

    return NextResponse.next()
}

export const config = {
    // ข้าม API route (แต่ละเส้นตรวจสิทธิ์เองผ่าน lib/rbac.ts ตาม NFR1) และไฟล์ static
    matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|webp|ico)$).*)"],
}
