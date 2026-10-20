(() => {
'use strict';
const WORDS = window.WORDS.map((o, i) => ({ ...o, i }));
const $ = s => document.querySelector(s);
const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.random() * (i + 1) | 0; [a[i], a[j]] = [a[j], a[i]]; } return a; };
const pick = (a, n) => shuffle(a).slice(0, n);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const SPK = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 9v6h4l5 4V5L8 9z" fill="currentColor"/><path d="M16.5 8.5a5 5 0 0 1 0 7M19 6a8.5 8.5 0 0 1 0 12"/></svg>';

/* ---------------- state (memory only) ---------------- */
const state = { group: 0, stars: {}, stickers: [] };
const GROUPS = [
  { name: '第一組', sub: '詞語 1–10', idx: [0, 10] },
  { name: '第二組', sub: '詞語 11–20', idx: [10, 20] },
  { name: '第三組', sub: '詞語 21–30', idx: [20, 30] },
  { name: '第四組', sub: '詞語 31–40', idx: [30, 40] },
  { name: '全部詞語', sub: '40個一齊溫', idx: [0, 40] },
];
const groupWords = () => WORDS.slice(...GROUPS[state.group].idx);

const LEVELS = [
  { id: 'learn', n: 1, t: '認識詞語', d: '聽粵音、看筆順、讀例句', c: 'c-pink' },
  { id: 'listen', n: 2, t: '聽音選詞', d: '聽讀音，選出正確詞語', c: 'c-lav' },
  { id: 'spot', n: 3, t: '火眼金睛', d: '找出寫法正確的詞語', c: 'c-mint' },
  { id: 'fill', n: 4, t: '補上缺字', d: '詞語少了一個字，快補上', c: 'c-sky' },
  { id: 'trace', n: 5, t: '跟着筆順寫', d: '在田字格按筆順描寫', c: 'c-butter' },
  { id: 'dictate', n: 6, t: '聽寫挑戰', d: '聽讀音，憑記憶寫出來', c: 'c-pink' },
  { id: 'test', n: 7, t: '總測驗', d: '混合題目，模擬評估', c: 'c-lav' },
];
const STICKERS = ['🎀', '🍓', '🧁', '🌸', '🐰', '⭐', '🍰', '🌈', '💖', '🐱', '🍬', '🦄', '🍡', '🌷', '🎈'];

/* ---------------- audio ---------------- */
let voiceMode = 'rec';
let player = new Audio();
let zhVoice = null;
function loadVoices() {
  const vs = (window.speechSynthesis && speechSynthesis.getVoices()) || [];
  const hk = vs.filter(v => /zh[-_]HK|yue|Cantonese|粵/i.test(v.lang + ' ' + v.name));
  const fem = hk.find(v => /Sin-?ji|HiuGaai|HiuMaan|female|女|Google/i.test(v.name));
  zhVoice = fem || hk[0] || null;
}
if (window.speechSynthesis) { loadVoices(); speechSynthesis.onvoiceschanged = loadVoices; }
function speakDevice(text) {
  if (!window.speechSynthesis) return;
  speechSynthesis.cancel();
  const u = new SpeechSynthesisUtterance(text);
  u.lang = 'zh-HK'; u.rate = 0.8; u.pitch = 1.1;
  if (zhVoice) u.voice = zhVoice;
  speechSynthesis.speak(u);
}
function play(src, fallbackText) {
  try { player.pause(); } catch (e) {}
  if (window.speechSynthesis) speechSynthesis.cancel();
  if (voiceMode === 'dev' && fallbackText) { speakDevice(fallbackText); return; }
  player = new Audio(src);
  player.play().catch(() => { if (fallbackText) speakDevice(fallbackText); });
}
const sayWord = w => play(`audio/w_${w.i}.mp3`, w.w);
const saySent = w => play(`audio/s_${w.i}.mp3`, w.s);
const PH = { good: '答對了，好叻呀！', great: '好犀利！繼續努力！', retry: '唔緊要，再試一次！', listen: '請聽清楚，然後寫出這個詞語。', hello: '你好！我哋一齊溫習中文詞語啦！', done: '完成了！你真係好棒呀！' };
const sayPh = k => play(`audio/p_${k}.mp3`, PH[k]);

