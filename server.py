#!/usr/bin/env python3
"""Server cho website PSVIET.COM: phục vụ thư mục website/ và API cho trang quản trị.

Chạy:            python3 server.py               (mặc định http://127.0.0.1:8000)
Đổi cổng/host:   python3 server.py --port 8080 --host 0.0.0.0
Đặt mật khẩu:    python3 server.py --set-password

Chỉ dùng thư viện chuẩn của Python, không cần cài thêm gì.
"""
import argparse
import base64
import getpass
import hashlib
import hmac
import http.server
import json
import os
import re
import secrets
import shutil
import sys
import time
from http import HTTPStatus
from urllib.parse import parse_qs, quote, urlparse

import analytics
import autopost

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'website')
DATA_FILE = os.path.join(WEB, 'data.js')
UPLOAD_DIR = os.path.join(WEB, 'assets', 'uploads')
BACKUP_DIR = os.path.join(ROOT, 'backups')
CONFIG_FILE = os.path.join(ROOT, '.admin.json')

SESSION_TTL = 12 * 3600
MAX_UPLOAD = 10 * 1024 * 1024
MAX_DATA = 2 * 1024 * 1024
MAX_VIDEO = 4 * 1024 * 1024 * 1024
KEEP_BACKUPS = 30
DATA_KEYS = {'settings', 'machineCategories', 'products', 'gameCategories', 'games', 'highlights', 'policies', 'faq'}

sessions = {}        # token -> hạn dùng
failed_logins = {}   # ip -> [thời điểm sai]


# ---------- Mật khẩu ----------
def hash_password(password, salt=None):
    salt = salt or secrets.token_hex(16)
    digest = hashlib.pbkdf2_hmac('sha256', password.encode(), bytes.fromhex(salt), 200_000).hex()
    return {'salt': salt, 'hash': digest}


def load_config():
    try:
        with open(CONFIG_FILE) as f:
            return json.load(f)
    except (OSError, ValueError):
        return None


def save_config(cfg):
    tmp = CONFIG_FILE + '.tmp'
    with open(tmp, 'w') as f:
        json.dump(cfg, f)
    os.chmod(tmp, 0o600)
    os.replace(tmp, CONFIG_FILE)


def check_password(password):
    cfg = load_config()
    if not cfg:
        return False
    return hmac.compare_digest(hash_password(password, cfg['salt'])['hash'], cfg['hash'])


def ensure_password():
    """Lần chạy đầu: tạo mật khẩu ngẫu nhiên và in ra màn hình."""
    if load_config():
        return
    password = secrets.token_urlsafe(9)
    save_config(hash_password(password))
    print('=' * 60)
    print(' Đã tạo mật khẩu quản trị lần đầu:', password)
    print(' Hãy đăng nhập rồi đổi mật khẩu trong mục "Tài khoản".')
    print('=' * 60, flush=True)


# ---------- Ghi dữ liệu ----------
def write_data(data):
    os.makedirs(BACKUP_DIR, exist_ok=True)
    if os.path.exists(DATA_FILE):
        shutil.copy2(DATA_FILE, os.path.join(BACKUP_DIR, time.strftime('data-%Y%m%d-%H%M%S.js')))
        backups = sorted(f for f in os.listdir(BACKUP_DIR) if f.startswith('data-'))
        for old in backups[:-KEEP_BACKUPS]:
            os.remove(os.path.join(BACKUP_DIR, old))
    body = json.dumps(data, ensure_ascii=False, indent=2)
    tmp = DATA_FILE + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        f.write('// Dữ liệu website PSVIET.COM. Sửa bằng trang quản trị (admin.html), không cần sửa tay.\n')
        f.write('window.SITE = ' + body + ';\n')
    os.replace(tmp, DATA_FILE)


def image_ext(head):
    if head.startswith(b'\xff\xd8\xff'):
        return 'jpg'
    if head.startswith(b'\x89PNG\r\n\x1a\n'):
        return 'png'
    if head[:4] == b'RIFF' and head[8:12] == b'WEBP':
        return 'webp'
    return None


