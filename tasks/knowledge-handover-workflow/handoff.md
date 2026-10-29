# Bàn giao Frontend — Knowledge Handover Workflow

- **Checkout (Worktree cô lập)**: `F:/LEARN KÌ 8/ĐATN/DATN_FE-handover-workflow`
- **Branch**: `feat/Thang-knowledge-handover-workflow-fe-ui`
- **Base `main`**: `ec95852` (rebased onto latest `origin/main`, bao gồm PR #100 AI Chat UI)
- **Push & PR Authorization**: Thang đã chỉ thị rõ ràng `"push lên tạo pr"`, `"xem pr này đúng không, nếu đúng thì fix rồi push lên pr"` và `"Xác nhận. hãy làm đi rồi push lên pr"` ngày `2026-10-29`.
- **Checkout `DATN_FE` gốc (AI Chat)**: giữ nguyên trạng thái, không động chạm.

## 1. Phạm vi thay đổi

1. **Data Layer & Concurrency Contracts (`src/lib/queries/handovers/`)**:
   - `handover.types.ts`, `handover.service.ts`, `useHandovers.ts` (xuất qua `src/lib/queries/index.ts`).
   - Hỗ trợ đầy đủ 28 operations của BE thông qua BFF proxy `/api/backend` với `ETag`, `If-Match`, `Idempotency-Key`, `Idempotency-Replayed` và CSRF header `X-CSRF-Token`.
   - **Review Fix (`F09`)**: `useCommandIdempotencyKey` trong `useHandovers.ts` (và `coordIdemRef` trong `HandoverListWorkspace.tsx`) giữ ổn định `Idempotency-Key` theo đúng canonical command intent qua các lần retry khi lỗi mạng/timeout, chỉ xoay key khi thay đổi intent hoặc sau khi thành công; `askHandoverQuestion` là read-only nên không gắn `Idempotency-Key`.
2. **Project Navigation & i18n**:
   - Thêm mục điều hướng `Handover` (`HandShakeIcon`) vào `src/layout/AppSidebar.tsx` và liên kết nhanh trên `src/components/projects/ProjectOverview.tsx`.
   - Khai báo đầy đủ i18n namespace `handover.*` trong `src/messages/en.json` (bao gồm các khóa citation provenance và `detail.expectedVersionLabel`, không hardcode chuỗi UI).
3. **B2B Workspace Routes & Components (`src/components/handover/*` & `src/app/[locale]/(admin)/projects/[projectId]/handover/**`)**:
   - `HandoverListWorkspace.tsx` + `CreateHandoverModal.tsx` + `HandoverDialogShell.tsx` + `HandoverMemberSelect.tsx`:
     - KPI strip chuẩn `tabular-nums`, bộ lọc đa tiêu chí, bảng dữ liệu Desktop (`>= 1024px`) và lưới thẻ Mobile/Tablet (`375px` / `768px`).
     - **Nâng cấp UI/UX Pro-Max cho `CreateHandoverModal`**:
       - Dialog shell chuẩn WAI-ARIA (`role="dialog"`, `aria-modal="true"`, `aria-labelledby`, `aria-describedby`, bẫy tiêu điểm `Tab`/`Shift+Tab`, `CloseLineIcon` từ `@/icons`, nền mờ tinh tế `backdrop-blur-xs`, khung `max-w-2xl` sắc nét).
       - Combobox chọn thành viên tùy biến (`HandoverMemberSelect`) hiển thị Avatar tròn (`rounded-full`), họ tên + email phụ, tìm kiếm nhanh và huy hiệu trạng thái/vai trò (`Active`, `Departed`, `<RoleLabel roleCode="TEAM_LEADER" />`, `You`) — triệt tiêu hoàn toàn lỗi cắt chữ của `<select>` gốc.
       - Hỗ trợ đầy đủ kịch bản `A01` / `A02`: tải cả thành viên `ACTIVE` lẫn `INACTIVE` (đã rời dự án) cho `Departing member (A)` và hiển thị tên đầy đủ trên danh sách/chi tiết, trong khi chỉ cho phép thành viên `ACTIVE` ở `Successor (B)` và `Coordinator (D)`.
       - Tích hợp `useProjectLeadersQuery` xác thực `Verified Project Leader` cho `Coordinator (D)`.
       - Sơ đồ luồng vai trò `Departing (A) → Coordinator (D) → Successor (B)`, bộ đếm ký tự tiêu đề `0 / 200` (`tabular-nums`), chip chọn nhanh `+7d / +14d / +30d` kèm preview ngày UTC tường minh (`Due Nov 12, 2026 (UTC) · in 14d`).
   - `HandoverDetailWorkspace.tsx` + các panel chuyên biệt (`HandoverDraftEditor`, `HandoverPublishModal`, `HandoverQaPanel`, `HandoverPublishedView`, `HandoverTaskTransfersPanel`, `HandoverFollowUpsPanel`):
     - **Review Fix (`F07`)**: `HandoverPublishModal.tsx` dùng trực tiếp `d.contentVersion` do server trả về trong `DraftItemDto` thay vì tự cộng `prev.contentVersion + 1`, đảm bảo publish thành công kể cả khi draft được sửa nhiều lần trước khi phát hành.
     - **Review Fix (`F08`)**: `HandoverDraftEditor.tsx` bảo toàn nguyên vẹn toàn bộ `item.citations` (`CHUNK`, `PAGE`, `LINE`, `SECTION` và nhiều trích dẫn trên cùng nguồn) khi không sửa trích dẫn; bổ sung trình chỉnh sửa trích dẫn tường minh từng dòng và không tự bịa `"Overview"` cho nguồn mới được gắn (yêu cầu nhập locator thực trước khi lưu).
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
  - `vitest run`: `142/142` test files pass (`962/962` tests pass, bao gồm `handover.service.spec.ts`, `useHandovers.spec.tsx`, `HandoverListWorkspace.spec.tsx`, `HandoverDetailWorkspace.spec.tsx`)
  - `next build`: thành công (`56/56` static pages + dynamic Handover routes)
- **Live 6-Phase Browser Visual QA (`375px`, `768px`, `1280px`, `1440px`, Light & Dark)**:
  - Đã kiểm tra thực tế trên trình duyệt kết nối chuỗi thật `Next.js FE (3100) -> NestJS BE + MongoDB 7 (3101) -> FastAPI SAG (8011)`.
  - Kết quả: **`0` console errors, `0` hydration warnings, `0` JS exceptions, `0` unexpected failed network requests, `0` horizontal overflow**.

## 3. Lệnh kiểm tra / push

```powershell
Set-Location -LiteralPath 'F:\LEARN KÌ 8\ĐATN\DATN_FE-handover-workflow'
git status --short
git log -2 --stat
git push origin feat/Thang-knowledge-handover-workflow-fe-ui
```
