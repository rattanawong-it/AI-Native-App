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

> **หมายเหตุ follow-up (3 ก.ย. 2569):** route `POST /api/admin/change-role` ถูกลบทิ้งแล้ว
> เพราะไม่มีผู้เรียก — ดู §6 ข้อ 3 · หัวข้อนี้คงไว้เป็นบันทึกเหตุผลตอนที่ยังมี route อยู่


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

### ไฟล์ที่ลบ (2 ไฟล์ ในเฟส · +1 ใน follow-up)

`app/api/users/route.ts` · `app/api/users/[id]/route.ts` — stub คืนข้อมูลปลอม ไม่มีผู้เรียก

follow-up: `app/api/admin/change-role/route.ts` — ไม่มีผู้เรียก (ดู §6 ข้อ 3)

### ไฟล์เดิมที่แก้

- **กันหน้าจอ (10):** `admin/layout.tsx` · `management/layout.tsx` · `admin/{users,settings,line-groups}/page.tsx` · `management/lead/page.tsx` · `service/{my-work,tickets/queue}/page.tsx` · `auth/signin/{page.tsx,LoginForm.tsx}` (รับ `callbackUrl`)
- **ปิด API (11):** `api/search` · `api/knowledge/{route,[id],[id]/index,upload}` · `api/leads/{route,[id]}` · `api/line/groups/{route,[id]}` · ~~`api/admin/change-role`~~ (ลบทิ้งใน follow-up)
- **role ครบ 5 (4):** `admin/users/UsersManagement.tsx` · `admin/settings/SettingContent.tsx` · `lib/auth-client.ts` · ~~`api/admin/change-role/route.ts`~~ (ลบทิ้งใน follow-up)
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

## 4.1 ผลทดสอบจริง (3 กันยายน 2569)

ทดสอบกับ dev server ที่ต่อฐานข้อมูล Neon จริง

### ก. ยังไม่ login — ผ่าน

| สิ่งที่ทดสอบ | ผล |
|---|---|
| `/dashboard`, `/admin/users` | 307 → `/auth/signin?callbackUrl=%2Fdashboard` และ `...%2Fadmin%2Fusers` — middleware ทำงานและพากลับหน้าเดิมได้ |
| `/` (หน้า landing) | 200 — เส้นทางสาธารณะไม่ถูกดัก |
| 16 endpoint ที่เพิ่งปิด (`/api/search`, `/api/knowledge` ทั้ง 4 เส้น × ทุก method, `/api/leads` GET/PATCH, `/api/line/groups` ทั้ง 4 method, `/api/admin/change-role`) | **401 ทุกเส้น** |
| `/api/users`, `/api/users/1` | **404** — stub ถูกลบจริง |
| `POST /api/contact`, `POST /api/leads` | 400 (validation) ไม่ใช่ 401 — ยังเปิดสาธารณะตามที่ตั้งใจ |
| `POST /api/line/webhook` | 401 จากการตรวจ HMAC ของตัวเอง (`route.ts:246`) ไม่ใช่จาก `requireRole` |

### ข. login เป็น `admin` ผ่านเบราว์เซอร์ — ผ่าน

ไล่เปิด **29 เส้นทาง** ที่ admin ต้องเข้าได้ ทุกเส้นได้ 200 ที่ path ของตัวเอง ไม่มีเส้นไหน
ถูก redirect — ยืนยันว่าการกันหน้าจอที่เพิ่มเข้าไปไม่ได้ล็อกคนที่ควรเข้าได้ออกจากระบบ

หน้า `/admin/users` เปิดกล่อง "เปลี่ยน Role" แล้วเห็นครบ **ทั้ง 5 role พร้อมป้ายสี ไอคอน และ
ชื่อไทย** เรียงตามลำดับสิทธิ์ (student → user → agent → manager → admin) และ role ปัจจุบัน
ถูกติ๊กไว้ถูกต้อง — ปิดข้อ ③ ได้จริง **(กดยกเลิก ไม่ได้บันทึกการเปลี่ยนแปลงใดๆ)**

