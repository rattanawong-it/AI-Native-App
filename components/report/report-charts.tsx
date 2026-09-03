"use client"

// components/report/report-charts.tsx
// กราฟที่ใช้ร่วมกันระหว่างหน้ารายงานสรุปและแดชบอร์ด (F7.21, F9.5)
//
// กติกาการใช้สีในไฟล์นี้ — อย่าข้าม:
//   1. สีอ่านจาก design token ใน app/globals.css ตรงๆ (`var(--chart-1)` ฯลฯ)
//      จึงสลับโหมดสว่าง/มืดได้เองโดยไม่ต้องคำนวณสีซ้ำในโค้ด
//   2. ลำดับสีเชิงหมวดหมู่ตายตัวคือ chart-1 → 3 → 4 → 5 → 2 (ดู CATEGORICAL)
//      **ห้ามสลับเป็น 1 → 2** เพราะ chart-1 (น้ำเงิน) กับ chart-2 (ม่วง) ต่างกันน้อยเกินไป
//      (ΔE ปกติ 11.0 · protan 4.1) คนตาปกติก็แยกยาก ลำดับนี้ผ่านเกณฑ์ทุกข้อแล้ว
//   3. มิติที่มีสีประจำตัวอยู่แล้ว (ความสำคัญ / สถานะ) ใช้สีของมันเอง ไม่ใช่ลำดับหมวดหมู่
//      — สีต้องผูกกับ "ตัวตน" ของข้อมูล ไม่ใช่ลำดับที่บังเอิญถูกวาด
//   4. ห้ามทำกราฟสองแกน Y — ถ้ามีสองหน่วยที่คนละสเกล ให้แยกเป็นสองกราฟ
//      (จำนวนใบกับ % SLA จึงอยู่คนละกราฟกันในหน้ารายงาน)

import {
    Bar,
    BarChart,
    CartesianGrid,
    Cell,
    Legend,
    Line,
    LineChart,
    ResponsiveContainer,
    Tooltip,
    XAxis,
    YAxis,
} from "recharts"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import type { CountGroup, TrendPoint } from "@/lib/report-types"
import { PRIORITY_LEVELS } from "@/lib/priority"
import { TICKET_STATUSES } from "@/lib/ticket-workflow"

/// ลำดับสีเชิงหมวดหมู่ที่ผ่านการตรวจแล้ว — ใช้เรียงตามลำดับนี้เสมอ ห้ามวนซ้ำ
export const CATEGORICAL = [
    "var(--chart-1)",
    "var(--chart-3)",
    "var(--chart-4)",
    "var(--chart-5)",
    "var(--chart-2)",
] as const

/// สีประจำระดับความสำคัญ — ตรงกับ Badge ที่ใช้ทั้งระบบ
const PRIORITY_COLOR: Record<string, string> = {
    critical: "var(--priority-critical)",
    high: "var(--priority-high)",
    medium: "var(--priority-medium)",
    low: "var(--priority-low)",
}

/// สีประจำสถานะ Ticket — ตรงกับ Badge ที่ใช้ทั้งระบบ
const STATUS_COLOR: Record<string, string> = {
    new: "var(--status-new)",
    assigned: "var(--status-assigned)",
    in_progress: "var(--status-progress)",
    resolved: "var(--status-resolved)",
    closed: "var(--status-closed)",
}

/// มิติที่มีสีประจำตัว — นอกเหนือจากนี้ใช้ลำดับสีเชิงหมวดหมู่
export type ColorScheme = "categorical" | "priority" | "status"

function colorOf(scheme: ColorScheme, key: string, index: number): string {
    if (scheme === "priority" && PRIORITY_COLOR[key]) return PRIORITY_COLOR[key]
    if (scheme === "status" && STATUS_COLOR[key]) return STATUS_COLOR[key]
    // เกินจำนวนสีที่มี = ไม่สร้างสีใหม่ ให้ย้อนกลับไปสีสุดท้ายของลำดับ
    return CATEGORICAL[Math.min(index, CATEGORICAL.length - 1)]
}

