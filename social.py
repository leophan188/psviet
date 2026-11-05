"""Thống kê mạng xã hội cho trang quản trị: Fanpage Facebook và kênh YouTube.

Facebook dùng mã Fanpage đã kết nối ở "Kết nối & lịch sử":
- số người theo dõi: quyền pages_read_engagement (đã có)
- lượt xem, người tiếp cận, lượt bấm: quyền read_insights
- cảm xúc, bình luận, chia sẻ của từng bài: quyền pages_read_user_content
YouTube dùng API key (YouTube Data API v3), chỉ đọc số liệu công khai của kênh ghi trong "Thông tin shop".

Facebook/YouTube chỉ trả số liệu tại thời điểm hỏi, nên mỗi ngày lưu một bản vào analytics/stats.db
để vẽ biểu đồ tăng trưởng (luồng nền ghi vài giờ một lần, mở trang Thống kê cũng ghi).
"""
import json
import re
import threading
from concurrent.futures import ThreadPoolExecutor
import time
import urllib.parse

import analytics
import autopost
import seo

GRAPH = 'https://graph.facebook.com/v26.0/'
YT_API = 'https://www.googleapis.com/youtube/v3/'
CACHE_SECONDS = 600
SNAPSHOT_EVERY = 6 * 3600
MAX_POSTS = 25
# Tên chỉ số hiện hành của Meta (các chỉ số "impressions" cũ đã bị bỏ năm 2025)
PAGE_METRICS = ('page_media_view', 'page_total_media_view_unique', 'page_post_engagements')
POST_METRICS = ('post_media_view', 'post_total_media_view_unique', 'post_clicks')

_cache = {}
_lock = threading.Lock()


class SocialError(Exception):
    pass


# ---------- Lưu số liệu theo ngày ----------
def _db():
    con = analytics._db()
    con.execute('''CREATE TABLE IF NOT EXISTS social_daily (
        day TEXT, source TEXT, metric TEXT, value INTEGER, PRIMARY KEY (day, source, metric))''')
    return con


def _snapshot(source, values):
    con = _db()
    with con:
        for metric, value in values.items():
            if value is not None:
                con.execute('INSERT OR REPLACE INTO social_daily VALUES (?, ?, ?, ?)', (analytics._day(), source, metric, int(value)))
    con.close()


def _series(source, metric, days):
    since = analytics._day(time.time() - days * 86400)
    con = _db()
    rows = con.execute('SELECT day, value FROM social_daily WHERE source = ? AND metric = ? AND day > ? ORDER BY day',
                       (source, metric, since)).fetchall()
    con.close()
    return [list(r) for r in rows]


# ---------- HTTP ----------
def _get(url):
    status, _, body = autopost._request(url, timeout=20)
    try:
        obj = json.loads(body or b'{}')
    except ValueError:
        obj = {}
    if status >= 400:
        err = obj.get('error') or {}
        raise SocialError(err.get('message') if isinstance(err, dict) else str(err) or f'HTTP {status}')
    return obj


def _fb(path, token, **params):
    params['access_token'] = token
    return _get(GRAPH + path + '?' + urllib.parse.urlencode(params))


def _fb_batch(token, urls):
    """Gửi nhiều câu hỏi Graph trong một lần (Batch API, tối đa 50 câu/lần).
    Máy chủ cách Facebook ~0,5 giây mỗi lượt, mỗi câu hỏi riêng tốn ~2 giây, nên gộp lại cho nhanh.
    Trả về danh sách kết quả theo thứ tự: dict, hoặc SocialError nếu câu đó lỗi."""
    def chunk(part):
        data = urllib.parse.urlencode({'access_token': token, 'include_headers': 'false',
                                       'batch': json.dumps([{'method': 'GET', 'relative_url': u} for u in part])}).encode()
        status, _, body = autopost._request(GRAPH, data=data, timeout=30)
        try:
            res = json.loads(body or b'[]')
        except ValueError:
            res = None
        if status >= 400 or not isinstance(res, list):
            err = (res or {}).get('error', {}) if isinstance(res, dict) else {}
            return [SocialError(err.get('message') or f'HTTP {status}')] * len(part)
        out = []
        for r in res:
            try:
                obj = json.loads((r or {}).get('body') or '{}')
            except ValueError:
                obj = {}
            if not r or r.get('code', 500) >= 400:
                out.append(SocialError(((obj.get('error') or {}).get('message')) or 'Lỗi'))
            else:
                out.append(obj)
        return out
    parts = [urls[i:i + 50] for i in range(0, len(urls), 50)]
    with ThreadPoolExecutor(max_workers=4) as pool:
        return [r for part in pool.map(chunk, parts) for r in part]


