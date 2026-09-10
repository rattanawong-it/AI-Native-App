// scripts/extract-departments.mjs
// แปลงตารางรหัสงานสารบรรณจากไฟล์ .docx เป็นข้อมูลหน่วยงานที่นำเข้าฐานข้อมูลได้
//
//   node scripts/extract-departments.mjs
//
// ได้ผลลัพธ์ 2 ไฟล์ — commit ทั้งคู่เพื่อให้ตรวจทานและนำเข้าซ้ำได้โดยไม่ต้องมีไฟล์ Word
//   prisma/data/departments.json   อ่านง่าย ใช้ตรวจทานด้วยตา
//   prisma/data/departments.sql    ใช้นำเข้าจริง (ดูวิธีรันในหัวคอมเมนต์ของไฟล์นั้น)
//
// อ่าน .docx เอง (เป็นไฟล์ ZIP) ด้วย zlib ของ Node — ไม่เพิ่ม dependency ให้โปรเจกต์

import fs from "node:fs"
import path from "node:path"
import zlib from "node:zlib"

const DOCX = "docs/รหัสงานสารบรรณ เรียงจากไฟล์ของฝ่ายบัญชี  .docx"
const OUT = "prisma/data/departments.json"
const OUT_SQL = "prisma/data/departments.sql"

// ── อ่านไฟล์เดียวออกจาก ZIP ─────────────────────────────────────────────
// เดินจาก End of Central Directory → Central Directory → Local File Header
// รองรับเฉพาะ stored (0) กับ deflate (8) ซึ่งครอบคลุมทุกไฟล์ที่ Word สร้าง
function readZipEntry(buf, wanted) {
    // EOCD ลงท้ายด้วยลายเซ็น PK\x05\x06 — ไล่หาจากท้ายไฟล์เพราะ comment ต่อท้ายได้
    let eocd = -1
    for (let i = buf.length - 22; i >= 0; i--) {
        if (buf.readUInt32LE(i) === 0x06054b50) {
            eocd = i
            break
        }
    }
    if (eocd < 0) throw new Error("ไม่พบ End of Central Directory — ไฟล์อาจไม่ใช่ .docx")

    const count = buf.readUInt16LE(eocd + 10)
    let p = buf.readUInt32LE(eocd + 16)

    for (let i = 0; i < count; i++) {
        if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error("Central Directory เสียหาย")
        const method = buf.readUInt16LE(p + 10)
        const compSize = buf.readUInt32LE(p + 20)
        const nameLen = buf.readUInt16LE(p + 28)
        const extraLen = buf.readUInt16LE(p + 30)
        const commentLen = buf.readUInt16LE(p + 32)
        const localOffset = buf.readUInt32LE(p + 42)
        const name = buf.subarray(p + 46, p + 46 + nameLen).toString("utf8")

        if (name === wanted) {
            // Local File Header: ความยาว name/extra ตรงนี้ต่างจากใน Central Directory ได้
            const lNameLen = buf.readUInt16LE(localOffset + 26)
            const lExtraLen = buf.readUInt16LE(localOffset + 28)
            const start = localOffset + 30 + lNameLen + lExtraLen
            const raw = buf.subarray(start, start + compSize)
            return method === 0 ? raw : zlib.inflateRawSync(raw)
        }
        p += 46 + nameLen + extraLen + commentLen
    }
    throw new Error(`ไม่พบ ${wanted} ในไฟล์`)
}

// ── แกะตารางออกจาก WordprocessingML ─────────────────────────────────────
const CELL_RE = /<w:tc[ >][\s\S]*?<\/w:tc>/g
const ROW_RE = /<w:tr[ >][\s\S]*?<\/w:tr>/g
// ต้องเป็น <w:t> หรือ <w:t ...> เท่านั้น — ห้ามให้ <w:tcPr> เข้ามาด้วย
const TEXT_RE = /<w:t(?:\s[^>]*)?>([\s\S]*?)<\/w:t>/g

function decodeXml(s) {
    return s
        .replace(/&lt;/g, "<")
        .replace(/&gt;/g, ">")
        .replace(/&quot;/g, '"')
        .replace(/&apos;/g, "'")
        .replace(/&amp;/g, "&")
}

function cellText(cellXml) {
    const parts = []
    for (const m of cellXml.matchAll(TEXT_RE)) parts.push(m[1])
    return decodeXml(parts.join("")).trim()
}

function parseRows(xml) {
    const rows = []
    for (const tr of xml.match(ROW_RE) ?? []) {
        rows.push((tr.match(CELL_RE) ?? []).map(cellText))
    }
    return rows
}

