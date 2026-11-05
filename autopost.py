"""Module "Truyền thông / Auto Post": đăng bài lên Fanpage Facebook và tải video lên YouTube.

Chỉ dùng thư viện chuẩn của Python. Mã truy cập lưu trong autopost/config.json (quyền 600, ngoài thư mục website/).
Hẹn giờ dùng chức năng sẵn có của từng nền tảng (Facebook scheduled_publish_time, YouTube publishAt),
nên server không cần tiến trình chạy nền.
"""
import json
import os
import secrets
import threading
import time
import urllib.error
import urllib.parse
import urllib.request

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'website')
DIR = os.path.join(ROOT, 'autopost')
CONFIG_FILE = os.path.join(DIR, 'config.json')
HISTORY_FILE = os.path.join(DIR, 'history.json')
MEDIA_DIR = os.path.join(DIR, 'media')

GRAPH = 'https://graph.facebook.com/v26.0'
GOOGLE_AUTH = 'https://accounts.google.com/o/oauth2/v2/auth'
GOOGLE_TOKEN = 'https://oauth2.googleapis.com/token'
YT_UPLOAD = 'https://www.googleapis.com/upload/youtube/v3/videos'
YT_SCOPE = 'https://www.googleapis.com/auth/youtube.upload'
FB_MIN_DELAY = 10 * 60          # Facebook: hẹn giờ ít nhất 10 phút
FB_MAX_DELAY = 30 * 24 * 3600   # và nhiều nhất 30 ngày
CHUNK = 8 * 1024 * 1024
KEEP_HISTORY = 300
DEFAULTS = {'times': ['11:30', '20:00'], 'site_url': 'https://psviet.com', 'groups': []}

oauth_states = {}  # state -> hạn dùng (callback từ Google không mang cookie SameSite=Strict)


class AutopostError(Exception):
    pass


# ---------- Lưu trữ ----------
def _read_json(path, default):
    try:
        with open(path, encoding='utf-8') as f:
            return json.load(f)
    except (OSError, ValueError):
        return default


def _write_json(path, obj, private=False):
    os.makedirs(DIR, exist_ok=True)
    tmp = path + '.tmp'
    with open(tmp, 'w', encoding='utf-8') as f:
        json.dump(obj, f, ensure_ascii=False, indent=1)
    if private:
        os.chmod(tmp, 0o600)
    os.replace(tmp, path)


def load_config():
    cfg = dict(DEFAULTS)
    cfg.update(_read_json(CONFIG_FILE, {}))
    return cfg


def save_config(cfg):
    _write_json(CONFIG_FILE, cfg, private=True)


_history_lock = threading.Lock()   # lịch sử được ghi cả từ luồng nền đối chiếu Facebook


def add_history(entry):
    with _history_lock:
        items = _read_json(HISTORY_FILE, [])
        entry.setdefault('time', int(time.time()))
        items.insert(0, entry)
        _write_json(HISTORY_FILE, items[:KEEP_HISTORY])


# ---------- HTTP ----------
def _request(url, data=None, headers=None, method=None, timeout=60):
    req = urllib.request.Request(url, data=data, headers=headers or {}, method=method)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            body = r.read()
            return r.status, dict(r.headers), body
    except urllib.error.HTTPError as e:
        return e.code, dict(e.headers), e.read()


def _json_or_error(status, body, what):
    try:
        obj = json.loads(body or b'{}')
    except ValueError:
        obj = {}
    if status >= 400 or 'error' in obj:
        err = obj.get('error')
        msg = err.get('message') if isinstance(err, dict) else (obj.get('error_description') or err)
        raise AutopostError(f'{what}: {msg or "lỗi " + str(status)}')
    return obj


def _multipart(fields, file_field=None):
    boundary = 'psviet' + secrets.token_hex(12)
    parts = []
    for k, v in fields.items():
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{k}"\r\n\r\n{v}\r\n'.encode())
    if file_field:
        name, filename, ctype, content = file_field
        parts.append(f'--{boundary}\r\nContent-Disposition: form-data; name="{name}"; filename="{filename}"\r\n'
                     f'Content-Type: {ctype}\r\n\r\n'.encode() + content + b'\r\n')
    parts.append(f'--{boundary}--\r\n'.encode())
    return b''.join(parts), 'multipart/form-data; boundary=' + boundary