/* ---------------- ui helpers ---------------- */
function toast(msg) { const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toast._t); toast._t = setTimeout(() => t.classList.remove('show'), 1500); }
function confetti() {
  const box = $('#confetti'); const em = ['🎀', '💖', '⭐', '🌸', '✨'];
  for (let k = 0; k < 26; k++) { const i = document.createElement('i'); i.textContent = em[k % em.length]; i.style.left = Math.random() * 100 + 'vw'; i.style.animationDelay = Math.random() * .6 + 's'; box.appendChild(i); setTimeout(() => i.remove(), 2600); }
}
function totalStars() { return Object.values(state.stars).reduce((a, b) => a + b, 0); }
function setProg(i, n) { $('#progBar').style.width = (n ? (i / n) * 100 : 0) + '%'; $('#gCount').textContent = `${Math.min(i + 1, n)} / ${n}`; }
const charUrl = ch => `hanzi/${ch.codePointAt(0).toString(16)}.json`;
const loader = (ch, done, err) => fetch(charUrl(ch)).then(r => r.json()).then(done).catch(err);
function makeWriter(el, ch, opt) {
  const sz = el.clientWidth || 230;
  return HanziWriter.create(el, ch, Object.assign({
    width: sz, height: sz, padding: Math.round(sz * .07), charDataLoader: loader,
    strokeColor: '#5b3a45', radicalColor: '#e8558c', outlineColor: '#f6d2df', highlightColor: '#9fe0c9',
    drawingColor: '#5b3a45', drawingWidth: Math.max(14, sz / 14), strokeAnimationSpeed: 1, delayBetweenStrokes: 250, showHintAfterMisses: 3,
  }, opt));
}

/* ---------------- home ---------------- */
function renderHome() {
  $('#groups').innerHTML = GROUPS.map((g, i) => `<button class="gtab" aria-pressed="${i === state.group}" data-g="${i}"><b>${g.name}</b><span>${g.sub}</span></button>`).join('');
  $('#levels').innerHTML = LEVELS.map(l => {
    const s = state.stars[l.id + state.group] || 0;
    return `<button class="lv ${l.c}" data-l="${l.id}"><span class="stars" aria-label="${s}粒星">${[1, 2, 3].map(k => `<i class="${k <= s ? 'on' : ''}">★</i>`).join('')}</span><span class="num">${l.n}</span><h3>${l.t}</h3><p>${l.d}</p></button>`;
  }).join('');
  $('#bank').innerHTML = WORDS.map(w => `<button class="wchip" data-w="${w.i}"><b>${w.w}</b><small>${w.i + 1}. ${w.jp}</small></button>`).join('');
  $('#starCount').textContent = totalStars();
  const st = $('#stickers');
  st.innerHTML = state.stickers.length ? state.stickers.map(s => `<span class="stk">${s}</span>`).join('') : '<span class="empty">完成關卡就可以收集貼紙！</span>';
}
$('#groups').addEventListener('click', e => { const b = e.target.closest('.gtab'); if (!b) return; state.group = +b.dataset.g; renderHome(); });
$('#levels').addEventListener('click', e => { const b = e.target.closest('.lv'); if (b) startLevel(b.dataset.l); });
$('#bank').addEventListener('click', e => { const b = e.target.closest('.wchip'); if (!b) return; const w = WORDS[+b.dataset.w]; sayWord(w); startLevel('learn', w.i); });
$('#heroImg').addEventListener('click', () => sayPh('hello'));
$('#voiceMode').addEventListener('change', e => { voiceMode = e.target.value; if (voiceMode === 'dev' && !zhVoice) toast('此裝置未必有粵語聲，可改用錄音'); });
$('#homeBtn').addEventListener('click', goHome);
function goHome() { cleanup(); document.body.classList.remove('playing'); $('#homeBtn').hidden = true; renderHome(); window.scrollTo(0, 0); }

