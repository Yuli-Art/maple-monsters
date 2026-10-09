// 玩家紀錄：我的角色、練功路線、技能配點、裝備目標。資料只存在這台裝置的瀏覽器（你記你的、朋友記朋友的）。
(() => {
"use strict";

// ---------- 儲存 ----------
const KEY = "rm-tracker-v1";
const blank = () => ({v: 1, chars: [], routes: [], builds: [], sets: [], goals: [], ui: {}});
let S = blank();
try { Object.assign(S, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
let storageOk = true;
function save() {
  try { localStorage.setItem(KEY, JSON.stringify(S)); storageOk = true; } catch (e) { storageOk = false; }
}
const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
const find = (arr, id) => arr.find(x => x.id === id);
const today = () => new Date().toISOString().slice(0, 10);
const num = (v, lo, hi) => Math.min(hi, Math.max(lo, parseInt(v, 10) || 0));

// ---------- 職業 ----------
const CLASSES = {
  warrior: {n: "劍士", common: "warriorCommon", br: {fighter: ["狂戰士", "十字軍", "英雄"], page: ["見習騎士", "騎士", "聖騎士"], spearman: ["槍騎兵", "龍騎士", "黑騎士"], aran: ["狂狼勇士"]}},
  magician: {n: "法師", common: "magicianCommon", br: {firePoison: ["火毒巫師", "火毒魔導士", "大魔導士（火毒）"], iceLightning: ["冰雷巫師", "冰雷魔導士", "大魔導士（冰雷）"], cleric: ["僧侶", "祭司", "主教"]}},
  archer: {n: "弓箭手", br: {hunter: ["獵人", "遊俠", "箭神"], crossbowman: ["弩弓手", "狙擊手", "神射手"], mercedes: ["精靈遊俠"]}},
  thief: {n: "盜賊", br: {assassin: ["刺客", "暗殺者", "夜使者"], bandit: ["俠盜", "神偷", "暗影神偷"], dualBlade: ["影武者"]}},
  pirate: {n: "海盜", br: {brawler: ["打手", "格鬥家", "拳霸"], gunslinger: ["槍手", "神槍手", "槍神"]}},
};
const HERO = {aran: 1, mercedes: 1};  // 英雄職業：1 轉就是自己的職業，目前沒有冒險家記憶
const BR_NAME = {firePoison: "火毒", iceLightning: "冰雷", cleric: "僧侶", fighter: "狂戰士系", page: "騎士系", spearman: "槍騎兵系", aran: "狂狼勇士", hunter: "獵人系", crossbowman: "弩弓手系", mercedes: "精靈遊俠", assassin: "刺客系", bandit: "俠盜系", dualBlade: "影武者", brawler: "打手系", gunslinger: "槍手系"};
const advList = br => br === "dualBlade" ? ["1", "1.5", "2", "2.5", "3", "4"] : ["1", "2", "3", "4"];
const MEM = ["warrior", "magician", "archer", "thief", "pirate"];

// 職業 key：「職業:分支:轉數」，例如 magician:iceLightning:3；1 轉是 magician::1；初心者是 beginner::0
function jobName(key) {
  const [cls, br, adv] = (key || "beginner::0").split(":");
  const c = CLASSES[cls];
  if (!c) return "初心者";
  if (!br) return c.n;
  const names = c.br[br] || [];
  if (names.length === 1) return `${names[0]} ${adv} 轉`;
  return names[{2: 0, 3: 1, 4: 2}[adv]] || c.n;
}
function jobOptions(sel) {
  let h = `<option value="beginner::0">初心者</option>`;
  for (const [cls, c] of Object.entries(CLASSES)) {
    const opts = [[`${cls}::1`, `${c.n}（1 轉）`]];
    for (const br of Object.keys(c.br)) for (const a of advList(br)) {
      if (a === "1" && !HERO[br]) continue;
      opts.push([`${cls}:${br}:${a}`, `${jobName(`${cls}:${br}:${a}`)}（${a} 轉）`]);
    }
    h += `<optgroup label="${c.n}">${opts.map(([v, n]) => `<option value="${v}">${esc(n)}</option>`).join("")}</optgroup>`;
  }
  return h.replace(`value="${sel}"`, `value="${sel}" selected`);
}
function memGroup(key) {
  const [cls, br] = (key || "").split(":");
  return CLASSES[cls] && !HERO[br] ? cls : null;
}
const jobEls = key => ({firePoison: "FP", iceLightning: "IL", cleric: "H"})[(key || "").split(":")[1]] || "";
const weakTo = (m, els) => els && [...els].some(c => m.w.includes(c));

// ---------- 轉生的記憶（數值來自網站技能資料「轉生的記憶 - ○○」）----------
const MEM_SKILL = Object.fromEntries(DATA.skills.filter(s => s.b[0] === "memory").map(s => [s.job, s]));
function fillDesc(s, lv) {
  let k = 0;
  return (s.ld || "").replace(/%[ds]/g, () => { const v = s.sv[s.lp[k++]]; return v ? v[lv - 1] ?? "" : ""; }).replace(/%%/g, "%");
}
const memEffect = (cls, tier) => tier && MEM_SKILL[cls] ? fillDesc(MEM_SKILL[cls], tier) : "";
function starsOf(c) {
  const t = Object.fromEntries(MEM.map(m => [m, 0]));
  for (const r of c.reb || []) { const g = memGroup(r.job); if (g) t[g] = Math.min(3, t[g] + 1); }
  return t;
}
const starStr = n => "★".repeat(n) + "☆".repeat(3 - n);
const memName = m => `${CLASSES[m].n}的記憶`;

// ---------- 小工具 ----------
function toast(msg) {
  let t = $("toast");
  if (!t) { t = document.createElement("div"); t.id = "toast"; t.className = "toast"; t.setAttribute("role", "status"); document.body.appendChild(t); }
  t.textContent = msg; t.classList.add("on");
  clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2600);
}
const encode = (tag, obj) => tag + btoa(unescape(encodeURIComponent(JSON.stringify(obj))));
function decode(tag, str) {
  str = (str || "").trim();
  if (!str.startsWith(tag)) throw new Error("tag");
  return JSON.parse(decodeURIComponent(escape(atob(str.slice(tag.length)))));
}
async function copyText(t, msg) {
  try { await navigator.clipboard.writeText(t); toast(msg); } catch (e) { prompt("複製這串文字：", t); }
}
// 共用小視窗：pick("標題", [{id, label, type, options, value}], "按鈕") → 填的值或 null
function pick(title, fields, okText) {
  const dlg = $("pickDlg");
  $("pickBody").innerHTML = `<div class="dlg-head"><div><h2>${esc(title)}</h2></div><button class="x" value="cancel" formnovalidate aria-label="關閉">✕</button></div>
    ${fields.map(f => `<label class="f"><span>${esc(f.label)}</span>${f.type === "select"
      ? `<select id="pk-${f.id}">${f.options.map(([v, n]) => `<option value="${esc(v)}"${v === f.value ? " selected" : ""}>${esc(n)}</option>`).join("")}</select>`
      : `<input id="pk-${f.id}" type="${f.type || "text"}" value="${esc(f.value ?? "")}">`}</label>`).join("")}
    <div class="acts"><button class="pill" value="cancel" formnovalidate>取消</button><button class="pill primary" value="ok">${esc(okText)}</button></div>`;
  dlg.returnValue = "";
  dlg.showModal();
  return new Promise(res => dlg.addEventListener("close", () =>
    res(dlg.returnValue === "ok" ? Object.fromEntries(fields.map(f => [f.id, $("pk-" + f.id).value])) : null), {once: true}));
}
const head = (title, desc, acts = "") => `<div class="tk-head"><div><h2>${title}</h2><p class="muted">${desc}</p></div><div class="acts">${acts}</div></div>`;
const empty = (msg, acts = "") => `<div class="empty-box"><p>${msg}</p>${acts ? `<div class="acts">${acts}</div>` : ""}</div>`;
const btn = (act, label, cls = "", attrs = "") => `<button type="button" class="pill ${cls}" data-act="${act}" ${attrs}>${label}</button>`;
const storageWarn = () => storageOk ? "" : `<p class="warn-box">這個瀏覽器沒辦法儲存資料（可能是無痕模式），關掉頁面後紀錄會不見。</p>`;

// 下拉清單用的 datalist（怪物、裝備、所有道具、各部位卷軸）
const lists = document.createElement("div");
lists.hidden = true;
document.body.appendChild(lists);
const MOB_LABEL = new Map(), EQUIP_NAME = new Map(), ITEM_NAME = new Map(), SCROLL_NAME = new Map();
DATA.mobs.forEach(m => MOB_LABEL.set(`${m.n} Lv${m.lv}`, m.id));
DATA.items.forEach((it, i) => {
  if (!ITEM_NAME.has(it[0])) ITEM_NAME.set(it[0], it[12]);
  if (it[2] === 0 && !EQUIP_NAME.has(it[0])) EQUIP_NAME.set(it[0], it[12]);
  if (it[2] === 1 && !SCROLL_NAME.has(it[0])) SCROLL_NAME.set(it[0], it[12]);
});
const opt = v => `<option value="${esc(v)}"></option>`;
lists.innerHTML = `<datalist id="mobList">${[...MOB_LABEL.keys()].map(opt).join("")}</datalist>
  <datalist id="equipList">${[...EQUIP_NAME.keys()].map(opt).join("")}</datalist>
  <datalist id="allItemList">${[...ITEM_NAME.keys()].map(opt).join("")}</datalist>
  <datalist id="accList"></datalist>`;
const SLOT_WORDS = {Wand: ["短杖", "杖魔力"], Staff: ["長杖"], Longcoat: ["套服"], Top: ["上衣"], Bottom: ["褲裙", "褲子"], Helmet: ["頭盔"], Gloves: ["手套"], Shoes: ["鞋子"], Cape: ["披風"], Earring: ["耳環"], Shield: ["盾牌"], OnehandedSword: ["單手劍"], TwohandedSword: ["雙手劍"], OnehandedAxe: ["單手斧"], TwohandedAxe: ["雙手斧"], OnehandedClub: ["單手棍"], TwohandedClub: ["雙手棍"], Spear: ["槍"], Polearm: ["矛"], Bow: ["弓"], Crossbow: ["弩"], Claw: ["拳套"], Dagger: ["短劍"], Knuckle: ["指虎"], Gun: ["火槍"], Pendant: ["項鍊", "墜飾"], Blade: ["雙刀"], DualBowgun: ["雙弩"], Face: ["臉飾"], Eye: ["眼飾"]};
function scrollList(sub) {
  const id = "sl-" + sub;
  if (!$(id)) {
    const words = SLOT_WORDS[sub] || [];
    let names = [...SCROLL_NAME.keys()].filter(n => words.some(w => n.includes(w)));
    if (!names.length) names = [...SCROLL_NAME.keys()];
    lists.insertAdjacentHTML("beforeend", `<datalist id="${id}">${names.map(opt).join("")}</datalist>`);
  }
  return id;
}

// ---------- 畫面切換 ----------
const VIEWS = {chars: renderChars, routes: renderRoutes, skills: renderSkills, gear: renderGear};
let current = null;
function show(v) { current = v; VIEWS[v](); }
function commit() { save(); if (current && !$("view-" + current).hidden) VIEWS[current](); }
function ui(k, v) { if (v === undefined) return S.ui[k]; S.ui[k] = v; }

// =====================================================================
// 我的角色
// =====================================================================
function renderChars() {
  const c = find(S.chars, S.ui.char);
  $("accList").innerHTML = [...new Set(S.chars.map(x => x.acc))].map(opt).join("");
  $("chars").innerHTML = c ? charDetail(c) : charList();
}
function charList() {
  const top = head("我的角色", "資料只存在你這台裝置的瀏覽器裡，你記你的、朋友記朋友的。換手機或電腦前，記得先「匯出備份」再到新裝置「匯入備份」。",
    btn("char-new", "＋ 新增角色", "primary") + btn("export", "匯出備份") + btn("import", "匯入備份"));
  if (!S.chars.length) return top + storageWarn() + empty("還沒有角色。按「＋ 新增角色」開始記錄，或先載入範例看看長什麼樣子（範例之後可以刪掉）。",
    btn("char-new", "＋ 新增角色", "primary") + btn("sample", "載入範例角色"));
  const groups = new Map();
  for (const c of S.chars) { if (!groups.has(c.acc)) groups.set(c.acc, []); groups.get(c.acc).push(c); }
  return top + storageWarn() + [...groups].map(([acc, cs]) =>
    `<h3 class="acc">帳號「${esc(acc)}」<span>${cs.length} 個角色</span></h3><div class="char-grid">${cs.map(charCard).join("")}</div>`).join("");
}
function charCard(c) {
  const t = starsOf(c), n = (c.reb || []).length;
  const route = find(S.routes, c.route), step = routeStep(route, c.lv), mob = step && MOB_BY_ID.get(step.mob);
  const deck = (c.deck || []).filter(Boolean).length;
  return `<button type="button" class="char-card" data-act="char-open" data-id="${c.id}">
    <span class="cc-top"><span><b class="cc-name">${esc(c.name)}</b><span class="muted">${esc(jobName(c.job))}</span></span>
      <span class="cc-lv"><b>Lv ${c.lv}</b><span>累計轉生 ${n} 次</span></span></span>
    <span class="mem-row">${MEM.map(m => `<span class="mem ${t[m] ? "on" : ""}"><small>${CLASSES[m].n}</small><b>${starStr(t[m])}</b></span>`).join("")}</span>
    <span class="cc-meta muted">轉生能力值 +${n * 25}・同行的英雄 ${deck} / 4</span>
    <span class="cc-now">${step ? `現在：Lv ${step.from}–${step.to} ${mob ? esc(mob.n) : "（還沒選怪）"}` : route ? "目前等級不在練功路線範圍內" : "還沒套用練功路線"}</span>
    <span class="bar"><i style="width:${Math.min(100, c.lv / 2)}%"></i></span>
    <span class="cc-foot muted">${c.lv >= 200 ? "已達 Lv 200，可以轉生" : `距離 Lv 200 轉生還差 ${200 - c.lv} 級`}</span>
  </button>`;
}
function charDetail(c) {
  const t = starsOf(c), n = (c.reb || []).length;
  const sel = (arr, cur, none) => `<option value="">${none}</option>` + arr.map(x => `<option value="${x.id}"${x.id === cur ? " selected" : ""}>${esc(x.name)}</option>`).join("");
  return `<div class="tk-head"><div><a href="#chars" class="back" data-act="char-back">← 所有角色</a><h2>${esc(c.name)}</h2>
      <p class="muted">${esc(jobName(c.job))}・Lv ${c.lv}・累計轉生 ${n} 次</p></div>
      <div class="acts">${btn("char-del", S.ui.confirm === c.id ? "再按一次確定刪除" : "刪除角色", "danger")}</div></div>
    ${storageWarn()}
    <div class="tk-grid2">
      <section class="box"><h3>基本資料</h3><div class="form">
        <label class="f"><span>名字</span><input data-f="name" autocomplete="off" value="${esc(c.name)}"></label>
        <label class="f"><span>帳號</span><input data-f="acc" list="accList" autocomplete="off" value="${esc(c.acc)}"></label>
        <label class="f"><span>目前職業</span><select data-f="job">${jobOptions(c.job)}</select></label>
        <label class="f"><span>等級</span><input data-f="lv" type="number" min="1" max="200" inputmode="numeric" value="${c.lv}"></label>
        <label class="f"><span>練功路線</span><select data-f="route">${sel(S.routes, c.route, "（不使用）")}</select></label>
        <label class="f"><span>技能配點</span><select data-f="build">${sel(S.builds, c.build, "（不使用）")}</select></label>
        <label class="f wide"><span>備註</span><textarea data-f="note" rows="3" placeholder="例如：第 4 次打算轉弓手，先存楓幣買裝">${esc(c.note || "")}</textarea></label>
      </div></section>
      <section class="box"><h3>轉生紀錄</h3>
        <p class="muted small">到 Lv 200 可以轉生，每次 +25 能力值（目前共 +${n * 25}）。轉生時是哪個職業系，就會增加那個職業的記憶星數。</p>
        ${n ? `<ol class="reb">${c.reb.map((r, i) => `<li><span class="n">第 ${i + 1} 次</span>
          <select data-f="reb.${i}.job" aria-label="第 ${i + 1} 次轉生的職業">${jobOptions(r.job)}</select>
          <input type="date" data-f="reb.${i}.date" value="${esc(r.date || "")}" aria-label="日期">
          <button type="button" class="x sm" data-act="reb-del" data-i="${i}" aria-label="刪除這次轉生">✕</button></li>`).join("")}</ol>`
          : `<p class="muted">還沒有轉生紀錄。</p>`}
        ${btn("reb-add", "＋ 記錄一次轉生")}
      </section>
    </div>
    <section class="box"><h3>轉生的記憶</h3><div class="tbl"><table class="mem-table">
      <thead><tr><th>記憶</th><th>星數</th><th>目前效果</th><th>下一階</th></tr></thead>
      <tbody>${MEM.map(m => `<tr class="${t[m] ? "on" : ""}"><th>${memName(m)}</th><td class="stars">${starStr(t[m])}</td>
        <td>${t[m] ? esc(memEffect(m, t[m])) : `<span class="muted">尚未取得</span>`}</td>
        <td class="muted">${t[m] < 3 ? esc(memEffect(m, t[m] + 1)) : "已滿"}</td></tr>`).join("")}</tbody></table></div>
      ${t.thief >= 3 ? `<p class="note">盜賊的記憶已滿 3 星，可以轉職影武者。</p>` : ""}
    </section>
    <section class="box"><h3>同行的英雄</h3><p class="muted small">牌組有 4 個欄位。只能編入已經取得的記憶。</p>
      <div class="deck">${[0, 1, 2, 3].map(i => { const v = (c.deck || [])[i]; return `<label class="slot ${v ? "on" : ""}"><small>欄位 ${i + 1}</small>
        <select data-f="deck.${i}"><option value="">＋ 編入英雄</option>${MEM.filter(m => t[m] || m === v).map(m => `<option value="${m}"${m === v ? " selected" : ""}>${memName(m)} ${starStr(t[m])}</option>`).join("")}</select></label>`; }).join("")}</div>
      <p class="muted small">英雄傳承卡（狂狼勇士、神秘英雄、精靈遊俠…）尚未開放。</p>
    </section>`;
}
function newChar(extra = {}) {
  const c = Object.assign({id: uid(), acc: S.chars.at(-1)?.acc || "主帳", name: "新角色", job: "beginner::0", lv: 1, reb: [], deck: [null, null, null, null], route: null, build: null, note: "", have: {}}, extra);
  S.chars.push(c);
  return c;
}
function loadSample() {
  const byName = n => DATA.mobs.find(m => m.n === n)?.id ?? null;
  const steps = [[1, 10, "綠水靈"], [10, 20, "青蛙"], [20, 30, "烏鴉"], [30, 40, "蝴蝶精"], [40, 50, "燈籠鬼"], [50, 60, "機器人堤安"], [60, 70, "蘑菇王"], [70, 85, "邪惡綿羊"], [85, 100, "赤翼龍"], [100, 120, "悔恨的守護隊長"]];
  const route = {id: uid(), name: "冰雷範例路線", steps: steps.map(([from, to, n]) => ({from, to, mob: byName(n), note: ""}))};
  S.routes.push(route);
  newChar({acc: "範例・主帳", name: "冰雷小雪", job: "magician:iceLightning:3", lv: 92, route: route.id, deck: ["warrior", null, null, null],
    reb: [{job: "warrior:spearman:4", date: "2026-08-30"}, {job: "warrior:spearman:4", date: "2026-09-12"}, {job: "archer:crossbowman:4", date: "2026-09-28"}]});
  newChar({acc: "範例・主帳", name: "火毒阿呆", job: "magician:firePoison:2", lv: 45, route: route.id, deck: ["pirate", null, null, null], reb: [{job: "pirate:gunslinger:4", date: "2026-09-20"}]});
  newChar({acc: "範例・小號 1", name: "帶練主教", job: "magician:cleric:3", lv: 70, reb: [{job: "magician:cleric:4", date: "2026-08-01"}, {job: "magician:cleric:4", date: "2026-09-02"}]});
  newChar({acc: "範例・小號 1", name: "暗影小偷", job: "thief:assassin:2", lv: 23});
}

// =====================================================================
// 練功路線
// =====================================================================
const sortSteps = r => r.steps.sort((a, b) => a.from - b.from || a.to - b.to);
function routeStep(route, lv) { return route ? route.steps.find(s => lv >= s.from && lv < s.to) || null : null; }
function sideList(items, cur, act, sub) {
  return `<nav class="tk-side">${items.map(x => `<button type="button" class="side-item ${x.id === cur ? "on" : ""}" data-act="${act}" data-id="${x.id}"><b>${esc(x.name)}</b><span class="muted small">${sub(x)}</span></button>`).join("")}</nav>`;
}
function renderRoutes() {
  const r = find(S.routes, S.ui.route) || S.routes[0];
  const top = head("練功路線", "記下每個等級區間要打的怪，可以套用到好幾個角色。在「怪物查詢」點開怪物 →「怪物資料」→「＋ 加入練功路線」也能直接加。",
    btn("route-new", "＋ 新增路線", "primary") + btn("route-import", "貼上分享碼"));
  if (!r) { $("routes").innerHTML = top + storageWarn() + empty("還沒有練功路線。", btn("route-new", "＋ 新增路線", "primary")); return; }
  S.ui.route = r.id;
  const users = S.chars.filter(c => c.route === r.id);
  const vc = find(S.chars, S.ui.routeView) || users[0] || null;
  const els = vc ? jobEls(vc.job) : "";
  const maxLv = 200;
  const ruler = `<div class="ruler"><div class="ruler-bar">${r.steps.map((s, i) => `<span class="rseg ${vc && vc.lv >= s.from && vc.lv < s.to ? "cur" : ""}" style="left:${(s.from - 1) / (maxLv - 1) * 100}%;width:${Math.max(0.5, (s.to - s.from) / (maxLv - 1) * 100)}%" title="Lv ${s.from}–${s.to}"></span>`).join("")}
      ${vc ? `<span class="marker" style="left:${(vc.lv - 1) / (maxLv - 1) * 100}%"><em>${esc(vc.name)} Lv ${vc.lv}</em></span>` : ""}</div>
      <div class="ruler-ticks">${[1, 50, 100, 150, 200].map(v => `<span style="left:${(v - 1) / (maxLv - 1) * 100}%">${v}</span>`).join("")}</div></div>`;
  const steps = r.steps.map((s, i) => {
    const m = MOB_BY_ID.get(s.mob);
    const cur = vc && vc.lv >= s.from && vc.lv < s.to;
    return `<div class="step ${cur ? "cur" : ""}">
      <div class="step-lv"><input type="number" min="1" max="200" data-sf="${i}.from" value="${s.from}" aria-label="起始等級"><span>–</span><input type="number" min="1" max="250" data-sf="${i}.to" value="${s.to}" aria-label="結束等級"></div>
      <div class="step-mob">${m && m.img ? `<img src="${m.img}" alt="">` : `<span class="noimg"></span>`}
        <div class="step-info"><input class="mob-pick" data-sf="${i}.mob" list="mobList" placeholder="輸入怪物名字" value="${m ? esc(`${m.n} Lv${m.lv}`) : ""}" aria-label="怪物">
          ${m ? `<span class="muted small">HP ${fmt(m.hp)}・EXP ${fmt(m.exp)}${m.m.length ? "・" + esc(DATA.maps[m.m[0]][0]) : ""}</span>` : ""}
          <span class="tags">${cur ? `<span class="tag cur">目前</span>` : ""}${m && weakTo(m, els) ? `<span class="tag good">克屬</span>` : ""}${m && els && [...els].some(c => m.r.includes(c)) ? `<span class="tag bad">會抗</span>` : ""}</span></div></div>
      <span class="els">${m ? (m.w || m.r ? chips(m.w, "w") + chips(m.r, "r") : `<span class="neutral">無屬性</span>`) : ""}</span>
      <input class="step-note" data-sf="${i}.note" placeholder="備註，例如：帶 300 瓶藍水" value="${esc(s.note || "")}" aria-label="備註">
      <button type="button" class="x sm" data-act="step-del" data-i="${i}" aria-label="刪除這段">✕</button></div>`;
  }).join("");
  $("routes").innerHTML = top + storageWarn() + `<div class="tk-split">
    ${sideList(S.routes, r.id, "route-pick", x => `${x.steps.length} 段・${S.chars.filter(c => c.route === x.id).length} 個角色`)}
    <div class="tk-main">
      <div class="box"><div class="row-wrap"><input class="title-in" data-rf="name" value="${esc(r.name)}" aria-label="路線名稱">
        <div class="acts">${btn("route-share", "複製分享碼")}${btn("route-dup", "複製一份")}${btn("route-del", S.ui.confirm === r.id ? "再按一次確定刪除" : "刪除", "danger")}</div></div>
        <div class="row-wrap small"><span class="muted">套用中：</span>${users.length ? users.map(c => `<span class="tag">${esc(c.name)}</span>`).join("") : `<span class="muted">沒有角色（到「我的角色」裡選這條路線）</span>`}
          <label class="muted">以角色檢視 <select data-ui="routeView"><option value="">（不選）</option>${S.chars.map(c => `<option value="${c.id}"${vc && c.id === vc.id ? " selected" : ""}>${esc(c.name)} Lv ${c.lv}</option>`).join("")}</select></label></div>
        ${ruler}</div>
      <div class="steps">${steps || `<p class="muted">還沒有任何一段。</p>`}</div>
      ${btn("step-add", "＋ 新增一段", "primary")}
      ${vc && els ? `<p class="muted small">「克屬」是依 ${esc(vc.name)} 的職業（${esc(jobName(vc.job))}）判斷。</p>` : ""}
    </div></div>`;
}
async function addMobToRoute(mobId) {
  const m = MOB_BY_ID.get(mobId);
  if (!S.routes.length) S.routes.push({id: uid(), name: "我的路線", steps: []});
  const res = await pick(`把「${m.n}」加入練功路線`, [
    {id: "route", label: "路線", type: "select", options: S.routes.map(r => [r.id, r.name]), value: S.ui.route || S.routes[0].id},
    {id: "from", label: "從 Lv", type: "number", value: Math.max(1, m.lv - 5)},
    {id: "to", label: "到 Lv", type: "number", value: m.lv + 5}], "加入");
  if (!res) return;
  const r = find(S.routes, res.route);
  r.steps.push({from: num(res.from, 1, 250), to: num(res.to, 1, 250), mob: mobId, note: ""});
  sortSteps(r);
  S.ui.route = r.id;
  save();
  toast(`已把「${m.n}」加到「${r.name}」`);
}

// =====================================================================
// 技能配點
// =====================================================================
const TYPE = {damage: "攻擊", buff: "增益", passive: "被動", debuff: "減益", summon: "召喚", utility: "輔助", crafting: "製作"};
function pathSkills(cls, br, adv) {
  return DATA.skills.filter(s => {
    if (s.adv !== adv) return false;
    if (s.job === "common") return adv === "4" && !HERO[br] && br !== "dualBlade";
    if (s.job !== cls) return false;
    if (!s.b.length) return adv === "1" && !HERO[br];
    if (s.b[0] === "memory") return false;
    return s.b.includes(br) || (CLASSES[cls].common && s.b.includes(CLASSES[cls].common));
  });
}
function advLevels(b) {
  const [cls, br] = b.path.split(":");
  const def = {"1": cls === "magician" ? 8 : 10, "1.5": 20, "2": 30, "2.5": 45, "3": br === "dualBlade" ? 55 : 70, "4": br === "dualBlade" ? 70 : 120};
  return Object.assign(def, b.advLv || {});
}
// 每升一級 3 點，轉職那一級只有 1 點；最後一轉算到 Lv 200（轉生）
function spOf(b, adv) {
  const br = b.path.split(":")[1], list = advList(br), L = advLevels(b), k = list.indexOf(adv), next = list[k + 1];
  return next ? 1 + 3 * Math.max(0, +L[next] - +L[adv] - 1) : 1 + 3 * Math.max(0, 200 - +L[adv]);
}
function pathOptions(sel) {
  return Object.entries(CLASSES).map(([cls, c]) => `<optgroup label="${c.n}">${Object.keys(c.br).map(br =>
    `<option value="${cls}:${br}"${`${cls}:${br}` === sel ? " selected" : ""}>${BR_NAME[br]}</option>`).join("")}</optgroup>`).join("");
}
function renderSkills() {
  const b = find(S.builds, S.ui.build) || S.builds[0];
  const top = head("技能配點", "每升一級 3 點、轉職那一級只有 1 點；轉職等級可以自己改。共用技能（例如冰雷的魔力吸收）已經補到各分支。",
    btn("build-new", "＋ 新增配點", "primary") + btn("build-import", "貼上分享碼"));
  if (!b) { $("skills").innerHTML = top + storageWarn() + empty("還沒有技能配點。", btn("build-new", "＋ 新增配點", "primary")); return; }
  S.ui.build = b.id;
  const [cls, br] = b.path.split(":");
  const users = S.chars.filter(c => c.build === b.id);
  const L = advLevels(b);
  const allShown = [];
  const blocks = advList(br).map(adv => {
    const skills = pathSkills(cls, br, adv);
    allShown.push(...skills);
    const used = skills.reduce((t, s) => t + (b.alloc[s.id] || 0), 0), total = spOf(b, adv);
    const jk = adv === "1" && !HERO[br] ? `${cls}::1` : `${cls}:${br}:${adv}`;
    return `<section class="box adv"><div class="adv-head"><h3>${adv} 轉・${esc(jobName(jk))}</h3>
      <label class="muted small">轉職等級 <input type="number" class="sm" min="1" max="200" data-bf="advLv.${adv}" value="${L[adv]}"></label>
      <span class="sp ${used === total ? "ok" : used > total ? "over" : ""}">已分配 ${used} / ${total}</span></div>
      <ul class="sk">${skills.map(s => skRow(b, s)).join("") || `<li class="muted">網站沒有這一轉的技能資料。</li>`}</ul></section>`;
  }).join("");
  const order = (b.order || []).map(([id, lv], i) => `<li><span class="n">${i + 1}</span>
    <select data-bf="order.${i}.0" aria-label="技能">${allShown.map(s => `<option value="${s.id}"${s.id === id ? " selected" : ""}>${esc(s.n)}</option>`).join("")}</select>
    <input type="number" class="sm" min="1" max="30" data-bf="order.${i}.1" value="${lv}" aria-label="目標等級">
    <button type="button" class="x sm" data-act="ord-del" data-i="${i}" aria-label="刪除這一步">✕</button></li>`).join("");
  $("skills").innerHTML = top + storageWarn() + `<div class="tk-split">
    ${sideList(S.builds, b.id, "build-pick", x => esc(BR_NAME[x.path.split(":")[1]] || ""))}
    <div class="tk-main">
      <div class="box"><div class="row-wrap"><input class="title-in" data-bf="name" value="${esc(b.name)}" aria-label="配點名稱">
        <div class="acts">${btn("build-share", "複製分享碼")}${btn("build-dup", "複製一份")}${btn("build-del", S.ui.confirm === b.id ? "再按一次確定刪除" : "刪除", "danger")}</div></div>
        <div class="row-wrap small"><label class="muted">職業 <select data-bf="path">${pathOptions(b.path)}</select></label>
          <span class="muted">套用中：</span>${users.length ? users.map(c => `<span class="tag">${esc(c.name)}</span>`).join("") : `<span class="muted">沒有角色</span>`}</div></div>
      <div class="sk-layout"><div class="sk-blocks">${blocks}</div>
        <aside class="box order"><h3>加點順序</h3><p class="muted small">照順序把技能點到目標等級。</p>
          ${order ? `<ol>${order}</ol>` : `<p class="muted">還沒有排順序。</p>`}
          <div class="acts">${btn("ord-add", "＋ 加一步")}${btn("ord-gen", "依目前配點產生")}</div></aside></div>
    </div></div>`;
}
function skRow(b, s) {
  const lv = b.alloc[s.id] || 0;
  const rq = s.rq && SKILL_BY_ID.get(s.rq[0]);
  const rqBad = rq && lv > 0 && (b.alloc[rq.id] || 0) < s.rq[1];
  return `<li class="${lv ? "on" : ""}">${s.img ? `<img src="${s.img}" alt="" loading="lazy">` : `<span class="noimg sm"></span>`}
    <div class="sk-n"><b>${esc(s.n)}</b><span class="muted small">${TYPE[s.t] || ""}・最高 ${s.max}${s.ml ? `（需技能書，沒讀書上限 ${s.ml}）` : ""}</span>
      ${rqBad ? `<span class="warn small">要先把「${esc(rq.n)}」點到 Lv ${s.rq[1]}</span>` : ""}
      ${lv && s.ld ? `<span class="eff small">Lv ${lv}：${esc(fillDesc(s, lv))}</span>` : ""}</div>
    <div class="stepper"><button type="button" data-act="sk-dec" data-id="${s.id}" aria-label="減一點">−</button>
      <input type="number" min="0" max="${s.max}" data-bf="alloc.${s.id}" value="${lv}" aria-label="${esc(s.n)} 等級">
      <button type="button" data-act="sk-inc" data-id="${s.id}" aria-label="加一點">+</button>
      <button type="button" data-act="sk-max" data-id="${s.id}" class="mx" aria-label="點滿">滿</button></div></li>`;
}
function newBuild(extra = {}) {
  const c = find(S.chars, S.ui.char) || S.chars[0];
  const [cls, br] = (c?.job || "").split(":");
  const path = CLASSES[cls] && br ? `${cls}:${br}` : "magician:iceLightning";
  const b = Object.assign({id: uid(), name: `${BR_NAME[path.split(":")[1]]} 配點`, path, alloc: {}, order: [], advLv: {}}, extra);
  S.builds.push(b);
  return b;
}

// =====================================================================
// 裝備目標
// =====================================================================
const STATUS = [["plan", "計畫中"], ["collect", "收集材料中"], ["scroll", "沖捲中"], ["done", "已完成"]];
function ensureSets(c) {
  if (!S.sets.some(s => s.char === c.id))
    for (const name of ["打王套", "練等套", "PVP 套", "單件目標"]) S.sets.push({id: uid(), char: c.id, name});
}
const upCount = it => (it[6] && it[6].UpgradeCnt) || 0;
function goalSlots(g, it) { const n = upCount(it); return Array.from({length: n}, (_, k) => (g.slots || [])[k] || ""); }
function gearNeeds(goals) {
  const need = new Map();
  let mesos = 0;
  const add = (i, q) => { if (i != null && q > 0) need.set(i, (need.get(i) || 0) + q); };
  for (const g of goals) {
    if (g.status === "done") continue;
    const it = DATA.items[ITEM_BY_KEY.get(g.item)];
    if (!it) continue;
    const r = it[11];
    if (r && (g.status === "plan" || g.status === "collect")) {
      r[2].forEach(([k, q]) => add(k, q));
      if (r[3]) add(r[3][0], r[3][1]);
      mesos += r[1];
    }
    if (g.scroll) add(ITEM_BY_KEY.get(g.scroll), goalSlots(g, it).filter(x => !x).length);
    for (const [k, q] of g.extra || []) add(ITEM_BY_KEY.get(k), +q || 0);
  }
  return {need, mesos};
}
function renderGear() {
  const top = head("裝備目標", "替每個角色設定要做的裝備（一整套或單件）。網頁會用遊戲的製作配方算出還缺哪些材料、要沖幾張卷軸、去哪裡打，也記錄已經做好的裝。");
  if (!S.chars.length) { $("gear").innerHTML = top + empty("先到「我的角色」新增角色，就能替每個角色設定要做的裝備。", `<a class="pill primary" href="#chars">前往我的角色</a>`); return; }
  const c = find(S.chars, S.ui.gearChar) || S.chars[0];
  S.ui.gearChar = c.id;
  ensureSets(c);
  const sets = S.sets.filter(s => s.char === c.id);
  const set = find(sets, S.ui.gearSet) || sets[0];
  S.ui.gearSet = set.id;
  const goals = S.goals.filter(g => g.set === set.id);
  const scope = S.ui.gearScope || "set";
  const scopeGoals = scope === "set" ? goals : scope === "char" ? S.goals.filter(g => sets.some(s => s.id === g.set)) : S.goals;
  const {need, mesos} = gearNeeds(scopeGoals);
  const els = jobEls(c.job);
  const haveOf = key => scope === "all" ? S.chars.reduce((t, x) => t + ((x.have || {})[key] || 0), 0) : ((c.have || {})[key] || 0);
  const rows = [...need].sort((a, b) => DATA.items[a[0]][2] - DATA.items[b[0]][2] || DATA.items[a[0]][0].localeCompare(DATA.items[b[0]][0], "zh-Hant"))
    .map(([i, q]) => matRow(i, q, haveOf(DATA.items[i][12]), scope, els)).join("");
  const done = S.goals.filter(g => g.status === "done");
  $("gear").innerHTML = head("裝備目標", "替每個角色設定要做的裝備（一整套或單件）。網頁會用遊戲的製作配方算出還缺哪些材料、要沖幾張卷軸、去哪裡打，也記錄已經做好的裝。",
      `<label class="muted small">角色 <select data-ui="gearChar">${S.chars.map(x => `<option value="${x.id}"${x.id === c.id ? " selected" : ""}>${esc(x.name)}（${esc(jobName(x.job))}）</option>`).join("")}</select></label>`)
    + storageWarn()
    + `<div class="tabs set-tabs">${sets.map(s => `<button type="button" data-act="set-pick" data-id="${s.id}" aria-selected="${s.id === set.id}">${esc(s.name)}<span class="n">${S.goals.filter(g => g.set === s.id).length}</span></button>`).join("")}
        <button type="button" data-act="set-new" class="add">＋ 新增套裝</button></div>
      <div class="row-wrap"><input class="add-in" id="goalAdd" list="equipList" placeholder="輸入裝備名字，例如：藍色巴爾帽" aria-label="要加入的裝備">
        ${btn("goal-add", "＋ 加入這件", "primary")}<span class="spacer"></span>${btn("set-ren", "改套裝名稱")}${btn("set-del", S.ui.confirm === set.id ? "再按一次確定刪除" : "刪除套裝", "danger")}</div>
      <div class="gear-layout"><div class="goals">${goals.map(g => goalCard(g)).join("") || `<div class="empty-box"><p>這個套裝還沒有裝備。在上面輸入裝備名字加入，或在「怪物查詢」點道具 →「＋ 設為裝備目標」。</p></div>`}</div>
        <aside class="box mats"><div class="mats-head"><h3>還缺的材料</h3>
          <div class="seg sm">${[["set", "這個套裝"], ["char", "這個角色"], ["all", "所有角色"]].map(([v, n]) => `<button type="button" data-act="scope" data-v="${v}" aria-pressed="${scope === v}">${n}</button>`).join("")}</div></div>
          ${rows || `<p class="muted small">目前沒有要收集的材料。裝備狀態設成「計畫中」或「收集材料中」，或選好要沖的卷軸，就會列在這裡。</p>`}
          ${mesos ? `<div class="mrow total"><span>製作費</span><b>楓幣 ${fmt(mesos)}</b></div>` : ""}
          ${scope === "all" ? `<p class="muted small">「所有角色」是各角色已有數量的加總；要修改數量請切回單一角色。</p>` : ""}</aside></div>
      <section class="box"><h3>已完成的裝備（所有角色）</h3>${done.length ? `<div class="done-grid">${done.map(g => {
        const i = ITEM_BY_KEY.get(g.item), it = DATA.items[i], st = find(S.sets, g.set), ch = st && find(S.chars, st.char);
        const succ = it ? goalSlots(g, it).filter(x => x === "s").length : 0;
        return it ? `<div class="done">${itemImg(i)}<div><span class="muted small">${esc(ch ? ch.name : "")}</span><b>${esc(it[0])}${succ ? ` +${succ}` : ""}</b></div></div>` : "";
      }).join("")}</div>` : `<p class="muted small">還沒有完成的裝備。裝備狀態設成「已完成」就會出現在這裡。</p>`}</section>`;
}
function goalCard(g) {
  const i = ITEM_BY_KEY.get(g.item), it = DATA.items[i];
  if (!it) return "";
  const slots = goalSlots(g, it), succ = slots.filter(x => x === "s").length, left = slots.filter(x => !x).length;
  const r = it[11], dropped = droppersOf(i).length;
  const scrollName = g.scroll && DATA.items[ITEM_BY_KEY.get(g.scroll)] ? DATA.items[ITEM_BY_KEY.get(g.scroll)][0] : "";
  return `<article class="goal st-${g.status}">
    <div class="g-top"><span class="g-ico">${itemImg(i)}</span><div class="g-n"><b>${esc(it[0])}</b>
      <span class="muted small">${esc(it[1])}${it[3] ? `・Lv ${it[3]}` : ""}${r ? `<span class="tag">製作</span>` : ""}${dropped ? `<span class="tag">掉落</span>` : ""}</span></div>
      <button type="button" class="x sm" data-act="goal-del" data-id="${g.id}" aria-label="移除這件">✕</button></div>
    <div class="g-row"><select data-gf="${g.id}.status" aria-label="狀態">${STATUS.map(([v, n]) => `<option value="${v}"${v === g.status ? " selected" : ""}>${n}</option>`).join("")}</select>
      ${succ ? `<b class="plus">+${succ}</b>` : ""}<button type="button" class="link" data-act="item-info" data-i="${i}">裝備資料</button></div>
    ${slots.length ? `<div class="g-scroll"><input data-gf="${g.id}.scroll" list="${scrollList(it[10])}" placeholder="要沖的卷軸" value="${esc(scrollName)}" aria-label="要沖的卷軸">
      <div class="slots">${slots.map((x, k) => `<button type="button" class="slot-b ${x}" data-act="slot" data-id="${g.id}" data-k="${k}" aria-label="第 ${k + 1} 格：${x === "s" ? "成功" : x === "f" ? "失敗" : "還沒沖"}"></button>`).join("")}</div>
      <span class="muted small">點格子切換：成功（綠）→ 失敗（紅）→ 還沒沖。${left ? `還有 ${left} 格` : "卷軸格已用完"}</span></div>` : `<p class="muted small">這件沒有可升級次數。</p>`}
    ${r ? `<details><summary>製作配方（${r[0] === "m" ? "製作技能" : "NPC"}${r[1] ? `・楓幣 ${fmt(r[1])}` : ""}）</summary><ul class="recipe">${r[2].map(([k, q]) => `<li>${itemImg(k)}${esc(DATA.items[k][0])} ×${q}</li>`).join("")}${r[3] ? `<li>${itemImg(r[3][0])}${esc(DATA.items[r[3][0]][0])} ×${r[3][1]}（催化劑）</li>` : ""}</ul></details>` : ""}
    <div class="g-extra">${(g.extra || []).map(([k, q], j) => { const ei = ITEM_BY_KEY.get(k); return ei == null ? "" : `<span class="ex">${itemImg(ei)}${esc(DATA.items[ei][0])} ×<input type="number" min="1" class="sm" data-gf="${g.id}.extra.${j}" value="${q}" aria-label="數量"><button type="button" class="x sm" data-act="ex-del" data-id="${g.id}" data-j="${j}" aria-label="移除">✕</button></span>`; }).join("")}
      <input class="ex-add" data-exadd="${g.id}" list="allItemList" placeholder="＋ 額外材料，例如：上級力量水晶" aria-label="加入額外材料"></div>
    <input class="g-note" data-gf="${g.id}.note" placeholder="備註" value="${esc(g.note || "")}" aria-label="備註">
  </article>`;
}
function matRow(i, q, have, scope, els) {
  const it = DATA.items[i], ok = have >= q, r = it[11];
  const ds = droppersOf(i), open = S.ui.where === i;
  let sub = "";
  if (!ok && r) {
    const per = r[4] || 1, times = Math.ceil((q - have) / per);
    const parts = r[2].map(([k, n]) => `${esc(DATA.items[k][0])} ×${n * times}`);
    if (r[3]) parts.push(`${esc(DATA.items[r[3][0]][0])} ×${r[3][1] * times}`);
    sub += `<span class="muted small">可以自己做：還差 ${q - have} 個 → ${parts.join("、")}${r[1] ? `、楓幣 ${fmt(r[1] * times)}` : ""}</span>`;
  }
  if (ds.length) sub += `<button type="button" class="link" data-act="where" data-i="${i}">${open ? "收起" : `去哪打（${ds.length} 隻怪會掉）`}</button>`;
  else if (!r) sub += `<span class="muted small">網站沒有這個道具的掉落資料，可以自己記在備註。</span>`;
  const where = open ? `<ul class="where">${ds.slice(0, 8).map(([m, p]) => `<li>${m.img ? `<img src="${m.img}" alt="">` : `<span class="noimg sm"></span>`}
    <div><b>${esc(m.n)}</b> <span class="muted small">Lv ${m.lv}・掉率 ${pct(p)}${m.m.length ? "・" + esc(DATA.maps[m.m[0]][0]) : ""}</span></div>
    <span class="els">${m.w || m.r ? chips(m.w, "w") + chips(m.r, "r") : `<span class="neutral">無屬性</span>`}</span>${weakTo(m, els) ? `<span class="tag good">克屬</span>` : ""}</li>`).join("")}</ul>` : "";
  return `<div class="mrow ${ok ? "ok" : ""}"><span class="m-ico">${itemImg(i)}</span>
    <div class="m-n"><b>${esc(it[0])}</b>${sub}</div>
    <div class="m-q">${scope === "all" ? `<b>${have}</b>` : `<input type="number" min="0" class="sm" data-have="${it[12]}" value="${have}" aria-label="已有數量">`}<span>/ ${q}</span>${ok ? `<span class="okmark" aria-label="已齊">✓</span>` : ""}</div>
    <span class="bar"><i style="width:${Math.min(100, have / q * 100)}%"></i></span>${where}</div>`;
}
async function addGoalFromItem(key) {
  if (!S.chars.length) { toast("先到「我的角色」新增角色，才能設定裝備目標"); location.hash = "#chars"; return; }
  S.chars.forEach(ensureSets);
  const it = DATA.items[ITEM_BY_KEY.get(key)];
  const res = await pick(`把「${it[0]}」設為裝備目標`, [{id: "set", label: "角色／套裝", type: "select",
    options: S.sets.map(s => [s.id, `${find(S.chars, s.char)?.name || "?"}／${s.name}`]), value: S.ui.gearSet}], "加入");
  if (!res) return;
  S.goals.push({id: uid(), set: res.set, item: key, status: "plan", scroll: null, slots: [], extra: [], note: ""});
  const st = find(S.sets, res.set);
  S.ui.gearSet = st.id; S.ui.gearChar = st.char;
  save();
  toast(`已加入「${find(S.chars, st.char)?.name}／${st.name}」`);
}

// =====================================================================
// 事件
// =====================================================================
function exportBackup() {
  const blob = new Blob([JSON.stringify(S, null, 1)], {type: "application/json"});
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = `玩樂宇宙紀錄-${today()}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
const fileIn = document.createElement("input");
fileIn.type = "file"; fileIn.accept = ".json,application/json"; fileIn.hidden = true;
document.body.appendChild(fileIn);
fileIn.addEventListener("change", async () => {
  const f = fileIn.files[0];
  fileIn.value = "";
  if (!f) return;
  try {
    const d = JSON.parse(await f.text());
    if (!Array.isArray(d.chars)) throw new Error("格式不對");
    if (!confirm(`這份備份有 ${d.chars.length} 個角色。匯入會取代目前這台裝置上的所有紀錄，確定嗎？`)) return;
    S = Object.assign(blank(), d);
    commit();
    toast("匯入完成");
  } catch (e) { alert("這個檔案不是玩樂宇宙紀錄的備份檔。"); }
});
function importCode(tag, kind, list, make) {
  const t = prompt(`貼上朋友給你的${kind}分享碼：`);
  if (!t) return;
  try { const o = decode(tag, t); list.push(make(o)); commit(); toast(`已匯入${kind}「${o.name}」`); }
  catch (e) { alert(`這串不是${kind}分享碼。`); }
}

const ACTS = {
  "char-new": () => { const c = newChar(); S.ui.char = c.id; },
  "char-open": d => { S.ui.char = d.id; window.scrollTo(0, 0); },
  "char-back": () => { S.ui.char = null; },
  "char-del": () => confirmThen(S.ui.char, () => {
    const id = S.ui.char, sets = S.sets.filter(s => s.char === id).map(s => s.id);
    S.chars = S.chars.filter(c => c.id !== id);
    S.sets = S.sets.filter(s => s.char !== id);
    S.goals = S.goals.filter(g => !sets.includes(g.set));
    S.ui.char = null;
  }),
  "reb-add": () => { const c = find(S.chars, S.ui.char); c.reb.push({job: c.job, date: today()}); },
  "reb-del": d => { find(S.chars, S.ui.char).reb.splice(+d.i, 1); },
  "export": () => { exportBackup(); return false; },
  "import": () => { fileIn.click(); return false; },
  "sample": () => { loadSample(); toast("已載入範例角色，之後可以在角色頁面刪掉"); },

  "route-new": () => { const r = {id: uid(), name: "新路線", steps: []}; S.routes.push(r); S.ui.route = r.id; },
  "route-pick": d => { S.ui.route = d.id; },
  "route-dup": () => { const r = find(S.routes, S.ui.route); const n = {...structuredClone(r), id: uid(), name: r.name + "（複製）"}; S.routes.push(n); S.ui.route = n.id; },
  "route-del": () => confirmThen(S.ui.route, () => { S.routes = S.routes.filter(r => r.id !== S.ui.route); S.chars.forEach(c => { if (c.route === S.ui.route) c.route = null; }); S.ui.route = null; }),
  "route-share": () => { const r = find(S.routes, S.ui.route); copyText(encode("RMR1:", {name: r.name, steps: r.steps}), "已複製路線分享碼，貼給朋友就好"); return false; },
  "route-import": () => { importCode("RMR1:", "路線", S.routes, o => ({id: uid(), name: o.name, steps: o.steps || []})); return false; },
  "step-add": () => { const r = find(S.routes, S.ui.route); const last = r.steps.at(-1); const from = last ? last.to : 1; r.steps.push({from, to: from + 10, mob: null, note: ""}); },
  "step-del": d => { find(S.routes, S.ui.route).steps.splice(+d.i, 1); },

  "build-new": () => { const b = newBuild(); S.ui.build = b.id; },
  "build-pick": d => { S.ui.build = d.id; },
  "build-dup": () => { const b = find(S.builds, S.ui.build); const n = {...structuredClone(b), id: uid(), name: b.name + "（複製）"}; S.builds.push(n); S.ui.build = n.id; },
  "build-del": () => confirmThen(S.ui.build, () => { S.builds = S.builds.filter(b => b.id !== S.ui.build); S.chars.forEach(c => { if (c.build === S.ui.build) c.build = null; }); S.ui.build = null; }),
  "build-share": () => { const b = find(S.builds, S.ui.build); copyText(encode("RMB1:", {name: b.name, path: b.path, alloc: b.alloc, order: b.order, advLv: b.advLv}), "已複製配點分享碼，貼給朋友就好"); return false; },
  "build-import": () => { importCode("RMB1:", "配點", S.builds, o => ({id: uid(), name: o.name, path: o.path, alloc: o.alloc || {}, order: o.order || [], advLv: o.advLv || {}})); return false; },
  "sk-inc": d => skAdd(+d.id, 1),
  "sk-dec": d => skAdd(+d.id, -1),
  "sk-max": d => skAdd(+d.id, 99),
  "ord-add": () => { const b = find(S.builds, S.ui.build); const [cls, br] = b.path.split(":"); const first = advList(br).flatMap(a => pathSkills(cls, br, a))[0]; if (first) (b.order ||= []).push([first.id, 1]); },
  "ord-del": d => { find(S.builds, S.ui.build).order.splice(+d.i, 1); },
  "ord-gen": () => { const b = find(S.builds, S.ui.build); const [cls, br] = b.path.split(":"); b.order = advList(br).flatMap(a => pathSkills(cls, br, a)).filter(s => b.alloc[s.id]).map(s => [s.id, b.alloc[s.id]]); },

  "set-pick": d => { S.ui.gearSet = d.id; },
  "set-new": () => { const name = prompt("新套裝的名稱：", "新套裝"); if (!name) return false; const st = {id: uid(), char: S.ui.gearChar, name}; S.sets.push(st); S.ui.gearSet = st.id; },
  "set-ren": () => { const st = find(S.sets, S.ui.gearSet); const name = prompt("套裝名稱：", st.name); if (!name) return false; st.name = name; },
  "set-del": () => confirmThen(S.ui.gearSet, () => { S.goals = S.goals.filter(g => g.set !== S.ui.gearSet); S.sets = S.sets.filter(s => s.id !== S.ui.gearSet); S.ui.gearSet = null; }),
  "goal-add": () => {
    const key = EQUIP_NAME.get($("goalAdd").value.trim());
    if (!key) { toast("找不到這件裝備，請從下拉清單選"); return false; }
    S.goals.push({id: uid(), set: S.ui.gearSet, item: key, status: "plan", scroll: null, slots: [], extra: [], note: ""});
  },
  "goal-del": d => { S.goals = S.goals.filter(g => g.id !== d.id); },
  "slot": d => { const g = find(S.goals, d.id); const it = DATA.items[ITEM_BY_KEY.get(g.item)]; g.slots = goalSlots(g, it); const k = +d.k; g.slots[k] = {"": "s", s: "f", f: ""}[g.slots[k]]; },
  "ex-del": d => { find(S.goals, d.id).extra.splice(+d.j, 1); },
  "scope": d => { S.ui.gearScope = d.v; },
  "where": d => { S.ui.where = S.ui.where === +d.i ? null : +d.i; },
  "item-info": d => { openItem(+d.i); return false; },
};
function confirmThen(id, fn) {
  if (S.ui.confirm === id) { fn(); S.ui.confirm = null; } else { S.ui.confirm = id; setTimeout(() => { if (S.ui.confirm === id) { S.ui.confirm = null; commit(); } }, 4000); }
}
function skAdd(id, delta) {
  const b = find(S.builds, S.ui.build), s = SKILL_BY_ID.get(id);
  b.alloc[id] = Math.min(s.max, Math.max(0, (b.alloc[id] || 0) + delta));
  if (!b.alloc[id]) delete b.alloc[id];
}

for (const v of Object.keys(VIEWS)) {
  const root = $(v);
  root.addEventListener("click", e => {
    const el = e.target.closest("[data-act]");
    if (!el || !root.contains(el)) return;
    if (el.tagName === "A") e.preventDefault();
    const fn = ACTS[el.dataset.act];
    if (!fn) return;
    if (!/-del$/.test(el.dataset.act)) S.ui.confirm = null;  // 按了別的按鈕就取消「再按一次確定刪除」
    if (fn(el.dataset) !== false) commit();
  });
  root.addEventListener("change", e => {
    const el = e.target, d = el.dataset, v = el.value;
    if (d.ui) { S.ui[d.ui] = v || null; return commit(); }
    if (d.f) {  // 角色欄位
      const c = find(S.chars, S.ui.char), ks = d.f.split(".");
      let val = v;
      if (ks[0] === "lv") val = num(v, 1, 250);
      if (ks[0] === "route" || ks[0] === "build" || ks[0] === "deck") val = v || null;
      if (ks[0] === "name" || ks[0] === "acc") val = v.trim() || (ks[0] === "name" ? "未命名" : "主帳");
      setPath(c, ks, val);
      return commit();
    }
    if (d.rf) { find(S.routes, S.ui.route)[d.rf] = v.trim() || "未命名路線"; return commit(); }
    if (d.sf) {  // 路線的某一段
      const r = find(S.routes, S.ui.route), [i, k] = d.sf.split("."), s = r.steps[+i];
      if (k === "mob") { s.mob = MOB_LABEL.get(v.trim()) ?? DATA.mobs.find(m => m.n === v.trim())?.id ?? null; if (s.mob == null && v.trim()) toast("找不到這隻怪，請從下拉清單選"); }
      else if (k === "note") s.note = v;
      else { s[k] = num(v, 1, 250); sortSteps(r); }
      return commit();
    }
    if (d.bf) {  // 技能配點
      const b = find(S.builds, S.ui.build), ks = d.bf.split(".");
      if (ks[0] === "alloc") { const s = SKILL_BY_ID.get(+ks[1]); const n = num(v, 0, s.max); if (n) b.alloc[ks[1]] = n; else delete b.alloc[ks[1]]; }
      else if (ks[0] === "advLv") (b.advLv ||= {})[ks[1]] = num(v, 1, 200);
      else if (ks[0] === "order") b.order[+ks[1]][+ks[2]] = num(v, ks[2] === "0" ? 0 : 1, ks[2] === "0" ? 1e9 : 30);
      else b[ks[0]] = ks[0] === "name" ? (v.trim() || "未命名配點") : v;
      return commit();
    }
    if (d.gf) {  // 裝備目標
      const [id, k, j] = d.gf.split("."), g = find(S.goals, id);
      if (k === "scroll") { g.scroll = SCROLL_NAME.get(v.trim()) || null; if (!g.scroll && v.trim()) toast("找不到這張卷軸，請從下拉清單選"); }
      else if (k === "extra") g.extra[+j][1] = num(v, 1, 99999);
      else g[k] = v;
      return commit();
    }
    if (d.have) { const c = find(S.chars, S.ui.gearChar); (c.have ||= {})[d.have] = num(v, 0, 999999); return commit(); }
    if (d.exadd) {
      const key = ITEM_NAME.get(v.trim());
      if (!key) { toast("找不到這個道具，請從下拉清單選"); return; }
      (find(S.goals, d.exadd).extra ||= []).push([key, 1]);
      return commit();
    }
  });
}
function setPath(obj, ks, val) {
  let o = obj;
  for (let i = 0; i < ks.length - 1; i++) o = o[ks[i]] ??= (/^\d+$/.test(ks[i + 1]) ? [] : {});
  o[ks.at(-1)] = val;
}
// 在別的分頁或別的視窗改了資料，切回來時重新讀取
window.addEventListener("storage", e => {
  if (e.key !== KEY) return;
  try { S = Object.assign(blank(), JSON.parse(e.newValue || "{}")); } catch (err) {}
  if (current) VIEWS[current]();
});

window.Tracker = {show, addMobToRoute, addGoalFromItem};
showView();
})();