/// เรียงกลุ่มตามลำดับความหมายของมิตินั้น (วิกฤต → ต่ำ, แจ้งใหม่ → ปิดงาน)
function semanticOrder(scheme: ColorScheme): readonly string[] | null {
    if (scheme === "priority") return PRIORITY_LEVELS
    if (scheme === "status") return TICKET_STATUSES
    return null
}

// ── ชิ้นส่วนที่ใช้ซ้ำ ─────────────────────────────────────────────────

const AXIS_PROPS = {
    stroke: "var(--muted-foreground)",
    fontSize: 12,
    tickLine: false,
    axisLine: false,
} as const

function ChartFrame({
    title,
    hint,
    children,
    empty,
}: {
    title: string
    hint?: string
    children: React.ReactNode
    empty: boolean
}) {
    return (
        <Card className="overflow-hidden py-0">
            <CardHeader className="bg-muted/40 border-b py-3">
                <p className="font-medium">{title}</p>
                {hint && <p className="text-muted-foreground mt-0.5 text-xs">{hint}</p>}
            </CardHeader>
            <CardContent className="p-4">
                {empty ? (
                    <p className="text-muted-foreground py-12 text-center text-sm">
                        ไม่มีข้อมูลในช่วงที่เลือก
                    </p>
                ) : (
                    children
                )}
            </CardContent>
        </Card>
    )
}

/// รูปร่างของแถวที่ recharts ส่งเข้า tooltip — ประกาศเองเพราะ generic ของ recharts ใช้ยากเกินจำเป็น
interface TooltipEntry {
    name?: string
    value?: number | string | null
    color?: string
    payload?: Record<string, unknown>
}

function TooltipBox({
    label,
    entries,
    suffix,
}: {
    label?: string
    entries: readonly TooltipEntry[]
    suffix?: string
}) {
    return (
        <div className="bg-popover text-popover-foreground rounded-md border px-3 py-2 text-xs shadow-md">
            {label && <p className="mb-1 font-medium">{label}</p>}
            {entries.map((e, i) => (
                <p key={i} className="flex items-center gap-1.5">
                    <span
                        className="inline-block size-2 rounded-full"
                        style={{ backgroundColor: e.color }}
                    />
                    <span className="text-muted-foreground">{e.name}</span>
                    <span className="ml-auto font-medium">
                        {e.value === null || e.value === undefined ? "—" : e.value}
                        {suffix ?? ""}
                    </span>
                </p>
            ))}
        </div>
    )
}

// ── ① แนวโน้มจำนวนใบ (F7.21, F9.5) ───────────────────────────────────

