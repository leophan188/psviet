# PSVIET.COM – Bán máy PlayStation cũ tại Hà Nội

Dự án marketing đa kênh: Website + Fanpage Facebook + Kênh YouTube.
Mô hình: bán máy PS cũ **nguyên bản**, bảo hành, ship COD toàn quốc.

## Cấu trúc thư mục
```
PSVIET.COM/
├── README.md
├── server.py                    Server website + trang quản trị (đăng nhập, lưu, tải ảnh)
├── autopost.py                  Module Truyền thông: đăng Fanpage, tải video YouTube
├── autopost/                    Mã truy cập Facebook/YouTube + lịch sử đăng (tự tạo trên máy chủ, không có trong git)
├── deploy.sh                    Đưa code lên máy chủ, không ghi đè dữ liệu thật (đọc địa chỉ từ .deploy.env)
├── .admin.json                  Mật khẩu quản trị đã mã hóa (tự tạo, không có trong git)
├── backups/                     Bản sao data.js trước mỗi lần lưu, giữ 30 bản (trên máy chủ)
├── docs/                        Tài liệu thương hiệu, fanpage, YouTube, kế hoạch, chính sách
└── website/
    ├── index.html               Trang chủ
    ├── games.html               Trang danh sách game PS4, PS5
    ├── game.html                Trang chi tiết một game (game.html?id=...), bài viết sửa trong trang quản trị
    ├── admin.html               Trang quản trị (cần đăng nhập)
    ├── data.js                  TOÀN BỘ nội dung sửa được: máy, danh mục, game, chính sách,
    │                            hỏi đáp, thông tin shop. Sửa bằng trang quản trị.
    ├── site.js, home.js, games-page.js, game-detail.js, admin.js
    ├── style.css
    └── assets/                  Ảnh máy, ảnh game (assets/games), ảnh tải lên (assets/uploads)
```

## Chạy website và trang quản trị
```bash
python3 server.py
```
- Website: http://127.0.0.1:8000
- Quản trị: http://127.0.0.1:8000/admin.html
- Lần chạy đầu, server in **mật khẩu quản trị** ra màn hình. Đăng nhập rồi đổi mật khẩu ở mục *Tài khoản*.
- Quên mật khẩu: `python3 server.py --set-password`

Trong trang quản trị: sửa nội dung → bấm **Lưu & đăng lên web** → website cập nhật ngay.

## Truyền thông (Facebook, YouTube, nhóm)
Trong trang quản trị, nhóm menu **Truyền thông**:
- **Quản lý bài viết:** mọi bài soạn sẵn chia tab **Máy / Game / Hướng dẫn**, tìm kiếm, xem & sửa, đổi mẫu. Nút **Đăng bài** cho chọn **Fanpage** (tự động khi đã kết nối, chưa kết nối thì sao chép + mở Facebook) hoặc **Nhóm Facebook** (tích nhóm → đăng lần lượt, tự thêm câu xin phép Admin; Facebook không cho phần mềm tự đăng vào nhóm nên bước bấm Đăng làm tay).
- **Lịch đăng Facebook:** 2 bài/ngày trong 7 ngày (máy + game), hẹn giờ lên Fanpage.
- **Video YouTube:** tải video từ máy tính lên kênh, tiêu đề/mô tả điền sẵn.
- **Kết nối & lịch sử:** Fanpage, YouTube, danh sách nhóm Facebook (kèm nút tìm nhóm), khung giờ đăng, lịch sử.
Hẹn giờ dùng chức năng sẵn của Facebook (10 phút – 30 ngày) và YouTube, server không cần chạy nền. Chi tiết: `MO_TA_MODULE_AUTO_POST.md`.

## Deploy lên máy chủ
Website chạy trên máy chủ Ubuntu: dịch vụ `psviet` (systemd) chạy `server.py`, Caddy nhận truy cập và chuyển vào.
**Dữ liệu thật nằm trên máy chủ** – sửa nội dung bằng trang quản trị của máy chủ, không sửa `data.js` trên máy cá nhân.

Đưa code mới lên: tạo file `.deploy.env` (`SERVER=user@ip`, `DIR=/duong/dan/psviet`) rồi chạy `./deploy.sh`.
Script không chép đè `data.js`, ảnh tải lên, mật khẩu, kết nối Fanpage/YouTube và bản lưu trên máy chủ.

Đường đi của tên miền: Internet → router (cổng 80/443) → máy ảo `192.168.9.202` (Caddy, tự cấp HTTPS cho psviet.com) → `server.py`.
Cổng 8888 vẫn mở để vào bằng IP. Cấu hình Caddy: `deploy/Caddyfile` (chép vào `/etc/caddy/Caddyfile`, chạy `caddy validate` trước khi `systemctl reload caddy`).
Nếu sau này 80/443 chuyển sang Nginx ở server ngoài: dùng `deploy/nginx-psviet.conf`, trỏ vào cổng 8888 của máy ảo; Nginx phải gửi `Host $host` (không thì đăng nhập/lưu bị chặn) và `X-Forwarded-For` (để thống kê đúng IP khách).

## Đưa website lên mạng (cách khác)
- **Cần quản trị trực tuyến** (sửa từ điện thoại, ở bất kỳ đâu): thuê VPS hoặc dịch vụ chạy Python, chạy
  `python3 server.py --host 0.0.0.0 --port 8000` sau một reverse proxy có HTTPS (Caddy/Nginx).
- **Chỉ cần web tĩnh** (Netlify/Cloudflare Pages): sửa nội dung bằng server trên máy mình, rồi kéo thả thư mục
  `website/` lên. Không đưa `admin.html` lên nếu không dùng.

## Việc cần làm (TODO)
- [ ] Đổi mật khẩu quản trị
- [ ] Điền **Thông tin shop** trong trang quản trị (SĐT, Zalo, Messenger, Telegram, địa chỉ)
- [ ] Đăng từng máy thật kèm ảnh chụp thật
- [ ] Đăng ký domain, tạo Fanpage và kênh YouTube cùng tên/username

## Nguyên tắc bắt buộc
- Chỉ bán máy **nguyên bản**, không jailbreak/mod; không bán/quảng bá game lậu.
- Không dùng logo Sony/PlayStation trong tên, avatar, banner.
- Nội dung Việt hóa/thuyết minh chỉ dùng khi có giấy phép của hãng/nhà phát triển.
- Ảnh và video máy phải là máy thật đang bán.
