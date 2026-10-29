"""SEO và xem trước khi chia sẻ link: thẻ og:*, tiêu đề riêng từng game, dữ liệu cửa hàng cho Google,
robots.txt và sitemap.xml. Mọi thứ dựng từ website/data.js nên sửa trong trang quản trị là tự cập nhật.

Facebook/Zalo không chạy JavaScript khi đọc link, nên thông tin từng game phải được chèn sẵn vào HTML ở server.
"""
import html
import json
import os
import re
from urllib.parse import quote

ROOT = os.path.dirname(os.path.abspath(__file__))
WEB = os.path.join(ROOT, 'website')
DATA_FILE = os.path.join(WEB, 'data.js')
OG_IMAGE = 'assets/brand/psviet-og.jpg'          # 1200x630, đúng khung Facebook
BRAND = 'PSVIET.COM'
SITE_URL = 'https://psviet.com'
PAGES = {'/': 'index.html', '/index.html': 'index.html', '/games.html': 'games.html',
         '/game.html': 'game.html', '/rieng-tu.html': 'rieng-tu.html'}

_cache = {'mtime': None, 'site': {}}


def site_data():
    """Đọc data.js (có cache theo thời gian sửa file)."""
    try:
        mtime = os.path.getmtime(DATA_FILE)
        if mtime != _cache['mtime']:
            text = open(DATA_FILE, encoding='utf-8').read()
            _cache.update(mtime=mtime, site=json.loads(text[text.index('{'):text.rindex('}') + 1]))
    except (OSError, ValueError):
        pass
    return _cache['site']


def _plain(text, limit=160):
    """Bỏ ký hiệu markdown, gộp dòng, cắt gọn cho thẻ mô tả."""
    t = re.sub(r'[#*_>`]+', '', str(text or ''))
    t = re.sub(r'\s+', ' ', t).strip()
    return t if len(t) <= limit else t[:limit - 1].rsplit(' ', 1)[0] + '…'


def _games(site):
    return [g for g in site.get('games', []) if g.get('visible') is not False and g.get('id')]


def _machines(site):
    return [p for p in site.get('products', []) if p.get('visible') is not False and p.get('status') != 'sold']


def _store_ld(site, base):
    s = site.get('settings') or {}
    store = {'@context': 'https://schema.org', '@type': 'Store', 'name': BRAND, 'url': base + '/',
             'logo': base + '/assets/brand/psviet-logo-512.png', 'image': base + '/' + OG_IMAGE,
             'description': 'PS5 Fat, Slim, Pro cũ nguyên bản. Đổi máy 7 ngày, bảo hành 3 tháng, cài game miễn phí, ship COD toàn quốc.',
             'priceRange': '₫₫', 'currenciesAccepted': 'VND', 'areaServed': 'VN',
             'sameAs': [u for u in (s.get('facebook'), s.get('youtube')) if u]}
    if s.get('phone'):
        store['telephone'] = s['phone']
    if s.get('address'):
        store['address'] = {'@type': 'PostalAddress', 'streetAddress': s['address'], 'addressCountry': 'VN'}
    hours = re.findall(r'(\d{1,2}):(\d{2})', s.get('hours') or '')
    if len(hours) >= 2:
        store['openingHours'] = 'Mo-Su {:02d}:{}-{:02d}:{}'.format(int(hours[0][0]), hours[0][1], int(hours[1][0]), hours[1][1])
    products = [{'@type': 'Product', 'name': p.get('name'), 'image': base + '/' + p['image'] if p.get('image') else None,
                 'brand': {'@type': 'Brand', 'name': 'Sony'},
                 'offers': {'@type': 'Offer', 'price': str(p.get('price')), 'priceCurrency': 'VND',
                            'availability': 'https://schema.org/InStock', 'itemCondition': 'https://schema.org/UsedCondition',
                            'url': base + '/#may', 'seller': {'@type': 'Organization', 'name': BRAND}}}
                for p in _machines(site) if p.get('price')]
    for p in products:
        if not p['image']:
            del p['image']
    graph = [store] + ([{'@context': 'https://schema.org', '@type': 'ItemList', 'name': 'PS5 đang bán tại ' + BRAND,
                         'itemListElement': [{'@type': 'ListItem', 'position': i + 1, 'item': p} for i, p in enumerate(products)]}]
                       if products else [])
    return graph


