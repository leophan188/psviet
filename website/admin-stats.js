// Trang quản trị: mục "Thống kê" – 3 tab: Website (người truy cập, máy/game được quan tâm, kênh liên hệ, nguồn truy cập),
// Facebook (người theo dõi Page, lượt xem, tương tác từng bài) và YouTube (người đăng ký, lượt xem từng video)
(() => {
  const A = window.ADMIN;
  if (!A) return;
  const { esc, icon } = window.PSG;
  const $ = s => document.querySelector(s);
  let range = 30, tab = 'web';
  let soc = null;   // số liệu Facebook/YouTube đã tải: { days, data }
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

  // Vạch chia trục: số tròn, gồm 0 hoặc khoảng [lo, hi]
  const niceStep = span => {
    const p = Math.pow(10, Math.floor(Math.log10(Math.max(span, 1))));
    return [1, 2, 5, 10].map(m => m * p).find(st => span / st <= 4) || p * 10;
  };
  const dm = day => day.slice(8) + '/' + day.slice(5, 7);
  // Vẽ theo bề rộng thật của khung (chữ trục không bị thu nhỏ trên điện thoại); số nhãn ngày theo bề rộng
  const chartW = () => Math.min(760, Math.max(300, ($('#view').clientWidth || 760) - 60));
  const labelStep = (n, W) => Math.ceil(n / Math.max(3, Math.floor(W / 95)));

  // Biểu đồ cột theo ngày, gốc 0 (rê chuột vào cột để xem số liệu). rows: [{ day, value, tip }]
  function colChart(rows, label) {
    const W = chartW(), H = 200, pad = { l: 40, r: 8, t: 12, b: 26 };
    const max = Math.max(4, ...rows.map(d => d.value));
    const top = Math.ceil(max / niceStep(max)) * niceStep(max);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b, bw = iw / rows.length;
    const y = v => pad.t + ih - v / top * ih;
    const labelEvery = labelStep(rows.length, W);
    return `<svg class="st-chart" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      ${[0, top / 2, top].map(t => `<line class="st-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="st-axis" x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`).join('')}
      ${rows.map((d, i) => {
        const x = pad.l + i * bw, h = Math.max(0, ih - (y(d.value) - pad.t)), w = Math.max(2, bw - 2);
        return `<g class="st-col"><title>${dm(d.day)}: ${esc(d.tip)}</title>
          <rect class="st-hit" x="${x}" y="${pad.t}" width="${bw}" height="${ih}"/>
          ${d.value ? `<path class="st-mark" d="M${x + 1},${pad.t + ih} v${-(h - 4)} q0,-4 4,-4 h${w - 8} q4,0 4,4 v${h - 4} z"/>` : ''}
          ${(i % labelEvery === 0 && rows.length - 1 - i >= labelEvery / 2) || i === rows.length - 1 ? `<text class="st-axis" x="${i === rows.length - 1 ? x + bw : x + bw / 2}" y="${H - 8}" text-anchor="${i === rows.length - 1 ? 'end' : 'middle'}">${dm(d.day)}</text>` : ''}
        </g>`;
      }).join('')}
    </svg>`;
  }

  // Biểu đồ đường cho số tích luỹ (người theo dõi, người đăng ký): trục không cần bắt đầu từ 0.
  // series: [[ngày, giá trị], ...]; chưa đủ 2 ngày thì báo đang ghi số liệu.
  function lineChart(series, label, unit) {
    if (series.length < 2) return `<p class="muted st-empty">${icon('clock')} Bắt đầu ghi số liệu từ ${series.length ? dm(series[0][0]) : 'hôm nay'} – biểu đồ hiện sau 2 ngày.</p>`;
    const W = chartW(), H = 200, pad = { l: 46, r: 14, t: 14, b: 26 };
    const vals = series.map(r => r[1]), lo0 = Math.min(...vals), hi0 = Math.max(...vals);
    const st = niceStep(Math.max(hi0 - lo0, 4)), lo = Math.floor(lo0 / st) * st, hi = Math.max(Math.ceil(hi0 / st) * st, lo + st);
    const iw = W - pad.l - pad.r, ih = H - pad.t - pad.b;
    const x = i => pad.l + (series.length === 1 ? iw / 2 : i / (series.length - 1) * iw);
    const y = v => pad.t + ih - (v - lo) / (hi - lo) * ih;
    const ticks = []; for (let t = lo; t <= hi + 1e-9; t += st) ticks.push(t);
    const labelEvery = labelStep(series.length, W);
    const d = series.map((r, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(r[1]).toFixed(1)}`).join(' ');
    // Nhiều điểm sát nhau: ẩn chấm, chỉ hiện khi rê chuột, để thấy rõ đường
    return `<svg class="st-chart${iw / series.length < 16 ? ' dense' : ''}" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(label)}">
      ${ticks.map(t => `<line class="st-grid" x1="${pad.l}" x2="${W - pad.r}" y1="${y(t)}" y2="${y(t)}"/><text class="st-axis" x="${pad.l - 6}" y="${y(t) + 4}" text-anchor="end">${num(t)}</text>`).join('')}
      <path class="st-line" d="${d}"/>
      ${series.map((r, i) => `<g class="st-pt"><title>${dm(r[0])}: ${num(r[1])} ${unit}</title>
        <rect class="st-hit" x="${x(i) - iw / series.length / 2}" y="${pad.t}" width="${iw / series.length}" height="${ih}"/>
        <circle class="st-dot" cx="${x(i)}" cy="${y(r[1])}" r="4"/>
        ${(i % labelEvery === 0 && series.length - 1 - i >= labelEvery / 2) || i === series.length - 1 ? `<text class="st-axis" x="${x(i)}" y="${H - 8}" text-anchor="${i === series.length - 1 ? 'end' : i === 0 ? 'start' : 'middle'}">${dm(r[0])}</text>` : ''}</g>`).join('')}
    </svg>`;
  }

  const tile = (t, v, sub, off) => `<div class="st-kpi${off ? ' is-off' : ''}"><small>${t}</small><b>${off ? '—' : num(v)}</b><span>${sub}</span></div>`;
  // Mức tăng trong khoảng đang xem, từ chuỗi số liệu theo ngày
  const growth = (series, unit) => series.length < 2 ? 'Đang bắt đầu ghi số liệu'
    : (d => `${d >= 0 ? '+' : ''}${num(d)} ${unit} từ ${dm(series[0][0])}`)(series[series.length - 1][1] - series[0][1]);
  const sumOf = rows => (rows || []).reduce((a, r) => a + r[1], 0);
  const hhmm = sec => { const t = new Date(sec * 1000); return `${String(t.getHours()).padStart(2, '0')}:${String(t.getMinutes()).padStart(2, '0')}`; };
  const cell = v => v == null ? '<td class="st-na">—</td>' : `<td>${num(v)}</td>`;
  const srcHead = (name, link, linkText, updated) => `<div class="st-src">
      <b>${esc(name)}</b>${link ? `<a href="${esc(link)}" target="_blank" rel="noopener">${linkText} ${icon('external')}</a>` : ''}
      <span class="muted">Cập nhật ${hhmm(updated)}</span>
      <button class="btn outline sm" type="button" data-refresh>${icon('swap')}Làm mới</button></div>`;

  // ---------- Tab Website ----------
  async function renderWeb(body) {
    let s;
    try { s = await A.api('/api/stats?days=' + range); }
    catch (e) { body.innerHTML = `<div class="panel mk-note">Không tải được thống kê: ${esc(e.message)}</div>`; return; }
    const k = s.kpi;
    const machineInterest = s.machines.map(r => [r[0], r[1]]);
    body.innerHTML = `
      <div class="st-kpis">
        ${tile('Người truy cập hôm nay', k.today.visitors, num(k.today.views) + ' lượt xem trang')}
        ${tile('7 ngày qua', k.week.visitors, num(k.week.views) + ' lượt xem trang')}
        ${tile('30 ngày qua', k.month.visitors, num(k.month.views) + ' lượt xem trang')}
        ${tile('Lượt bấm liên hệ', s.contacts.reduce((a, r) => a + r[1], 0), 'trong ' + s.days + ' ngày')}
      </div>
      <section class="panel st-card"><h3>Người truy cập theo ngày <small class="muted">(${s.days} ngày, rê chuột vào cột để xem số liệu)</small></h3>
        ${colChart(s.daily.map(d => ({ day: d.day, value: d.visitors, tip: `${num(d.visitors)} người · ${num(d.views)} lượt xem` })), 'Người truy cập theo ngày')}</section>
      <div class="st-grid2">
        ${bars('Game được xem nhiều', s.games.map(r => [r[0], r[1]]), id => nameOf('games', id, 'title'), 'lượt xem', 'Chưa có lượt xem game nào.')}
        ${bars('Máy được quan tâm (bấm hỏi máy)', machineInterest, id => nameOf('products', id), 'lượt bấm', 'Chưa có ai bấm hỏi máy.')}
        ${bars('Game được hỏi (bấm Hỏi game này)', s.game_ask.map(r => [r[0], r[1]]), id => nameOf('games', id, 'title'), 'lượt bấm', 'Chưa có ai bấm hỏi game.')}
        ${bars('Kênh liên hệ được bấm', s.contacts.map(r => [r[0], r[1]]), c => CHANNEL[c] || c, 'lượt bấm', 'Chưa có lượt bấm liên hệ.')}
        ${bars('Khách đến từ đâu', s.referrers, r => r, 'người', 'Chưa có dữ liệu.')}
        ${bars('Chiến dịch quảng cáo (người vào · lượt bấm liên hệ)', (s.campaigns || []).map(r => [r[0] + ' · ' + num(r[2]) + ' liên hệ', r[1]]), c => c, 'người',
          'Chưa có khách từ quảng cáo. Gắn utm_source và utm_campaign vào link quảng cáo, vd ?utm_source=facebook&utm_campaign=ps5-slim')}
        ${bars('Trang được xem nhiều', s.pages, PAGE, 'lượt xem', 'Chưa có dữ liệu.')}
        ${bars('Thiết bị', s.devices, d => d, 'người', 'Chưa có dữ liệu.')}
      </div>`;
  }

  // ---------- Tab Facebook ----------
  const FB_STEPS = `<ol class="st-steps">
      <li>Mở <a href="https://developers.facebook.com/tools/explorer/" target="_blank" rel="noopener">Graph API Explorer</a>, chọn ứng dụng <b>PSVIET</b>.</li>
      <li>Ở <b>Permissions</b> giữ các quyền cũ, tick thêm <code>read_insights</code> và <code>pages_read_user_content</code>, bấm <b>Generate Access Token</b>.</li>
      <li>Dán mã vào <b>Kết nối &amp; lịch sử → Fanpage</b> và lưu như lần trước.</li></ol>`;
  function fbHtml(f) {
    if (!f.connected) return `<section class="panel st-setup"><h3>${icon('chat')}Chưa kết nối Fanpage</h3>
      <p class="muted">Kết nối Fanpage ở <b>Kết nối &amp; lịch sử</b> để xem số người theo dõi, lượt xem và tương tác của từng bài.</p>${FB_STEPS}
      <button class="btn primary" type="button" data-go="mktConnect">Đi tới Kết nối &amp; lịch sử</button></section>`;
    if (f.error) return `<div class="panel mk-note">Facebook báo lỗi: ${esc(f.error)}</div>`;
    const ins = f.perm.insights, eng = f.perm.engagement, d = f.page_daily || {};
    const posts = f.posts || [];
    const engSum = posts.reduce((a, p) => a + (p.reactions || 0) + (p.comments || 0) + (p.shares || 0), 0);
    const missing = [!ins && ['read_insights', 'lượt xem, người tiếp cận, lượt bấm'], !eng && ['pages_read_user_content', 'cảm xúc, bình luận, chia sẻ của từng bài']].filter(Boolean);
    return `${srcHead(f.page_name, f.link, 'Mở Page', soc.data.updated)}
      ${missing.length ? `<section class="panel st-perm"><h3>${icon('shield')}Cấp thêm quyền để xem đủ số liệu</h3>
        <ul>${missing.map(([p, what]) => `<li><code>${p}</code> – ${what}</li>`).join('')}</ul>${FB_STEPS}</section>` : ''}
      <div class="st-kpis">
        ${tile('Người theo dõi Page', f.followers, growth(f.followers_series || [], 'người'))}
        ${tile('Lượt xem nội dung', sumOf(d.page_media_view), `trong ${range} ngày`, !ins)}
        ${tile('Tương tác với bài', ins ? sumOf(d.page_post_engagements) : engSum, ins ? `trong ${range} ngày` : 'cảm xúc + bình luận + chia sẻ', !ins && !eng)}
        ${tile('Bài đã đăng qua web', posts.length, `trong ${range} ngày`)}
      </div>
      <section class="panel st-card"><h3>Người theo dõi Page theo ngày</h3>${lineChart(f.followers_series || [], 'Người theo dõi Page theo ngày', 'người theo dõi')}</section>
      ${ins && (d.page_media_view || []).length ? `<section class="panel st-card"><h3>Lượt xem nội dung theo ngày <small class="muted">(rê chuột vào cột để xem số liệu)</small></h3>
        ${colChart(d.page_media_view.map(([day, v], i) => ({ day, value: v, tip: `${num(v)} lượt xem · ${num(((d.page_total_media_view_unique || [])[i] || [])[1])} người tiếp cận` })), 'Lượt xem nội dung theo ngày')}</section>` : ''}
      <section class="panel st-card"><h3>Bài đã đăng lên Page <small class="muted">(đăng qua web, ${range} ngày)</small></h3>
        ${posts.length ? `<div class="st-table-wrap"><table class="st-table">
          <thead><tr><th>Bài</th><th>Ngày đăng</th><th>Lượt xem</th><th>Tiếp cận</th><th>Cảm xúc</th><th>Bình luận</th><th>Chia sẻ</th></tr></thead>
          <tbody>${posts.map(p => `<tr><th scope="row">${p.url ? `<a href="${esc(p.url)}" target="_blank" rel="noopener">${esc(p.title)}</a>` : esc(p.title)}</th>
            <td>${dm(new Date(p.time * 1000).toISOString().slice(0, 10))}</td>${cell(p.views)}${cell(p.reach)}${cell(p.reactions)}${cell(p.comments)}${cell(p.shares)}</tr>`).join('')}</tbody>
        </table></div>${missing.length ? '<p class="muted st-foot">Ô "—" sẽ có số khi cấp đủ quyền ở trên.</p>' : ''}`
          : '<p class="muted st-empty">Chưa có bài nào đăng lên Page qua web trong khoảng này.</p>'}</section>`;
  }

  // ---------- Tab YouTube ----------
  // Tên ngắn cho biểu đồ thanh: bỏ "PSVIET.COM - " đầu tên và phần "- PS5 - Game Thuyết Minh…" cuối tên
  const shortTitle = t => t.replace(/^\s*PSVIET\.COM\s*[-–|]\s*/i, '').replace(/\s*[-–|]\s*PS[45]\b.*$/i, '').trim() || t;
  function ytHtml(y) {
    if (!y.connected) return `<section class="panel st-setup"><h3>${icon('youtube')}Kết nối kênh YouTube</h3>
      <p class="muted">Dán API key (YouTube Data API v3) để xem người đăng ký và lượt xem từng video của kênh
        ${y.channel_url ? `<a href="${esc(y.channel_url)}" target="_blank" rel="noopener">${esc(y.channel_url.replace(/^https?:\/\/(www\.)?/, ''))}</a>` : 'trong "Thông tin shop"'}. Key chỉ đọc số liệu công khai, không đăng hay sửa được gì.</p>
      <ol class="st-steps">
        <li>Mở <a href="https://console.cloud.google.com/apis/library/youtube.googleapis.com" target="_blank" rel="noopener">Google Cloud Console</a>, tạo project (vd. PSVIET) rồi bấm <b>Enable</b> cho YouTube Data API v3.</li>
        <li>Vào <b>APIs &amp; Services → Credentials → Create credentials → API key</b>.</li>
        <li>Bấm vào key vừa tạo → <b>API restrictions</b> → chỉ chọn YouTube Data API v3 → Save. Dán key vào ô dưới.</li></ol>
      <form class="st-key" id="st-yt-key"><input name="key" type="text" placeholder="AIza…" autocomplete="off" required>
        <button class="btn primary" type="submit">${icon('check')}Lưu &amp; xem thống kê</button></form></section>`;
    if (y.error) return `<div class="panel mk-note">YouTube báo lỗi: ${esc(y.error)}</div>`;
    const v = y.videos || [], top = [...v].sort((a, b) => b.views - a.views).slice(0, 8);
    return `${srcHead(y.title, y.channel_url, 'Mở kênh', soc.data.updated)}
      <div class="st-kpis">
        ${tile('Người đăng ký', y.subscribers, growth(y.subscribers_series || [], 'người'))}
        ${tile('Tổng lượt xem', y.views, growth(y.views_series || [], 'lượt xem'))}
        ${tile('Số video', y.video_count, v.length ? 'mới nhất ' + dm(v[0].published) : 'chưa có video')}
        ${tile('Lượt xem trung bình', v.length ? Math.round(v.reduce((a, x) => a + x.views, 0) / v.length) : 0, 'mỗi video')}
      </div>
      <section class="panel st-card"><h3>Người đăng ký theo ngày</h3>${lineChart(y.subscribers_series || [], 'Người đăng ký theo ngày', 'người đăng ký')}</section>
      <div class="st-grid2">
        ${bars('Video xem nhiều nhất', top.map(x => [shortTitle(x.title), x.views]), t => t, 'lượt xem', 'Kênh chưa có video.')}
        ${bars('Video được thích nhiều nhất', [...v].sort((a, b) => b.likes - a.likes).slice(0, 8).filter(x => x.likes).map(x => [shortTitle(x.title), x.likes]), t => t, 'lượt thích', 'Chưa có lượt thích.')}
      </div>
      <section class="panel st-card"><h3>Tất cả video <small class="muted">(${v.length} video gần nhất)</small></h3>
        ${v.length ? `<div class="st-table-wrap"><table class="st-table">
          <thead><tr><th>Video</th><th>Ngày đăng</th><th>Lượt xem</th><th>Thích</th><th>Bình luận</th></tr></thead>
          <tbody>${v.map(x => `<tr><th scope="row"><a href="https://www.youtube.com/watch?v=${esc(x.id)}" target="_blank" rel="noopener" title="${esc(x.title)}">${esc(shortTitle(x.title))}</a></th>
            <td>${dm(x.published)}</td>${cell(x.views)}${cell(x.likes)}${cell(x.comments)}</tr>`).join('')}</tbody>
        </table></div>` : '<p class="muted st-empty">Kênh chưa có video.</p>'}</section>`;
  }

  async function renderSocial(body, refresh) {
    if (!soc || soc.days !== range || refresh) {
      try { soc = { days: range, data: await A.api(`/api/social?days=${range}${refresh ? '&refresh=1' : ''}`) }; }
      catch (e) { body.innerHTML = `<div class="panel mk-note">Không tải được số liệu: ${esc(e.message)}</div>`; return; }
    }
    if (tab !== 'facebook' && tab !== 'youtube') return;   // đã chuyển tab trong lúc chờ
    body.innerHTML = tab === 'facebook' ? fbHtml(soc.data.facebook) : ytHtml(soc.data.youtube);
  }

  const TABS = [['web', 'Website', 'eye'], ['facebook', 'Facebook', 'chat'], ['youtube', 'YouTube', 'youtube']];
  async function render(refresh) {
    $('#view').innerHTML = `
      <div class="st-top">
        <div class="mk-tabs" role="tablist">${TABS.map(([k, t, ic]) =>
          `<button class="mk-tab${tab === k ? ' active' : ''}" type="button" role="tab" aria-selected="${tab === k}" data-tab="${k}">${icon(ic)}${t}</button>`).join('')}</div>
        <div class="st-range">${[7, 30, 90].map(d => `<button class="chip${range === d ? ' active' : ''}" type="button" data-range="${d}">${d} ngày</button>`).join('')}
          ${tab === 'web' ? '<span class="muted">Ẩn danh, không lưu IP, đã bỏ qua bot</span>' : ''}</div>
      </div>
      <div id="st-body"><p class="muted">Đang tải…</p></div>`;
    const body = $('#st-body');
    $('#view').onclick = e => {
      const r = e.target.closest('[data-range]'), t = e.target.closest('[data-tab]');
      if (r) { range = +r.dataset.range; return render(); }
      if (t) { tab = t.dataset.tab; return render(); }
      if (e.target.closest('[data-refresh]')) return render(true);
      const g = e.target.closest('[data-go]');
      if (g) return $(`#admin-nav [data-sec="${g.dataset.go}"]`).click();
    };
    $('#view').onsubmit = async e => {
      if (e.target.id !== 'st-yt-key') return;
      e.preventDefault();
      const btn = e.target.querySelector('button');
      btn.disabled = true;
      try {
        await A.api('/api/autopost/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ yt_api_key: e.target.key.value.trim() }) });
        A.toast('Đã lưu API key YouTube.');
        render(true);
      } catch (err) { btn.disabled = false; A.toast(err.message, 'err'); }
    };
    $('#view').oninput = null;
    return tab === 'web' ? renderWeb(body) : renderSocial(body, refresh);
  }

  A.addSections({
    stats: { group: 'Tổng quan', label: 'Thống kê', icon: 'zap', custom: true, render,
      hint: 'Website: lượng truy cập, máy/game khách quan tâm, kênh liên hệ. Facebook, YouTube: người theo dõi, lượt xem, tương tác.' },
  }, { first: true, start: true });
})();
