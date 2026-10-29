# Module "Auto Post" – tích hợp vào trang quản trị website bán hàng

## 1. Mục tiêu
Thêm vào trang quản trị một module cho phép:
- Đăng video lên **kênh YouTube** của chủ shop.
- Đăng bài (văn bản, ảnh, video) lên **Fanpage Facebook** của chủ shop.
- Dùng AI (Claude API) soạn tiêu đề, mô tả, caption, hashtag từ nội dung chính hoặc từ sản phẩm trong website.
- Lên lịch đăng, duyệt trước khi đăng, xem lịch sử và trạng thái.
- (Giai đoạn sau) Tự tạo video từ nội dung: kịch bản, giọng đọc, ghép ảnh/video, bằng ffmpeg.

**Ngoài phạm vi (cố ý):** không tự động đăng vào Group Facebook. Facebook đã ngừng Groups API (4/2024); dùng automation trình duyệt vi phạm điều khoản và có nguy cơ khóa tài khoản. Với Group, module chỉ **soạn sẵn nội dung theo từng nhóm** để người dùng tự đăng (xem mục 5.4).

## 2. Vị trí trong trang quản trị
Thêm mục menu **"Truyền thông / Auto Post"** gồm các trang:
1. **Kết nối tài khoản** – nút "Kết nối YouTube", "Kết nối Fanpage", hiển thị trạng thái token (còn hạn / hết hạn).
2. **Tạo bài đăng** – nhập chủ đề hoặc chọn sản phẩm, tải video/ảnh, bấm "AI soạn nội dung", chỉnh sửa, chọn nền tảng (YouTube / Fanpage / cả hai), chọn giờ đăng.
3. **Hàng đợi & lịch** – danh sách bài chờ duyệt, đã lên lịch, đang đăng, thất bại. Có nút Duyệt, Sửa, Hủy, Đăng lại.
4. **Lịch sử** – bài đã đăng, link bài, số liệu cơ bản (nếu API trả về).
5. **Soạn bài cho Group** – chọn sản phẩm, AI tạo các biến thể nội dung, nút "Sao chép" để đăng thủ công.
6. **Cài đặt** – API key Claude, khung giờ đăng mặc định, bật/tắt bước duyệt, kênh nhận thông báo (email/Telegram).

## 3. Kiến trúc
```
Admin UI (website hiện có)
   └─ gọi REST API nội bộ của module
         ├─ Content Service   : gọi Claude API soạn nội dung
         ├─ Publisher Service : YouTube Data API v3 + Facebook Graph API
         ├─ Scheduler/Worker  : quét hàng đợi, đến giờ thì đăng, retry khi lỗi
         ├─ Video Service     : (giai đoạn 2) TTS + ffmpeg
         └─ Storage           : DB + thư mục lưu file media
```
Worker chạy tiến trình nền riêng (cron hoặc queue) để việc đăng không phụ thuộc request của người dùng.
Module nên là một service/thư viện độc lập; website chỉ cần gọi API và hiển thị giao diện. Stack website PSVIET.COM: Python (`server.py`, `http.server` thư viện chuẩn), không có DB, dữ liệu trong `website/data.js`, trang quản trị `admin.html` + `admin.js`. Cách ghép module vào stack này xem mục 10.

## 4. Mô hình dữ liệu
**social_accounts**
- id, platform (`youtube` | `facebook_page`), account_name, external_id (channel_id / page_id), access_token (mã hóa), refresh_token (mã hóa), expires_at, status, created_at

**posts**
- id, title, description/caption, hashtags, product_id (nullable, liên kết sản phẩm), media_path, media_type (`video` | `image` | `none`), platforms (danh sách), status (`draft` | `pending_approval` | `scheduled` | `publishing` | `published` | `failed` | `cancelled`), scheduled_at, approved_by, created_by, created_at

**post_results**
- id, post_id, platform, external_post_id, url, status, error_message, retry_count, published_at

**group_drafts**
- id, product_id, group_name, content, created_at

**settings**
- key/value: claude_api_key (mã hóa), default_times, require_approval, notify_channel…

## 5. Luồng chức năng

### 5.1 Kết nối tài khoản (OAuth)
- **YouTube:** OAuth 2.0 (Google), scope `youtube.upload`. Lưu refresh_token, tự làm mới access_token.
- **Facebook Page:** Facebook Login, quyền `pages_manage_posts`, `pages_manage_engagement`, `pages_read_engagement`, `pages_read_user_engagement`, `pages_show_list`; thêm `publish_video` nếu đăng video. Người kết nối phải có quyền tạo nội dung (CREATE_CONTENT) trên Page. Đổi sang **Page Access Token dài hạn**. Chủ app là admin của Page nên chạy được ở chế độ Development mà chưa cần App Review.
- Token mã hóa khi lưu; không trả token ra giao diện.

