// 共用：遊戲資料、小工具、分頁切換
const DATA = window.DATA;
const EL = [["F","火"],["I","冰"],["L","雷"],["P","毒"],["H","聖"],["D","暗"]];
const ELN = Object.fromEntries(EL);
const $ = id => document.getElementById(id);
const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const fmt = n => Number(n || 0).toLocaleString("en-US");
const pct = p => (p >= 1 ? +p.toFixed(1) : +p.toPrecision(2)) + "%";
function chips(str, kind) { return [...(str || "")].map(c => `<span class="chip ${kind} e-${c}">${ELN[c]}</span>`).join(""); }

// 道具：DATA.items[i] = [名稱, 部位, 大分類, 等級, 英文, 圖示, 能力值, 需求, 職業, 售價, subType, 配方, key]
const ITEM_BY_KEY = new Map(DATA.items.map((it, i) => [it[12], i]));
const MOB_BY_ID = new Map(DATA.mobs.map(m => [m.id, m]));
const SKILL_BY_ID = new Map(DATA.skills.map(s => [s.id, s]));
const itemImg = (i, cls = "") => DATA.items[i] && DATA.items[i][5] ? `<img class="${cls}" src="${DATA.items[i][5]}" alt="" loading="lazy">` : "";

// 哪些怪會掉這個道具（第一次用到才建索引）
let DROP_INDEX = null;
function droppersOf(i) {
  if (!DROP_INDEX) {
    DROP_INDEX = DATA.items.map(() => []);
    DATA.mobs.forEach(m => m.d.forEach(([k, p]) => DROP_INDEX[k].push([m, p])));
    DROP_INDEX.forEach(l => l.sort((a, b) => b[1] - a[1] || a[0].lv - b[0].lv));
  }
  return DROP_INDEX[i] || [];
}

// 上方分頁：#monsters #chars #routes #skills #gear
const VIEWS = ["monsters", "chars", "routes", "skills", "gear"];
function showView() {
  const v = VIEWS.includes(location.hash.slice(1).split("/")[0]) ? location.hash.slice(1).split("/")[0] : "monsters";
  for (const name of VIEWS) $("view-" + name).hidden = name !== v;
  document.querySelectorAll(".navtabs a").forEach(a => a.setAttribute("aria-current", a.dataset.view === v ? "page" : "false"));
  if (v !== "monsters" && window.Tracker) window.Tracker.show(v);
}
window.addEventListener("hashchange", showView);
