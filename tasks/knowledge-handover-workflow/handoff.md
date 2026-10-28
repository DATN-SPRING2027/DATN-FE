# Bàn giao Frontend — Knowledge Handover Workflow

- **Checkout (Worktree cô lập)**: `F:/LEARN KÌ 8/ĐATN/DATN_FE-handover-workflow`
- **Branch**: `feat/Thang-knowledge-handover-workflow-fe-ui`
- **Base `main`**: `ec95852` (rebased onto latest `origin/main`, bao gồm PR #100 AI Chat UI)
- **Push & PR Authorization**: Thang đã chỉ thị rõ ràng `"push lên tạo pr"` ngày `2026-10-29`.
- **Checkout `DATN_FE` gốc (AI Chat)**: giữ nguyên trạng thái, không động chạm.

## 1. Phạm vi thay đổi

1. **Data Layer & Concurrency Contracts (`src/lib/queries/handovers/`)**:
   - `handover.types.ts`, `handover.service.ts`, `useHandovers.ts` (xuất qua `src/lib/queries/index.ts`).
   - Hỗ trợ đầy đủ 28 operations của BE thông qua BFF proxy `/api/backend` với `ETag`, `If-Match`, `Idempotency-Key`, `Idempotency-Replayed` và CSRF header `X-CSRF-Token`.
2. **Project Navigation & i18n**:
   - Thêm mục điều hướng `Handover` (`HandShakeIcon`) vào `src/layout/AppSidebar.tsx` và liên kết nhanh trên `src/components/projects/ProjectOverview.tsx`.
   - Khai báo đầy đủ i18n namespace `handover.*` trong `src/messages/en.json` (không hardcode chuỗi UI).
3. **B2B Workspace Routes & Components (`src/components/handover/*` & `src/app/[locale]/(admin)/projects/[projectId]/handover/**`)**:
   - `HandoverListWorkspace.tsx` + `CreateHandoverModal.tsx`: KPI strip chuẩn `tabular-nums`, bộ lọc đa tiêu chí, tạo bàn giao khi chưa có người nhận `B`, bảng dữ liệu Desktop (`>= 1024px`) và lưới thẻ Mobile/Tablet (`375px` / `768px`).
   - `HandoverDetailWorkspace.tsx` + các panel chuyên biệt (`HandoverDraftEditor`, `HandoverPublishModal`, `HandoverPublishedView`, `HandoverTaskTransfersPanel`, `HandoverQaPanel`, `HandoverFollowUpsPanel`):
     - Fail-closed ACL cho item `UNAVAILABLE` (chỉ hiện thẻ hạn chế quyền, không lộ tiêu đề/tóm tắt/nguồn).
     - Cảnh báo nguồn cập nhật sau snapshot (`UPDATED_SINCE_SNAPSHOT` / `CHANGED`).
     - Luồng AI có kiểm soát (`SOURCE_PROPOSAL`, `GENERATION`, retry/manual fallback khi lỗi hoặc `SUPERSEDED`) và Cited Q&A trích dẫn nguồn thật.
     - Chuyển giao Task chủ động sau khi `B` nhận gói + đối soát fence `PENDING | UNKNOWN`.
     - Xác nhận hiểu theo từng item, nộp/duyệt minh chứng HTTPS-only, ngoại lệ mục không bắt buộc, và theo dõi follow-up độc lập sau khi hoàn tất bàn giao.
     - Giao diện khôi phục điều phối viên an toàn cho Org Manager khi gặp `403` trên dự án `PRIVATE` (`A16`).

## 2. Kết quả kiểm tra & 6-Phase Visual QA

- `npm run check`: **PASS**
  - `eslint .`: `0` errors, `0` warnings
  - `tsc --noEmit`: `0` errors
  - `vitest run`: `139/139` test files pass (`945/945` tests pass, bao gồm 15 tests mới cho Handover)
  - `next build`: thành công (`56/56` static pages + dynamic Handover routes)
- **Live 6-Phase Browser Visual QA (`375px`, `768px`, `1280px`, `1440px`, Light & Dark)**:
  - Đã kiểm tra thực tế trên trình duyệt kết nối chuỗi thật `Next.js FE (3100) -> NestJS BE + MongoDB 7 (3101) -> FastAPI SAG (8011)`.
  - Phát hiện và sửa triệt để trong vòng lặp Before/After:
    1. Chuyển breakpoint bảng danh sách từ `md` sang `lg` để Tablet `768px` hiển thị lưới 2 cột cân đối, không bị ngắt chữ giữa từ và giữ nút `Open workspace` trên 1 dòng (`whitespace-nowrap`).
    2. Cập nhật thẻ KPI `Completion gate` và ẩn tab `Draft & AI Assist` khi bàn giao đã `COMPLETED` / `CANCELLED` để phản ánh đúng trạng thái bất biến.
    3. Hiển thị huy hiệu `Receipt Confirmed` ngay sau khi `B` xác nhận nhận gói và chuẩn hóa nhãn `Departing (A) / Coordinator (D)` không lặp dấu hai chấm.
  - Kết quả cuối: **`0` console errors, `0` hydration warnings, `0` JS exceptions, `0` unexpected failed network requests, `0` horizontal overflow**.

## 3. Lệnh push cho Thang

```powershell
Set-Location -LiteralPath 'F:\LEARN KÌ 8\ĐATN\DATN_FE-handover-workflow'
git status --short
git log -1 --stat
git push -u origin feat/Thang-knowledge-handover-workflow-fe-ui
```

