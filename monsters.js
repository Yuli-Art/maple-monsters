// 怪物查詢（依弱屬／抗屬、掉落物找怪）
const PRESETS = [["冰雷法師","IL"],["火毒法師","FP"],["僧侶・聖","H"]];
const GROUPS = ["裝備","卷軸","消耗","其他"];
const MODE_HINT = {
  weak: "至少弱其中一種選取的屬性。",
  safe: "選取的屬性都不會被抵抗（包含無屬性怪）。適合找「至少打得動」的怪。",
  resist: "至少抗其中一種選取的屬性，用來知道哪些怪要避開。"
};
const DEFAULTS = {els:"IL", mode:"weak", strict:false, lvMin:"", lvMax:"", q:"", item:"", region:"", boss:"all", sort:"lv"};
const KEY = "rm-mob-filter-v1";
let state = {...DEFAULTS};
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY) || "{}")); } catch (e) {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (e) {} };


const mobs = DATA.mobs;
const regionsOf = m => [...new Set(m.m.map(i => DATA.maps[i][1]))];
mobs.forEach(m => { m.rg = regionsOf(m); m.eff = m.hp ? m.exp / m.hp : 0; });

$("src").innerHTML = `資料來源 <a href="https://rebirth-maple.com/zh-tw/gameinfo/monsters" target="_blank" rel="noopener">rebirth-maple.com</a>・${mobs.length} 隻怪物・資料時間 ${esc((DATA.gen || "").slice(0, 10))}`;

// 控制項
$("presets").innerHTML = PRESETS.map(([n, e]) => `<button type="button" class="pill" data-els="${e}">${n}</button>`).join("");
$("elpick").innerHTML = EL.map(([c, n]) => `<button type="button" class="el-btn e-${c}" data-el="${c}" aria-label="${n}屬性">${n}</button>`).join("");
$("region").insertAdjacentHTML("beforeend", DATA.regions.map((r, i) => [r, i]).sort((a, b) => a[0].localeCompare(b[0], "zh-Hant")).map(([r, i]) => `<option value="${i}">${esc(r)}</option>`).join(""));
$("itemList").innerHTML = [...new Set(DATA.items.filter((it, i) => droppersOf(i).length).map(it => it[0]))].map(n => `<option value="${esc(n)}"></option>`).join("");

// 怪物列：每隻只建一次，篩選時只切換顯示與順序
function whereText(m) {
  if (!m.rg.length) return m.b ? "BOSS／特殊地圖" : "出沒地未登錄";
  const names = m.rg.map(i => DATA.regions[i]);
  return names.slice(0, 3).join("・") + (names.length > 3 ? ` 等 ${names.length} 區` : "");
}
const rows = new Map();
for (const m of mobs) {
  const el = document.createElement("article");
  el.className = "mob";
  const els = (m.w ? `<span class="tag">弱</span>${chips(m.w, "w")}` : "") +
              (m.w && m.r ? `<span class="gap"></span>` : "") +
              (m.r ? `<span class="tag">抗</span>${chips(m.r, "r")}` : "") ||
              `<span class="neutral">無屬性</span>`;
  el.innerHTML = `<button type="button" class="row" aria-expanded="false">
      <span class="pic">${m.img ? `<img src="${m.img}" alt="" width="60" height="52">` : ""}</span>
      <span class="who"><span class="nm">${esc(m.n)}${m.b ? `<span class="boss">BOSS</span>` : ""}</span><span class="where">${esc(whereText(m))}</span></span>
      <span class="nums"><span class="lv"><small>LV</small>${m.lv}</span><span><small>HP</small>${fmt(m.hp)}</span><span><small>EXP</small>${fmt(m.exp)}</span></span>
      <span class="els">${els}</span>
    </button><div class="hit"></div><div class="more" hidden></div>`;
  el.querySelector(".row").addEventListener("click", () => toggle(m, el));
  rows.set(m.id, el);
}

