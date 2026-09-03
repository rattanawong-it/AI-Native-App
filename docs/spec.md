# Requirements Specification — ระบบบริหารงานบริการศูนย์ไอที (IT Service Management)

> **หน่วยงาน:** ศูนย์ไอที — ฝ่ายพัฒนาระบบสารสนเทศและเว็บไซต์
> **จัดทำโดย:** Product Manager / System Analyst / Software Architect
> **วันที่:** 29 สิงหาคม 2569
> **โครงการฐาน:** `ai-native/` (Next.js 16 + TypeScript + Prisma + PostgreSQL + Tailwind v4 + shadcn/ui)
> **สถานะเอกสาร:** v1.1 — ผ่านการสัมภาษณ์เก็บ requirements แล้ว 18 ข้อ · Phase 0 เสร็จ · เพิ่ม §16 มาตรฐาน Git & Commit (1 กันยายน 2569)

---

## สารบัญ

1. [Context — ทำไมต้องพัฒนาระบบนี้](#1-context)
2. [As-Is — สรุประบบเดิม](#2-as-is)
3. [ผลการสัมภาษณ์ — สรุปข้อตกลง 18 ข้อ](#3-ผลการสัมภาษณ์)
4. [รายการที่ต้องแจ้งก่อนแก้ไข (M1–M13)](#4-รายการที่ต้องแจ้งก่อนแก้)
5. [Data Model ที่ออกแบบ](#5-data-model)
6. [โครงสร้าง Route ใหม่](#6-โครงสร้าง-route-ใหม่)
7. [RBAC Matrix (5 Roles)](#7-rbac-matrix)
8. [Checklist ฟีเจอร์](#8-checklist-ฟีเจอร์)
9. [Dependencies ที่ต้องเพิ่ม](#9-dependencies)
10. [Environment Variables](#10-environment-variables)
11. [ลำดับการพัฒนา](#11-ลำดับการพัฒนา)
12. [Non-Functional Requirements](#12-non-functional-requirements)
13. [Out of Scope](#13-out-of-scope)
14. [คำถามที่ยังค้าง](#14-คำถามที่ยังค้าง)
15. [Verification Plan](#15-verification-plan)
16. [มาตรฐาน Git & Commit Workflow](#16-git-commit-workflow)

---

<a id="1-context"></a>

## 1. Context — ทำไมต้องพัฒนาระบบนี้

**ปัญหาปัจจุบัน:** ศูนย์ไอที (ฝ่ายพัฒนาระบบสารสนเทศและเว็บไซต์) รับแจ้งปัญหาและคำขอบริการกระจัดกระจายหลายช่องทาง (LINE / อีเมล / โทรศัพท์ / เดินมาบอก) ไม่มีระบบกลางที่บันทึกงาน จึงเกิดปัญหา:

- งานตกหล่น ไม่มีใครรับผิดชอบชัดเจน
- ไม่รู้ว่างานไหนควรทำก่อน–หลัง (ไม่มีเกณฑ์ Priority)
- ไม่มีตัวชี้วัดว่าศูนย์ให้บริการได้ตามเวลาที่สัญญาไว้หรือไม่ (ไม่มี SLA)
- งานพัฒนาซอฟต์แวร์ (SDLC) กับงานบริการปนกัน มองภาระงานรวมของเจ้าหน้าที่ไม่ออก
- ความรู้/วิธีแก้ปัญหาอยู่ในตัวบุคคล ไม่ถูกบันทึกเป็นคลังความรู้
- งานธุรการศูนย์ (ครุภัณฑ์ คำขออนุมัติ รายงาน) ยังทำด้วยกระดาษ/Excel

**ผลลัพธ์ที่ต้องการ:** ระบบเดียวที่รวม Helpdesk + Priority + To-do + SLA + SDLC + Knowledge Base + งานธุรการ ทำงานต่อยอดบนแอปเดิม โดยไม่ทำลายโครงสร้างเดิม

**ขอบเขตระบบที่ร้องขอ 6 ระบบ:**

1. ระบบรับแจ้งปัญหาและคำขอบริการ (IT Service Request / Helpdesk)
2. ระบบจัดลำดับความสำคัญของงาน (Priority & Incident Management)
3. บันทึกการทำงาน (To-do List) ของเจ้าหน้าที่
4. SLA (Service Level Agreement) ของหน่วยงาน
5. ระบบบริหารโครงการพัฒนาซอฟต์แวร์ SDLC
6. ระบบ Knowledge Base

*(+ งานธุรการของศูนย์ และระบบสนับสนุน: Notification, Dashboard, รายงาน)*

---

<a id="2-as-is"></a>

## 2. As-Is — สรุประบบเดิม

### 2.1 Tech Stack ปัจจุบัน (ตรงกับที่ต้องการอยู่แล้ว ✅)

| ชั้น | เทคโนโลยี | เวอร์ชัน |
|---|---|---|
| Framework | Next.js (App Router) | **16.1.6** ✅ |
| Runtime | React | 19.2.3 |
| ภาษา | TypeScript (strict, alias `@/*`) | ^5 ✅ |
| ORM | Prisma (`@prisma/adapter-pg`) | ^7.5.0 ✅ |
| Database | PostgreSQL + `pgvector` extension | Neon ✅ |
| CSS | Tailwind CSS | ^4 ✅ |
| UI | shadcn/ui + radix-ui | ^4.0.8 ✅ |
| Icons | lucide-react | ^0.577.0 |
| Auth | Better Auth (Email/Pass, Google, GitHub, 2FA, admin plugin) | 1.5.5 |
| AI/RAG | OpenAI SDK + pgvector | ^6.42.0 |
| Notification | LINE Messaging API + Nodemailer (Gmail SMTP) | — |
| Package Manager | pnpm | ✅ |
| Deploy | Docker + docker-compose / Vercel | — |

> **สรุป: ไม่ต้องเปลี่ยน Tech Stack ใดๆ** — ของเดิมตรงกับที่ต้องการทั้งหมด

### 2.2 โครงสร้างโฟลเดอร์เดิม

```
ai-native/
├── app/
│   ├── (auth)/auth/          signin, signup, forgot-password, reset-password,
│   │                         verify-2fa, verify-email
│   ├── (landing)/            Hero, Features, About, Team, TechStack, Testimonial,
│   │                         ContactForm, LeadForm, Navbar, Footer
│   ├── (main)/
│   │   ├── layout.tsx        ← guard session → redirect /auth/signin
│   │   ├── _components/
│   │   │   ├── header/       header, UserMenu, impersonation-banner
│   │   │   └── sidebar/      sidebar, nav-item, nav-section, sidebar-data.ts
│   │   ├── dashboard/  chat/  profile/  help/
│   │   ├── management/       projects/  teams/  lead/
│   │   └── admin/            users/  knowledge/  line-groups/  settings/
│   ├── api/                  auth/ chat/ knowledge/ leads/ line/ search/
│   │                         contact/
│   └── generated/prisma/
├── components/ui/            button, card, input, label  ← มีแค่ 4 ตัว
├── components/chat/          ChatButton, ChatWindow
├── components/knowledge/     FileUpload
├── lib/                      auth, auth-client, permissions, prisma, openai,
│                             rag-service, vector-search, ingestion, text-splitter,
│                             document-loader, context-builder, chat-client,
│                             line-push, theme-store, utils
└── prisma/                   schema.prisma, seed.ts, migrations/
```

### 2.3 Prisma Models เดิม (10 ตัว)

| กลุ่ม | Models |
|---|---|
| Better Auth | `User`, `Session`, `Account`, `Verification`, `TwoFactor` |
| RAG / Vector | `Document` (pgvector 1536), `KnowledgeDocument` |
| Chat | `ChatSession`, `ChatMessage` |
| อื่นๆ | `Lead`, `LineGroup` |

### 2.4 Coding Conventions เดิม (ต้องรักษาไว้ทุกจุด)

| หัวข้อ | รูปแบบเดิม |
|---|---|
| หน้าเว็บ | `page.tsx` (Server Component + เช็ค session) + `XxxContent.tsx` (`"use client"`) |
| API Route | `app/api/<resource>/route.ts` + `[id]/route.ts` |
| Auth Guard | `await auth.api.getSession({ headers: await headers() })` → 401 |
| Response | `NextResponse.json({ resource })` / `{ error }` + status code |
| เมนู | รวมศูนย์ที่ `sidebar-data.ts` มี `allowedRoles?: string[]` |
| คอมเมนต์ | ภาษาไทย |
| Import | alias `@/lib/...`, `@/components/...` |
| Prisma | `@@map("snake_case")` ทุก model |

### 2.5 ⚠️ Gap ที่พบ

1. `management/projects` และ `management/teams` เป็น **mock data ทั้งหมด** (`SAMPLE_PROJECTS` hardcode ใน component) — ไม่มี Prisma model, ไม่มี API route
2. ยังไม่มี model/หน้าใดๆ สำหรับ Ticket, SLA, Task, Sprint, KB Article, Asset, Approval
3. `KnowledgeDocument` เดิมเป็น **คลังเอกสารดิบสำหรับ RAG** ไม่ใช่บทความให้คนอ่าน
4. `components/ui/` มีแค่ 4 ตัว — ต้องเพิ่มอีกมาก
5. `lib/rag-service.ts` → `SYSTEM_PROMPT` ตั้งบริบทเป็น "ผู้ช่วยตอบคำถามนักศึกษา ม.เกริก" ไม่ใช่บริบท Helpdesk
6. `lib/permissions.ts` มี statement เดียวคือ `project` และมี 3 roles

---

<a id="3-ผลการสัมภาษณ์"></a>

## 3. ผลการสัมภาษณ์ — สรุปข้อตกลง 18 ข้อ

| # | ประเด็น | ข้อสรุป |
|---|---|---|
| 1 | ผู้ใช้งาน | 4 กลุ่ม: บุคลากร, นักศึกษา, เจ้าหน้าที่ IT (Agent), หัวหน้า/ผู้บริหาร |
| 2 | ช่องทางแจ้ง | เว็บ (ต้อง login) + LINE + อีเมล/โทร/Walk-in (ไม่มีฟอร์มสาธารณะ) |
| 3 | Service Catalog | 3 หมวด: เว็บไซต์ & ระบบสารสนเทศ / เครือข่าย & บัญชีผู้ใช้ / งานธุรการศูนย์ (**ไม่รวมงานซ่อมฮาร์ดแวร์**) |
| 4 | Priority | **Impact × Urgency Matrix (ITIL)** — คำนวณอัตโนมัติ |
| 5 | SLA Clock | **นับเฉพาะเวลาทำการ** (Business Hours) + ต้องมี Holiday Calendar |
| 6 | SLA Metrics | Response Time + Resolution Time (**ไม่ทำ** Warning / Auto-escalation ในเฟสนี้) |
| 7 | Assignment | **Auto-assign ตามหมวดหมู่** + หัวหน้า/เจ้าหน้าที่โยกย้าย (reassign) ได้ |
| 8 | Ticket Workflow | **5 สถานะ**: New → Assigned → In Progress → Resolved → Closed |
| 9 | To-do List | **My Work รวม**: Ticket ที่ได้รับมอบหมาย + SDLC Task + Personal Task |
| 10 | Time Log | **Manual** — กรอกชั่วโมง + สิ่งที่ทำ เมื่อปิดงาน |
| 11 | SDLC Model | **Agile / Sprint + Kanban Board** (Backlog → To Do → Doing → Review → Done) |
| 12 | Helpdesk ↔ SDLC | **แปลง Ticket → Backlog Task** ได้ พร้อมเก็บลิงก์อ้างอิงกลับ |
| 13 | Knowledge Base | สร้าง **`KbArticle` model ใหม่** + เมื่อ Publish ให้ sync เข้า RAG (pgvector) |
| 14 | งานธุรการ | 3 โมดูล: **ทะเบียนครุภัณฑ์ IT** / **คำขออนุมัติ-เบิกจ่าย (มี workflow)** / **รายงานประจำเดือน-ไตรมาส** (ไม่ทำระบบหนังสือเข้า-ออก) |
| 15 | Notification | **LINE + Email + In-app ครบ 3 ช่องทาง** |
| 16 | Roles | **5 roles**: `student` / `user` / `agent` / `manager` / `admin` |
| 17 | โครงสร้าง URL | กลุ่มใหม่ `(main)/service/*` + ต่อยอด `management/` และ `admin/` |
| 18 | Deliverable | เอกสาร Requirements + Checklist (ยังไม่เขียนโค้ด) |

---

<a id="4-รายการที่ต้องแจ้งก่อนแก้"></a>

## 4. ⚠️ รายการที่ต้อง "แจ้งก่อนแก้" — ตามข้อกำหนดของผู้ใช้

> ผู้ใช้ระบุว่า *"ให้ใช้รูปแบบโครงสร้างเดิม ถ้ามีการแก้ไขต้องแจ้งก่อนทุกครั้ง"*
> ต่อไปนี้คือ **ทุกไฟล์เดิมที่จะถูกแตะ** ต้องขอความเห็นชอบก่อนลงมือทุกครั้ง

| # | ไฟล์เดิม | การเปลี่ยนแปลง | ระดับผลกระทบ |
|---|---|---|---|
| M1 | `prisma/schema.prisma` | เพิ่ม model ใหม่ ~24 ตัว (additive) | 🟢 ต่ำ |
| M2 | `prisma/schema.prisma` → model `User` | **เพิ่ม field**: `departmentId`, `position`, `phone`, `employeeCode`, `lineUserId`, `isAgent` (nullable ทั้งหมด) | 🟡 กลาง — กระทบ Better Auth adapter |
| M3 | `lib/permissions.ts` | เพิ่ม statement ใหม่ (`ticket`, `task`, `kb`, `asset`, `approval`, `report`, `sla`) + role `student`, `agent` | 🟡 กลาง |
| M4 | `lib/auth.ts` | ลงทะเบียน role ใหม่เข้า `adminPlugin({ ac, roles })` | 🟡 กลาง |
| M5 | `app/(main)/_components/sidebar/sidebar-data.ts` | เพิ่ม section `Service` + item ใน `Management` / `Admin` + `allowedRoles` ใหม่ | 🟢 ต่ำ |
| M6 | `app/(main)/management/projects/ProjectContent.tsx` | **เขียนใหม่** — เปลี่ยนจาก mock `SAMPLE_PROJECTS` → เรียก API จริง + Kanban | 🔴 สูง (rewrite) |
| M7 | `app/(main)/management/teams/TeamContent.tsx` | **เขียนใหม่** — เปลี่ยนจาก mock → API จริง | 🔴 สูง (rewrite) |
| M8 | `app/(main)/dashboard/DashboardContent.tsx` | ปรับ widget เป็น KPI ของ ITSM (Ticket, SLA, ภาระงาน) | 🟡 กลาง |
| M9 | `app/api/line/webhook/route.ts` | เพิ่ม handler รับข้อความ → สร้าง Ticket + ผูก `lineUserId` | 🟡 กลาง |
| M10 | `lib/rag-service.ts` | `SYSTEM_PROMPT` เดิมเป็นบริบท "นักศึกษา ม.เกริก" — ต้องเพิ่มโหมด/บริบท Helpdesk | 🟡 กลาง |
| M11 | `package.json` | เพิ่ม dependencies (ดูข้อ 9) | 🟢 ต่ำ |
| M12 | `components/ui/` | เพิ่ม shadcn components (ดูข้อ 8 — F0.7) | 🟢 ต่ำ (เพิ่มไฟล์ใหม่) |
| M13 | `.env` / `.env.production` | เพิ่ม env ใหม่ (ดูข้อ 10) | 🟢 ต่ำ |

**ไฟล์เดิมที่ไม่แตะเลย:** `(auth)/*`, `(landing)/*`, `admin/users`, `admin/knowledge`, `admin/line-groups`, `admin/settings`, `chat/*`, `profile/*`, `help/*`, `management/lead`, `lib/prisma.ts`, `lib/openai.ts`, `lib/vector-search.ts`, `lib/ingestion.ts`, `lib/text-splitter.ts`, `lib/line-push.ts`, `lib/utils.ts`

---

<a id="5-data-model"></a>

## 5. Data Model ที่ออกแบบ (Prisma — ~24 models ใหม่)

### 5.1 กลุ่ม Master Data / ตั้งค่า

| Model | Fields หลัก |
|---|---|
| `Department` | `id, name, code @unique, active` |
| `ServiceCategory` | `id, name, slug @unique, parentId?` (self-relation หมวดย่อย), `description, defaultTeamId?, defaultAssigneeId?, active, sortOrder` |
| `SlaPolicy` | `id, name, priority (critical/high/medium/low), categoryId?, responseMinutes, resolutionMinutes, active` |
| `BusinessHour` | `id, dayOfWeek (0–6), startTime "08:30", endTime "16:30", isWorkingDay` |
| `Holiday` | `id, date @unique, name, isRecurring` |
| `AppSetting` | `id, key @unique, value Json, description` |

### 5.2 กลุ่ม Helpdesk

| Model | Fields หลัก |
|---|---|
| `Ticket` | `id, ticketNo @unique (TK-YYYYMM-00001), title, description, categoryId, requesterId, departmentId?, channel (web/line/email/phone/walkin), impact (high/medium/low), urgency (high/medium/low), priority (critical/high/medium/low — computed), status (new/assigned/in_progress/resolved/closed), assigneeId?, teamId?, respondedAt?, resolvedAt?, closedAt?, responseDueAt, resolutionDueAt, responseBreached, resolutionBreached, resolutionNote?, convertedTaskId?, createdAt, updatedAt` |
| `TicketComment` | `id, ticketId, authorId, body, isInternal` (บันทึกภายใน ผู้แจ้งไม่เห็น)`, createdAt` |
| `TicketAttachment` | `id, ticketId, fileName, filePath, fileType, fileSize, uploadedBy, createdAt` |
| `TicketActivity` | `id, ticketId, actorId, action, fromValue?, toValue?, note?, createdAt` — audit log |

**Priority Matrix (คำนวณอัตโนมัติ):**

|  | Urgency สูง | Urgency กลาง | Urgency ต่ำ |
|---|---|---|---|
| **Impact สูง** | Critical | High | Medium |
| **Impact กลาง** | High | Medium | Low |
| **Impact ต่ำ** | Medium | Low | Low |

**SLA เริ่มต้น (Business Hours — ปรับได้ในหน้า `admin/sla`):**

| Priority | Response | Resolution |
|---|---|---|
| Critical | 30 นาที | 4 ชม.ทำการ |
| High | 1 ชม.ทำการ | 1 วันทำการ |
| Medium | 4 ชม.ทำการ | 3 วันทำการ |
| Low | 1 วันทำการ | 7 วันทำการ |

### 5.3 กลุ่ม My Work / To-do

| Model | Fields หลัก |
|---|---|
| `TodoItem` | `id, ownerId, title, note?, dueDate?, priority, isDone, doneAt?, createdAt` |
| `WorkLog` | `id, userId, workDate, hours Decimal(5,2), description, refType (ticket/task/todo/other), ticketId?, taskId?, todoId?, createdAt` |

> **My Work** = union query ของ `Ticket` (assigneeId = me) + `Task` (assigneeId = me) + `TodoItem` (ownerId = me)

### 5.4 กลุ่ม SDLC / Project (Agile)

| Model | Fields หลัก |
|---|---|
| `Project` | `id, code @unique, name, description, status (planning/active/on_hold/completed/cancelled), ownerId, teamId?, startDate?, endDate?, progress Int, createdAt, updatedAt` |
| `Sprint` | `id, projectId, name, goal?, startDate, endDate, status (planned/active/completed), sortOrder` |
| `Task` | `id, projectId, sprintId?, title, description?, boardStatus (backlog/todo/doing/review/done), priority, assigneeId?, estimateHours?, dueDate?, sortOrder Int, sourceTicketId?, createdBy, createdAt, updatedAt` |
| `TaskComment` | `id, taskId, authorId, body, createdAt` |
| `Team` | `id, name, description?, leaderId?, active, createdAt` |
| `TeamMember` | `id, teamId, userId, roleInTeam, joinedAt` + `@@unique([teamId, userId])` |

### 5.5 กลุ่ม Knowledge Base

| Model | Fields หลัก |
|---|---|
| `KbArticle` | `id, title, slug @unique, summary?, content Text, categoryId?, tags String[], status (draft/pending_review/published/archived), visibility (all/agent_only), authorId, reviewerId?, publishedAt?, viewCount, helpfulCount, notHelpfulCount, isIndexed, knowledgeDocumentId?` (← ลิงก์ไป `KnowledgeDocument` เดิมเมื่อ sync RAG)`, createdAt, updatedAt` |
| `KbFeedback` | `id, articleId, userId?, isHelpful, comment?, createdAt` |

> **RAG Sync flow:** `Publish` → สร้าง/อัปเดต `KnowledgeDocument` → เรียก `lib/ingestion.ts` เดิม → chunk + embed ลง `Document` (pgvector) → ตั้ง `isIndexed = true`

### 5.6 กลุ่มงานธุรการศูนย์

| Model | Fields หลัก |
|---|---|
| `Asset` | `id, assetCode @unique, name, type, brand?, model?, serialNumber?, purchaseDate?, price Decimal?, warrantyEndDate?, location?, status (in_use/in_stock/repair/disposed), custodianId?, departmentId?, note?, createdAt, updatedAt` |
| `AssetHistory` | `id, assetId, action (assign/transfer/repair/dispose/return), fromUserId?, toUserId?, note?, actorId, createdAt` |
| `ApprovalRequest` | `id, requestNo @unique (RQ-YYYYMM-0001), type (purchase/supply/budget/other), title, description, amount Decimal?, requesterId, status (draft/pending/approved/rejected/cancelled), currentStep Int, createdAt, updatedAt` |
| `ApprovalStep` | `id, requestId, stepOrder, approverId, status (pending/approved/rejected), comment?, decidedAt?` |
| `ApprovalAttachment` | `id, requestId, fileName, filePath, fileType, fileSize, uploadedBy, createdAt` |
| `ReportSnapshot` | `id, type (monthly/quarterly), periodStart, periodEnd, dataJson Json, generatedBy, createdAt` |

### 5.7 กลุ่ม Notification

| Model | Fields หลัก |
|---|---|
| `Notification` | `id, userId, type, title, body, linkUrl?, isRead, readAt?, createdAt` |
| `NotificationDelivery` | `id, notificationId, channel (inapp/email/line), status (pending/sent/failed), error?, sentAt?` |

---

<a id="6-โครงสร้าง-route-ใหม่"></a>

## 6. โครงสร้าง Route ใหม่

```
app/(main)/
├── dashboard/                    [M8 — ปรับเนื้อหาเป็น ITSM KPI]
├── chat/                         [เดิม — ไม่แตะ]
├── service/                      ★ กลุ่มใหม่
│   ├── tickets/                  รายการ Ticket + ฟิลเตอร์
│   │   ├── new/                  ฟอร์มแจ้งปัญหา
│   │   └── [id]/                 รายละเอียด + timeline + comment + attachment
│   ├── my-work/                  To-do รวม (Ticket + Task + Personal) + Time Log
│   └── kb/                       Knowledge Base (อ่าน/ค้นหา)
│       ├── new/                  เขียนบทความ (agent+)
│       └── [slug]/               อ่านบทความ + ให้ feedback
├── management/                   [เดิม + ต่อยอด]
│   ├── projects/                 [M6 — rewrite] รายการโครงการ
│   │   └── [id]/                 Sprint + Kanban Board
│   ├── teams/                    [M7 — rewrite] ทีมงาน + สมาชิก
│   ├── lead/                     [เดิม — ไม่แตะ]
│   ├── assets/                   ★ ทะเบียนครุภัณฑ์ IT
│   ├── requests/                 ★ คำขออนุมัติ/เบิกจ่าย
│   └── reports/                  ★ รายงานประจำเดือน/ไตรมาส
└── admin/                        [เดิม + เพิ่ม]
    ├── users/  knowledge/  line-groups/  settings/    [เดิม — ไม่แตะ]
    ├── catalog/                  ★ จัดการ Service Catalog
    ├── sla/                      ★ ตั้งค่า SLA Policy
    └── calendar/                 ★ Business Hours + วันหยุด
```

**API Routes ใหม่** (ตาม pattern เดิม `route.ts` + `[id]/route.ts`):

```
api/tickets/           [id]/  [id]/comments/  [id]/assign/  [id]/status/
                       [id]/attachments/  [id]/convert-to-task/
api/categories/        [id]/
api/sla-policies/      [id]/
api/business-hours/    api/holidays/  [id]/
api/todos/             [id]/
api/worklogs/          [id]/
api/projects/          [id]/  [id]/sprints/  [id]/tasks/
api/tasks/             [id]/  [id]/move/  [id]/comments/
api/teams/             [id]/  [id]/members/
api/kb/                [id]/  [id]/publish/  [id]/feedback/
api/assets/            [id]/  [id]/history/
api/approvals/         [id]/  [id]/decide/
api/reports/           summary/  sla/  workload/  export/
api/notifications/     [id]/read/  read-all/
api/my-work/
```

---

<a id="7-rbac-matrix"></a>

## 7. RBAC Matrix (5 Roles)

ระบบมี 5 role เรียงตามลำดับชั้นสิทธิ์ `student` (0) < `user` (1) < `agent` (2) < `manager` (3) < `admin` (4)
กำหนดไว้ที่ `lib/rbac.ts` (`ROLES`, `ROLE_RANK`) — ผู้ใช้หนึ่งคนถือได้หลาย role พร้อมกัน โดยเก็บเป็น
สตริงคั่นด้วยจุลภาคในคอลัมน์ `user.role` (เช่น `"agent,manager"`) แล้วแยกด้วย `parseRoles()`

<a id="71-สิทธิ์ระดับการกระทำ"></a>

### 7.1 สิทธิ์ระดับการกระทำ (Action-level)

| Action | student | user | agent | manager | admin |
|---|:---:|:---:|:---:|:---:|:---:|
| สร้าง Ticket | ✅ | ✅ | ✅ | ✅ | ✅ |
| ดู Ticket ของตัวเอง | ✅ | ✅ | ✅ | ✅ | ✅ |
| ดู Ticket ทั้งหมด | ❌ | ❌ | ✅ | ✅ | ✅ |
| รับงาน / เปลี่ยนสถานะ | ❌ | ❌ | ⚠️ ¹ | ✅ | ✅ |
| มอบหมาย / โยกย้ายงาน | ❌ | ❌ | ⚠️ ของตัวเอง | ✅ | ✅ |
| My Work / Time Log | ❌ | ❌ | ✅ | ✅ | ✅ |
| อ่าน KB (visibility = all) | ✅ | ✅ | ✅ | ✅ | ✅ |
| เขียน/แก้ KB | ❌ | ❌ | ✅ | ✅ | ✅ |
| Publish KB | ❌ | ❌ | ❌ | ✅ | ✅ |
| Project / Sprint / Task | ❌ | ❌ | ⚠️ อ่าน + แก้ task ตัวเอง | ✅ | ✅ |
| ครุภัณฑ์ | ❌ | ❌ | ⚠️ อ่าน | ✅ | ✅ |
| สร้างคำขออนุมัติ | ❌ | ❌ | ✅ | ✅ | ✅ |
| อนุมัติคำขอ | ❌ | ❌ | ❌ | ✅ | ✅ |
| รายงาน / Dashboard รวม | ❌ | ❌ | ⚠️ ของตัวเอง | ✅ | ✅ |
| ตั้งค่า SLA / Catalog / ปฏิทิน | ❌ | ❌ | ❌ | ❌ | ✅ |
| จัดการผู้ใช้ | ❌ | ❌ | ❌ | ❌ | ✅ |

> ¹ `canUpdateTicket()` (`lib/rbac.ts:137-141`) อนุญาตให้ `agent` แก้ได้ทั้ง **งานที่ตัวเองถือ** และ
> **งานที่ยังไม่มีผู้รับผิดชอบ** (`assigneeId == null`) — จงใจให้กว้างกว่า "ของตัวเอง" เพราะจำเป็นกับ
> การหยิบงานออกจากคิวทีม (`/service/tickets/queue`) ส่วน `manager` ขึ้นไปแก้ได้ทุกใบ

<a id="72-ผังกลุ่มสิทธิ์เข้าถึงหน้าจอ"></a>

### 7.2 ผังกลุ่มสิทธิ์เข้าถึงหน้าจอ (Screen Access Groups)

จัดเส้นทางทั้ง **43 หน้าจอ** เป็น 9 กลุ่มตามระดับสิทธิ์ต่ำสุดที่เข้าได้
**ตารางนี้เป็นเกณฑ์เดียว** ที่ sidebar / middleware / guard ในหน้า / API ต้องอ้างอิงให้ตรงกัน

| # | กลุ่ม | คีย์ | หน้าจอ | เข้าได้ |
|---|---|---|---|---|
| 1 | สาธารณะ | `PUBLIC` | `/` · `/auth/signin` · `/auth/signup` · `/auth/forgot-password` · `/auth/reset-password` · `/auth/verify-email` · `/auth/verify-2fa` | ไม่ต้อง login |
| 2 | ใช้ร่วมทุกคน | `COMMON` | `/dashboard` · `/search` · `/chat` · `/profile` · `/help` | ทุก role ที่ login — เนื้อหากรองตามสิทธิ์ในตัวเอง |
| 3 | บริการตนเอง | `SELF_SERVICE` | `/service/tickets` · `/service/tickets/new` · `/service/tickets/[id]` · `/service/kb` · `/service/kb/[slug]` | ทุก role ที่ login — คุมด้วย row-level (`ticketScopeWhere`, `kbScopeWhere`) |
| 4 | งานเจ้าหน้าที่ | `STAFF_WORK` | `/service/my-work` · `/service/tickets/queue` · `/management/kb` · `/management/kb/new` · `/management/kb/[id]/edit` | `agent` ขึ้นไป |
| 5 | งานธุรการศูนย์ | `OPERATIONS` | `/management/assets` · `/management/assets/[id]` · `/management/assets/[id]/label` · `/management/requests` · `/management/requests/new` · `/management/requests/[id]` · `/management/reports` · `/management/reports/summary` · `/management/reports/sla` · `/management/reports/workload` | `agent` ขึ้นไปเข้าหน้าได้ · เขียน / อนุมัติ / export = `manager` ขึ้นไป |
| 6 | งานพัฒนา (SDLC) | `SDLC` | `/management/projects` · `/management/projects/[id]` · `/management/teams` | `agent` ขึ้นไป (อ่าน) · จัดการโครงการ/ทีม = `manager` ขึ้นไป |
| 7 | ลูกค้าสัมพันธ์ | `CRM` | `/management/lead` | `manager` ขึ้นไป |
| 8 | ตั้งค่าบริการ | `SERVICE_CONFIG` | `/admin/catalog` · `/admin/sla` · `/admin/calendar` | `admin` |
| 9 | ผู้ดูแลระบบ | `SYSTEM_ADMIN` | `/admin/users` · `/admin/knowledge` · `/admin/line-groups` · `/admin/settings` | `admin` |

**หมายเหตุประกอบตาราง**

- **กลุ่ม 2 และ 3 เปิดให้ทุก role โดยตั้งใจ** — ความปลอดภัยอยู่ที่การกรองข้อมูล ไม่ใช่การกันหน้าจอ
  (`/search` กรองผลลัพธ์ตามสิทธิ์ในตัวมันเอง · `/dashboard` เลือกชุดวิดเจ็ตจาก `viewOf()` ใน
  `lib/dashboard-service.ts:57-60` เป็น `manager` / `agent` / `requester`)
- ~~**กลุ่ม 6 ปัจจุบันไม่ตรงกันระหว่างชั้น**~~ **แก้แล้วใน Phase 9** — เดิม `sidebar-data.ts` แสดงเมนู
  "โครงการพัฒนา / ทีมงาน" เฉพาะ `manager` ขึ้นไป แต่ API ใช้ `SDLC_ROLES = ["agent","manager","admin"]`
  ตอนนี้ sidebar เปิดกลุ่ม 6 ถึง `agent` และ `SDLC_ROLES = STAFF_ROLES` อ้าง `lib/roles.ts` ชุดเดียวกัน
  ส่วน "ผู้สนใจ (Lead)" แยกออกไปเป็นกลุ่ม 7 ซึ่งเป็น `manager` ขึ้นไปแล้ว
- หน้าจอในกลุ่ม 5 ที่ `agent` เข้าได้แต่แก้ไม่ได้ ต้องซ่อน/ปิดปุ่มเขียนด้วย ไม่ใช่ปล่อยให้กดแล้วได้ 403
- เส้นทางที่ไม่ปรากฏใน sidebar แต่เข้าถึงได้จริงต้องอยู่ในตารางนี้ด้วย — ปัจจุบันมี
  `/service/tickets/queue`, `/management/kb/new`, `/management/kb/[id]/edit`, `/management/assets/[id]`,
  `/management/assets/[id]/label`, `/management/requests/new`, `/management/requests/[id]`,
  `/management/projects/[id]`, `/management/reports/{summary,sla,workload}`, `/profile`

<a id="73-ผลตรวจสอบสิทธิ์"></a>

### 7.3 ผลตรวจสอบสิทธิ์ (3 กันยายน 2569)

ตรวจทั้งระบบหลัง Phase 8 จบ — **โครงสิทธิ์ออกแบบครบดีแล้ว จึงไม่ต้องเพิ่ม role ใหม่**
(row-level scoping มีครบทุกโดเมน: `ticketScopeWhere`, `kbScopeWhere`, `approvalScopeWhere`,
`ReportScope`, `canAccessTicket` / `canUpdateTicket` / `canAssignTicket`)
แต่ **การบังคับใช้ยังไม่ครบ 4 เรื่อง** เรียงตามความรุนแรง:

> ✅ **ทั้ง 4 ข้อแก้แล้วใน Phase 9** (branch `feat/itsm-phase-9` · ดู `docs/phase-9-rbac.md`)
> หัวข้อย่อยด้านล่างคงไว้เป็นบันทึกสภาพก่อนแก้ พร้อมวงเล็บกำกับว่าตอนนี้เป็นอย่างไร

#### ① หน้าจอไม่ถูกกันฝั่ง server — ✅ แก้แล้ว (Phase 9)

> ตอนนี้: มี `middleware.ts` กันชั้นแรกที่ขอบ + `requireScreen()` ใน `lib/screen-guard.ts`
> ตรวจ role ที่ layout ของกลุ่ม (`admin/layout.tsx`, `management/layout.tsx`) และหน้าที่เกณฑ์ต่าง
> จากกลุ่ม ครบทั้ง 43 หน้า โดยอ้างผัง §7.2 ผ่าน `lib/screen-access.ts`

ไม่มี `middleware.ts` ในโปรเจกต์ และมีเพียง **4 จาก 43 หน้า** ที่ตรวจ role ฝั่ง server
(`admin/users`, `admin/settings`, `admin/line-groups`, `dashboard`) ส่วน `app/(main)/layout.tsx`
เช็คแค่ว่ามี session เท่านั้น

ผลคือ `student` พิมพ์ URL ตรงเข้า `/admin/sla`, `/admin/catalog`, `/admin/calendar`, `/admin/knowledge`
และ `/management/*` ทุกหน้า **ได้หน้าจอจริง** (API จะตอบ 403 ทีหลัง แต่โครงหน้า ปุ่ม และรูปร่างข้อมูล
หลุดออกไปแล้ว) — ที่กันอยู่ตอนนี้คือ `filterSectionsByRole()` ซึ่งเพียงซ่อนเมนูฝั่ง client
ไม่ใช่การควบคุมการเข้าถึง

#### ② API ที่ไม่ตรวจสิทธิ์เลย ทั้งที่แตะข้อมูลจริง — ✅ แก้แล้ว (Phase 9)

> ตอนนี้: ทุกแถวในตารางถูกแก้ตามคอลัมน์ "ควรเป็น" แล้ว · `/api/users` ทั้งสองไฟล์ถูกลบทิ้ง ·
> `POST /api/admin/change-role` ถูกลบทิ้งใน Phase 9 follow-up (ไม่มีผู้เรียกในโค้ด — หน้า `/admin/users`
> ใช้ better-auth admin plugin `setRole` อยู่แล้ว) ·
> ไล่ตรวจทุก `route.ts` ใต้ `app/api` แล้วเหลือเส้นเดียวที่ไม่มี guard คือ `POST /api/contact`
> ซึ่งเปิดสาธารณะโดยตั้งใจ

| Route | ความเสี่ยง | ควรเป็น |
|---|---|---|
| `POST /api/search` | ค้นเชิงความหมายทับคลังเอกสาร RAG ทั้งหมดโดยไม่ต้อง login | `requireAuth()` + จำกัด KB `agent_only` ด้วย `isStaff()` แบบเดียวกับ `api/chat/route.ts:46` |
| `PUT`/`DELETE /api/knowledge/[id]` · `POST /api/knowledge/[id]/index` | แก้/ลบ/re-index เอกสาร RAG ได้โดยไม่ต้อง login | `admin` (ให้ตรงกับหน้า `/admin/knowledge`) |
| `GET /api/leads` · `GET`/`PATCH /api/leads/[id]` | ข้อมูลผู้สนใจทั้งหมดเปิดสาธารณะ | `manager` ขึ้นไป |
| `GET`/`POST /api/line/groups` · `PATCH`/`DELETE /api/line/groups/[id]` | อ่าน/แก้/ลบกลุ่ม LINE ได้โดยไม่ต้อง login | `admin` |
| `GET`/`POST /api/users` · `GET`/`DELETE /api/users/[id]` | stub ค้างจากก่อน ITSM คืนข้อมูลปลอม John/Jane | **ลบทิ้ง** — ของจริงใช้ better-auth admin plugin |
| `POST /api/admin/change-role` | ใช้ `session.user.role !== "admin"` ซึ่ง **พังกับ multi-role** เช่น `"manager,admin"` (ที่อื่นใช้ `parseRoles()` ทั้งหมด) และ `validRoles` ค้างที่ 3 ค่า | **ลบทิ้ง** (Phase 9 follow-up) — ไม่มีผู้เรียกในโค้ด · หน้า `/admin/users` ใช้ better-auth admin plugin `setRole` |

> `POST /api/leads` และ `POST /api/contact` เปิดสาธารณะ **โดยตั้งใจ** (ฟอร์มบนหน้า landing) ห้ามเผลอปิด ·
> `POST /api/line/webhook` ตรวจลายเซ็น HMAC อยู่แล้ว ไม่ต้องแก้

#### ③ role `student` และ `agent` ตั้งให้ใครไม่ได้ — ✅ แก้แล้ว (Phase 9)

> ตอนนี้: ทั้ง 4 ไฟล์อ้าง `ROLES` / `ROLE_LABELS` จาก `lib/roles.ts` · หน้า `/admin/users`
> มีสี ไอคอน และชื่อไทยครบทั้ง 5 role · `lib/auth-client.ts` ลงทะเบียนครบ 5 ตัว

ทั้งสอง role ถูกนิยามครบใน `lib/permissions.ts`, `lib/auth.ts`, `lib/rbac.ts` และ `sidebar-data.ts`
แต่รายการ role ในชั้นจัดการผู้ใช้ยังค้างที่ `["user","manager","admin"]` จากก่อน ITSM:

- `app/(main)/admin/users/UsersManagement.tsx:40` — `ALL_ROLES` (และ `RoleBadge` บรรทัด 312 ไม่มีสี/ไอคอนของสองตัวนี้)
- ~~`app/api/admin/change-role/route.ts:35` — `validRoles`~~ (route ถูกลบทิ้งใน Phase 9 follow-up)
- `lib/auth-client.ts:10` — `adminClient({ ac, roles: { admin, manager, user } })` ลงทะเบียนแค่ 3 จาก 5
- `app/(main)/admin/settings/SettingContent.tsx:462-465` — รายการแสดงผลอย่างเดียว

→ **ครึ่งหนึ่งของ matrix §7.1 ยังใช้จริงไม่ได้** เพราะไม่มีวิธีตั้ง role สองตัวนี้ให้ผู้ใช้จากหน้าจอ

#### ④ ค่าคงที่ role กระจัดกระจายจนเพี้ยนกันเอง — ✅ แก้แล้ว (Phase 9)

> ตอนนี้: `lib/roles.ts` เป็นแหล่งความจริงเดียว (ไม่ import `next/` จึงใช้ได้ทั้งสองฝั่ง)
> `requireRole()` ใน API route 61 จุด/41 ไฟล์ใช้ `[...STAFF_ROLES]` / `[...MANAGER_ROLES]` /
> `[...ADMIN_ROLES]` · ฝั่ง client ใช้ `rolesAreStaff()` / `rolesAreManager()` ·
> `sidebar-data.ts` และ `SDLC_ROLES` อ้างชุดเดียวกัน · `lib/rbac.ts` re-export ให้ครบ

array `["agent","manager","admin"]` และ `["manager","admin"]` ถูกเขียนซ้ำราว **85 จุด** — ~70 จุดใน
`requireRole()` ของ API route · ~15 จุดในคอมโพเนนต์ฝั่ง client ที่คำนวณ `isStaff` / `isManager` / `canManage`
เอง · อีกชุดคือ `STAFF` / `MANAGER` / `ADMIN` ใน `sidebar-data.ts:42-44` และ `SDLC_ROLES` ใน
`lib/project-service.ts:197`

สาเหตุที่ฝั่ง client ต้องคัดลอกเองทั้งที่ `lib/rbac.ts` มี `isStaff()` / `isManager()` ให้แล้ว คือ
`lib/rbac.ts` import `next/server` และ `next/headers` ที่ระดับ module จึง import จาก client component ไม่ได้
ผลของการกระจายตัวนี้เห็นได้จากกลุ่ม 6 ใน §7.2 ที่ sidebar กับ API ไม่ตรงกันแล้ว

#### หมายเหตุ: `lib/permissions.ts` ไม่ใช่ตัวบังคับใช้สิทธิ์

`lib/permissions.ts` ประกาศ statement (`ticket`, `task`, `kb`, `asset`, `approval`, `report`, `sla`) และผูก
`ac.newRole()` ให้ครบทั้ง 5 role ตรงตาม §7.1 — แต่ **ไม่มีโค้ดในแอปเรียก `hasPermission()` หรือ
`checkRolePermission()` เลยสักจุด** การบังคับใช้จริงทั้งหมดเป็นการเทียบชื่อ role ผ่าน `requireRole()`
ใน `lib/rbac.ts`

ไฟล์นี้จึงมีบทบาทเป็น **(ก)** เอกสารสิทธิ์ที่อ่านเป็นโค้ดได้ และ **(ข)** สิทธิ์ที่ better-auth admin plugin
ใช้กับ endpoint ของตัวเอง (`listUsers`, `setRole`, `banUser`, `impersonateUser` ฯลฯ)
การแก้ไฟล์นี้อย่างเดียว **ไม่เปลี่ยนพฤติกรรมของ API ในแอป** — ต้องแก้ `requireRole()` ควบคู่เสมอ

---

<a id="8-checklist-ฟีเจอร์"></a>

## 8. ✅ Checklist ฟีเจอร์ (แยกตามระบบที่ร้องขอ)

### Phase 0 — Foundation (ต้องทำก่อน ทุกเฟสพึ่งพา)

- [x] **F0.1** ขยาย `prisma/schema.prisma` เพิ่ม ~24 models ใหม่ **[M1]**
- [x] **F0.2** เพิ่ม field ใน model `User`: `departmentId`, `position`, `phone`, `employeeCode`, `lineUserId`, `isAgent` **[M2]**
- [x] **F0.3** สร้าง migration + ทดสอบ `pnpm prisma migrate dev` — *apply `20260831120000_itsm_phase0` ลง Neon สำเร็จ + seed แล้ว ข้อมูลเดิมครบ*
- [x] **F0.4** ขยาย `lib/permissions.ts` — statement ใหม่ + role `student`, `agent` **[M3]**
- [x] **F0.5** ลงทะเบียน role ใหม่ใน `lib/auth.ts` **[M4]**
- [x] **F0.6** สร้าง `lib/rbac.ts` — helper `requireRole()`, `canAccessTicket()` ใช้ร่วมทุก API
- [x] **F0.7** เพิ่ม shadcn components: `table`, `dialog`, `select`, `badge`, `tabs`, `textarea`, `dropdown-menu`, `avatar`, `separator`, `sheet`, `popover`, `calendar`, `checkbox`, `switch`, `sonner`, `skeleton`, `alert-dialog`, `progress`, `tooltip` **[M12]**
- [x] **F0.8** อัปเดต `sidebar-data.ts` เพิ่ม section `Service` + item ใหม่ + `allowedRoles` **[M5]**
- [x] **F0.9** สร้าง `lib/business-hours.ts` — คำนวณ due date ตามเวลาทำการ + วันหยุด
- [x] **F0.10** สร้าง `lib/priority.ts` — Impact × Urgency Matrix
- [x] **F0.11** สร้าง `lib/running-number.ts` — generate `TK-YYYYMM-00001`, `RQ-YYYYMM-0001`
- [x] **F0.12** ขยาย `prisma/seed.ts` — Service Catalog, SLA Policy, Business Hours, วันหยุดราชการไทย, ทีมตัวอย่าง
- [x] **F0.13** เพิ่ม dependencies ใน `package.json` **[M11]**

---

### ① ระบบรับแจ้งปัญหาและคำขอบริการ (IT Service Request / Helpdesk)

- [x] **F1.1** หน้า `service/tickets/new` — ฟอร์มแจ้งปัญหา (หัวข้อ, รายละเอียด, หมวดหมู่, Impact, Urgency, แนบไฟล์)
- [x] **F1.2** API `POST /api/tickets` — สร้าง Ticket + gen `ticketNo` + คำนวณ priority + คำนวณ due date + auto-assign
- [x] **F1.3** หน้า `service/tickets` — ตารางรายการ + ฟิลเตอร์ (สถานะ / หมวด / Priority / ผู้รับผิดชอบ / ช่วงวันที่) + ค้นหา + pagination
- [x] **F1.4** View mode ตาม role — `student`/`user` เห็นเฉพาะของตัวเอง, `agent`+ เห็นทั้งหมด
- [x] **F1.5** หน้า `service/tickets/[id]` — รายละเอียด + Timeline (Activity log) + สถานะ SLA
- [x] **F1.6** ระบบ Comment — `POST /api/tickets/[id]/comments` + toggle "บันทึกภายใน" (`isInternal`)
- [ ] **F1.7** ระบบแนบไฟล์ — upload/download/ลบ (จำกัดชนิด + ขนาดไฟล์) — *เลื่อนออกจาก Phase 1 ตามที่ตกลง (รอสรุปที่เก็บไฟล์)*
- [x] **F1.8** Service Catalog CRUD — หน้า `admin/catalog` (หมวดหลัก + หมวดย่อย + ผู้รับผิดชอบเริ่มต้น)
- [x] **F1.9** รับแจ้งผ่าน **LINE** — ขยาย `api/line/webhook` สร้าง Ticket จากข้อความ + ผูก `lineUserId` **[M9]** — *ทำใน Phase 4 พร้อมงาน LINE Notification*
- [x] **F1.10** สร้าง Ticket แทนผู้อื่น (อีเมล/โทร/Walk-in) — เจ้าหน้าที่เลือก requester + ระบุ `channel`
- [x] **F1.11** ค้นหา Ticket แบบ full-text (title + description)
- [x] **F1.12** Export รายการ Ticket เป็น Excel/CSV

---

### ② ระบบจัดลำดับความสำคัญของงาน (Priority & Incident Management)

- [x] **F2.1** `lib/priority.ts` — Matrix 3×3 → Critical / High / Medium / Low
- [x] **F2.2** UI เลือก Impact × Urgency พร้อม **แสดง Priority ที่คำนวณได้แบบ realtime** ในฟอร์ม
- [x] **F2.3** Badge สี Priority ทั่วระบบ (Critical = แดง, High = ส้ม, Medium = เหลือง, Low = เทา)
- [x] **F2.4** เจ้าหน้าที่/หัวหน้าปรับ Impact/Urgency ได้ → priority + due date คำนวณใหม่ + บันทึกเหตุผลลง `TicketActivity`
- [x] **F2.5** เรียงลำดับคิวงานอัตโนมัติ: Priority DESC → `resolutionDueAt` ASC
- [x] **F2.6** Workflow 5 สถานะ + validation การเปลี่ยนสถานะที่ถูกต้อง
  - `new → assigned` (เมื่อมอบหมาย)
  - `assigned → in_progress` (เจ้าหน้าที่เริ่มงาน → บันทึก `respondedAt`)
  - `in_progress → resolved` (ต้องกรอก `resolutionNote` + Time Log)
  - `resolved → closed`
- [x] **F2.7** Auto-assign engine — ตาม `ServiceCategory.defaultAssigneeId` / `defaultTeamId`
- [x] **F2.8** Reassign — หัวหน้าโยกย้ายงาน + บันทึก activity log
- [x] **F2.9** หน้า "คิวงานทีม" — จัดกลุ่มตาม Priority + แสดงภาระงานรายคน

---

### ③ บันทึกการทำงาน (To-do List) ของเจ้าหน้าที่

- [x] **F3.1** หน้า `service/my-work` — 3 แท็บ: Ticket ของฉัน / Task โครงการ / งานส่วนตัว
- [x] **F3.2** มุมมองรวม (All) — เรียงตาม due date + priority ข้ามทั้ง 3 ประเภท
- [x] **F3.3** CRUD `TodoItem` — งานส่วนตัว (หัวข้อ, บันทึก, กำหนดส่ง, priority, ติ๊กเสร็จ)
- [x] **F3.4** ติ๊กเสร็จ / ยกเลิกติ๊ก + บันทึก `doneAt`
- [x] **F3.5** ฟอร์มบันทึก **Time Log** (Manual) — วันที่, จำนวนชั่วโมง, สิ่งที่ทำ, ผูกกับ Ticket/Task/Todo
- [x] **F3.6** บังคับบันทึก Time Log เมื่อเปลี่ยนสถานะ Ticket เป็น `resolved`
- [x] **F3.7** สรุปชั่วโมงทำงานรายวัน/สัปดาห์/เดือนของตัวเอง
- [x] **F3.8** หัวหน้าดู Time Log ของทีม — รายงานภาระงานรายคน
- [x] **F3.9** Widget "งานวันนี้" + "งานเลยกำหนด" บน Dashboard **[M8]** — *ทำใน Phase 8 พร้อมกับการเขียน `DashboardContent.tsx` ใหม่ทั้งไฟล์*

---

### ④ SLA (Service Level Agreement) ของหน่วยงาน

- [x] **F4.1** CRUD `SlaPolicy` — หน้า `admin/sla` (ตั้ง Response/Resolution นาที ต่อ Priority และ/หรือต่อหมวดหมู่)
- [x] **F4.2** CRUD `BusinessHour` — หน้า `admin/calendar` (จ.–ศ. 08:30–16:30 ปรับได้)
- [x] **F4.3** CRUD `Holiday` — ปฏิทินวันหยุดราชการ + import วันหยุดประจำปี
- [x] **F4.4** `lib/business-hours.ts` — ฟังก์ชัน `addBusinessMinutes(from, minutes)` ข้ามวันหยุด/นอกเวลาทำการ
- [x] **F4.5** คำนวณ `responseDueAt` / `resolutionDueAt` ตอนสร้าง Ticket + คำนวณใหม่เมื่อ Priority เปลี่ยน
- [x] **F4.6** บันทึก `respondedAt` (ครั้งแรกที่ agent ตอบ/รับงาน) และ `resolvedAt`
- [x] **F4.7** ตั้งธง `responseBreached` / `resolutionBreached` เมื่อเกินกำหนด
- [x] **F4.8** SLA Indicator ในหน้ารายการ + รายละเอียด — 🟢 On-time / 🟡 At-risk (> 75%) / 🔴 Breached
- [x] **F4.9** นับถอยหลังเวลาคงเหลือ (แสดงเป็นชั่วโมงทำการ)
- [x] **F4.10** รายงาน SLA Compliance — % ตรงเวลา แยกตาม Priority / หมวดหมู่ / เจ้าหน้าที่ / ช่วงเวลา
- [x] **F4.11** รายการ Ticket ที่ Breach — ตารางพร้อมเหตุผล
- [ ] ~~Warning notification ก่อนครบกำหนด~~ — **ตัดออกตามข้อ 6** (เก็บไว้เฟสถัดไป)
- [ ] ~~Auto-escalation เมื่อ breach~~ — **ตัดออกตามข้อ 6** (เก็บไว้เฟสถัดไป)

---

### ⑤ ระบบบริหารโครงการพัฒนาซอฟต์แวร์ SDLC (Agile / Sprint)

- [x] **F5.1** CRUD `Project` — หน้า `management/projects` (แทน mock เดิม) **[M6]**
- [x] **F5.2** หน้า `management/projects/[id]` — ภาพรวมโครงการ + progress + สมาชิก
- [x] **F5.3** CRUD `Sprint` — สร้าง/แก้ไข/ปิด Sprint (ชื่อ, เป้าหมาย, ช่วงวันที่)
- [x] **F5.4** **Kanban Board** 5 คอลัมน์: Backlog → To Do → Doing → Review → Done
- [x] **F5.5** Drag & drop ย้ายการ์ดข้ามคอลัมน์ (`@dnd-kit`) + `PATCH /api/tasks/[id]/move`
- [x] **F5.6** CRUD `Task` — หัวข้อ, รายละเอียด, ผู้รับผิดชอบ, priority, ประมาณชั่วโมง, กำหนดส่ง
- [x] **F5.7** Task detail modal + comment
- [x] **F5.8** **แปลง Ticket → Backlog Task** — ปุ่มในหน้า Ticket, เลือกโครงการ/Sprint, เก็บ `sourceTicketId` + `convertedTaskId` สองทาง
- [x] **F5.9** แสดงลิงก์อ้างอิงกลับ — Ticket แสดง "งานพัฒนาที่เกี่ยวข้อง", Task แสดง "มาจาก Ticket #..."
- [x] **F5.10** คำนวณ progress โครงการอัตโนมัติจากสัดส่วน Task ที่ Done
- [x] **F5.11** CRUD `Team` + `TeamMember` — หน้า `management/teams` (แทน mock เดิม) **[M7]**
- [x] **F5.12** Sprint Burndown / สรุป Sprint (จำนวน Task ตามสถานะ)
- [x] **F5.13** Backlog view — รายการ Task ที่ยังไม่เข้า Sprint + ลาก/มอบเข้า Sprint

---

### ⑥ ระบบ Knowledge Base

- [x] **F6.1** CRUD `KbArticle` — หน้า `service/kb` + `service/kb/new`
- [x] **F6.2** Markdown editor + preview (ใช้ `react-markdown` + `remark-gfm` ที่มีอยู่แล้ว)
- [x] **F6.3** หมวดหมู่ + Tags + ค้นหา + ฟิลเตอร์
- [x] **F6.4** สถานะบทความ: Draft → Pending Review → Published → Archived
- [x] **F6.5** Workflow การเผยแพร่: `agent` เขียน → `manager`/`admin` Publish
- [x] **F6.6** Visibility: `all` (ทุกคนอ่านได้) / `agent_only` (เฉพาะเจ้าหน้าที่)
- [x] **F6.7** หน้าอ่าน `service/kb/[slug]` + นับ `viewCount`
- [x] **F6.8** ปุ่ม "มีประโยชน์ / ไม่มีประโยชน์" → `KbFeedback` + นับสถิติ
- [x] **F6.9** **Sync เข้า RAG** — Publish → สร้าง/อัปเดต `KnowledgeDocument` → เรียก `lib/ingestion.ts` เดิม → embed ลง pgvector → `isIndexed = true`
- [x] **F6.10** Un-publish / Archive → ลบ vector ที่เกี่ยวข้องออก
- [x] **F6.11** ปรับ `SYSTEM_PROMPT` ใน `lib/rag-service.ts` ให้รองรับบริบท Helpdesk **[M10]**
- [x] **F6.12** แนะนำบทความ KB ที่เกี่ยวข้องในหน้า Ticket (vector search จาก title + description)
- [x] **F6.13** สร้างบทความ KB จาก Ticket ที่แก้แล้ว — ปุ่ม "บันทึกเป็นองค์ความรู้" (prefill จาก `resolutionNote`)

---

### ⑦ งานธุรการศูนย์

#### 7A. ทะเบียนครุภัณฑ์ / ทรัพย์สิน IT

- [x] **F7.1** CRUD `Asset` — หน้า `management/assets`
- [x] **F7.2** ฟิลด์: รหัสครุภัณฑ์, ชื่อ, ประเภท, ยี่ห้อ/รุ่น, S/N, วันที่ซื้อ, ราคา, วันหมดประกัน, สถานที่, สถานะ, ผู้ครอบครอง, หน่วยงาน
- [x] **F7.3** สถานะ: ใช้งาน / ในคลัง / ส่งซ่อม / จำหน่ายแล้ว
- [x] **F7.4** `AssetHistory` — ประวัติการโอน/ซ่อม/คืน/จำหน่าย
- [x] **F7.5** สร้าง **QR Code** ของครุภัณฑ์ (ใช้ `qrcode` ที่มีอยู่แล้ว) + หน้าพิมพ์ป้าย
- [x] **F7.6** แจ้งเตือนครุภัณฑ์ใกล้หมดประกัน
- [x] **F7.7** Import/Export ครุภัณฑ์ (CSV — ใช้ `csv-parse` ที่มีอยู่แล้ว)

#### 7B. คำขออนุมัติ / เบิกจ่าย

- [x] **F7.8** CRUD `ApprovalRequest` — หน้า `management/requests`
- [x] **F7.9** ประเภทคำขอ: จัดซื้อ / เบิกวัสดุ / งบประมาณ / อื่นๆ
- [x] **F7.10** `ApprovalStep` — กำหนดผู้อนุมัติหลายขั้นตามลำดับ
- [x] **F7.11** Workflow: Draft → Pending → Approved / Rejected (+ Cancelled)
- [x] **F7.12** หน้า "รออนุมัติของฉัน" สำหรับ `manager`/`admin` + ปุ่มอนุมัติ/ไม่อนุมัติ + ความเห็น
- [ ] **F7.13** แนบไฟล์ประกอบคำขอ (ใบเสนอราคา ฯลฯ) — *เลื่อนออกจาก Phase 7 ตามที่ตกลง (รอสรุปที่เก็บไฟล์ร่วมกับ F1.7 — model `ApprovalAttachment` มีอยู่แล้วใน schema)*
- [x] **F7.14** Timeline การอนุมัติ + ประวัติ

#### 7C. รายงานประจำเดือน / ไตรมาส

> **ทำแล้วใน Phase 8** — รวมอยู่ในหน้าเดียวที่ `/management/reports/summary`
> เรียงทุกส่วนต่อกันลงมาโดยไม่ใช้แท็บ เพราะเป็นเอกสารที่ต้องกดพิมพ์ทีเดียวให้ครบทั้งฉบับ

- [x] **F7.15** หน้า `management/reports` เลือกช่วงเวลา (เดือน / ไตรมาส / กำหนดเอง)
- [x] **F7.16** รายงานสรุป Ticket — จำนวนรับ/ปิด/ค้าง แยกตามหมวด/Priority/ช่องทาง
- [x] **F7.17** รายงาน SLA Compliance — % ตรงเวลา + รายการ Breach
- [x] **F7.18** รายงานภาระงานเจ้าหน้าที่ — จำนวนงาน + ชั่วโมงจาก Time Log
- [x] **F7.19** รายงานความคืบหน้าโครงการ SDLC
- [x] **F7.20** รายงานครุภัณฑ์ + คำขออนุมัติ
- [x] **F7.21** กราฟ (`recharts`) — แนวโน้มรายเดือน, สัดส่วนตามหมวด, SLA trend
- [x] **F7.22** **Export PDF / Excel** สำหรับส่งผู้บริหาร
- [x] **F7.23** บันทึก `ReportSnapshot` เพื่อเปรียบเทียบย้อนหลัง

---

### ⑧ Notification (LINE + Email + In-app)

- [x] **F8.1** `lib/notification.ts` — service กลาง `notify({ userId, type, title, body, linkUrl, channels })`
- [x] **F8.2** In-app — model `Notification` + กระดิ่งใน Header + dropdown + mark as read
- [x] **F8.3** Email — ใช้ `nodemailer` เดิม + template (Ticket ใหม่ / เปลี่ยนสถานะ / มีคอมเมนต์ / แก้เสร็จ)
- [x] **F8.4** LINE — ใช้ `lib/line-push.ts` เดิม push เข้ากลุ่มทีมเมื่อมี Ticket ใหม่/มอบหมาย
- [x] **F8.5** LINE ตอบกลับผู้แจ้งรายบุคคล (ถ้ามี `lineUserId`)
- [x] **F8.6** Event ที่ต้องแจ้ง: Ticket ใหม่ / มอบหมายงาน / เปลี่ยนสถานะ / คอมเมนต์ใหม่ / คำขอรออนุมัติ / ผลการอนุมัติ / Task ถูกมอบหมาย — *เฟส 4 ผูกครบ 4 เหตุการณ์ของ Ticket · เฟส 5 ผูก `task_assigned` แล้ว (สร้างการ์ดพร้อมผู้รับผิดชอบ / เปลี่ยนผู้รับผิดชอบ / แปลง Ticket) · เฟส 7 ผูก `approval_requested` (ยื่นคำขอ + ทุกครั้งที่ถึงคิวขั้นถัดไป) และ `approval_decided` (แจ้งผู้ขอเมื่อได้ข้อยุติ) ครบแล้ว พร้อมเพิ่มชนิด `asset_warranty_expiring`*
- [x] **F8.7** ตั้งค่าเปิด/ปิดช่องทางรายบุคคล (หน้า `profile`)
- [x] **F8.8** `NotificationDelivery` — บันทึกผลส่ง + retry เมื่อ fail

---

### ⑨ Dashboard & ภาพรวม

- [x] **F9.1** Dashboard แยกตาม role **[M8]**
- [x] **F9.2** `student`/`user` — Ticket ของฉัน + สถานะ + ลิงก์แจ้งใหม่
- [x] **F9.3** `agent` — งานที่รับผิดชอบ, ใกล้ครบ SLA, งานวันนี้, ชั่วโมงสัปดาห์นี้
- [x] **F9.4** `manager`/`admin` — KPI รวม: Ticket เข้า/ปิด/ค้าง, % SLA, ภาระงานรายคน, ความคืบหน้าโครงการ, คำขอรออนุมัติ
- [x] **F9.5** กราฟแนวโน้ม 7/30 วัน
- [x] **F9.6** Global search — ค้นหาข้าม Ticket / KB / Project / Asset

---

<a id="9-dependencies"></a>

## 9. Dependencies ที่ต้องเพิ่ม **[M11]**

| Package | ใช้ทำอะไร |
|---|---|
| `zod` | Validate input ฝั่ง API + form |
| `react-hook-form` + `@hookform/resolvers` | จัดการฟอร์ม (มีฟอร์มเยอะมาก) |
| `date-fns` | คำนวณวันเวลา + business hours + format ภาษาไทย |
| `@dnd-kit/core` + `@dnd-kit/sortable` | Kanban drag & drop |
| `recharts` | กราฟใน Dashboard และรายงาน |
| `@tanstack/react-table` | ตารางที่มี sort/filter/pagination |
| `exceljs` | Export Excel |
| `@react-pdf/renderer` หรือ `puppeteer` | Export PDF รายงาน |
| `nanoid` | Generate slug / รหัสสั้น |

**ที่มีอยู่แล้วและจะ reuse:** `qrcode` (ป้ายครุภัณฑ์), `csv-parse` (import), `react-markdown` + `remark-gfm` (KB), `nodemailer` (email), `openai` + pgvector (RAG), `lucide-react`

---

<a id="10-environment-variables"></a>

## 10. Environment Variables ที่ต้องเพิ่ม **[M13]**

```env
# File upload
UPLOAD_DIR=./uploads              # หรือใช้ S3 / Vercel Blob
MAX_UPLOAD_SIZE=10485760          # 10 MB

# Business hours default
DEFAULT_WORK_START=08:30
DEFAULT_WORK_END=16:30
DEFAULT_TIMEZONE=Asia/Bangkok

# Ticket numbering
TICKET_PREFIX=TK
REQUEST_PREFIX=RQ
```

> **ที่มีอยู่แล้ว:** `DATABASE_URL`, `BETTER_AUTH_SECRET`, `BETTER_AUTH_URL`, `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `SMTP_HOST`, `SMTP_PORT`, `GMAIL_USER`, `GMAIL_APP_PASSWORD`, `LINE_CHANNEL_ACCESS_TOKEN`, `LINE_CHANNEL_SECRET`

---

<a id="11-ลำดับการพัฒนา"></a>

## 11. ลำดับการพัฒนาที่แนะนำ

| เฟส | เนื้อหา | พึ่งพา |
|---|---|---|
| **0** | Foundation: Schema, RBAC, shadcn, sidebar, helper libs, seed | — |
| **1** | Helpdesk + Priority + Workflow (①②) | 0 |
| **2** | SLA Engine + Business Hours + SLA Report (④) | 1 |
| **3** | My Work + To-do + Time Log (③) | 1 |
| **4** | Notification 3 ช่องทาง (⑧) | 1 |
| **5** | SDLC: Project/Sprint/Kanban + Convert Ticket → Task (⑤) | 1, 3 |
| **6** | Knowledge Base + RAG Sync (⑥) | 1 |
| **7** | งานธุรการ: ครุภัณฑ์ + คำขออนุมัติ (⑦A, ⑦B) | 0, 4 |
| **8** | Dashboard + รายงาน + Export (⑦C, ⑨) | ทุกเฟส |
| **9** | บังคับใช้สิทธิ์ให้ครบทุกชั้น — กันหน้าจอฝั่ง server, ปิด API ที่ไม่ตรวจสิทธิ์, ทำให้ role ครบ 5 ใช้ได้จริง, รวมค่าคงที่ role (ปิด §7.3 ทั้ง 4 ข้อ) | ทุกเฟส |

---

<a id="12-non-functional-requirements"></a>

## 12. Non-Functional Requirements

- [x] **NFR1** ทุก API route ตรวจ session ตาม pattern เดิม + ตรวจ role ผ่าน `lib/rbac.ts`
      *(ปิดใน Phase 9 — ไล่ตรวจทุก `route.ts` ใต้ `app/api` แล้ว เหลือเส้นเดียวที่ไม่มี guard
      คือ `POST /api/contact` ซึ่งเปิดสาธารณะโดยตั้งใจ · ดู `docs/phase-9-rbac.md`)*
- [ ] **NFR2** Validate input ทุก endpoint ด้วย `zod`
- [ ] **NFR3** ผู้ใช้ทั่วไปต้องเห็นเฉพาะ Ticket ของตัวเอง (row-level check ทุก query)
- [ ] **NFR4** UI ภาษาไทยทั้งหมด, วันที่รูปแบบไทย (พ.ศ.), timezone `Asia/Bangkok`
- [ ] **NFR5** Responsive — ใช้งานบนมือถือได้ (เจ้าหน้าที่อัปเดตงานนอกสถานที่)
- [ ] **NFR6** รองรับ Dark mode ตาม `lib/theme-store.ts` เดิม
- [ ] **NFR7** Audit trail ทุกการเปลี่ยนสถานะ/มอบหมาย (`TicketActivity`)
- [ ] **NFR8** Index ที่จำเป็น: `Ticket(status, priority, assigneeId, createdAt)`, `Task(projectId, boardStatus)`, `WorkLog(userId, workDate)`
- [ ] **NFR9** Pagination ทุกตาราง (default 20 แถว)
- [ ] **NFR10** ไฟล์แนบ: จำกัดชนิด (jpg/png/pdf/docx/xlsx/zip) + ขนาด ≤ 10 MB + ตรวจ MIME

---

<a id="13-out-of-scope"></a>

## 13. Out of Scope (ตกลงว่าไม่ทำในเฟสนี้)

- ❌ งานซ่อมฮาร์ดแวร์ / คอมพิวเตอร์ (ไม่อยู่ใน Service Catalog ตามข้อ 3)
- ❌ ระบบหนังสือเข้า-ออก / สารบรรณ (ตามข้อ 14)
- ❌ ฟอร์มแจ้งปัญหาสาธารณะแบบไม่ต้อง login (ตามข้อ 2)
- ❌ SLA Warning notification ก่อนครบกำหนด (ตามข้อ 6)
- ❌ Auto-escalation เมื่อ SLA breach (ตามข้อ 6)
- ❌ สถานะ Pending / Reopened / Approval ใน Ticket workflow (ตามข้อ 8)
- ❌ Timer จับเวลาอัตโนมัติ (ตามข้อ 10)
- ❌ Problem Management / Change Management / CMDB (ITIL ขั้นสูง)
- ❌ CSAT survey หลังปิดงาน (เสนอไว้พิจารณาเฟสถัดไป)
- ❌ Mobile app native

---

<a id="14-คำถามที่ยังค้าง"></a>

## 14. คำถามที่ยังค้าง (ควรตอบก่อนเริ่ม Phase 0)

1. **File storage** — เก็บไฟล์แนบที่ไหน? local `./uploads` (ต้อง mount volume ใน Docker) หรือ Vercel Blob / S3?
2. **แหล่งข้อมูลผู้ใช้** — บุคลากร/นักศึกษาสมัครเองผ่าน Better Auth หรือ import จากระบบ HR / ทะเบียนนักศึกษา?
3. **รายชื่อหน่วยงาน (Department)** — มีรายชื่อจริงให้ seed หรือให้ admin กรอกเอง?
4. **หมวดย่อยของ Service Catalog** — มีรายการหมวดย่อยจริงที่ต้องการ seed หรือไม่?
5. **ค่า SLA จริงของหน่วยงาน** — ใช้ค่าเริ่มต้นที่เสนอในข้อ 5.2 หรือมีประกาศ SLA ของศูนย์อยู่แล้ว?
6. **จำนวนเจ้าหน้าที่ในศูนย์** — มีกี่คน แบ่งเป็นกี่ทีม? (มีผลกับ auto-assign)

---

<a id="15-verification-plan"></a>

## 15. Verification Plan (เมื่อเริ่มพัฒนาจริง)

1. `pnpm prisma migrate dev` — schema ใหม่ migrate สำเร็จ, ไม่กระทบ 10 models เดิม
2. `pnpm prisma db seed` — Catalog / SLA / Business Hours / Holiday ถูก seed
3. `pnpm dev` → ทดสอบ login ด้วย 5 roles → sidebar แสดงเมนูถูกต้องตาม role
4. **E2E flow:** แจ้ง Ticket (Impact สูง × Urgency สูง) → priority = Critical → auto-assign → due date ตรงตามเวลาทำการ (ข้ามวันหยุด) → agent รับงาน → comment → resolved + Time Log → closed
5. ทดสอบ SLA breach: สร้าง Ticket ย้อนหลัง → ตรวจว่าธง `resolutionBreached` ถูกตั้ง + รายงานแสดงถูก
6. ทดสอบ convert Ticket → Task → ตรวจลิงก์สองทาง + การ์ดปรากฏใน Backlog
7. ทดสอบ KB Publish → ตรวจว่ามี record ใน `Document` (pgvector) → ถาม chatbot แล้วตอบจากบทความได้
8. ทดสอบ notification 3 ช่องทาง: กระดิ่งใน UI + อีเมลเข้าจริง + LINE เข้ากลุ่ม
9. ทดสอบ RBAC: login เป็น `student` → เรียก `GET /api/tickets` ของคนอื่น → ต้องได้ 403
10. `pnpm build` + `pnpm lint` ผ่าน

---

<a id="16-git-commit-workflow"></a>

## 16. มาตรฐานกลาง — Git & Commit Workflow

> **ผลบังคับใช้:** ตั้งแต่ Phase 1 เป็นต้นไป — ถอดบทเรียนจากการทำ Phase 0 จริง
> ทุกเฟสต้องทำครบทุกขั้น ไม่ข้ามขั้น

### 16.1 Branch Strategy — 1 เฟส = 1 branch

| กฎ | รายละเอียด |
|---|---|
| ชื่อ branch | `feat/itsm-phase-<N>` เช่น `feat/itsm-phase-1` |
| แตกจาก | `main` ที่ sync กับ `origin/main` แล้วเท่านั้น |
| ⛔ ห้าม | **commit ลง `main` โดยตรงทุกกรณี** |
| งานแทรก/แก้บั๊กนอกเฟส | แยก `fix/<เรื่อง>` จาก `main` ต่างหาก ไม่ปนใน branch เฟส |
| จบเฟส | merge เข้า `main` แบบ `--no-ff` (ให้เห็น merge commit ของเฟส) แล้ว push ทันที |
| branch เก่า | เก็บไว้จนเฟสถัดไปเริ่มและยืนยันว่าไม่มีปัญหา จึงค่อยลบ |

### 16.2 ขั้นตอนมาตรฐาน 8 ขั้นต่อ 1 เฟส

| ขั้น | สิ่งที่ทำ | คำสั่ง / หลักฐาน |
|---|---|---|
| **1. เปิดเฟส** | sync `main` → ตรวจ working tree ต้องสะอาด → แตก branch | `git switch main && git pull` · `git status --porcelain` (ต้องว่าง) · `git switch -c feat/itsm-phase-N main` |
| **2. ขออนุมัติ** | ไล่ดูว่าเฟสนี้จะแตะไฟล์ใดในตาราง **M1–M13** (§4) → **แจ้งขอความเห็นชอบก่อนลงมือทุกครั้ง** | สรุปเป็นรายการไฟล์ + สิ่งที่จะเปลี่ยน ก่อนแก้บรรทัดแรก |
| **3. ลงมือ** | commit ย่อยระหว่างทาง 1 commit = 1 เรื่อง อ้างรหัสฟีเจอร์ (F1.2, F2.6 …) | ดู §16.3 |
| **4. แก้ schema** | ถ้าแตะ `schema.prisma` ต้อง gen migration และ **commit โฟลเดอร์ migration ไปพร้อมกันใน commit เดียว** | ดู §16.5 ข้อ 1–2 |
| **5. ผ่านเกต** | รันเกต G1–G7 ให้ผ่านก่อน commit ทุกครั้ง | ดู §16.4 |
| **6. ปิดเฟส (เอกสาร)** | ติ๊ก checklist §8 จาก `[ ]` → `[x]` + เขียน `docs/phase-<N>-<ชื่อ>.md` (สิ่งที่ทำ / ไฟล์เดิมที่แก้ / ผลตรวจ / **ของค้าง**) | commit แยกเป็น `docs:` |
| **7. merge + push** | ตรวจว่าจะ push อะไรไปก่อนเสมอ | `git log --oneline origin/main..main` → `git switch main && git merge --no-ff feat/itsm-phase-N` → `git push origin main` |
| **8. ส่งมอบ** | รายงานสถานะ: commit ที่เพิ่ม, ผลเกต, ของค้าง, คำถามที่ต้องการคำตอบก่อนเฟสถัดไป | — |

### 16.3 Commit Message Convention

```
<type>(<scope>): <สรุปสั้น ไม่เกิน ~72 ตัวอักษร>

<body ภาษาไทย — อธิบายว่าทำอะไร/ทำไม>
อ้างอิง: F1.2, F1.3, F2.7
```

| ส่วน | ค่าที่ใช้ |
|---|---|
| `type` | `feat` (ฟีเจอร์ใหม่) · `fix` (แก้บั๊ก) · `refactor` · `docs` · `chore` (deps/config) · `style` · `test` |
| `scope` | ชื่อโมดูล — `itsm`, `tickets`, `sla`, `kb`, `assets`, `notify`, `rbac`, `schema` |
| `สรุปสั้น` | ขึ้นต้นด้วยกริยา ไม่ต้องมีจุดปิดท้าย |
| Merge commit | `Merge branch 'feat/itsm-phase-N' — ITSM Phase N: <หัวข้อเฟส>` |

**ตัวอย่างที่ใช้จริงในโปรเจกต์นี้:**

```
feat(itsm): Phase 0 foundation — schema, RBAC, design tokens, helper libs
docs: add ITSM requirements spec and Claude Design UI handoff bundle
Merge branch 'feat/itsm-phase-0' — ITSM Phase 0: Foundation
```

**กฎย่อย**

- 1 commit = 1 เรื่องที่อธิบายได้ในบรรทัดเดียว — ห้ายัดหลายฟีเจอร์รวมกัน
- คอมเมนต์ในโค้ดและ body ของ commit เป็น **ภาษาไทย** ตาม convention เดิม (§2.4)
- ห้าม commit โค้ดที่ยัง `tsc` ไม่ผ่าน แม้จะเป็น commit ระหว่างทาง

### 16.4 Definition of Done — เกตก่อน commit ทุกครั้ง

| # | เกต | คำสั่ง | เกณฑ์ผ่าน |
|---|---|---|---|
| **G1** | ไฟล์ที่จะ commit ถูกต้อง | `git status --porcelain` + `git diff --stat` | ไม่มีไฟล์แปลกปลอม / ไฟล์ค้างที่ไม่ตั้งใจติดไปด้วย |
| **G2** | Schema ถูกต้อง *(เฉพาะเมื่อแตะ `schema.prisma`)* | `pnpm prisma validate` | ผ่าน |
| **G3** | Client ตรงกับ schema | `pnpm prisma generate` | ผ่าน |
| **G4** | Type ครบ | `npx tsc --noEmit` | **0 error** |
| **G5** | Lint ไฟล์ที่แตะ | `pnpm lint <path ที่แก้>` | 0 error เฉพาะไฟล์ที่แก้/สร้างใหม่ *(baseline เดิม 18 error ในไฟล์ "ไม่แตะเลย" ไม่นับ — ดู §16.5 ข้อ 5)* |
| **G6** | Build ผ่าน | `pnpm build` | ผ่าน — **บังคับอย่างน้อย 1 ครั้งก่อน merge เข้า `main`** |
| **G7** | อยู่ในขอบเขต | ทบทวน diff ด้วยตา | ไม่มีไฟล์นอกรายการ M1–M13 ที่ยังไม่ได้ขออนุมัติ |

> G4 เป็นเกตขั้นต่ำของทุก commit · G2/G3 ตามเงื่อนไข · G6 บังคับที่จุด merge

### 16.5 กฎเฉพาะของโปรเจกต์นี้ (ห้ามละเมิด)

1. **โฟลเดอร์ `prisma/migrations/**` ต้อง commit ทุกครั้ง** — Phase 0 เจอ drift เพราะ migration `20260609112407_add_document_table` ถูก apply ลง DB แล้วแต่โฟลเดอร์หายจาก repo ทำให้ Prisma สั่ง reset (ข้อมูลจะหายทั้งหมด) ต้องกู้ไฟล์คืนและแก้ checksum ใน `_prisma_migrations` เอง
2. **`schema.prisma` + โฟลเดอร์ migration ต้องอยู่ใน commit เดียวกัน** — ห้ามแยกคนละ commit
3. ⛔ **ห้ามรัน `prisma migrate reset` / `migrate dev` กับ DB จริง (Neon)** — ใช้ `prisma migrate diff` สร้าง SQL → **อ่าน SQL ยืนยันว่าไม่มี `DROP` / `TRUNCATE`** → apply ด้วย `prisma migrate deploy` เท่านั้น
4. **ไฟล์ในตาราง M1–M13 (§4) ต้องแจ้งและได้รับความเห็นชอบก่อนแก้ทุกครั้ง** — ไฟล์นอกตารางที่จำเป็นต้องแตะ ต้องขออนุมัติเพิ่มเป็นรายกรณี (เช่น `globals.css`, `eslint.config.mjs` ใน Phase 0)
5. **ไม่แก้ lint error เดิมที่อยู่ในไฟล์กลุ่ม "ไม่แตะเลย"** (§4 ท้ายตาราง) — ปัจจุบันมี 18 error (`no-explicit-any`) ถ้าจะเก็บกวาดต้องเปิดเป็นงานแยกและขออนุมัติ
6. **ห้าม commit เข้า git:** `.env*` (ignored แล้ว) · ไฟล์ที่ผู้ใช้อัปโหลดจริงใน `UPLOAD_DIR` · `*.tsbuildinfo` · `app/generated/prisma` · secret/token ทุกชนิด
   > 🔸 ของค้างที่ควรเก็บกวาดใน Phase 1: `cookies.txt` ถูก track อยู่ใน repo (ตรวจแล้วมีแต่ header ของ curl ไม่มีค่า cookie จริง จึงไม่ใช่ปัญหาความปลอดภัย) — ควร `git rm --cached cookies.txt` แล้วใส่ใน `.gitignore`
7. **ทุก API route ใหม่ต้องผ่าน NFR1–NFR3** ก่อนถือว่า commit ได้ — ตรวจ session, validate ด้วย `zod`, กรอง row-level ด้วย `ticketScopeWhere()`

### 16.6 การจัดการไฟล์ค้างใน working tree

เมื่อเจอไฟล์ที่แก้ค้างอยู่และ**ไม่แน่ใจว่าเป็นของใหม่หรือของเก่า** ห้ามทิ้งด้วย `git checkout -- <file>` ให้ทำตามนี้:

```bash
# 1) สำรอง patch ไว้นอก repo ก่อนเสมอ
git diff > <scratch>/pending-<เรื่อง>.patch

# 2) stash พร้อมข้อความอธิบาย (กู้คืนได้ตลอด)
git stash push -m "<อธิบายว่าเป็นอะไร>" <path...>

# 3) ยืนยันว่า working tree สะอาดแล้วจึงเริ่มงานเฟสใหม่
git status --porcelain
```

- กู้คืน: `git stash show -p stash@{0}` ดูก่อน แล้ว `git stash pop`
- ถ้าจะหยิบมาเฉพาะบางไฟล์: `git checkout stash@{0} -- <path>`
- **ตัวอย่างจริง (1 ก.ย. 2569, ก่อนเปิด Phase 1):** `stash@{0}` เก็บการแก้ค้าง 2 ไฟล์ — `app/api/line/webhook/route.ts` (ลบ guard ของ `LINE_CHANNEL_SECRET` และการตรวจ signature ว่าง → ถือเป็นการถอยด้าน security) และ `lib/rag-service.ts` (แก้ `SYSTEM_PROMPT`) ยังไม่ตัดสินใจว่าจะหยิบกลับหรือไม่

### 16.7 Cheat Sheet

```bash
# ── เปิดเฟส ────────────────────────────────────────────
git switch main && git pull
git status --porcelain                 # ต้องว่าง
git switch -c feat/itsm-phase-1 main

# ── ระหว่างทำ (เกตก่อน commit) ─────────────────────────
pnpm prisma validate                   # เมื่อแตะ schema
pnpm prisma generate
npx tsc --noEmit                       # ต้อง 0 error
pnpm lint app/api/tickets              # เฉพาะ path ที่แก้
git add -A && git commit               # ข้อความตาม §16.3

# ── migration กับ DB จริง (ห้าม reset) ─────────────────
pnpm prisma migrate diff \
  --from-config-datasource --to-schema prisma/schema.prisma --script > review.sql
grep -Ei 'drop|truncate' review.sql    # ต้องไม่พบ
pnpm prisma migrate deploy
npx tsx prisma/seed.ts                 # seed ยังไม่ได้ลงทะเบียนใน prisma.config.ts

# ── ปิดเฟส ────────────────────────────────────────────
pnpm build                             # G6 บังคับ
git log --oneline origin/main..main    # ดูว่าจะ push อะไร
git switch main
git merge --no-ff feat/itsm-phase-1 -m "Merge branch 'feat/itsm-phase-1' — ITSM Phase 1: Helpdesk + Priority"
git push origin main
```

---

*เอกสารนี้จัดทำจากการสัมภาษณ์เก็บ requirements 18 ข้อ เมื่อ 29 สิงหาคม 2569 — ทุกการแก้ไขไฟล์เดิมในตาราง M1–M13 ต้องแจ้งและได้รับความเห็นชอบก่อนลงมือทุกครั้ง*
