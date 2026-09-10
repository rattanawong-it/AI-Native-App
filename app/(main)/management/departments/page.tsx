import { Metadata } from "next"
import DepartmentsContent from "@/app/(main)/management/departments/DepartmentsContent"

export const metadata: Metadata = {
    title: "หน่วยงาน",
    description: "ทะเบียนหน่วยงานตามรหัสงานสารบรรณ — เพิ่ม แก้ไข และปิดใช้งานหน่วยงาน",
    keywords: ["หน่วยงาน", "รหัสงานสารบรรณ", "โครงสร้างองค์กร", "ศูนย์ไอที"],
}

export default function DepartmentsPage() {
    return <DepartmentsContent />
}
