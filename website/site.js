// Dùng chung cho mọi trang: tiện ích hiển thị, thông tin liên hệ, menu điện thoại, sáng/tối, bóng đổ header
(() => {
  const S = window.SITE || {};
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const esc = v => String(v ?? '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const icon = (name, cls = 'i') => `<svg class="${cls}" aria-hidden="true"><use href="#i-${esc(name)}"/></svg>`;
  const money = n => +n > 0 ? Number(n).toLocaleString('vi-VN') + 'đ' : 'Liên hệ';

  // Ảnh lỗi thì gỡ đi để hiện khung tên thay thế
  const imgFallback = root => root.querySelectorAll('.thumb img').forEach(img => {
    img.addEventListener('error', () => img.remove());
    if (img.complete && !img.naturalWidth) img.remove();
  });

  // Điền link/chữ liên hệ từ phần "Thông tin shop" trong trang quản trị
  const digits = v => String(v || '').replace(/[^\d+]/g, '');
  const link = (v, base) => !v ? '' : /^https?:\/\//.test(v) ? v : base + String(v).replace(/^@/, '');
  function applyContacts(root = document) {
    const s = S.settings || {};
    const links = {
      zalo: link(s.zalo && (/^https?:/.test(s.zalo) ? s.zalo : digits(s.zalo)), 'https://zalo.me/') || 'https://zalo.me/[SĐT]',
      messenger: link(s.messenger, 'https://m.me/') || 'https://m.me/[username-page]',
      telegram: link(s.telegram, 'https://t.me/') || 'https://t.me/[username]',
      tel: s.phone ? 'tel:' + digits(s.phone) : 'tel:[SĐT]',
      youtube: s.youtube || '[link-youtube]',
      facebook: s.facebook || '[link-facebook]',
    };
    // Kênh chưa điền trong "Thông tin shop" thì không để lộ link mẫu "[SĐT]": nút chính chuyển sang Messenger, còn lại ẩn đi
    const ready = h => h && !h.includes('[');
    root.querySelectorAll('[data-link]').forEach(a => {
      let href = links[a.dataset.link];
      if (!ready(href) && a.dataset.fallback && ready(links[a.dataset.fallback])) {
        href = links[a.dataset.fallback];
        a.querySelectorAll('use').forEach(u => u.setAttribute('href', '#i-chat'));
        a.querySelectorAll('span').forEach(sp => { sp.textContent = sp.textContent.replace('Zalo', 'Messenger'); });
        [...a.childNodes].filter(n => n.nodeType === 3).forEach(n => { n.textContent = n.textContent.replace('Zalo', 'Messenger'); });
      }
      if (href) a.href = href;
      const box = a.closest('.contact-list li, .site-footer p') || a;
      box.hidden = !ready(href);
    });
    const texts = { phone: s.phone, address: s.address, hours: s.hours, youtubeName: (String(s.youtube || '').match(/@[\w.-]+/) || [])[0] };
    root.querySelectorAll('[data-text]').forEach(el => {
      const t = texts[el.dataset.text];
      if (t) el.textContent = t;
      else if (/^\[.*\]/.test(el.textContent.trim())) (el.closest('.contact-list li, .site-footer p') || el).hidden = true;
    });
  }

  // Thẻ game dùng chung cho trang danh sách và mục "game cùng thể loại"
  const gameUrl = g => 'game.html?id=' + encodeURIComponent(g.id || '');
  // Loại game (chọn được nhiều); dữ liệu cũ chỉ có một "type"
  const typesOf = g => g.types || (g.type ? [g.type] : []);
  const typeNames = g => typesOf(g).map(id => ((S.gameTypes || []).find(c => c.id === id) || {}).name).filter(Boolean);
  // Hàng nhãn máy + loại, đặt ngoài ảnh bìa để không che ảnh
  const gameChips = (g, cls = '') => {
    const chips = (g.platforms || []).map(p => `<span class="gc gc-${esc(p.toLowerCase())}">${esc(p)}</span>`)
      .concat(typeNames(g).map(n => `<span class="gc gc-type">${esc(n)}</span>`));
    return chips.length ? `<div class="g-chips ${cls}">${chips.join('')}</div>` : '';
  };
  function gameCard(g) {
    const catName = ((S.gameCategories || []).find(c => c.id === g.category) || {}).name;
    const meta = [catName, g.players && g.players + ' người chơi'].filter(Boolean).join(' · ');
    return `
      <article class="game">
        <a class="game-cover thumb" href="${gameUrl(g)}" data-label="${esc(g.title)}">
          ${g.image ? `<img src="${esc(g.image)}" alt="${esc(g.title)}" loading="lazy">` : ''}
          ${g.hot ? '<span class="hot">HOT</span>' : ''}
        </a>
        <div class="game-body">
          ${gameChips(g)}
          <h3><a href="${gameUrl(g)}">${esc(g.title)}</a></h3>
          ${meta ? `<p class="meta">${esc(meta)}</p>` : ''}
          ${g.note ? `<p class="note">${esc(g.note)}</p>` : ''}
          ${g.price ? `<div class="product-price sm">${esc(g.price)}</div>` : ''}
          <a class="btn outline sm" href="${gameUrl(g)}">Xem chi tiết ${icon('arrow')}</a>
        </div>
      </article>`;
  }

  window.PSG = { esc, icon, money, imgFallback, applyContacts, gameCard, gameUrl, typesOf, typeNames, gameChips };
  applyContacts();

  // ---------- Menu điện thoại ----------
  const header = document.querySelector('.site-header');
  const toggle = document.querySelector('.menu-toggle');
  const nav = document.getElementById('main-nav');
  if (toggle && nav) {
    const setOpen = open => {
      document.body.classList.toggle('menu-open', open);
      toggle.setAttribute('aria-expanded', open);
      toggle.setAttribute('aria-label', open ? 'Đóng menu' : 'Mở menu');
    };
    toggle.addEventListener('click', () => setOpen(!document.body.classList.contains('menu-open')));
    nav.addEventListener('click', e => { if (e.target.closest('a')) setOpen(false); });
    document.addEventListener('keydown', e => { if (e.key === 'Escape') setOpen(false); });
  }

  // ---------- Giao diện sáng/tối, ghi nhớ lựa chọn ----------
  const root = document.documentElement;
  const meta = document.querySelector('meta[name="theme-color"]');
  const applyTheme = t => {
    root.dataset.theme = t;
    if (meta) meta.content = t === 'dark' ? '#0a1322' : '#ffffff';
  };
  applyTheme(root.dataset.theme === 'dark' ? 'dark' : 'light');
  document.querySelectorAll('.theme-toggle').forEach(btn => btn.addEventListener('click', () => {
    const next = root.dataset.theme === 'dark' ? 'light' : 'dark';
    try { localStorage.setItem('psviet-theme', next); } catch (e) {}
    if (!document.startViewTransition || calm) return applyTheme(next);
    // Giao diện mới loang ra thành vòng tròn từ chính nút vừa bấm
    const r = btn.getBoundingClientRect();
    root.style.setProperty('--tx', r.left + r.width / 2 + 'px');
    root.style.setProperty('--ty', r.top + r.height / 2 + 'px');
    root.classList.add('theme-vt');
    document.startViewTransition(() => applyTheme(next)).finished.finally(() => root.classList.remove('theme-vt'));
  }));

  // ---------- Bóng đổ header và thanh tiến độ khi cuộn ----------
  if (header) {
    const onScroll = () => {
      header.classList.toggle('scrolled', window.scrollY > 8);
      const max = document.documentElement.scrollHeight - window.innerHeight;
      header.style.setProperty('--progress', max > 0 ? Math.min(window.scrollY / max, 1) : 0);
    };
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  // ---------- Menu sáng theo mục đang xem ----------
  const navLinks = [...document.querySelectorAll('.main-nav a[href^="#"]')];
  const targets = navLinks.map(a => document.getElementById(a.getAttribute('href').slice(1))).filter(Boolean);
  if ('IntersectionObserver' in window && targets.length) {
    const spy = new IntersectionObserver(entries => entries.forEach(e => {
      if (e.isIntersecting) navLinks.forEach(a => a.classList.toggle('active', a.getAttribute('href') === '#' + e.target.id));
    }), { rootMargin: '-45% 0px -50% 0px' });
    targets.forEach(t => spy.observe(t));
  }

  // ---------- Chuyển trang mượt: ảnh bìa game bay sang trang chi tiết (trình duyệt hỗ trợ View Transitions) ----------
  const COVER = 'game-cover';
  const gameIdOf = href => {
    try {
      const u = new URL(href, location.href);
      return /\/game\.html$/.test(u.pathname) ? u.searchParams.get('id') : null;
    } catch (e) { return null; }
  };
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="game.html?id="]');
    if (!a || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    const cover = a.closest('.game') && a.closest('.game').querySelector('.game-cover');
    if (!cover) return;
    // Mỗi lần chuyển chỉ một ảnh được mang tên chung, kể cả khi quay lại trang từ bộ nhớ đệm
    document.querySelectorAll('.game-cover, .gd-cover').forEach(el => { el.style.viewTransitionName = 'none'; });
    cover.style.viewTransitionName = COVER;
    // Bỏ hiệu ứng phóng to khi rê chuột để ảnh không bị khựng lúc bay
    const img = cover.querySelector('img');
    if (img) { img.style.transition = 'none'; img.style.transform = 'none'; }
  });
  window.addEventListener('pagereveal', e => {
    const from = window.navigation && navigation.activation && navigation.activation.from;
    if (!e.viewTransition || !from || document.querySelector('.gd-cover')) return;
    // Quay lại danh sách từ trang chi tiết: ảnh bay ngược về đúng thẻ game
    const id = gameIdOf(from.url);
    const cover = id && [...document.querySelectorAll('a.game-cover')].find(c => gameIdOf(c.href) === id);
    if (!cover) return;
    cover.style.viewTransitionName = COVER;
    e.viewTransition.finished.finally(() => { cover.style.viewTransitionName = ''; });
  });

  // ---------- Hiện dần khi cuộn tới; gọi lại PSG.reveal(khung) sau mỗi lần dựng nội dung mới ----------
  const REVEAL = [
    '.section-head', '.line', '.product', '.feature', '.policy', '.faq details', '.steps li', '.game', '.game-band',
    '.table-wrap', '.trust li', '.tip', '.checklist-card', '.cta-band', '.filter-panel', '.footer-grid > *',
    '.page-hero:not(.gd-hero) .breadcrumb', '.page-hero:not(.gd-hero) h1', '.page-hero:not(.gd-hero) h1 ~ p',
    '.gd-article > *', '.gd-trailer',
  ].join(', ');
  const io = !calm && 'IntersectionObserver' in window && new IntersectionObserver(entries => entries.forEach(e => {
    if (!e.isIntersecting) return;
    const el = e.target;
    io.unobserve(el);
    el.classList.add('in');
    // Gỡ lớp sau khi chạy xong để hiệu ứng rê chuột của thẻ hoạt động bình thường
    setTimeout(() => { el.classList.remove('rv', 'in'); el.style.removeProperty('--rv-delay'); }, 1200);
  }), { rootMargin: '0px 0px -8% 0px' });
  function reveal(scope = document) {
    if (!io) return;
    scope.querySelectorAll(REVEAL).forEach(el => {
      // Thẻ trong dải trượt ngang đã có chuyển động riêng; ẩn chờ cuộn dọc sẽ để lại ô trống
      if (el.dataset.rv || el.closest('.game-slider')) return;
      el.dataset.rv = '1';
      el.style.setProperty('--rv-delay', ([...el.parentElement.children].indexOf(el) % 6) * 80 + 'ms');
      el.classList.add('rv');
      io.observe(el);
    });
  }
  // Thẻ bật lên lần lượt (kết quả lọc, danh sách vừa dựng lại)
  function popIn(els) {
    if (calm) return;
    [...els].forEach((el, i) => {
      el.classList.remove('pop');
      void el.offsetWidth;
      el.style.setProperty('--pop-delay', Math.min(i, 10) * 40 + 'ms');
      el.classList.add('pop');
      el.addEventListener('animationend', () => el.classList.remove('pop'), { once: true });
    });
  }
  Object.assign(window.PSG, { reveal, popIn });
  document.addEventListener('DOMContentLoaded', () => reveal());
})();