# ---------- Đối chiếu lịch sử với Facebook ----------
_last_check = {'time': 0}
_refresh_lock = threading.Lock()


def refresh_history():
    """Hỏi lại Facebook trạng thái các bài 30 ngày gần đây (tối đa 5 phút một lần):
    bài hẹn giờ đã lên thì ghi "Đã đăng", bài đã bị xoá trên Facebook thì ghi "Đã xoá"."""
    now = time.time()
    if now - _last_check['time'] < 300:
        return
    _last_check['time'] = now
    cfg = load_config()
    if not cfg.get('fb_token'):
        return
    published, gone, readable = set(), set(), False
    for h in _read_json(HISTORY_FILE, [])[:40]:
        if (h.get('platform') != 'facebook' or not h.get('id') or h.get('status') not in ('published', 'scheduled')
                or now - h.get('time', 0) > 30 * 86400):
            continue
        q = urllib.parse.urlencode({'access_token': cfg['fb_token'], 'fields': 'is_published'})
        try:
            code, _, body = _request(f"{GRAPH}/{urllib.parse.quote(h['id'])}?{q}", timeout=15)
            obj = json.loads(body or b'{}')
        except (OSError, ValueError):
            return   # mất mạng: để lần sau kiểm tra
        if code >= 400:
            err = obj.get('error') or {}
            if err.get('code') in (10, 100) and 'does not exist' in str(err.get('message', '')):
                gone.add(h['id'])   # bài không còn trên Facebook
            continue
        readable = True
        if h['status'] == 'scheduled' and obj.get('is_published'):
            published.add(h['id'])
    # Chỉ ghi "đã xoá" khi đọc được bài khác cùng lượt (tránh đánh dấu nhầm hàng loạt khi mã truy cập mất quyền)
    if not readable:
        gone = set()
    if not (published or gone):
        return
    # Ghi theo id trên bản mới nhất của file: không làm mất bài vừa thêm trong lúc đang hỏi Facebook
    with _history_lock:
        items = _read_json(HISTORY_FILE, [])
        for h in items:
            if h.get('platform') == 'facebook' and h.get('id') in gone:
                h['status'] = 'deleted'
            elif h.get('platform') == 'facebook' and h.get('id') in published and h.get('status') == 'scheduled':
                h['status'] = 'published'
        _write_json(HISTORY_FILE, items[:KEEP_HISTORY])


def _refresh_in_background():
    """Đối chiếu Facebook ở luồng nền để trang quản trị không phải chờ (kết quả hiện ở lần tải sau)."""
    if time.time() - _last_check['time'] < 300 or not _refresh_lock.acquire(blocking=False):
        return

    def run():
        try:
            refresh_history()
        except Exception as e:   # noqa: BLE001 - lỗi đối chiếu không được làm hỏng trang quản trị
            print('[autopost] refresh_history:', e)
        finally:
            _refresh_lock.release()

    threading.Thread(target=run, daemon=True).start()


def log_group(body):
    """Ghi lại bài đã đăng vào nhóm (Facebook không cho phần mềm đăng nhóm, chủ shop đăng tay rồi xác nhận)."""
    group = str(body.get('group') or '').strip()
    if not group.startswith('https://'):
        raise AutopostError('Link nhóm không hợp lệ')
    add_history({'platform': 'group', 'status': 'posted', 'slot': str(body.get('slot') or '')[:120],
                 'title': str(body.get('title') or '')[:120], 'group': group[:300],
                 'group_name': str(body.get('group_name') or '')[:120], 'url': group[:300]})
    return status()


