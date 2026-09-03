# Phase 9 — บังคับใช้สิทธิ์ให้ครบทุกชั้น (RBAC Enforcement)

> **ขอบเขต:** ปิดช่องโหว่ 4 ข้อที่พบในผลตรวจสอบสิทธิ์ `docs/spec.md` §7.3
> **branch:** `feat/itsm-phase-9` · **ฐาน:** `main` (`841eeeb`) · **วันที่:** 3 กันยายน 2569
> **ไม่แตะ:** `schema.prisma` · ไม่เพิ่ม role ใหม่ · ไม่เพิ่ม dependency

เฟสนี้ไม่ได้เพิ่มฟีเจอร์ให้ผู้ใช้ แต่ทำให้ **โครงสิทธิ์ที่ออกแบบไว้ตั้งแต่ Phase 0 ถูกบังคับใช้จริง**
ผลตรวจหลัง Phase 8 พบว่า matrix §7.1 ออกแบบครบดีแล้ว แต่การบังคับใช้ขาดไป 4 เรื่อง —
หน้าจอไม่ถูกกันฝั่ง server, API บางเส้นไม่ตรวจสิทธิ์เลย, role `student`/`agent` ตั้งให้ใครไม่ได้
และค่าคงที่ role ถูกคัดลอกกระจายจนเพี้ยนกันเอง

---

## 1. สิ่งที่ทำ

### ① กันหน้าจอฝั่ง server ครบทั้ง 43 หน้า

| สิ่งที่ได้ | รายละเอียด |
|---|---|
| `lib/screen-access.ts` | ผังกลุ่มสิทธิ์ 9 กลุ่มตาม §7.2 เขียนเป็นโค้ด — `SCREEN_GROUPS` เรียงจากเส้นทางเจาะจงมากไปน้อย, `resolveScreenGroup()`, `isPublicPath()` · ไม่ import `next/` จึงใช้ได้ทั้ง edge runtime และฝั่ง server |
| `lib/screen-guard.ts` | `requireScreen(key)` เรียกจาก layout/page ที่เป็น Server Component — ยังไม่ login → `/auth/signin` · login แล้วแต่ role ไม่ถึง → `/dashboard` · คืน `AuthUser` กลับไปให้หน้าที่เรียกใช้ต่อโดยไม่ต้องดึง session ซ้ำ |
| `middleware.ts` (ไฟล์ใหม่) | ชั้นแรก — ตีกลับผู้ที่ยังไม่มี session cookie ตั้งแต่ขอบ ก่อนแตะ Server Component ใดๆ พร้อมพากลับหน้าเดิมด้วย `callbackUrl` |
| `management/layout.tsx` · `admin/layout.tsx` | ย้ายการตรวจ role มาไว้ที่ layout ของกลุ่ม แทนที่จะเขียนซ้ำในทุกหน้า |

เดิมมีเพียง **4 จาก 43 หน้า** ที่ตรวจ role ฝั่ง server ผู้ใช้ role `student` พิมพ์ URL ตรงเข้า
`/admin/sla`, `/management/*` ได้หน้าจอจริง (API ตอบ 403 ทีหลัง แต่โครงหน้าและรูปร่างข้อมูลหลุดไปแล้ว)

### ② ปิด API ที่ไม่ตรวจสิทธิ์เลย

| Route | เดิม | ตอนนี้ |
|---|---|---|
| `POST /api/search` | เปิดสาธารณะ — ยิงได้โดยไม่ต้อง login และได้เนื้อหาทั้ง chunk กลับไป | `requireAuth()` + ส่ง `includeAgentOnly: isStaff(user)` เข้า `searchDocuments()` เกณฑ์เดียวกับ `/api/chat` |
| `GET`/`POST /api/knowledge` · `GET`/`PUT`/`DELETE /api/knowledge/[id]` · `POST /api/knowledge/[id]/index` · `POST /api/knowledge/upload` | ตรวจแค่ว่ามี session | `admin` เท่านั้น ให้ตรงกับหน้า `/admin/knowledge` (§7.2 กลุ่ม 9) |
| `GET /api/leads` · `GET`/`PATCH /api/leads/[id]` | เปิดสาธารณะ | `manager` ขึ้นไป (§7.2 กลุ่ม 7) |
| `GET`/`POST /api/line/groups` · `PATCH`/`DELETE /api/line/groups/[id]` | เปิดสาธารณะ | `admin` |
| `GET`/`POST /api/users` · `GET`/`DELETE /api/users/[id]` | stub ค้างจากก่อน ITSM คืนข้อมูลปลอม John/Jane | **ลบทิ้งทั้งโฟลเดอร์** — ของจริงใช้ better-auth admin plugin |
| `POST /api/admin/change-role` | `session.user.role !== "admin"` (พังกับ multi-role) + `validRoles` ค้างที่ 3 ค่า | `requireRole([...ADMIN_ROLES])` + ตรวจกับ `ROLES` ครบ 5 ค่า |