/* ---------------- game framework ---------------- */
let G = null; let writers = [];
function cleanup() { writers.forEach(w => { try { w.cancelQuiz && w.cancelQuiz(); } catch (e) {} }); writers = []; }
function startLevel(id, startAt) {
  cleanup();
  const L = LEVELS.find(l => l.id === id);
  document.body.classList.add('playing'); $('#homeBtn').hidden = false; window.scrollTo(0, 0);
  $('#gTitle').textContent = `${L.n}. ${L.t}・${GROUPS[state.group].name}`;
  let words = groupWords();
  let qs;
  if (id === 'learn') {
    qs = words.map(w => ({ type: 'learn', w }));
    if (startAt != null) { const all = WORDS; qs = all.map(w => ({ type: 'learn', w })); $('#gTitle').textContent = `1. 認識詞語・詞語表`; }
  } else if (id === 'test') {
    const pool = shuffle(words).slice(0, Math.min(16, words.length));
    const types = ['listen', 'spot', 'fill', 'dictate'];
    qs = pool.map((w, k) => ({ type: types[k % 4], w }));
    qs = shuffle(qs);
  } else {
    qs = shuffle(words).map(w => ({ type: id, w }));
  }
  G = { id, L, qs, k: 0, score: 0, max: 0, words };
  if (startAt != null) G.k = startAt;
  showQ();
}
function showQ() {
  cleanup();
  if (G.k >= G.qs.length) return finish();
  setProg(G.k, G.qs.length);
  const q = G.qs[G.k];
  ({ learn: qLearn, listen: qListen, spot: qSpot, fill: qFill, trace: qTrace, dictate: qDictate })[q.type](q);
}
function next(delay = 900) { setTimeout(() => { G.k++; showQ(); }, delay); }
function stageHTML(img, say, body) {
  return `<div class="stage"><div class="mascot"><img src="img/${img}.webp" alt=""></div><div>${say ? `<div class="say">${say}</div>` : ''}${body}</div></div>`;
}
function bindOpts(correct) {
  const btns = [...document.querySelectorAll('.opt')];
  let first = true;
  btns.forEach(b => b.addEventListener('click', () => {
    if (b.dataset.v === correct) {
      G.max++; if (first) G.score++;
      btns.forEach(x => x.disabled = true); b.classList.add('ok');
      sayPh(first ? (Math.random() < .5 ? 'good' : 'great') : 'good'); toast('答對了！好叻呀 💖'); next(1600);
    } else {
      first = false; b.classList.add('no'); b.disabled = true; sayPh('retry'); toast('唔緊要，再試一次！');
    }
  }));
}