let lastTab = "drops";
const icon = i => DATA.items[i][5] ? `<img src="${DATA.items[i][5]}" alt="">` : "";
function toggle(m, el) {
  const more = el.querySelector(".more");
  const open = more.hidden;
  if (open && !more.dataset.built) {
    const tabs = [["drops", "掉落物", m.d.length], ["maps", "出沒地圖", m.m.length], ["info", "怪物資料", null]];
    more.innerHTML = `<div class="tabs" role="tablist">${tabs.map(([k, n, c]) =>
      `<button type="button" role="tab" data-tab="${k}">${n}${c != null ? `<span class="n">${c}</span>` : ""}</button>`).join("")}</div><div class="pane" role="tabpanel"></div>`;
    more.addEventListener("click", e => {
      const t = e.target.closest("[data-tab]"), s = e.target.closest("[data-sub]"), d = e.target.closest("[data-item]");
      if (e.target.closest("[data-route-add]")) window.Tracker.addMobToRoute(m.id);
      else if (d) openItem(+d.dataset.item);
      else if (t) showTab(m, more, t.dataset.tab);
      else if (s) showTab(m, more, "drops", +s.dataset.sub);
    });
    more.dataset.built = "1";
  }
  if (open) showTab(m, more, lastTab);
  more.hidden = !open;
  el.classList.toggle("open", open);
  el.querySelector(".row").setAttribute("aria-expanded", open);
}
function showTab(m, more, tab, sub = -1) {
  lastTab = tab;
  more.querySelectorAll("[data-tab]").forEach(b => b.setAttribute("aria-selected", b.dataset.tab === tab));
  more.querySelector(".pane").innerHTML = tab === "drops" ? dropsPane(m, sub) : tab === "maps" ? mapsPane(m) : infoPane(m);
  markHits(m, more);
}
function dropsPane(m, sub) {
  if (!m.d.length) return `<p class="hint">網站沒有這隻怪的掉落資料。</p>`;
  const counts = [0, 0, 0, 0];
  m.d.forEach(([i]) => counts[DATA.items[i][2]]++);
  const subs = [[-1, "全部", m.d.length], ...GROUPS.map((g, k) => [k, g, counts[k]]).filter(x => x[2])];
  const list = m.d.filter(([i]) => sub < 0 || DATA.items[i][2] === sub);
  return `<div class="subs">${subs.map(([k, g, c]) => `<button type="button" class="pill" data-sub="${k}" aria-pressed="${k === sub}">${g} ${c}</button>`).join("")}</div>
    <ul class="drops">${list.map(([i, p]) => {
      const it = DATA.items[i];
      return `<li data-i="${i}"><button type="button" class="drop" data-item="${i}"><span class="ico">${icon(i)}</span><span class="nm2"><span>${esc(it[0])}</span><span class="t">${esc(it[1])}${it[3] ? `・Lv ${it[3]}` : ""}</span></span><span class="p">${pct(p)}</span></button></li>`;
    }).join("")}</ul>`;
}
function mapsPane(m) {
  if (!m.m.length) return `<p class="hint">網站沒有登錄這隻怪的出沒地圖${m.b ? "（BOSS 通常在特殊地圖召喚）" : ""}。</p>`;
  const byRegion = new Map();
  m.m.forEach(i => { const [name, r] = DATA.maps[i]; if (!byRegion.has(r)) byRegion.set(r, []); byRegion.get(r).push(name); });
  return `<div class="maps">${[...byRegion].map(([r, ns]) => `<div><h4>${esc(DATA.regions[r])}</h4><ul>${ns.map(n => `<li>${esc(n)}</li>`).join("")}</ul></div>`).join("")}</div>`;
}
function infoPane(m) {
  const st = (k, v) => `<div class="stat"><small>${k}</small><b>${v}</b></div>`;
  return `<div class="statgrid">${st("等級", m.lv)}${st("HP", fmt(m.hp))}${st("經驗值", fmt(m.exp))}${st("攻擊", fmt(m.atk))}${st("經驗 / HP", m.eff.toFixed(3))}
    <div class="stat"><small>弱屬性</small><span class="els">${m.w ? chips(m.w, "w") : `<span class="neutral">無</span>`}</span></div>
    <div class="stat"><small>抗屬性</small><span class="els">${m.r ? chips(m.r, "r") : `<span class="neutral">無</span>`}</span></div>
    ${m.b ? st("類型", "BOSS") : ""}</div>
    <div class="acts"><button type="button" class="pill act" data-route-add="${m.id}">＋ 加入練功路線</button></div>`;
}
function markHits(m, more) {
  more.querySelectorAll("li[data-i]").forEach(li => li.classList.toggle("m", itemSet ? itemSet.has(+li.dataset.i) : false));
}

