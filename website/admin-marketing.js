// Trang quản trị: nhóm "Truyền thông" – lịch đăng Facebook, bài cho nhóm, video YouTube, kết nối tài khoản
(() => {
  const A = window.ADMIN;
  if (!A) return;
  const { esc, icon, money } = window.PSG;
  const $ = s => document.querySelector(s);
  const D = () => A.getData();
  const DRAFTS_KEY = 'psviet-mkt-drafts';

  let st = null;          // trạng thái từ server: kết nối, cài đặt, lịch sử
  let drafts = {};        // bài đã sửa tay / mẫu đang chọn, theo từng khung giờ
  try { drafts = JSON.parse(localStorage.getItem(DRAFTS_KEY) || '{}'); } catch (e) {}
  const saveDrafts = () => { try { localStorage.setItem(DRAFTS_KEY, JSON.stringify(drafts)); } catch (e) {} };

  async function loadStatus() {
    if (!A.isServer()) return null;
    try { st = await A.api('/api/autopost/status'); } catch (e) { A.toast(e.message, 'err'); }
    return st;
  }

  // ---------- Dữ liệu dùng cho mẫu bài ----------
  const site = () => ((st && st.settings.site_url) || location.origin).replace(/\/$/, '');
  const times = () => (st && st.settings.times) || ['11:30', '20:00'];
  const contact = () => {
    const s = D().settings || {};
    return s.phone ? `Hotline/Zalo: ${s.phone}` : 'Inbox page để được tư vấn';
  };
  const tag = t => '#' + String(t).normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/gi, 'd').replace(/[^a-z0-9]/gi, '');
  const plain = t => String(t || '').replace(/\*\*/g, '');
  const machines = () => {
    const list = (D().products || []).filter(p => p.visible !== false && p.status !== 'sold');
    return list.length ? list : (D().products || []);
  };
  const games = () => (D().games || []).filter(g => g.visible !== false)
    .sort((a, b) => (b.hot ? 1 : 0) - (a.hot ? 1 : 0) || a.title.localeCompare(b.title, 'vi', { numeric: true }));
  const catOf = p => ((D().machineCategories || []).find(c => c.id === p.category) || {});
  const genreOf = g => ((D().gameCategories || []).find(c => c.id === g.category) || {}).name || '';
  // Ảnh máy PNG nền trong: dùng bản JPEG nền thương hiệu cho Facebook
  const socialImg = img => /assets\/may\/ps5-(fat|slim|pro)\.png$/.test(img || '') ? img.replace('assets/may/', 'assets/may/social/').replace(/\.png$/, '.jpg') : img;
  const imgOf = item => item.title ? item.image : socialImg(item.image || catOf(item).image);
  const sectionOf = (g, head) => {
    const m = String(g.content || '').split(/\n(?=## )/).find(b => b.startsWith('## ' + head));
    return m ? m.split('\n').slice(1).join('\n').trim() : '';
  };
  const intro = g => plain(String(g.content || '').split(/\n\s*\n/)[0]);
  const highlights = g => sectionOf(g, 'Điểm nổi bật').split('\n').filter(l => l.startsWith('- ')).map(l => plain(l.slice(2))).slice(0, 3);

  // ---------- Khối nội dung dùng chung: thương hiệu, ưu đãi, chữ ký ----------
  const BRAND = 'PSVIET.COM';
  const perkLines = () => (D().highlights || []).map(h => /game/i.test(h.title)
    ? `✅ ${h.title} – ${h.text}. Danh sách game: ${site()}/games.html`
    : `✅ ${h.title} – ${h.text}`);
  const perksShort = () => (D().highlights || []).map(h => h.title).join(' · ');
  const offerBlock = () => [`🎁 MUA MÁY TẠI ${BRAND} BẠN ĐƯỢC:`, ...perkLines(), `📋 Chính sách bảo hành, đổi trả: ${site()}/#chinh-sach`].join('\n');
  // Đủ các kênh liên hệ của shop; kênh nào chưa điền trong "Thông tin shop" thì bỏ qua
  const linkOf = (v, base) => !v ? '' : /^https?:\/\//.test(v) ? v : base + String(v).replace(/^@/, '');
  const channels = () => {
    const s = D().settings || {};
    const zalo = s.zalo && (/^https?:/.test(s.zalo) ? s.zalo : 'https://zalo.me/' + String(s.zalo).replace(/[^\d]/g, ''));
    return [
      s.address && `📍 Địa chỉ: ${s.address}`,
      s.phone && `☎️ Hotline: ${s.phone}`,
      zalo && `💬 Zalo: ${zalo}`,
      s.facebook && `📘 Facebook: ${s.facebook}`,
      s.messenger && `💌 Messenger: ${linkOf(s.messenger, 'https://m.me/')}`,
      s.youtube && `▶️ YouTube: ${s.youtube}`,
      s.telegram && `✈️ Telegram: ${linkOf(s.telegram, 'https://t.me/')}`,
      `🌐 Website: ${site()}`,
      s.hours && `🕘 Mở cửa: ${s.hours}`,
    ].filter(Boolean);
  };
  const signature = (...extraTags) => ['━━━━━━━━━━━━', `🏪 ${BRAND} – PS5 cũ nguyên bản, test kỹ từng máy`, ...channels(), '',
    ['#PSVIETCOM', '#PSVIET', ...extraTags].join(' ')].join('\n');
  const specs = p => [
    `• ${p.drive === 'digital' ? 'Bản Digital (không ổ đĩa)' : 'Bản có ổ đĩa'}${p.storage ? ', SSD ' + p.storage : ''}`,
    p.condition ? `• Ngoại hình ${p.condition}` : '',
    p.includes ? `• Kèm ${p.includes}` : '',
    '• Test kỹ, có video máy thật trước khi giao',
  ].filter(Boolean).join('\n');
  // Tên máy dùng trong bài đăng: thêm "Chiến Thần (Free Game)" (tên trên website giữ nguyên)
  const POST_NICK = 'Chiến Thần';
  const postName = p => `${String(p.name || '').replace(/\s*\(free game\)\s*/ig, ' ').trim()} ${POST_NICK} (Free Game)`;
  const priceText = p => `${money(p.price)}${+p.oldPrice > +p.price ? ` (giá gốc ${money(p.oldPrice)})` : ''}`;
  const otherGames = g => games().filter(x => x.id !== g.id).slice(0, 4).map(x => x.title).join(', ');
  const join = parts => parts.filter(x => x !== null && x !== undefined).join('\n\n').replace(/\n{3,}/g, '\n\n');

  // ---------- Mẫu bài Facebook: mỗi bài đều nêu thương hiệu, ưu đãi và chính sách của shop ----------
  const MACHINE_POSTS = [
    p => join([
      `🔥 ${postName(p)} – chỉ ${priceText(p)} tại ${BRAND}`,
      specs(p),
      offerBlock(),
      `👉 Xem máy và so sánh các bản: ${site()}/#may`,
      signature(tag('PS5'), tag('PS5cu'), tag(catOf(p).name || 'PS5')),
    ]),
    p => join([
      `Đang tìm ${catOf(p).name || 'PS5'} cũ giá tốt, mua về chơi được ngay? 👀\n${BRAND} đang có ${postName(p)} – ${priceText(p)}`,
      specs(p),
      `💡 Vì sao nên mua tại ${BRAND}?\n${perkLines().join('\n')}`,
      `👉 Đặt máy: ${site()}/#may\n📋 Chính sách: ${site()}/#chinh-sach`,
      signature(tag('PS5'), tag(catOf(p).name || 'PS5')),
    ]),
    p => join([
      `MÁY MỚI VỀ 🔥 ${postName(p)} | ${BRAND}`,
      `💰 Giá ${priceText(p)}${p.note ? '\n' + p.note : ''}`,
      `🎁 ${perksShort()}`,
      `🕹 Mua máy được cài game miễn phí – xem danh sách game: ${site()}/games.html`,
      `👉 ${site()}/#may`,
      signature(tag('PS5cu')),
    ]),
  ];
  // Chính sách cài game của shop, lấy nguyên văn từ mục "Chính sách" trên web
  const gamePolicy = () => {
    const p = (D().policies || []).find(x => /game/i.test(x.title));
    return p ? (p.items || []).filter(t => !/^cài sẵn/i.test(t)).join('. ') : '';
  };
  const gameMeta = g => `🎮 ${(g.platforms || []).join(' · ')}${genreOf(g) ? ' · ' + genreOf(g) : ''}${g.players ? ' · ' + g.players + ' người chơi' : ''}`;
  // Bài game kiểu "ra mắt": game có mặt tại shop, khách mua máy được cài miễn phí
  const GAME_POSTS = [
    g => join([
      `🎉 RA MẮT TẠI ${BRAND}: ${g.title.toUpperCase()}\nKhách mua máy tại ${BRAND} được CÀI MIỄN PHÍ ${g.title} vào ổ cứng trước khi giao 🎁`,
      [g.note, gameMeta(g)].filter(Boolean).join('\n'),
      intro(g),
      gamePolicy() ? `📌 Cài game theo chính sách của shop: ${gamePolicy()}.` : null,
      `👉 Giới thiệu ${g.title}: ${site()}/game.html?id=${g.id}\n📚 Toàn bộ game cài cho khách: ${site()}/games.html`,
      offerBlock(),
      signature(tag(g.title), ...(g.platforms || []).map(p => tag('Game' + p))),
    ]),
    g => {
      const hl = highlights(g);
      return join([
        `🆕 GAME MỚI LÊN KỆ CÀI ĐẶT TẠI ${BRAND}\n🔥 ${g.title} – dành cho khách mua máy tại shop`,
        hl.length ? `Có gì hay?\n${hl.map(h => '✅ ' + h).join('\n')}` : intro(g),
        gameMeta(g),
        `🎁 Mua PS5 tại ${BRAND}: cài sẵn ${g.title} cùng ${otherGames(g)}… miễn phí trước khi giao.`,
        gamePolicy() ? `📌 ${gamePolicy()}.` : null,
        `👉 Xem giới thiệu: ${site()}/game.html?id=${g.id}\n📚 Danh sách game: ${site()}/games.html\n📋 Chính sách: ${site()}/#chinh-sach`,
        `✅ ${perksShort()}`,
        signature(tag(g.title)),
      ]);
    },
    g => join([
      `📢 ${BRAND} CẬP NHẬT GAME: ${g.title}`,
      `Mua máy PS5/PS4 tại ${BRAND} hôm nay, nhận máy là chơi ngay ${g.title} – shop cài sẵn miễn phí cho bạn 🎮`,
      [g.note, gameMeta(g)].filter(Boolean).join('\n'),
      gamePolicy() ? `📌 Cài game theo chính sách: ${gamePolicy()}.` : null,
      `👉 ${site()}/game.html?id=${g.id}`,
      offerBlock(),
      signature(tag(g.title)),
    ]),
  ];

  // ---------- Bài hướng dẫn: dựng từ dữ liệu và nội dung có sẵn trên web ----------
  const BRAND_IMG = 'assets/brand/psviet-logo-512.png';
  const BUY_STEPS = [
    ['Nhắn shop', 'Chọn máy hoặc cho shop biết ngân sách qua Messenger, Zalo, Telegram.'],
    ['Xem video máy', 'Shop quay video thật máy bạn sẽ nhận, chốt giá, phụ kiện và game cài sẵn.'],
    ['Nhận hàng COD', 'Kiểm tra máy khi nhận rồi thanh toán, hoặc ghé shop ở Hà Nội để test trực tiếp.'],
  ];
  const CHECKLIST = ['Nguồn, quạt, nhiệt độ', 'Ổ đĩa (Standard / ổ rời)', 'Cổng HDMI, USB', 'Wi-Fi, Bluetooth', 'Tay cầm: nút, drift, sạc', 'Gỡ tài khoản cũ, cài đặt gốc'];
  const fromPriceOf = catId => {
    const ps = (D().products || []).filter(p => p.category === catId && p.visible !== false && +p.price > 0).map(p => +p.price);
    return ps.length ? Math.min(...ps) : 0;
  };
  // Mỗi hướng dẫn có 2 mẫu: bản đầy đủ (kèm khối ưu đãi) và bản ngắn
  const guidePosts = (head, body, link) => [
    () => join([`📘 HƯỚNG DẪN | ${BRAND}\n${head}`, body, link ? `👉 Xem thêm: ${link}` : null, offerBlock(), signature('#HuongDanPS5')]),
    () => join([`💡 ${head}`, body, `✅ ${perksShort()}${link ? '\n👉 ' + link : ''}`, signature('#MeoPS5')]),
  ];
  function guides() {
    const d = D(), out = [];
    const cats = d.machineCategories || [];
    if (cats.length) out.push({ id: 'chon-may', title: `Nên chọn ${cats.map(c => c.name).join(', ')}?`, image: 'assets/may/social/ps5-slim.jpg',
      posts: guidePosts(`Nên chọn ${cats.map(c => c.name.replace(/^PS5\s*/, '')).join(', ')}?`,
        cats.map(c => `🎮 ${c.name}${fromPriceOf(c.id) ? ' – từ ' + money(fromPriceOf(c.id)) : ''}\n${c.description || ''}${(c.bullets || []).length ? '\n' + c.bullets.map(b => '• ' + b).join('\n') : ''}`).join('\n\n'),
        `${site()}/#so-sanh`) });
    out.push({ id: 'mua-hang', title: `Mua máy tại ${BRAND} trong 3 bước`, image: BRAND_IMG,
      posts: guidePosts(`Mua máy tại ${BRAND} chỉ 3 bước`, BUY_STEPS.map(([t, x], i) => `${i + 1}️⃣ ${t}: ${x}`).join('\n'), `${site()}/#mua-hang`) });
    out.push({ id: 'kiem-tra', title: 'Shop kiểm tra gì trước khi giao máy?', image: BRAND_IMG,
      posts: guidePosts('Mỗi máy được test kỹ trước khi giao', CHECKLIST.map(x => '✔️ ' + x).join('\n') + '\n\nCó video quay máy thật gửi bạn trước khi giao.', `${site()}/#mua-hang`) });
    out.push({ id: 'dia-digital', title: 'Nên mua bản có ổ đĩa hay Digital?', image: 'assets/may/social/ps5-fat.jpg',
      posts: guidePosts('Nên mua bản có ổ đĩa hay Digital?', [((d.faq || []).find(f => /Digital/i.test(f.q)) || {}).a, 'Mẹo: đĩa game cũ thường rẻ hơn bản tải về và bán lại được. Nếu hay mua game, nên chọn bản có ổ đĩa.'].filter(Boolean).join('\n\n'), `${site()}/#so-sanh`) });
    (d.policies || []).forEach((p, i) => out.push({ id: 'cs-' + i, title: 'Chính sách: ' + p.title, image: BRAND_IMG,
      posts: guidePosts(`Chính sách: ${p.title}`, (p.items || []).map(x => '• ' + x).join('\n'), `${site()}/#chinh-sach`) }));
    (d.faq || []).forEach((f, i) => out.push({ id: 'faq-' + i, title: 'Hỏi đáp: ' + f.q, image: BRAND_IMG,
      posts: guidePosts(`❓ ${f.q}`, `💬 ${f.a}`, `${site()}/#faq`) }));
    return out;
  }

  // ---------- Bài giới thiệu shop: dựng từ ưu đãi, chính sách, bảng giá và kênh liên hệ trên web ----------
  const SHOP_IMG = 'assets/brand/psviet-banner-v2-1920.jpg';
  // Mỗi chủ đề có 2 mẫu: bản đầy đủ và bản ngắn
  const shopPosts = (head, body, link, offer = true) => [
    () => join([`🏪 ${BRAND} | ${head}`, body, link ? `👉 ${link}` : null, offer ? offerBlock() : null, signature('#ShopPS5', '#PS5cu')]),
    () => join([`✨ ${head}`, body, `✅ ${perksShort()}${link ? '\n👉 ' + link : ''}`, signature('#ShopPS5')]),
  ];
  // Bỏ chữ mẫu chưa điền trong dữ liệu (vd "qua [GHN / Viettel Post]") để không lộ lên bài đăng
  const unfilled = t => String(t).replace(/\s*(qua\s*)?\[[^\]]*\]/g, '').trim();
  function shopTopics() {
    const d = D(), s = d.settings || {}, ms = machines(), gs = games();
    const priceList = ms.filter(p => +p.price > 0).map(p => `🎮 ${postName(p)}: ${priceText(p)}`).join('\n');
    return [
      { id: 'gioi-thieu', title: `Giới thiệu ${BRAND}`, image: SHOP_IMG,
        posts: shopPosts(`Shop PS5 cũ nguyên bản${s.address ? '' : ' tại Hà Nội'}`,
          [`Chào bạn 👋 ${BRAND} chuyên PS5 Fat, Slim, Pro cũ nguyên bản: máy nào cũng được test kỹ, có video quay máy thật gửi bạn trước khi giao.`,
            `Mua máy tại shop được cài sẵn game miễn phí (${gs.length} game PS4, PS5 để bạn chọn), nhận máy là chơi ngay.`].join('\n\n'),
          `${site()}`) },
      { id: 'vi-sao', title: `Vì sao nên mua PS5 tại ${BRAND}?`, image: SHOP_IMG,
        posts: shopPosts(`Vì sao nên mua PS5 tại ${BRAND}?`, perkLines().join('\n'), `Chính sách bảo hành, đổi trả: ${site()}/#chinh-sach`, false) },
      ...(priceList ? [{ id: 'bang-gia', title: 'Bảng giá máy đang có tại shop', image: SHOP_IMG,
        posts: shopPosts('Bảng giá PS5 đang có tại shop', `${priceList}\n\nGiá đã gồm cài game miễn phí. Inbox để xem video máy thật trước khi chốt.`, `Xem máy: ${site()}/#may`) }] : []),
      { id: 'cam-ket', title: 'Cam kết của shop khi bán máy', image: SHOP_IMG,
        posts: shopPosts('Cam kết khi mua máy tại shop',
          [...(d.policies || []).map(p => `📌 ${p.title}${(p.items || [])[0] ? ': ' + unfilled(p.items[0]) : ''}`), '📌 Máy nguyên bản, test kỹ từng máy, có video máy thật trước khi giao'].join('\n'),
          `Chi tiết chính sách: ${site()}/#chinh-sach`, false) },
      { id: 'mua-o-dau', title: s.address ? 'Ghé shop xem máy trực tiếp' : 'Mua máy online, ship COD toàn quốc', image: SHOP_IMG,
        posts: shopPosts(s.address ? 'Ghé shop xem và test máy trực tiếp' : 'Mua máy online, nhận hàng mới trả tiền',
          [s.address && `📍 ${s.address}`,
            '🚚 Ở xa? Shop ship COD toàn quốc: kiểm tra máy khi nhận rồi mới thanh toán.',
            ...BUY_STEPS.map(([t, x], i) => `${i + 1}️⃣ ${t}: ${x}`)].filter(Boolean).join('\n'),
          `Hướng dẫn mua hàng: ${site()}/#mua-hang`) },
      { id: 'theo-doi', title: `Theo dõi ${BRAND} để không lỡ máy mới về`, image: SHOP_IMG,
        posts: shopPosts(`Theo dõi ${BRAND} để không lỡ máy ngon, giá tốt`,
          ['🔔 Máy mới về, game mới cài cho khách, ưu đãi trong tuần đều đăng trước tiên trên các kênh của shop.',
            s.youtube ? '▶️ Kênh YouTube có video test máy thật và hướng dẫn chơi game.' : null].filter(Boolean).join('\n'), null, false) },
    ];
  }

  // ---------- Lịch 7 ngày, 2 bài/ngày: khung đầu là máy, khung sau là game ----------
  const DAY = 86400000;
  const pad = n => String(n).padStart(2, '0');
  const dayName = d => ['Chủ nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'][d.getDay()];
  function slots() {
    const out = [], ms = machines(), gs = games(), today = new Date(); today.setHours(0, 0, 0, 0);
    for (let i = 0; i < 7; i++) {
      const d = new Date(today.getTime() + i * DAY), dayNo = Math.floor(d.getTime() / DAY);
      times().forEach((t, j) => {
        const [h, m] = t.split(':').map(Number), at = new Date(d); at.setHours(h, m, 0, 0);
        const isGame = j % 2 === 1, list = isGame ? gs : ms;
        if (!list.length) return;
        const item = list[(dayNo + Math.floor(j / 2)) % list.length];
        const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}-${t}`;
        const dayLabel = (i === 0 ? 'Hôm nay · ' : i === 1 ? 'Ngày mai · ' : '') + `${dayName(d)}, ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
        out.push({ key, at, t, day: i, dayLabel, label: `${dayLabel} · ${t}`, isGame, item });
      });
    }
    return out;
  }
  const KIND = { machine: ['Bài máy', 'info'], game: ['Bài game', 'hot'], guide: ['Hướng dẫn', 'ok'], shop: ['Giới thiệu shop', 'info'] };
  const kindOf = s => s.kind || (s.isGame ? 'game' : 'machine');
  const templatesFor = s => ['guide', 'shop'].includes(kindOf(s)) ? s.item.posts : s.isGame ? GAME_POSTS : MACHINE_POSTS;
  const textFor = s => {
    const dr = drafts[s.key] || {};
    if (dr.text != null && dr.itemId === s.item.id) return dr.text;
    const tpl = templatesFor(s);
    return tpl[(dr.v || 0) % tpl.length](s.item);
  };
  const doneFor = key => st && st.history.find(h => h.slot === key && h.status !== 'failed');
  const fmtTime = sec => { const d = new Date(sec * 1000); return `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`; };
  // Nội dung xem trước giống Facebook: giữ xuống dòng, link bấm được
  // Một lượt quét: link trước, hashtag chỉ khi đứng đầu dòng hoặc sau khoảng trắng (không bắt nhầm "#" trong link hay "&#39;")
  const previewHtml = text => esc(text).replace(/(https?:\/\/[^\s<]+)|(^|\s)(#[\p{L}\p{N}_]+)/gmu,
    (m, url, pre, tagText) => url ? `<a href="${url}" target="_blank" rel="noopener">${url}</a>` : `${pre}<span class="fb-tag">${tagText}</span>`);

  function serverNote() {
    return A.isServer() ? '' : '<div class="panel mk-note">Đang mở trang quản trị không qua server.py nên chỉ soạn và sao chép được bài, chưa đăng tự động.</div>';
  }

  function cardHtml(s) {
    const done = doneFor(s.key), canSchedule = s.at.getTime() >= Date.now() + 10 * 60000;
    const img = imgOf(s.item), editing = !!(drafts[s.key] && drafts[s.key].editing), text = textFor(s);
    const variants = templatesFor(s).length, v = ((drafts[s.key] || {}).v || 0) % variants + 1;
    const manual = (drafts[s.key] || {}).manual;
    const fbOn = st && st.facebook.connected;
    return `
      <article class="mk-card${done ? ' is-done' : ''}${editing ? ' is-editing' : ''}" data-key="${esc(s.key)}">
        <header class="mk-card-head">
          ${s.noTime ? (s.item.platforms || (kindOf(s) === 'machine' ? [catOf(s.item).name || 'PS5'] : [])).map(p => `<span class="mk-time">${esc(p)}</span>`).join('') : `<span class="mk-time">${icon('clock')}${esc(s.t)}</span>`}
          <span class="badge ${KIND[kindOf(s)][1]}">${KIND[kindOf(s)][0]}</span>
          <span class="mk-item">${esc(s.item.title || s.item.name)}</span>
          ${done ? `<a class="badge ok" href="${esc(done.url || '#')}" target="_blank" rel="noopener">${done.status === 'scheduled' ? 'Đã hẹn ' + fmtTime(done.scheduled_for) : 'Đã đăng'}</a>` : ''}
          ${!done && manual ? `<span class="badge ok" title="Đã sao chép và mở Facebook lúc ${esc(manual)}">Đã đăng tay</span>` : ''}
        </header>
        <div class="fb-post">
          <div class="fb-head"><img src="assets/brand/psviet-mark-192.png" alt=""><div><b>${BRAND}</b><small>${done && done.status === 'published' ? 'Đã đăng' : esc(s.label)} · 🌐</small></div></div>
          ${editing
            ? `<textarea class="mk-edit" rows="14" data-edit="${esc(s.key)}" data-item="${esc(s.item.id)}">${esc(text)}</textarea>
               <div class="mk-edit-bar"><small class="muted"><span data-count>${text.length}</span> ký tự</small>
                 <button class="btn outline sm" type="button" data-mk="reset">${icon('swap')}Khôi phục mẫu</button>
                 <button class="btn primary sm" type="button" data-mk="done">${icon('check')}Xong</button></div>`
            : `<div class="fb-text">${previewHtml(text)}</div><button class="fb-more" type="button" data-mk="more">Xem thêm</button>`}
          ${img ? `<img class="fb-img${s.isGame ? ' is-cover' : ''}" src="${esc(img)}" alt="" loading="lazy">` : ''}
        </div>
        <footer class="mk-actions">
          <div class="mk-tools">
            <button class="btn outline sm" type="button" data-mk="edit" ${editing ? 'hidden' : ''}>${icon('edit')}Sửa bài</button>
            <button class="btn outline sm" type="button" data-mk="variant" title="Mẫu ${v}/${variants}" ${variants > 1 ? '' : 'hidden'}>${icon('swap')}Đổi mẫu <small>${v}/${variants}</small></button>
            <button class="btn outline sm" type="button" data-mk="copy">${icon('copy')}Sao chép</button>
          </div>
          ${A.isServer() ? `<div class="mk-send">
            <button class="btn primary sm" type="button" data-mk="now" title="Chọn đăng lên Fanpage hoặc vào nhóm">${icon('send')}Đăng bài</button>
            ${s.noTime ? '' : `<button class="btn outline sm" type="button" data-mk="schedule" ${done || !canSchedule ? 'disabled' : ''} title="${!fbOn ? 'Cần kết nối Fanpage để hẹn giờ' : canSchedule ? '' : 'Đã qua giờ hẹn, dùng Đăng ngay'}">${icon('clock')}Hẹn ${esc(s.t)}</button>`}
          </div>` : ''}
        </footer>
      </article>`;
  }

  // Chưa kết nối Fanpage: sao chép bài, tải ảnh về, mở trang Facebook của shop để dán và bấm Đăng
  async function manualPost(s) {
    const fbUrl = (D().settings || {}).facebook || 'https://www.facebook.com/';
    const win = openTab(fbUrl);
    await copy(textFor(s));
    const img = imgOf(s.item);
    if (img) {
      const a = document.createElement('a');
      a.href = img; a.download = img.split('/').pop();
      document.body.append(a); a.click(); a.remove();
    }
    const dr = drafts[s.key] || (drafts[s.key] = {});
    const d = new Date(); dr.manual = `${pad(d.getHours())}:${pad(d.getMinutes())} ${pad(d.getDate())}/${pad(d.getMonth() + 1)}`;
    saveDrafts();
    A.toast(win ? 'Đã sao chép bài và tải ảnh. Dán vào ô "Bạn đang nghĩ gì?", thêm ảnh vừa tải rồi bấm Đăng.' : 'Đã sao chép bài. Trình duyệt chặn mở tab – hãy mở trang Facebook của shop để dán.', win ? 'ok' : 'err');
    rerender();
  }
  let rerender = () => renderCalendar();

  async function renderCalendar() {
    $('#view').innerHTML = '<p class="muted">Đang tải…</p>';
    await loadStatus();
    const fb = st && st.facebook.connected;
    const list = slots();
    const days = [];
    list.forEach(s => { (days[s.day] = days[s.day] || { label: s.dayLabel, items: [] }).items.push(s); });
    const doneCount = list.filter(s => doneFor(s.key)).length;
    $('#view').innerHTML = `${serverNote()}
      <div class="mk-summary">
        <div class="mk-sum-item ${fb ? 'ok' : 'warn'}">${icon('send')}<div><b>${fb ? esc(st.facebook.page_name) : 'Chưa kết nối Fanpage'}</b><small>${fb ? 'Fanpage đang kết nối' : 'Vẫn soạn và sao chép được bài'}</small></div>
          ${fb ? '' : '<button class="btn primary sm" type="button" data-mk="goconnect">Kết nối</button>'}</div>
        <div class="mk-sum-item">${icon('clock')}<div><b>${doneCount}/${list.length} bài đã lên lịch</b><small>7 ngày tới · khung giờ ${esc(times().join(' và '))}</small></div></div>
        <div class="mk-sum-item">${icon('star')}<div><b>Mỗi bài đều có ưu đãi</b><small>Cài game miễn phí, bảo hành, đổi máy, ship COD, link chính sách</small></div></div>
      </div>
      ${days.filter(Boolean).map(d => `
        <section class="mk-day">
          <h3>${esc(d.label)}</h3>
          <div class="mk-day-grid">${d.items.map(cardHtml).join('')}</div>
        </section>`).join('')}`;
    rerender = () => renderCalendar();
    bindCards(Object.fromEntries(list.map(s => [s.key, s])));
  }

  // Các nút trên thẻ bài (dùng chung cho Lịch đăng và Bài về game)
  function bindCards(byKey) {
    // Trong Kho bài đăng: vẽ lại cả danh sách để dòng tương ứng cập nhật; ở Lịch đăng chỉ vẽ lại thẻ
    const refresh = s => (libOpen && document.querySelector('.lib-drawer.open') ? rerender() : redraw(s));
    const redraw = s => {
      const card = $(`.mk-card[data-key="${CSS.escape(s.key)}"]`);
      card.outerHTML = cardHtml(s);
      const ta = $(`.mk-card[data-key="${CSS.escape(s.key)}"] textarea`);
      if (ta) { ta.focus(); ta.setSelectionRange(0, 0); ta.scrollTop = 0; }
    };
    $('#view').oninput = e => {
      const ta = e.target.closest('[data-edit]');
      if (!ta) return;
      drafts[ta.dataset.edit] = { ...(drafts[ta.dataset.edit] || {}), text: ta.value, itemId: ta.dataset.item };
      saveDrafts();
      const c = ta.closest('.fb-post').querySelector('[data-count]');
      if (c) c.textContent = ta.value.length;
    };
    $('#view').onclick = async e => {
      const b = e.target.closest('[data-mk]');
      if (!b) return;
      if (b.dataset.mk === 'goconnect') return $('#admin-nav [data-sec="mktConnect"]').click();
      const card = b.closest('.mk-card'), s = byKey[card.dataset.key];
      const dr = drafts[s.key] || (drafts[s.key] = {});
      switch (b.dataset.mk) {
        case 'more': return card.classList.toggle('show-all');
        case 'copy': return copy(textFor(s));
        case 'edit': dr.editing = true; saveDrafts(); return redraw(s);
        case 'done': dr.editing = false; saveDrafts(); return refresh(s);
        case 'reset':
          if (!confirm('Bỏ phần đã sửa và dùng lại mẫu?')) return;
          drafts[s.key] = { v: dr.v || 0, editing: true }; saveDrafts(); return redraw(s);
        case 'variant':
          if (dr.text != null && !confirm('Đổi mẫu sẽ bỏ phần bạn đã sửa. Tiếp tục?')) return;
          drafts[s.key] = { v: (dr.v || 0) + 1, editing: dr.editing }; saveDrafts(); return refresh(s);
      }
      return b.dataset.mk === 'now' ? openPublish(s) : publish(s, false, b);
    };
  }

  // Đăng ngay / hẹn giờ lên Fanpage; chưa kết nối thì chuyển sang đăng tay
  async function publish(s, now, btn) {
    if (!(st && st.facebook.connected)) {
      if (!now) return A.toast('Hẹn giờ cần kết nối Fanpage. Vào "Kết nối & lịch sử" để kết nối, hoặc bấm "Đăng ngay" để đăng tay.', 'err');
      return manualPost(s);
    }
    if (!confirm(now ? `Đăng bài "${s.item.title || s.item.name}" lên Fanpage ngay bây giờ?` : `Hẹn đăng bài này lên Fanpage lúc ${s.label}?`)) return;
    if (btn) btn.disabled = true;
    try {
      const r = await A.api('/api/autopost/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ message: textFor(s), image: imgOf(s.item) || '', slot: s.key, scheduled_at: now ? null : Math.floor(s.at.getTime() / 1000) }) });
      A.toast(r.status === 'scheduled' ? 'Đã hẹn giờ trên Fanpage.' : 'Đã đăng lên Fanpage.');
      rerender();
    } catch (err) {
      if (btn) btn.disabled = false;
      // Ứng dụng Facebook chưa được cấp quyền đăng bài: không để kẹt, chuyển sang đăng tay nhanh
      if (now && /pages_manage_posts|publish_actions|permission/i.test(err.message)) {
        A.toast('Ứng dụng Facebook chưa có quyền đăng bài (pages_manage_posts) – chuyển sang đăng tay: đã sao chép bài, tải ảnh và mở Fanpage.', 'err');
        return manualPost(s);
      }
      A.toast(err.message, 'err');
    }
  }

  // ---------- Kho bài đăng: chia loại Máy / Game / Hướng dẫn / Shop, có tìm kiếm ----------
  let libTab = 'game', gpFilter = 'PS5', libQuery = '', libOpen = null, libAnim = false;
  // Dòng mở đầu của bài (bỏ biểu tượng cảm xúc đầu dòng) để xem nhanh trong danh sách
  const excerpt = s => (textFor(s).split('\n').find(l => l.trim()) || '').replace(/^[^\p{L}\p{N}]+/u, '');
  const rowHtml = s => {
    const done = doneFor(s.key), manual = (drafts[s.key] || {}).manual, img = imgOf(s.item);
    const chips = (s.item.platforms || (kindOf(s) === 'machine' ? [catOf(s.item).name || 'PS5'] : [])).map(p => `<span class="lib-chip">${esc(p)}</span>`).join('');
    return `
      <div class="lib-row${libOpen === s.key ? ' is-open' : ''}" data-key="${esc(s.key)}">
        <span class="lib-thumb${kindOf(s) === 'game' ? ' is-cover' : ''}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</span>
        <button class="lib-main" type="button" data-lib="open"><b>${esc(s.item.title || s.item.name)}</b><small>${esc(excerpt(s))}</small></button>
        <span class="lib-meta">${chips}${(drafts[s.key] || {}).text != null ? '<span class="lib-chip warn">Đã sửa</span>' : ''}
          ${done ? `<span class="badge ok">${done.status === 'scheduled' ? 'Đã hẹn' : 'Đã đăng'}</span>` : manual ? '<span class="badge ok">Đã đăng tay</span>' : ''}</span>
        <span class="row-acts">
          <button class="ra" type="button" data-lib="open" data-tip="Xem &amp; sửa" aria-label="Xem và sửa">${icon('edit')}</button>
          <button class="ra" type="button" data-lib="copy" data-tip="Sao chép bài" aria-label="Sao chép bài">${icon('copy')}</button>
          <button class="ra ra-post" type="button" data-lib="post" data-tip="Đăng bài (Fanpage / Nhóm)" aria-label="Đăng bài">${icon('send')}</button>
        </span>
      </div>`;
  };
  async function renderLibrary() {
    $('#view').innerHTML = '<p class="muted">Đang tải…</p>';
    await loadStatus();
    const byName = (a, b) => (a.item.title || a.item.name).localeCompare(b.item.title || b.item.name, 'vi', { numeric: true });
    const all = {
      machine: machines().map(p => ({ key: 'lib-m-' + p.id, kind: 'machine', noTime: true, item: p, at: new Date(), t: '', label: 'Bài giới thiệu máy' })),
      game: games().filter(g => gpFilter === 'all' || (g.platforms || []).includes(gpFilter))
        .map(g => ({ key: 'game-' + g.id, kind: 'game', isGame: true, noTime: true, item: g, at: new Date(), t: '', label: 'Bài giới thiệu game' })).sort(byName),
      guide: guides().map(g => ({ key: 'lib-h-' + g.id, kind: 'guide', noTime: true, item: g, at: new Date(), t: '', label: 'Bài hướng dẫn' })),
      shop: shopTopics().map(g => ({ key: 'lib-s-' + g.id, kind: 'shop', noTime: true, item: g, at: new Date(), t: '', label: 'Bài giới thiệu shop' })),
    };
    const q = libQuery.trim().toLowerCase();
    const list = all[libTab].filter(s => !q || (s.item.title || s.item.name).toLowerCase().includes(q));
    const gameCount = p => games().filter(g => p === 'all' || (g.platforms || []).includes(p)).length;
    const TABS = [['machine', 'Máy', 'gamepad', machines().length], ['game', 'Game', 'star', games().length], ['guide', 'Hướng dẫn', 'shield', all.guide.length], ['shop', 'Shop', 'badge', all.shop.length]];
    $('#view').innerHTML = `${serverNote()}
      <div class="mk-tabs" role="tablist">${TABS.map(([k, t, ic, n]) =>
        `<button class="mk-tab${libTab === k ? ' active' : ''}" type="button" role="tab" aria-selected="${libTab === k}" data-tab="${k}">${icon(ic)}${t}<small>${n}</small></button>`).join('')}</div>
      <div class="mk-bar mk-gp-bar">
        <label class="search mk-lib-q">${icon('search')}<input id="mk-lib-q" type="search" placeholder="Tìm bài ${{ machine: 'máy', game: 'game', guide: 'hướng dẫn', shop: 'giới thiệu shop' }[libTab]}…" value="${esc(libQuery)}"></label>
        ${libTab === 'game' ? `<div class="filter-chips">${[['PS5', 'PS5'], ['PS4', 'PS4'], ['all', 'Tất cả']].map(([k, t]) =>
          `<button class="chip${gpFilter === k ? ' active' : ''}" type="button" data-gp="${k}">${t} <small>${gameCount(k)}</small></button>`).join('')}</div>` : ''}
        <span class="muted">${list.length} bài</span>
      </div>
      ${list.length ? `<div class="lib-list">${list.map(rowHtml).join('')}</div>` : '<p class="empty">Không có bài phù hợp.</p>'}
      <div class="lib-scrim"${libOpen ? '' : ' hidden'} data-lib="close"></div>
      <aside class="lib-drawer${libOpen ? ' open' : ''}${libAnim ? ' anim' : ''}" aria-label="Xem và sửa bài">
        <div class="lib-drawer-head"><b>Xem &amp; sửa bài</b><button class="ra" type="button" data-lib="close" aria-label="Đóng">${icon('x')}</button></div>
        <div class="lib-drawer-body">${libOpen && list.find(s => s.key === libOpen) ? cardHtml(list.find(s => s.key === libOpen)) : ''}</div>
      </aside>`;
    libAnim = false;
    rerender = () => renderLibrary();
    const byKey = Object.fromEntries(list.map(s => [s.key, s]));
    bindCards(byKey);
    const click = $('#view').onclick;
    $('#view').onclick = e => {
      const l = e.target.closest('[data-lib]');
      if (l) {
        const row = l.closest('.lib-row'), s = row && byKey[row.dataset.key];
        if (l.dataset.lib === 'close') { libOpen = null; return renderLibrary(); }
        if (l.dataset.lib === 'open') { libAnim = libOpen !== s.key; libOpen = s.key; return renderLibrary(); }
        if (l.dataset.lib === 'copy') return copy(textFor(s));
        if (l.dataset.lib === 'post') return openPublish(s);
      }
      const t = e.target.closest('[data-tab]');
      if (t) { libTab = t.dataset.tab; libQuery = ''; libOpen = null; return renderLibrary(); }
      const f = e.target.closest('[data-gp]');
      if (f) { gpFilter = f.dataset.gp; return renderLibrary(); }
      return click(e);
    };
    const qi = $('#mk-lib-q');
    qi.addEventListener('input', () => {
      libQuery = qi.value;
      renderLibrary().then(() => { const n = $('#mk-lib-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length); });
    });
  }

  // Mở tab mới; không dùng tham số "noopener" vì khi đó trình duyệt luôn trả về null (tưởng nhầm là bị chặn)
  const openTab = url => { const w = window.open(url, '_blank'); if (w) w.opener = null; return w; };

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); A.toast('Đã sao chép.'); }
    catch (e) { A.toast('Không sao chép được, hãy bôi đen rồi Cmd+C.', 'err'); }
  }

  // ---------- Bài cho nhóm Facebook (đăng tay, mỗi nhóm một mẫu) ----------
  // Câu xin phép quản trị viên, tự thêm vào đầu bài khi đăng vào nhóm (mỗi nhóm một câu khác)
  const ASK_ADMIN = [
    '🙏 Xin phép Admin và các anh em trong nhóm cho em đăng bài ạ.',
    '🙏 Em xin phép Admin duyệt giúp bài, cảm ơn Admin và cả nhà ạ!',
    '🙏 Xin phép Ad cho shop chia sẻ chút thông tin, có gì sai sót mong Ad nhắc nhở ạ.',
    '🙏 Chào cả nhà, em xin phép Admin được đăng bài ạ.',
  ];
  // Từ khoá mở thẳng trang tìm nhóm của Facebook (Facebook không cho phần mềm tự quét nhóm)
  const FIND_KEYWORDS = ['mua bán PS5', 'mua bán PS4', 'PS5 cũ Hà Nội', 'PS4 cũ Hà Nội', 'máy game cũ', 'PlayStation Việt Nam', 'game thủ PS5', 'PS5 Sài Gòn', 'đồ công nghệ cũ Hà Nội'];
  const POSTED_KEY = 'psviet-group-posted';
  const today = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const postedLog = () => { try { return JSON.parse(localStorage.getItem(POSTED_KEY) || '{}'); } catch (e) { return {}; } };
  const savePosted = log => { try { localStorage.setItem(POSTED_KEY, JSON.stringify(log)); } catch (e) {} };

  // ---------- Hộp "Đăng bài": chọn Fanpage hoặc Nhóm Facebook ----------
  let pub = null;   // { s, target: 'page' | 'group', picked: Set(link), queue: { list, pos } }
  const pubEl = document.createElement('div');
  pubEl.className = 'mkp';
  pubEl.hidden = true;
  document.body.append(pubEl);
  const groupText = (s, i) => ASK_ADMIN[i % ASK_ADMIN.length] + '\n\n' + textFor(s);
  const groupsList = () => (st && st.settings.groups) || [];

  function openPublish(s) {
    pub = { s, target: 'page', picked: new Set(), queue: null };
    drawPublish();
  }
  function closePublish() { pub = null; pubEl.hidden = true; pubEl.innerHTML = ''; }

  function pageBody() {
    const fbOn = st && st.facebook.connected;
    return fbOn
      ? `<p>Bài sẽ được đăng ngay lên Fanpage <b>${esc(st.facebook.page_name)}</b>, kèm ảnh.</p>
         <div class="mkp-foot"><button class="btn primary" type="button" data-p="fb">${icon('send')}Đăng lên Fanpage</button></div>`
      : `<p>Fanpage chưa kết nối nên đăng tay nhanh: bấm nút dưới để <b>sao chép bài, tải ảnh và mở trang Facebook của shop</b>, rồi dán vào ô "Bạn đang nghĩ gì?" và bấm Đăng.</p>
         <div class="mkp-foot"><button class="btn outline" type="button" data-p="goconnect">Kết nối Fanpage</button><button class="btn primary" type="button" data-p="fb">${icon('send')}Sao chép &amp; mở Facebook</button></div>`;
  }

  function groupBody() {
    const groups = groupsList(), log = postedLog()[today()] || {}, postedToday = Object.keys(log).length;
    if (!groups.length) {
      return `<p>Chưa có nhóm nào. Thêm danh sách nhóm ở mục <b>Kết nối &amp; lịch sử → Nhóm Facebook</b>.</p>
        <div class="mkp-foot"><button class="btn primary" type="button" data-p="goconnect">Thêm nhóm</button></div>`;
    }
    if (pub.queue) {
      const { list, pos } = pub.queue, i = list[pos], g = groups[i];
      return `<div class="mk-queue">
          <div><small>Đăng lần lượt · nhóm ${pos + 1}/${list.length}</small><b>${esc(g.name || g.url)}</b></div>
          <button class="btn primary" type="button" data-p="next">${icon('send')}Sao chép &amp; mở nhóm</button>
          <button class="btn outline sm" type="button" data-p="skip">Bỏ qua</button>
          <button class="btn outline sm" type="button" data-p="stop">Dừng</button>
        </div>
        <p class="muted">Mỗi lần bấm: bài (có câu xin phép Admin) được sao chép và nhóm mở ở tab mới. Dán vào ô viết bài của nhóm, thêm ảnh rồi bấm Đăng, sau đó quay lại bấm tiếp.</p>
        <div class="mkp-preview">${previewHtml(groupText(pub.s, i))}</div>`;
    }
    return `<p class="mkp-note">${icon('chat')}<span>Đầu bài sẽ tự thêm câu xin phép Admin, mỗi nhóm một câu khác, ví dụ: <i>"${esc(ASK_ADMIN[0])}"</i></span></p>
      <div class="mkp-groups-head"><label class="check"><input type="checkbox" data-p="gall" ${groups.every(g => pub.picked.has(g.url)) ? 'checked' : ''}><span>Chọn tất cả</span></label><small class="muted">Hôm nay đã đăng ${postedToday} nhóm</small></div>
      <div class="mkp-groups">${groups.map((g, i) => `
        <label class="mkp-group${log[g.url] ? ' is-posted' : ''}"><input type="checkbox" data-p="gpick" data-i="${i}" ${pub.picked.has(g.url) ? 'checked' : ''}>
          <span><b>${esc(g.name || 'Nhóm ' + (i + 1))}</b><small>${esc(g.url.replace(/^https?:\/\/(www\.)?/, ''))}</small></span>
          ${log[g.url] ? `<span class="badge ok">Đã đăng ${esc(log[g.url])}</span>` : ''}</label>`).join('')}</div>
      <div class="mkp-foot"><button class="btn primary" type="button" data-p="start" ${pub.picked.size ? '' : 'disabled'}>${icon('send')}Đăng vào ${pub.picked.size} nhóm</button></div>`;
  }

  function drawPublish() {
    const fbOn = st && st.facebook.connected, groups = groupsList();
    pubEl.hidden = false;
    pubEl.innerHTML = `
      <div class="mkp-scrim" data-p="close"></div>
      <div class="mkp-box" role="dialog" aria-modal="true" aria-label="Đăng bài">
        <header class="mkp-head"><div><small>Đăng bài</small><b>${esc(pub.s.item.title || pub.s.item.name)}</b></div><button class="ra" type="button" data-p="close" aria-label="Đóng">${icon('x')}</button></header>
        <div class="mkp-targets">
          <button class="mkp-target${pub.target === 'page' ? ' active' : ''}" type="button" data-p="page">${icon('send')}<span><b>Fanpage</b><small>${fbOn ? esc(st.facebook.page_name) + ' · tự động' : 'Chưa kết nối · đăng tay nhanh'}</small></span></button>
          <button class="mkp-target${pub.target === 'group' ? ' active' : ''}" type="button" data-p="group">${icon('chat')}<span><b>Nhóm Facebook</b><small>${groups.length} nhóm · kèm câu xin phép Admin</small></span></button>
        </div>
        <div class="mkp-body">${pub.target === 'page' ? pageBody() : groupBody()}</div>
      </div>`;
  }

  // Sao chép bài cho nhóm thứ i và mở nhóm ở tab mới (mỗi lần bấm chỉ được mở một tab)
  async function postToGroup(i) {
    const g = groupsList()[i];
    const win = openTab(g.url);
    await copy(groupText(pub.s, i));
    const log = postedLog(), day = today(), d = new Date();
    Object.keys(log).forEach(k => { if (k !== day) delete log[k]; });
    (log[day] = log[day] || {})[g.url] = `${pad(d.getHours())}:${pad(d.getMinutes())}`;
    savePosted(log);
    A.toast(win ? 'Đã sao chép bài (có câu xin phép Admin). Dán vào ô viết bài của nhóm rồi bấm Đăng.' : 'Đã sao chép bài. Trình duyệt chặn mở tab – bấm vào link nhóm để mở.', win ? 'ok' : 'err');
  }

  pubEl.addEventListener('click', async e => {
    const b = e.target.closest('[data-p]');
    if (!b || !pub) return;
    const groups = groupsList();
    switch (b.dataset.p) {
      case 'close': return closePublish();
      case 'page': case 'group': pub.target = b.dataset.p; return drawPublish();
      case 'goconnect': closePublish(); return $('#admin-nav [data-sec="mktConnect"]').click();
      case 'fb': { const s = pub.s; closePublish(); return publish(s, true); }
      case 'gpick': b.checked ? pub.picked.add(groups[+b.dataset.i].url) : pub.picked.delete(groups[+b.dataset.i].url); return drawPublish();
      case 'gall': groups.forEach(g => b.checked ? pub.picked.add(g.url) : pub.picked.delete(g.url)); return drawPublish();
      case 'start': {
        const list = groups.map((g, i) => pub.picked.has(g.url) ? i : -1).filter(i => i >= 0);
        const done = Object.keys(postedLog()[today()] || {}).length;
        if (done + list.length > 4 && !confirm(`Bạn sắp đăng ${list.length} nhóm (hôm nay đã đăng ${done}). Đăng nhiều nhóm liền nhau dễ bị Facebook coi là spam. Vẫn tiếp tục?`)) return;
        pub.queue = { list, pos: 0 };
        return drawPublish();
      }
      case 'stop': pub.queue = null; return drawPublish();
      case 'next': await postToGroup(pub.queue.list[pub.queue.pos]); // fallthrough: sang nhóm kế
      case 'skip':
        pub.queue.pos++;
        if (pub.queue.pos >= pub.queue.list.length) { A.toast(`Đã đi hết ${pub.queue.list.length} nhóm.`); pub.queue = null; pub.picked.clear(); }
        return drawPublish();
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pub) closePublish(); });

  // Khung quản lý danh sách nhóm (trong "Kết nối & lịch sử")
  function groupsPanel() {
    const groups = groupsList();
    return `<form class="panel" id="mk-groups-form">
        <h3>Nhóm Facebook <small class="muted">${groups.length} nhóm</small></h3>
        <div class="mk-find">
          <span>${icon('search')}Tìm nhóm trên Facebook:</span>
          ${FIND_KEYWORDS.map(k => `<a class="chip-link" href="https://www.facebook.com/search/groups/?q=${encodeURIComponent(k)}" target="_blank" rel="noopener">${esc(k)}</a>`).join('')}
        </div>
        <label class="field"><span class="lab">Mỗi dòng một nhóm: <code>Tên nhóm | link nhóm</code> (có thể chỉ dán link). Cần tham gia nhóm trước mới đăng được.</span>
          <textarea id="mk-group-list" rows="7" placeholder="Hội mua bán PS5 Hà Nội | https://www.facebook.com/groups/...">${esc(groups.map(g => (g.name ? g.name + ' | ' : '') + g.url).join('\n'))}</textarea></label>
        <div class="panel-foot"><button class="btn primary" type="submit">${icon('check')}Lưu danh sách nhóm</button></div>
      </form>`;
  }
  async function saveGroups(e) {
    e.preventDefault();
    const list = $('#mk-group-list').value.split('\n').map(l => l.trim()).filter(Boolean).map(l => {
      const [a, ...rest] = l.split('|');
      return rest.length ? { name: a.trim(), url: rest.join('|').trim() } : { name: '', url: a.trim() };
    });
    const bad = list.filter(g => !/^https?:\/\//.test(g.url));
    if (bad.length) return A.toast(`Có ${bad.length} dòng không phải link (cần bắt đầu bằng https://).`, 'err');
    try {
      st = await A.api('/api/autopost/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ groups: list }) });
      A.toast(`Đã lưu ${list.length} nhóm.`);
      renderConnect();
    } catch (err) { A.toast(err.message, 'err'); }
  }

  // ---------- Video YouTube ----------
  const ytTitle = item => item.title ? `${item.title} – Giới thiệu game ${(item.platforms || []).join(', ')} | PSVIET.COM` : `${postName(item)} cũ – Test máy thực tế | PSVIET.COM`;
  const ytDesc = item => item.title
    ? [item.note || '', '', intro(item), '', `Giới thiệu đầy đủ: ${site()}/game.html?id=${item.id}`, `Mua máy PS5 cũ tại PSVIET.COM: ${site()}`, contact(), '', [tag(item.title), tag('PS5'), tag('PSVIET')].join(' ')].join('\n')
    : [`${postName(item)} – giá ${money(item.price)}${item.condition ? ', ngoại hình ' + item.condition : ''}.`, (D().settings || {}).productPerk || '', 'Ship COD toàn quốc.', '', `Xem máy: ${site()}/#may`, contact(), '', [tag('PS5'), tag('PS5cu'), tag('PSVIET')].join(' ')].join('\n');
  async function renderYoutube() {
    $('#view').innerHTML = '<p class="muted">Đang tải…</p>';
    await loadStatus();
    const yt = st && st.youtube.connected;
    const all = [...machines().map(p => ['m:' + p.id, '🎮 ' + p.name, p]), ...games().map(g => ['g:' + g.id, '🕹 ' + g.title, g])];
    $('#view').innerHTML = `${serverNote()}
      <div class="panel mk-note">${yt ? '' : '<b>Chưa kết nối kênh YouTube</b> – vào mục "Kết nối &amp; lịch sử" để kết nối. '}Khi Google chưa duyệt (audit) project, video tải qua API sẽ bị khoá ở chế độ riêng tư.</div>
      <form class="panel" id="yt-form">
        <div class="form-grid">
          <label class="field"><span class="lab">Điền sẵn theo máy / game (không bắt buộc)</span>
            <select id="yt-item"><option value="">— Tự nhập —</option>${all.map(([k, t]) => `<option value="${esc(k)}">${esc(t)}</option>`).join('')}</select></label>
          <label class="field"><span class="lab">Tệp video <i>*</i></span><input id="yt-file" type="file" accept="video/*" required></label>
          <label class="field"><span class="lab">Tiêu đề <i>*</i> (tối đa 100 ký tự)</span><input id="yt-title" type="text" maxlength="100" required></label>
          <label class="field"><span class="lab">Mô tả</span><textarea id="yt-desc" rows="8"></textarea></label>
          <label class="field half"><span class="lab">Thẻ (cách nhau bằng dấu phẩy)</span><input id="yt-tags" type="text" value="PS5, PlayStation, PSVIET"></label>
          <label class="field half"><span class="lab">Chế độ</span><select id="yt-privacy"><option value="public">Công khai</option><option value="unlisted">Không công khai</option><option value="private">Riêng tư</option></select></label>
          <label class="field half"><span class="lab">Hẹn giờ công khai (không bắt buộc)</span><input id="yt-at" type="datetime-local"></label>
        </div>
        <div class="mk-progress" hidden><span></span></div>
        <p id="yt-result" class="muted"></p>
        <div class="panel-foot"><button class="btn primary" type="submit" ${yt ? '' : 'disabled'}>${icon('youtube')}Tải lên YouTube</button></div>
      </form>`;
    const byKey = Object.fromEntries(all.map(([k, , it]) => [k, it]));
    $('#yt-item').onchange = e => {
      const it = byKey[e.target.value];
      if (!it) return;
      $('#yt-title').value = ytTitle(it).slice(0, 100);
      $('#yt-desc').value = ytDesc(it);
    };
    $('#view').onclick = null; $('#view').oninput = null;
    $('#yt-form').onsubmit = e => {
      e.preventDefault();
      const file = $('#yt-file').files[0];
      if (!file) return;
      const at = $('#yt-at').value ? Math.floor(new Date($('#yt-at').value).getTime() / 1000) : null;
      const meta = { title: $('#yt-title').value.trim(), description: $('#yt-desc').value, privacy: $('#yt-privacy').value, publish_at: at,
        tags: $('#yt-tags').value.split(',').map(t => t.trim()).filter(Boolean) };
      const btn = e.target.querySelector('[type=submit]'), bar = $('.mk-progress'), res = $('#yt-result');
      btn.disabled = true; bar.hidden = false; res.textContent = 'Đang tải video lên server…';
      // Dùng XHR để hiện tiến độ tải lên (fetch chưa có)
      const xhr = new XMLHttpRequest();
      xhr.open('POST', '/api/autopost/youtube/upload');
      xhr.setRequestHeader('Content-Type', file.type || 'video/mp4');
      xhr.setRequestHeader('X-Meta', btoa(unescape(encodeURIComponent(JSON.stringify(meta)))));
      xhr.upload.onprogress = ev => {
        if (!ev.lengthComputable) return;
        const pct = Math.round(ev.loaded / ev.total * 100);
        bar.firstElementChild.style.width = pct + '%';
        res.textContent = pct < 100 ? `Đang tải lên server… ${pct}%` : 'Server đang chuyển video lên YouTube, đừng đóng trang…';
      };
      xhr.onload = () => {
        btn.disabled = false;
        let r = {};
        try { r = JSON.parse(xhr.responseText); } catch (err) {}
        if (xhr.status === 200) {
          res.innerHTML = `Xong: <a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.url)}</a>${r.privacy === 'private' && !at ? ' (đang ở chế độ riêng tư)' : ''}`;
          A.toast('Đã tải video lên YouTube.');
        } else {
          res.textContent = r.error || 'Lỗi ' + xhr.status;
          A.toast(res.textContent, 'err');
        }
      };
      xhr.onerror = () => { btn.disabled = false; res.textContent = 'Mất kết nối tới server.'; };
      xhr.send(file);
    };
  }

  // ---------- Kết nối & lịch sử ----------
  const STATUS_TEXT = { published: ['Đã đăng', 'ok'], scheduled: ['Đã hẹn', 'info'], failed: ['Lỗi', 'hot'] };
  async function renderConnect() {
    $('#view').innerHTML = '<p class="muted">Đang tải…</p>';
    await loadStatus();
    if (!st) { $('#view').innerHTML = serverNote(); return; }
    const fb = st.facebook, yt = st.youtube, cb = location.origin + '/api/autopost/youtube/callback';
    $('#view').innerHTML = `
      <div class="mk-cols">
        <form class="panel" id="fb-form">
          <h3>Fanpage Facebook</h3>
          <p><span class="badge ${fb.connected ? 'ok' : 'warn'}">${fb.connected ? 'Đã kết nối: ' + esc(fb.page_name) : 'Chưa kết nối'}</span></p>
          <div class="form-grid">
            <label class="field"><span class="lab">ID Fanpage</span><input name="fb_page_id" type="text" value="${esc(fb.page_id)}" placeholder="VD: 1234567890"></label>
            <label class="field"><span class="lab">Mã truy cập (dán mã lấy từ Graph API Explorer)</span><input name="fb_token" type="password" autocomplete="off" placeholder="${fb.connected ? 'Đã lưu – chỉ nhập khi muốn thay' : 'Dán mã vào đây'}"><small class="help">Dán mã người dùng cũng được: hệ thống tự đổi sang mã của Fanpage.</small></label>
            <label class="field half"><span class="lab">App ID (không bắt buộc)</span><input name="fb_app_id" type="text" value="${esc(fb.app_id || '')}"></label>
            <label class="field half"><span class="lab">App Secret (không bắt buộc)</span><input name="fb_app_secret" type="password" autocomplete="off" placeholder="${fb.app_set ? 'Đã lưu' : ''}"></label>
            <small class="help mk-span">Điền App ID + App Secret để đổi sang mã dài hạn – mã Fanpage gần như không hết hạn. Không điền thì mã chỉ dùng được 1–2 giờ.</small>
          </div>
          <details class="mk-help"><summary>Cách lấy ID và mã truy cập</summary>
            <ol>
              <li>Kiểm tra đó là <b>Fanpage</b> (có mục "Minh bạch về Trang"). Trang cá nhân không dùng được.</li>
              <li>developers.facebook.com → My Apps → tạo ứng dụng loại Business. Mở <b>App settings → Basic</b> để lấy <b>App ID</b> và <b>App Secret</b>.</li>
              <li>Tools → <b>Graph API Explorer</b> → chọn ứng dụng → Get User Access Token → tích <code>pages_show_list</code>, <code>pages_read_engagement</code>, <code>pages_manage_posts</code> → Generate, chọn Fanpage của shop.</li>
              <li>Copy mã vừa tạo dán vào ô "Mã truy cập". <b>ID Fanpage</b>: gõ <code>me/accounts</code> trong Graph API Explorer, lấy giá trị <code>id</code> của Fanpage.</li>
              <li>Bấm <b>Lưu &amp; kiểm tra</b>: hệ thống tự đổi sang mã của Fanpage (và mã dài hạn nếu có App ID/Secret).</li>
            </ol>
          </details>
          <div class="panel-foot">${fb.connected ? '<button class="btn outline" type="button" data-disc="facebook">Ngắt kết nối</button>' : ''}<button class="btn primary" type="submit">Lưu &amp; kiểm tra</button></div>
        </form>
        <form class="panel" id="yt-cfg">
          <h3>Kênh YouTube</h3>
          <p><span class="badge ${yt.connected ? 'ok' : 'warn'}">${yt.connected ? 'Đã kết nối' : yt.client_set ? 'Đã nhập Client, chưa kết nối' : 'Chưa cài đặt'}</span></p>
          <div class="form-grid">
            <label class="field"><span class="lab">Client ID</span><input name="yt_client_id" type="text" value="${esc(yt.client_id)}"></label>
            <label class="field"><span class="lab">Client Secret</span><input name="yt_client_secret" type="password" autocomplete="off" placeholder="${yt.client_set ? 'Đã lưu – chỉ nhập khi muốn thay' : ''}"></label>
            <label class="field"><span class="lab">Redirect URI (dán vào Google Cloud)</span><input type="text" readonly value="${esc(cb)}"></label>
          </div>
          <details class="mk-help"><summary>Cách tạo Client ID</summary>
            <ol>
              <li>Vào console.cloud.google.com → tạo project → bật <b>YouTube Data API v3</b>.</li>
              <li>OAuth consent screen: chọn External, thêm email chủ kênh vào "Test users".</li>
              <li>Credentials → Create credentials → OAuth client ID → loại <b>Web application</b> → thêm Redirect URI ở trên.</li>
              <li>Dán Client ID và Secret vào đây, bấm Lưu, rồi bấm "Kết nối kênh YouTube" và đăng nhập đúng tài khoản chủ kênh.</li>
              <li>Muốn video công khai được: gửi yêu cầu audit project cho Google (YouTube API Services – Audit and Quota Extension Form).</li>
            </ol>
          </details>
          <div class="panel-foot">
            ${yt.connected ? '<button class="btn outline" type="button" data-disc="youtube">Ngắt kết nối</button>' : ''}
            <button class="btn outline" type="submit">Lưu</button>
            ${yt.client_set ? `<a class="btn primary" href="/api/autopost/youtube/connect">${icon('youtube')}${yt.connected ? 'Kết nối lại' : 'Kết nối kênh YouTube'}</a>` : ''}
          </div>
        </form>
      </div>
      ${groupsPanel()}
      <form class="panel" id="mk-settings">
        <h3>Cài đặt đăng bài</h3>
        <div class="form-grid">
          <label class="field half"><span class="lab">Khung giờ đăng mỗi ngày (cách nhau dấu phẩy)</span><input name="times" type="text" value="${esc(st.settings.times.join(', '))}" placeholder="11:30, 20:00"><small class="help">Khung thứ nhất đăng máy, khung thứ hai đăng game.</small></label>
          <label class="field half"><span class="lab">Địa chỉ website trong bài đăng</span><input name="site_url" type="text" value="${esc(st.settings.site_url)}"></label>
        </div>
        <div class="panel-foot"><button class="btn primary" type="submit">Lưu cài đặt</button></div>
      </form>
      <div class="panel">
        <h3>Lịch sử đăng</h3>
        ${st.history.length ? `<div class="mk-history">${st.history.map(h => {
          const [t, c] = STATUS_TEXT[h.status] || [h.status, 'muted'];
          return `<div class="mk-h-row"><span class="badge ${c}">${t}</span><span class="badge">${h.platform === 'youtube' ? 'YouTube' : 'Facebook'}</span>
            <span class="mk-h-title">${h.url ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a>` : esc(h.title)}${h.error ? `<small>${esc(h.error)}</small>` : ''}</span>
            <small class="muted">${h.scheduled_for ? 'hẹn ' + fmtTime(h.scheduled_for) : fmtTime(h.time)}</small></div>`;
        }).join('')}</div>` : '<p class="muted">Chưa có bài nào.</p>'}
      </div>`;
    const send = async (body, msg) => {
      try {
        st = await A.api('/api/autopost/settings', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        A.toast(msg);
        renderConnect();
      } catch (err) { A.toast(err.message, 'err'); }
    };
    const vals = f => Object.fromEntries([...new FormData(f)].map(([k, v]) => [k, String(v).trim()]));
    $('#fb-form').onsubmit = e => { e.preventDefault(); send(vals(e.target), 'Đã kết nối Fanpage.'); };
    $('#yt-cfg').onsubmit = e => { e.preventDefault(); send(vals(e.target), 'Đã lưu thông tin Google.'); };
    $('#mk-groups-form').onsubmit = saveGroups;
    $('#mk-settings').onsubmit = e => {
      e.preventDefault();
      const v = vals(e.target);
      send({ times: v.times.split(',').map(t => t.trim()).filter(Boolean), site_url: v.site_url }, 'Đã lưu cài đặt.');
    };
    $('#view').oninput = null;
    $('#view').onclick = async e => {
      const b = e.target.closest('[data-disc]');
      if (!b || !confirm('Ngắt kết nối? Mã truy cập đã lưu sẽ bị xoá.')) return;
      try {
        st = await A.api('/api/autopost/disconnect', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ platform: b.dataset.disc }) });
        renderConnect();
      } catch (err) { A.toast(err.message, 'err'); }
    };
  }

  A.addSections({
    mktLibrary: { group: 'Truyền thông', label: 'Quản lý bài viết', icon: 'copy', custom: true, render: renderLibrary,
      hint: 'Tất cả bài viết chia theo Máy / Game / Hướng dẫn / Shop. Bấm Đăng bài để chọn đăng lên Fanpage hoặc vào các nhóm (tự thêm câu xin phép Admin).' },
    mktCalendar: { group: 'Truyền thông', label: 'Lịch đăng Facebook', icon: 'clock', custom: true, render: renderCalendar,
      hint: '2 bài mỗi ngày trong 7 ngày tới: khung đầu giới thiệu máy, khung sau giới thiệu game. Sửa bài trực tiếp, rồi hẹn giờ đăng lên Fanpage hoặc sao chép để đăng tay.' },
    mktYoutube: { group: 'Truyền thông', label: 'Video YouTube', icon: 'youtube', custom: true, render: renderYoutube,
      hint: 'Tải video từ máy tính lên kênh YouTube, tiêu đề và mô tả điền sẵn theo máy hoặc game.' },
    mktConnect: { group: 'Truyền thông', label: 'Kết nối & lịch sử', icon: 'send', custom: true, render: renderConnect,
      hint: 'Kết nối Fanpage và kênh YouTube, quản lý danh sách nhóm Facebook, chọn khung giờ đăng, xem lịch sử.' },
  });

  // Esc đóng khung xem/sửa bài
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && libOpen && document.querySelector('.lib-drawer.open')) { libOpen = null; renderLibrary(); }
  });

  // Quay về từ trang đăng nhập Google
  const yt = new URLSearchParams(location.search).get('yt');
  if (yt) {
    setTimeout(() => A.toast(yt === 'ok' ? 'Đã kết nối kênh YouTube.' : 'Kết nối YouTube lỗi: ' + yt, yt === 'ok' ? 'ok' : 'err'), 800);
    history.replaceState(null, '', location.pathname);
  }
})();