# ---------- Trạng thái (không trả mã truy cập ra ngoài) ----------
def status():
    _refresh_in_background()
    cfg = load_config()
    return {
        'facebook': {'connected': bool(cfg.get('fb_token') and cfg.get('fb_page_id')),
                     'page_id': cfg.get('fb_page_id', ''), 'page_name': cfg.get('fb_page_name', ''),
                     'app_id': cfg.get('fb_app_id', ''), 'app_set': bool(cfg.get('fb_app_id') and cfg.get('fb_app_secret')),
                     'token_expires': cfg.get('fb_token_expires')},
        'youtube': {'client_set': bool(cfg.get('yt_client_id') and cfg.get('yt_client_secret')),
                    'connected': bool(cfg.get('yt_refresh_token')), 'client_id': cfg.get('yt_client_id', ''),
                    'api_key_set': bool(cfg.get('yt_api_key'))},
        'settings': {'times': cfg['times'], 'site_url': cfg['site_url'], 'groups': cfg.get('groups', [])},
        'history': _read_json(HISTORY_FILE, [])[:100],
    }


def update_settings(body):
    cfg = load_config()
    if 'times' in body:
        times = [t.strip() for t in body['times'] if isinstance(t, str) and len(t.strip()) == 5 and t.strip()[2] == ':']
        cfg['times'] = times or DEFAULTS['times']
    if body.get('site_url'):
        cfg['site_url'] = str(body['site_url']).strip().rstrip('/')
    if isinstance(body.get('groups'), list):
        # Danh sách nhóm Facebook để đăng tay: chỉ nhận link http(s), tối đa 200 nhóm
        groups = []
        for g in body['groups'][:200]:
            url = str((g or {}).get('url', '')).strip()
            if url.startswith(('https://', 'http://')):
                groups.append({'name': str(g.get('name') or '').strip()[:80], 'url': url[:300]})
        cfg['groups'] = groups
    if body.get('fb_app_id') or body.get('fb_app_secret'):
        cfg['fb_app_id'] = str(body.get('fb_app_id') or cfg.get('fb_app_id', '')).strip()
        cfg['fb_app_secret'] = str(body.get('fb_app_secret') or cfg.get('fb_app_secret', '')).strip()
    if body.get('fb_page_id') or body.get('fb_token'):
        page_id = str(body.get('fb_page_id') or cfg.get('fb_page_id', '')).strip()
        token = str(body.get('fb_token') or cfg.get('fb_token', '')).strip()
        if not page_id or not token:
            raise AutopostError('Cần cả ID Fanpage và mã truy cập')
        # Chỉ đổi sang mã dài hạn khi vừa dán mã mới (mã đã lưu là mã Fanpage, không đổi được nữa)
        if body.get('fb_token') and cfg.get('fb_app_id') and cfg.get('fb_app_secret'):
            token = facebook_long_lived(token, cfg['fb_app_id'], cfg['fb_app_secret'])
        cfg['fb_page_name'], cfg['fb_token'] = facebook_page_token(page_id, token)
        cfg['fb_page_id'] = page_id
        cfg['fb_token_expires'] = facebook_token_expiry(cfg['fb_token'])
    if body.get('yt_client_id') or body.get('yt_client_secret'):
        cfg['yt_client_id'] = str(body.get('yt_client_id') or cfg.get('yt_client_id', '')).strip()
        cfg['yt_client_secret'] = str(body.get('yt_client_secret') or cfg.get('yt_client_secret', '')).strip()
    if 'yt_api_key' in body:
        # API key YouTube Data API v3 cho mục Thống kê (chỉ đọc số liệu công khai của kênh); để trống là xoá
        key = str(body.get('yt_api_key') or '').strip()
        if key and not key.replace('-', '').replace('_', '').isalnum():
            raise AutopostError('API key không hợp lệ')
        if key:
            cfg['yt_api_key'] = key[:100]
        else:
            cfg.pop('yt_api_key', None)
    save_config(cfg)
    return status()


def disconnect(platform):
    cfg = load_config()
    keys = {'facebook': ('fb_token', 'fb_page_id', 'fb_page_name', 'fb_token_expires'), 'youtube': ('yt_refresh_token',)}.get(platform, ())
    for k in keys:
        cfg.pop(k, None)
    save_config(cfg)
    return status()