**ที่เปิดสาธารณะไว้โดยตั้งใจ ห้ามเผลอปิด** — `POST /api/leads` และ `POST /api/contact`
(ฟอร์มบนหน้า landing) · `POST /api/line/webhook` ตรวจลายเซ็น HMAC ของตัวเองอยู่แล้ว

### ③ ทำให้ role `student` และ `agent` ตั้งให้ผู้ใช้ได้จริง

| ไฟล์ | เดิม | ตอนนี้ |
|---|---|---|
| `admin/users/UsersManagement.tsx` | `ALL_ROLES = ["user","manager","admin"]` · `RoleBadge` ไม่มีสี/ไอคอนของสองตัวนี้ | ดึง `ROLES` จาก `lib/roles.ts` · เพิ่มสี+ไอคอนของ `agent` (`Wrench`) และ `student` (`GraduationCap`) · แสดงชื่อไทยจาก `ROLE_LABELS` กำกับทุกตัวเลือก |
| `api/admin/change-role/route.ts` | `validRoles` 3 ค่า | ตรวจกับ `ROLES` ทั้ง 5 · รองรับหลาย role คั่นจุลภาค · เก็บลง DB โดยเรียงตามลำดับใน `ROLES` และตัดค่าซ้ำ |
| `lib/auth-client.ts` | `adminClient({ roles: { admin, manager, user } })` | ลงทะเบียนครบ 5 ตัวให้ตรงกับ `lib/auth.ts` ฝั่ง server |
| `admin/settings/SettingContent.tsx` | รายการแสดงผล 3 role พร้อมคำอธิบายจากยุคก่อน ITSM | 5 role พร้อมคำอธิบายสิทธิ์ตามจริงใน §7.1 |

### ④ รวมค่าคงที่ role ไว้ที่เดียว

`lib/roles.ts` (ไฟล์ใหม่) เป็น **แหล่งความจริงเดียว** — `ROLES`, `ROLE_RANK`, `ROLE_LABELS`,
`STAFF_ROLES` / `MANAGER_ROLES` / `ADMIN_ROLES` ที่สร้างจาก `rolesAtLeast()`, `parseRoles()`
และตัวเทียบสิทธิ์ทั้งสองรูปแบบ (`isStaff()` รับ `AuthUser` ฝั่ง server · `rolesAreStaff()` รับ
`string[]` ฝั่ง client)

จุดที่เลิกคัดลอก array กันเอง:

| ชั้น | จำนวน | เปลี่ยนเป็น |
|---|---|---|
| `requireRole()` ใน API route | **61 จุด / 41 ไฟล์** | `[...STAFF_ROLES]` (34) · `[...MANAGER_ROLES]` (13) · `[...ADMIN_ROLES]` (14) |
| คอมโพเนนต์ฝั่ง client | 15 จุด | `rolesAreStaff()` / `rolesAreManager()` |
| `sidebar-data.ts` | `STAFF`/`MANAGER`/`ADMIN` ประกาศเอง | อ้าง `lib/roles.ts` |
| `lib/project-service.ts` | `SDLC_ROLES = ["agent","manager","admin"]` | `SDLC_ROLES = STAFF_ROLES` |

`lib/rbac.ts` re-export ทุกตัวจาก `lib/roles.ts` — API route เดิมราว 70 เส้นจึงไม่ต้องแก้ import

---

## 2. การตัดสินใจเชิงออกแบบ

### 2.1 ทำไมต้องแยก `lib/roles.ts` ออกจาก `lib/rbac.ts`

`lib/rbac.ts` import `next/server` และ `next/headers` ที่ระดับ module — client component จึง
import ไม่ได้เลย นี่คือ **สาเหตุที่แท้จริง** ที่ฝั่ง client ต้องคัดลอก `["agent","manager","admin"]`
ไปเขียนเองทีละจุดแล้วเพี้ยนจาก matrix ทีละนิด การย้ายนิยาม role ล้วนๆ ไปไว้ในไฟล์ที่ไม่พึ่ง `next/`
ทำให้ทั้งสองฝั่งอ้างของชิ้นเดียวกันได้ และเป็นเงื่อนไขที่ต้องทำก่อนงานข้อ ④ ทั้งหมด

### 2.2 กลุ่มสิทธิ์สร้างจาก `ROLE_RANK` ไม่ใช่เขียน array ตายตัว

`STAFF_ROLES = rolesAtLeast("agent")` — เพิ่ม role ใหม่ในอนาคตแล้วกลุ่มเหล่านี้ขยับตามเอง
ถ้าเขียนเป็น array ตายตัวจะต้องไล่แก้ทุกกลุ่มและมีโอกาสลืม เหมือนที่เพิ่งเจอมาแล้ว