/* ---- 1. learn ---- */
function qLearn(q) {
  const w = q.w; const chars = [...w.w];
  $('#gCard').innerHTML = stageHTML('susu', `第 ${w.i + 1} 個詞語，按喇叭聽聽點讀啦！`, `
    <div class="row" style="gap:16px;align-items:flex-end"><div class="big">${w.w}</div><div class="jp">${w.jp}</div></div>
    <div class="row"><button class="btn" id="bW">${SPK} 讀詞語</button><button class="btn lav" id="bS">${SPK} 讀例句</button><button class="btn ghost" id="bA">✏️ 再看筆順</button></div>
    <div class="grids" id="gr">${chars.map(() => `<div class="tz" style="--sz:${chars.length > 2 ? 150 : 180}px"></div>`).join('')}</div>
    <div class="hintline">粉紅色筆畫是部首 ・ 按田字格重看筆順</div>
    <div class="sent">📖 ${w.s.replace(w.w, `<u>${w.w}</u>`)}</div>
    <div class="tip"><b>記字小貼士：</b>${esc(w.tip)}</div>
    <div class="navrow"><button class="btn ghost" id="bP" ${G.k === 0 ? 'disabled style="opacity:.4"' : ''}>← 上一個</button><button class="btn mint" id="bN">${G.k === G.qs.length - 1 ? '完成 ✓' : '下一個 →'}</button></div>`);
  const boxes = [...document.querySelectorAll('#gr .tz')];
  writers = boxes.map((el, k) => makeWriter(el, chars[k], { showOutline: true, showCharacter: false }));
  const animAll = async () => { for (const wr of writers) { await new Promise(r => wr.animateCharacter({ onComplete: r })); } };
  boxes.forEach((el, k) => el.addEventListener('click', () => writers[k].animateCharacter()));
  setTimeout(animAll, 300);
  $('#bA').onclick = animAll; $('#bW').onclick = () => sayWord(w); $('#bS').onclick = () => saySent(w);
  $('#bN').onclick = () => { G.k++; G.score++; G.max++; showQ(); };
  $('#bP').onclick = () => { if (G.k > 0) { G.k--; showQ(); } };
  sayWord(w);
}

/* ---- 2. listen ---- */
function qListen(q) {
  const w = q.w; const pool = (G.words.length >= 4 ? G.words : WORDS).filter(x => x.i !== w.i);
  const opts = shuffle([w, ...pick(pool, 3)]);
  $('#gCard').innerHTML = stageHTML('susu', '聽一聽，是哪一個詞語？', `
    <div class="row"><button class="btn" id="bW">${SPK} 再聽一次</button><button class="btn lav" id="bS">${SPK} 聽例句</button></div>
    <div class="opts">${opts.map(o => `<button class="opt" data-v="${o.w}">${o.w}</button>`).join('')}</div>`);
  $('#bW').onclick = () => sayWord(w); $('#bS').onclick = () => saySent(w);
  bindOpts(w.w, q); setTimeout(() => sayWord(w), 250);
}

/* ---- 3. spot correct writing ---- */
function wrongForms(w) {
  const forms = new Set([w.bad]);
  // a second wrong form: swap one char with the confusable char from another word if lengths match
  const cs = [...w.w]; const bs = [...w.bad];
  const diff = cs.findIndex((c, k) => c !== bs[k]);
  const others = WORDS.filter(x => x.i !== w.i);
  for (const o of shuffle(others)) {
    const oc = [...o.bad].find((c, k) => c !== [...o.w][k]);
    if (!oc) continue;
    const pos = diff === 0 ? cs.length - 1 : 0;
    if (cs.length === 1) break;
    const f = cs.slice(); f[pos] = oc; const s = f.join('');
    if (s !== w.w && !forms.has(s)) { forms.add(s); break; }
  }
  return [...forms];
}
function qSpot(q) {
  const w = q.w; const opts = shuffle([w.w, ...wrongForms(w)]);
  const blank = w.s.replace(w.w, '<u>＿＿</u>');
  $('#gCard').innerHTML = stageHTML('think', '小心看清楚！哪一個寫法是正確的？', `
    <div class="sent">📖 ${blank}</div>
    <div class="row"><button class="btn" id="bW">${SPK} 聽詞語</button><button class="btn lav" id="bS">${SPK} 聽例句</button></div>
    <div class="opts" style="grid-template-columns:repeat(${opts.length},1fr)">${opts.map(o => `<button class="opt" data-v="${o}">${o}</button>`).join('')}</div>
    <div class="tip" id="tp" hidden><b>記字小貼士：</b>${esc(w.tip)}</div>`);
  $('#bW').onclick = () => sayWord(w); $('#bS').onclick = () => saySent(w);
  bindOpts(w.w, q);
  document.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => { if (b.dataset.v !== w.w) $('#tp').hidden = false; }));
  setTimeout(() => sayWord(w), 250);
}