# ---------- Facebook ----------
def _fb_values(rows):
    """Bảng insights của Facebook -> {tên chỉ số: [[ngày, giá trị], ...]}."""
    out = {}
    for m in rows or []:
        vals = []
        for v in m.get('values') or []:
            val = v.get('value')
            if isinstance(val, dict):          # vd. cảm xúc theo loại: cộng lại
                val = sum(x for x in val.values() if isinstance(x, (int, float)))
            vals.append([str(v.get('end_time', ''))[:10], int(val or 0)])
        out[m.get('name')] = vals
    return out


def facebook(days):
    cfg = autopost.load_config()
    token, page_id = cfg.get('fb_token'), cfg.get('fb_page_id')
    if not (token and page_id):
        return {'connected': False}
    out = {'connected': True, 'page_name': cfg.get('fb_page_name', ''), 'perm': {'insights': False, 'engagement': False},
           'token_expires': cfg.get('fb_token_expires')}
    # Các bài đã đăng lên Page qua web (lấy từ lịch sử đăng bài)
    since = time.time() - days * 86400
    hist = [h for h in autopost.status()['history'] if h.get('platform') == 'facebook' and h.get('status') == 'published'
            and h.get('id') and h.get('time', 0) >= since][:MAX_POSTS]
    posts = [{'id': h['id'], 'title': h.get('title', ''), 'url': h.get('url', ''), 'time': h.get('time')} for h in hist]

    # Một lần gửi: thông tin Page, số liệu Page theo ngày, rồi tương tác + insights của từng bài
    until = int(time.time())
    q = urllib.parse.urlencode
    urls = [f"{page_id}?{q({'fields': 'name,link,followers_count,fan_count'})}",
            f"{page_id}/insights?{q({'metric': ','.join(PAGE_METRICS), 'period': 'day', 'since': until - min(days, 90) * 86400, 'until': until})}"]
    for p in posts:
        urls.append(f"{p['id']}?{q({'fields': 'reactions.summary(true).limit(0),comments.summary(true).limit(0),shares'})}")
        urls.append(f"{p['id']}/insights?{q({'metric': ','.join(POST_METRICS)})}")
    res = _fb_batch(token, urls)

    page = res[0]
    if isinstance(page, SocialError):
        return {**out, 'error': str(page)}
    out['page_name'] = page.get('name') or out['page_name']
    out['link'] = page.get('link') or f'https://www.facebook.com/{page_id}'
    out['followers'] = page.get('followers_count') or page.get('fan_count') or 0
    _snapshot('facebook', {'followers': out['followers']})

    # Số liệu cả Page theo ngày (cần read_insights; thiếu quyền thì Facebook trả danh sách rỗng)
    daily = {} if isinstance(res[1], SocialError) else _fb_values(res[1].get('data'))
    out['perm']['insights'] = any(daily.values())
    out['page_daily'] = daily

    for i, p in enumerate(posts):
        e, ins = res[2 + 2 * i], res[3 + 2 * i]
        if not isinstance(e, SocialError):
            p['reactions'] = ((e.get('reactions') or {}).get('summary') or {}).get('total_count', 0)
            p['comments'] = ((e.get('comments') or {}).get('summary') or {}).get('total_count', 0)
            p['shares'] = (e.get('shares') or {}).get('count', 0)
        if not isinstance(ins, SocialError):
            vals = _fb_values(ins.get('data'))
            if any(vals.values()):
                p['views'] = sum(v for _, v in vals.get('post_media_view', []))
                p['reach'] = sum(v for _, v in vals.get('post_total_media_view_unique', []))
                p['clicks'] = sum(v for _, v in vals.get('post_clicks', []))
    out['perm']['engagement'] = any('reactions' in p for p in posts)
    out['perm']['insights'] = out['perm']['insights'] or any('views' in p for p in posts)
    out['posts'] = posts
    return out


