import { Metadata } from "next"
import KbArticleContent from "@/app/(main)/service/kb/[slug]/KbArticleContent"

export const metadata: Metadata = {
    title: "บทความคลังความรู้",
    description: "อ่านบทความวิธีแก้ปัญหาและคู่มือการใช้งานจากคลังความรู้ของศูนย์ไอที",
    keywords: ["Knowledge Base", "คลังความรู้", "บทความ", "ศูนย์ไอที"],
}

export default async function KbArticlePage({
    params,
}: {
    params: Promise<{ slug: string }>
}) {
    const { slug } = await params
    return <KbArticleContent slugOrId={slug} />
}
