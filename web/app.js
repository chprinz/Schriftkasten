/* Schriftkasten – Oberfläche. Kein Build-Schritt, keine Abhängigkeiten. */
(() => {
"use strict";

// ---------- Konstanten ----------
const CATS = {
  sans: "Grotesk / Sans", serif: "Serif / Antiqua", slab: "Slab", display: "Display",
  handwriting: "Schreibschrift", mono: "Monospace", "": "Ohne Zuordnung",
};
const TIERS = {
  solide: ["Solide Basis", "Vollständige Familie mit mehreren Stärken, Umlauten und guter Ausstattung. Für Fließtext, Untertitel, Web."],
  brauchbar: ["Brauchbar", "Ordentlich, aber mit Lücken: wenige Stärken, keine Kursive oder wenig OpenType."],
  charakter: ["Mit Charakter", "Display und Schreibschrift: für Titel, Plakate, Akzente."],
  einfach: ["Einzelschnitte", "Meist nur ein Schnitt, unbekannte Herkunft. Für Spezialfälle."],
  eingeschraenkt: ["Eingeschränkt", "Trial/Demo, nur private Nutzung oder fehlende Umlaute."],
};
const PRESETS = [
  ["Name", null],
  ["Satz", "Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich."],
  ["Titel", "Ein Sommer am Fluss"],
  ["Untertitel", "Ich weiß nicht, ob es morgen noch so aussieht. Aber heute schon."],
  ["ABC", "ABCDEFGHIJKLMNOPQRSTUVWXYZ abcdefghijklmnopqrstuvwxyz ÄÖÜ äöü ß"],
  ["Ziffern", "0123456789 · ½ · € 1.250,00 · 24.10.2026 · 07:45 · 3 × 4 = 12"],
  ["Hamburg", "Hamburgefonstiv"],
];
const PARA = {
  h: "Was bleibt, wenn das Licht geht",
  p: "Am Abend wird es im Tal still. Über dem Fluss liegt noch etwas Licht, die Straße ist leer, irgendwo schlägt eine Tür. Gute Schrift fällt dabei nicht auf: Sie trägt den Text, ohne sich vorzudrängen, und hält auch in kleinen Größen, bei schlechtem Licht und in Bewegung.",
};
const FEAT_NAMES = {
  liga: "Ligaturen", dlig: "Freie Ligaturen", calt: "Kontext-Alternativen", kern: "Unterschneidung",
  tnum: "Tabellenziffern", pnum: "Proportionalziffern", onum: "Mediävalziffern", lnum: "Versalziffern",
  smcp: "Kapitälchen", c2sc: "Versal-Kapitälchen", case: "Versal-Formen", frac: "Brüche", sups: "Hochgestellt",
  subs: "Tiefgestellt", ordn: "Ordinalzeichen", zero: "Null mit Strich", swsh: "Schwungbuchstaben",
  salt: "Alternativen", ss01: "Set 1", ss02: "Set 2", ss03: "Set 3", ss04: "Set 4", ss05: "Set 5",
  ss06: "Set 6", ss07: "Set 7", ss08: "Set 8", cv01: "Var. 1", cv02: "Var. 2", cv03: "Var. 3", cv11: "Var. 11",
};
const FEAT_DEMO = "Office Affiliate 1/2 3/4 · 0123456789 · Effizienz & Zukunft · Österreich 2026";
const ORIGINS = {
  google: ["Google Fonts", "Freie Lizenz (OFL/Apache). Für Kunden, Web und Video ohne Einschränkung."],
  opensource: ["Open Source", "Freie Lizenz (OFL, GPL, GUST u. a.). In der Regel uneingeschränkt nutzbar."],
  adobe: ["Adobe Fonts", "Über das Adobe-Abo lizenziert, solange das Abo läuft. Fürs Web nur über Adobe-Webprojekte."],
  macos: ["macOS", "Kommt mit macOS. Für eigene Dokumente und Videos ok, Weitergabe der Dateien und Web nicht."],
  microsoft: ["Microsoft", "Kommt mit Office/Windows. Nutzung in Dokumenten ok, Weitergabe nicht."],
  commercial: ["Kommerziell", "Kauf- oder Foundry-Schrift. Lizenzumfang prüfen (Desktop, Web, Video)."],
  unknown: ["Aus dem Netz", "Herkunft unklar, meist Free-Font-Seiten. Vor Kundenarbeit die Lizenz prüfen."],
  trial: ["Trial / Demo", "Nur zum Ausprobieren. Nicht für Kundenarbeit."],
};
const SRC_LABEL = { user: "Meine", local: "Alle Benutzer", adobe: "Adobe", fontbase: "FontBase", archiv: "Archiv", system: "System" };

// ---------- Zustand ----------
const LS = {
  get(k, d) { try { const v = localStorage.getItem("sk." + k); return v == null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem("sk." + k, JSON.stringify(v)); } catch {} },
};
const S = {
  view: LS.get("view", "all"),
  q: "",
  preset: LS.get("preset", 1),
  custom: LS.get("custom", ""),
  size: LS.get("size", 44),
  weight: LS.get("weight", "auto"),
  layout: LS.get("layout", "list"),
  canvas: LS.get("canvas", "paper"),
  sort: LS.get("sort", "name"),
  filters: LS.get("filters", {}),
  compare: LS.get("compare", []),
  cmpW: LS.get("cmpW", {}),
  limit: 120,
  open: null,
  dFace: null,
  dFeats: {},
  dAxes: {},
};
let CAT = null, FAMS = [], FACES = {}, BYKEY = {}, UD = null, CUR = { families: {}, collections: [] };
let visible = [];

const $ = (s, el = document) => el.querySelector(s);
const $$ = (s, el = document) => [...el.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const h = (html) => { const t = document.createElement("template"); t.innerHTML = html.trim(); return t.content.firstElementChild; };

// ---------- Server ----------
async function api(path, opts = {}) {
  const r = await fetch(path, {
    method: opts.method || "GET",
    headers: opts.body ? { "Content-Type": "application/json", "X-Schriftkasten": "1" } : { "X-Schriftkasten": "1" },
    body: opts.body ? JSON.stringify(opts.body) : undefined,
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || r.statusText);
  return j;
}
let saveT = null;
function saveUD() {
  clearTimeout(saveT);
  saveT = setTimeout(() => api("/api/userdata", { method: "PUT", body: UD }).catch((e) => toast("Speichern fehlgeschlagen: " + e.message, true)), 500);
}
function toast(msg, bad) {
  const t = h(`<div class="toast${bad ? " bad" : ""}">${esc(msg)}</div>`);
  $("#toasts").append(t);
  setTimeout(() => t.remove(), bad ? 7000 : 3600);
}

// ---------- Schriften laden ----------
const loaded = new Map();
function ffam(id) { return `sk-${id}`; }
function ensureFace(id) {
  if (loaded.has(id)) return loaded.get(id);
  const ff = new FontFace(ffam(id), `url(/font/${id})`);
  const p = ff.load().then((f) => { document.fonts.add(f); return true; }).catch(() => false);
  loaded.set(id, p);
  return p;
}
function applyFace(el, faceId, vs) {
  el.style.fontFamily = `"${ffam(faceId)}", "Adobe NotDef", var(--mono)`;
  el.style.fontVariationSettings = vs || "normal";
  el.style.fontWeight = "normal";
  el.style.fontStyle = "normal";
  const known = loaded.get(faceId);
  if (!known) el.classList.add("loading");
  ensureFace(faceId).then((ok) => {
    el.classList.remove("loading");
    if (!ok) { el.classList.add("broken"); el.title = "Diese Datei lässt sich im Browser nicht darstellen"; }
  });
}

// ---------- Ableitungen ----------
function ud(key) { return UD.families[key] || {}; }
function udSet(key, patch) {
  const cur = { ...ud(key), ...patch };
  Object.keys(cur).forEach((k) => { if (cur[k] === "" || cur[k] == null || (Array.isArray(cur[k]) && !cur[k].length) || cur[k] === 0) delete cur[k]; });
  if (Object.keys(cur).length) UD.families[key] = cur; else delete UD.families[key];
  saveUD();
}
function catOf(f) { return ud(f.key).cat ?? CUR.families[f.key]?.cat ?? f.cat; }
function tagsOf(f) { return [...new Set([...(CUR.families[f.key]?.tags || []), ...(ud(f.key).tags || [])])]; }
function colsOf(key) { return UD.collections.filter((c) => c.items.includes(key)); }

function pickFace(f, mode) {
  const faces = f.faceIds.map((id) => FACES[id]);
  if (mode === "auto") return { id: f.rep };
  if (mode === "i") {
    const it = faces.filter((x) => x.italic).sort((a, b) => Math.abs(a.weight - 400) - Math.abs(b.weight - 400))[0];
    if (it) return { id: it.id };
    const vi = faces.find((x) => x.axes.some((a) => a.tag === "ital" || a.tag === "slnt"));
    if (vi) { const ax = vi.axes.find((a) => a.tag === "ital" || a.tag === "slnt"); return { id: vi.id, vs: `"${ax.tag}" ${ax.tag === "ital" ? 1 : ax.min}` }; }
    return { id: f.rep, miss: true };
  }
  const w = +mode;
  const vf = faces.find((x) => !x.italic && x.axes.some((a) => a.tag === "wght" && a.min <= w && a.max >= w));
  if (vf) return { id: vf.id, vs: `"wght" ${w}` };
  const st = faces.filter((x) => !x.italic && !x.axes.length).sort((a, b) => Math.abs(a.weight - w) - Math.abs(b.weight - w))[0];
  if (st) return { id: st.id, miss: Math.abs(st.weight - w) > 100 };
  return { id: f.rep, miss: true };
}

function sampleText(f) {
  if (S.custom) return S.custom;
  const p = PRESETS[S.preset];
  return p && p[1] ? p[1] : f.name;
}

function matchesQ(f, q) {
  if (!q) return true;
  const hay = [f.name, f.designer, f.foundry, CATS[catOf(f)], ...tagsOf(f), ud(f.key).note, CUR.families[f.key]?.note, ORIGINS[f.origin]?.[0], ...colsOf(f.key).map((c) => c.name), ...f.srcs.map((s) => SRC_LABEL[s])].join(" ").toLowerCase();
  return q.toLowerCase().split(/\s+/).every((t) => hay.includes(t));
}

const FILTERS = [
  ["de", "Umlaute komplett", (f) => f.de],
  ["italic", "Mit Kursiv", (f) => f.italic],
  ["multi", "Ab 4 Stärken", (f) => f.nWeights >= 4],
  ["variable", "Variabel", (f) => f.variable],
  ["notrial", "Ohne Trial/Demo", (f) => !f.trial],
  ["inst", "Nur installiert", (f) => f.installed > 0],
];

function inView(f, v) {
  if (v === "all") return true;
  if (v === "installed") return f.installed > 0;
  if (v === "library") return f.installed === 0;
  if (v === "adobe") return f.srcs.includes("adobe");
  if (v === "google") return f.google;
  if (v.startsWith("origin:")) return f.origin === v.slice(7);
  if (v === "adobe-off") return !!f.adobeOff;
  if (v.startsWith("find:")) { const p = (CUR.profiles || []).find((p) => p.id === v.slice(5)); return p ? p.items.includes(f.key) : false; }
  if (v === "rated") return (ud(f.key).rating || 0) > 0;
  if (v === "noted") return !!ud(f.key).note || (ud(f.key).tags || []).length > 0;
  if (v === "new") return Date.now() / 1000 - f.added < 86400 * 120;
  if (v.startsWith("tier:")) return f.tier === v.slice(5);
  if (v.startsWith("cat:")) return catOf(f) === v.slice(4);
  if (v.startsWith("col:")) { const c = UD.collections.find((c) => c.id === v.slice(4)); return c ? c.items.includes(f.key) : false; }
  if (v.startsWith("tag:")) return tagsOf(f).includes(v.slice(4));
  return true;
}

function compute() {
  const fl = FILTERS.filter(([k]) => S.filters[k]);
  let arr = FAMS.filter((f) => inView(f, S.view) && matchesQ(f, S.q) && fl.every(([, , fn]) => fn(f)));
  const by = {
    name: (a, b) => a.name.localeCompare(b.name, "de"),
    score: (a, b) => b.score - a.score || a.name.localeCompare(b.name),
    styles: (a, b) => b.nStyles - a.nStyles || a.name.localeCompare(b.name),
    added: (a, b) => b.added - a.added,
    rating: (a, b) => (ud(b.key).rating || 0) - (ud(a.key).rating || 0) || b.score - a.score,
    xh: (a, b) => (b.xh || 0) - (a.xh || 0),
  }[S.sort];
  if (S.view.startsWith("find:") && S.sort === "name") {
    const p = (CUR.profiles || []).find((p) => p.id === S.view.slice(5));
    if (p) { arr.sort((a, b) => p.items.indexOf(a.key) - p.items.indexOf(b.key)); return arr; }
  }
  if (S.view.startsWith("col:") && S.sort === "name") {
    const c = UD.collections.find((c) => c.id === S.view.slice(4));
    if (c) { arr.sort((a, b) => c.items.indexOf(a.key) - c.items.indexOf(b.key)); return arr; }
  }
  return arr.sort(by);
}

// ---------- Navigation ----------
const ORIGIN_DOT = { google: "#3f6b3a", opensource: "#6d9a5f", adobe: "#c4321f", macos: "#847e73", microsoft: "#847e73", commercial: "#b07a12", unknown: "#cbc5b9", trial: "#9b2f22" };
let NAVCLOSED = LS.get("navclosed", { stufe: true });
function count(v) { return FAMS.filter((f) => inView(f, v)).length; }
function renderNav() {
  const item = (v, label, opts = {}) => {
    const n = opts.n ?? count(v);
    if (!n && opts.hideEmpty) return "";
    return `<button class="nav-i${S.view === v ? " on" : ""}" data-v="${esc(v)}" title="${esc(opts.title || "")}">${opts.dot ? `<span class="dot" style="background:${opts.dot}"></span>` : ""}${esc(label)}<span class="n">${n}</span></button>`;
  };
  const tagsAll = [...new Set(FAMS.flatMap(tagsOf))].sort((a, b) => a.localeCompare(b, "de"));
  const dupN = FAMS.filter((f) => f.dups.length).length;
  const grp = (id, label, body, extra = "") => {
    const closed = NAVCLOSED[id];
    return `<div class="nav-h nav-t${closed ? " closed" : ""}" data-g="${id}"><span>${label}</span>${extra}</div><div class="nav-g${closed ? " closed" : ""}">${body}</div>`;
  };
  const html = `
    ${grp("bestand", "Bestand", `
      ${item("all", "Alle Familien")}
      ${item("installed", "Installiert")}
      ${item("library", "Nicht aktiv", { hideEmpty: true, title: "Liegt in FontBase oder im Archiv, ist aber nicht installiert" })}
      ${item("new", "Neu (120 Tage)", { hideEmpty: true })}
      ${item("rated", "Bewertet")}`)}
    ${(CUR.profiles || []).length ? grp("find", "Ich suche …", (CUR.profiles || []).map((p) => item("find:" + p.id, p.name, { title: p.desc })).join("")) : ""}
    ${grp("herkunft", "Herkunft & Lizenz", Object.entries(ORIGINS).map(([k, [l, t]]) => item("origin:" + k, l, { title: t, hideEmpty: k !== "adobe", dot: ORIGIN_DOT[k] }) + (k === "adobe" ? item("adobe-off", "Adobe: nicht aktiv", { hideEmpty: true, dot: "transparent", title: "Von Creative Cloud deaktiviert. Bleiben in Sammlungen sichtbar." }) : "")).join(""))}
    ${grp("art", "Art", Object.entries(CATS).map(([k, l]) => item("cat:" + k, l, { hideEmpty: true })).join(""))}
    ${grp("stufe", "Einstufung", Object.entries(TIERS).map(([k, [l, t]]) => item("tier:" + k, l, { title: t })).join(""))}
    <div class="nav-h">Sammlungen <button id="newCol" title="Neue Sammlung">+</button></div>
    ${UD.collections.map((c) => item("col:" + c.id, c.name, { n: c.items.filter((k) => BYKEY[k]).length })).join("") || `<div class="nav-i" style="color:var(--muted)">Noch keine</div>`}
    ${tagsAll.length ? `<div class="nav-h">Tags</div>${tagsAll.map((t) => item("tag:" + t, "#" + t)).join("")}` : ""}
    <div class="nav-h">Werkstatt</div>
    ${item("cleanup", "Aufräumen", { n: dupN + FAMS.filter((f) => f.trial).length + CAT.problems.length })}
    ${item("sources", "Quellen & Einlesen", { n: CAT.sources.filter((s) => s.ok).length })}
    <button class="nav-i" id="quitBtn" title="Beendet den Hintergrunddienst. Startet wieder über das App-Symbol.">Beenden</button>
  `;
  $("#nav").innerHTML = html;
  $$("#nav .nav-t").forEach((hd) => hd.onclick = (e) => {
    if (e.target.closest("button")) return;
    NAVCLOSED[hd.dataset.g] = !NAVCLOSED[hd.dataset.g]; LS.set("navclosed", NAVCLOSED);
    hd.classList.toggle("closed"); hd.nextElementSibling.classList.toggle("closed");
  });
  $$("#nav .nav-i[data-v]").forEach((b) => {
    b.onclick = () => setView(b.dataset.v);
    if (b.dataset.v.startsWith("col:")) {
      b.ondragover = (e) => { e.preventDefault(); b.classList.add("drop"); };
      b.ondragleave = () => b.classList.remove("drop");
      b.ondrop = (e) => { e.preventDefault(); b.classList.remove("drop"); const k = e.dataTransfer.getData("text/sk-key"); if (k) toggleCol(b.dataset.v.slice(4), k, true); };
    }
  });
  $("#quitBtn").onclick = async () => {
    try { await api("/api/quit", { method: "POST", body: {} }); } catch {}
    document.body.innerHTML = `<div class="empty" style="padding-top:30vh">Schriftkasten ist beendet. Dieses Fenster kann zu.<br>Neu starten über das App-Symbol.</div>`;
  };
  const nb = $("#newCol"); if (nb) nb.onclick = (e) => { e.stopPropagation(); newCollection(); };
  const d = new Date(CAT.generated * 1000);
  $("#brandMeta").textContent = `${FAMS.length} Familien · ${d.toLocaleDateString("de-AT")}`;
}
function setView(v) { S.view = v; S.limit = 120; LS.set("view", v); renderNav(); render(); window.scrollTo(0, 0); }

// ---------- Werkzeugleiste ----------
function renderBar() {
  $("#presets").innerHTML = PRESETS.map(([l], i) => `<button data-i="${i}" class="${!S.custom && S.preset === i ? "on" : ""}">${l}</button>`).join("");
  $$("#presets button").forEach((b) => b.onclick = () => { S.preset = +b.dataset.i; S.custom = ""; $("#sample").value = ""; LS.set("preset", S.preset); LS.set("custom", ""); renderBar(); updateSpecs(); });
  $("#filters").innerHTML = FILTERS.map(([k, l]) => `<button class="chip${S.filters[k] ? " on" : ""}" data-k="${k}">${l}</button>`).join("");
  $$("#filters .chip").forEach((b) => b.onclick = () => { S.filters[b.dataset.k] = !S.filters[b.dataset.k]; LS.set("filters", S.filters); renderBar(); render(); });
  $$("#layoutSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.layout));
  $$("#canvasSeg button").forEach((b) => b.classList.toggle("on", b.dataset.v === S.canvas));
  document.body.classList.toggle("night", S.canvas === "night");
}
function wireBar() {
  $("#sample").value = S.custom;
  $("#sample").oninput = (e) => { S.custom = e.target.value; LS.set("custom", S.custom); renderBar(); updateSpecs(); };
  $("#size").value = S.size; $("#sizeOut").textContent = S.size;
  $("#size").oninput = (e) => { S.size = +e.target.value; $("#sizeOut").textContent = S.size; LS.set("size", S.size); $$(".list .spec").forEach((el) => el.style.fontSize = S.size + "px"); };
  $("#weight").value = S.weight;
  $("#weight").onchange = (e) => { S.weight = e.target.value; LS.set("weight", S.weight); render(); };
  $("#sort").value = S.sort;
  $("#sort").onchange = (e) => { S.sort = e.target.value; LS.set("sort", S.sort); render(); };
  let qt; $("#q").oninput = (e) => { clearTimeout(qt); qt = setTimeout(() => { S.q = e.target.value.trim(); S.limit = 120; render(); }, 120); };
  $$("#layoutSeg button").forEach((b) => b.onclick = () => { S.layout = b.dataset.v; LS.set("layout", S.layout); renderBar(); render(); });
  $$("#canvasSeg button").forEach((b) => b.onclick = () => { S.canvas = b.dataset.v; LS.set("canvas", S.canvas); renderBar(); });
}

// ---------- Kopf ----------
function renderHead(n) {
  const v = S.view;
  let title = "Alle Familien", sub = "", tools = "";
  if (v === "installed") { title = "Installiert"; sub = "Alles, was macOS gerade aktiv hat: ~/Library/Fonts, /Library/Fonts und aktivierte Adobe Fonts."; }
  else if (v === "library") { title = "Nicht aktiv"; sub = "Liegt in FontBase oder im Archiv (Installieren kopiert nach ~/Library/Fonts), oder ist ein von Creative Cloud deaktivierter Adobe Font."; }
  else if (v === "origin:adobe") {
    title = "Adobe Fonts";
    const n = count("adobe");
    sub = n ? "Aktivierte Adobe Fonts aus Creative Cloud. Neu aktivierte Schriften erscheinen nach „Neu einlesen“." : "Keine aktivierten Adobe Fonts gefunden. Creative Cloud aktiviert sie lokal, danach hier „Neu einlesen“.";
    tools = `<a class="btn" href="https://fonts.adobe.com/my_fonts#active_fonts" target="_blank" rel="noopener">Meine Adobe Fonts</a><a class="btn" href="https://fonts.adobe.com/fonts" target="_blank" rel="noopener">Adobe Fonts durchsuchen</a><button class="btn" data-act="rescan">Neu einlesen</button>`;
  }
  else if (v === "adobe-off") {
    title = "Adobe: nicht aktiv";
    sub = "Diese Adobe Fonts hat Creative Cloud deaktiviert. Bewertungen, Notizen und Sammlungen bleiben erhalten. Nach dem Aktivieren bei Adobe hier „Neu einlesen“.";
    tools = `<a class="btn" href="https://fonts.adobe.com/my_fonts#active_fonts" target="_blank" rel="noopener">Meine Adobe Fonts</a><button class="btn primary" data-act="rescan">Neu einlesen</button>`;
  }
  else if (v.startsWith("origin:")) { [title, sub] = ORIGINS[v.slice(7)] || ["", ""]; }
  else if (v.startsWith("find:")) {
    const p = (CUR.profiles || []).find((p) => p.id === v.slice(5));
    if (p) { title = p.name; sub = p.desc + " Sortierung nach Name zeigt die kuratierte Reihenfolge."; tools = `<button class="btn" data-act="toCol">Als Sammlung übernehmen</button>`; }
  }
  else if (v === "google") { title = "Google Fonts"; sub = "Familien, die auch bei Google Fonts liegen. Freie Lizenz (meist OFL), fürs Web direkt einbindbar."; }
  else if (v === "rated") title = "Bewertet";
  else if (v === "new") { title = "Neu hinzugefügt"; sub = "Dateien, die in den letzten 120 Tagen dazugekommen sind."; }
  else if (v.startsWith("tier:")) { [title, sub] = TIERS[v.slice(5)]; }
  else if (v.startsWith("cat:")) { title = CATS[v.slice(4)]; if (!v.slice(4)) sub = "Hier fehlt die Zuordnung. Im Detail unter „Meine Notizen“ lässt sie sich setzen."; }
  else if (v.startsWith("tag:")) title = "#" + v.slice(4);
  else if (v.startsWith("col:")) {
    const c = UD.collections.find((c) => c.id === v.slice(4));
    if (c) {
      $("#head").innerHTML = `<div style="flex:1;min-width:280px"><h1><input class="head-edit" id="colName" value="${esc(c.name)}"></h1>
        <input class="head-edit sub" id="colDesc" placeholder="Beschreibung, wofür diese Sammlung gedacht ist …" value="${esc(c.desc || "")}"></div>
        <div class="tools"><span class="tag">${n} Familien</span><button class="btn" data-act="copyNames">Namen kopieren</button><button class="btn" data-act="compareCol">Alle vergleichen</button><button class="btn" data-act="fontbook" title="Legt diese Sammlung in der Mac-Schriftsammlung (Font Book) an oder aktualisiert sie">An Schriftsammlung</button><button class="btn warn" data-act="delCol">Löschen</button></div>`;
      $("#colName").onchange = (e) => { c.name = e.target.value.trim() || c.name; saveUD(); renderNav(); };
      $("#colDesc").onchange = (e) => { c.desc = e.target.value.trim(); saveUD(); };
      wireHeadActs(c);
      return;
    }
  }
  if (v.startsWith("origin:") || v.startsWith("find:") || v.startsWith("tag:")) tools += `<button class="btn" data-act="fontbook" title="Legt diese Liste in der Mac-Schriftsammlung (Font Book) an oder aktualisiert sie">An Schriftsammlung</button>`;
  $("#head").innerHTML = `<div><h1>${esc(title)}</h1>${sub ? `<div class="sub">${esc(sub)}</div>` : ""}</div><div class="tools"><span class="tag">${n} Familien</span>${tools}</div>`;
  wireHeadActs();
}
function wireHeadActs(c) {
  $$("#head [data-act]").forEach((b) => b.onclick = async () => {
    const a = b.dataset.act;
    if (a === "rescan") return rescan(b);
    if (a === "copyNames") { await navigator.clipboard.writeText(visible.map((f) => f.name).join("\n")); toast("Namen kopiert"); }
    if (a === "compareCol") { S.compare = visible.map((f) => f.key); LS.set("compare", S.compare); renderTray(); openCompare(); }
    if (a === "fontbook") return toFontBook(c ? c.name : $("#head h1").textContent, b);
    if (a === "toCol") {
      const p = (CUR.profiles || []).find((p) => p.id === S.view.slice(5));
      const nc = { id: uid(), name: p.name, desc: p.desc, items: visible.map((f) => f.key) };
      UD.collections.push(nc); saveUD(); setView("col:" + nc.id); toast(`Sammlung „${nc.name}“ angelegt`); return;
    }
    if (a === "delCol" && c) { if (!confirm(`Sammlung „${c.name}“ löschen? Die Schriften bleiben unberührt.`)) return; UD.collections = UD.collections.filter((x) => x !== c); saveUD(); setView("all"); }
  });
}

// ---------- Liste ----------
let io = null;
function render() {
  if (S.view === "cleanup") return renderCleanup();
  if (S.view === "sources") return renderSources();
  visible = compute();
  renderHead(visible.length);
  const list = $("#list");
  list.className = "list " + (S.layout === "list" ? "" : S.layout);
  list.innerHTML = "";
  if (!visible.length) { list.innerHTML = `<div class="empty">Nichts gefunden. Filter oder Suche lockern.</div>`; return; }
  appendRows(0, Math.min(S.limit, visible.length));
}
function appendRows(from, to) {
  const list = $("#list");
  const frag = document.createDocumentFragment();
  for (let i = from; i < to; i++) frag.append(row(visible[i]));
  $(".more", list)?.remove();
  list.append(frag);
  if (to < visible.length) list.append(h(`<div class="more">${to} von ${visible.length} · weiter scrollen</div>`));
}
function moreRows() {
  const shown = $$("#list .fam").length;
  if (shown >= visible.length || S.view === "cleanup" || S.view === "sources") return;
  const to = Math.min(shown + 120, visible.length);
  S.limit = to;
  appendRows(shown, to);
}

function metaTags(f) {
  const t = [];
  const T = TIERS[f.tier];
  t.push(`<span class="tag t-${f.tier}" title="${esc(T[1])}">${esc(T[0])}</span>`);
  const c = catOf(f); if (c) t.push(`<span class="tag">${esc(CATS[c])}</span>`);
  t.push(`<span class="tag" title="Schnitte / Stärken">${f.nStyles} ${f.nStyles === 1 ? "Schnitt" : "Schnitte"}</span>`);
  if (f.variable) t.push(`<span class="tag" title="Variable Font">Var</span>`);
  if (f.italic) t.push(`<span class="tag">Kursiv</span>`);
  if (!f.de) t.push(`<span class="tag warn" title="ä ö ü ß fehlen in mindestens einem Schnitt">ohne Umlaute</span>`);
  if (f.trial) t.push(`<span class="tag warn">Trial/Demo</span>`);
  if (f.dups.length) t.push(`<span class="tag warn" title="Gleiche Schnitte liegen mehrfach installiert">doppelt</span>`);
  const O = ORIGINS[f.origin];
  if (O && f.origin !== "trial") t.push(`<span class="tag o-${f.origin}" title="${esc(O[1])}">${esc(O[0])}</span>`);
  if (f.adobeOff) t.push(`<span class="tag warn" title="Creative Cloud hat diese Schrift deaktiviert.${esc(seenText(f))}">Adobe: nicht aktiv</span>`);
  else t.push(f.installed ? `<span class="tag inst" title="installiert">✓ aktiv</span>` : `<span class="tag notinst" title="nicht installiert">nicht aktiv</span>`);
  tagsOf(f).forEach((x) => t.push(`<span class="tag user">#${esc(x)}</span>`));
  return t.join("");
}
function stars(f) {
  const r = ud(f.key).rating || 0;
  return `<span class="stars" title="Bewertung">${[1, 2, 3].map((i) => `<button data-r="${i}" class="${i <= r ? "on" : ""}">★</button>`).join("")}</span>`;
}
function adobeLink(f) {
  return f.adobeUrl ? `https://fonts.adobe.com/fonts/${encodeURIComponent(f.adobeUrl)}` : `https://fonts.adobe.com/search?query=${encodeURIComponent(f.name)}`;
}
function seenText(f) {
  return f.lastSeen ? ` Zuletzt aktiv am ${new Date(f.lastSeen * 1000).toLocaleDateString("de-AT")}.` : "";
}
function ghostRow(f) {
  const el = h(`<article class="fam ghost" data-key="${esc(f.key)}">
    <div class="fam-top">
      <button class="fam-name">${esc(f.name)}</button>
      <span class="meta">${metaTags(f)}</span>
      <span class="acts" style="opacity:1">
        ${stars(f)}
        <button class="ib${colsOf(f.key).length ? " on" : ""}" data-a="col" title="Zu Sammlung">${colsOf(f.key).length ? "◆" : "◇"}</button>
      </span>
    </div>
    <div class="ghost-body">Von Creative Cloud deaktiviert, keine Vorschau möglich.${esc(seenText(f))}
      <a class="btn" href="${adobeLink(f)}" target="_blank" rel="noopener">Bei Adobe wieder aktivieren</a></div>
  </article>`);
  $(".fam-name", el).onclick = () => openDrawer(f.key);
  $("[data-a=col]", el).onclick = (e) => colMenu(e.currentTarget, f.key);
  $$(".stars button", el).forEach((b) => b.onclick = () => { const r = +b.dataset.r; udSet(f.key, { rating: (ud(f.key).rating || 0) === r ? 0 : r }); refreshRow(f.key); renderNav(); });
  return el;
}
function row(f) {
  if (f.ghost) return ghostRow(f);
  const pf = pickFace(f, S.weight);
  const inCmp = S.compare.includes(f.key);
  const el = h(`<article class="fam" data-key="${esc(f.key)}" draggable="true">
    <div class="fam-top">
      <button class="fam-name">${esc(f.name)}</button>
      <span class="meta">${metaTags(f)}</span>
      <span class="acts">
        ${stars(f)}
        <button class="ib${colsOf(f.key).length ? " on" : ""}" data-a="col" title="Zu Sammlung">${colsOf(f.key).length ? "◆" : "◇"}</button>
        <button class="ib${inCmp ? " on" : ""}" data-a="cmp" title="Zum Vergleich">⊕</button>
        <button class="ib" data-a="open" title="Details">→</button>
      </span>
    </div>
    <div class="spec" spellcheck="false"></div>
    <div class="fam-sub">${esc(CATS[catOf(f)])} · ${f.nStyles} Schnitte${f.installed ? "" : " · nicht aktiv"}</div>
  </article>`);
  const sp = $(".spec", el);
  fillSpec(sp, f);
  sp.style.fontSize = S.size + "px";
  if (pf.miss) sp.title = "Diesen Schnitt gibt es in der Familie nicht, gezeigt wird der nächstliegende";
  el._face = pf;
  io.observe(el);
  $(".fam-name", el).onclick = () => openDrawer(f.key);
  $("[data-a=open]", el).onclick = () => openDrawer(f.key);
  $("[data-a=cmp]", el).onclick = (e) => { toggleCompare(f.key); e.currentTarget.classList.toggle("on", S.compare.includes(f.key)); };
  $("[data-a=col]", el).onclick = (e) => colMenu(e.currentTarget, f.key);
  $$(".stars button", el).forEach((b) => b.onclick = () => { const r = +b.dataset.r; udSet(f.key, { rating: (ud(f.key).rating || 0) === r ? 0 : r }); refreshRow(f.key); renderNav(); });
  sp.ondblclick = () => openDrawer(f.key);
  el.ondragstart = (e) => { e.dataTransfer.setData("text/sk-key", f.key); e.dataTransfer.effectAllowed = "copy"; };
  return el;
}
function fillSpec(sp, f) {
  const txt = sampleText(f);
  if (S.layout === "para") sp.innerHTML = `<span class="ph">${esc(S.custom || PRESETS[S.preset][1] || PARA.h)}</span>${esc(PARA.p)}`;
  else sp.textContent = S.layout === "grid" && !S.custom ? "Aa" : txt;
}
function updateSpecs() { $$(".list .fam").forEach((el) => fillSpec($(".spec", el), BYKEY[el.dataset.key])); }
function refreshRow(key) {
  const old = $(`#list .fam[data-key="${CSS.escape(key)}"]`);
  if (old) { const n = row(BYKEY[key]); old.replaceWith(n); }
}
function setupIO() {
  io = new IntersectionObserver((entries) => {
    for (const e of entries) {
      if (!e.isIntersecting) continue;
      const el = e.target; io.unobserve(el);
      if (el._face) applyFace($(".spec", el), el._face.id, el._face.vs);
    }
  }, { rootMargin: "900px 0px" });
  new IntersectionObserver((es) => { if (es[0].isIntersecting) moreRows(); }, { rootMargin: "1200px 0px" }).observe($("#sentinel"));
}

// ---------- Sammlungen ----------
function uid() { return Math.random().toString(36).slice(2, 9); }
function newCollection(addKey) {
  const name = prompt("Name der neuen Sammlung:", addKey ? "" : "");
  if (!name || !name.trim()) return null;
  const c = { id: uid(), name: name.trim(), desc: "", items: addKey ? [addKey] : [] };
  UD.collections.push(c); saveUD(); renderNav();
  toast(`Sammlung „${c.name}“ angelegt`);
  return c;
}
function toggleCol(cid, key, forceAdd) {
  const c = UD.collections.find((c) => c.id === cid); if (!c) return;
  const has = c.items.includes(key);
  if (has && !forceAdd) c.items = c.items.filter((k) => k !== key);
  else if (!has) c.items.push(key);
  saveUD(); renderNav(); refreshRow(key);
  if (forceAdd && !has) toast(`${BYKEY[key].name} → ${c.name}`);
  if (S.open === key) renderDrawer();
}
function colMenu(anchor, key) {
  const pop = $("#pop");
  const draw = () => {
    pop.innerHTML = `${UD.collections.map((c) => `<button class="pop-i" data-c="${c.id}"><span class="ck">${c.items.includes(key) ? "✓" : ""}</span>${esc(c.name)}</button>`).join("")}
      ${UD.collections.length ? `<div class="pop-sep"></div>` : ""}
      <input placeholder="Neue Sammlung, Enter" id="popNew">`;
    $$(".pop-i", pop).forEach((b) => b.onclick = () => { toggleCol(b.dataset.c, key); draw(); });
    $("#popNew").onkeydown = (e) => {
      if (e.key === "Enter" && e.target.value.trim()) {
        UD.collections.push({ id: uid(), name: e.target.value.trim(), desc: "", items: [key] });
        saveUD(); renderNav(); refreshRow(key); draw();
      }
    };
  };
  draw();
  const r = anchor.getBoundingClientRect();
  pop.style.top = Math.min(r.bottom + 6, innerHeight - 320) + "px";
  pop.style.left = Math.max(8, Math.min(r.right - 240, innerWidth - 260)) + "px";
  pop.classList.add("on");
  setTimeout(() => $("#popNew")?.focus(), 0);
}
document.addEventListener("mousedown", (e) => { if (!e.target.closest("#pop") && !e.target.closest("[data-a=col]")) $("#pop").classList.remove("on"); });

// ---------- Vergleich ----------
function toggleCompare(key) {
  S.compare = S.compare.includes(key) ? S.compare.filter((k) => k !== key) : [...S.compare, key];
  LS.set("compare", S.compare); renderTray();
}
function renderTray() {
  const t = $("#tray");
  S.compare = S.compare.filter((k) => BYKEY[k]);
  if (!S.compare.length) { t.classList.remove("on"); return; }
  t.innerHTML = `${S.compare.map((k) => `<span class="pin">${esc(BYKEY[k].name)}<button data-k="${esc(k)}">×</button></span>`).join("")}<button class="btn" id="cmpGo">Vergleichen</button><button class="btn" id="cmpClr">Leeren</button>`;
  t.classList.add("on");
  $$(".pin button", t).forEach((b) => b.onclick = () => { toggleCompare(b.dataset.k); refreshRow(b.dataset.k); });
  $("#cmpGo").onclick = openCompare;
  $("#cmpClr").onclick = () => { const ks = S.compare; S.compare = []; LS.set("compare", []); renderTray(); ks.forEach(refreshRow); };
}
let cmpView = LS.get("cmpView", "zeilen"); // zeilen | kacheln | absatz
let cmpCols = LS.get("cmpCols", 3);
let cmpSz = 44;
let cmpText = null; // im Vergleich getippter Text, gilt auch fürs Deck
const WNAMES = { 100: "Thin", 200: "ExtraLight", 300: "Light", 400: "Regular", 500: "Medium", 600: "SemiBold", 700: "Bold", 800: "ExtraBold", 900: "Black" };
const cmpFams = () => S.compare.map((k) => BYKEY[k]).filter((f) => f && !f.ghost);
const cmpTxt = () => cmpText || S.custom || PRESETS[S.preset][1] || "Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich.";

// Welche Stärken gibt es bei dieser Familie wirklich?
function weightOptions(f) {
  const set = new Set(); let ital = false;
  for (const id of f.faceIds) {
    const x = FACES[id];
    if (x.italic) { ital = true; continue; }
    const ax = x.axes.find((a) => a.tag === "wght");
    if (ax) { for (let w = 100; w <= 900; w += 100) if (w >= ax.min && w <= ax.max) set.add(w); }
    else set.add(x.weight);
    if (x.axes.some((a) => a.tag === "ital" || a.tag === "slnt")) ital = true;
  }
  return { ws: [...set].sort((a, b) => a - b), ital };
}
function setCmpW(key, v) {
  if (!v) delete S.cmpW[key]; else S.cmpW[key] = v;
  LS.set("cmpW", S.cmpW);
}
function wselHtml(f) {
  const cur = String(S.cmpW[f.key] ?? "");
  const { ws, ital } = weightOptions(f);
  const opt = (v, t) => `<option value="${v}"${cur === String(v) ? " selected" : ""}>${t}</option>`;
  return `<select class="wsel" data-k="${esc(f.key)}" title="${cmpView === "absatz" ? "Schnitt der Überschrift" : "Schnitt dieser Schrift"}">${opt("", "Standard")}${ws.map((w) => opt(w, WNAMES[w] ? `${WNAMES[w]} ${w}` : w)).join("")}${ital ? opt("i", "Kursiv") : ""}</select>`;
}
function faceLabel(pf) {
  const m = /"wght" (\d+)/.exec(pf.vs || "");
  if (m) return `${WNAMES[+m[1]] || ""} ${m[1]}`.trim();
  if (/"(ital|slnt)"/.test(pf.vs || "")) return "Kursiv";
  const x = FACES[pf.id];
  if (!x) return "";
  return `${WNAMES[x.weight] ? WNAMES[x.weight] + " " : ""}${x.weight}${x.italic ? " Kursiv" : ""}`;
}

function openCompare() {
  const o = $("#compare");
  cmpSz = S.size;
  o.innerHTML = `<div class="cmp-bar"><b>Vergleich</b><span class="tag" id="cmpCount"></span>
      <div class="seg" id="cmpViews">${[["zeilen", "Zeilen"], ["kacheln", "Kacheln"], ["absatz", "Titel + Absatz"]].map(([v, t]) => `<button data-m="${v}">${t}</button>`).join("")}</div>
      <div class="ctl" id="cmpSizeCtl"><span class="lbl">Größe</span><input type="range" min="14" max="140" value="${cmpSz}" id="cmpSize"></div>
      <div class="ctl" id="cmpColsCtl"><span class="lbl">Spalten</span><div class="seg" id="cmpColsSeg">${[1, 2, 3, 4, 5].map((n) => `<button data-c="${n}">${n}</button>`).join("")}</div></div>
      <div class="ctl"><span class="lbl">Schnitt für alle</span><select id="cmpAll"><option value="__">wählen …</option><option value="">Standard</option>${[100, 200, 300, 400, 500, 600, 700, 800, 900].map((w) => `<option value="${w}">${WNAMES[w]} ${w}</option>`).join("")}<option value="i">Kursiv</option></select></div>
      <div class="spacer"></div>
      <div class="seg" id="cmpCanvas"><button data-v="paper">Hell</button><button data-v="night">Dunkel</button></div>
      <button class="btn primary" id="cmpDeck" title="Aus diesem Vergleich ein Deck bauen, am Bildschirm zeigen oder als PDF sichern">Als Deck …</button>
      <button class="btn" id="cmpClose">Schließen (Esc)</button></div>
    <div id="cmpBody"></div>`;
  const sync = () => {
    $$("#cmpViews button", o).forEach((b) => b.classList.toggle("on", b.dataset.m === cmpView));
    $$("#cmpColsSeg button", o).forEach((b) => b.classList.toggle("on", +b.dataset.c === cmpCols));
    $$("#cmpCanvas button", o).forEach((b) => b.classList.toggle("on", b.dataset.v === S.canvas));
    $("#cmpSizeCtl").style.display = cmpView === "absatz" ? "none" : "";
    $("#cmpColsCtl").style.display = cmpView === "kacheln" ? "" : "none";
  };
  $$("#cmpViews button", o).forEach((b) => b.onclick = () => { cmpView = b.dataset.m; LS.set("cmpView", cmpView); sync(); renderCmpBody(); });
  $$("#cmpColsSeg button", o).forEach((b) => b.onclick = () => { cmpCols = +b.dataset.c; LS.set("cmpCols", cmpCols); sync(); renderCmpBody(); });
  $$("#cmpCanvas button", o).forEach((b) => b.onclick = () => { S.canvas = b.dataset.v; LS.set("canvas", S.canvas); renderBar(); sync(); });
  $("#cmpSize").oninput = (e) => { cmpSz = +e.target.value; $$("#cmpBody .spec", o).forEach((el) => el.style.fontSize = cmpSz + "px"); };
  $("#cmpAll").onchange = (e) => {
    const v = e.target.value; e.target.value = "__";
    if (v === "__") return;
    for (const f of cmpFams()) {
      if (!v) { setCmpW(f.key, ""); continue; }
      const { ws, ital } = weightOptions(f);
      if (v === "i") { if (ital) setCmpW(f.key, "i"); continue; }
      if (!ws.length) continue;
      setCmpW(f.key, String(ws.reduce((a, b) => Math.abs(b - v) < Math.abs(a - v) ? b : a)));
    }
    renderCmpBody();
  };
  $("#cmpDeck").onclick = openDeck;
  $("#cmpClose").onclick = closeCompare;
  sync();
  renderCmpBody();
  o.classList.add("on");
}

function renderCmpBody() {
  const fams = cmpFams();
  if (!fams.length) return closeCompare();
  $("#cmpCount").textContent = `${fams.length} ${fams.length === 1 ? "Familie" : "Familien"}`;
  const txt = cmpTxt();
  const X = (f) => `<button class="ib cmp-x" data-x="${esc(f.key)}" title="Aus dem Vergleich nehmen">×</button>`;
  const NAME = (f) => `<button class="fam-name" data-k="${esc(f.key)}">${esc(f.name)}</button>`;
  let html;
  if (cmpView === "zeilen") {
    html = `<div class="cmp-grid">${fams.map((f) => { const pf = pickFace(f, S.cmpW[f.key] ?? S.weight); return `<div class="cmp-row"><div class="fam-top">${NAME(f)}<span class="meta">${metaTags(f)}</span><span class="spacer"></span>${wselHtml(f)}${X(f)}</div><div class="spec" contenteditable spellcheck="false" data-face="${pf.id}" data-vs="${esc(pf.vs || "")}" style="font-size:${cmpSz}px">${esc(txt)}</div></div>`; }).join("")}</div>`;
  } else if (cmpView === "kacheln") {
    html = `<div class="cmp-tiles" style="--cols:${cmpCols}">${fams.map((f) => { const pf = pickFace(f, S.cmpW[f.key] ?? S.weight); return `<div class="cmp-tile"><div class="tile-cap">${NAME(f)}<span class="spacer"></span>${wselHtml(f)}${X(f)}</div><div class="spec" contenteditable spellcheck="false" data-face="${pf.id}" data-vs="${esc(pf.vs || "")}" style="font-size:${cmpSz}px">${esc(txt)}</div></div>`; }).join("")}</div>`;
  } else {
    html = `<div class="cmp-cols">${fams.map((f) => { const pf = pickFace(f, "auto"); const bold = pickFace(f, S.cmpW[f.key] ?? 700); return `<div class="cmp-col"><div class="tile-cap">${NAME(f)}<span class="spacer"></span>${wselHtml(f)}${X(f)}</div><h3 data-face="${bold.id}" data-vs="${esc(bold.vs || "")}">${esc(S.custom || PARA.h)}</h3><p data-face="${pf.id}">${esc(PARA.p)}</p></div>`; }).join("")}</div>`;
  }
  const body = $("#cmpBody");
  body.innerHTML = html;
  $$("[data-face]", body).forEach((el) => applyFace(el, el.dataset.face, el.dataset.vs));
  $$(".wsel", body).forEach((s) => s.onchange = () => { setCmpW(s.dataset.k, s.value); renderCmpBody(); });
  $$(".cmp-x", body).forEach((b) => b.onclick = () => { const k = b.dataset.x; toggleCompare(k); refreshRow(k); renderCmpBody(); });
  $$(".fam-name", body).forEach((b) => b.onclick = () => { closeCompare(); openDrawer(b.dataset.k); });
  const eds = $$(".spec[contenteditable]", body);
  eds.forEach((el) => el.oninput = () => { cmpText = el.textContent; eds.forEach((x) => { if (x !== el) x.textContent = cmpText; }); });
}

// ---------- Deck ----------
const deckOpts = { theme: LS.get("deckTheme", "paper"), overview: LS.get("deckOv", true), singles: LS.get("deckSingles", true) };
let deckIdx = 0, deckN = 0;

function deckSlides() {
  const fams = cmpFams();
  const txt = cmpTxt();
  const date = new Date().toLocaleDateString("de-DE", { day: "numeric", month: "long", year: "numeric" });
  const info = (f) => {
    const m = S.cmpW[f.key] ?? S.weight;
    const pf = pickFace(f, m);
    return { pf, label: faceLabel(pf) };
  };
  const fa = (pf) => `data-face="${pf.id}" data-vs="${esc(pf.vs || "")}"`;
  const out = [];
  out.push(`<section class="slide s-title"><div class="sl-in">
    <div class="sl-k">Schriftvergleich</div>
    <div class="grow"></div>
    <h1>${fams.length} ${fams.length === 1 ? "Schrift" : "Schriften"} im Vergleich</h1>
    <div class="names">${fams.map((f) => { const { pf } = info(f); return `<span ${fa(pf)}>${esc(f.name)}</span>`; }).join("")}</div>
    <div class="grow"></div>
    <div class="sl-foot"><span>Schriftkasten</span><span>${esc(date)}</span></div></div></section>`);
  if (deckOpts.overview) {
    const per = 6;
    const pages = Math.ceil(fams.length / per);
    for (let p = 0; p < pages; p++) {
      const chunk = fams.slice(p * per, p * per + per);
      const c = Math.min(3, chunk.length), r = Math.ceil(chunk.length / c);
      const sz = (txt.length > 60 ? 3 : txt.length > 30 ? 3.6 : 4.4) * (r === 1 ? 1.35 : 1);
      out.push(`<section class="slide s-ov"><div class="sl-in">
        <div class="sl-k">Übersicht${pages > 1 ? ` ${p + 1} / ${pages}` : ""}</div>
        <div class="ov-grid" style="--c:${c};--r:${r}">${chunk.map((f) => { const { pf, label } = info(f); return `<div class="ov-tile"><div class="ov-cap"><b>${esc(f.name)}</b><span>${esc(label)}</span></div><div class="ov-s" ${fa(pf)} style="font-size:${sz}cqw">${esc(txt)}</div></div>`; }).join("")}</div></div></section>`);
    }
  }
  if (deckOpts.singles) {
    fams.forEach((f, i) => {
      const { pf, label } = info(f);
      const n = f.name.length;
      const ns = n > 22 ? 5.2 : n > 15 ? 6.8 : n > 10 ? 8.2 : 9.6;
      const c = CATS[catOf(f)];
      out.push(`<section class="slide s-one"><div class="sl-in">
        <div class="one-top"><span>${String(i + 1).padStart(2, "0")} / ${String(fams.length).padStart(2, "0")}</span><span>${[label, c, `${f.nStyles} ${f.nStyles === 1 ? "Schnitt" : "Schnitte"}`].filter(Boolean).map(esc).join(" · ")}</span></div>
        <div class="one-name" ${fa(pf)} style="font-size:${ns}cqw">${esc(f.name)}</div>
        <div class="one-line" ${fa(pf)}>${esc(txt)}</div>
        <div class="one-bot"><div class="one-p" ${fa(pf)}>${esc(PARA.p)}</div><div class="one-abc" ${fa(pf)}>ABCDEFGHIJKLMNOPQRSTUVWXYZ<br>abcdefghijklmnopqrstuvwxyz<br>ÄÖÜ äöü ß &amp; 0123456789 € ?!</div></div></div></section>`);
    });
  }
  return out;
}

function renderDeck() {
  const d = $("#deck");
  d.dataset.t = deckOpts.theme;
  const slides = deckSlides();
  deckN = slides.length;
  deckIdx = Math.max(0, Math.min(deckIdx, deckN - 1));
  d.innerHTML = `<div class="deck-bar">
      <button class="btn" id="dkPrev" title="Zurück (←)">‹</button><span class="cnt" id="dkCnt"></span><button class="btn" id="dkNext" title="Weiter (→)">›</button>
      <div class="seg" id="dkTheme"><button data-v="paper">Hell</button><button data-v="night">Dunkel</button></div>
      <label><input type="checkbox" id="dkOv"${deckOpts.overview ? " checked" : ""}> Übersicht</label>
      <label><input type="checkbox" id="dkOne"${deckOpts.singles ? " checked" : ""}> Einzelfolien</label>
      <span class="hint">Schnitte und Text kommen aus dem Vergleich.</span>
      <div class="spacer"></div>
      <button class="btn primary" id="dkPrint" title="Öffnet den Druckdialog. Dort „Als PDF sichern“ wählen.">Als PDF sichern</button>
      <button class="btn" id="dkClose">Schließen (Esc)</button></div>
    <div class="deck-stage" id="dkStage">${slides.join("")}</div>`;
  $$("[data-face]", d).forEach((el) => applyFace(el, el.dataset.face, el.dataset.vs));
  $$("#dkTheme button", d).forEach((b) => { b.classList.toggle("on", b.dataset.v === deckOpts.theme); b.onclick = () => { deckOpts.theme = b.dataset.v; LS.set("deckTheme", deckOpts.theme); renderDeck(); }; });
  const opt = (id, key, other) => $(id, d).onchange = (e) => {
    deckOpts[key] = e.target.checked;
    if (!deckOpts.overview && !deckOpts.singles) deckOpts[other] = true;
    LS.set("deckOv", deckOpts.overview); LS.set("deckSingles", deckOpts.singles);
    renderDeck();
  };
  opt("#dkOv", "overview", "singles");
  opt("#dkOne", "singles", "overview");
  $("#dkPrev").onclick = () => deckGo(-1);
  $("#dkNext").onclick = () => deckGo(1);
  $("#dkPrint").onclick = () => window.print();
  $("#dkClose").onclick = closeDeck;
  $("#dkStage").onclick = (e) => { if (e.target.closest(".slide")) deckGo(e.clientX > innerWidth / 2 ? 1 : -1); };
  deckShow();
}
function deckShow() {
  $$("#dkStage .slide").forEach((s, i) => s.classList.toggle("cur", i === deckIdx));
  $("#dkCnt").textContent = `${deckIdx + 1} / ${deckN}`;
  $("#dkPrev").disabled = deckIdx === 0;
  $("#dkNext").disabled = deckIdx === deckN - 1;
}
function deckGo(d) { deckIdx = Math.max(0, Math.min(deckN - 1, deckIdx + d)); deckShow(); }
function openDeck() { deckIdx = 0; renderDeck(); $("#deck").classList.add("on"); document.body.classList.add("deck-open"); }
function closeDeck() { $("#deck").classList.remove("on"); document.body.classList.remove("deck-open"); }
const deckOn = () => $("#deck").classList.contains("on");

function closeCompare() { closeDeck(); cmpText = null; $("#compare").classList.remove("on"); }

// ---------- Detailansicht ----------
function openDrawer(key) {
  S.open = key; S.dFace = null; S.dFeats = {}; S.dAxes = {};
  renderDrawer();
  $("#drawer").classList.add("on"); $("#scrim").classList.add("on");
  $("#drawer").scrollTop = 0;
}
function closeDrawer() { S.open = null; $("#drawer").classList.remove("on"); $("#scrim").classList.remove("on"); }
function stepDrawer(d) {
  const i = visible.findIndex((f) => f.key === S.open);
  const n = visible[i + d]; if (n) openDrawer(n.key);
}
function fontsUrl(f) {
  const t = [];
  if (f.google) t.push(`<a class="btn" target="_blank" rel="noopener" href="https://fonts.google.com/specimen/${encodeURIComponent(f.name).replace(/%20/g, "+")}">Google Fonts</a>`);
  if (f.adobeUrl) t.push(`<a class="btn" target="_blank" rel="noopener" href="https://fonts.adobe.com/fonts/${encodeURIComponent(f.adobeUrl)}">Adobe Fonts</a>`);
  else if (f.srcs.includes("adobe")) t.push(`<a class="btn" target="_blank" rel="noopener" href="https://fonts.adobe.com/search?query=${encodeURIComponent(f.name)}">Adobe Fonts</a>`);
  if (!f.google && !f.srcs.includes("adobe")) t.push(`<a class="btn" target="_blank" rel="noopener" href="https://www.google.com/search?q=${encodeURIComponent('"' + f.name + '" font license')}">Lizenz suchen</a>`);
  return t.join("");
}
function featString() { return Object.entries(S.dFeats).filter(([, v]) => v).map(([k]) => `"${k}" 1`).join(", ") || "normal"; }
function axisStart(a) {
  if (a.tag === "wght") return Math.min(Math.max(400, a.min), a.max);
  return a.def;
}
function axesString(face) {
  // nur gesetzte Achsen schreiben; opsz bleibt automatisch, wght startet bei Regular
  const parts = face.axes.filter((a) => a.tag in S.dAxes || a.tag === "wght").map((a) => `"${a.tag}" ${S.dAxes[a.tag] ?? axisStart(a)}`);
  return parts.length ? parts.join(", ") : "";
}
function relatedHtml(f) {
  const pairs = (f.pairs || []).filter((k) => BYKEY[k] && !BYKEY[k].ghost);
  const sim = (f.similar || []).filter((k) => BYKEY[k] && !BYKEY[k].ghost);
  if (!pairs.length && !sim.length) return "";
  const own = CUR.families[f.key]?.pairs || [];
  const isText = ["serif", "slab"].includes(catOf(f));
  const pairCard = (k) => {
    const o = BYKEY[k];
    // Titel in der Schrift mit mehr Ausdruck, Text in der ruhigeren
    const fTitle = ["display", "handwriting"].includes(catOf(f)) || isText ? f : o;
    const fText = fTitle === f ? o : f;
    const tb = pickFace(fTitle, ["display", "handwriting"].includes(catOf(fTitle)) ? "auto" : 600);
    const tr = pickFace(fText, 400);
    return `<button class="pair" data-rel="${esc(k)}" title="${esc(o.name)} öffnen">
      <span class="pair-t" data-face="${tb.id}" data-vs="${esc(tb.vs || "")}">${esc(S.custom || "Ein Sommer am Fluss")}</span>
      <span class="pair-p" data-face="${tr.id}" data-vs="${esc(tr.vs || "")}">Am Abend wird es im Tal still. Über dem Fluss liegt noch etwas Licht, die Straße ist leer.</span>
      <span class="pair-n">${esc(fTitle.name)} + ${esc(fText.name)}${own.includes(k) ? " · kuratiert" : ""}${o.installed ? "" : " · nicht aktiv"}</span>
    </button>`;
  };
  return `${pairs.length ? `<div class="sec"><div class="sec-h">Passt dazu</div><div class="pairs">${pairs.slice(0, 3).map(pairCard).join("")}</div></div>` : ""}
    ${sim.length ? `<div class="sec"><div class="sec-h">Ähnlich in deinem Bestand</div><div class="sims">${sim.map((k) => { const o = BYKEY[k]; return `<button class="sim" data-rel="${esc(k)}"><span class="sim-s" data-face="${o.rep}">${esc(o.name)}</span><span class="sim-m">${esc(CATS[catOf(o)] || "")} · ${o.nStyles} Schn.${o.installed ? "" : " · nicht aktiv"}</span></button>`; }).join("")}</div></div>` : ""}`;
}
function renderGhostDrawer(f) {
  const u = ud(f.key);
  const el = $("#drawerIn");
  el.innerHTML = `<div class="d-head"><div><h2 class="d-title">${esc(f.name)}</h2>
      <div class="d-by">${esc([f.designer, f.foundry].filter(Boolean).join(" · ") || "Adobe Fonts")}</div>
      ${CUR.families[f.key]?.note ? `<div class="d-by" style="color:var(--ink-2);max-width:60ch">${esc(CUR.families[f.key].note)}</div>` : ""}
      <div class="meta" style="margin-top:8px">${metaTags(f)}</div></div>
      <div class="d-nav"><button class="ib" data-d="-1">‹</button><button class="ib" data-d="1">›</button><button class="ib" id="dClose">✕</button></div></div>
    <div class="ghost-body" style="margin-top:18px">Creative Cloud hat diese Familie deaktiviert, deshalb gibt es gerade keine Vorschau.${esc(seenText(f))}
      Bewertung, Notizen und Sammlungen bleiben erhalten. Nach dem Aktivieren bei Adobe im Schriftkasten „Neu einlesen“.</div>
    <div class="acts" style="opacity:1;margin:12px 0 0;justify-content:flex-start;gap:8px">${stars(f)}
      <a class="btn primary" href="${adobeLink(f)}" target="_blank" rel="noopener">Bei Adobe wieder aktivieren</a>
      <button class="btn" data-x="rescan">Neu einlesen</button></div>
    <div class="sec"><div class="sec-h">Meine Notizen</div><div class="mine">
      <label><span class="lbl">Notiz</span><textarea id="mNote">${esc(u.note || "")}</textarea></label>
      <label><span class="lbl">Sammlungen</span><div class="colchecks">${UD.collections.map((c) => `<button class="chip${c.items.includes(f.key) ? " on" : ""}" data-col="${c.id}">${esc(c.name)}</button>`).join("")}</div></label>
    </div></div>`;
  $("#dClose").onclick = closeDrawer;
  $$("[data-d]", el).forEach((b) => b.onclick = () => stepDrawer(+b.dataset.d));
  $$(".stars button", el).forEach((b) => b.onclick = () => { const r = +b.dataset.r; udSet(f.key, { rating: (u.rating || 0) === r ? 0 : r }); renderDrawer(); refreshRow(f.key); });
  $("#mNote").onchange = (e) => udSet(f.key, { note: e.target.value.trim() });
  $$("[data-col]", el).forEach((b) => b.onclick = () => toggleCol(b.dataset.col, f.key));
  $("[data-x=rescan]", el).onclick = (e) => rescan(e.currentTarget);
}
function renderDrawer() {
  const f = BYKEY[S.open]; if (!f) return closeDrawer();
  if (f.ghost) return renderGhostDrawer(f);
  const faces = f.faceIds.map((id) => FACES[id]);
  const face = FACES[S.dFace] || FACES[f.rep];
  S.dFace = face.id;
  const u = ud(f.key);
  const txt = S.custom || PRESETS[S.preset][1] || f.name;
  const feats = face.features.filter((x) => FEAT_NAMES[x] && !["kern", "calt", "liga"].includes(x));
  const glyphChecks = [
    ["ÄÖÜ äöü ß", face.de, "Umlaute & ß"],
    ["ẞ", face.capSharpS, "Großes ẞ"],
    ["„Gänse“ ‚so‘ »so«", face.quotesDe, "Deutsche Anführungen"],
    ["€ 1.234,56", face.euro, "Euro"],
    ["ŁŚŽčřů", face.latinExt >= .9, `Latin Ext ${Math.round(face.latinExt * 100)} %`],
    ["Жизнь", face.cyrillic, "Kyrillisch"],
    ["Ελλάδα", face.greek, "Griechisch"],
  ];
  const srcFaces = {};
  faces.forEach((x) => (srcFaces[x.src + ":" + x.rel] = x));
  const dupIds = new Set(f.dups.flat());
  const el = $("#drawerIn");
  el.innerHTML = `
    <div class="d-head">
      <div>
        <h2 class="d-title">${esc(f.name)}</h2>
        <div class="d-by">${esc([f.designer, f.foundry].filter(Boolean).filter((v, i, a) => a.indexOf(v) === i).join(" · ") || "Gestalter unbekannt")}</div>
        ${CUR.families[f.key]?.note ? `<div class="d-by" style="color:var(--ink-2);max-width:60ch">${esc(CUR.families[f.key].note)}</div>` : ""}
        <div class="meta" style="margin-top:8px">${metaTags(f)}</div>
      </div>
      <div class="d-nav">
        <button class="ib" data-d="-1" title="Vorherige (←)">‹</button>
        <button class="ib" data-d="1" title="Nächste (→)">›</button>
        <button class="ib" id="dClose" title="Schließen (Esc)">✕</button>
      </div>
    </div>
    <div class="d-hero" id="dHero" contenteditable spellcheck="false">${esc(txt)}</div>
    <div class="acts" style="opacity:1;margin:6px 0 0;justify-content:flex-start;gap:8px">
      ${stars(f)}
      <button class="btn" data-x="col">${colsOf(f.key).length ? "◆ " + esc(colsOf(f.key).map((c) => c.name).join(", ")) : "◇ Zu Sammlung"}</button>
      <button class="btn" data-x="cmp">${S.compare.includes(f.key) ? "Im Vergleich ✓" : "⊕ Vergleichen"}</button>
      ${f.adobeOff ? `<a class="btn primary" href="${adobeLink(f)}" target="_blank" rel="noopener">Bei Adobe wieder aktivieren</a>` : f.installed < f.nStyles ? `<button class="btn primary" data-x="install">Installieren</button>` : ""}
      <button class="btn" data-x="reveal">Im Finder zeigen</button>
      ${fontsUrl(f)}
    </div>

    ${relatedHtml(f)}

    <div class="sec"><div class="sec-h">Schnitte (${faces.length})</div><div class="styles">
      ${faces.map((x) => `<div class="st${x.id === face.id ? " on" : ""}" data-f="${x.id}">
        <div class="st-l">${esc(x.style)}<small>${x.axes.length ? "variabel " + x.axes.map((a) => a.tag).join(" ") : x.weight}${x.italic ? " · kursiv" : ""}</small></div>
        <div class="st-s" data-face="${x.id}">${esc(txt)}</div>
        <div class="st-r">${x.fmt}${x.installed ? "" : " · nicht aktiv"}${dupIds.has(x.id) ? ` · <span style="color:var(--bad)">doppelt</span>` : ""}</div>
      </div>`).join("")}
    </div></div>

    ${face.axes.length ? `<div class="sec"><div class="sec-h">Variable Achsen · ${esc(face.style)}</div><div class="axes">
      ${face.axes.map((a) => `<label class="axis"><span>${a.tag}</span><input type="range" min="${a.min}" max="${a.max}" step="${a.max - a.min > 20 ? 1 : 0.1}" value="${S.dAxes[a.tag] ?? axisStart(a)}" data-ax="${a.tag}"><output>${S.dAxes[a.tag] ?? (a.tag === "opsz" ? "auto" : axisStart(a))}</output></label>`).join("")}
      ${face.instances.length ? `<div class="feats">${face.instances.map((i, n) => `<button class="chip" data-inst="${n}">${esc(i.name)}</button>`).join("")}</div>` : ""}
    </div></div>` : ""}

    <div class="sec"><div class="sec-h">Wasserfall · ${esc(face.style)}</div><div class="water" id="dWater">
      ${[12, 14, 16, 20, 24, 32, 48, 72, 96].map((s) => `<div style="font-size:${s}px"><span>${s}</span>${esc(txt)}</div>`).join("")}
    </div></div>

    <div class="sec"><div class="sec-h">Zeichen-Check</div><div class="glyphs">
      ${glyphChecks.map(([g, ok, l]) => `<div class="gc${ok ? "" : " miss"}"><b class="dface">${esc(g)}</b><small>${ok ? "✓" : "✕ fehlt"} ${esc(l)}</small></div>`).join("")}
    </div>
    <div class="charset dface" style="margin-top:12px">AÄBCDEFGHIJKLMNOÖPQRSTUÜVWXYZ<br>aäbcdefghijklmnoöpqrsßtuüvwxyz<br>0123456789 &amp;@#%‰ ?!¿¡ ()[]{} –—… •·</div></div>

    ${feats.length ? `<div class="sec"><div class="sec-h">OpenType-Funktionen</div>
      <div class="feats">${feats.map((x) => `<button class="chip${S.dFeats[x] ? " on" : ""}" data-ft="${x}" title="${x}">${esc(FEAT_NAMES[x])}</button>`).join("")}</div>
      <div class="feat-demo dface" id="dFeat" contenteditable spellcheck="false">${esc(FEAT_DEMO)}</div></div>` : ""}

    <div class="sec"><div class="sec-h">Titel + Absatz</div>
      <div class="para-demo"><h3 class="dface-b">${esc(S.custom || PARA.h)}</h3><p class="dface-r">${esc(PARA.p)}</p><p class="dface-r" style="font-size:13px;opacity:.85">${esc(PARA.p)}</p></div></div>

    <div class="sec"><div class="sec-h">Meine Notizen</div><div class="mine">
      <label><span class="lbl">Art</span><select id="mCat">${Object.entries(CATS).map(([k, l]) => `<option value="${k}" ${catOf(f) === k ? "selected" : ""}>${esc(l)}</option>`).join("")}</select></label>
      <label><span class="lbl">Tags</span><input type="text" id="mTags" placeholder="z. B. untertitel, web, titel-film" value="${esc((u.tags || []).join(", "))}"></label>
      <label><span class="lbl">Notiz</span><textarea id="mNote" placeholder="Wofür gut, wofür nicht, wo schon verwendet …">${esc(u.note || "")}</textarea></label>
      <label><span class="lbl">Sammlungen</span><div class="colchecks">${UD.collections.map((c) => `<button class="chip${c.items.includes(f.key) ? " on" : ""}" data-col="${c.id}">${esc(c.name)}</button>`).join("")}<button class="chip" data-col="+">+ Neue</button></div></label>
    </div></div>

    <div class="sec"><div class="sec-h">Infos</div>
      <dl class="kv">
        <dt>Version</dt><dd>${esc(face.version || "–")}</dd>
        <dt>Herkunft</dt><dd>${esc(ORIGINS[f.origin]?.[0] || "unbekannt")} <span style="color:var(--muted)">· ${esc(ORIGINS[f.origin]?.[1] || "")}</span></dd>
        <dt>Lizenz</dt><dd>${esc(f.lic.join(", ") || "unbekannt")}${f.trial ? ` <span class="tag warn">Trial/Demo</span>` : ""}</dd>
        <dt>Stärken</dt><dd>${f.wmin}–${f.wmax}${f.variable ? " (variabel)" : ""}</dd>
        <dt>Zeichen</dt><dd>${Math.max(...faces.map((x) => x.glyphs))} Glyphen${f.xh ? ` · x-Höhe ${Math.round(f.xh * 100)} %` : ""}</dd>
        <dt>Qualität</dt><dd>${f.score} / 100</dd>
        ${f.gfYear ? `<dt>Google Fonts</dt><dd>seit ${esc(f.gfYear)}</dd>` : ""}
        <dt>Dateien</dt><dd><ul class="files" style="margin:0;padding:0;list-style:none">${Object.values(srcFaces).map((x) => `<li><span>${esc(SRC_LABEL[x.src] || x.src)} · ${esc(x.rel)}</span><span>${(x.size / 1024).toFixed(0)} kB</span></li>`).join("")}</ul></dd>
      </dl>
      ${face.license ? `<div class="lic" style="margin-top:10px">${esc(face.license)}</div>` : ""}
      ${face.licenseUrl ? `<div style="margin-top:6px;font-size:12px"><a href="${esc(face.licenseUrl.startsWith("http") ? face.licenseUrl : "https://" + face.licenseUrl)}" target="_blank" rel="noopener">${esc(face.licenseUrl)}</a></div>` : ""}
    </div>`;

  // Schriften anwenden
  const vs = axesString(face);
  ["#dHero"].forEach((s) => applyFace($(s, el), face.id, vs));
  $$(".dface, #dWater div", el).forEach((x) => applyFace(x, face.id, vs));
  $$("[data-face]", el).forEach((x) => applyFace(x, x.dataset.face, "vs" in x.dataset ? x.dataset.vs : (axesString(FACES[x.dataset.face]) || undefined)));
  const bold = pickFace(f, 700), reg = pickFace(f, 400);
  $$(".dface-b", el).forEach((x) => applyFace(x, bold.id, bold.vs));
  $$(".dface-r", el).forEach((x) => applyFace(x, reg.id, reg.vs));
  const fs = featString();
  $$(".dface", el).forEach((x) => (x.style.fontFeatureSettings = fs));

  // Ereignisse
  $$("[data-rel]", el).forEach((b) => b.onclick = () => openDrawer(b.dataset.rel));
  $("#dClose").onclick = closeDrawer;
  $$("[data-d]", el).forEach((b) => b.onclick = () => stepDrawer(+b.dataset.d));
  $$(".st", el).forEach((r) => r.onclick = () => { S.dFace = r.dataset.f; S.dAxes = {}; renderDrawer(); });
  $("#dHero").oninput = (e) => $$(".st-s, #dWater div", el).forEach((x) => { const sp = x.querySelector("span"); x.textContent = e.target.textContent; if (sp) x.prepend(sp); });
  $$("[data-ax]", el).forEach((r) => r.oninput = () => {
    S.dAxes[r.dataset.ax] = +r.value; r.nextElementSibling.textContent = r.value;
    const v = axesString(face);
    $$(".dface, #dWater div, #dHero", el).forEach((x) => (x.style.fontVariationSettings = v));
  });
  $$("[data-inst]", el).forEach((b) => b.onclick = () => { Object.assign(S.dAxes, face.instances[+b.dataset.inst].coords); renderDrawer(); });
  $$("[data-ft]", el).forEach((b) => b.onclick = () => { S.dFeats[b.dataset.ft] = !S.dFeats[b.dataset.ft]; b.classList.toggle("on"); const v = featString(); $$(".dface, #dHero", el).forEach((x) => (x.style.fontFeatureSettings = v)); });
  $$(".stars button", el).forEach((b) => b.onclick = () => { const r = +b.dataset.r; udSet(f.key, { rating: (u.rating || 0) === r ? 0 : r }); renderDrawer(); refreshRow(f.key); renderNav(); });
  $("[data-x=col]", el).onclick = (e) => colMenu(e.currentTarget, f.key);
  $("[data-x=cmp]", el).onclick = () => { toggleCompare(f.key); renderDrawer(); refreshRow(f.key); };
  $("[data-x=reveal]", el).onclick = () => api("/api/reveal", { method: "POST", body: { faceId: face.id } }).catch((e) => toast(e.message, true));
  const ib = $("[data-x=install]", el);
  if (ib) ib.onclick = () => installFaces(faces.filter((x) => !x.installed).map((x) => x.id), ib);
  $("#mCat").onchange = (e) => { udSet(f.key, { cat: e.target.value === f.cat ? undefined : e.target.value }); renderNav(); refreshRow(f.key); };
  $("#mTags").onchange = (e) => { udSet(f.key, { tags: e.target.value.split(",").map((t) => t.trim().toLowerCase().replace(/^#/, "")).filter(Boolean) }); renderNav(); refreshRow(f.key); };
  $("#mNote").onchange = (e) => udSet(f.key, { note: e.target.value.trim() });
  $$("[data-col]", el).forEach((b) => b.onclick = () => {
    if (b.dataset.col === "+") { newCollection(f.key); renderDrawer(); refreshRow(f.key); return; }
    toggleCol(b.dataset.col, f.key);
  });
}

// ---------- Aktionen ----------
async function rescan(btn) {
  if (btn) { btn.disabled = true; btn.textContent = "Liest ein …"; }
  try {
    const r = await api("/api/rescan", { method: "POST", body: {} });
    await reload();
    toast("Neu eingelesen\n" + (r.log || "").split("\n").filter((l) => l.startsWith("Fertig")).join(""));
  } catch (e) { toast("Einlesen fehlgeschlagen: " + e.message, true); }
  if (btn) { btn.disabled = false; btn.textContent = "Neu einlesen"; }
}
async function installFaces(ids, btn) {
  if (!ids.length) return;
  if (btn) { btn.disabled = true; btn.textContent = "Installiere …"; }
  try {
    const r = await api("/api/install", { method: "POST", body: { faceIds: ids } });
    await reload();
    toast(`${r.installed.length} Datei(en) installiert` + (r.skipped.length ? `, ${r.skipped.length} übersprungen` : ""));
  } catch (e) { toast(e.message, true); }
}
async function archiveFaces(ids, label) {
  if (!ids.length) return;
  if (!confirm(`${ids.length} Datei(en) aus ~/Library/Fonts ins Archiv verschieben?\n\n${label || ""}\n\nNichts wird gelöscht. Aus dem Archiv lässt sich alles mit „Installieren“ zurückholen.`)) return;
  try {
    const r = await api("/api/archive", { method: "POST", body: { faceIds: ids } });
    await reload();
    toast(`${r.archived.length} Datei(en) nach ${r.archiveDir} verschoben` + (r.skipped.length ? `, ${r.skipped.length} übersprungen` : ""));
  } catch (e) { toast(e.message, true); }
}

async function toFontBook(name, btn) {
  const c = S.view.startsWith("col:") ? UD.collections.find((x) => x.id === S.view.slice(4)) : null;
  const list = c ? c.items.map((k) => BYKEY[k]).filter(Boolean) : visible;
  const ps = [...new Set(list.flatMap((f) => f.ps || []))];
  if (!ps.length) return toast("Keine installierten Schriften in dieser Liste.", true);
  if (btn) { btn.disabled = true; btn.textContent = "Übergebe …"; }
  try {
    const r = await api("/api/fontbook", { method: "POST", body: { name, ps } });
    toast(`„${r.name}“ in der Schriftsammlung: ${r.count} Schnitte` + (r.note ? "\n" + r.note : ""));
  } catch (e) { toast("Übergabe fehlgeschlagen: " + e.message, true); }
  if (btn) { btn.disabled = false; btn.textContent = "An Schriftsammlung"; }
}

// ---------- Werkstatt: Aufräumen ----------
function keepRank(x) {
  // bevorzugt: installiert, neuere Version, mehr Glyphen, dann OTF vor TTF
  const v = parseFloat(((x.version || "0").split(";")[0]).replace(/[^\d.]/g, "")) || 0;
  return [x.installed ? 0 : 1, -v, -x.glyphs, { otf: 0, ttf: 1, ttc: 2 }[x.fmt] ?? 3];
}
function cmpRank(a, b) { const A = keepRank(a), B = keepRank(b); for (let i = 0; i < A.length; i++) if (A[i] !== B[i]) return A[i] - B[i]; return 0; }
function dupPlan(f) {
  const drop = [];
  const groups = f.dups.map((g) => {
    const fs = g.map((id) => FACES[id]).sort(cmpRank);
    fs.slice(1).filter((x) => x.src === "user").forEach((x) => drop.push(x.id));
    return fs;
  });
  return { groups, drop };
}
function renderCleanup() {
  renderHead(0);
  $("#head").innerHTML = `<div><h1>Aufräumen</h1><div class="sub">Vorschläge, keine Automatik. Aussortieren verschiebt Dateien aus ~/Library/Fonts in ein Archiv-Verzeichnis, gelöscht wird nichts.</div></div>`;
  const dups = FAMS.filter((f) => f.dups.length).map((f) => ({ f, ...dupPlan(f) }));
  const allDrop = dups.flatMap((d) => d.drop);
  const trials = FAMS.filter((f) => f.trial);
  const noDe = FAMS.filter((f) => !f.de && !f.trial);
  const list = $("#list"); list.className = "list";
  list.innerHTML = `
    <div class="panel"><div class="panel-h"><div><h2>Doppelt installiert · ${dups.length} Familien</h2><p>Gleicher Schnitt in mehreren Dateien (oft OTF und TTF nebeneinander). Das verwirrt Programme wie Premiere oder DaVinci: welche Version gerade benutzt wird, ist Zufall.</p></div>
      ${allDrop.length ? `<button class="btn primary" data-act="dupAll">Alle Überzähligen aussortieren (${allDrop.length})</button>` : ""}</div>
      <div class="rows">${dups.map(({ f, groups, drop }) => `<div class="row"><div><button class="fam-name" data-k="${esc(f.key)}">${esc(f.name)}</button><div class="lbl" style="margin-top:3px">${groups.length} Schnitte doppelt</div></div>
        <ul class="files">${groups.slice(0, 4).map((g) => g.map((x, i) => `<li><span class="${i === 0 ? "keep" : drop.includes(x.id) ? "drop" : ""}">${i === 0 ? "behalten" : "weg"} · ${esc(x.rel)}</span><span>${x.fmt} ${esc(x.version)}</span></li>`).join("")).join("")}${groups.length > 4 ? `<li style="color:var(--muted)">… und ${groups.length - 4} weitere Schnitte nach demselben Muster</li>` : ""}</ul>
        ${drop.length ? `<button class="btn" data-drop="${drop.join(",")}" data-n="${esc(f.name)}">Aussortieren (${drop.length})</button>` : `<span></span>`}</div>`).join("") || `<div class="row">Keine Doppelten.</div>`}</div></div>

    <div class="panel"><div class="panel-h"><div><h2>Trial, Demo, nur privat · ${trials.length}</h2><p>Für Kundenarbeit meist nicht freigegeben. Behalten, wenn du sie nur zum Ausprobieren brauchst.</p></div></div>
      <div class="rows">${trials.map((f) => { const ids = f.faceIds.filter((id) => FACES[id].src === "user"); return `<div class="row"><div><button class="fam-name" data-k="${esc(f.key)}">${esc(f.name)}</button></div><div class="lbl">${esc(f.faceIds.map((id) => FACES[id].rel).slice(0, 3).join(" · "))}</div>${ids.length ? `<button class="btn" data-drop="${ids.join(",")}" data-n="${esc(f.name)}">Aussortieren</button>` : "<span></span>"}</div>`; }).join("") || `<div class="row">Keine.</div>`}</div></div>

    <div class="panel"><div class="panel-h"><div><h2>Ohne vollständige Umlaute · ${noDe.length}</h2><p>Bei deutschem Text fallen ä, ö, ü oder ß auf eine Ersatzschrift zurück. Für Titel ohne Umlaute trotzdem nutzbar.</p></div></div>
      <div class="rows">${noDe.map((f) => `<div class="row"><div><button class="fam-name" data-k="${esc(f.key)}">${esc(f.name)}</button></div><div class="lbl">${esc(CATS[catOf(f)])} · ${f.nStyles} Schnitte</div><span></span></div>`).join("") || `<div class="row">Keine.</div>`}</div></div>

    <div class="panel"><div class="panel-h"><div><h2>Nicht lesbar oder veraltet · ${CAT.problems.length}</h2><p>Dateien, die sich nicht öffnen lassen, oder alte Formate (EOT, Type 1).</p></div></div>
      <div class="rows">${CAT.problems.map((p) => `<div class="row"><div class="lbl">${esc(SRC_LABEL[p.src] || p.src)}</div><div>${esc(p.rel)}<div class="lbl" style="text-transform:none">${esc(p.issue)}</div></div><span></span></div>`).join("") || `<div class="row">Alles lesbar.</div>`}</div></div>
  `;
  $$("#list .fam-name").forEach((b) => b.onclick = () => openDrawer(b.dataset.k));
  $$("#list [data-drop]").forEach((b) => b.onclick = () => archiveFaces(b.dataset.drop.split(","), b.dataset.n));
  const all = $("#list [data-act=dupAll]");
  if (all) all.onclick = () => archiveFaces(allDrop, `Doppelte aus ${dups.length} Familien. Behalten wird jeweils die neueste Version, bei Gleichstand die OTF.`);
}

// ---------- Werkstatt: Quellen ----------
function renderSources() {
  $("#head").innerHTML = `<div><h1>Quellen & Einlesen</h1><div class="sub">Zuletzt eingelesen: ${new Date(CAT.generated * 1000).toLocaleString("de-AT")}</div></div><div class="tools"><button class="btn primary" data-act="rescan">Neu einlesen</button></div>`;
  wireHeadActs();
  const list = $("#list"); list.className = "list";
  list.innerHTML = `<div class="panel"><table class="srcs"><tr><th>Quelle</th><th>Ordner</th><th>Status</th><th>Dateien</th><th>Schnitte</th></tr>
    ${CAT.sources.map((s) => `<tr><td>${esc(s.label)}</td><td><code style="font:11.5px var(--mono)">${esc(s.path)}</code></td><td>${s.ok ? (s.installed ? "installiert" : "Bibliothek") : `<span style="color:var(--muted)">nicht gefunden</span>`}</td><td>${s.files ?? 0}</td><td>${s.faces ?? 0}</td></tr>`).join("")}
  </table></div>
  <div class="panel"><div class="panel-h"><h2>So kommt alles hier herein</h2></div><div style="padding:14px 16px" class="note">
    <p><b>Installierte Schriften</b> aus <code>~/Library/Fonts</code> und <code>/Library/Fonts</code> werden bei jedem Einlesen erfasst. Neue Dateien erscheinen nach „Neu einlesen“.</p>
    <p><b>Adobe Fonts</b>: Creative Cloud legt aktivierte Schriften in einem versteckten Ordner ab (<code>~/Library/Application Support/Adobe/CoreSync/plugins/livetype</code>). Der wird mitgelesen. Wer in Creative Cloud oder auf fonts.adobe.com eine Familie aktiviert oder deaktiviert, sieht das hier nach dem nächsten Einlesen. Deine Adobe-Favoriten und Web-Projekte liegen nur online und lassen sich von hier aus nicht abrufen.</p>
    <p><b>FontBase</b>: Der Bibliotheksordner <code>~/FontBase</code> wird als „nicht aktiv“ gelesen. Installieren kopiert eine Datei nach <code>~/Library/Fonts</code>.</p>
    <p><b>Weitere Ordner</b>, etwa eine Sammlung auf einer externen Platte, in <code>config.json</code> unter <code>extraSources</code> eintragen. Systemschriften von macOS kommen mit <code>"includeSystem": true</code> dazu.</p>
    <p><b>Deine Daten</b> (Sammlungen, Bewertungen, Tags, Notizen) liegen in <code>data/userdata.json</code>, daneben eine Sicherung <code>userdata.bak.json</code>.</p>
  </div></div>`;
}

// ---------- Tastatur ----------
document.addEventListener("keydown", (e) => {
  const typing = e.target.closest("input, textarea, select, [contenteditable]");
  if (deckOn() && !e.metaKey && !e.ctrlKey) {
    if (e.key === "Escape") return closeDeck();
    if (["ArrowRight", "PageDown", " "].includes(e.key) && !typing) { e.preventDefault(); return deckGo(1); }
    if (["ArrowLeft", "PageUp"].includes(e.key) && !typing) { e.preventDefault(); return deckGo(-1); }
  }
  if (e.key === "Escape") {
    if ($("#pop").classList.contains("on")) return $("#pop").classList.remove("on");
    if ($("#compare").classList.contains("on")) return closeCompare();
    if (S.open) return closeDrawer();
    if (typing) e.target.blur();
    return;
  }
  if (typing) return;
  if (e.key === "/") { e.preventDefault(); $("#q").focus(); $("#q").select(); }
  if (S.open) {
    if (e.key === "ArrowRight") stepDrawer(1);
    if (e.key === "ArrowLeft") stepDrawer(-1);
    if (["0", "1", "2", "3"].includes(e.key)) { udSet(S.open, { rating: +e.key }); renderDrawer(); refreshRow(S.open); }
    if (e.key === "c") { toggleCompare(S.open); renderDrawer(); }
  }
});
$("#scrim").onclick = closeDrawer;

// ---------- Start ----------
async function reload() {
  CAT = await api("/api/catalog");
  FAMS = CAT.families; FACES = CAT.faces;
  BYKEY = Object.fromEntries(FAMS.map((f) => [f.key, f]));
  renderNav(); render(); renderTray();
  if (S.open) renderDrawer();
}
async function init() {
  try {
    [UD, CUR] = await Promise.all([api("/api/userdata"), api("/api/curated").catch(() => ({}))]);
    CUR.families ||= {}; UD.families ||= {}; UD.collections ||= [];
  } catch (e) {
    $("#list").innerHTML = `<div class="empty">Der Schriftkasten-Server läuft nicht.<br>Über das Schriftkasten-Symbol neu starten.</div>`;
    return;
  }
  setupIO(); wireBar(); renderBar();
  try { await reload(); }
  catch (e) { $("#list").innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
}
init();
})();