// 道具詳細資料視窗
const STAT = {wAtt:"物理攻擊", mAtt:"魔法攻擊", Str:"力量", Dex:"敏捷", Int:"智力", Luk:"幸運", Hp:"MaxHP", Mp:"MaxMP",
  Def:"物理防禦", MDef:"魔法防禦", Acc:"命中率", Eva:"迴避率", Speed:"移動速度", Jump:"跳躍力", AttSpeed:"攻擊速度",
  Knockback:"擊退機率", HpRecover:"HP 回復", MpRecover:"MP 回復", Duration:"持續時間", UpgradeCnt:"可升級次數"};
const REQ = {LEV:"等級", STR:"力量", DEX:"敏捷", INT:"智力", LUK:"幸運", POP:"名聲"};
const JOB = {Warrior:"劍士", Magician:"法師", Archer:"弓箭手", Thief:"盜賊", Pirate:"海盜", Mercedes:"精靈遊俠"};
const SPEED = {2:"極快", 3:"極快", 4:"快速", 5:"快速", 6:"普通", 7:"緩慢", 8:"緩慢", 9:"極慢"};
function statVal(k, v) {
  if (k === "AttSpeed") return `${SPEED[v] || ""}<small>(${v})</small>`;
  if (k === "Knockback") return v + "%";
  if (k === "Duration") return v >= 60 && v % 60 === 0 ? `${v / 60} 分鐘` : `${v} 秒`;
  if (Array.isArray(v)) { const [b, lo, hi] = v; return `${fmt(b)}${lo !== hi ? `<small>(${lo}–${hi})</small>` : ""}`; }
  return fmt(v);
}
function openItem(i) {
  const [name, sub, grp, , , ico, stats, req, jobs, price] = DATA.items[i];
  const st = Object.keys(STAT).filter(k => stats && k in stats);
  const rq = Object.keys(REQ).filter(k => req && req[k]);
  const ranged = st.some(k => Array.isArray(stats[k]) && stats[k][1] !== stats[k][2]);
  const jobText = jobs && jobs.length ? jobs.map(j => JOB[j] || j).join("、") : grp === 0 ? "全職業" : "";
  const list = droppersOf(i);
  const ok = list.filter(([m]) => state.els && matchEl(m)).length;
  $("dlgBody").innerHTML = `
    <div class="dlg-head"><span class="ico">${ico ? `<img src="${ico}" alt="">` : ""}</span>
      <div><h2 id="dlgTitle">${esc(name)}</h2><div class="t">${esc(sub)}${jobText ? `・${jobText}` : ""}</div></div>
      <button type="button" class="x" data-close aria-label="關閉">✕</button></div>
    ${st.length || rq.length ? `<div class="kv">
      ${st.length ? `<div><h3>能力值</h3><dl>${st.map(k => `<dt>${STAT[k]}</dt><dd>${statVal(k, stats[k])}</dd>`).join("")}</dl>
        ${ranged ? `<p class="note">括號內是掉落時數值可能的浮動範圍。</p>` : ""}</div>` : ""}
      ${rq.length ? `<div><h3>穿戴需求</h3><dl>${rq.map(k => `<dt>${REQ[k]}</dt><dd>${fmt(req[k])}</dd>`).join("")}</dl></div>` : ""}
    </div>` : ""}
    ${price ? `<div class="stats">賣給商店：${fmt(price)} 楓幣</div>` : ""}
    ${grp === 0 ? `<div><button type="button" class="pill act" data-goal="${DATA.items[i][12]}">＋ 設為裝備目標</button></div>` : ""}
    <div><h3>掉落這個道具的怪物（${list.length}）</h3>
      ${ok ? `<p class="note" style="margin:0 0 6px">橘底的 ${ok} 隻符合你目前選的屬性條件。</p>` : ""}
      <ul class="who-drops ${state.els ? "has-sel " + [...state.els].map(c => "sel-" + c).join(" ") : ""}">${list.map(([m, p]) => `
        <li class="${state.els && matchEl(m) ? "ok" : ""}"><span class="mi">${m.img ? `<img src="${m.img}" alt="">` : ""}</span>
          <span class="nm3">${esc(m.n)}<span class="lvl">Lv ${m.lv}${m.b ? "・BOSS" : ""}</span></span>
          <span class="els">${m.w || m.r ? chips(m.w, "w") + chips(m.r, "r") : `<span class="neutral">無屬性</span>`}</span>
          <span class="p">${pct(p)}</span></li>`).join("")}</ul></div>`;
  const dlg = $("itemDlg");
  if (!dlg.open) dlg.showModal();
  $("dlgBody").scrollTop = 0;
}
$("itemDlg").addEventListener("click", e => {
  const g = e.target.closest("[data-goal]");
  if (g) { e.currentTarget.close(); window.Tracker.addGoalFromItem(g.dataset.goal); return; }
  if (e.target === e.currentTarget || e.target.closest("[data-close]")) e.currentTarget.close();
});

