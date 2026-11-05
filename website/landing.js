// Trang đích cho quảng cáo (mua-ps5.html): máy đang bán, giá, cam kết, hỏi đáp – lấy từ data.js.
// Quảng cáo Meta/Google chỉ nên nói về máy và dịch vụ, nên trang này bỏ các mục về cài game
// và bỏ chữ "(Free Game)" trong tên máy.
(() => {
  const S = window.SITE || {};
  const { esc, icon, money, imgFallback } = window.PSG;
  const aboutGames = t => /cài\s*(sẵn\s*)?game|free\s*game|việt\s*hoá|thuyết\s*minh/i.test(String(t || ''));
  const cleanName = n => String(n || '').replace(/\s*\(free game\)\s*/ig, ' ').trim();
  const catById = Object.fromEntries((S.machineCategories || []).map(c => [c.id, c]));
  const DRIVE = { disc: ['disc', 'Có ổ đĩa'], digital: ['cloud', 'Digital'] };
  const STATUS = { available: 'Còn hàng', coming: 'Sắp về', sold: 'Đã bán' };
  const order = { available: 0, coming: 1, sold: 2 };
  const products = (S.products || []).filter(p => p.visible !== false)
    .sort((a, b) => (order[a.status] ?? 0) - (order[b.status] ?? 0) || (+a.price || 0) - (+b.price || 0));

  // Giá thấp nhất trong các máy còn bán
  const live = products.filter(p => p.status !== 'sold' && +p.price > 0);
  const from = document.getElementById('lp-from');
  if (from && live.length) {
    from.innerHTML = `Chỉ từ <strong>${money(Math.min(...live.map(p => +p.price)))}</strong>`;
    from.hidden = false;
  }

  const trust = document.getElementById('lp-trust');
  if (trust) trust.innerHTML = (S.highlights || []).filter(h => !aboutGames(h.title + h.text)).map(h => `
      <li>${icon(h.icon || 'check')}<div><b>${esc(h.title)}</b><span>${esc(h.text)}</span></div></li>`).join('');

  // Thẻ máy giống trang chủ (cùng lớp .product[data-id] nên lượt bấm hỏi máy được đếm như trang chủ)
  const perk = (S.settings || {}).productPerk;
  const list = document.getElementById('lp-products');
  if (list) list.innerHTML = products.length ? products.map(p => {
    const name = cleanName(p.name);
    const img = p.image || (catById[p.category] || {}).image || '';
    const d = DRIVE[p.drive];
    const off = +p.oldPrice > +p.price && +p.price > 0 ? Math.round((1 - p.price / p.oldPrice) * 100) : 0;
    const sold = p.status === 'sold';
    return `
        <article class="product${sold ? ' is-sold' : ''}" data-id="${esc(p.id)}">
          <div class="product-media thumb" data-label="${esc(name)}">
            ${img ? `<img src="${esc(img)}" alt="${esc(name)} cũ" loading="lazy">` : ''}
            <span class="stock ${esc(p.status || 'available')}">${STATUS[p.status] || STATUS.available}</span>
            ${off ? `<span class="discount">-${off}%</span>` : ''}
          </div>
          <div class="product-body">
            <div class="chips">
              ${d ? `<span class="chip-tag ${p.drive}">${icon(d[0])}${d[1]}</span>` : ''}
              ${p.storage ? `<span class="chip-tag">SSD ${esc(p.storage)}</span>` : ''}
              ${p.condition ? `<span class="chip-tag">Đẹp ${esc(p.condition)}</span>` : ''}
            </div>
            <h3>${esc(name)}</h3>
            ${p.note ? `<p class="product-note">${esc(p.note)}</p>` : ''}
            <div class="product-price">${money(p.price)}${off ? ` <s>${money(p.oldPrice)}</s>` : ''}</div>
            <ul class="perks">
              ${perk ? `<li>${icon('check')}${esc(perk)}</li>` : ''}
              ${p.includes ? `<li>${icon('check')}Kèm ${esc(p.includes)}</li>` : ''}
              <li>${icon('check')}Video máy thật trước khi giao</li>
            </ul>
            <div class="product-actions">
              <a class="btn primary" href="#" data-link="zalo" data-fallback="messenger" target="_blank" rel="noopener">${icon('zalo')}${sold ? 'Hỏi máy tương tự' : 'Hỏi máy này'}</a>
              <a class="btn outline icon-only" href="#" data-link="messenger" target="_blank" rel="noopener" aria-label="Hỏi qua Messenger">${icon('messenger')}</a>
            </div>
          </div>
        </article>`;
  }).join('') : '<p class="empty">Shop đang cập nhật máy, nhắn Zalo để được báo khi có máy.</p>';
  if (list) imgFallback(list);

  const policies = document.getElementById('lp-policies');
  if (policies) policies.innerHTML = (S.policies || []).filter(p => !aboutGames(p.title)).map(p => `
        <div class="policy">
          <h3><span class="p-ic">${icon(p.icon || 'shield')}</span>${esc(p.title)}</h3>
          <ul>${(p.items || []).filter(t => !aboutGames(t)).map(t => `<li>${esc(t)}</li>`).join('')}</ul>
        </div>`).join('');

  const faq = document.getElementById('lp-faq');
  if (faq) faq.innerHTML = (S.faq || []).filter(f => !aboutGames(f.q + ' ' + f.a)).map(f => `
        <details><summary>${esc(f.q)}${icon('plus')}</summary><p>${esc(f.a).replace(/\n/g, '<br>')}</p></details>`).join('');

  window.PSG.applyContacts();
  window.PSG.reveal();
})();