// ── ประกอบข้อมูล ────────────────────────────────────────────────────────
function build(rows) {
    const departments = []
    let wrapped = 0

    for (const cells of rows) {
        const code = (cells[1] ?? "").trim()
        const name = (cells[2] ?? "").trim()

        if (/^\d{6}$/.test(code)) {
            departments.push({ code, name })
        } else if (name && departments.length > 0 && !/^ชื่อหน่วยงาน$/.test(name)) {
            // ชื่อหน่วยงานยาวจนตกไปอีกแถว — ต่อกลับเข้าแถวก่อนหน้า
            const prev = departments[departments.length - 1]
            prev.name = `${prev.name} ${name}`
            wrapped++
        }
    }

    for (const d of departments) d.name = d.name.replace(/\s+/g, " ").trim()

    // ระดับและหน่วยงานแม่อ่านจากรหัสโดยตรง: XX0000 › XXYY00 › XXYYZZ
    const byCode = new Map(departments.map((d) => [d.code, d]))
    for (const d of departments) {
        if (d.code.slice(2) === "0000") {
            d.level = 1
            d.parentCode = null
        } else if (d.code.slice(4) === "00") {
            d.level = 2
            d.parentCode = `${d.code.slice(0, 2)}0000`
        } else {
            d.level = 3
            d.parentCode = `${d.code.slice(0, 4)}00`
        }
        if (d.parentCode && !byCode.has(d.parentCode)) {
            throw new Error(`${d.code} "${d.name}" อ้างหน่วยงานแม่ ${d.parentCode} ที่ไม่มีในเอกสาร`)
        }
    }

    const codes = new Set(departments.map((d) => d.code))
    if (codes.size !== departments.length) throw new Error("พบรหัสหน่วยงานซ้ำในเอกสาร")
    const blank = departments.filter((d) => !d.name)
    if (blank.length > 0) throw new Error(`มี ${blank.length} แถวที่ไม่มีชื่อหน่วยงาน`)

    return { departments, wrapped }
}

// ── สร้าง SQL นำเข้าแบบรันซ้ำได้ ────────────────────────────────────────
const q = (s) => `'${s.replace(/'/g, "''")}'`

function buildSql(departments) {
    const values = departments
        .map(
            (d) =>
                `  (gen_random_uuid()::text, ${q(d.code)}, ${q(d.name)}, ${d.level}, true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
        )
        .join(",\n")

    const links = departments
        .filter((d) => d.parentCode)
        .map((d) => `  (${q(d.code)}, ${q(d.parentCode)})`)
        .join(",\n")

    return `-- prisma/data/departments.sql
-- ไฟล์นี้ถูกสร้างอัตโนมัติจาก scripts/extract-departments.mjs — อย่าแก้ด้วยมือ
-- ที่มา: docs/รหัสงานสารบรรณ เรียงจากไฟล์ของฝ่ายบัญชี  .docx (สรุป ณ 21 สิงหาคม 2569)
--
-- วิธีนำเข้า:
--   pnpm prisma db execute --file prisma/data/departments.sql
-- (prisma 7 อ่าน datasource จาก prisma.config.ts เอง จึงไม่ต้องใส่ --schema)
--
-- รันซ้ำได้ปลอดภัย (idempotent):
--   * ON CONFLICT DO NOTHING — ไม่เขียนทับชื่อที่ admin แก้ไว้ในหน้าจอแล้ว
--   * ไม่มี DROP / TRUNCATE / DELETE — ไม่แตะหน่วยงานที่ไม่ได้อยู่ในเอกสาร (เช่น OIT)
--   * การผูกหน่วยงานแม่เขียนเฉพาะแถวที่ค่ายังไม่ตรง

-- 1) เพิ่มหน่วยงานที่ยังไม่มี (${departments.length} รายการ)
INSERT INTO "department" ("id", "code", "name", "level", "active", "createdAt", "updatedAt")
VALUES
${values}
ON CONFLICT ("code") DO NOTHING;

-- 2) ผูกหน่วยงานแม่ตามรหัส (XXYYZZ -> XXYY00 -> XX0000)
UPDATE "department" AS c
SET "parentId" = p."id", "updatedAt" = CURRENT_TIMESTAMP
FROM (VALUES
${links}
) AS m(child, parent)
JOIN "department" AS p ON p."code" = m.parent
WHERE c."code" = m.child
  AND c."parentId" IS DISTINCT FROM p."id";
`
}

// ── main ────────────────────────────────────────────────────────────────
const buf = fs.readFileSync(DOCX)
const xml = readZipEntry(buf, "word/document.xml").toString("utf8")
const { departments, wrapped } = build(parseRows(xml))

fs.mkdirSync(path.dirname(OUT), { recursive: true })
fs.writeFileSync(OUT, `${JSON.stringify(departments, null, 2)}\n`, "utf8")
fs.writeFileSync(OUT_SQL, buildSql(departments), "utf8")

const counts = { 1: 0, 2: 0, 3: 0 }
for (const d of departments) counts[d.level]++
console.log(`เขียน ${OUT} แล้ว`)
console.log(`  หน่วยงานทั้งหมด ${departments.length} รายการ (ต่อชื่อที่ตกบรรทัด ${wrapped} แถว)`)
console.log(`  สำนัก/คณะ ${counts[1]} · ฝ่าย ${counts[2]} · งาน ${counts[3]}`)