// 篩選
let itemSet = null;
function buildItemSet() {
  const q = state.item.trim().toLowerCase();
  if (!q) { itemSet = null; return; }
  itemSet = new Set();
  DATA.items.forEach((it, i) => { if (it[0].toLowerCase().includes(q) || it[4].includes(q)) itemSet.add(i); });
}
function matchEl(m) {
  const S = [...state.els];
  if (!S.length) return true;
  const w = S.some(c => m.w.includes(c)), r = S.some(c => m.r.includes(c));
  if (state.mode === "weak") return w && !(state.strict && r);
  if (state.mode === "safe") return !r;
  return r;
}
function render() {
  const q = state.q.trim().toLowerCase();
  const lo = parseInt(state.lvMin) || 0, hi = parseInt(state.lvMax) || Infinity;
  const reg = state.region === "" ? -1 : +state.region;
  const out = [];
  for (const m of mobs) {
    if (m.lv < lo || m.lv > hi) continue;
    if (state.boss === "no" && m.b) continue;
    if (state.boss === "only" && !m.b) continue;
    if (reg >= 0 && !m.rg.includes(reg)) continue;
    if (q && !m.n.toLowerCase().includes(q) && !m.en.includes(q)) continue;
    if (!matchEl(m)) continue;
    let hits = null;
    if (itemSet) { hits = m.d.filter(([i]) => itemSet.has(i)); if (!hits.length) continue; }
    out.push([m, hits]);
  }
  const best = h => h && h.length ? Math.max(...h.map(x => x[1])) : -1;
  const cmp = {
    lv: (a, b) => a[0].lv - b[0].lv || a[0].id - b[0].id,
    lvd: (a, b) => b[0].lv - a[0].lv || a[0].id - b[0].id,
    exp: (a, b) => b[0].exp - a[0].exp,
    eff: (a, b) => b[0].eff - a[0].eff,
    hp: (a, b) => a[0].hp - b[0].hp,
    drop: (a, b) => best(b[1]) - best(a[1]) || a[0].lv - b[0].lv,
  }[state.sort] || ((a, b) => a[0].lv - b[0].lv);
  out.sort(cmp);

  const list = $("list");
  list.className = "list" + (state.els ? " has-sel " + [...state.els].map(c => "sel-" + c).join(" ") : "");
  const frag = document.createDocumentFragment();
  for (const [m, hits] of out) {
    const el = rows.get(m.id);
    el.querySelector(".hit").innerHTML = hits ? hits.slice(0, 6).map(([i, p]) => `<span>${icon(i)}${esc(DATA.items[i][0])}<b>${pct(p)}</b></span>`).join("") + (hits.length > 6 ? `<span>…另 ${hits.length - 6} 項</span>` : "") : "";
    const more = el.querySelector(".more");
    if (more.dataset.built) markHits(m, more);
    frag.appendChild(el);
  }
  list.replaceChildren(frag);
  $("empty").hidden = out.length > 0;
  $("count").innerHTML = `<b>${out.length}</b> / ${mobs.length} 隻`;
  $("desc").textContent = describe();
}
function describe() {
  const parts = [];
  if (state.els) {
    const names = [...state.els].map(c => ELN[c]);
    parts.push(state.mode === "weak" ? "弱" + names.join("或弱") + (state.strict ? "（排除有抗性的）" : "")
      : state.mode === "safe" ? "不抗" + names.join("、") : "抗" + names.join("或抗"));
  }
  if (state.lvMin || state.lvMax) parts.push(`Lv ${state.lvMin || 1}–${state.lvMax || "∞"}`);
  if (state.region !== "") parts.push(DATA.regions[+state.region]);
  if (state.item.trim()) parts.push(`掉「${state.item.trim()}」`);
  if (state.boss === "no") parts.push("不含 BOSS"); else if (state.boss === "only") parts.push("只有 BOSS");
  return parts.join("・");
}