### 5.2 Soạn nội dung bằng AI
- Đầu vào: chủ đề / ý chính / sản phẩm (tên, mô tả, giá, link).
- Đầu ra: tiêu đề YouTube (≤100 ký tự), mô tả (≤5000), tags; caption Facebook; hashtag.
- Prompt có sẵn giọng điệu thương hiệu (cấu hình trong Cài đặt). Người dùng luôn xem và sửa được trước khi duyệt.

### 5.3 Đăng bài
- **YouTube:** `videos.insert` (upload resumable), đặt `privacyStatus`, `categoryId`, thumbnail tùy chọn.
  Lưu ý quota (cập nhật 10/2026): từ 4/12/2025 mỗi lần upload tốn khoảng 100 đơn vị (trước là 1.600). Từ 1/6/2026 `videos.insert` có **hạn mức riêng**, không còn dùng chung 10.000 đơn vị/ngày; xem hạn mức thực tế trong Google Cloud Console. Với shop đăng vài video/ngày thì quota không còn là giới hạn.
  **Quan trọng:** project API tạo sau 28/7/2020 mà chưa qua audit của Google thì mọi video upload qua API bị khóa ở chế độ riêng tư, kể cả khi gửi `public`, và không mở lại được. Phải xin audit trước khi bật đăng YouTube thật.
- **Fanpage:** `POST /{page-id}/feed` (văn bản + link), `/photos`, `/videos`, `/video_reels` (Reels: tối đa 30 bài/24 giờ qua API, nên dùng mp4 dọc 9:16). Graph API hiện dùng v26.0.
  Lên lịch: `published=false` + `scheduled_publish_time` trong khoảng **10 phút đến 30 ngày** sau lúc gửi. Ngoài khoảng này thì để worker tự đăng đúng giờ.
- Retry tối đa 3 lần với backoff; lỗi token thì chuyển trạng thái tài khoản sang "cần kết nối lại" và thông báo.

### 5.4 Nội dung cho Group (thủ công)
- AI tạo 3–5 biến thể nội dung bán hàng cho cùng một sản phẩm, tránh trùng lặp giữa các nhóm.
- Có nhắc nhở: đọc nội quy từng nhóm, giãn cách thời gian đăng, không spam.

### 5.5 Tạo video tự động (giai đoạn 2)
- Đầu vào: nội dung chính. AI viết kịch bản theo cảnh, tạo giọng đọc (TTS), ghép ảnh/video stock/ảnh sản phẩm bằng ffmpeg, thêm phụ đề.
- Đầu ra là video dạng slideshow có thuyết minh. Video sinh hoàn toàn bằng AI cần dịch vụ ngoài và tính phí theo video.

## 6. API nội bộ (gợi ý)
| Method | Đường dẫn | Mô tả |
|---|---|---|
| GET | `/api/autopost/accounts` | Danh sách tài khoản và trạng thái |
| GET | `/api/autopost/oauth/{platform}/start` | Bắt đầu kết nối |
| GET | `/api/autopost/oauth/{platform}/callback` | Nhận mã OAuth |
| POST | `/api/autopost/generate` | AI soạn nội dung |
| POST | `/api/autopost/posts` | Tạo bài (draft/scheduled) |
| POST | `/api/autopost/posts/{id}/approve` | Duyệt bài |
| POST | `/api/autopost/posts/{id}/publish-now` | Đăng ngay |
| PUT/DELETE | `/api/autopost/posts/{id}` | Sửa / hủy |
| GET | `/api/autopost/posts?status=` | Danh sách và lọc |
| POST | `/api/autopost/group-drafts` | Tạo nội dung cho Group |
| GET/PUT | `/api/autopost/settings` | Cài đặt |

Tất cả API yêu cầu quyền admin của website.

## 7. Bảo mật
- Chỉ tài khoản admin được truy cập; ghi log người duyệt/đăng.
- Token và API key mã hóa (AES) hoặc dùng secret manager; không commit vào mã nguồn.
- Kiểm tra định dạng/dung lượng file upload; thư mục media không public trực tiếp.
- Bước "duyệt trước khi đăng" mặc định bật để tránh AI đăng nội dung sai.

## 8. Lộ trình triển khai (bản gốc, đã điều chỉnh ở mục 10.5)
1. Kết nối OAuth và đăng tay lên YouTube + Fanpage.
2. AI soạn nội dung + màn hình duyệt.
3. Lịch đăng, worker, retry, thông báo.
4. Soạn nội dung cho Group (thủ công).
5. Tự tạo video từ nội dung.

## 9. Thông tin cần chuẩn bị
- Stack website hiện tại (ngôn ngữ, framework, DB, cách chạy tác vụ nền).
- Tài khoản Google Cloud: tạo project, bật YouTube Data API v3, tạo OAuth Client.
- Tài khoản Meta for Developers: tạo app, thêm Facebook Login, lấy App ID/Secret.
- API key của Claude (Anthropic).

## 10. Ghép vào stack PSVIET.COM (nghiên cứu 29/10/2026)