def page_meta(path, query, base):
    """Trả (title, description, image, url, json_ld) cho trang; None nếu không xử lý."""
    site = site_data()
    url = base + ('/' if path in ('/', '/index.html') else path)
    image = base + '/' + OG_IMAGE
    if path in ('/', '/index.html'):
        return None, None, image, url, _store_ld(site, base)
    if path == '/game.html':
        gid = (query.get('id') or [''])[0]
        g = next((x for x in _games(site) if x.get('id') == gid), None)
        if not g:
            return None, None, image, url, None
        plats = ', '.join(g.get('platforms') or [])
        title = f"{g['title']}{' (' + plats + ')' if plats else ''} – cài miễn phí khi mua máy | {BRAND}"
        intro = str(g.get('content') or '').split('\n\n')[0]
        lead = _plain(intro, 120)
        if not lead.lower().startswith(g['title'].lower()):
            lead = f"{g['title']}: {lead}"
        desc = _plain(f"{lead} Mua máy tại {BRAND} được cài game miễn phí.")
        img = base + '/' + g['image'] if g.get('image') else image
        return title, desc, img, f"{base}/game.html?id={quote(gid)}", {
            '@context': 'https://schema.org', '@type': 'VideoGame', 'name': g['title'], 'url': f"{base}/game.html?id={quote(gid)}",
            'image': img, 'gamePlatform': g.get('platforms') or [], 'description': desc}
    return None, None, image, url, None


def render(path, query, base):
    """HTML của trang đã chèn thẻ SEO; None nếu không phải trang cần xử lý."""
    name = PAGES.get(path)
    if not name:
        return None
    try:
        page = open(os.path.join(WEB, name), encoding='utf-8').read()
    except OSError:
        return None
    title, desc, image, url, ld = page_meta(path, query, base)
    if title:
        page = re.sub(r'<title>.*?</title>', f'<title>{html.escape(title)}</title>', page, count=1, flags=re.S)
    if desc:
        page = re.sub(r'<meta name="description" content="[^"]*">', f'<meta name="description" content="{html.escape(desc)}">', page, count=1)
    title = title or html.unescape(re.search(r'<title>(.*?)</title>', page, re.S).group(1))
    m = re.search(r'<meta name="description" content="([^"]*)">', page)
    desc = desc or (html.unescape(m.group(1)) if m else '')
    # Thay toàn bộ thẻ og/twitter/canonical cũ bằng bộ đầy đủ, đường dẫn tuyệt đối
    page = re.sub(r'\s*<meta (?:property="og:|name="twitter:)[^>]*>|\s*<link rel="canonical"[^>]*>', '', page)
    tags = [f'<link rel="canonical" href="{html.escape(url)}">',
            f'<meta property="og:site_name" content="{BRAND}">',
            '<meta property="og:locale" content="vi_VN">',
            f'<meta property="og:type" content="{"website" if path in ("/", "/index.html") else "article"}">',
            f'<meta property="og:url" content="{html.escape(url)}">',
            f'<meta property="og:title" content="{html.escape(title)}">',
            f'<meta property="og:description" content="{html.escape(desc)}">',
            f'<meta property="og:image" content="{html.escape(image)}">',
            '<meta name="twitter:card" content="summary_large_image">']
    if image.endswith(OG_IMAGE):
        tags[7:7] = ['<meta property="og:image:width" content="1200">', '<meta property="og:image:height" content="630">']
    if ld:
        tags.append('<script type="application/ld+json">' + json.dumps(ld, ensure_ascii=False).replace('</', '<\\/') + '</script>')
    return page.replace('</head>', '  ' + '\n  '.join(tags) + '\n</head>', 1)


def robots(base):
    return f'User-agent: *\nDisallow: /admin.html\nDisallow: /api/\nSitemap: {base}/sitemap.xml\n'


def sitemap(base):
    site = site_data()
    urls = [base + '/', base + '/games.html'] + [f"{base}/game.html?id={quote(g['id'])}" for g in _games(site)] + [base + '/rieng-tu.html']
    body = ''.join(f'<url><loc>{html.escape(u)}</loc></url>' for u in urls)
    return f'<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">{body}</urlset>\n'
