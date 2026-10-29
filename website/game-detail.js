// Chi tiết game: dựng trang từ data.js, và mở/đóng chi tiết ngay trong trang (không tải lại) để hiệu ứng chuyển cảnh mượt
(() => {
  const S = window.SITE || {};
  const { esc, icon, imgFallback, applyContacts, gameCard } = window.PSG;
  const games = (S.games || []).filter(g => g.visible !== false);

  // Dựng trang chi tiết của một game vào root; trả về game tìm được (hoặc null)
  function renderGame(root, id) {
  const g = games.find(x => x.id === id);
  const crumb = `<nav class="breadcrumb" aria-label="Breadcrumb"><a href="index.html">Trang chủ</a>${icon('right')}<a href="games.html">Game</a>${g ? icon('right') + `<span>${esc(g.title)}</span>` : ''}</nav>`;

  if (!g) {
    root.innerHTML = `
      <section class="page-hero"><div class="container">${crumb}
        <h1>Không tìm thấy game</h1>
        <p>Game này không còn trên website hoặc đường link bị sai.</p>
        <a class="btn primary" href="games.html">Xem danh sách game ${icon('arrow')}</a>
      </div></section>`;
    return null;
  }

  document.title = `${g.title} – Game ${(g.platforms || []).join(', ')} | PSVIET.COM`;
  const desc = document.querySelector('meta[name="description"]');
  if (desc && g.note) desc.content = g.note;

  const catName = ((S.gameCategories || []).find(c => c.id === g.category) || {}).name;

  // Bài viết dạng chữ thường: dòng trống tách đoạn, "## " là tiêu đề, "- " là gạch đầu dòng, **chữ** in đậm. Không nhận HTML.
  const inline = t => esc(t).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  const lines = block => {
    if (!block.length) return '';
    if (block.every(l => l.startsWith('- '))) return `<ul>${block.map(l => `<li>${inline(l.slice(2))}</li>`).join('')}</ul>`;
    return `<p>${block.map(inline).join('<br>')}</p>`;
  };
  const article = text => String(text || '').trim().split(/\n\s*\n/).map(chunk => {
    const block = chunk.split('\n').map(l => l.trim()).filter(Boolean);
    if (block[0] && block[0].startsWith('## ')) return `<h2>${inline(block[0].slice(3))}</h2>` + lines(block.slice(1));
    return lines(block);
  }).join('');

  const yt = (String(g.trailer || '').match(/(?:youtu\.be\/|[?&]v=|embed\/|shorts\/)([\w-]{11})/) || [])[1];
  const meta = [
    ['Thể loại', catName],
    ['Máy', (g.platforms || []).join(' · ')],
    ['Người chơi', g.players],
    ['Giá', g.price],
  ].filter(([, v]) => v);

  const related = games.filter(x => x.id !== g.id)
    .sort((a, b) => (b.category === g.category) - (a.category === g.category) || (b.hot - a.hot))
    .slice(0, 4);

  root.innerHTML = `
  <section class="page-hero gd-hero">
    <div class="container">
      ${crumb}
      <div class="gd">
        <div class="gd-cover thumb" data-label="${esc(g.title)}">
          ${g.image ? `<img src="${esc(g.image)}" alt="${esc(g.title)}">` : ''}
        </div>
        <div class="gd-info">
          <div class="gd-tags">
            ${g.hot ? '<span class="hot">HOT</span>' : ''}
            ${window.PSG.gameChips(g, 'lg')}
          </div>
          <h1>${esc(g.title)}</h1>
          ${g.note ? `<p class="gd-lead">${esc(g.note)}</p>` : ''}
          ${meta.length ? `<dl class="gd-meta">${meta.map(([k, v]) => `<div><dt>${k}</dt><dd>${esc(v)}</dd></div>`).join('')}</dl>` : ''}
          <p class="gd-perk">${icon('gamepad')}<span>Mua máy tại PSVIET.COM được <b>cài game miễn phí</b> vào ổ cứng.</span></p>
          <div class="gd-cta">
            <a class="btn primary lg" href="#" data-link="messenger">${icon('chat')}Hỏi game này</a>
            <a class="btn outline lg" href="#" data-link="zalo">${icon('zalo')}Chat Zalo</a>
          </div>
        </div>
      </div>
    </div>
  </section>

  <section class="section top-tight">
    <div class="container gd-body">
      <article class="gd-article">
        ${article(g.content) || `<p class="muted">Shop đang cập nhật bài viết cho game này. Bạn cần tư vấn thêm thì nhắn shop nhé.</p>`}
      </article>
      ${yt ? `<div class="gd-trailer"><h2>Trailer</h2><div class="gd-video"><iframe src="https://www.youtube-nocookie.com/embed/${yt}" title="Trailer ${esc(g.title)}" loading="lazy" allow="accelerometer; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></div></div>` : ''}
    </div>
  </section>

  ${related.length ? `
  <section class="section alt">
    <div class="container">
      <div class="section-head row"><h2>Game cùng thể loại</h2><a class="btn outline sm" href="games.html">Xem tất cả ${icon('arrow')}</a></div>
      <div class="games">${related.map(gameCard).join('')}</div>
    </div>
  </section>` : ''}`;

  applyContacts(root);
  imgFallback(root);
  if (window.PSG.track) window.PSG.track('game', g.id);
  return g;
  }

  // ---------- Điều hướng trong trang ----------
  // games.html có #game-list-view (danh sách) và #game (chi tiết, ẩn); game.html chỉ có #game.
  const listView = document.getElementById('game-list-view');
  const detailView = document.getElementById('game');
  if (!detailView) return;
  const listTitle = document.title;
  const calm = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const idOf = href => {
    const u = new URL(href, location.href);
    return /\/game\.html$/.test(u.pathname) ? u.searchParams.get('id') : null;
  };

  // Chờ ảnh bìa mới giải mã xong (tối đa 300ms) để ảnh không bị trống lúc bay
  const coverReady = () => {
    const img = detailView.querySelector('.gd-cover img');
    if (!img || !img.decode) return null;
    return Promise.race([img.decode().catch(() => {}), new Promise(r => setTimeout(r, 300))]);
  };

  let currentId = listView ? null : idOf(location.href);
  function show(id, scroll) {
    currentId = id;
    if (id) {
      if (listView) listView.hidden = true;
      detailView.hidden = false;
      renderGame(detailView, id);
      if (window.PSG.track) window.PSG.track('view');
      window.PSG.reveal(detailView);
      window.scrollTo(0, 0);
      return coverReady();
    }
    detailView.hidden = true;
    detailView.innerHTML = '';
    listView.hidden = false;
    document.title = listTitle;
    window.scrollTo(0, scroll || 0);
    return null;
  }

  const clearNames = () => document.querySelectorAll('.game-cover').forEach(el => { el.style.viewTransitionName = ''; });
  function transition(update) {
    if (!document.startViewTransition || calm) { update(); clearNames(); return; }
    document.startViewTransition(update).finished.finally(clearNames);
  }

  if (currentId) renderGame(detailView, currentId);

  document.addEventListener('click', e => {
    const a = e.target.closest('a[href*="game.html?id="]');
    if (!a || e.defaultPrevented || e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
    e.preventDefault();
    // Nhớ vị trí cuộn của danh sách để quay lại đúng chỗ
    if (listView && !listView.hidden) history.replaceState({ scroll: window.scrollY }, '');
    history.pushState({}, '', a.href);
    transition(() => show(idOf(a.href)));
  });

  window.addEventListener('popstate', e => {
    const id = idOf(location.href);
    if (!id && !listView) { location.reload(); return; }
    const leaving = currentId;
    transition(() => {
      const ready = show(id, e.state && e.state.scroll);
      // Quay lại danh sách: ảnh bìa bay ngược về đúng thẻ game vừa xem
      if (!id && leaving) {
        const card = [...listView.querySelectorAll('a.game-cover')].find(c => idOf(c.href) === leaving);
        if (card) card.style.viewTransitionName = 'game-cover';
      }
      return ready;
    });
  });
})();
