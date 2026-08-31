repo: rattanawong-it/AI-Native-App
branch: main
path: app/(main)

## Last sync
date: 2026-08-30T08:20:00Z

### Updated in this project
- Rebuilt the app shell (sidebar + header) to match `_components/sidebar` and `_components/header` exactly: w-64 sidebar, h-14 bars, collapsible nav sections with ChevronUp, `bg-accent` active state, bottom Help nav.
- Aligned all page primitives to source: `space-y-6` page stack, `text-2xl font-bold tracking-tight` headers, shadcn `Card` geometry (rounded-xl, ring-1, py-6, gap-6, px-6 slots), stat cards with `p-3 rounded-xl` icon tiles.
- Rebuilt ตั้งค่าระบบ from `admin/settings/SettingContent.tsx`: 256px left tab nav, section header with icon, `space-y-5` card stack, ToggleRow / StatusBadge / SettingField / setting-input replicas.
- Tables now follow `UsersManagement.tsx`: plain rounded-xl bordered container, `bg-muted/50` head, per-row borders, horizontal scroll instead of column collision.

## Screen map
| Screen (ITSM Hi-Fi Screens.dc.html) | Built from |
| --- | --- |
| App shell (sidebar, header) | `app/(main)/layout.tsx`, `_components/sidebar/*`, `_components/header/header.tsx` |
| แดชบอร์ด | `app/(main)/dashboard/DashboardContent.tsx` |
| Ticket ทั้งหมด / รายละเอียด Ticket | `app/(main)/management/projects/ProjectContent.tsx`, `admin/users/UsersManagement.tsx` |
| แจ้งปัญหาใหม่ | `admin/settings/SettingContent.tsx` (SettingField / setting-input) |
| My Work, บอร์ดงานพัฒนา | `management/projects/ProjectContent.tsx` |
| Knowledge Base | `admin/knowledge/KnowledgeBase.tsx` |
| ครุภัณฑ์ IT, คำขออนุมัติ, รายงาน | `admin/users/UsersManagement.tsx` (table), `management/lead/LeadContent.tsx` (stats) |
| ตั้งค่าระบบ | `admin/settings/SettingContent.tsx` |
| ช่วยเหลือ | `app/(main)/help/HelpContent.tsx` |

## Notes
Brand colors are intentionally the OIT navy/gold palette instead of the source's blue/purple; all geometry, spacing, type scale and component structure follow the repo.
