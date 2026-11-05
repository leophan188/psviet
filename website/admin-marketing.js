// Trang quản trị: nhóm "Truyền thông" – lịch đăng Facebook, bài cho nhóm, video YouTube, kết nối tài khoản
(() => {
  const A = window.ADMIN;
  if (!A) return;
  const { esc, icon, money } = window.PSG;
  const $ = s => document.querySelector(s);
  // Bài đăng lấy dữ liệu đang hiện trên website, không lấy bản nháp chưa lưu trong trình duyệt
  const D = () => (A.getPublished ? A.getPublished() : A.getData());
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
    const zalo = s.zalo && (/^https?:/.test(s.zalo) ? s.zalo : 'https://zalo.me/' + String(s.zalo).replace(/[^\d]/g, ''));
    if (zalo) return `💬 Chat Zalo tư vấn ngay: ${zalo}${s.phone ? ` (Hotline ${s.phone})` : ''}`;
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
      zalo && `💬 Chat Zalo tư vấn: ${zalo}`,
      s.phone && `☎️ Hotline: ${s.phone}`,
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
  const gameTypeNames = g => (g.types || (g.type ? [g.type] : []))
    .map(id => ((D().gameTypes || []).find(t => t.id === id) || {}).name || '').filter(Boolean);
  const isNarrated = g => gameTypeNames(g).some(n => /thuy[ếe]t\s*minh/i.test(n));
  const narratedPs5Games = () => games().filter(g => (g.platforms || []).includes('PS5') && isNarrated(g));
  // Bài game kiểu "ra mắt": game có mặt tại shop, khách mua máy được cài miễn phí
  // Mẫu bài game nào cũng kèm danh sách game PS5 thuyết minh shop đang có
  const gameVoiceList = g => narratedPs5Games().length ? voiceListBlock(isNarrated(g) ? g : null) : null;
  const GAME_POSTS = [
    g => join([
      `🎉 RA MẮT TẠI ${BRAND}: ${g.title.toUpperCase()}\nKhách mua máy tại ${BRAND} được CÀI MIỄN PHÍ ${g.title} vào ổ cứng trước khi giao 🎁`,
      [g.note, gameMeta(g)].filter(Boolean).join('\n'),
      intro(g),
      gamePolicy() ? `📌 Cài game theo chính sách của shop: ${gamePolicy()}.` : null,
      `👉 Giới thiệu ${g.title}: ${site()}/game.html?id=${g.id}\n📚 Toàn bộ game cài cho khách: ${site()}/games.html`,
      gameVoiceList(g),
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
        gameVoiceList(g),
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
      gameVoiceList(g),
      offerBlock(),
      signature(tag(g.title)),
    ]),
  ];
  // ---------- Game thuyết minh tiếng Việt: nhấn mạnh trải nghiệm cốt truyện trọn vẹn ----------
  const VOICE_TAGS = [tag('GameThuyetMinh'), tag('ThuyetMinhTiengViet'), tag('PS5')];
  const story = g => plain(sectionOf(g, 'Cốt truyện'));
  // Danh sách game PS5 thuyết minh shop đang có (game đang nói tới in đậm bằng ▶, game hot có 🔥)
  const voiceList = (current, list = narratedPs5Games()) => list
    .map(x => `${x.id === (current && current.id) ? '▶️' : '•'} ${x.title}${x.hot ? ' 🔥' : ''}`).join('\n');
  // Link trang game mở sẵn bộ lọc "Thuyết minh"
  const voiceUrl = () => {
    const t = (D().gameTypes || []).find(x => /thuy[ếe]t\s*minh/i.test(x.name || ''));
    return `${site()}/games.html${t ? '?loai=' + encodeURIComponent(t.id) : ''}`;
  };
  // Trong bài: chỉ nêu vài game nổi bật (game hot trước), còn lại xem ở link
  const VOICE_FEATURED = 6;
  const voiceListBlock = current => {
    const skip = new Set([].concat(current || []).map(x => x.id));
    const all = narratedPs5Games(), others = all.filter(x => !skip.has(x.id));
    const pick = others.slice(0, VOICE_FEATURED), rest = others.length - pick.length;
    return [`📚 ${current ? 'CÁC GAME THUYẾT MINH KHÁC' : 'GAME PS5 THUYẾT MINH TIẾNG VIỆT NỔI BẬT'} TẠI ${BRAND}:`,
      ...pick.map(x => `• ${x.title}${x.hot ? ' 🔥' : ''}`),
      `➕ ${rest > 0 ? `Và ${rest} game thuyết minh khác` : `Tổng cộng ${all.length} game thuyết minh`} – xem đầy đủ: ${voiceUrl()}`].join('\n');
  };
  const voiceListByGenre = () => {
    const groups = {};
    narratedPs5Games().forEach(g => { (groups[genreOf(g) || 'Khác'] = groups[genreOf(g) || 'Khác'] || []).push(g); });
    return Object.entries(groups).map(([name, list]) => `🎯 ${name}\n${voiceList(null, list)}`).join('\n\n');
  };
  const VOICE_WHY = [
    '🎧 Nghe lời thoại bằng tiếng Việt, mắt dồn hết vào màn hình – không phải vừa đánh vừa đọc phụ đề',
    '🎬 Những đoạn phim, cảnh chiến đấu gay cấn không còn bị lỡ câu thoại quan trọng',
    '❤️ Hiểu từng tình tiết, cảm được tâm lý nhân vật như xem một bộ phim lồng tiếng',
    '👨‍👩‍👧 Cả nhà cùng xem, cùng chơi – người lớn, trẻ nhỏ đều theo kịp câu chuyện',
  ];
  const voiceCta = g => [g && `👉 Giới thiệu ${g.title}: ${site()}/game.html?id=${g.id}`, `📚 Toàn bộ game cài cho khách: ${site()}/games.html`, contact()].filter(Boolean).join('\n');
  // Khối bán máy + quảng cáo shop dùng trong bài từng game
  const machineSaleBlock = () => {
    const list = machines().filter(p => +p.price > 0).map(p => `🎮 ${postName(p)}: ${priceText(p)}`);
    return list.length ? `🛒 MÁY PS5 ĐANG BÁN TẠI ${BRAND}:\n${list.join('\n')}\n👉 Xem máy và video thật: ${site()}/#may` : null;
  };
  // MỖI GAME PS5 ĐÚNG 1 BÀI: (1) mô tả nhanh + ra mắt bản thuyết minh, (2) danh sách game thuyết minh của shop,
  // (3) thông tin bán máy + quảng cáo shop, (4) liên hệ shop
  const PS5_GAME_POST = g => {
    const voice = isNarrated(g), hl = highlights(g), st = story(g);
    return join([
      voice
        ? `🎙️ RA MẮT BẢN THUYẾT MINH TIẾNG VIỆT: ${g.title.toUpperCase()}\nĐộc quyền tại ${BRAND} – trải nghiệm trọn vẹn cốt truyện bằng tiếng Việt 🇻🇳`
        : `🎉 ${g.title.toUpperCase()} – CÀI SẴN MIỄN PHÍ KHI MUA PS5 TẠI ${BRAND}`,
      [g.note, gameMeta(g)].filter(Boolean).join('\n'),
      `📖 Giới thiệu nhanh\n${intro(g)}${st ? '\n\n' + st : ''}`,
      hl.length ? `✨ Điểm nổi bật\n${hl.map(h => '✅ ' + h).join('\n')}` : null,
      voice
        ? `🎧 Bản thuyết minh tiếng Việt của ${g.title}: toàn bộ lời thoại được đọc bằng tiếng Việt – bạn nghe là hiểu, mắt dồn vào hành động và những đoạn phim, không bỏ lỡ câu thoại nào. Khách mua máy tại shop được cài sẵn miễn phí, nhận máy là chơi ngay.`
        : `🎁 Khách mua máy tại shop được cài sẵn ${g.title} miễn phí, nhận máy là chơi ngay.`,
      `👉 Chi tiết ${g.title}: ${site()}/game.html?id=${g.id}`,
      narratedPs5Games().length ? voiceListBlock(voice ? g : null) : null,
      machineSaleBlock(),
      offerBlock(),
      signature(tag(g.title), ...(voice ? VOICE_TAGS : [tag('PS5')])),
    ]);
  };
  const TPL_VER = 2;  // tăng khi đổi mẫu bài game để bỏ các bản sửa tay từ mẫu cũ
  // Game có bản PS5: đúng 1 bài theo mẫu trên; game chỉ có PS4 giữ các mẫu cũ
  const gamePostsFor = g => (g.platforms || []).includes('PS5') ? [PS5_GAME_POST] : GAME_POSTS;

  // Chủ đề bài "Thuyết minh": tổng hợp danh sách, lợi ích, theo thể loại, theo series, ưu đãi, hỏi đáp
  const VOICE_IMG = 'assets/brand/psviet-banner-v2-1920.jpg';
  const voicePosts = (head, body, g) => [
    () => join([`🎙️ ${BRAND} | ${head}`, body, voiceListBlock(g), offerBlock(), voiceCta(g), signature(...VOICE_TAGS)]),
    () => join([`🇻🇳 ${head}`, body, voiceListBlock(g), `🎁 Mua máy tại shop được cài sẵn miễn phí.\n✅ ${perksShort()}`, voiceCta(g), signature(...VOICE_TAGS)]),
  ];
  function voiceTopics() {
    const list = narratedPs5Games();
    if (!list.length) return [];
    const hot = list.filter(g => g.hot), first = hot[0] || list[0];
    const storyPicks = (hot.length >= 3 ? hot : list).slice(0, 5);
    const out = [
      { id: 'danh-sach', title: `Danh sách ${list.length} game PS5 thuyết minh tiếng Việt`, image: VOICE_IMG,
        posts: [
          () => join([`🎙️ TRỌN BỘ GAME PS5 THUYẾT MINH TIẾNG VIỆT TẠI ${BRAND}`,
            'Cốt truyện là linh hồn của những tựa game bom tấn. Với bản thuyết minh tiếng Việt, bạn hiểu trọn từng câu thoại và sống cùng nhân vật từ đầu tới cuối 🎬',
            voiceListByGenre(), `🎁 Mua PS5 tại shop: cài sẵn miễn phí, độc quyền tại ${BRAND}.`, offerBlock(), voiceCta(), signature(...VOICE_TAGS)]),
          () => join([`📚 ${list.length} game PS5 có THUYẾT MINH TIẾNG VIỆT – lưu lại để chọn game nhé!`, voiceList(), `✅ ${perksShort()}`, voiceCta(), signature(...VOICE_TAGS)]),
        ] },
      { id: 'vi-sao', title: 'Vì sao nên chơi game thuyết minh tiếng Việt?', image: VOICE_IMG,
        posts: voicePosts('Vì sao nên chơi game thuyết minh tiếng Việt?',
          [`Nhiều anh em bỏ dở game hay chỉ vì không theo kịp cốt truyện tiếng Anh. Game thuyết minh tiếng Việt giải quyết điều đó:`, VOICE_WHY.join('\n')].join('\n\n')) },
      { id: 'cot-truyen', title: 'Top game cốt truyện hay nên chơi bản thuyết minh', image: first.image,
        posts: voicePosts('Top game cốt truyện hay nên chơi bản thuyết minh',
          storyPicks.map((g, i) => `${i + 1}️⃣ ${g.title}${g.note ? ' – ' + g.note : ''}`).join('\n') + '\n\nNhững câu chuyện này đáng được nghe trọn vẹn bằng tiếng Việt 🎧', first) },
    ];
    out.push(
      { id: 'mua-may', title: 'Mua PS5 cài sẵn game thuyết minh', image: VOICE_IMG,
        posts: voicePosts('Mua PS5 – nhận máy là chơi ngay game thuyết minh tiếng Việt',
          `Không cần tự tìm, tự cài. Khách mua máy tại ${BRAND} được shop cài sẵn game thuyết minh tiếng Việt vào ổ cứng trước khi giao – độc quyền tại shop.\n\nBạn chỉ cần chọn game mình thích trong danh sách dưới đây 👇`) },
      { id: 'hoi-dap', title: 'Hỏi đáp: Game thuyết minh khác game Việt hoá thế nào?', image: VOICE_IMG,
        posts: voicePosts('Game thuyết minh khác game Việt hoá thế nào?',
          ['❓ Game Việt hoá là gì?\n💬 Chữ trong game (phụ đề, menu, nhiệm vụ) được dịch sang tiếng Việt – bạn đọc để hiểu.',
            '❓ Game thuyết minh là gì?\n💬 Lời thoại nhân vật được đọc bằng tiếng Việt – bạn nghe là hiểu, mắt tập trung vào hành động và những đoạn phim.',
            '❓ Nên chọn loại nào?\n💬 Game nặng cốt truyện, nhiều đoạn phim (hành động phiêu lưu, nhập vai) chơi bản thuyết minh sẽ trọn vẹn nhất.'].join('\n\n')) },
    );
    return out.map(t => ({ platforms: ['PS5'], ...t }));
  }

  // ---------- Bài seri game: cùng khung với bài từng game PS5 ----------
  // (1) giới thiệu nhanh cả seri, từng phần + bản thuyết minh, (2) danh sách game thuyết minh của shop,
  // (3) thông tin bán máy + quảng cáo shop, (4) liên hệ shop
  // match: nhận game thuộc seri theo tên; order: thứ tự nên chơi (game mới thêm chưa có trong order thì xếp cuối);
  // key: giữ mã bài cũ để không mất lịch sử đăng; tags: hashtag riêng khi tên seri quá chung
  const SERIES = [
    { id: 'the-last-of-us', key: 'the-last-of-us', name: 'The Last of Us', match: /^The Last of Us/i, order: ['the-last-of-us-part-1', 'the-last-of-us-part-2'],
      pitch: 'Hành trình sinh tồn đầy cảm xúc của Joel và Ellie giữa nước Mỹ hậu tận thế – một trong những cốt truyện hay nhất từng có trên PlayStation.', tip: 'Nên chơi theo thứ tự để theo trọn câu chuyện.' },
    { id: 'spider-man', key: 'spider-man', name: "Marvel's Spider-Man", match: /Spider-Man/i, order: ['spider-man-remastered', 'spider-man-miles-morales', 'spider-man-2'],
      pitch: 'Theo chân Peter Parker và Miles Morales đu tơ bảo vệ New York qua từng phần – hành động mượt, dễ chơi, hợp cả nhà.', tip: 'Nên chơi theo thứ tự để theo trọn câu chuyện.' },
    { id: 'ghost', key: 'ghost-of', name: 'Ghost of Tsushima & Yōtei', tags: ['GhostOfTsushima', 'GhostOfYotei'], match: /^Ghost of/i, order: ['ghost-of-tsushima', 'ghost-of-yotei'],
      pitch: 'Hai câu chuyện samurai Nhật Bản thế giới mở, phong cảnh đẹp như tranh, đấu kiếm đã tay.', tip: 'Mỗi phần một câu chuyện và nhân vật riêng, chơi phần nào trước cũng được.' },
    { id: 'god-of-war', name: 'God of War', match: /^God of War/i, order: ['god-of-war-3-remastered', 'god-of-war-2018', 'god-of-war-ragnarok'],
      pitch: 'Kratos – chiến thần Sparta, từ thần thoại Hy Lạp tới hành trình cha con cùng Atreus giữa thần thoại Bắc Âu.', tip: 'Nên chơi theo thứ tự để theo trọn câu chuyện.' },
    { id: 'uncharted', name: 'Uncharted', match: /^Uncharted/i, order: ['uncharted-collection', 'uncharted-4'],
      pitch: 'Phiêu lưu săn kho báu khắp thế giới cùng Nathan Drake, chơi như đang xem phim hành động.', tip: 'Nên chơi theo thứ tự để theo trọn câu chuyện.' },
    { id: 'assassins-creed', name: "Assassin's Creed", match: /^Assassin's Creed/i, order: ['assassins-creed-unity', 'assassins-creed-syndicate', 'assassins-creed-valhalla', 'assassins-creed-mirage'],
      pitch: 'Hội Sát Thủ qua nhiều thời đại lịch sử: Paris, London, Bắc Âu thời Viking và Baghdad.', tip: 'Mỗi phần một câu chuyện riêng, chơi phần nào trước cũng được.' },
    { id: 'dark-souls', name: 'Dark Souls', match: /^Dark Souls/i, order: ['dark-souls-remastered', 'dark-souls-2', 'dark-souls-3'],
      pitch: 'Seri nhập vai hành động khó nhằn huyền thoại, dành cho người thích thử thách.', tip: 'Mỗi phần chơi riêng được, chơi theo thứ tự thì hiểu thế giới game hơn.' },
    { id: 'resident-evil', name: 'Resident Evil', match: /^Resident Evil/i, order: ['resident-evil-7', 'resident-evil-village'],
      pitch: 'Kinh dị sinh tồn góc nhìn thứ nhất cùng Ethan Winters.', tip: 'Nên chơi theo thứ tự để theo trọn câu chuyện.' },
    { id: 'star-wars-jedi', name: 'Star Wars Jedi', match: /^Star Wars Jedi/i, order: ['star-wars-jedi-fallen-order', 'star-wars-jedi-survivor'],
      pitch: 'Trở thành Jedi Cal Kestis, đấu kiếm ánh sáng trong vũ trụ Star Wars.', tip: 'Nên chơi theo thứ tự để theo trọn câu chuyện.' },
    { id: 'darksiders', name: 'Darksiders', match: /^Darksiders/i, order: ['darksiders-2', 'darksiders-genesis'],
      pitch: 'Hành động chặt chém cùng các Kỵ sĩ Khải Huyền.', tip: 'Mỗi phần chơi riêng được.' },
    { id: 'mafia', name: 'Mafia', match: /^Mafia/i, order: ['mafia-2', 'mafia-3'],
      pitch: 'Thế giới ngầm mafia Mỹ giữa thế kỷ 20, cốt truyện như phim.', tip: 'Mỗi phần một câu chuyện riêng, chơi phần nào trước cũng được.' },
    { id: 'sniper-ghost-warrior', name: 'Sniper Ghost Warrior Contracts', match: /^Sniper Ghost Warrior/i, order: ['sniper-ghost-warrior-contracts', 'sniper-ghost-warrior-contracts-2'],
      pitch: 'Bắn tỉa tầm xa, lên kế hoạch cho từng phát bắn.', tip: 'Mỗi phần chơi riêng được.' },
  ];
  const NUM = ['1️⃣', '2️⃣', '3️⃣', '4️⃣', '5️⃣', '6️⃣', '7️⃣', '8️⃣', '9️⃣'];
  const seriesGames = sr => games().filter(g => sr.match.test(g.title))
    .sort((a, b) => (sr.order.indexOf(a.id) + 1 || 99) - (sr.order.indexOf(b.id) + 1 || 99));
  const SERIES_POST = (sr, gs) => {
    const voiced = gs.filter(isNarrated), name = sr.name.toUpperCase();
    const plats = [...new Set(gs.flatMap(g => g.platforms || []))].sort().reverse();
    const ps4Only = gs.some(g => !(g.platforms || []).includes('PS5'));
    return join([
      voiced.length
        ? `🎙️ TRỌN BỘ SERI ${name} – THUYẾT MINH TIẾNG VIỆT\nĐộc quyền tại ${BRAND} – ${voiced.length === gs.length
          ? `cày liền mạch ${gs.length} phần, nghe trọn câu chuyện bằng tiếng Việt` : `${voiced.map(g => g.title).join(', ')} có bản thuyết minh tiếng Việt`} 🇻🇳`
        : `🎉 TRỌN BỘ SERI ${name} – CÀI SẴN MIỄN PHÍ KHI MUA PS5 TẠI ${BRAND}`,
      `🎮 ${gs.length} phần · ${plats.join(' · ')}${genreOf(gs[0]) ? ' · ' + genreOf(gs[0]) : ''}`,
      `📖 Giới thiệu nhanh\n${sr.pitch}`,
      gs.map((g, i) => `${NUM[i] || '▪️'} ${g.title} (${(g.platforms || []).join('/')})${isNarrated(g) ? ' 🎙️ Thuyết minh' : ''}\n${story(g) || g.note || intro(g)}`).join('\n\n'),
      `💡 ${sr.tip}`,
      voiced.length
        ? `🎧 Bản thuyết minh tiếng Việt${voiced.length < gs.length ? ` (${voiced.map(g => g.title).join(', ')})` : ''}: toàn bộ lời thoại được đọc bằng tiếng Việt – nghe là hiểu, mắt dồn vào hành động và những đoạn phim. Khách mua máy tại shop được cài sẵn miễn phí cả seri, nhận máy là chơi ngay.${ps4Only ? ' Game PS4 chơi tốt trên PS5.' : ''}`
        : `🎁 Khách mua máy tại shop được cài sẵn cả seri miễn phí, nhận máy là chơi ngay.${ps4Only ? ' Game PS4 chơi tốt trên PS5.' : ''}`,
      `👉 Chi tiết từng phần:\n${gs.map(g => `▶️ ${g.title}: ${site()}/game.html?id=${g.id}`).join('\n')}`,
      narratedPs5Games().length ? voiceListBlock(voiced.length ? gs : null) : null,
      machineSaleBlock(),
      offerBlock(),
      signature(...(sr.tags || [sr.name]).map(tag), ...(voiced.length ? VOICE_TAGS : [tag('PS5')])),
    ]);
  };
  // Chỉ seri có từ 2 phần trở lên đang hiện trên web; seri có game thuyết minh lên đầu
  function seriesTopics() {
    return SERIES.map(sr => ({ sr, gs: seriesGames(sr) })).filter(x => x.gs.length >= 2)
      .map(({ sr, gs }) => ({ id: sr.key ? 'series-' + sr.key : 'seri-' + sr.id, title: `Seri ${sr.name} (${gs.length} phần)`, image: gs[0].image,
        voiced: gs.some(isNarrated), platforms: [...new Set(gs.flatMap(g => g.platforms || []))].sort().reverse(), posts: [() => SERIES_POST(sr, gs)] }))
      .sort((a, b) => b.voiced - a.voiced);
  }

  // ---------- Bài hướng dẫn: dựng từ dữ liệu và nội dung có sẵn trên web ----------
  const BRAND_IMG = 'assets/brand/psviet-logo-512.png';
  const BUY_STEPS = [
    ['Nhắn shop', 'Chọn máy hoặc cho shop biết ngân sách qua Zalo, Messenger hoặc Telegram.'],
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
  // Mỗi chủ đề có 2 mẫu: bản đầy đủ (kèm danh sách game thuyết minh + ưu đãi) và bản ngắn.
  // Điểm nhấn của mọi bài shop: game thuyết minh tiếng Việt độc quyền – trải nghiệm cốt truyện trọn vẹn.
  const voiceCount = () => narratedPs5Games().length;
  const voiceHook = () => voiceCount()
    ? `🎙️ ĐỘC QUYỀN TẠI ${BRAND}: ${voiceCount()} game PS5 THUYẾT MINH TIẾNG VIỆT – nghe nhân vật nói tiếng Việt, hiểu trọn từng câu thoại, sống trọn từng cảnh phim.`
    : '';
  const voiceShort = () => voiceCount()
    ? `🎙️ Game thuyết minh tiếng Việt: ${narratedPs5Games().slice(0, 6).map(g => g.title).join(', ')}${voiceCount() > 6 ? ` và ${voiceCount() - 6} game khác` : ''}.`
    : '';
  const shopPosts = (head, body, link, offer = true) => [
    () => join([`🏪 ${BRAND} | ${head}`, body, voiceCount() ? voiceListBlock() : null, link ? `👉 ${link}` : null,
      offer ? offerBlock() : null, signature('#ShopPS5', '#PS5cu', '#GameThuyetMinh')]),
    () => join([`✨ ${head}`, body, voiceShort() || null, `✅ ${perksShort()}${link ? '\n👉 ' + link : ''}${String(link || '').includes('games.html') ? '' : `\n📚 Danh sách game: ${site()}/games.html`}`,
      signature('#ShopPS5', '#GameThuyetMinh')]),
  ];
  // Bỏ chữ mẫu chưa điền trong dữ liệu (vd "qua [GHN / Viettel Post]") để không lộ lên bài đăng
  const unfilled = t => String(t).replace(/\s*(qua\s*)?\[[^\]]*\]/g, '').trim();
  function shopTopics() {
    const d = D(), s = d.settings || {}, ms = machines(), gs = games(), n = voiceCount();
    const priceList = ms.filter(p => +p.price > 0).map(p => `🎮 ${postName(p)}: ${priceText(p)}`).join('\n');
    const where = s.address ? '' : ' tại Hà Nội';
    return [
      { id: 'gioi-thieu', title: `Giới thiệu ${BRAND}`, image: SHOP_IMG,
        posts: shopPosts(`PS5 cũ nguyên bản – chơi game THUYẾT MINH TIẾNG VIỆT${where}`,
          [`Chào bạn 👋 ${BRAND} chuyên PS5 Fat, Slim, Pro cũ nguyên bản: máy nào cũng test kỹ, có video quay máy thật gửi bạn trước khi giao.`,
            voiceHook(),
            `Điều làm nên khác biệt của shop: những bom tấn nặng cốt truyện như God of War, The Last of Us, Spider-Man, Ghost of Yōtei… được thuyết minh tiếng Việt. Bạn không phải vừa chiến đấu vừa căng mắt đọc phụ đề – cứ nghe là hiểu, chơi là cuốn, như xem một bộ phim lồng tiếng 🎬`,
            `Mua máy được cài sẵn miễn phí (${gs.length} game PS4, PS5 để chọn, trong đó ${n} game thuyết minh), nhận máy là chơi ngay.`].filter(Boolean).join('\n\n'),
          `${site()}`) },
      ...(n ? [{ id: 'khac-biet', title: `Chỉ có tại ${BRAND}: game thuyết minh tiếng Việt`, image: SHOP_IMG,
        posts: shopPosts(`Điều chỉ có tại ${BRAND}: chơi PS5 bằng tiếng Việt`,
          [`Nhiều anh em mua PS5 về rồi bỏ dở game hay chỉ vì không theo kịp cốt truyện tiếng Anh. Tại ${BRAND}, chuyện đó không còn nữa 👇`,
            VOICE_WHY.join('\n'),
            `🎁 Mua máy tại shop: chọn game thuyết minh bạn thích, shop cài sẵn miễn phí trước khi giao.`].join('\n\n'),
          `Xem toàn bộ game: ${site()}/games.html`) }] : []),
      { id: 'vi-sao', title: `Vì sao nên mua PS5 tại ${BRAND}?`, image: SHOP_IMG,
        posts: shopPosts(`Vì sao nên mua PS5 tại ${BRAND}?`,
          [n ? `🎙️ Game thuyết minh tiếng Việt độc quyền – ${n} bom tấn PS5, trải nghiệm cốt truyện trọn vẹn` : null, ...perkLines()].filter(Boolean).join('\n'),
          `Chính sách bảo hành, đổi trả: ${site()}/#chinh-sach`, false) },
      ...(priceList ? [{ id: 'bang-gia', title: 'Bảng giá máy đang có tại shop', image: SHOP_IMG,
        posts: shopPosts('Bảng giá PS5 đang có tại shop',
          [priceList, `Giá đã gồm cài game miễn phí${n ? `, có sẵn ${n} game thuyết minh tiếng Việt để bạn chọn` : ''}. Nhắn Zalo để xem video máy thật trước khi chốt.`].join('\n\n'),
          `Xem máy: ${site()}/#may`) }] : []),
      { id: 'cam-ket', title: 'Cam kết của shop khi bán máy', image: SHOP_IMG,
        posts: shopPosts('Cam kết khi mua máy tại shop',
          [...(d.policies || []).map(p => `📌 ${p.title}${(p.items || [])[0] ? ': ' + unfilled(p.items[0]) : ''}`),
            '📌 Máy nguyên bản, test kỹ từng máy, có video máy thật trước khi giao',
            n ? '📌 Cài sẵn game thuyết minh tiếng Việt bạn chọn, test chạy ổn trước khi giao' : null].filter(Boolean).join('\n'),
          `Chi tiết chính sách: ${site()}/#chinh-sach`, false) },
      { id: 'mua-o-dau', title: s.address ? 'Ghé shop xem máy trực tiếp' : 'Mua máy online, ship COD toàn quốc', image: SHOP_IMG,
        posts: shopPosts(s.address ? 'Ghé shop xem và test máy trực tiếp' : 'Mua máy online, nhận hàng mới trả tiền',
          [s.address && `📍 ${s.address}`,
            '🚚 Ở xa? Shop ship COD toàn quốc: kiểm tra máy khi nhận rồi mới thanh toán.',
            ...BUY_STEPS.map(([t, x], i) => `${i + 1}️⃣ ${t}: ${x}`),
            n ? `🎙️ Nhớ báo shop game thuyết minh bạn muốn chơi – shop cài sẵn, nhận máy là nghe tiếng Việt ngay.` : null].filter(Boolean).join('\n'),
          `Hướng dẫn mua hàng: ${site()}/#mua-hang`) },
      { id: 'theo-doi', title: `Theo dõi ${BRAND} để không lỡ máy mới, game thuyết minh mới`, image: SHOP_IMG,
        posts: shopPosts(`Theo dõi ${BRAND} để không lỡ máy ngon và game thuyết minh mới`,
          ['🔔 Máy mới về, game thuyết minh tiếng Việt mới, ưu đãi trong tuần đều đăng trước tiên trên các kênh của shop.',
            s.youtube ? '▶️ Kênh YouTube có video test máy thật và trải nghiệm game thuyết minh.' : null].filter(Boolean).join('\n'), null, false) },
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
  const KIND = { machine: ['Bài máy', 'info'], game: ['Bài game', 'hot'], guide: ['Hướng dẫn', 'ok'], shop: ['Giới thiệu shop', 'info'], voice: ['Thuyết minh', 'hot'], series: ['Seri game', 'hot'] };
  const kindOf = s => s.kind || (s.isGame ? 'game' : 'machine');
  const templatesFor = s => ['guide', 'shop', 'voice', 'series'].includes(kindOf(s)) ? s.item.posts : s.isGame ? gamePostsFor(s.item) : MACHINE_POSTS;
  const textFor = s => {
    const dr = drafts[s.key] || {};
    // Bài sửa tay từ mẫu cũ (trước khi đổi sang "mỗi game PS5 1 bài") không dùng nữa
    const stale = s.isGame && dr.tpl !== TPL_VER;
    if (dr.text != null && dr.itemId === s.item.id && !stale) return dr.text;
    const tpl = templatesFor(s);
    return tpl[(dr.v || 0) % tpl.length](s.item);
  };
  const doneFor = key => st && st.history.find(h => h.slot === key && h.platform === 'facebook' && !['failed', 'deleted'].includes(h.status));
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
            <button class="btn primary sm" type="button" data-mk="now" title="Đăng lên Fanpage hoặc sao chép bài cho nhóm">${icon('send')}Đăng bài</button>
            ${s.noTime ? '' : `<button class="btn outline sm" type="button" data-mk="schedule" ${done || !canSchedule ? 'disabled' : ''} title="${!fbOn ? 'Cần kết nối Fanpage để hẹn giờ' : canSchedule ? '' : 'Đã qua giờ hẹn, dùng Đăng ngay'}">${icon('clock')}Hẹn ${esc(s.t)}</button>`}
          </div>` : ''}
        </footer>
      </article>`;
  }

  // Tải ảnh của bài về máy để thêm vào bài đăng tay
  function downloadImg(s) {
    const img = imgOf(s.item);
    if (!img) return false;
    const a = document.createElement('a');
    a.href = img; a.download = img.split('/').pop();
    document.body.append(a); a.click(); a.remove();
    return true;
  }

  // Sao chép ảnh của bài vào bộ nhớ tạm (dạng PNG) để dán thẳng vào ô viết bài của Facebook.
  // Gọi ngay trong lượt bấm, chưa qua await nào, vì Safari chỉ cho ghi bộ nhớ tạm trong thao tác người dùng.
  function copyImg(s) {
    const img = imgOf(s.item);
    if (!img) return Promise.resolve(false);
    if (!window.ClipboardItem || !navigator.clipboard || !navigator.clipboard.write) return Promise.resolve(downloadImg(s) && 'download');
    const png = new Promise((ok, fail) => {
      const im = new Image();
      im.onload = () => {
        const c = document.createElement('canvas');
        c.width = im.naturalWidth; c.height = im.naturalHeight;
        c.getContext('2d').drawImage(im, 0, 0);
        c.toBlob(b => b ? ok(b) : fail(new Error('png')), 'image/png');
      };
      im.onerror = fail;
      im.src = img;
    });
    return navigator.clipboard.write([new ClipboardItem({ 'image/png': png })])
      .then(() => true, () => downloadImg(s) && 'download');
  }

  // Chưa kết nối Fanpage: sao chép bài, tải ảnh về, mở trang Facebook của shop để dán và bấm Đăng
  async function manualPost(s) {
    const fbUrl = (D().settings || {}).facebook || 'https://www.facebook.com/';
    const win = openTab(fbUrl);
    await copy(textFor(s));
    downloadImg(s);
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
        <div class="mk-sum-item">${icon('clock')}<div><b>${doneCount}/${list.length} bài đã lên lịch</b><small>7 ngày tới · khung giờ ${esc(times().join(' và '))}</small></div>
          ${fb && A.isServer() && pendingSlots(list).length ? `<button class="btn primary sm" type="button" data-mk-all>${icon('clock')}Hẹn ${pendingSlots(list).length} bài còn lại</button>` : ''}</div>
        <div class="mk-sum-item">${icon('star')}<div><b>Mỗi bài đều có ưu đãi</b><small>Cài game miễn phí, bảo hành, đổi máy, ship COD, link chính sách</small></div></div>
      </div>
      ${days.filter(Boolean).map(d => `
        <section class="mk-day">
          <h3>${esc(d.label)}</h3>
          <div class="mk-day-grid">${d.items.map(cardHtml).join('')}</div>
        </section>`).join('')}`;
    rerender = () => renderCalendar();
    bindCards(Object.fromEntries(list.map(s => [s.key, s])));
    const all = $('[data-mk-all]');
    if (all) all.onclick = () => scheduleAll(list, all);
  }
  // Khung giờ chưa hẹn và còn đủ 10 phút (Facebook yêu cầu)
  const pendingSlots = list => list.filter(s => !doneFor(s.key) && s.at.getTime() >= Date.now() + 10 * 60000);
  // Hẹn giờ cả tuần một lần: gửi từng bài sang Facebook, Facebook tự đăng đúng giờ kể cả khi máy tắt
  async function scheduleAll(list, btn) {
    const todo = pendingSlots(list);
    if (!todo.length || !confirm(`Hẹn giờ ${todo.length} bài lên Fanpage trong 7 ngày tới? Facebook sẽ tự đăng đúng giờ, không cần mở máy.`)) return;
    btn.disabled = true;
    let ok = 0;
    const errors = [];
    for (const [n, s] of todo.entries()) {
      btn.textContent = `Đang hẹn ${n + 1}/${todo.length}…`;
      try {
        await A.api('/api/autopost/facebook', { method: 'POST', headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ message: textFor(s), image: imgOf(s.item) || '', slot: s.key, scheduled_at: Math.floor(s.at.getTime() / 1000) }) });
        ok++;
      } catch (err) { errors.push(`${s.label}: ${err.message}`); }
    }
    A.toast(errors.length ? `Đã hẹn ${ok}/${todo.length} bài. Lỗi: ${errors[0]}` : `Đã hẹn ${ok} bài – Facebook sẽ tự đăng đúng giờ.`, errors.length ? 'err' : 'ok');
    renderCalendar();
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
      drafts[ta.dataset.edit] = { ...(drafts[ta.dataset.edit] || {}), text: ta.value, itemId: ta.dataset.item, tpl: TPL_VER };
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
      await loadStatus();   // lấy lịch sử mới để hiện nhãn "Đã đăng / Đã hẹn"
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
        <span class="lib-thumb${['game', 'series'].includes(kindOf(s)) ? ' is-cover' : ''}">${img ? `<img src="${esc(img)}" alt="" loading="lazy">` : ''}</span>
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
  // Vào màn: vẽ ngay bằng dữ liệu đang có, tải trạng thái đăng bài (Fanpage, lịch sử) một lần rồi vẽ lại.
  // Mở/đóng bài, đổi tab, tìm kiếm chỉ vẽ lại, không gọi máy chủ.
  async function renderLibrary() {
    drawLibrary();
    await loadStatus();
    if (rerender === drawLibrary && $('#mk-lib-q')) drawLibrary();   // vẫn đang ở màn này
  }
  function drawLibrary() {
    const topics = voiceTopics(), series = seriesTopics();
    const seriesFor = p => series.filter(g => p === 'all' || g.platforms.includes(p));
    const byName = (a, b) => (a.item.title || a.item.name).localeCompare(b.item.title || b.item.name, 'vi', { numeric: true });
    const all = {
      machine: machines().map(p => ({ key: 'lib-m-' + p.id, kind: 'machine', noTime: true, item: p, at: new Date(), t: '', label: 'Bài giới thiệu máy' })),
      // Tab Game: mỗi game 1 bài (game thuyết minh lên đầu), tiếp theo bài seri, bài chủ đề thuyết minh xếp cuối
      game: [...games().filter(g => gpFilter === 'all' || (g.platforms || []).includes(gpFilter))
          .map(g => ({ key: 'game-' + g.id, kind: 'game', isGame: true, noTime: true, item: g, at: new Date(), t: '', label: 'Bài giới thiệu game' }))
          .sort((a, b) => (isNarrated(b.item) ? 1 : 0) - (isNarrated(a.item) ? 1 : 0) || byName(a, b)),
        ...seriesFor(gpFilter).map(g => ({ key: 'lib-v-' + g.id, kind: 'series', noTime: true, item: g, at: new Date(), t: '', label: 'Bài seri game' })),
        ...(gpFilter === 'PS4' ? [] : topics.map(g => ({ key: 'lib-v-' + g.id, kind: 'voice', noTime: true, item: g, at: new Date(), t: '', label: 'Bài game thuyết minh' })))],
      guide: guides().map(g => ({ key: 'lib-h-' + g.id, kind: 'guide', noTime: true, item: g, at: new Date(), t: '', label: 'Bài hướng dẫn' })),
      shop: shopTopics().map(g => ({ key: 'lib-s-' + g.id, kind: 'shop', noTime: true, item: g, at: new Date(), t: '', label: 'Bài giới thiệu shop' })),
    };
    const q = libQuery.trim().toLowerCase();
    const list = all[libTab].filter(s => !q || (s.item.title || s.item.name).toLowerCase().includes(q));
    const gameCount = p => games().filter(g => p === 'all' || (g.platforms || []).includes(p)).length + seriesFor(p).length + (p === 'PS4' ? 0 : topics.length);
    const TABS = [['machine', 'Máy', 'gamepad', machines().length], ['game', 'Game', 'star', games().length + series.length + topics.length], ['guide', 'Hướng dẫn', 'shield', all.guide.length], ['shop', 'Shop', 'badge', all.shop.length]];
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
    rerender = drawLibrary;
    const byKey = Object.fromEntries(list.map(s => [s.key, s]));
    bindCards(byKey);
    const click = $('#view').onclick;
    $('#view').onclick = e => {
      const l = e.target.closest('[data-lib]');
      if (l) {
        const row = l.closest('.lib-row'), s = row && byKey[row.dataset.key];
        if (l.dataset.lib === 'close') { libOpen = null; return drawLibrary(); }
        if (l.dataset.lib === 'open') { libAnim = libOpen !== s.key; libOpen = s.key; return drawLibrary(); }
        if (l.dataset.lib === 'copy') return copy(textFor(s));
        if (l.dataset.lib === 'post') return openPublish(s);
      }
      const t = e.target.closest('[data-tab]');
      if (t) { libTab = t.dataset.tab; libQuery = ''; libOpen = null; return drawLibrary(); }
      const f = e.target.closest('[data-gp]');
      if (f) { gpFilter = f.dataset.gp; return drawLibrary(); }
      return click(e);
    };
    const qi = $('#mk-lib-q');
    qi.addEventListener('input', () => {
      libQuery = qi.value;
      drawLibrary();
      const n = $('#mk-lib-q'); n.focus(); n.setSelectionRange(n.value.length, n.value.length);
    });
  }

  // Mở tab mới; không dùng tham số "noopener" vì khi đó trình duyệt luôn trả về null (tưởng nhầm là bị chặn)
  const openTab = url => { const w = window.open(url, '_blank'); if (w) w.opener = null; return w; };

  async function copy(text) {
    try { await navigator.clipboard.writeText(text); A.toast('Đã sao chép.'); }
    catch (e) { A.toast('Không sao chép được, hãy bôi đen rồi Cmd+C.', 'err'); }
  }

  // ---------- Bài cho nhóm Facebook: sao chép bài kèm câu xin phép Admin, chủ shop tự dán vào nhóm ----------
  // Mỗi lần sao chép lấy câu kế tiếp để các nhóm không nhận bài giống hệt nhau
  const ASK_ADMIN = [
    '🙏 Xin phép Admin và các anh em trong nhóm cho em đăng bài ạ.',
    '🙏 Em xin phép Admin duyệt giúp bài, cảm ơn Admin và cả nhà ạ!',
    '🙏 Xin phép Ad cho shop chia sẻ chút thông tin, có gì sai sót mong Ad nhắc nhở ạ.',
    '🙏 Chào cả nhà, em xin phép Admin được đăng bài ạ.',
  ];
  let askNo = 0;
  const groupText = s => ASK_ADMIN[askNo % ASK_ADMIN.length] + '\n\n' + textFor(s);

  // ---------- Hộp "Đăng bài": 1. đăng lên Fanpage, 2. sao chép bài cho nhóm ----------
  let pub = null;   // { s }
  const pubEl = document.createElement('div');
  pubEl.className = 'mkp';
  pubEl.hidden = true;
  document.body.append(pubEl);

  function openPublish(s) { pub = { s }; drawPublish(); }
  function closePublish() { pub = null; pubEl.hidden = true; pubEl.innerHTML = ''; }

  function drawPublish() {
    const fbOn = st && st.facebook.connected, hasImg = !!imgOf(pub.s.item);
    pubEl.hidden = false;
    pubEl.innerHTML = `
      <div class="mkp-scrim" data-p="close"></div>
      <div class="mkp-box" role="dialog" aria-modal="true" aria-label="Đăng bài">
        <header class="mkp-head"><div><small>Đăng bài</small><b>${esc(pub.s.item.title || pub.s.item.name)}</b></div><button class="ra" type="button" data-p="close" aria-label="Đóng">${icon('x')}</button></header>
        <div class="mkp-body">
          <section class="mkp-step">
            <h4>1. Fanpage</h4>
            <p class="muted">${fbOn ? `Đăng ngay lên <b>${esc(st.facebook.page_name)}</b>, kèm ảnh.` : 'Fanpage chưa kết nối: web sao chép bài, tải ảnh và mở trang Facebook của shop để bạn dán và bấm Đăng.'}</p>
            <div class="mkp-foot">${fbOn ? '' : '<button class="btn outline" type="button" data-p="goconnect">Kết nối Fanpage</button>'}
              <button class="btn primary" type="button" data-p="fb">${icon('send')}${fbOn ? 'Đăng lên Fanpage' : 'Sao chép &amp; mở Facebook'}</button></div>
          </section>
          <section class="mkp-step">
            <h4>2. Nhóm Facebook</h4>
            <p class="muted">Sao chép bài (đầu bài có câu xin phép Admin, mỗi lần một câu khác) rồi dán vào ô viết bài của nhóm.${hasImg ? ' Bấm <b>Sao chép ảnh</b> và dán thêm lần nữa để gắn ảnh.' : ''}</p>
            <div class="mkp-foot">
              ${hasImg ? `<button class="btn outline" type="button" data-p="img">${icon('copy')}Sao chép ảnh</button>` : ''}
              <button class="btn primary" type="button" data-p="gcopy">${icon('copy')}Sao chép bài cho nhóm</button></div>
            <div class="mkp-preview">${previewHtml(groupText(pub.s))}</div>
          </section>
        </div>
      </div>`;
  }

  pubEl.addEventListener('click', async e => {
    const b = e.target.closest('[data-p]');
    if (!b || !pub) return;
    switch (b.dataset.p) {
      case 'close': return closePublish();
      case 'goconnect': closePublish(); return $('#admin-nav [data-sec="mktConnect"]').click();
      case 'fb': { const s = pub.s; closePublish(); return publish(s, true); }
      case 'gcopy':
        try { await navigator.clipboard.writeText(groupText(pub.s)); }
        catch (err) { return A.toast('Không sao chép được, hãy bôi đen phần xem trước rồi Cmd/Ctrl+C.', 'err'); }
        askNo++;
        A.toast('Đã sao chép bài cho nhóm. Mở nhóm, dán vào ô viết bài rồi bấm Đăng.');
        return drawPublish();
      case 'img': {
        const r = await copyImg(pub.s);
        return A.toast(r === true ? 'Đã sao chép ảnh. Bấm vào ô viết bài trên Facebook rồi dán (Cmd/Ctrl+V), ảnh sẽ tự gắn vào bài.'
          : r ? 'Trình duyệt không cho sao chép ảnh nên đã tải ảnh về máy – thêm ảnh bằng nút Ảnh/video.' : 'Bài này không có ảnh.', r ? 'ok' : 'err');
      }
    }
  });
  document.addEventListener('keydown', e => { if (e.key === 'Escape' && pub) closePublish(); });

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
  const STATUS_TEXT = { published: ['Đã đăng', 'ok'], scheduled: ['Đã hẹn', 'info'], failed: ['Lỗi', 'hot'], deleted: ['Đã xoá trên Facebook', 'muted'], posted: ['Đã đăng (tay)', 'ok'] };
  const PLATFORM = { youtube: 'YouTube', facebook: 'Fanpage', group: 'Nhóm' };
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
          return `<div class="mk-h-row"><span class="badge ${c}">${t}</span><span class="badge">${PLATFORM[h.platform] || h.platform}</span>
            <span class="mk-h-title">${h.url && h.status !== 'deleted' ? `<a href="${esc(h.url)}" target="_blank" rel="noopener">${esc(h.title)}</a>` : esc(h.title)}${h.group_name ? `<small>Nhóm: ${esc(h.group_name)}</small>` : ''}${h.error ? `<small>${esc(h.error)}</small>` : ''}</span>
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
      hint: 'Tất cả bài viết chia theo Máy / Game / Hướng dẫn / Shop. Bấm Đăng bài để đăng lên Fanpage hoặc sao chép bài cho nhóm (tự thêm câu xin phép Admin).' },
    mktCalendar: { group: 'Truyền thông', label: 'Lịch đăng Facebook', icon: 'clock', custom: true, render: renderCalendar,
      hint: '2 bài mỗi ngày trong 7 ngày tới: khung đầu giới thiệu máy, khung sau giới thiệu game. Sửa bài trực tiếp, rồi hẹn giờ đăng lên Fanpage hoặc sao chép để đăng tay.' },
    mktYoutube: { group: 'Truyền thông', label: 'Video YouTube', icon: 'youtube', custom: true, render: renderYoutube,
      hint: 'Tải video từ máy tính lên kênh YouTube, tiêu đề và mô tả điền sẵn theo máy hoặc game.' },
    mktConnect: { group: 'Truyền thông', label: 'Kết nối & lịch sử', icon: 'send', custom: true, render: renderConnect,
      hint: 'Kết nối Fanpage và kênh YouTube, chọn khung giờ đăng, xem lịch sử.' },
  });

  // Esc đóng khung xem/sửa bài
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && libOpen && document.querySelector('.lib-drawer.open')) { libOpen = null; drawLibrary(); }
  });

  // Quay về từ trang đăng nhập Google
  const yt = new URLSearchParams(location.search).get('yt');
  if (yt) {
    setTimeout(() => A.toast(yt === 'ok' ? 'Đã kết nối kênh YouTube.' : 'Kết nối YouTube lỗi: ' + yt, yt === 'ok' ? 'ok' : 'err'), 800);
    history.replaceState(null, '', location.pathname);
  }
})();
