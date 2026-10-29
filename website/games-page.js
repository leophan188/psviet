// Trang game: danh sách game từ data.js, tìm kiếm và lọc
(() => {
  const S = window.SITE || {};
  const { esc, gameCard, typesOf } = window.PSG;
  // Xếp theo tên A–Z (so sánh kiểu tiếng Việt, số đứng trước chữ)
  const games = (S.games || []).filter(g => g.visible !== false)
    .slice().sort((a, b) => a.title.localeCompare(b.title, 'vi', { numeric: true, sensitivity: 'base' }));
  const list = document.getElementById('list');
  const q = document.getElementById('q');
  let filter = 'all';
  let rendered = false;
  let genre = '';
  let type = '';

  // Hàng nút lọc theo loại / thể loại; chỉ hiện mục có game, ẩn cả hàng nếu không có mục nào
  function chipGroup(id, label, items, valuesOf, onPick) {
    const box = document.getElementById(id);
    const used = items.filter(c => games.some(g => valuesOf(g).includes(c.id)));
    if (!used.length) return;
    box.innerHTML = `<span class="filter-label">${esc(label)}</span><div class="filter-chips">` +
      [{ id: '', name: 'Tất cả' }, ...used].map(c => `<button class="chip${c.id ? '' : ' active'}" type="button" data-id="${esc(c.id)}">${esc(c.name)}</button>`).join('') + '</div>';
    box.hidden = false;
    box.addEventListener('click', e => {
      const c = e.target.closest('.chip');
      if (!c) return;
      box.querySelectorAll('.chip').forEach(x => x.classList.toggle('active', x === c));
      onPick(c.dataset.id);
      render();
    });
  }
  chipGroup('type-filters', 'Loại', S.gameTypes || [], typesOf, v => { type = v; });
  chipGroup('genre-filters', 'Thể loại', S.gameCategories || [], g => [g.category], v => { genre = v; });

  function render() {
    const text = q.value.trim().toLowerCase();
    const shown = games.filter(g =>
      (filter === 'all' || (filter === 'hot' ? g.hot : (g.platforms || []).includes(filter))) &&
      (!genre || g.category === genre) &&
      (!type || typesOf(g).includes(type)) &&
      (!text || g.title.toLowerCase().includes(text))
    );
    list.innerHTML = shown.map(gameCard).join('');
    // Lần đầu để hiệu ứng hiện dần khi cuộn lo; các lần lọc sau thì thẻ bật lên lần lượt
    if (rendered) window.PSG.popIn(list.children);
    rendered = true;
    window.PSG.applyContacts(list);
    window.PSG.imgFallback(list);
    document.getElementById('count').textContent = shown.length ? shown.length + ' game' : 'Không có game phù hợp';
  }

  document.querySelectorAll('#platform-filters .chip').forEach(c => c.addEventListener('click', () => {
    filter = c.dataset.filter;
    document.querySelectorAll('#platform-filters .chip').forEach(x => x.classList.toggle('active', x === c));
    render();
  }));
  q.addEventListener('input', render);
  render();
})();
