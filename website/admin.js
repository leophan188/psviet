// Trang quản trị PSVIET.COM
(() => {
  const { esc, icon, money } = window.PSG;
  const DRAFT_KEY = 'psviet-admin-draft-v2';
  const clone = o => JSON.parse(JSON.stringify(o));
  const $ = s => document.querySelector(s);

  let published = clone(window.SITE || {});
  let data = clone(published);
  let mode = 'static';      // 'server' khi chạy bằng server.py
  let current = 'products';
  let query = '';

  // ---------- Tiện ích ----------
  const slug = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd')
    .toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'muc';
  const uniqueId = (list, base) => {
    let id = slug(base), n = 2;
    while (list.some(x => x.id === id)) id = slug(base) + '-' + n++;
    return id;
  };
  const isDirty = () => JSON.stringify(data) !== JSON.stringify(published);
  const saveDraft = () => {
    try { isDirty() ? localStorage.setItem(DRAFT_KEY, JSON.stringify(data)) : localStorage.removeItem(DRAFT_KEY); } catch (e) {}
  };
  function toast(msg, type = 'ok') {
    const t = $('#toast');
    t.textContent = msg;
    t.className = 'toast ' + type;
    t.hidden = false;
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.hidden = true; }, 3200);
  }
  async function api(path, opts = {}) {
    const res = await fetch(path, { credentials: 'same-origin', ...opts });
    let body = {};
    try { body = await res.json(); } catch (e) {}
    if (res.status === 401 && path !== '/api/login') { showLogin(); throw new Error('Phiên đăng nhập đã hết, hãy đăng nhập lại'); }
    if (!res.ok) throw new Error(body.error || 'Lỗi ' + res.status);
    return body;
  }

  const guessLine = (name, fallback) => {
    const cats = data.machineCategories || [];
    const n = String(name || '').toLowerCase();
    const hit = cats.find(c => n.includes(c.id) || n.includes(c.name.toLowerCase().replace(/^ps5\s*/, '')));
    return hit ? hit.id : fallback || (cats[0] || {}).id || '';
  };
  const catName = id => (data.machineCategories || []).find(c => c.id === id)?.name || '—';
  const gameCatName = id => (data.gameCategories || []).find(c => c.id === id)?.name || '';
  const gameTypeName = id => (data.gameTypes || []).find(c => c.id === id)?.name || '';
  const typesOf = g => g.types || (g.type ? [g.type] : []);
  const ICONS = [['swap', 'Đổi trả'], ['shield', 'Bảo hành'], ['gamepad', 'Tay cầm'], ['truck', 'Giao hàng'], ['badge', 'Chứng nhận'], ['wrench', 'Sửa chữa'], ['video', 'Video'], ['zap', 'Tia sét'], ['star', 'Ngôi sao'], ['clock', 'Đồng hồ'], ['pin', 'Địa điểm'], ['phone', 'Điện thoại'], ['chat', 'Tin nhắn'], ['check', 'Dấu tích']];
  const STATUS = { available: ['Còn hàng', 'ok'], coming: ['Sắp về', 'warn'], sold: ['Đã bán', 'muted'] };
  const DRIVES = { disc: 'Có ổ đĩa', digital: 'Digital' };

  // ---------- Cấu hình các mục ----------
  const SECTIONS = {
    products: {
      group: 'Sản phẩm', label: 'Máy', icon: 'gamepad', noun: 'máy',
      hint: 'Mỗi máy là một sản phẩm đang bán. Máy "Đã bán" vẫn hiện để tạo niềm tin, hoặc tắt "Hiện trên website" để ẩn.',
      title: p => p.name,
      sub: p => [catName(p.category), DRIVES[p.drive], p.storage, money(p.price)].filter(Boolean).join(' · '),
      thumb: p => p.image || (data.machineCategories || []).find(c => c.id === p.category)?.image,
      badges: p => [STATUS[p.status] || STATUS.available, p.featured && ['Ưu tiên', 'info'], p.visible === false && ['Đang ẩn', 'muted']],
      duplicate: true,
      defaults: () => ({ name: '', category: (data.machineCategories || [])[0]?.id || '', drive: 'digital', storage: '', condition: '95–98%', price: 0, oldPrice: 0, status: 'available', image: '', note: '', includes: 'Tay cầm, dây nguồn, HDMI', featured: false, visible: true }),
      fields: [
        { key: 'name', label: 'Tên máy', type: 'text', required: true, placeholder: 'VD: PS5 Slim Digital' },
        { key: 'drive', label: 'Ổ đĩa', type: 'select', half: true, options: () => [['disc', 'Có ổ đĩa (Standard)'], ['digital', 'Digital (không ổ đĩa)']] },
        { key: 'price', label: 'Giá bán (đ)', type: 'money', required: true, half: true },
        { key: 'oldPrice', label: 'Giá gốc (để hiện giảm giá)', type: 'money', half: true },
        { key: 'storage', label: 'Dung lượng', type: 'text', half: true, placeholder: 'VD: 1TB' },
        { key: 'condition', label: 'Ngoại hình', type: 'text', half: true, placeholder: 'VD: 95–98%' },
        { key: 'status', label: 'Trạng thái', type: 'select', half: true, options: () => Object.entries(STATUS).map(([k, v]) => [k, v[0]]) },
        { key: 'includes', label: 'Phụ kiện kèm theo', type: 'text', half: true, placeholder: 'Tay cầm, dây nguồn, HDMI' },
        { key: 'image', label: 'Ảnh máy', type: 'image', help: 'Để trống sẽ dùng ảnh của danh mục.' },
        { key: 'note', label: 'Mô tả ngắn', type: 'textarea', placeholder: 'VD: Máy đẹp, ít dùng, còn tem' },
        { key: 'featured', label: 'Ưu tiên hiện lên đầu', type: 'checkbox', half: true },
        { key: 'visible', label: 'Hiện trên website', type: 'checkbox', half: true },
      ],
    },
    games: {
      group: 'Game', label: 'Game', icon: 'star', noun: 'game',
      title: g => g.title,
      sub: g => [(g.platforms || []).join(', '), gameCatName(g.category), g.price].filter(Boolean).join(' · '),
      thumb: g => g.image,
      tall: true,
      badges: g => [...typesOf(g).map(id => gameTypeName(id) && [gameTypeName(id), 'info']), g.hot && ['Hot', 'hot'], g.visible === false && ['Đang ẩn', 'muted']],
      duplicate: true,
      defaults: () => ({ title: '', platforms: ['PS5'], types: [], category: '', players: '', price: '', image: '', note: '', content: '', trailer: '', hot: false, visible: true }),
      fields: [
        { key: 'title', label: 'Tên game', type: 'text', required: true, placeholder: 'Tên tiếng Anh để tìm ảnh tự động' },
        { key: 'types', label: 'Loại', type: 'multi', half: true, options: () => (data.gameTypes || []).map(c => [c.id, c.name]), help: 'Tích được nhiều loại. Khai báo thêm ở mục "Phân loại game".' },
        { key: 'category', label: 'Thể loại', type: 'select', half: true, allowEmpty: true, options: () => (data.gameCategories || []).map(c => [c.id, c.name]), help: 'Khai báo thêm ở mục "Thể loại game".' },
        { key: 'platforms', label: 'Máy', type: 'platforms', half: true },
        { key: 'players', label: 'Số người chơi', type: 'text', half: true, placeholder: 'VD: 1–4' },
        { key: 'price', label: 'Giá (để trống nếu không bán)', type: 'text', half: true, placeholder: 'VD: 990.000đ' },
        { key: 'image', label: 'Ảnh bìa', type: 'image', findCover: true },
        { key: 'note', label: 'Mô tả ngắn', type: 'textarea', help: 'Hiện trên thẻ game và đầu trang chi tiết.' },
        { key: 'content', label: 'Bài viết (trang chi tiết game)', type: 'textarea', rows: 14, help: 'Dòng trống để tách đoạn. Dòng bắt đầu bằng "## " là tiêu đề nhỏ, "- " là gạch đầu dòng, **chữ** để in đậm.' },
        { key: 'trailer', label: 'Link trailer YouTube', type: 'text', placeholder: 'https://www.youtube.com/watch?v=...' },
        { key: 'hot', label: 'Game hot (hiện lên đầu)', type: 'checkbox', half: true },
        { key: 'visible', label: 'Hiện trên website', type: 'checkbox', half: true },
      ],
    },
    gameTypes: {
      group: 'Game', label: 'Phân loại game', icon: 'disc', noun: 'phân loại',
      hint: 'Tự khai báo cách phân loại game, ví dụ: Cài sẵn miễn phí, Đĩa game, Game digital. Khách lọc theo phân loại trên trang game.',
      title: c => c.name,
      sub: c => `${(data.games || []).filter(g => typesOf(g).includes(c.id)).length} game` + (c.description ? ' · ' + c.description : ''),
      inUse: c => (data.games || []).filter(g => typesOf(g).includes(c.id)).length,
      defaults: () => ({ name: '', description: '' }),
      fields: [
        { key: 'name', label: 'Tên phân loại', type: 'text', required: true, placeholder: 'VD: Đĩa game' },
        { key: 'description', label: 'Ghi chú (không bắt buộc)', type: 'text', placeholder: 'VD: Đĩa chính hãng, bán kèm máy' },
      ],
    },
    gameCategories: {
      group: 'Game', label: 'Thể loại game', icon: 'zap', noun: 'thể loại',
      title: c => c.name,
      sub: c => `${(data.games || []).filter(g => g.category === c.id).length} game`,
      inUse: c => (data.games || []).filter(g => g.category === c.id).length,
      defaults: () => ({ name: '' }),
      fields: [{ key: 'name', label: 'Tên thể loại', type: 'text', required: true, placeholder: 'VD: Kinh dị' }],
    },
    policies: {
      group: 'Nội dung', label: 'Chính sách', icon: 'shield', noun: 'chính sách',
      hint: 'Hiện ở mục "Chính sách" trên trang chủ.',
      title: p => p.title,
      sub: p => (p.items || []).join(' · '),
      iconOf: p => p.icon,
      defaults: () => ({ icon: 'shield', title: '', items: [] }),
      fields: [
        { key: 'title', label: 'Tiêu đề', type: 'text', required: true },
        { key: 'icon', label: 'Biểu tượng', type: 'icon' },
        { key: 'items', label: 'Nội dung', type: 'lines', help: 'Mỗi dòng là một ý.' },
      ],
    },
    highlights: {
      group: 'Nội dung', label: 'Dải cam kết', icon: 'check', noun: 'cam kết',
      hint: 'Dải 4 ô ngay dưới banner trang chủ. Nên giữ 4 mục.',
      title: h => h.title, sub: h => h.text, iconOf: h => h.icon,
      defaults: () => ({ icon: 'check', title: '', text: '' }),
      fields: [
        { key: 'title', label: 'Tiêu đề', type: 'text', required: true, half: true },
        { key: 'icon', label: 'Biểu tượng', type: 'icon', half: true },
        { key: 'text', label: 'Mô tả ngắn', type: 'text' },
      ],
    },
    faq: {
      group: 'Nội dung', label: 'Hỏi đáp', icon: 'chat', noun: 'câu hỏi',
      title: f => f.q, sub: f => f.a,
      defaults: () => ({ q: '', a: '' }),
      fields: [
        { key: 'q', label: 'Câu hỏi', type: 'text', required: true },
        { key: 'a', label: 'Trả lời', type: 'textarea', required: true },
      ],
    },
    settings: {
      group: 'Cài đặt', label: 'Thông tin shop', icon: 'pin', single: true,
      hint: 'Thông tin này tự điền vào mọi nút gọi, Zalo, Messenger, Facebook, YouTube và phần liên hệ trên website.',
      fields: [
        { key: 'phone', label: 'Số điện thoại / Hotline', type: 'text', half: true, placeholder: '09xx xxx xxx' },
        { key: 'zalo', label: 'Zalo (số điện thoại hoặc link)', type: 'text', half: true, placeholder: '09xx xxx xxx' },
        { key: 'messenger', label: 'Messenger (username page hoặc link)', type: 'text', half: true, placeholder: 'psvietcom' },
        { key: 'telegram', label: 'Telegram (username hoặc link)', type: 'text', half: true, placeholder: 'psvietcom' },
        { key: 'facebook', label: 'Link Facebook', type: 'text', half: true, placeholder: 'https://www.facebook.com/...' },
        { key: 'youtube', label: 'Link YouTube', type: 'text', half: true, placeholder: 'https://youtube.com/@...' },
        { key: 'address', label: 'Địa chỉ cửa hàng', type: 'text' },
        { key: 'hours', label: 'Giờ mở cửa', type: 'text', half: true },
        { key: 'productPerk', label: 'Dòng bảo hành trên thẻ máy', type: 'text', half: true },
      ],
    },
    account: { group: 'Cài đặt', label: 'Tài khoản', icon: 'shield', custom: true },
  };

  // ---------- Đăng nhập ----------
  function showLogin() {
    $('#app').hidden = true;
    $('#btn-logout').hidden = true;
    $('#login').hidden = false;
    $('#login-pw').value = '';
    setTimeout(() => $('#login-pw').focus(), 50);
  }
  function showApp() {
    $('#login').hidden = true;
    $('#app').hidden = false;
    $('#btn-logout').hidden = mode !== 'server';
    renderNav();
    render();
  }
  $('#login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const btn = e.submitter || $('#login-form button');
    btn.disabled = true;
    $('#login-err').textContent = '';
    try {
      await api('/api/login', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ password: $('#login-pw').value }) });
      showApp();
    } catch (err) {
      $('#login-err').textContent = err.message;
    } finally {
      btn.disabled = false;
    }
  });
  $('#btn-logout').addEventListener('click', async () => {
    if (isDirty() && !confirm('Có thay đổi chưa đăng. Vẫn đăng xuất? (Bản nháp vẫn được giữ trên máy này)')) return;
    try { await api('/api/logout', { method: 'POST' }); } catch (e) {}
    showLogin();
  });

  // ---------- Khung trang ----------
  function renderNav() {
    let group = '';
    $('#admin-nav').innerHTML = Object.entries(SECTIONS).map(([key, s]) => {
      const head = s.group !== group ? `<span class="nav-group">${esc(group = s.group)}</span>` : '';
      const count = Array.isArray(data[key]) ? `<span class="nav-count">${data[key].length}</span>` : '';
      return `${head}<button type="button" data-sec="${key}" class="${key === current ? 'active' : ''}">${icon(s.icon)}<span>${esc(s.label)}</span>${count}</button>`;
    }).join('');
  }
  // Điện thoại: thanh bên là ngăn kéo trượt ra
  const closeSide = () => document.body.classList.remove('side-open');
  $('#side-open').addEventListener('click', () => document.body.classList.add('side-open'));
  $('#side-scrim').addEventListener('click', closeSide);
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeSide(); });

  $('#admin-nav').addEventListener('click', e => {
    const b = e.target.closest('[data-sec]');
    if (!b) return;
    closeSide();
    current = b.dataset.sec;
    query = '';
    renderNav();
    render();
    // Chuyển mục: nội dung trượt nhẹ vào (chỉ khi đổi mục, không phải mỗi lần sửa dữ liệu)
    const v = $('#view');
    v.classList.remove('view-in');
    void v.offsetWidth;
    v.classList.add('view-in');
    // Gỡ lớp khi chạy xong: hiệu ứng còn giữ transform sẽ làm các khung "position: fixed" bên trong bị lệch
    v.addEventListener('animationend', () => v.classList.remove('view-in'), { once: true });
    $('#view').scrollIntoView({ block: 'start' });
  });

  function renderState() {
    const dirty = isDirty();
    const st = $('#save-state');
    st.className = 'save-state ' + (dirty ? 'dirty' : 'clean');
    st.textContent = dirty ? 'Có thay đổi chưa đăng' : 'Đã đăng';
    const pub = $('#btn-publish');
    pub.innerHTML = mode === 'server' ? `${icon('check')}Lưu &amp; đăng lên web` : `${icon('cloud')}Tải data.js`;
    pub.disabled = mode === 'server' && !dirty;
    $('#btn-discard').hidden = !dirty;
  }

  function render() {
    const s = SECTIONS[current];
    $('#sec-title').textContent = s.label;
    $('#sec-hint').textContent = s.hint || '';
    if (s.custom) (s.render || renderAccount)();
    else if (s.single) renderSettings(s);
    else renderList(s);
    renderState();
  }

  // ---------- Danh sách ----------
  // Nút thao tác dạng icon, có chú thích khi rê chuột
  const act = (name, tip, ic, disabled = false, cls = '') =>
    `<button class="ra ${cls}" type="button" data-act="${name}" data-tip="${esc(tip)}" aria-label="${esc(tip)}"${disabled ? ' disabled' : ''}>${ic}</button>`;
  function renderList(s) {
    const list = data[current] || (data[current] = []);
    const q = query.trim().toLowerCase();
    const rows = list.map((item, i) => ({ item, i })).filter(({ item }) => !q || (s.title(item) + ' ' + (s.sub?.(item) || '')).toLowerCase().includes(q));
    const stats = current === 'products' ? `<div class="stat-row">${Object.entries(STATUS).map(([k, [t, c]]) => `<span class="stat ${c}"><b>${list.filter(p => (p.status || 'available') === k).length}</b>${t}</span>`).join('')}</div>` : '';
    $('#view').innerHTML = `
      ${stats}
      <div class="list-toolbar">
        <label class="search">${icon('search')}<input id="list-q" type="search" placeholder="Tìm ${esc(s.noun)}…" value="${esc(query)}"></label>
        <button class="btn primary" type="button" data-act="add">${icon('plus')}Thêm ${esc(s.noun)}</button>
      </div>
      <div class="list${s.tall ? ' tall' : ''}">
        ${rows.length ? rows.map(({ item, i }) => {
          const th = s.thumb?.(item);
          const ic = s.iconOf?.(item);
          const lead = s.thumb ? `<span class="row-thumb">${th ? `<img src="${esc(th)}" alt="" loading="lazy">` : icon('gamepad')}</span>` : ic ? `<span class="row-icon">${icon(ic)}</span>` : '';
          const badges = (s.badges?.(item) || []).filter(Boolean).map(([t, c]) => `<span class="badge ${c}">${esc(t)}</span>`).join('');
          return `
          <div class="list-row${item.visible === false ? ' is-hidden' : ''}" data-i="${i}">
            ${lead}
            <button class="row-main" type="button" data-act="edit"><b>${esc(s.title(item) || '(chưa đặt tên)')}</b>${s.sub ? `<small>${esc(s.sub(item))}</small>` : ''}</button>
            <span class="row-badges">${badges}</span>
            <span class="row-acts">
              ${act('up', 'Đưa lên', icon('left', 'i rot90'), i === 0)}
              ${act('down', 'Đưa xuống', icon('right', 'i rot90'), i === list.length - 1)}
              ${'visible' in item ? act('toggle', item.visible === false ? 'Hiện lại trên web' : 'Ẩn khỏi web', icon(item.visible === false ? 'eye-off' : 'eye')) : ''}
              ${s.duplicate ? act('dup', `Sao chép thành ${s.noun} mới`, icon('copy')) : ''}
              ${act('edit', 'Sửa', icon('edit'))}
              ${act('del', 'Xóa', icon('trash'), false, 'danger')}
            </span>
          </div>`;
        }).join('') : `<p class="empty">${q ? 'Không tìm thấy.' : `Chưa có ${esc(s.noun)} nào. Bấm "Thêm ${esc(s.noun)}".`}</p>`}
      </div>`;
    const qi = $('#list-q');
    qi.addEventListener('input', () => { query = qi.value; renderList(s); const n = $('#list-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
  }

  $('#view').addEventListener('click', e => {
    const b = e.target.closest('[data-act]');
    if (!b) return;
    const s = SECTIONS[current];
    const list = data[current];
    const row = b.closest('[data-i]');
    const i = row ? +row.dataset.i : -1;
    const act = b.dataset.act;
    if (act === 'add') return openEditor(s, null);
    if (act === 'edit') return openEditor(s, i);
    if (act === 'up' || act === 'down') {
      const j = act === 'up' ? i - 1 : i + 1;
      if (j < 0 || j >= list.length) return;
      [list[i], list[j]] = [list[j], list[i]];
    }
    if (act === 'toggle') list[i].visible = list[i].visible === false;
    if (act === 'dup') {
      // Mở form với thông tin của mục gốc; chỉ tạo mới khi bấm Lưu
      const copy = clone(list[i]);
      delete copy.id;
      if ('name' in copy) copy.name += ' (bản sao)';
      if ('title' in copy) copy.title += ' (bản sao)';
      return openEditor(s, null, copy, i + 1);
    }
    if (act === 'del') {
      const used = s.inUse?.(list[i]);
      if (used) return toast(`Đang có ${used} mục thuộc "${s.title(list[i])}". Chuyển chúng sang danh mục khác trước khi xóa.`, 'err');
      if (!confirm(`Xóa "${s.title(list[i])}"?`)) return;
      list.splice(i, 1);
    }
    changed();
  });

  function changed() {
    saveDraft();
    renderNav();
    render();
  }

  // ---------- Form sửa ----------
  const editor = $('#editor');
  let editing = null; // { s, index, item }

  function fieldHtml(f, v) {
    const id = 'f-' + f.key;
    const req = f.required ? ' required' : '';
    const lab = `<label for="${id}">${esc(f.label)}${f.required ? ' <i>*</i>' : ''}</label>`;
    const help = f.help ? `<small class="help">${esc(f.help)}</small>` : '';
    const wrap = (inner, cls = '') => `<div class="field${f.half ? ' half' : ''} ${cls}">${inner}</div>`;
    switch (f.type) {
      case 'textarea':
        return wrap(`${lab}<textarea id="${id}" name="${f.key}" rows="${f.rows || 3}"${req} placeholder="${esc(f.placeholder || '')}">${esc(v)}</textarea>${help}`);
      case 'lines':
        return wrap(`${lab}<textarea id="${id}" name="${f.key}" rows="4">${esc((v || []).join('\n'))}</textarea>${help}`);
      case 'money':
        return wrap(`${lab}<input id="${id}" name="${f.key}" type="number" min="0" step="1000" inputmode="numeric" value="${+v || ''}"${req}><small class="help money-hint" data-for="${id}">${+v ? money(v) : ''}</small>`);
      case 'select': {
        const opts = (f.allowEmpty ? [['', '— Không chọn —']] : []).concat(f.options());
        return wrap(`${lab}<select id="${id}" name="${f.key}"${req}>${opts.map(([k, t]) => `<option value="${esc(k)}"${k === v ? ' selected' : ''}>${esc(t)}</option>`).join('')}</select>${help}`);
      }
      case 'checkbox':
        return wrap(`<label class="check"><input type="checkbox" name="${f.key}"${v ? ' checked' : ''}><span>${esc(f.label)}</span></label>`, 'is-check');
      case 'multi': {
        const opts = f.options();
        return wrap(`<span class="lab">${esc(f.label)}</span><div class="checks">${opts.length ? opts.map(([k, t]) => `<label class="check"><input type="checkbox" name="${f.key}" value="${esc(k)}"${(v || []).includes(k) ? ' checked' : ''}><span>${esc(t)}</span></label>`).join('') : '<small class="help">Chưa có loại nào.</small>'}</div>${help}`);
      }
      case 'platforms':
        return wrap(`<span class="lab">${esc(f.label)}</span><div class="checks">${['PS5', 'PS4'].map(p => `<label class="check"><input type="checkbox" name="platform" value="${p}"${(v || []).includes(p) ? ' checked' : ''}><span>${p}</span></label>`).join('')}</div>`);
      case 'icon':
        return wrap(`${lab}<div class="icon-pick"><span class="icon-prev">${icon(v || 'check')}</span><select id="${id}" name="${f.key}">${ICONS.map(([k, t]) => `<option value="${k}"${k === v ? ' selected' : ''}>${t}</option>`).join('')}</select></div>`);
      case 'image':
        return wrap(`${lab}
          <div class="img-field">
            <div class="img-prev">${v ? `<img src="${esc(v)}" alt="">` : icon('gamepad')}</div>
            <div class="img-ctrl">
              <input id="${id}" name="${f.key}" type="text" value="${esc(v)}" placeholder="assets/... hoặc link ảnh">
              <div class="img-btns">
                ${mode === 'server' ? `<label class="btn outline sm">${icon('cloud')}Tải ảnh lên<input type="file" accept="image/jpeg,image/png,image/webp" data-upload="${f.key}" hidden></label>` : ''}
                ${f.findCover ? `<button class="btn outline sm" type="button" data-find="${f.key}">${icon('search')}Tìm ảnh bìa</button>` : ''}
                ${v ? `<button class="btn outline sm" type="button" data-clear="${f.key}">Bỏ ảnh</button>` : ''}
              </div>
              <small class="help img-msg">${esc(f.help || (mode === 'server' ? 'Ảnh tự thu nhỏ trước khi tải lên.' : 'Chạy bằng server.py để tải ảnh từ máy tính.'))}</small>
            </div>
          </div>`, 'full');
      default:
        return wrap(`${lab}<input id="${id}" name="${f.key}" type="text" value="${esc(v)}"${req} placeholder="${esc(f.placeholder || '')}">${help}`);
    }
  }

  function readForm(fields, form, base) {
    const out = { ...base };
    fields.forEach(f => {
      const el = form.elements[f.key];
      if (f.type === 'checkbox') out[f.key] = !!el?.checked;
      else if (f.type === 'platforms') out[f.key] = [...form.querySelectorAll('input[name="platform"]:checked')].map(x => x.value);
      else if (f.type === 'multi') { out[f.key] = [...form.querySelectorAll(`input[name="${f.key}"]:checked`)].map(x => x.value); if (f.key === 'types') delete out.type; }
      else if (f.type === 'lines') out[f.key] = el.value.split('\n').map(x => x.trim()).filter(Boolean);
      else if (f.type === 'money') out[f.key] = Math.max(0, Math.round(+el.value || 0));
      else out[f.key] = el.value.trim();
    });
    return out;
  }

  function openEditor(s, index, preset = null, insertAt = 0) {
    const list = data[current];
    const item = preset || (index === null ? s.defaults() : clone(list[index]));
    editing = { s, index, item, insertAt, copied: !!preset };
    $('#editor-title').textContent = (preset ? 'Sao chép ' : index === null ? 'Thêm ' : 'Sửa ') + s.noun;
    $('#editor-fields').innerHTML = s.fields.map(f => fieldHtml(f, item[f.key])).join('');
    $('#editor-err').textContent = '';
    editor.showModal();
    editor.querySelector('input, select, textarea')?.focus();
  }

  $('#editor-form').addEventListener('submit', e => {
    e.preventDefault();
    const { s, index, item, insertAt, copied } = editing;
    const form = e.target;
    const out = readForm(s.fields, form, item);
    if (s.fields.some(f => f.type === 'platforms') && !out.platforms.length) {
      $('#editor-err').textContent = 'Chọn ít nhất một máy.';
      return;
    }
    // Máy: không chọn danh mục nữa, tự nhận dòng máy (Fat/Slim/Pro) theo tên để giữ ảnh mặc định, giá "Chỉ từ", so sánh
    if (current === 'products') out.category = guessLine(out.name, out.category);
    const list = data[current];
    if (index === null) {
      out.id = uniqueId(list, s.title(out));
      list.splice(insertAt, 0, out);
    } else {
      list[index] = out;
    }
    editor.close();
    changed();
    const next = `Bấm "${mode === 'server' ? 'Lưu & đăng lên web' : 'Tải data.js'}" để cập nhật website.`;
    toast(index === null ? `Đã ${copied ? 'tạo bản sao' : 'thêm'}. ${next}` : `Đã sửa (chưa lên web). ${next}`);
  });
  $('#editor-cancel').addEventListener('click', () => editor.close());
  $('#editor-close').addEventListener('click', () => editor.close());
  editor.addEventListener('click', e => { if (e.target === editor) editor.close(); });

  // Tương tác trong form: xem trước ảnh, tải ảnh, tìm ảnh bìa, xem giá, xem biểu tượng
  function setImage(key, value) {
    const input = editor.querySelector(`[name="${key}"]`);
    input.value = value;
    const prev = input.closest('.img-field').querySelector('.img-prev');
    prev.innerHTML = value ? `<img src="${esc(value)}" alt="">` : icon('gamepad');
  }
  editor.addEventListener('input', e => {
    const t = e.target;
    if (t.type === 'number') {
      const h = editor.querySelector(`.money-hint[data-for="${t.id}"]`);
      if (h) h.textContent = +t.value ? money(t.value) : '';
    }
    if (t.closest('.img-field') && t.type === 'text') setImage(t.name, t.value.trim());
  });
  editor.addEventListener('change', async e => {
    const t = e.target;
    if (t.closest('.icon-pick')) t.closest('.icon-pick').querySelector('.icon-prev').innerHTML = icon(t.value);
    if (t.dataset.upload && t.files[0]) {
      const msg = t.closest('.img-field').querySelector('.img-msg');
      msg.textContent = 'Đang tải ảnh…';
      try {
        const blob = await shrink(t.files[0]);
        const name = slug(editor.querySelector('[name="name"], [name="title"]')?.value || t.files[0].name.replace(/\.\w+$/, ''));
        const res = await api('/api/upload', { method: 'POST', headers: { 'Content-Type': blob.type, 'X-File-Name': name }, body: blob });
        setImage(t.dataset.upload, res.path);
        msg.textContent = 'Đã tải ảnh lên.';
      } catch (err) {
        msg.textContent = 'Lỗi: ' + err.message;
      }
      t.value = '';
    }
  });
  editor.addEventListener('click', async e => {
    const clear = e.target.closest('[data-clear]');
    if (clear) setImage(clear.dataset.clear, '');
    const find = e.target.closest('[data-find]');
    if (find) {
      const msg = find.closest('.img-field').querySelector('.img-msg');
      const title = editor.querySelector('[name="title"]').value.trim();
      if (!title) { msg.textContent = 'Nhập tên game (tiếng Anh) trước.'; return; }
      msg.textContent = 'Đang tìm…';
      try {
        const found = await findCover(title);
        if (!found) { msg.textContent = 'Không tìm thấy, thử tên đầy đủ bằng tiếng Anh hoặc tải ảnh lên.'; return; }
        setImage(find.dataset.find, found.url);
        msg.textContent = 'Đã lấy ảnh từ Wikipedia: ' + found.page;
      } catch (err) {
        msg.textContent = 'Lỗi mạng, thử lại sau.';
      }
    }
  });

  // Thu nhỏ ảnh còn cạnh dài tối đa 1600px, nén JPEG
  function shrink(file) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        const scale = Math.min(1, 1600 / Math.max(img.width, img.height));
        const c = document.createElement('canvas');
        c.width = Math.round(img.width * scale);
        c.height = Math.round(img.height * scale);
        const ctx = c.getContext('2d');
        ctx.fillStyle = '#fff';
        ctx.fillRect(0, 0, c.width, c.height);
        ctx.drawImage(img, 0, 0, c.width, c.height);
        URL.revokeObjectURL(img.src);
        c.toBlob(b => b ? resolve(b) : reject(new Error('Không đọc được ảnh')), 'image/jpeg', 0.85);
      };
      img.onerror = () => reject(new Error('File không phải ảnh'));
      img.src = URL.createObjectURL(file);
    });
  }

  // Ảnh bìa game từ ô thông tin (infobox) của bài Wikipedia tiếng Anh
  async function wiki(params) {
    const qs = new URLSearchParams({ ...params, format: 'json', origin: '*' });
    return (await fetch('https://en.wikipedia.org/w/api.php?' + qs)).json();
  }
  async function findCover(title) {
    for (const page of [title + ' (video game)', title]) {
      const r = await wiki({ action: 'parse', page, prop: 'wikitext', section: 0, redirects: 1 });
      if (r.error) continue;
      const m = r.parse.wikitext['*'].match(/\|\s*image\s*=\s*(?:\[\[)?(?:File:|Image:)?([^|\]\n<]+)/);
      if (!m) continue;
      const info = await wiki({ action: 'query', titles: 'File:' + m[1].trim(), prop: 'imageinfo', iiprop: 'url' });
      const ii = Object.values(info.query.pages)[0].imageinfo;
      if (ii) return { url: ii[0].url.split('?')[0], page: r.parse.title };
    }
    return null;
  }

  // ---------- Thông tin shop ----------
  function renderSettings(s) {
    const v = data.settings || (data.settings = {});
    $('#view').innerHTML = `
      <form id="settings-form" class="panel">
        <div class="form-grid">${s.fields.map(f => fieldHtml(f, v[f.key])).join('')}</div>
        <div class="panel-foot"><button class="btn primary" type="submit">${icon('check')}Cập nhật thông tin</button></div>
      </form>`;
    $('#settings-form').addEventListener('submit', e => {
      e.preventDefault();
      data.settings = readForm(s.fields, e.target, v);
      changed();
      toast('Đã cập nhật. Nhớ bấm đăng để áp dụng lên website.');
    });
  }

  // ---------- Tài khoản ----------
  function renderAccount() {
    if (mode !== 'server') {
      $('#view').innerHTML = `<div class="panel"><p>Đổi mật khẩu cần chạy website bằng <code>python3 server.py</code>.</p></div>`;
      return;
    }
    $('#view').innerHTML = `
      <form id="pw-form" class="panel narrow">
        <h3>Đổi mật khẩu</h3>
        <div class="field"><label for="pw-cur">Mật khẩu hiện tại</label><input id="pw-cur" type="password" autocomplete="current-password" required></div>
        <div class="field"><label for="pw-new">Mật khẩu mới (ít nhất 8 ký tự)</label><input id="pw-new" type="password" autocomplete="new-password" minlength="8" required></div>
        <div class="field"><label for="pw-new2">Nhập lại mật khẩu mới</label><input id="pw-new2" type="password" autocomplete="new-password" minlength="8" required></div>
        <p class="form-err" id="pw-err"></p>
        <div class="panel-foot"><button class="btn primary" type="submit">Đổi mật khẩu</button></div>
      </form>`;
    $('#pw-form').addEventListener('submit', async e => {
      e.preventDefault();
      const err = $('#pw-err');
      err.textContent = '';
      if ($('#pw-new').value !== $('#pw-new2').value) { err.textContent = 'Mật khẩu nhập lại không khớp.'; return; }
      try {
        await api('/api/password', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ current: $('#pw-cur').value, new: $('#pw-new').value }) });
        e.target.reset();
        toast('Đã đổi mật khẩu.');
      } catch (ex) {
        err.textContent = ex.message;
      }
    });
  }

  // ---------- Đăng / tải file ----------
  $('#btn-publish').addEventListener('click', async () => {
    const btn = $('#btn-publish');
    if (mode !== 'server') {
      const body = '// Dữ liệu website PSVIET.COM. Sửa bằng trang quản trị (admin.html), không cần sửa tay.\nwindow.SITE = ' + JSON.stringify(data, null, 2) + ';\n';
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([body], { type: 'text/javascript' }));
      a.download = 'data.js';
      a.click();
      URL.revokeObjectURL(a.href);
      toast('Đã tải data.js. Thay file website/data.js bằng file này rồi đưa web lên lại.');
      return;
    }
    btn.disabled = true;
    try {
      const res = await api('/api/data', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(data) });
      published = clone(data);
      saveDraft();
      toast('Đã đăng lên website lúc ' + res.savedAt);
    } catch (err) {
      toast(err.message, 'err');
    }
    renderState();
  });
  $('#btn-discard').addEventListener('click', () => {
    if (!confirm('Bỏ mọi thay đổi chưa đăng và quay về bản đang hiện trên website?')) return;
    data = clone(published);
    saveDraft();
    renderNav();
    render();
  });
  window.addEventListener('beforeunload', e => { if (isDirty() && mode !== 'server') { e.preventDefault(); e.returnValue = ''; } });

  // ---------- Cho các file bổ sung (vd. admin-marketing.js) thêm mục vào menu ----------
  window.ADMIN = {
    api, toast,
    getData: () => data,
    isServer: () => mode === 'server',
    // Chèn các mục mới ngay trước nhóm "Cài đặt"
    addSections(extra) {
      const entries = Object.entries(SECTIONS);
      Object.keys(SECTIONS).forEach(k => delete SECTIONS[k]);
      const at = entries.findIndex(([, s]) => s.group === 'Cài đặt');
      entries.splice(at < 0 ? entries.length : at, 0, ...Object.entries(extra));
      entries.forEach(([k, s]) => { SECTIONS[k] = s; });
    },
  };

  // ---------- Khởi động ----------
  (async () => {
    try {
      const d = JSON.parse(localStorage.getItem(DRAFT_KEY) || 'null');
      if (d && d.products) data = d;
    } catch (e) {}
    let me = null;
    try {
      const res = await fetch('/api/me', { credentials: 'same-origin' });
      if (res.ok) me = await res.json();
    } catch (e) {}
    if (me && me.server) {
      mode = 'server';
      // Lấy bản mới nhất trên server (tránh dùng bản cache)
      try {
        const txt = await (await fetch('data.js?t=' + Date.now(), { cache: 'no-store' })).text();
        published = JSON.parse(txt.slice(txt.indexOf('{'), txt.lastIndexOf('}') + 1));
        if (!localStorage.getItem(DRAFT_KEY)) data = clone(published);
      } catch (e) {}
      // Bản nháp cũ có thể thiếu mục mới (vd. Phân loại game): bổ sung từ bản đang đăng
      Object.keys(published).forEach(k => { if (!(k in data)) data[k] = clone(published[k]); });
      me.loggedIn ? showApp() : showLogin();
    } else {
      $('#static-note').hidden = false;
      showApp();
    }
  })();
})();