/// รับเข้า vs แก้ไขแล้ว — สองเส้นหน่วยเดียวกัน จึงอยู่กราฟเดียวกันได้
export function TicketTrendChart({
    points,
    granularity,
    height = 260,
}: {
    points: TrendPoint[]
    granularity: "day" | "month"
    height?: number
}) {
    return (
        <ChartFrame
            title="แนวโน้ม Ticket"
            hint={granularity === "day" ? "รายวัน" : "รายเดือน"}
            empty={points.length === 0}
        >
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" {...AXIS_PROPS} />
                    <YAxis allowDecimals={false} {...AXIS_PROPS} />
                    <Tooltip
                        content={({ active, payload, label }) =>
                            active && payload?.length ? (
                                <TooltipBox
                                    label={String(label)}
                                    entries={payload as readonly TooltipEntry[]}
                                    suffix=" ใบ"
                                />
                            ) : null
                        }
                    />
                    <Legend iconType="plainline" wrapperStyle={{ fontSize: 12 }} />
                    <Line
                        type="monotone"
                        dataKey="created"
                        name="รับเข้า"
                        stroke={CATEGORICAL[0]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                    />
                    <Line
                        type="monotone"
                        dataKey="resolved"
                        name="แก้ไขแล้ว"
                        stroke={CATEGORICAL[1]}
                        strokeWidth={2}
                        dot={false}
                        activeDot={{ r: 5 }}
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartFrame>
    )
}

// ── ② แนวโน้ม % SLA — แยกกราฟเพราะคนละหน่วย (ห้ามสองแกน Y) ───────────

export function SlaTrendChart({
    points,
    height = 220,
}: {
    points: TrendPoint[]
    height?: number
}) {
    const measured = points.filter((p) => p.slaRate !== null)

    return (
        <ChartFrame
            title="แนวโน้ม % แก้ไขตรงตาม SLA"
            hint="นับเฉพาะใบที่รู้ผลแล้ว — ช่วงที่ยังไม่มีใบรู้ผลจะไม่มีจุด"
            empty={measured.length === 0}
        >
            <ResponsiveContainer width="100%" height={height}>
                <LineChart data={points} margin={{ top: 8, right: 12, bottom: 0, left: -16 }}>
                    <CartesianGrid stroke="var(--border)" strokeDasharray="3 3" vertical={false} />
                    <XAxis dataKey="label" {...AXIS_PROPS} />
                    <YAxis domain={[0, 100]} unit="%" {...AXIS_PROPS} />
                    <Tooltip
                        content={({ active, payload, label }) =>
                            active && payload?.length ? (
                                <TooltipBox
                                    label={String(label)}
                                    entries={payload as readonly TooltipEntry[]}
                                    suffix="%"
                                />
                            ) : null
                        }
                    />
                    <Line
                        type="monotone"
                        dataKey="slaRate"
                        name="แก้ไขตรงเวลา"
                        stroke="var(--sla-ontime)"
                        strokeWidth={2}
                        dot={{ r: 4 }}
                        connectNulls
                    />
                </LineChart>
            </ResponsiveContainer>
        </ChartFrame>
    )
}

// ── ③ สัดส่วนตามมิติ — แท่งแนวนอนอ่านชื่อไทยยาวๆ ได้ดีกว่าวงกลม ────

export function GroupBarChart({
    title,
    hint,
    groups,
    scheme = "categorical",
    max = 8,
    height,
}: {
    title: string
    hint?: string
    groups: CountGroup[]
    scheme?: ColorScheme
    /// แสดงกี่กลุ่มบนกราฟ — ที่เหลือถูกยุบเป็น "อื่นๆ" แทนการสร้างสีใหม่ไปเรื่อยๆ
    max?: number
    height?: number
}) {
    const order = semanticOrder(scheme)

    const sorted = order
        ? [...groups].sort((a, b) => order.indexOf(a.key) - order.indexOf(b.key))
        : [...groups].sort((a, b) => b.count - a.count)

    const shown = order || sorted.length <= max ? sorted : sorted.slice(0, max)
    const rest = order || sorted.length <= max ? [] : sorted.slice(max)
    const data =
        rest.length > 0
            ? [
                  ...shown,
                  {
                      key: "__other",
                      label: `อื่นๆ (${rest.length} กลุ่ม)`,
                      count: rest.reduce((sum, g) => sum + g.count, 0),
                  },
              ]
            : shown

    return (
        <ChartFrame title={title} hint={hint} empty={data.length === 0}>
            <ResponsiveContainer width="100%" height={height ?? Math.max(160, data.length * 38)}>
                <BarChart
                    data={data}
                    layout="vertical"
                    margin={{ top: 4, right: 32, bottom: 4, left: 8 }}
                    barCategoryGap={6}
                >
                    <CartesianGrid
                        stroke="var(--border)"
                        strokeDasharray="3 3"
                        horizontal={false}
                    />
                    <XAxis type="number" allowDecimals={false} {...AXIS_PROPS} />
                    <YAxis
                        type="category"
                        dataKey="label"
                        width={140}
                        interval={0}
                        {...AXIS_PROPS}
                    />
                    <Tooltip
                        cursor={{ fill: "var(--muted)" }}
                        content={({ active, payload }) =>
                            active && payload?.length ? (
                                <TooltipBox
                                    label={String(payload[0]?.payload?.label ?? "")}
                                    entries={[
                                        {
                                            name: "จำนวน",
                                            value: payload[0]?.value as number,
                                            color: payload[0]?.color,
                                        },
                                    ]}
                                    suffix=" ใบ"
                                />
                            ) : null
                        }
                    />
                    <Bar dataKey="count" name="จำนวน" radius={[0, 4, 4, 0]} maxBarSize={22}>
                        {data.map((g, i) => (
                            <Cell key={g.key} fill={colorOf(scheme, g.key, i)} />
                        ))}
                    </Bar>
                </BarChart>
            </ResponsiveContainer>
        </ChartFrame>
    )
}