# ---------- Facebook ----------
# Lỗi Facebook hay gặp và cách sửa (hiện kèm thông báo lỗi)
FB_HINTS = [
    ('publish_actions', 'Mã đang là mã tài khoản cá nhân. Vào Kết nối & lịch sử, dán lại mã rồi bấm "Lưu & kiểm tra".'),
    ('pages_manage_posts', 'Ứng dụng chưa có quyền đăng bài lên Trang. Vào developers.facebook.com → ứng dụng → Use cases '
                           '→ "Manage everything on your Page" → Customize → thêm quyền pages_manage_posts; để ứng dụng ở chế độ '
                           'Development; tạo lại mã trong Graph API Explorer có tích pages_manage_posts rồi dán vào Kết nối.'),
    ('expired', 'Mã đã hết hạn. Tạo mã mới trong Graph API Explorer, dán vào Kết nối; điền App ID + App Secret để mã không hết hạn.'),
    ('validating access token', 'Mã không còn hiệu lực (hết hạn hoặc đã đổi mật khẩu). Tạo mã mới và dán vào Kết nối.'),
    ('does not exist', 'Sai ID Fanpage. ID đúng lấy bằng lệnh me/accounts trong Graph API Explorer.'),
]


def _facebook_hint(msg):
    for key, hint in FB_HINTS:
        if key in msg:
            return ' → Cách sửa: ' + hint
    return ''


def facebook_long_lived(token, app_id, app_secret):
    """Đổi mã người dùng ngắn hạn sang dài hạn (~60 ngày); mã Fanpage lấy từ mã dài hạn gần như không hết hạn."""
    qs = urllib.parse.urlencode({'grant_type': 'fb_exchange_token', 'client_id': app_id,
                                 'client_secret': app_secret, 'fb_exchange_token': token})
    obj = _json_or_error(*_request(f'{GRAPH}/oauth/access_token?{qs}')[::2], 'Không đổi được sang mã dài hạn (kiểm tra App ID/App Secret)')
    return obj.get('access_token') or token


def facebook_page_token(page_id, token):
    """Trả (tên trang, mã Fanpage). Nếu dán mã người dùng, Facebook trả kèm mã của Fanpage để dùng thay.
    Đăng bằng mã người dùng sẽ bị từ chối với lỗi publish_actions."""
    qs = urllib.parse.urlencode({'fields': 'name,access_token', 'access_token': token})
    obj = _json_or_error(*_request(f'{GRAPH}/{urllib.parse.quote(page_id)}?{qs}')[::2], 'Không kiểm tra được Fanpage')
    if not obj.get('name'):
        raise AutopostError('Mã truy cập không đọc được Fanpage này')
    return obj['name'], obj.get('access_token') or token


def facebook_token_expiry(token):
    """Thời điểm mã hết hạn (giây), 0 = không hết hạn; None nếu không kiểm tra được."""
    qs = urllib.parse.urlencode({'input_token': token, 'access_token': token})
    try:
        obj = _json_or_error(*_request(f'{GRAPH}/debug_token?{qs}', timeout=20)[::2], 'Không kiểm tra được mã')
    except AutopostError:
        return None
    return int((obj.get('data') or {}).get('expires_at') or 0)


def _site_image(rel):
    """Đường dẫn ảnh trong website/ (chặn đi ra ngoài thư mục)."""
    path = os.path.realpath(os.path.join(WEB, rel.split('?')[0].lstrip('/')))
    if not path.startswith(WEB + os.sep) or not os.path.isfile(path):
        raise AutopostError('Không tìm thấy ảnh ' + rel)
    ext = os.path.splitext(path)[1].lower()
    ctype = {'.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.png': 'image/png', '.webp': 'image/webp'}.get(ext)
    if not ctype:
        raise AutopostError('Chỉ đăng được ảnh JPG, PNG, WEBP')
    with open(path, 'rb') as f:
        return os.path.basename(path), ctype, f.read()