class Handler(http.server.SimpleHTTPRequestHandler):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, directory=WEB, **kwargs)

    # Không lưu cache dữ liệu và trang quản trị để cập nhật hiện ngay
    def end_headers(self):
        path = urlparse(self.path).path
        if path.endswith(('.js', '.html', '.css')) or path in ('/', ''):
            self.send_header('Cache-Control', 'no-cache')
        self.send_header('X-Content-Type-Options', 'nosniff')
        self.send_header('X-Frame-Options', 'DENY')                       # chống nhúng trang vào web lừa đảo
        self.send_header('Referrer-Policy', 'strict-origin-when-cross-origin')
        if self.https():
            self.send_header('Strict-Transport-Security', 'max-age=31536000')   # trình duyệt luôn dùng HTTPS
        super().end_headers()

    # Không liệt kê file trong thư mục (vd /assets/uploads/)
    def list_directory(self, path):
        self.send_error(HTTPStatus.NOT_FOUND)
        return None

    def log_message(self, fmt, *args):
        if '/api/' in self.path and not self.path.startswith('/api/track'):
            super().log_message(fmt, *args)

    # ---------- Tiện ích ----------
    def send_json(self, status, obj, cookie=None):
        body = json.dumps(obj, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header('Content-Type', 'application/json; charset=utf-8')
        self.send_header('Content-Length', str(len(body)))
        if cookie:
            self.send_header('Set-Cookie', cookie)
        self.end_headers()
        self.wfile.write(body)

    def session_token(self):
        for part in self.headers.get('Cookie', '').split(';'):
            name, _, value = part.strip().partition('=')
            if name == 'psviet_admin':
                return value
        return None

    def logged_in(self):
        token = self.session_token()
        expiry = sessions.get(token) if token else None
        if expiry and expiry > time.time():
            return True
        sessions.pop(token, None)
        return False

    def same_origin(self):
        origin = self.headers.get('Origin')
        if not origin:
            return True
        return urlparse(origin).netloc == self.headers.get('Host')

    def read_body(self, limit):
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > limit:
            return None
        return self.rfile.read(length)

    def redirect(self, location):
        self.send_response(HTTPStatus.FOUND)
        self.send_header('Location', location)
        self.send_header('Content-Length', '0')
        self.end_headers()

    def https(self):
        # Caddy ghi X-Forwarded-Proto; chỉ tin khi yêu cầu đến từ chính máy chủ
        return (self.client_address[0] in ('127.0.0.1', '::1')
                and self.headers.get('X-Forwarded-Proto', '').split(',')[0].strip() == 'https')

    def session_cookie(self, token, max_age=SESSION_TTL):
        return f'psviet_admin={token}; Path=/; Max-Age={max_age}; HttpOnly; SameSite=Strict' + ('; Secure' if self.https() else '')

    def callback_url(self):
        proto = 'https' if self.https() else 'http'
        return f"{proto}://{self.headers.get('Host')}/api/autopost/youtube/callback"

    # ---------- API ----------
    def do_GET(self):
        url = urlparse(self.path)
        if url.path == '/api/me':
            return self.send_json(HTTPStatus.OK, {'server': True, 'loggedIn': self.logged_in()})
        if url.path == '/api/autopost/youtube/callback':
            q = parse_qs(url.query)
            try:
                if q.get('error'):
                    raise autopost.AutopostError('Bạn đã từ chối cấp quyền')
                autopost.youtube_callback(q.get('code', [''])[0], q.get('state', [''])[0], self.callback_url())
                return self.redirect('/admin.html?yt=ok')
            except Exception as e:
                return self.redirect('/admin.html?yt=' + quote(str(e)))
        if url.path == '/api/stats':
            if not self.logged_in():
                return self.send_json(HTTPStatus.UNAUTHORIZED, {'error': 'Chưa đăng nhập'})
            days = (parse_qs(url.query).get('days') or ['30'])[0]
            return self.send_json(HTTPStatus.OK, analytics.summary(int(days) if days.isdigit() else 30))
        if url.path.startswith('/api/autopost/'):
            if not self.logged_in():
                return self.send_json(HTTPStatus.UNAUTHORIZED, {'error': 'Chưa đăng nhập'})
            if url.path == '/api/autopost/status':
                return self.send_json(HTTPStatus.OK, autopost.status())
            if url.path == '/api/autopost/youtube/connect':
                try:
                    return self.redirect(autopost.youtube_auth_url(self.callback_url()))
                except autopost.AutopostError as e:
                    return self.send_json(HTTPStatus.BAD_REQUEST, {'error': str(e)})
            return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Không tìm thấy'})
        return super().do_GET()

    def do_POST(self):
        path = urlparse(self.path).path
        if not self.same_origin():
            return self.send_json(HTTPStatus.FORBIDDEN, {'error': 'Sai nguồn yêu cầu'})

        if path == '/api/track':
            return self.api_track()
        if path == '/api/login':
            return self.api_login()
        if path == '/api/logout':
            sessions.pop(self.session_token(), None)
            return self.send_json(HTTPStatus.OK, {'ok': True}, self.session_cookie('', 0))

        if not self.logged_in():
            return self.send_json(HTTPStatus.UNAUTHORIZED, {'error': 'Chưa đăng nhập'})
        if path == '/api/data':
            return self.api_save_data()
        if path == '/api/upload':
            return self.api_upload()
        if path == '/api/password':
            return self.api_change_password()
        if path.startswith('/api/autopost/'):
            return self.api_autopost(path)
        return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Không tìm thấy'})

    # ---------- Thống kê truy cập ----------
    def client_ip(self):
        # Sau Caddy, IP thật nằm ở X-Forwarded-For (chỉ tin khi yêu cầu đến từ chính máy chủ;
        # Caddy tự ghi đè giá trị khách gửi lên nên không giả được)
        ip = self.client_address[0]
        if ip in ('127.0.0.1', '::1'):
            ip = (self.headers.get('X-Forwarded-For') or ip).split(',')[0].strip()
        return ip

    def api_track(self):
        try:
            body = json.loads(self.read_body(4_000) or b'{}')
        except ValueError:
            body = {}
        if isinstance(body, dict):
            try:
                analytics.record(body, self.client_ip(), self.headers.get('User-Agent'), self.headers.get('Host'))
            except Exception:
                pass   # thống kê lỗi không được làm hỏng website
        self.send_response(HTTPStatus.NO_CONTENT)
        self.end_headers()

    # ---------- Truyền thông / Auto Post ----------
    def api_autopost(self, path):
        try:
            if path == '/api/autopost/youtube/upload':
                return self.send_json(HTTPStatus.OK, self.api_youtube_upload())
            try:
                body = json.loads(self.read_body(100_000) or b'{}')
            except ValueError:
                body = {}
            if path == '/api/autopost/settings':
                return self.send_json(HTTPStatus.OK, autopost.update_settings(body))
            if path == '/api/autopost/facebook':
                return self.send_json(HTTPStatus.OK, autopost.facebook_post(body))
            if path == '/api/autopost/disconnect':
                return self.send_json(HTTPStatus.OK, autopost.disconnect(body.get('platform')))
            return self.send_json(HTTPStatus.NOT_FOUND, {'error': 'Không tìm thấy'})
        except autopost.AutopostError as e:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': str(e)})
        except OSError as e:
            return self.send_json(HTTPStatus.BAD_GATEWAY, {'error': 'Lỗi kết nối: ' + str(e)})

    def api_youtube_upload(self):
        """Nhận video (thân yêu cầu thô), ghi từng khối xuống đĩa rồi chuyển lên YouTube."""
        length = int(self.headers.get('Content-Length') or 0)
        if length <= 0 or length > MAX_VIDEO:
            raise autopost.AutopostError('Video rỗng hoặc lớn hơn 4GB')
        try:
            meta = json.loads(base64.b64decode(self.headers.get('X-Meta', '')).decode() or '{}')
        except ValueError:
            raise autopost.AutopostError('Thông tin video không hợp lệ')
        meta['mime'] = self.headers.get('Content-Type') or 'video/*'
        os.makedirs(autopost.MEDIA_DIR, exist_ok=True)
        tmp = os.path.join(autopost.MEDIA_DIR, f'up-{int(time.time())}-{secrets.token_hex(4)}')
        try:
            with open(tmp, 'wb') as f:
                left = length
                while left > 0:
                    chunk = self.rfile.read(min(left, 1024 * 1024))
                    if not chunk:
                        raise autopost.AutopostError('Tải video lên server bị ngắt giữa chừng')
                    f.write(chunk)
                    left -= len(chunk)
            return autopost.youtube_upload(tmp, meta)
        finally:
            if os.path.exists(tmp):
                os.remove(tmp)

    def api_login(self):
        # Tính theo IP thật của khách (không phải IP của Caddy), nên người lạ nhập sai không khoá được chủ shop
        ip = self.client_ip()
        now = time.time()
        recent = [t for t in failed_logins.get(ip, []) if now - t < 900]
        if len(recent) >= 10 or len([t for t in recent if now - t < 60]) >= 5:
            return self.send_json(HTTPStatus.TOO_MANY_REQUESTS, {'error': 'Sai quá nhiều lần, thử lại sau ít phút'})
        if len(failed_logins) > 10_000:
            failed_logins.clear()
        try:
            password = json.loads(self.read_body(10_000) or b'{}').get('password', '')
        except ValueError:
            password = ''
        if not check_password(password):
            failed_logins[ip] = recent + [now]
            time.sleep(0.5)
            return self.send_json(HTTPStatus.UNAUTHORIZED, {'error': 'Sai mật khẩu'})
        failed_logins.pop(ip, None)
        token = secrets.token_urlsafe(32)
        sessions[token] = now + SESSION_TTL
        return self.send_json(HTTPStatus.OK, {'ok': True}, self.session_cookie(token))

    def api_save_data(self):
        raw = self.read_body(MAX_DATA)
        try:
            data = json.loads(raw or b'')
        except ValueError:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Dữ liệu không hợp lệ'})
        if not isinstance(data, dict) or not DATA_KEYS.issubset(data):
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Thiếu mục dữ liệu'})
        write_data(data)
        return self.send_json(HTTPStatus.OK, {'ok': True, 'savedAt': time.strftime('%H:%M:%S')})

    def api_upload(self):
        raw = self.read_body(MAX_UPLOAD)
        if not raw:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Ảnh rỗng hoặc lớn hơn 10MB'})
        ext = image_ext(raw[:16])
        if not ext:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Chỉ nhận ảnh JPG, PNG, WEBP'})
        name = re.sub(r'[^a-z0-9-]+', '-', (self.headers.get('X-File-Name') or 'anh').lower()).strip('-')[:40] or 'anh'
        os.makedirs(UPLOAD_DIR, exist_ok=True)
        filename = f'{name}-{time.strftime("%Y%m%d%H%M%S")}-{secrets.token_hex(2)}.{ext}'
        with open(os.path.join(UPLOAD_DIR, filename), 'wb') as f:
            f.write(raw)
        return self.send_json(HTTPStatus.OK, {'ok': True, 'path': 'assets/uploads/' + filename})

    def api_change_password(self):
        try:
            body = json.loads(self.read_body(10_000) or b'{}')
        except ValueError:
            body = {}
        if not check_password(body.get('current', '')):
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Mật khẩu hiện tại không đúng'})
        new = body.get('new', '')
        if len(new) < 8:
            return self.send_json(HTTPStatus.BAD_REQUEST, {'error': 'Mật khẩu mới cần ít nhất 8 ký tự'})
        save_config(hash_password(new))
        sessions.clear()
        token = secrets.token_urlsafe(32)
        sessions[token] = time.time() + SESSION_TTL
        return self.send_json(HTTPStatus.OK, {'ok': True}, self.session_cookie(token))


def main():
    parser = argparse.ArgumentParser(description='Server website PSVIET.COM')
    parser.add_argument('--host', default='127.0.0.1')
    parser.add_argument('--port', type=int, default=8000)
    parser.add_argument('--set-password', action='store_true', help='Đặt lại mật khẩu quản trị')
    args = parser.parse_args()

    if args.set_password:
        pw = getpass.getpass('Mật khẩu mới (ít nhất 8 ký tự): ')
        if len(pw) < 8 or pw != getpass.getpass('Nhập lại: '):
            sys.exit('Mật khẩu quá ngắn hoặc không khớp.')
        save_config(hash_password(pw))
        print('Đã đặt mật khẩu.')
        return

    ensure_password()
    server = http.server.ThreadingHTTPServer((args.host, args.port), Handler)
    print(f'Website:     http://{args.host}:{args.port}/')
    print(f'Quản trị:    http://{args.host}:{args.port}/admin.html', flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == '__main__':
    main()