/* ---- 4. fill missing char ---- */
function qFill(q) {
  const w = q.w; const cs = [...w.w]; const bs = [...w.bad];
  let pos = cs.findIndex((c, k) => c !== bs[k]); if (pos < 0) pos = 0;
  const ans = cs[pos];
  const set = new Set([ans]);
  if (bs[pos] && bs[pos] !== ans) set.add(bs[pos]);
  const allChars = shuffle([...new Set(WORDS.flatMap(x => [...x.w]))]);
  for (const c of allChars) { if (set.size >= 4) break; if (!cs.includes(c)) set.add(c); }
  const opts = shuffle([...set]);
  const show = () => cs.map((c, k) => k === pos ? `<span class="blank" id="blank">？</span>` : `<span>${c}</span>`).join('');
  $('#gCard').innerHTML = stageHTML('think', '詞語少了一個字，請補上正確的字。', `
    <div class="fillword">${show()}</div>
    <div class="row" style="justify-content:center"><button class="btn" id="bW">${SPK} 聽詞語</button><button class="btn lav" id="bS">${SPK} 聽例句</button></div>
    <div class="opts" style="grid-template-columns:repeat(4,1fr)">${opts.map(o => `<button class="opt" data-v="${o}">${o}</button>`).join('')}</div>
    <div class="tip" id="tp" hidden><b>記字小貼士：</b>${esc(w.tip)}</div>`);
  $('#bW').onclick = () => sayWord(w); $('#bS').onclick = () => saySent(w);
  bindOpts(ans, q);
  document.querySelectorAll('.opt').forEach(b => b.addEventListener('click', () => {
    if (b.dataset.v === ans) { const bl = $('#blank'); bl.textContent = ans; bl.classList.remove('blank'); bl.style.borderColor = 'var(--mint-d)'; }
    else $('#tp').hidden = false;
  }));
  setTimeout(() => sayWord(w), 250);
}

/* ---- 5/6. writing (trace / dictate) ---- */
function writingTask(q, mode) {
  const w = q.w; const chars = [...w.w]; const dict = mode === 'dictate';
  const avail = window.innerWidth < 720 ? window.innerWidth - 96 : Math.min(window.innerWidth, 1040) - 300;
  const sz = Math.round(Math.min(250, Math.max(110, avail / chars.length - 16)));
  $('#gCard').innerHTML = stageHTML(dict ? 'think' : 'susu',
    dict ? '聽清楚讀音，憑記憶在田字格寫出詞語。寫錯三次會有提示。' : '跟着淺色筆畫，一筆一筆按筆順寫。',
    `${dict ? '' : `<div class="row" style="gap:16px;align-items:flex-end"><div class="big" style="font-size:54px">${w.w}</div><div class="jp">${w.jp}</div></div>`}
    <div class="row"><button class="btn" id="bW">${SPK} 聽詞語</button><button class="btn lav" id="bS">${SPK} 聽例句</button>
      <button class="btn ghost" id="bH">💡 ${dict ? '提示一下' : '示範筆順'}</button></div>
    ${dict ? `<div class="sent">📖 ${w.s.replace(w.w, '<u>' + '＿'.repeat(chars.length) + '</u>')}</div>` : ''}
    <div class="grids" id="gr">${chars.map(() => `<div class="tz" style="--sz:${sz}px"></div>`).join('')}</div>
    <div class="hintline" id="hl">用手指或滑鼠，在第 1 格開始寫</div>
    <div class="navrow"><span></span><button class="btn ghost" id="bSkip">跳過 →</button></div>`);
  $('#bW').onclick = () => sayWord(w); $('#bS').onclick = () => saySent(w);
  const boxes = [...document.querySelectorAll('#gr .tz')];
  writers = boxes.map((el, k) => makeWriter(el, chars[k], { showOutline: !dict, showCharacter: false, showHintAfterMisses: dict ? 3 : 2 }));
  let cur = 0, mistakes = 0;
  const startCur = () => {
    boxes.forEach((b, k) => b.classList.toggle('active', k === cur));
    $('#hl').textContent = `寫第 ${cur + 1} 個字（共 ${chars.length} 個）`;
    writers[cur].quiz({
      onMistake: () => { mistakes++; },
      onComplete: s => {
        boxes[cur].classList.remove('active'); boxes[cur].classList.add('done');
        const bd = document.createElement('span'); bd.className = 'badge'; bd.textContent = s.totalMistakes ? '✓' : '滿分 ✓'; boxes[cur].appendChild(bd);
        cur++;
        if (cur < chars.length) startCur(); else done();
      }
    });
  };
  const done = () => {
    G.max++; const ok = mistakes <= chars.length * (dict ? 2 : 3);
    if (ok) G.score++;
    $('#hl').innerHTML = `寫好了！正確寫法：<b style="font-size:24px;font-weight:400;color:var(--pink-d)">${w.w}</b>　${mistakes ? `（錯了 ${mistakes} 筆）` : '一筆都冇錯！'}`;
    sayPh(ok ? 'good' : 'retry'); if (!mistakes) confetti();
    const nb = $('#bSkip'); nb.textContent = '下一個 →'; nb.className = 'btn mint';
  };
  $('#bH').onclick = () => {
    const wr = writers[cur] || writers[writers.length - 1];
    if (dict) { mistakes++; wr.showOutline(); setTimeout(() => { try { wr.hideOutline(); } catch (e) {} }, 1600); }
    else { wr.cancelQuiz(); wr.animateCharacter({ onComplete: () => startCur() }); }
  };
  let used = false;
  $('#bSkip').onclick = () => { if (used) return; used = true; if (cur < chars.length) G.max++; G.k++; showQ(); };
  startCur();
  setTimeout(() => (dict ? sayWord(w) : sayWord(w)), 250);
}
const qTrace = q => writingTask(q, 'trace');
const qDictate = q => writingTask(q, 'dictate');