### ค. ผังสิทธิ์ 43 เส้นทาง × 5 role — ผ่าน 0 fail

เรียก `resolveScreenGroup()` และ `isAtLeast()` ตรงๆ แล้วเทียบกับตาราง §7.2 ทีละช่อง

- `minRole` ของทั้ง 9 กลุ่มตรงกับ spec ทุกกลุ่ม
- 43 เส้นทาง resolve เข้ากลุ่มถูกต้องทุกเส้น รวมถึงเคสที่ prefix ซ้อนกัน
  (`/management/lead` → `CRM` ไม่ใช่ `OPERATIONS`)
- multi-role ได้สิทธิ์สูงสุดตามที่ควร (`"student,manager"` → เข้ากลุ่ม agent ได้)

### ง. การผูก guard เข้ากับหน้าจริง — ผ่าน

ไล่ `page.tsx` ทั้ง 36 ไฟล์ใต้ `app/(main)` ว่าถูกกันด้วยอะไร — ครบทุกไฟล์ ไม่มีหน้าไหนหลุด

### จ. ที่ยังทดสอบไม่ได้ตอนปิดเฟส — **ทดสอบครบแล้วใน follow-up**

ตอนปิดเฟส (3 ก.ย.) ฐานข้อมูลจริงไม่มีบัญชี `agent`/`student` และ non-admin ล็อกอินด้วย Google
OAuth จึงยังไม่ได้ทดสอบ "login เป็น role อื่นแล้วถูกตีกลับจริง" ผ่านเบราว์เซอร์

**4 ก.ย. 2569:** ทดสอบครบทั้ง 4 role (`manager` / `agent` / `user` / `student`) ผ่าน Impersonate
แล้ว — ดู §6 ข้อ 1

---

## 5. ของค้าง

| เรื่อง | สถานะ |
|---|---|
| ทดสอบ login เป็น `agent` / `student` / `user` / `manager` จริง | **ทำแล้ว** (4 ก.ย. 2569 ผ่าน Impersonate) ดู §6 ข้อ 1 |
| `lib/permissions.ts` ยังไม่ถูกใช้บังคับสิทธิ์ | **เปิดเป็นงานแยก** (ตัดสิน 3 ก.ย. 2569) — ถ้าจะย้ายไปใช้ `hasPermission()` จริงต้องทำเป็น issue/เฟสของตัวเอง ดู §6 ข้อ 2 |
| `POST /api/admin/change-role` ซ้ำซ้อนกับ better-auth `setRole` | **ลบทิ้งแล้ว** ดู §6 ข้อ 3 |
| warning `'lead' is assigned a value but never used` ใน `api/leads/route.ts` | **แก้แล้ว** ดู §6 ข้อ 4 |

---

## 6. Phase 9 follow-up (branch `feat/itsm-phase-9-followup` · 3 ก.ย. 2569)

เคลียร์ 4 ข้อค้างใน §5

### 1. ทดสอบ login เป็น role อื่นจริง

**ทำแล้ว 4 กันยายน 2569** — ทดสอบผ่านเบราว์เซอร์กับ dev server ที่ต่อฐานข้อมูล Neon จริง

ฐานข้อมูลจริงไม่มีบัญชี `agent`/`student` และบัญชี non-admin ล็อกอินด้วย Google OAuth
จึงเข้าเป็น role นั้นตรงๆ ไม่ได้ ผู้ดูแลจึงตั้งบัญชีทดสอบ 1 ตัว (`matee332@gmail.com`) วน role
ให้ครบทีละตัว แล้วผู้ทดสอบ **login เป็น admin จริง + ใช้ Impersonate** ของ better-auth admin
plugin เข้าเป็นแต่ละ role — session ที่ได้เป็น role นั้นจริง (`get-session` คืน `role` ตามที่ตั้ง)
การกันจึงเป็นการกัน role จริง ไม่ใช่แค่เรียกฟังก์ชันตรวจ

