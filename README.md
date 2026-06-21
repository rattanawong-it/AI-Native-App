# AI Native App

โปรเจกต์ Full-stack Web Application สร้างด้วย **Next.js 16** พร้อม TypeScript, Tailwind CSS v4 และ shadcn/ui — พัฒนาในหลักสูตร **Next.js 16: The AI-Native Developer Masterclass**

---

## Tech Stack

| เทคโนโลยี | เวอร์ชัน | หน้าที่ |
|-----------|---------|--------|
| [Next.js](https://nextjs.org) | 16.1.6 | Full-stack React Framework |
| [React](https://react.dev) | 19.2.3 | UI Library |
| [TypeScript](https://www.typescriptlang.org) | ^5 | Type Safety |
| [Tailwind CSS](https://tailwindcss.com) | ^4 | Utility-first CSS |
| [shadcn/ui](https://ui.shadcn.com) | ^4 | Component Library |
| [Radix UI](https://www.radix-ui.com) | ^1.4.3 | Accessible Primitives |
| [Lucide React](https://lucide.dev) | ^0.577.0 | Icon Library |
| [clsx](https://github.com/lukeed/clsx) + [tailwind-merge](https://github.com/dcastil/tailwind-merge) | latest | Class Name Utilities |
| [Prisma ORM](https://www.prisma.io) | ^7.5.0 | Type-safe ORM + Migrations |
| [Better Auth](https://www.better-auth.com) | (upcoming) | Authentication Library |

---

## Requirements

ก่อนเริ่มต้น ให้ตรวจสอบว่าติดตั้งเครื่องมือต่อไปนี้แล้ว:

- **Node.js** LTS version 20+
- **npm** (มากับ Node.js)
- **Git**
- **VS Code** (แนะนำ Extensions: ESLint, Prettier, Tailwind CSS IntelliSense)

ตรวจสอบเวอร์ชันด้วยคำสั่ง:

```bash
node --version
npm --version
git --version
```

---

## Getting Started

### 1. Clone โปรเจกต์

```bash
git clone <repository-url>
cd ai-native-app
```

### 2. ติดตั้ง Dependencies

```bash
npm install
```

### 3. ตั้งค่า Environment Variables

สร้างไฟล์ `.env` ที่ root ของโปรเจกต์:

```env
# Database (Neon PostgreSQL)
DATABASE_URL="postgresql://neondb_owner:password@ep-xxx-pooler.aws.neon.tech/neondb?sslmode=require&channel_binding=require"

# Better Auth (จะเพิ่มในขั้นตอนถัดไป)
# BETTER_AUTH_SECRET="your-secret-key"
# BETTER_AUTH_URL="http://localhost:3000"

# OAuth Providers (จะเพิ่มในขั้นตอนถัดไป)
# GOOGLE_CLIENT_ID=""
# GOOGLE_CLIENT_SECRET=""
# GITHUB_CLIENT_ID=""
# GITHUB_CLIENT_SECRET=""
```

### 4. รัน Development Server

```bash
npm run dev
```

เปิดเบราว์เซอร์ไปที่ [http://localhost:3000](http://localhost:3000)

---

## Available Scripts

```bash
npm run dev      # รัน development server
npm run build    # Build สำหรับ production
npm run start    # รัน production server
npm run lint     # ตรวจสอบ ESLint
```

## Prisma Commands

```bash
npx prisma generate          # Generate Prisma Client จาก schema
npx prisma migrate dev       # สร้าง migration + push ไปยัง Database
npx prisma migrate deploy    # Deploy migrations สำหรับ production
npx prisma db push           # Push schema โดยตรง (ไม่สร้าง migration file)
npx prisma studio            # เปิด Prisma Studio GUI
```

---

## Project Structure

```
ai-native-app/
├── app/
│   ├── layout.tsx                      ← Root Layout (html, body, fonts, globals.css)
│   ├── globals.css                     ← Design System (oklch, dark mode)
│   │
│   ├── (landing)/                      ← Route Group: Landing Page
│   │   ├── page.tsx                    ← Server Component + Metadata
│   │   ├── Navbar.tsx                  ← Client Component (dark mode toggle)
│   │   ├── Hero.tsx                    ← Hero section
│   │   ├── Features.tsx                ← Features cards
│   │   ├── About.tsx                   ← About section
│   │   ├── TechStack.tsx               ← Tech badges
│   │   ├── Team.tsx                    ← Team members
│   │   ├── Testimonial.tsx             ← Reviews
│   │   └── Footer.tsx                  ← Footer
│   │
│   ├── (auth)/auth/                    ← Route Group: Authentication
│   │   ├── layout.tsx                  ← Split-screen layout
│   │   ├── auth-branding.tsx           ← Animated branding
│   │   ├── signin/
│   │   │   ├── page.tsx                ← Sign In page
│   │   │   └── LoginForm.tsx           ← Sign In form component
│   │   ├── signup/
│   │   │   ├── page.tsx                ← Sign Up page
│   │   │   └── SignupForm.tsx          ← Sign Up form component
│   │   └── forgot-password/
│   │       ├── page.tsx                ← Forgot Password page
│   │       └── ForgotPasswordForm.tsx  ← Forgot Password form component
│   │
│   ├── (main)/                         ← Route Group: Authenticated Pages
│   │   ├── layout.tsx                  ← Shared header + navigation
│   │   └── dashboard/
│   │       ├── page.tsx                ← Dashboard page
│   │       ├── DashboardContent.tsx    ← Dashboard content component
│   │       └── SignOutButton.tsx       ← Sign Out button component
│   │
│   └── generated/prisma/               ← Prisma Client (auto-generated)
│
├── components/
│   └── ui/                             ← shadcn/ui components
│       ├── button.tsx
│       ├── card.tsx
│       ├── input.tsx
│       └── label.tsx
│
├── lib/
│   └── utils.ts                        ← cn() utility
│
├── prisma/
│   ├── schema.prisma                   ← Database Schema (Better Auth Core Schema)
│   └── migrations/                     ← Migration history
│
├── .env                                ← Environment Variables
├── next.config.ts                      ← Next.js Config
├── prisma.config.ts                    ← Prisma Config
└── package.json
```

> **Route Groups** `(landing)`, `(auth)`, `(main)` จะไม่ปรากฏใน URL — ใช้สำหรับจัดกลุ่ม routes และแยก layouts เท่านั้น

---

## Key Concepts

### Server Components vs Client Components

ใน App Router ทุก component เป็น **Server Component** โดย default ใช้ `"use client"` เมื่อต้องการ:

- `useState`, `useEffect`, `useRef` (React Hooks)
- Event handlers (`onClick`, `onChange`)
- Browser-only APIs (`window`, `document`)

```tsx
// Server Component (default) — ไม่ต้องประกาศ
export default async function Page() {
  const data = await fetch("https://api.example.com/data")
  return <div>...</div>
}

// Client Component — ต้องประกาศ
"use client"
import { useState } from "react"
export default function Counter() {
  const [count, setCount] = useState(0)
  return <button onClick={() => setCount(count + 1)}>{count}</button>
}
```

### shadcn/ui

shadcn/ui ไม่ใช่ library แบบดั้งเดิม — โค้ด component จะถูก **copy มาไว้ในโปรเจกต์โดยตรง** ทำให้แก้ไขได้เต็มที่

```bash
# เพิ่ม component ใหม่
npx shadcn@latest add <component-name>

# ตัวอย่าง
npx shadcn@latest add button card input label
```

---

## Database Schema

โปรเจกต์ใช้ **Better Auth Core Schema** บน PostgreSQL (Neon) ประกอบด้วย 4 ตารางหลัก:

| ตาราง | หน้าที่ |
|-------|--------|
| `user` | ข้อมูลผู้ใช้ (รองรับ `role`, `banned`) |
| `session` | Session management |
| `account` | OAuth accounts / Credential provider |
| `verification` | Email verification, Password reset tokens |

---

## Online Services

| บริการ | ลิงก์ | หน้าที่ |
|-------|------|--------|
| Neon | https://neon.tech | PostgreSQL Serverless Database |
| Better Auth | https://www.better-auth.com | Authentication Library |
| Google Cloud Console | https://console.cloud.google.com | Google OAuth |
| GitHub Settings | https://github.com/settings/developers | GitHub OAuth |
| LINE Developers | https://developers.line.biz | LINE Login |

---

## Learn More

- [Next.js Documentation](https://nextjs.org/docs)
- [App Router Guide](https://nextjs.org/docs/app)
- [React Server Components](https://react.dev/blog/2023/03/22/react-labs-what-we-have-been-working-on-march-2023)
- [shadcn/ui Documentation](https://ui.shadcn.com)
- [Tailwind CSS v4](https://tailwindcss.com/docs)
- [Better Auth Documentation](https://www.better-auth.com/docs)
- [Prisma Documentation](https://www.prisma.io/docs)
- [Neon Documentation](https://neon.tech/docs)

---

## Deploy on Vercel

วิธีที่ง่ายที่สุดในการ deploy คือใช้ [Vercel Platform](https://vercel.com/new) จากทีมผู้สร้าง Next.js

อย่าลืมตั้งค่า Environment Variables บน Vercel Dashboard ให้ครบก่อน deploy
