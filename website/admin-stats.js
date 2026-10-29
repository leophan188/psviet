// Trang quản trị: mục "Thống kê" – người truy cập, lượt xem, máy/game được quan tâm, kênh liên hệ, nguồn truy cập
(() => {
  const A = window.ADMIN;
  if (!A) return;
  const { esc, icon } = window.PSG;
  const $ = s => document.querySelector(s);
  let range = 30;
  const num = n => Number(n || 0).toLocaleString('vi-VN');
  const nameOf = (list, id, key = 'name') => ((A.getData()[list] || []).find(x => x.id === id) || {})[key] || id;
  const CHANNEL = { messenger: 'Messenger', zalo: 'Zalo', tel: 'Gọi điện', facebook: 'Facebook', youtube: 'YouTube', telegram: 'Telegram' };
  const PAGE = p => p === '/' || p === '/index.html' ? 'Trang chủ' : p.startsWith('/games.html') ? 'Danh sách game'
    : p.startsWith('/game.html') ? 'Chi tiết game: ' + nameOf('games', new URLSearchParams(p.split('?')[1] || '').get('id'), 'title') : p;

  // Danh sách xếp hạng dạng thanh ngang: một màu, giá trị ghi bằng chữ thường
  function bars(title, rows, label, unit, empty) {
    const max = Math.max(1, ...rows.map(r => r[1]));
    return `<section class="panel st-card"><h3>${esc(title)}</h3>
      ${rows.length ? `<ol class="st-bars">${rows.map(r => `
        <li title="${esc(label(r[0]))}: ${num(r[1])} ${unit}">
          <span class="st-bar-label">${esc(label(r[0]))}</span>
          <span class="st-bar-track"><span class="st-bar" style="width:${Math.max(2, r[1] / max * 100)}%"></span></span>
          <b>${num(r[1])}</b>
        </li>`).join('')}</ol>` : `<p class="muted st-empty">${esc(empty)}</p>`}
    </section>`;
  }

  // Biểu đồ cột người truy cập theo ngày (một trục, rê chuột để xem số liệu)
  function dailyChart(daily) {
    const W = 760, H = 200, pad = { l: 34, r: 8, t: 12, b: 26 };
    const max = Math.max(4, ...daily.map(d => d.visitors));
    const step = Math.pow(10, Math.floor(Math.log10(max))) / (max / Math.pow(10, Math.floor(Math.log10(max))) > 5 ? 0.5 : 1);
    const top = Math.ceil(max / step) * step;
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / daily.length;
    const y = v => pad.t + ih - v / top * ih;
    const ticks = [0, top / 2, top];
    const labelEvery = Math.ceil(daily.length / 8);
    return `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="Người truy cập theo ngày">
      ${ticks.map(t => `<line class="st-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="st-axis" x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`).join('')}
      ${daily.map((d, i) => {
        const x = pad.l + i * bw, h = Math.max(0, ih - (y(d.visitors) - pad.t)), w = Math.max(2, bw - 2);
        const dd = d.day.slice(8) + '/' + d.day.slice(5, 7);
        return `<g class="st-col"><title>${dd}: ${num(d.visitors)} người · ${num(d.views)} lượt xem</title>
          <rect class="st-hit" x="${x}" y="${pad.t}" width="${bw}" height="${ih}"/>
          ${d.visitors ? `<path class="st-mark" d="M${x + 1},${pad.t + ih} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z"/>` : ''}
          ${(i % labelEvery === 0 && daily.length - 1 - i >= labelEvery / 2) || i === daily.length - 1 ? `<text class="st-axis" x="${x + bw / 2}" y="${H - 8}" text-anchor="middle">${dd}</text>` : ''}
        </g>`;
      }).join('')}
    </svg>`;
  }

  async function render() {
    $('#view').innerHTML = '<p class="muted">Đang tải…</p>';
    let s;
    try { s = await A.api('/api/stats?days=' + range); }
    catch (e) { $('#view').innerHTML = `<div class="panel mk-note">Không tải được thống kê: ${esc(e.message)}</div>`; return; }
    const k = s.kpi;
    const tile = (t, v, sub) => `<div class="st-kpi"><small>${t}</small><b>${num(v)}</b><span>${sub}</span></div>`;
    const machineInterest = s.machines.map(r => [r[0], r[1]]);
    $('#view').innerHTML = `
      <div class="st-range">${[7, 30, 90].map(d => `<button class="chip${range === d ? ' active' : ''}" type="button" data-range="${d}">${d} ngày</button>`).join('')}
        <span class="muted">Ẩn danh, không lưu IP, đã bỏ qua bot</span></div>
      <div class="st-kpis">
        ${tile('Người truy cập hôm nay', k.today.visitors, num(k.today.views) + ' lượt xem trang')}
        ${tile('7 ngày qua', k.week.visitors, num(k.week.views) + ' lượt xem trang')}
        ${tile('30 ngày qua', k.month.visitors, num(k.month.views) + ' lượt xem trang')}
        ${tile('Lượt bấm liên hệ', s.contacts.reduce((a, r) => a + r[1], 0), 'trong ' + s.days + ' ngày')}
      </div>
      <section class="panel st-card"><h3>Người truy cập theo ngày <small class="muted">(${s.days} ngày, rê chuột vào cột để xem số liệu)</small></h3>${dailyChart(s.daily)}</section>
      <div class="st-grid2">
        ${bars('Game được xem nhiều', s.games.map(r => [r[0], r[1]]), id => nameOf('games', id, 'title'), 'lượt xem', 'Chưa có lượt xem game nào.')}
        ${bars('Máy được quan tâm (bấm hỏi máy)', machineInterest, id => nameOf('products', id), 'lượt bấm', 'Chưa có ai bấm hỏi máy.')}
        ${bars('Game được hỏi (bấm Hỏi game này)', s.game_ask.map(r => [r[0], r[1]]), id => nameOf('games', id, 'title'), 'lượt bấm', 'Chưa có ai bấm hỏi game.')}
        ${bars('Kênh liên hệ được bấm', s.contacts.map(r => [r[0], r[1]]), c => CHANNEL[c] || c, 'lượt bấm', 'Chưa có lượt bấm liên hệ.')}
        ${bars('Khách đến từ đâu', s.referrers, r => r, 'người', 'Chưa có dữ liệu.')}
        ${bars('Trang được xem nhiều', s.pages, PAGE, 'lượt xem', 'Chưa có dữ liệu.')}
        ${bars('Thiết bị', s.devices, d => d, 'người', 'Chưa có dữ liệu.')}
      </div>`;
    $('#view').onclick = e => {
      const b = e.target.closest('[data-range]');
      if (b) { range = +b.dataset.range; render(); }
    };
    $('#view').oninput = null;
  }

  A.addSections({
    stats: { group: 'Tổng quan', label: 'Thống kê', icon: 'zap', custom: true, render,
      hint: 'Lượng truy cập website, máy và game khách quan tâm, kênh liên hệ được bấm, khách đến từ đâu.' },
  }, { first: true });
})();