// 同步控制項狀態
function syncControls() {
  document.querySelectorAll("#elpick .el-btn").forEach(b => b.setAttribute("aria-pressed", state.els.includes(b.dataset.el)));
  document.querySelectorAll("#presets .pill").forEach(b => b.setAttribute("aria-pressed", [...b.dataset.els].sort().join("") === [...state.els].sort().join("")));
  document.querySelectorAll("#mode button").forEach(b => b.setAttribute("aria-pressed", b.dataset.v === state.mode));
  $("modeHint").textContent = state.els ? MODE_HINT[state.mode] : "沒有選屬性時會列出全部怪物。";
  $("strictWrap").hidden = !(state.mode === "weak" && state.els.length > 1);
  $("strict").checked = state.strict;
  for (const k of ["item", "q", "lvMin", "lvMax", "region", "boss", "sort"]) if ($(k).value !== String(state[k])) $(k).value = state[k];
}
function update(patch) {
  Object.assign(state, patch);
  if ("item" in patch) buildItemSet();
  if (state.sort === "drop" && !state.item.trim()) state.sort = "lv";
  save(); syncControls(); render();
}

$("presets").addEventListener("click", e => { const b = e.target.closest("[data-els]"); if (b) update({els: b.dataset.els, mode: "weak"}); });
$("elpick").addEventListener("click", e => {
  const b = e.target.closest("[data-el]"); if (!b) return;
  const c = b.dataset.el;
  update({els: state.els.includes(c) ? state.els.replace(c, "") : EL.map(x => x[0]).filter(x => state.els.includes(x) || x === c).join("")});
});
$("mode").addEventListener("click", e => { const b = e.target.closest("[data-v]"); if (b) update({mode: b.dataset.v}); });
$("strict").addEventListener("change", e => update({strict: e.target.checked}));
for (const k of ["item", "q", "lvMin", "lvMax"]) $(k).addEventListener("input", e => update({[k]: e.target.value}));
for (const k of ["region", "boss", "sort"]) $(k).addEventListener("change", e => update({[k]: e.target.value}));
$("reset").addEventListener("click", () => update({...DEFAULTS, els: ""}));

buildItemSet(); syncControls(); render();