### 2.3 middleware ตรวจแค่ "login หรือยัง" ไม่ตรวจ role

middleware ทำงานบน edge runtime เข้าถึงฐานข้อมูลไม่ได้ และ cookie ของ better-auth เก็บแค่
session token ไม่ได้เก็บ role — จึงตรวจ role ที่นั่นไม่ได้จริง ยิ่งกว่านั้น `getSessionCookie()`
ตรวจแค่การมีอยู่ของ cookie ไม่ได้ยืนยันว่า session ยังไม่หมดอายุ (better-auth ระบุเองว่าเป็นการ
เช็คแบบ optimistic)

จึงแบ่งหน้าที่เป็นสองชั้น — middleware กรองชั้นแรกที่ขอบ, `requireScreen()` ใน layout/page ตรวจ
role จริงจาก session ในฐานข้อมูล **ห้ามถอดชั้นหลังออกโดยพึ่ง middleware อย่างเดียว**

### 2.4 กันที่ layout ของกลุ่ม ไม่ใช่ทีละหน้า

`/management/*` ทั้งกลุ่มใช้ `requireScreen("OPERATIONS")` ที่ `management/layout.tsx` ครั้งเดียว
ส่วนหน้าที่เกณฑ์ต่างจากกลุ่ม (`/management/lead` = `CRM` ระดับ `manager`) จึงกันเพิ่มในหน้านั้นเอง
ข้อดีคือหน้าใหม่ที่เพิ่มเข้ากลุ่มได้รับการกันโดยอัตโนมัติ ไม่ต้องจำว่าต้องใส่ guard

### 2.5 `POST /api/search` ใช้เกณฑ์เดียวกับ `/api/chat` ไม่ใช่ปิดทั้งเส้น

เส้นนี้ค้นเชิงความหมายทับคลัง RAG โดยตรง (คนละเส้นกับ `/api/search/global` ที่หน้าค้นหารวมใช้)
ทางเลือกที่ง่ายกว่าคือปิดให้เหลือ `admin` แต่จะทำให้ผู้ใช้ทั่วไปค้น KB สาธารณะไม่ได้ จึงเลือก
`requireAuth()` แล้วส่ง `includeAgentOnly: isStaff(user)` ต่อให้ `searchDocuments()` ซึ่งมีค่าตั้งต้น
เป็น "กรอง" อยู่แล้ว — ผู้เรียกที่ลืมส่ง option จะได้พฤติกรรมที่ปลอดภัยเสมอ

### 2.6 `change-role` เก็บค่าลง DB แบบ normalize

รับหลาย role คั่นจุลภาคได้ตามรูปแบบที่คอลัมน์ `user.role` ใช้จริง แต่ก่อนบันทึกจะเรียงตามลำดับ
ใน `ROLES` และตัดค่าซ้ำทิ้ง — ค่าที่เก็บจึงมีรูปแบบเดียวเสมอ (`"agent,admin"` ไม่ใช่ `"admin,agent"`)
ทำให้เทียบและอ่านง่ายเวลาไล่ปัญหา · ค่าที่สะกดผิดถูกตีกลับเป็น 400 แทนที่จะถูก `parseRoles()`
ตัดทิ้งเงียบๆ แล้วผู้ดูแลเข้าใจผิดว่าตั้งสำเร็จ

### 2.7 `lib/permissions.ts` ยังไม่ใช่ตัวบังคับใช้ — และเฟสนี้ไม่เปลี่ยนเรื่องนั้น

ไฟล์นั้นผูก `ac.newRole()` ครบทั้ง 5 role แต่ไม่มีโค้ดในแอปเรียก `hasPermission()` เลย บทบาทจริง
ของมันคือ (ก) เอกสารสิทธิ์ที่อ่านเป็นโค้ดได้ และ (ข) สิทธิ์ที่ better-auth admin plugin ใช้กับ
endpoint ของตัวเอง เฟสนี้จึงแตะเฉพาะ `lib/auth-client.ts` ให้ลงทะเบียน role ครบ ไม่ได้เปลี่ยน
กลไกบังคับใช้ซึ่งยังเป็น `requireRole()` ทั้งหมด

---

## 3. ไฟล์ที่เพิ่ม/แก้

### ไฟล์ใหม่ (4 ไฟล์)

| ไฟล์ | หน้าที่ |
|---|---|
| `lib/roles.ts` | แหล่งความจริงเดียวของ role — ไม่พึ่ง `next/` ใช้ได้ทั้งสองฝั่ง |
| `lib/screen-access.ts` | ผังกลุ่มสิทธิ์ 9 กลุ่มตาม §7.2 |
| `lib/screen-guard.ts` | `requireScreen()` สำหรับ Server Component |
| `middleware.ts` | กันชั้นแรกที่ขอบ |