/* ---------------- finish ---------------- */
function finish() {
  setProg(G.qs.length, G.qs.length); $('#gCount').textContent = '完成！';
  const pct = G.max ? G.score / G.max : 1;
  const s = pct >= .9 ? 3 : pct >= .6 ? 2 : 1;
  const key = G.id + state.group; state.stars[key] = Math.max(state.stars[key] || 0, s);
  const st = STICKERS[(state.stickers.length) % STICKERS.length]; state.stickers.push(st);
  $('#starCount').textContent = totalStars();
  const L = G.L;
  $('#gCard').innerHTML = `<div class="result">
    <img src="img/cheer.webp" alt="Susu 和 Neko 歡呼">
    <h2 style="font-weight:400;color:var(--pink-d);margin:6px 0">${s === 3 ? '太棒了！' : s === 2 ? '做得好！' : '繼續加油！'}</h2>
    <div class="bigstars">${[1, 2, 3].map(k => `<i class="${k <= s ? 'on' : ''}">★</i>`).join('')}</div>
    ${G.id === 'learn' ? '<p>40個詞語要多聽多寫，就會記得清清楚楚！</p>' : `<p>答對 ${G.score} / ${G.max} 題</p>`}
    <p>得到新貼紙：<span class="stk" style="display:inline-grid;vertical-align:middle">${st}</span></p>
    <div class="row" style="justify-content:center;margin-top:10px"><button class="btn" id="again">🔁 再玩一次</button><button class="btn lav" id="nextL">下一關 →</button><button class="btn ghost" id="home2">🏠 返主頁</button></div></div>`;
  sayPh('done'); confetti();
  $('#again').onclick = () => startLevel(G.id);
  const ni = LEVELS.findIndex(l => l.id === L.id);
  $('#nextL').onclick = () => startLevel(LEVELS[(ni + 1) % LEVELS.length].id);
  $('#home2').onclick = goHome;
}

renderHome();
})();