def facebook_post(body):
    cfg = load_config()
    if not (cfg.get('fb_token') and cfg.get('fb_page_id')):
        raise AutopostError('Chưa kết nối Fanpage')
    message = str(body.get('message') or '').strip()
    if not message:
        raise AutopostError('Bài viết đang trống')
    # Luôn đăng bằng mã của Fanpage: nếu đang lưu mã người dùng thì đổi sang mã Fanpage và lưu lại
    name, page_token = facebook_page_token(cfg['fb_page_id'], cfg['fb_token'])
    if page_token != cfg['fb_token'] or name != cfg.get('fb_page_name'):
        cfg['fb_token'], cfg['fb_page_name'] = page_token, name
        save_config(cfg)
    fields = {'access_token': cfg['fb_token']}
    when = body.get('scheduled_at')
    now = int(time.time())
    scheduled = None
    if when:
        when = int(when)
        if when > now + FB_MAX_DELAY:
            raise AutopostError('Facebook chỉ cho hẹn giờ tối đa 30 ngày')
        if when < now + FB_MIN_DELAY:
            raise AutopostError('Giờ hẹn phải sau hiện tại ít nhất 10 phút (quá giờ thì dùng Đăng ngay)')
        scheduled = when
        fields.update(published='false', scheduled_publish_time=str(when))
    page = urllib.parse.quote(cfg['fb_page_id'])
    entry = {'platform': 'facebook', 'slot': body.get('slot', ''), 'title': message.split('\n')[0][:120],
             'scheduled_for': scheduled}
    try:
        fields['message'] = message
        if body.get('image'):
            # Đăng thẳng vào /photos thì Trang mới chỉ thêm ảnh vào mục "Ảnh", không hiện ở "Bài viết".
            # Nên tải ảnh lên ở chế độ ẩn trước, rồi tạo bài viết trên /feed gắn ảnh đó.
            photo = {'access_token': cfg['fb_token'], 'published': 'false'}
            if scheduled:
                photo['temporary'] = 'true'   # Facebook yêu cầu với bài hẹn giờ
            data, ctype = _multipart(photo, ('source',) + _site_image(str(body['image'])))
            res = _request(f'{GRAPH}/{page}/photos', data, {'Content-Type': ctype}, 'POST', timeout=120)
            media = _json_or_error(res[0], res[2], 'Facebook từ chối ảnh')
            if not media.get('id'):
                raise AutopostError('Facebook không trả về mã ảnh')
            fields['attached_media[0]'] = json.dumps({'media_fbid': media['id']})
        elif body.get('link'):
            fields['link'] = str(body['link'])
        res = _request(f'{GRAPH}/{page}/feed', urllib.parse.urlencode(fields).encode(),
                       {'Content-Type': 'application/x-www-form-urlencoded'}, 'POST')
        obj = _json_or_error(res[0], res[2], 'Facebook từ chối')
    except AutopostError as e:
        msg = str(e) + _facebook_hint(str(e))
        add_history(dict(entry, status='failed', error=msg))
        raise AutopostError(msg)
    post_id = obj.get('post_id') or obj.get('id', '')
    entry.update(status='scheduled' if scheduled else 'published', id=post_id,
                 url=f'https://www.facebook.com/{post_id}' if post_id else '')
    add_history(entry)
    return entry


# ---------- YouTube ----------
def youtube_auth_url(redirect_uri):
    cfg = load_config()
    if not (cfg.get('yt_client_id') and cfg.get('yt_client_secret')):
        raise AutopostError('Chưa nhập Client ID / Client Secret của Google')
    now = time.time()
    for s, exp in list(oauth_states.items()):
        if exp < now:
            oauth_states.pop(s, None)
    state = secrets.token_urlsafe(24)
    oauth_states[state] = now + 600
    return GOOGLE_AUTH + '?' + urllib.parse.urlencode({
        'client_id': cfg['yt_client_id'], 'redirect_uri': redirect_uri, 'response_type': 'code',
        'scope': YT_SCOPE, 'access_type': 'offline', 'prompt': 'consent', 'state': state})


def youtube_callback(code, state, redirect_uri):
    if not state or oauth_states.pop(state, 0) < time.time():
        raise AutopostError('Phiên kết nối YouTube đã hết hạn, hãy bấm kết nối lại')
    cfg = load_config()
    data = urllib.parse.urlencode({'code': code, 'client_id': cfg.get('yt_client_id', ''),
                                   'client_secret': cfg.get('yt_client_secret', ''),
                                   'redirect_uri': redirect_uri, 'grant_type': 'authorization_code'}).encode()
    obj = _json_or_error(*_request(GOOGLE_TOKEN, data, {'Content-Type': 'application/x-www-form-urlencoded'}, 'POST')[::2],
                         'Google từ chối kết nối')
    if not obj.get('refresh_token'):
        raise AutopostError('Google không trả refresh token, hãy gỡ quyền ứng dụng trong tài khoản Google rồi kết nối lại')
    cfg['yt_refresh_token'] = obj['refresh_token']
    save_config(cfg)