### ไฟล์ที่ลบ (2 ไฟล์)

`app/api/users/route.ts` · `app/api/users/[id]/route.ts` — stub คืนข้อมูลปลอม ไม่มีผู้เรียก

### ไฟล์เดิมที่แก้

- **กันหน้าจอ (10):** `admin/layout.tsx` · `management/layout.tsx` · `admin/{users,settings,line-groups}/page.tsx` · `management/lead/page.tsx` · `service/{my-work,tickets/queue}/page.tsx` · `auth/signin/{page.tsx,LoginForm.tsx}` (รับ `callbackUrl`)
- **ปิด API (11):** `api/search` · `api/knowledge/{route,[id],[id]/index,upload}` · `api/leads/{route,[id]}` · `api/line/groups/{route,[id]}` · `api/admin/change-role`
- **role ครบ 5 (4):** `admin/users/UsersManagement.tsx` · `admin/settings/SettingContent.tsx` · `lib/auth-client.ts` · `api/admin/change-role/route.ts`
- **รวมค่าคงที่:** `lib/rbac.ts` · `lib/project-service.ts` · `sidebar-data.ts` · คอมโพเนนต์ฝั่ง client 14 ไฟล์ · API route 41 ไฟล์

---

## 4. ผลการตรวจ (Definition of Done §16.4)

| เกต | ผล |
|---|---|
| G1 ไฟล์ที่จะ commit | ผ่าน — ไม่มีไฟล์แปลกปลอม |
| G2/G3 Prisma | ไม่เกี่ยว — ไม่แตะ `schema.prisma` |
| G4 `npx tsc --noEmit` | **0 error** |
| G5 lint ไฟล์ที่แตะ | 0 error (เหลือ warning เดิม 4 รายการที่ไม่ได้เกิดจากเฟสนี้) |
| G6 `pnpm build` | ผ่าน (exit 0) — middleware ขึ้นในผลลัพธ์ build เป็น `ƒ Proxy (Middleware)` |
| G7 ขอบเขต | ผ่าน — ไฟล์ทั้งหมดอยู่ในกลุ่มที่ §4 อนุญาต |

**หมายเหตุ G5** — `catch (error: any)` ในไฟล์ `api/leads`, `api/line/groups`, `api/knowledge`
เป็น lint error ที่ค้างมาจากก่อน ITSM แต่เมื่อเฟสนี้แก้ไฟล์เหล่านั้นแล้ว จึงพ้นจากกลุ่ม "ไม่แตะเลย"
ตาม §16.5 ข้อ 5 และต้องแก้ให้ผ่าน G5 — เปลี่ยนเป็น `catch (error)` พร้อมแคบชนิดตอนใช้งาน
(`(error as { code?: string }).code === "P2025"`) ส่วน `any` ในไฟล์ที่ไม่ได้แตะ
(`ChatWindow.tsx`, `LeadForm.tsx`, `FileUpload.tsx`) ยังคงไว้ตามกฎเดิม

**ตรวจเพิ่ม** — ไล่ทุก `route.ts` ใต้ `app/api` ว่ามีการตรวจสิทธิ์อย่างน้อยหนึ่งรูปแบบ
(`requireAuth` / `requireRole` / `requireMinRole` / `getAuthUser` / ตรวจลายเซ็น / handler ของ
better-auth) เหลือเส้นเดียวที่ไม่มี คือ `POST /api/contact` ซึ่งเปิดสาธารณะโดยตั้งใจ

---

## 5. ของค้าง

| เรื่อง | สถานะ |
|---|---|
| ทดสอบผ่านหน้าจอจริงด้วยบัญชีทั้ง 5 role | **ยังไม่ได้ทำ** — ต้องตั้ง role ให้บัญชีทดสอบผ่านหน้า `/admin/users` แล้วไล่เปิดหน้าจอตาม §7.2 ทีละกลุ่ม |
| `lib/permissions.ts` ยังไม่ถูกใช้บังคับสิทธิ์ | คงไว้ตามเดิม — ถ้าจะย้ายไปใช้ `hasPermission()` จริงต้องเปิดเป็นงานแยก |
| `POST /api/admin/change-role` ซ้ำซ้อนกับ better-auth `setRole` | หน้า `/admin/users` ใช้ admin plugin เป็นหลัก เส้นนี้เหลือไว้เผื่อเรียกจากสคริปต์ — ถ้ายืนยันว่าไม่มีผู้เรียกแล้วควรลบทิ้ง |
| warning `'lead' is assigned a value but never used` ใน `api/leads/route.ts` | เป็น warning ไม่ใช่ error — ไม่แก้ในเฟสนี้เพื่อไม่ให้ diff บวมเกินขอบเขต |