# ---------- YouTube ----------
def _channel_ref():
    """Kênh YouTube trong "Thông tin shop": ('forHandle', '@ten') hoặc ('id', 'UC...')."""
    url = str((seo.site_data().get('settings') or {}).get('youtube') or '')
    m = re.search(r'/channel/(UC[\w-]{22})', url)
    if m:
        return 'id', m.group(1), url
    m = re.search(r'/(@[\w.-]+)', url)
    return ('forHandle', m.group(1), url) if m else (None, None, url)


def youtube(days):
    cfg = autopost.load_config()
    key = cfg.get('yt_api_key')
    kind, ref, url = _channel_ref()
    if not key:
        return {'connected': False, 'channel_url': url}
    if not kind:
        return {'connected': True, 'error': 'Chưa có link kênh YouTube trong "Thông tin shop"'}
    q = lambda path, **p: _get(YT_API + path + '?' + urllib.parse.urlencode({**p, 'key': key}))
    try:
        items = q('channels', part='snippet,statistics,contentDetails', **{kind: ref}).get('items') or []
        if not items:
            return {'connected': True, 'error': f'Không tìm thấy kênh {ref}'}
        ch = items[0]
        stats = ch.get('statistics') or {}
        uploads = ((ch.get('contentDetails') or {}).get('relatedPlaylists') or {}).get('uploads')
        ids = [i['contentDetails']['videoId'] for i in
               (q('playlistItems', part='contentDetails', playlistId=uploads, maxResults=50).get('items') or [])] if uploads else []
        videos = []
        if ids:
            for v in q('videos', part='snippet,statistics', id=','.join(ids)).get('items') or []:
                s, sn = v.get('statistics') or {}, v.get('snippet') or {}
                videos.append({'id': v['id'], 'title': sn.get('title', ''), 'published': sn.get('publishedAt', '')[:10],
                               'thumb': ((sn.get('thumbnails') or {}).get('medium') or {}).get('url', ''),
                               'views': int(s.get('viewCount', 0)), 'likes': int(s.get('likeCount', 0)),
                               'comments': int(s.get('commentCount', 0))})
    except SocialError as e:
        return {'connected': True, 'error': str(e)}
    videos.sort(key=lambda v: v['published'], reverse=True)
    out = {'connected': True, 'title': (ch.get('snippet') or {}).get('title', ''), 'channel_url': url,
           'subscribers': int(stats.get('subscriberCount', 0)), 'views': int(stats.get('viewCount', 0)),
           'video_count': int(stats.get('videoCount', 0)), 'videos': videos}
    _snapshot('youtube', {'subscribers': out['subscribers'], 'views': out['views'], 'videos': out['video_count']})
    return out


# ---------- Cho trang quản trị ----------
def summary(days=30, refresh=False):
    days = max(1, min(int(days), 365))
    with _lock:
        hit = _cache.get(days)
        if hit and not refresh and time.time() - hit[0] < CACHE_SECONDS:
            data = hit[1]
        else:
            data = {'facebook': facebook(days), 'youtube': youtube(days), 'updated': int(time.time())}
            _cache[days] = (time.time(), data)
    # Chuỗi theo ngày đọc lại mỗi lần (rẻ), để số vừa lưu hiện ngay
    data = {**data,
            'facebook': {**data['facebook'], 'followers_series': _series('facebook', 'followers', days)},
            'youtube': {**data['youtube'], 'subscribers_series': _series('youtube', 'subscribers', days),
                        'views_series': _series('youtube', 'views', days)}}
    return data


def _loop():
    while True:
        try:
            summary(30, refresh=True)
        except Exception:
            pass   # lỗi mạng tạm thời: lần sau thử lại
        time.sleep(SNAPSHOT_EVERY)


def start_background():
    """Ghi số liệu vài giờ một lần, kể cả khi không ai mở trang Thống kê."""
    threading.Thread(target=_loop, daemon=True).start()
