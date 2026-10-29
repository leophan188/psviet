"""Thống kê truy cập website: lượt xem, người truy cập, máy/game được quan tâm, kênh liên hệ, nguồn truy cập.

Chỉ dùng thư viện chuẩn (sqlite3). Không lưu IP và không dùng cookie: mỗi người truy cập được nhận
diện bằng mã băm của (khoá đổi mỗi ngày + IP + trình duyệt), nên không thể lần ngược ra IP.
Dữ liệu ở analytics/stats.db (ngoài thư mục website/, không đưa lên GitHub).
"""
import hashlib
import os
import secrets
import sqlite3
import threading
import time
from urllib.parse import urlparse

ROOT = os.path.dirname(os.path.abspath(__file__))
DIR = os.path.join(ROOT, 'analytics')
DB_FILE = os.path.join(DIR, 'stats.db')
KEEP_DAYS = 400
KINDS = {'view', 'game', 'game_ask', 'machine', 'contact'}
BOT_WORDS = ('bot', 'crawl', 'spider', 'slurp', 'headless', 'preview', 'facebookexternalhit', 'curl', 'python', 'wget')
LIMIT_PER_HOUR = 300

_lock = threading.Lock()
_salt = {'day': '', 'value': ''}
_counts = {}          # mã người truy cập -> [số sự kiện, giờ]


def _db():
    os.makedirs(DIR, exist_ok=True)
    con = sqlite3.connect(DB_FILE, timeout=10)
    con.execute('''CREATE TABLE IF NOT EXISTS events (
        ts INTEGER, day TEXT, kind TEXT, item TEXT, path TEXT, ref TEXT, device TEXT, vid TEXT)''')
    con.execute('CREATE INDEX IF NOT EXISTS ev_day ON events(day, kind)')
    if 'camp' not in [r[1] for r in con.execute('PRAGMA table_info(events)')]:
        con.execute("ALTER TABLE events ADD COLUMN camp TEXT DEFAULT ''")   # chiến dịch quảng cáo (utm)
    return con


def _day(ts=None):
    return time.strftime('%Y-%m-%d', time.localtime(ts or time.time()))


def _visitor(ip, ua):
    """Mã ẩn danh của người truy cập, đổi mỗi ngày (khoá ngẫu nhiên chỉ nằm trong bộ nhớ)."""
    today = _day()
    if _salt['day'] != today:
        _salt.update(day=today, value=secrets.token_hex(16))
    return hashlib.sha256(f"{_salt['value']}|{ip}|{ua}".encode()).hexdigest()[:16]


def _referrer(ref, host):
    """Chỉ giữ tên miền nguồn bên ngoài; vào thẳng hoặc từ chính website thì để trống."""
    try:
        netloc = urlparse(ref or '').netloc.lower()
    except ValueError:
        return ''
    if not netloc or netloc == (host or '').lower():
        return ''
    return netloc[4:] if netloc.startswith('www.') else netloc


def record(body, ip, ua, host):
    """Ghi một sự kiện. Trả False nếu bỏ qua (bot, sai loại, gửi quá nhiều)."""
    ua = (ua or '')[:300]
    if not ua or any(w in ua.lower() for w in BOT_WORDS):
        return False
    kind = str(body.get('k') or '')
    if kind not in KINDS:
        return False
    vid = _visitor(ip, ua)
    hour = int(time.time() // 3600)
    with _lock:
        n, h = _counts.get(vid, (0, hour))
        n = n + 1 if h == hour else 1
        _counts[vid] = (n, hour)
        if len(_counts) > 50_000:
            _counts.clear()
    if n > LIMIT_PER_HOUR:
        return False
    device = 'Điện thoại' if any(w in ua for w in ('Mobi', 'Android', 'iPhone')) else 'Máy tính'
    now = int(time.time())
    row = (now, _day(now), kind, str(body.get('i') or '')[:80], str(body.get('p') or '')[:200],
           _referrer(body.get('r'), host)[:100], device, vid, str(body.get('c') or '')[:100])
    with _lock:
        con = _db()
        try:
            con.execute('INSERT INTO events (ts, day, kind, item, path, ref, device, vid, camp) VALUES (?,?,?,?,?,?,?,?,?)', row)
            if now % 97 == 0:   # thỉnh thoảng dọn dữ liệu quá cũ
                con.execute('DELETE FROM events WHERE ts < ?', (now - KEEP_DAYS * 86400,))
            con.commit()
        finally:
            con.close()
    return True


def summary(days=30):
    days = max(1, min(int(days or 30), 365))
    since_ts = time.time() - (days - 1) * 86400
    since = _day(since_ts)
    today = _day()
    week = _day(time.time() - 6 * 86400)
    month = _day(time.time() - 29 * 86400)
    con = _db()
    try:
        q = lambda sql, *a: con.execute(sql, a).fetchall()
        one = lambda sql, *a: (con.execute(sql, a).fetchone() or [0])[0] or 0
        visitors = lambda d: one("SELECT COUNT(DISTINCT day || vid) FROM events WHERE kind='view' AND day >= ?", d)
        views = lambda d: one("SELECT COUNT(*) FROM events WHERE kind='view' AND day >= ?", d)
        series = {d: [v, p] for d, v, p in q(
            "SELECT day, COUNT(DISTINCT vid), COUNT(*) FROM events WHERE kind='view' AND day >= ? GROUP BY day", since)}
        days_list = [_day(since_ts + i * 86400) for i in range(days)]
        top = lambda kind, n=10: q(
            "SELECT item, COUNT(*) c, COUNT(DISTINCT day || vid) FROM events WHERE kind=? AND day >= ? AND item != '' "
            "GROUP BY item ORDER BY c DESC LIMIT ?", kind, since, n)
        return {
            'days': days,
            'kpi': {
                'today': {'visitors': visitors(today), 'views': views(today)},
                'week': {'visitors': visitors(week), 'views': views(week)},
                'month': {'visitors': visitors(month), 'views': views(month)},
            },
            'daily': [{'day': d, 'visitors': series.get(d, [0, 0])[0], 'views': series.get(d, [0, 0])[1]} for d in days_list],
            'games': top('game'),
            'game_ask': top('game_ask'),
            'machines': top('machine'),
            'contacts': top('contact'),
            'pages': q("SELECT path, COUNT(*) c FROM events WHERE kind='view' AND day >= ? GROUP BY path ORDER BY c DESC LIMIT 8", since),
            'referrers': q("SELECT CASE WHEN ref = '' THEN '(vào thẳng)' ELSE ref END r, COUNT(DISTINCT day || vid) c "
                           "FROM events WHERE kind='view' AND day >= ? GROUP BY r ORDER BY c DESC LIMIT 8", since),
            # Chiến dịch: số người vào và số lượt bấm liên hệ
            'campaigns': q("SELECT camp, COUNT(DISTINCT CASE WHEN kind='view' THEN day || vid END) v, "
                           "SUM(kind='contact') c FROM events WHERE day >= ? AND camp != '' "
                           "GROUP BY camp ORDER BY v DESC LIMIT 10", since),
            'devices': q("SELECT device, COUNT(DISTINCT day || vid) c FROM events WHERE kind='view' AND day >= ? "
                         "GROUP BY device ORDER BY c DESC", since),
        }
    finally:
        con.close()
