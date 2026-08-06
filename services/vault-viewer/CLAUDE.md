# CLAUDE.md — Hướng dẫn làm việc cho Claude Code trên dự án WebObsidian

## Bối cảnh
WebObsidian là web app self-hosted clone toàn diện Obsidian. Thiết kế chính thức nằm ở
[PRD.md](PRD.md). Tiến độ phát triển được track ở [IMPLEMENTATION_PLAN.md](IMPLEMENTATION_PLAN.md).

## Nguyên tắc bắt buộc (đọc trước mỗi phiên làm việc)

1. **Luôn bám sát PRD.md.** Trước khi code một tính năng, đối chiếu với phần FR/NFR/API/data
   model tương ứng trong PRD. Không tự ý đổi kiến trúc hay phạm vi. Nếu thấy cần lệch khỏi PRD,
   **cập nhật PRD.md trước** (ghi rõ lý do, tăng version/changelog) rồi mới code.

2. **Luôn cập nhật IMPLEMENTATION_PLAN.md.** Mỗi khi bắt đầu hoặc hoàn thành một mục:
   - Đổi checkbox: `[ ]` → `[~]` (đang làm) → `[x]` (xong).
   - Cập nhật dòng "Cập nhật lần cuối" và thêm dòng vào "Nhật ký tiến độ" (ngày + tóm tắt).
   - Một mục chỉ đánh `[x]` khi code chạy được/được kiểm chứng, không phải khi mới viết xong.

3. **Đồng bộ với todo list của session.** Todo nội bộ phải phản ánh các mục trong plan.

4. **Tài liệu là nguồn sự thật.** Khi phạm vi thay đổi theo yêu cầu người dùng: cập nhật PRD.md
   (thiết kế) và IMPLEMENTATION_PLAN.md (thêm/sửa mục) trong cùng lần thay đổi.

## Quy ước kỹ thuật
- Ngôn ngữ: TypeScript cho cả server và web. Tránh `any` khi có thể.
- Cấu hình runtime: chỉ dùng file JSON (`data/settings.json`) — không thêm DB engine.
- Bảo mật: không log secret/token/API key; hash trước khi lưu; guard path traversal.
- Commit/push git **chỉ khi người dùng yêu cầu**.

## Lệnh hữu ích
```bash
npm install            # cài deps toàn workspace
npm run dev            # chạy server + web (dev)
npm run build          # build web rồi server
npm run start          # chạy production (server serve web đã build)
npm run typecheck      # kiểm tra type cả 2 workspace
docker compose up      # chạy full stack
```

## Cấu trúc (xem PRD §2.2)
- `server/` — Express API (routes, services, middleware, plugins shim).
- `web/` — React SPA (components, lib, styles).
- `data/` — runtime config & index (gitignored).
- `docs/` — tài liệu bổ sung.
