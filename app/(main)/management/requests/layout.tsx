// app/(main)/management/requests/layout.tsx
// วางตัวแสดง toast ไว้เฉพาะกลุ่มหน้าคำขออนุมัติ — แบบเดียวกับ assets/ และ reports/

import { Toaster } from "@/components/ui/sonner"

export default function RequestsLayout({ children }: { children: React.ReactNode }) {
    return (
        <>
            {children}
            <Toaster position="top-right" richColors closeButton />
        </>
    )
}
