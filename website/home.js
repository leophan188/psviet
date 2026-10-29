// Trang chủ: hiển thị máy, danh mục, chính sách, hỏi đáp từ data.js; banner chạy ảnh; popup chọn máy
(() => {
  const S = window.SITE || {};
  const { esc, icon, money, imgFallback } = window.PSG;
  const cats = S.machineCategories || [];
  const catById = Object.fromEntries(cats.map(c => [c.id, c]));
  const statusOrder = { available: 0, coming: 1, sold: 2 };
  const products = (S.products || [])
    .filter(p => p.visible !== false)
    .map((p, i) => ({ ...p, _i: i }))
    .sort((a, b) => (statusOrder[a.status] ?? 0) - (statusOrder[b.status] ?? 0) || (b.featured - a.featured) || a._i - b._i);

  // Máy rẻ nhất trong các máy chưa bán thỏa điều kiện (hết máy chưa bán thì xét cả máy đã bán)
  const cheapest = pred => {
    const pick = list => list.filter(p => +p.price > 0 && pred(p));
    const live = pick(products.filter(p => p.status !== 'sold'));
    const all = live.length ? live : pick(products);
    return all.reduce((a, p) => (!a || +p.price < +a.price ? p : a), null);
  };
  // Giá gốc gạch ngang, chỉ hiện khi cao hơn giá bán
  const oldPrice = p => p && +p.oldPrice > +p.price ? ` <s class="old-price">${money(p.oldPrice)}</s>` : '';
  const DRIVE = { disc: ['disc', 'Có ổ đĩa'], digital: ['cloud', 'Digital'] };
  const STATUS = { available: 'Còn hàng', coming: 'Sắp về', sold: 'Đã bán' };

  const bullet = t => {
    const i = t.indexOf(':');
    return i > 0 ? `<b>${esc(t.slice(0, i))}</b>${esc(t.slice(i + 1))}` : esc(t);
  };

  // ---------- Dải cam kết ----------
  const trust = document.getElementById('trust');
  if (trust) trust.innerHTML = (S.highlights || []).map(h => `
      <li><span class="trust-ic">${icon(h.icon || 'check')}</span><div><strong>${esc(h.title)}</strong><span>${esc(h.text)}</span></div></li>`).join('');

  // ---------- Danh mục máy ----------
  const lines = document.getElementById('lines');
  if (lines) lines.innerHTML = cats.map(c => {
    const best = cheapest(p => p.category === c.id);
    const price = best ? +best.price : 0;
    return `
        <article class="line${c.highlight ? ' featured' : ''}">
          <div class="line-media thumb" data-label="${esc(c.name)}">${c.image ? `<img src="${esc(c.image)}" alt="${esc(c.name)}" loading="lazy">` : ''}</div>
          ${c.tag ? `<span class="line-tag">${esc(c.tag)}</span>` : ''}
          <h3>${esc(c.name)}</h3>
          ${c.description ? `<p>${esc(c.description)}</p>` : ''}
          ${(c.bullets || []).length ? `<ul class="variants">${c.bullets.map(b => `<li>${icon('check')}<span>${bullet(b)}</span></li>`).join('')}</ul>` : ''}
          <div class="line-foot"><div>${price ? `<small>Chỉ từ</small><strong>${money(price)}</strong>${oldPrice(best)}` : '<small>Giá</small><strong>Liên hệ</strong>'}</div><a class="btn ${c.highlight ? 'primary' : 'outline'} sm" href="#may" data-jump="${esc(c.id)}">Xem máy</a></div>
        </article>`;
  }).join('');

  // ---------- Bộ lọc + thẻ máy ----------

  const perk = (S.settings || {}).productPerk;
  const list = document.getElementById('products');
  if (list) list.innerHTML = products.length ? products.map(p => {
    const cat = catById[p.category];
    const img = p.image || (cat && cat.image) || '';
    const d = DRIVE[p.drive];
    const off = +p.oldPrice > +p.price && +p.price > 0 ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const sold = p.status === 'sold';
    return `
        <article class="product${sold ? ' is-sold' : ''}" data-id="${esc(p.id)}" data-line="${esc(p.category)}" data-drive="${esc(p.drive || '')}">
          <div class="product-media thumb" data-label="${esc(p.name)}">
            ${img ? `<img src="${esc(img)}" alt="${esc(p.name)} cũ" loading="lazy">` : ''}
            <span class="stock ${esc(p.status || 'available')}">${STATUS[p.status] || STATUS.available}</span>
            ${off ? `<span class="discount">-${off}%</span>` : ''}
          </div>
          <div class="product-body">
            <div class="chips">
              ${d ? `<span class="chip-tag ${p.drive}">${icon(d[0])}${d[1]}</span>` : ''}
              ${p.storage ? `<span class="chip-tag">SSD ${esc(p.storage)}</span>` : ''}
              ${p.condition ? `<span class="chip-tag">Đẹp ${esc(p.condition)}</span>` : ''}
            </div>
            <h3>${p.url ? `<a href="${esc(p.url)}">${esc(p.name)}</a>` : esc(p.name)}</h3>
            ${p.note ? `<p class="product-note">${esc(p.note)}</p>` : ''}
            <div class="product-price">${money(p.price)}${off ? ` <s>${money(p.oldPrice)}</s>` : ''}</div>
            <ul class="perks">
              ${perk ? `<li>${icon('check')}${esc(perk)}</li>` : ''}
              ${p.includes ? `<li>${icon('check')}Kèm ${esc(p.includes)}</li>` : ''}
            </ul>
            <div class="product-actions">
              <a class="btn primary" href="#" data-link="messenger">${icon('chat')}${sold ? 'Hỏi máy tương tự' : 'Hỏi máy này'}</a>
              <a class="btn outline icon-only" href="#" data-link="zalo" aria-label="Hỏi qua Zalo">${icon('zalo')}</a>
            </div>
          </div>
        </article>`;
  }).join('') : '<p class="empty">Hiện chưa có máy nào, shop đang cập nhật.</p>';

  // Ít máy nên hiện tất cả; khi chọn một dòng (Xem máy Slim, popup gợi ý) thì làm sáng các máy dòng đó
  const productEls = () => document.querySelectorAll('.product');
  function highlightLine(f) {
    const hit = [...productEls()].filter(p => p.dataset.line === f || p.dataset.drive === f);
    hit.forEach(p => { p.classList.remove('picked'); void p.offsetWidth; p.classList.add('picked'); });
    return hit;
  }
  document.addEventListener('click', e => {
    const jump = e.target.closest('[data-jump]');
    if (jump) highlightLine(jump.dataset.jump);
  });

  // ---------- Giá trên banner và bảng so sánh ----------
  document.querySelectorAll('[data-from]').forEach(el => {
    const best = cheapest(p => p.category === el.dataset.from);
    if (best) el.innerHTML = money(best.price) + oldPrice(best);
  });
  document.querySelectorAll('[data-price]').forEach(el => {
    const [cat, drive] = el.dataset.price.split(':');
    const best = cheapest(p => p.category === cat && (!drive || p.drive === drive));
    el.innerHTML = best ? money(best.price) + oldPrice(best) : 'Liên hệ';
  });

  // ---------- Dải game trượt ngang: game HOT trước, rồi A–Z; tự chạy, dừng khi rê chuột/chạm ----------
  const slider = document.getElementById('game-slider');
  if (slider) {
    const byName = (a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' });
    const list = (S.games || []).filter(g => g.visible !== false).sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || byName(a, b)).slice(0, 16);
    slider.innerHTML = list.map(window.PSG.gameCard).join('');
    window.PSG.applyContacts(slider);
    imgFallback(slider);
    const step = () => (slider.querySelector('.game')?.offsetWidth || 200) + 16;
    const move = dir => {
      const end = slider.scrollLeft + slider.clientWidth >= slider.scrollWidth - 4;
      if (dir > 0 && end) slider.scrollTo({ left: 0, behavior: 'smooth' });
      else slider.scrollBy({ left: dir * step(), behavior: 'smooth' });
    };
    document.querySelectorAll('[data-gs]').forEach(b => b.addEventListener('click', () => move(+b.dataset.gs)));
    const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let paused = false, visible = false;
    ['mouseenter', 'focusin', 'touchstart'].forEach(ev => slider.addEventListener(ev, () => { paused = true; }, { passive: true }));
    ['mouseleave', 'focusout'].forEach(ev => slider.addEventListener(ev, () => { paused = false; }));
    if ('IntersectionObserver' in window) new IntersectionObserver(([e]) => { visible = e.isIntersecting; }).observe(slider);
    if (!calm && list.length > 1) setInterval(() => { if (visible && !paused && !document.hidden) move(1); }, 3500);
  }

  // ---------- Chính sách ----------
  const policies = document.getElementById('policies');
  if (policies) policies.innerHTML = (S.policies || []).map(p => `
        <div class="policy">
          <h3><span class="p-ic">${icon(p.icon || 'shield')}</span>${esc(p.title)}</h3>
          <ul>${(p.items || []).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>`).join('');

  // ---------- Hỏi đáp ----------
  const faq = document.getElementById('faq-list');
  if (faq) faq.innerHTML = (S.faq || []).map(f => `
        <details><summary>${esc(f.q)}${icon('plus')}</summary><p>${esc(f.a).replace(/\n/g, '<br>')}</p></details>`).join('');

  // ---------- Popup chọn máy ----------
  const pickBox = document.getElementById('picker-options');
  if (pickBox) pickBox.innerHTML = cats.filter(c => products.some(p => p.category === c.id)).slice(0, 4).map(c => {
    const best = cheapest(p => p.category === c.id);
    const price = best ? +best.price : 0;
    return `<button class="pick" type="button" data-pick="${esc(c.id)}">${c.highlight && c.tag ? `<span class="pick-tag">${esc(c.tag)}</span>` : ''}<span class="pick-img">${c.image ? `<img src="${esc(c.image)}" alt="">` : ''}</span><b>${esc(c.name)}</b>${!c.highlight && c.tag ? `<small>${esc(c.tag)}</small>` : '<small>&nbsp;</small>'}<strong>${price ? 'Từ ' + money(price) : 'Liên hệ'}</strong>${oldPrice(best)}</button>`;
  }).join('');

  (() => {
    const dlg = document.getElementById('picker');
    if (!dlg || typeof dlg.showModal !== 'function' || !pickBox || !pickBox.children.length) return;
    const KEY = 'psviet-picker-seen';
    let seen = false;
    try { seen = sessionStorage.getItem(KEY) === '1'; } catch (e) {}
    const close = () => dlg.close();
    dlg.querySelector('.picker-close').onclick = close;
    dlg.querySelector('.picker-skip').onclick = close;
    dlg.addEventListener('click', e => {
      if (e.target === dlg) return close();
      const b = e.target.closest('[data-pick]');
      if (!b) return;
      const pick = b.dataset.pick;
      close();
      if (pick === 'compare') {
        document.getElementById('so-sanh').scrollIntoView({ behavior: 'smooth' });
        return;
      }
      document.getElementById('may').scrollIntoView({ behavior: 'smooth' });
      highlightLine(pick);
    });
    const open = () => {
      if (dlg.open || document.querySelector('dialog[open]')) return;
      dlg.showModal();
      try { sessionStorage.setItem(KEY, '1'); } catch (e) {}
    };
    // Nút "Để shop gợi ý" mở lại popup bất cứ lúc nào
    document.addEventListener('click', e => {
      if (e.target.closest('[data-open-picker]')) { e.preventDefault(); open(); }
    });
    // Tự hiện 1 lần mỗi phiên; thêm ?chon-may vào link để luôn hiện
    const force = new URLSearchParams(location.search).has('chon-may');
    if (!seen || force) setTimeout(open, force ? 300 : 1200);
  })();

  // ---------- Banner chạy ảnh ----------
  (() => {
    const track = document.getElementById('slides');
    if (!track) return;
    const slides = [...track.children];
    const dotsBox = document.querySelector('.hero .dots');
    const dots = slides.map((_, i) => {
      const d = document.createElement('button');
      d.type = 'button';
      d.setAttribute('aria-label', 'Slide ' + (i + 1));
      d.onclick = () => go(i);
      dotsBox.append(d);
      return d;
    });
    let index = 0, timer = null;
    const current = () => Math.round(track.scrollLeft / track.clientWidth);
    function setDot(i) {
      index = i;
      dots.forEach((d, j) => d.setAttribute('aria-current', j === i));
    }
    function go(i) {
      setDot((i + slides.length) % slides.length);
      track.scrollTo({ left: index * track.clientWidth, behavior: 'smooth' });
    }
    // Khi khách tự vuốt: cập nhật chấm sau khi dừng cuộn
    let settle;
    track.addEventListener('scroll', () => {
      clearTimeout(settle);
      settle = setTimeout(() => setDot(current()), 120);
    }, { passive: true });
    document.querySelector('.slide-nav.prev').onclick = () => go(index - 1);
    document.querySelector('.slide-nav.next').onclick = () => go(index + 1);

    const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
    const play = () => { if (!reduce && !timer) timer = setInterval(() => go(index + 1), 5000); };
    const pause = () => { clearInterval(timer); timer = null; };
    const box = document.querySelector('.hero');
    box.addEventListener('mouseenter', pause);
    box.addEventListener('mouseleave', play);
    box.addEventListener('focusin', pause);
    box.addEventListener('focusout', play);
    track.addEventListener('touchstart', pause, { passive: true });
    document.addEventListener('visibilitychange', () => document.hidden ? pause() : play());
    setDot(0);
    play();
  })();

  window.PSG.applyContacts();
  imgFallback(document);
})();