def _youtube_access_token(cfg):
    if not cfg.get('yt_refresh_token'):
        raise AutopostError('Chưa kết nối kênh YouTube')
    data = urllib.parse.urlencode({'client_id': cfg['yt_client_id'], 'client_secret': cfg['yt_client_secret'],
                                   'refresh_token': cfg['yt_refresh_token'], 'grant_type': 'refresh_token'}).encode()
    obj = _json_or_error(*_request(GOOGLE_TOKEN, data, {'Content-Type': 'application/x-www-form-urlencoded'}, 'POST')[::2],
                         'Không làm mới được quyền YouTube')
    return obj['access_token']


def youtube_upload(video_path, meta):
    """Tải video lên YouTube kiểu resumable, gửi từng khối để không giữ cả video trong RAM."""
    cfg = load_config()
    token = _youtube_access_token(cfg)
    size = os.path.getsize(video_path)
    if not size:
        raise AutopostError('Video rỗng')
    privacy = meta.get('privacy') if meta.get('privacy') in ('public', 'unlisted', 'private') else 'private'
    status_obj = {'privacyStatus': privacy, 'selfDeclaredMadeForKids': False}
    if meta.get('publish_at'):
        # YouTube chỉ hẹn giờ công khai với video đang để riêng tư
        status_obj.update(privacyStatus='private',
                          publishAt=time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime(int(meta['publish_at']))))
    body = json.dumps({'snippet': {'title': str(meta.get('title') or 'Video PSVIET.COM')[:100],
                                   'description': str(meta.get('description') or '')[:5000],
                                   'tags': [t for t in meta.get('tags', []) if isinstance(t, str)][:30],
                                   'categoryId': '20'},
                       'status': status_obj}).encode()
    st, headers, resp = _request(f'{YT_UPLOAD}?uploadType=resumable&part=snippet,status', body, {
        'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json; charset=UTF-8',
        'X-Upload-Content-Type': meta.get('mime') or 'video/*', 'X-Upload-Content-Length': str(size)}, 'POST')
    location = {k.lower(): v for k, v in headers.items()}.get('location')
    if st >= 400 or not location:
        _json_or_error(st, resp, 'YouTube từ chối tải lên')
        raise AutopostError('YouTube không trả địa chỉ tải lên')
    entry = {'platform': 'youtube', 'title': str(meta.get('title') or '')[:120], 'slot': meta.get('slot', ''),
             'scheduled_for': int(meta['publish_at']) if meta.get('publish_at') else None}
    try:
        sent = 0
        with open(video_path, 'rb') as f:
            while sent < size:
                chunk = f.read(CHUNK)
                end = sent + len(chunk) - 1
                st, headers, resp = _request(location, chunk, {
                    'Authorization': 'Bearer ' + token, 'Content-Length': str(len(chunk)),
                    'Content-Range': f'bytes {sent}-{end}/{size}'}, 'PUT', timeout=300)
                if st == 308:   # YouTube nhận khối này, chờ khối tiếp
                    rng = {k.lower(): v for k, v in headers.items()}.get('range', '')
                    sent = int(rng.rsplit('-', 1)[1]) + 1 if rng else end + 1
                    f.seek(sent)
                    continue
                obj = _json_or_error(st, resp, 'YouTube báo lỗi khi tải lên')
                sent = size
    except AutopostError as e:
        add_history(dict(entry, status='failed', error=str(e)))
        raise
    vid = obj.get('id', '')
    entry.update(status='scheduled' if entry['scheduled_for'] else 'published', id=vid,
                 url=f'https://youtu.be/{vid}' if vid else '', privacy=obj.get('status', {}).get('privacyStatus', privacy))
    add_history(entry)
    return entry