ทุก role: เปิดหน้าที่ควรเข้าได้ → 200 อยู่ที่ path เดิม · เปิดหน้าที่ไม่ถึงสิทธิ์ → เด้งไป `/dashboard`
(guard ใน `lib/screen-guard.ts`) · ยิง API ข้ามสิทธิ์ → 403

| Role (บัญชี) | เข้าได้ (200, ไม่เด้ง) | ถูกตีกลับ → `/dashboard` | API |
|---|---|---|---|
| **manager** (`thitikan.piy`) | `/management/lead` · `/management/assets` · `/management/projects` · `/service/my-work` | `/admin/users` · `/admin/sla` | `GET /api/leads` **200** · knowledge / line·groups **403** · search 200 |
| **agent** (`matee332` = agent) | `/management/assets` · `/service/my-work` | `/admin/users` · `/management/lead` | knowledge / leads / line·groups **403** · tickets 200 · search 200 |
| **user** (`65110004`) | `/service/tickets` · `/dashboard` | `/admin/users` · `/management/assets` · `/management/lead` · `/service/my-work` · `/service/tickets/queue` | knowledge / leads / line·groups **403** · tickets 200 · search 200 |
| **student** (`matee332` = student) | `/service/tickets` · `/service/kb` | `/admin/users` · `/management/assets` · `/management/kb` · `/service/my-work` | knowledge / leads / line·groups **403** · tickets 200 · search 200 |

ผลตรงกับผัง §7.2 ทุกช่อง — รวมเคส prefix ซ้อน (`/service/tickets/queue` = STAFF_WORK เด้ง user/student
ออก แต่ `/service/tickets` = SELF_SERVICE เข้าได้ · `/management/lead` = CRM เด้ง agent ออกแต่ `/management/assets` เข้าได้)
Client sidebar กรองเมนูตาม role ถูกต้องด้วย (student เห็นแค่กลุ่มบริการตนเอง)

_เคส "ยังไม่ login" ทดสอบไว้แล้วใน §4.1 ก. · branch นี้ไม่แตะ `middleware.ts` จึงไม่ต้องรันซ้ำ_
_บัญชีทดสอบ `matee332@gmail.com` — ผู้ดูแลเป็นผู้ตั้ง role เอง ผู้ทดสอบไม่ได้แก้ role ของบัญชีใด_

### 2. `lib/permissions.ts` — เปิดเป็นงานแยก

ผู้ใช้ยืนยันให้คงไว้ตามเดิม การย้ายกลไกบังคับใช้จาก `requireRole()` ไปเป็น `hasPermission()`
มีขอบเขตกว้างและเสี่ยง regression จึงไม่ทำในเฟสนี้ — ต้องเปิดเป็น issue/เฟสของตัวเองถ้าจะทำ

### 3. ลบ `POST /api/admin/change-role`

ไล่ทั้ง repo แล้ว **ไม่มีโค้ดฝั่งไหนเรียกเส้นนี้** — หน้า `/admin/users` เปลี่ยน role ผ่าน
better-auth admin plugin (`authClient.admin.setRole`) ซึ่งมี guard + validation ของตัวเอง
จึงลบ `app/api/admin/change-role/route.ts` ทิ้ง (โฟลเดอร์ `app/api/admin/` ว่างจึงหายไปทั้งอัน)
อัปเดตการอ้างอิงใน `docs/spec.md` §7.3 ② / ③ และตารางในเฟสนี้ (§2.2 / §3)

### 4. แก้ warning `'lead' unused` ใน `api/leads/route.ts`

`const lead = await prisma.lead.create(...)` → `await prisma.lead.create(...)` (ไม่ได้ใช้ค่า
ที่คืนมา) และปรับคอมเมนต์บล็อก n8n webhook ให้สอดคล้อง · `npx eslint app/api/leads/route.ts` ผ่าน