### 10.1 Hiện trạng
- `server.py`: Python, chỉ dùng thư viện chuẩn, `ThreadingHTTPServer`, đăng nhập bằng cookie `psviet_admin`, chặn khác nguồn (Origin). Upload hiện chỉ nhận ảnh ≤10MB và đọc cả file vào RAM.
- Không có DB. Nội dung website là JSON trong `website/data.js`, ghi đè toàn bộ mỗi lần lưu.
- Máy đang chạy Python 3.9.6.

### 10.2 Đề xuất ghép
| Phần | Cách làm hợp với stack |
|---|---|
| Lưu trữ | SQLite (`sqlite3` có sẵn trong Python), file `autopost/autopost.db` **ngoài** thư mục `website/` để không bị public. Không nhét vào `data.js`. |
| Media | Thư mục `autopost/media/`, không public. Upload video cần API riêng: ghi từng khối xuống đĩa, giới hạn ~2GB, kiểm tra định dạng mp4/mov. |
| Worker | Một luồng nền trong `server.py`, cứ 30 giây quét bảng `posts` để đăng bài đến giờ. Chỉ chạy khi server chạy, nên lịch đăng cần server bật liên tục (VPS); bản web tĩnh không hẹn giờ được. |
| Gọi YouTube / Facebook | `urllib.request` (thư viện chuẩn). Upload YouTube dạng resumable, gửi từng khối để không giữ cả video trong RAM. |
| Gọi Claude | SDK chính thức `anthropic`. SDK 1.x cần **Python ≥ 3.10**, nên phải nâng Python (VD 3.12) và tạo venv. Đây là thư viện ngoài đầu tiên của dự án. |
| Mã hóa token | Thư viện chuẩn không có AES. Hai lựa chọn: (a) thêm gói `cryptography`; (b) lưu token trong file riêng quyền 600 ngoài `website/`, giống `.admin.json`. Shop một chủ chạy trên VPS riêng thì (b) đủ dùng. |
| Giao diện | Thêm nhóm menu "Truyền thông" trong `admin.js`, viết các màn hình riêng giống `renderSettings`/`renderAccount`. Không dùng được form danh sách có sẵn. |
| API | Thêm các route `/api/autopost/...` vào `do_GET`/`do_POST`, dùng chung `logged_in()` và `same_origin()`. |

### 10.3 Đơn giản hóa cho shop một chủ
- **Fanpage:** không cần làm luồng OAuth. Chủ shop lấy Page Access Token dài hạn một lần (Graph API Explorer hoặc công cụ token của Meta) rồi dán vào mục Cài đặt. Module chỉ cần kiểm tra token còn hạn.
- **YouTube:** OAuth một lần qua địa chỉ loopback (`http://127.0.0.1:8000/...`), lưu refresh_token. Không cần màn hình quản lý nhiều kênh.

### 10.4 Chi phí Claude (giá 10/2026, ước tính mỗi lần soạn ~2.000 token vào, ~1.500 token ra)
| Model | Giá vào / ra (USD / 1 triệu token) | ~ mỗi lần soạn | ~ 100 lần/tháng |
|---|---|---|---|
| `claude-opus-5-5` (mặc định, viết tốt nhất) | 4 / 20 | ~0,04 USD | ~4 USD |
| `claude-haiku-5-5` (rẻ nhất) | 0,10 / 0,50 | ~0,001 USD | ~0,1 USD |

Model cấu hình được trong Cài đặt. Đầu ra dùng structured output (`output_config.format`) với JSON schema cố định: `youtube_title`, `youtube_description`, `tags`, `facebook_caption`, `hashtags`, để không phải tự tách chữ.

### 10.5 Lộ trình điều chỉnh
1. **Fanpage trước:** dán token, đăng văn bản/ảnh/video ngay hoặc hẹn giờ (Facebook tự lên lịch trong 10 phút đến 30 ngày).
2. AI soạn nội dung từ sản phẩm trong `data.js` + màn hình duyệt.
3. Hàng đợi SQLite + worker + retry + lịch sử.
4. **YouTube:** nộp audit cho Google ngay từ bước 1 (mất thời gian), làm upload sau khi được duyệt. Trước đó chỉ test được với video riêng tư.
5. Soạn nội dung cho Group.
6. Tự tạo video (ffmpeg + TTS).

### 10.6 Cần chủ shop quyết định
- Có chấp nhận nâng Python lên ≥3.10 và cài thêm thư viện (`anthropic`, có thể thêm `cryptography`) không?
- Website sẽ chạy trên VPS (bắt buộc nếu muốn hẹn giờ đăng) hay chỉ chạy trên máy cá nhân?
- Model Claude mặc định: Opus 5.5 (chất lượng) hay Haiku 5.5 (rẻ)?

Nguồn: [YouTube API Revision History](https://developers.google.com/youtube/v3/revision_history), [YouTube videos resource](https://developers.google.com/youtube/v3/docs/videos), [Meta Pages API – Posts](https://developers.facebook.com/docs/pages-api/posts), [Meta Reels Publishing API](https://developers.facebook.com/docs/video-api/guides/reels-publishing).
