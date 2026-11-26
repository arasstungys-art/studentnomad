/* Escritorio de studentnomad — edita el blog guardando directo en GitHub. */
{
const REPO = "arasstungys-art/studentnomad";
const BRANCH = "main";
const RAW = "https://raw.githubusercontent.com/" + REPO + "/" + BRANCH + "/src";
const API = "https://api.github.com/repos/" + REPO;
const DEMO = /[?&]demo\b/.test(location.search);
const TOKEN_KEY = "sn-desk-token";

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const flag = (code = "") => code.toUpperCase().replace(/./g, (c) => String.fromCodePoint(127397 + c.charCodeAt(0)));
const today = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 60000).toISOString().slice(0, 10); };
const slugify = (s) => String(s).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 60) || "historia";

let token = null;
try { token = localStorage.getItem(TOKEN_KEY); } catch (e) {}

const state = { posts: [], countries: [], site: {}, gallery: { photos: [] }, world: [], edit: null };
const pending = new Map(); // dataURL -> { path, base64 }

/* ---------- utilidades de texto ---------- */
const b64ToUtf8 = (b64) => new TextDecoder().decode(Uint8Array.from(atob(b64.replace(/\s/g, "")), (c) => c.charCodeAt(0)));
const utf8ToB64 = (str) => { const bytes = new TextEncoder().encode(str); let bin = ""; for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(bin); };

function parseScalar(v) {
  v = v.trim();
  if (v === "") return "";
  if (v.startsWith('"')) { try { return JSON.parse(v); } catch (e) { return v.slice(1, -1); } }
  if (v.startsWith("'")) return v.slice(1, -1).replace(/''/g, "'");
  if (v.startsWith("[")) return v.slice(1, -1).split(",").map((x) => parseScalar(x)).filter((x) => x !== "");
  if (v === "true") return true;
  if (v === "false") return false;
  if (/^-?\d+(\.\d+)?$/.test(v)) return Number(v);
  return v;
}
function parseDoc(text) {
  const m = text.match(/^---\r?\n([\s\S]*?)\r?\n---\r?\n?([\s\S]*)$/);
  if (!m) return { data: {}, body: text };
  const data = {}; let lastKey = null;
  for (const line of m[1].split(/\r?\n/)) {
    const item = line.match(/^\s+-\s+(.*)$/);
    if (item && lastKey) { if (!Array.isArray(data[lastKey])) data[lastKey] = []; data[lastKey].push(parseScalar(item[1])); continue; }
    const kv = line.match(/^([A-Za-z_][\w-]*):\s?(.*)$/);
    if (kv) { lastKey = kv[1]; data[lastKey] = kv[2].trim() === "" ? "" : parseScalar(kv[2]); }
  }
  return { data, body: m[2] };
}
function serializeDoc(data, body) {
  let out = "---\n";
  for (const [k, v] of Object.entries(data)) {
    if (v === undefined || v === null || v === "" || (Array.isArray(v) && !v.length)) continue;
    if (Array.isArray(v)) out += k + ":\n" + v.map((x) => "  - " + JSON.stringify(String(x))).join("\n") + "\n";
    else if (typeof v === "boolean" || typeof v === "number") out += k + ": " + v + "\n";
    else if (/^\d{4}-\d{2}-\d{2}$/.test(v)) out += k + ": " + v + "\n";
    else out += k + ": " + JSON.stringify(String(v)) + "\n";
  }
  return out + "---\n" + (body ? body.trim() + "\n" : "");
}
const imgUrl = (p) => (p && p.startsWith("/uploads/") ? RAW + p : p || "");
const bodyToEditor = (html) => {
  html = (html || "").trim();
  if (!html) return "";
  if (!html.startsWith("<")) html = html.split(/\n{2,}/).map((p) => "<p>" + esc(p).replace(/\n/g, "<br>") + "</p>").join("");
  return html.split('src="/uploads/').join('src="' + RAW + "/uploads/");
};

/* ---------- limpieza del HTML del editor ---------- */
const ALLOWED = { P: "p", H2: "h2", H3: "h3", STRONG: "strong", B: "strong", EM: "em", I: "em", BLOCKQUOTE: "blockquote", UL: "ul", OL: "ol", LI: "li", A: "a", IMG: "img", HR: "hr", BR: "br" };
function cleanNode(node, doc) {
  if (node.nodeType === 3) return doc.createTextNode(node.textContent);
  if (node.nodeType !== 1) return null;
  let tag = ALLOWED[node.tagName];
  if (!tag && node.tagName === "DIV") tag = "p";
  const kids = [...node.childNodes].map((c) => cleanNode(c, doc)).filter(Boolean);
  if (!tag) { const frag = doc.createDocumentFragment(); kids.forEach((k) => frag.appendChild(k)); return frag; }
  const el = doc.createElement(tag);
  if (tag === "img") { el.setAttribute("src", node.getAttribute("src")); el.setAttribute("alt", node.getAttribute("alt") || ""); return el; }
  if (tag === "a") { const h = node.getAttribute("href") || ""; if (/^https?:|^mailto:|^\//.test(h)) el.setAttribute("href", h); }
  kids.forEach((k) => el.appendChild(k));
  return el;
}
function editorToHtml(root) {
  const box = document.createElement("div");
  [...root.childNodes].forEach((n) => { const c = cleanNode(n, document); if (c) box.appendChild(c); });
  // texto suelto -> párrafos
  [...box.childNodes].forEach((n) => {
    if (n.nodeType === 3 || ["STRONG", "EM", "A", "BR", "IMG"].includes(n.nodeName)) {
      if (n.nodeType === 3 && !n.textContent.trim()) { n.remove(); return; }
      const p = document.createElement("p"); box.insertBefore(p, n); p.appendChild(n);
    }
  });
  const blocks = [...box.children].filter((el) => el.tagName === "HR" || el.tagName === "IMG" || el.querySelector("img") || el.textContent.trim());
  return blocks.map((el) => el.outerHTML.split(RAW + "/uploads/").join("/uploads/")).join("\n\n");
}

/* ---------- imágenes ---------- */
function resizeImage(file, max = 1800) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height));
      const c = document.createElement("canvas");
      c.width = Math.round(img.width * k); c.height = Math.round(img.height * k);
      c.getContext("2d").drawImage(img, 0, 0, c.width, c.height);
      const dataUrl = c.toDataURL("image/jpeg", 0.84);
      URL.revokeObjectURL(img.src);
      const name = slugify(file.name.replace(/\.[^.]+$/, "")) + "-" + Date.now().toString(36) + ".jpg";
      pending.set(dataUrl, { path: "/uploads/" + name, base64: dataUrl.split(",")[1] });
      resolve(dataUrl);
    };
    img.onerror = () => reject(new Error("No se pudo leer la imagen"));
    img.src = URL.createObjectURL(file);
  });
}
// Convierte una imagen nueva (dataURL) en su ruta /uploads/ y la agrega a los cambios.
function useImage(src, changes) {
  if (!src) return "";
  if (pending.has(src)) { const p = pending.get(src); changes.push({ path: "src" + p.path, base64: p.base64 }); return p.path; }
  return src.startsWith(RAW) ? src.slice(RAW.length) : src;
}

/* ---------- GitHub ---------- */
const mockFS = {};
async function gh(path, opts = {}) {
  const res = await fetch(API + path, { ...opts, headers: { Authorization: "Bearer " + token, Accept: "application/vnd.github+json", "X-GitHub-Api-Version": "2022-11-28", ...(opts.body ? { "Content-Type": "application/json" } : {}) } });
  if (res.status === 404) return null;
  if (!res.ok) { const t = await res.text(); throw new Error(res.status === 401 ? "La llave no es válida o fue borrada." : "GitHub respondió " + res.status + ": " + t.slice(0, 140)); }
  return res.status === 204 ? {} : res.json();
}
async function listDir(dir) {
  if (DEMO) return Object.keys(mockFS).filter((p) => p.startsWith(dir + "/") && !p.slice(dir.length + 1).includes("/")).map((p) => ({ path: p, name: p.split("/").pop(), type: "file" }));
  const r = await gh("/contents/" + dir + "?ref=" + BRANCH + "&t=" + Date.now());
  return Array.isArray(r) ? r.filter((f) => f.type === "file") : [];
}
async function readFile(path) {
  if (DEMO) return mockFS[path] ?? null;
  const r = await gh("/contents/" + path + "?ref=" + BRANCH + "&t=" + Date.now());
  return r ? b64ToUtf8(r.content) : null;
}
// Un solo commit con varios archivos (texto o imágenes) y borrados.
async function commit(message, files, deletes = []) {
  if (DEMO) { files.forEach((f) => (mockFS[f.path] = f.content ?? "[imagen]")); deletes.forEach((p) => delete mockFS[p]); await new Promise((r) => setTimeout(r, 600)); return; }
  const ref = await gh("/git/ref/heads/" + BRANCH);
  const base = await gh("/git/commits/" + ref.object.sha);
  const tree = [];
  for (const f of files) {
    const blob = await gh("/git/blobs", { method: "POST", body: JSON.stringify(f.base64 ? { content: f.base64, encoding: "base64" } : { content: utf8ToB64(f.content), encoding: "base64" }) });
    tree.push({ path: f.path, mode: "100644", type: "blob", sha: blob.sha });
  }
  deletes.forEach((p) => tree.push({ path: p, mode: "100644", type: "blob", sha: null }));
  const newTree = await gh("/git/trees", { method: "POST", body: JSON.stringify({ base_tree: base.tree.sha, tree }) });
  const c = await gh("/git/commits", { method: "POST", body: JSON.stringify({ message, tree: newTree.sha, parents: [ref.object.sha] }) });
  await gh("/git/refs/heads/" + BRANCH, { method: "PATCH", body: JSON.stringify({ sha: c.sha }) });
}

/* ---------- interfaz general ---------- */
function toast(html, ms = 6000) { const t = $("#toast"); t.innerHTML = html; t.hidden = false; clearTimeout(toast.t); toast.t = setTimeout(() => (t.hidden = true), ms); }
function busy(on, text) { $("#busy").hidden = !on; if (text) $("#busy-text").textContent = text; }
async function run(text, fn) {
  busy(true, text);
  try { await fn(); } catch (e) { console.error(e); toast("⚠️ " + esc(e.message), 9000); } finally { busy(false); }
}
function bg(el, src) { el.style.backgroundImage = src ? "url('" + String(src).replace(/'/g, "%27") + "')" : ""; }
const countryName = (code) => (state.world.find((c) => c.code === code) || {}).name || code;

function show(view) {
  $$(".view").forEach((v) => (v.hidden = v.id !== "v-" + view));
  const tab = { historia: "inicio", pais: "paises" }[view] || view;
  $$(".desk-nav a[data-tab]").forEach((a) => a.classList.toggle("active", a.dataset.tab === tab));
  document.body.classList.remove("nav-open");
  window.scrollTo(0, 0);
}

function route() {
  if (!token) { $("#v-login").hidden = false; $("#app").hidden = true; return; }
  $("#v-login").hidden = true; $("#app").hidden = false;
  const h = decodeURIComponent(location.hash.slice(1)) || "inicio";
  if (h === "nueva") return openPost(null);
  if (h.startsWith("historia/")) return openPost(state.posts.find((p) => p.path === h.slice(9)));
  if (h === "nuevo-pais") return openCountry(null);
  if (h.startsWith("pais/")) return openCountry(state.countries.find((c) => c.data.code === h.slice(5)));
  if (h === "paises") { renderCountries(); return show("paises"); }
  if (h === "portada") { renderSite(); return show("portada"); }
  if (h === "galeria") { renderGallery(); return show("galeria"); }
  renderHome(); show("inicio");
}
document.addEventListener("click", (e) => { const g = e.target.closest("[data-go]"); if (g) { e.preventDefault(); location.hash = g.dataset.go; } });
window.addEventListener("hashchange", route);

/* ---------- cargar todo ---------- */
async function loadAll() {
  const [world, postFiles, countryFiles, siteTxt, galTxt] = await Promise.all([
    fetch("../assets/world.json").then((r) => r.json()).catch(() => []),
    listDir("src/posts"), listDir("src/countries"), readFile("src/_data/site.json"), readFile("src/_data/gallery.json"),
  ]);
  state.world = world;
  state.site = siteTxt ? JSON.parse(siteTxt) : {};
  state.gallery = galTxt ? JSON.parse(galTxt) : { photos: [] };
  if (!Array.isArray(state.gallery.photos)) state.gallery.photos = [];
  const md = (files) => Promise.all(files.filter((f) => f.name.endsWith(".md")).map(async (f) => ({ path: f.path, ...parseDoc(await readFile(f.path)) })));
  state.posts = (await md(postFiles)).sort((a, b) => String(b.data.date).localeCompare(String(a.data.date)));
  state.countries = (await md(countryFiles)).sort((a, b) => String(a.data.name).localeCompare(String(b.data.name)));
}

/* ---------- inicio (perfil + grid) ---------- */
function renderHome() {
  $("#st-posts").textContent = state.posts.length;
  $("#st-countries").textContent = state.countries.length;
  $("#st-photos").textContent = state.gallery.photos.length + state.posts.filter((p) => p.data.cover).length;
  $("#profile-bio").textContent = state.site.hero_text || "";
  const g = $("#post-grid");
  g.innerHTML = '<button class="ig-tile ig-new" data-go="nueva"><div><span>+</span>Nueva historia</div></button>' +
    state.posts.map((p) => '<button class="ig-tile" data-go="historia/' + esc(encodeURIComponent(p.path)) + '"' + (p.data.cover ? ' style="background-image:url(\'' + esc(imgUrl(p.data.cover)) + '\')"' : "") + ">" +
      (p.data.country ? '<span class="f">' + flag(p.data.country) + "</span>" : "") +
      (p.data.draft ? '<span class="d">Borrador</span>' : "") +
      '<span class="t">' + esc(p.data.title || "Sin título") + "</span></button>").join("");
}

/* ---------- editor de historia ---------- */
function fillCountrySelect(sel, current, withNone, noFlag) {
  const visited = state.countries.map((c) => c.data.code);
  const opt = (c) => '<option value="' + c.code + '"' + (c.code === current ? " selected" : "") + ">" + (noFlag ? "" : flag(c.code) + " ") + esc(c.name) + "</option>";
  sel.innerHTML = (withNone ? '<option value="">🌍 Elegir país…</option>' : "") +
    (visited.length ? '<optgroup label="Visitados">' + state.world.filter((c) => visited.includes(c.code)).map(opt).join("") + "</optgroup>" : "") +
    '<optgroup label="' + (visited.length ? "Otros países" : "Todos los países") + '">' + state.world.filter((c) => !visited.includes(c.code)).map(opt).join("") + "</optgroup>";
}
function openPost(post) {
  const d = post ? post.data : { date: today() };
  state.edit = { kind: "post", post, cover: d.cover ? imgUrl(d.cover) : "" };
  bg($("#p-hero"), state.edit.cover);
  fillCountrySelect($("#p-country"), d.country || "", true);
  $("#p-title").textContent = d.title || "";
  $("#p-date").value = String(d.date || today()).slice(0, 10);
  $("#p-excerpt").textContent = d.excerpt || "";
  $("#p-body").innerHTML = bodyToEditor(post ? post.body : "");
  $("#p-tags").value = (d.tags || []).join(", ");
  $("#p-draft").checked = !!d.draft;
  $("#p-delete").hidden = !post;
  $("#p-save").textContent = post ? "Guardar cambios" : "Publicar";
  show("historia");
  if (!post) setTimeout(() => $("#p-title").focus(), 50);
}
$("#p-cover-input").addEventListener("change", async (e) => {
  const f = e.target.files[0]; if (!f) return;
  state.edit.cover = await resizeImage(f); bg($("#p-hero"), state.edit.cover); e.target.value = "";
});
// toolbar
let savedRange = null;
const body = $("#p-body");
document.addEventListener("selectionchange", () => { const s = getSelection(); if (s.rangeCount && body.contains(s.anchorNode)) savedRange = s.getRangeAt(0).cloneRange(); });
function restore() { body.focus(); if (savedRange) { const s = getSelection(); s.removeAllRanges(); s.addRange(savedRange); } }
$("#toolbar").addEventListener("mousedown", (e) => { if (e.target.closest("button")) e.preventDefault(); });
$("#toolbar").addEventListener("click", (e) => {
  const b = e.target.closest("button[data-cmd]"); if (!b) return;
  restore();
  const cmd = b.dataset.cmd;
  if (cmd === "bold" || cmd === "italic") document.execCommand(cmd);
  if (cmd === "h2") { const cur = document.queryCommandValue("formatBlock").toLowerCase(); document.execCommand("formatBlock", false, cur === "h2" ? "p" : "h2"); }
  if (cmd === "quote") { const cur = document.queryCommandValue("formatBlock").toLowerCase(); document.execCommand("formatBlock", false, cur === "blockquote" ? "p" : "blockquote"); }
  if (cmd === "list") document.execCommand("insertUnorderedList");
  if (cmd === "hr") document.execCommand("insertHTML", false, "<hr><p><br></p>");
  if (cmd === "link") { const url = window.prompt ? prompt("Dirección del enlace (https://…)") : null; if (url) document.execCommand("createLink", false, url); }
});
$("#p-photo-input").addEventListener("change", async (e) => {
  const files = [...e.target.files]; e.target.value = "";
  for (const f of files) { const src = await resizeImage(f); restore(); document.execCommand("insertHTML", false, '<p><img src="' + src + '" alt=""></p><p><br></p>'); }
});
// pegar como texto limpio
$$(".ce").forEach((el) => el.addEventListener("paste", (e) => { e.preventDefault(); document.execCommand("insertText", false, (e.clipboardData || window.clipboardData).getData("text/plain")); }));
// Enter en títulos no crea saltos
["#p-title", "#p-excerpt", "#s-kicker", "#s-title", "#s-about-kicker", "#s-about-title"].forEach((s) => $(s).addEventListener("keydown", (e) => { if (e.key === "Enter") { e.preventDefault(); e.target.blur(); } }));
// borrar foto seleccionada dentro del texto
body.addEventListener("click", (e) => { $$("img.sel", body).forEach((i) => i.classList.remove("sel")); if (e.target.tagName === "IMG") e.target.classList.add("sel"); });
body.addEventListener("keydown", (e) => { const sel = $("img.sel", body); if (sel && (e.key === "Backspace" || e.key === "Delete")) { e.preventDefault(); (sel.parentElement.tagName === "P" && sel.parentElement.childNodes.length === 1 ? sel.parentElement : sel).remove(); } });

$("#p-save").addEventListener("click", () => {
  const title = $("#p-title").textContent.trim();
  if (!title) { toast("Ponle un título a la historia ✍️"); $("#p-title").focus(); return; }
  run("Publicando…", async () => {
    const { post } = state.edit;
    const changes = [];
    const date = $("#p-date").value || today();
    const country = $("#p-country").value;
    const bodyEl = body.cloneNode(true);
    $$("img", bodyEl).forEach((img) => img.setAttribute("src", useImage(img.getAttribute("src"), changes)));
    const data = {
      title, date, country,
      cover: useImage(state.edit.cover, changes),
      excerpt: $("#p-excerpt").textContent.trim(),
      tags: $("#p-tags").value.split(",").map((t) => t.trim()).filter(Boolean),
      draft: $("#p-draft").checked || undefined,
    };
    const path = post ? post.path : "src/posts/" + date + "-" + slugify(title) + ".md";
    const html = editorToHtml(bodyEl);
    changes.push({ path, content: serializeDoc(data, html) });
    // si el país aún no está en la lista, se agrega solo
    if (country && !state.countries.some((c) => c.data.code === country)) {
      const w = state.world.find((c) => c.code === country);
      changes.push({ path: "src/countries/" + country + ".md", content: serializeDoc({ name: w.name, code: country, continent: w.continent }, "") });
    }
    await commit((post ? "Editar" : "Nueva") + " historia: " + title, changes);
    await loadAll();
    const slug = path.split("/").pop().replace(/^\d{4}-\d{2}-\d{2}-/, "").replace(/\.md$/, "");
    toast(data.draft ? "Guardado como borrador ✓" : '¡Publicado! ✈ Aparece en el blog en 1–2 minutos · <a href="../stories/' + esc(slug) + '/" target="_blank">ver</a>', 9000);
    location.hash = "inicio";
  });
});
$("#p-delete").addEventListener("click", () => {
  const { post } = state.edit;
  if (!confirm("¿Eliminar «" + (post.data.title || "esta historia") + "»? No se puede deshacer.")) return;
  run("Eliminando…", async () => { await commit("Eliminar historia: " + post.data.title, [], [post.path]); await loadAll(); toast("Historia eliminada"); location.hash = "inicio"; });
});

/* ---------- países ---------- */
function renderCountries() {
  $("#country-grid").innerHTML = '<button class="country-card add" data-go="nuevo-pais"><div><span>+</span>Añadir país</div></button>' +
    state.countries.map((c) => '<button class="country-card" data-go="pais/' + esc(c.data.code) + '"' + (c.data.cover ? ' style="background-image:url(\'' + esc(imgUrl(c.data.cover)) + '\')"' : "") +
      '><div class="country-card-inner"><span class="flag">' + flag(c.data.code) + '</span><span class="name">' + esc(c.data.name) + "</span></div></button>").join("");
}
function renderStars(n) {
  $("#c-stars").innerHTML = [1, 2, 3, 4, 5].map((i) => '<svg viewBox="0 0 24 24" data-v="' + i + '" class="' + (i <= n ? "on" : "") + '"><path d="M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6L2.5 9.4l6.6-.8z"/></svg>').join("");
  state.edit.rating = n;
}
function renderCities() {
  $("#c-cities").innerHTML = state.edit.cities.map((c, i) => "<li>" + esc(c) + '<button data-i="' + i + '" aria-label="Quitar">×</button></li>').join("");
}
function syncCountryHead() {
  const code = $("#c-code").value; const w = state.world.find((c) => c.code === code) || {};
  $("#c-flag").textContent = flag(code); $("#c-continent").textContent = w.continent || "";
}
function openCountry(c) {
  const d = c ? c.data : {};
  state.edit = { kind: "country", country: c, cover: d.cover ? imgUrl(d.cover) : "", cities: [...(d.cities || [])] };
  bg($("#c-hero"), state.edit.cover);
  fillCountrySelect($("#c-code"), d.code || "cl", false, true);
  if (!c) { const free = state.world.find((w) => !state.countries.some((x) => x.data.code === w.code)); if (free && state.countries.some((x) => x.data.code === $("#c-code").value)) $("#c-code").value = free.code; }
  syncCountryHead();
  renderStars(d.rating || 0); renderCities();
  $("#c-date").value = d.visited_on ? String(d.visited_on).slice(0, 10) : "";
  $("#c-featured").checked = !!d.featured;
  $("#c-body").innerHTML = bodyToEditor(c ? c.body : "");
  $("#c-delete").hidden = !c;
  show("pais");
}
$("#c-code").addEventListener("change", syncCountryHead);
$("#c-stars").addEventListener("click", (e) => { const s = e.target.closest("svg"); if (s) renderStars(+s.dataset.v === state.edit.rating ? 0 : +s.dataset.v); });
$("#c-cities").addEventListener("click", (e) => { const b = e.target.closest("button"); if (b) { state.edit.cities.splice(+b.dataset.i, 1); renderCities(); } });
$("#c-city-in").addEventListener("keydown", (e) => { if (e.key === "Enter" && e.target.value.trim()) { e.preventDefault(); state.edit.cities.push(e.target.value.trim()); e.target.value = ""; renderCities(); } });
$("#c-cover-input").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; state.edit.cover = await resizeImage(f); bg($("#c-hero"), state.edit.cover); e.target.value = ""; });
$("#c-save").addEventListener("click", () => run("Guardando país…", async () => {
  const { country } = state.edit;
  const code = $("#c-code").value; const w = state.world.find((c) => c.code === code);
  const pendingCity = $("#c-city-in").value.trim(); if (pendingCity) { state.edit.cities.push(pendingCity); $("#c-city-in").value = ""; }
  const changes = []; const deletes = [];
  const bodyEl = $("#c-body").cloneNode(true);
  $$("img", bodyEl).forEach((img) => img.setAttribute("src", useImage(img.getAttribute("src"), changes)));
  const data = { name: w.name, code, continent: w.continent, cover: useImage(state.edit.cover, changes), rating: state.edit.rating || undefined, featured: $("#c-featured").checked || undefined, cities: state.edit.cities, visited_on: $("#c-date").value || undefined };
  changes.push({ path: "src/countries/" + code + ".md", content: serializeDoc(data, editorToHtml(bodyEl)) });
  if (country && country.path !== "src/countries/" + code + ".md") deletes.push(country.path);
  await commit((country ? "Editar" : "Nuevo") + " país: " + w.name, changes, deletes);
  await loadAll(); toast(flag(code) + " " + esc(w.name) + " guardado ✓ · se pinta en el mapa en 1–2 minutos"); location.hash = "paises";
}));
$("#c-delete").addEventListener("click", () => {
  const { country } = state.edit;
  if (!confirm("¿Quitar " + country.data.name + " de los países visitados?")) return;
  run("Quitando…", async () => { await commit("Quitar país: " + country.data.name, [], [country.path]); await loadAll(); location.hash = "paises"; });
});

/* ---------- portada ---------- */
function renderSite() {
  const s = state.site;
  state.edit = { kind: "site", hero: s.hero_image ? imgUrl(s.hero_image) : "" };
  bg($("#s-hero"), state.edit.hero);
  $("#s-kicker").textContent = s.hero_kicker || "";
  $("#s-title").textContent = s.title || "";
  $("#s-text").textContent = s.hero_text || "";
  $("#s-about-kicker").textContent = s.about_kicker || "";
  $("#s-about-title").textContent = s.about_title || "";
  $("#s-about").innerHTML = (s.about_text || "").split(/\n{2,}/).map((p) => "<p>" + esc(p) + "</p>").join("");
  $("#s-email").value = s.contact_email || "";
  $("#s-footer").value = s.footer_tagline || "";
}
$("#s-hero-input").addEventListener("change", async (e) => { const f = e.target.files[0]; if (!f) return; state.edit.hero = await resizeImage(f, 2400); bg($("#s-hero"), state.edit.hero); e.target.value = ""; });
$("#s-save").addEventListener("click", () => run("Guardando portada…", async () => {
  const changes = [];
  const s = { ...state.site,
    hero_image: useImage(state.edit.hero, changes),
    hero_kicker: $("#s-kicker").textContent.trim(), title: $("#s-title").textContent.trim() || "studentnomad",
    hero_text: $("#s-text").textContent.trim(), about_kicker: $("#s-about-kicker").textContent.trim(),
    about_title: $("#s-about-title").textContent.trim(),
    about_text: $$("p, div", $("#s-about")).map((p) => p.textContent.trim()).filter(Boolean).join("\n\n") || $("#s-about").textContent.trim(),
    contact_email: $("#s-email").value.trim(), footer_tagline: $("#s-footer").value.trim() };
  changes.push({ path: "src/_data/site.json", content: JSON.stringify(s, null, 2) + "\n" });
  await commit("Editar portada", changes); state.site = s;
  toast("Portada guardada ✓ · se actualiza en 1–2 minutos");
}));

/* ---------- galería ---------- */
function renderGallery() {
  state.edit = { kind: "gallery", photos: state.gallery.photos.map((p) => ({ ...p, src: imgUrl(p.image) })) };
  drawGallery();
}
function drawGallery() {
  const ph = state.edit.photos;
  $("#g-grid").innerHTML = ph.length ? ph.map((p, i) => '<figure><img src="' + esc(p.src) + '" alt=""><button class="rm" data-i="' + i + '" aria-label="Quitar">×</button><figcaption contenteditable="true" data-i="' + i + '">' + esc(p.caption || "") + "</figcaption></figure>").join("")
    : '<div class="empty">Todavía no hay fotos. Toca «+ Añadir fotos».</div>';
}
$("#g-input").addEventListener("change", async (e) => {
  const files = [...e.target.files]; e.target.value = "";
  for (const f of files) state.edit.photos.unshift({ src: await resizeImage(f), caption: "" });
  drawGallery();
});
$("#g-grid").addEventListener("click", (e) => { const b = e.target.closest(".rm"); if (b) { state.edit.photos.splice(+b.dataset.i, 1); drawGallery(); } });
$("#g-grid").addEventListener("input", (e) => { const fc = e.target.closest("figcaption"); if (fc) state.edit.photos[+fc.dataset.i].caption = fc.textContent; });
$("#g-save").addEventListener("click", () => run("Guardando galería…", async () => {
  const changes = [];
  const photos = state.edit.photos.map((p) => ({ image: useImage(p.src, changes), caption: (p.caption || "").trim() }));
  changes.push({ path: "src/_data/gallery.json", content: JSON.stringify({ photos }, null, 2) + "\n" });
  await commit("Editar galería", changes); state.gallery = { photos };
  toast("Galería guardada ✓");
}));

/* ---------- sesión ---------- */
async function start() {
  await run("Abriendo tu escritorio…", async () => { await loadAll(); route(); });
}
$("#login-form").addEventListener("submit", async (e) => {
  e.preventDefault();
  const t = $("#login-token").value.trim();
  $("#login-error").textContent = "";
  token = t;
  try {
    if (!DEMO) {
      const repo = await gh("");
      if (!repo) throw new Error("Esta llave no tiene acceso al blog.");
      if (repo.permissions && !repo.permissions.push) throw new Error("Esta llave solo puede leer; necesita permiso de escritura.");
    }
    try { localStorage.setItem(TOKEN_KEY, t); } catch (err) {}
    $("#login-token").value = "";
    start();
  } catch (err) { token = null; $("#login-error").textContent = err.message; }
});
$("#logout").addEventListener("click", () => { try { localStorage.removeItem(TOKEN_KEY); } catch (e) {} token = null; location.hash = ""; route(); });

if (DEMO) {
  token = token || "demo";
  Object.assign(mockFS, {
    "src/_data/site.json": JSON.stringify({ title: "studentnomad", hero_kicker: "travel & adventure", hero_text: "Cheap flights, long walks, and many friends along the way. Stories from the road, one country at a time.", hero_image: "", footer_tagline: "one country at a time", about_kicker: "hello there", about_title: "About me", about_text: "I started the journey as a university student with a backpack, a tight budget, and a long list of places to see.", contact_email: "" }),
    "src/_data/gallery.json": '{"photos":[]}',
    "src/countries/cl.md": "---\nname: Chile\ncode: cl\ncontinent: South America\nrating: 5\nfeatured: true\ncities:\n  - Santiago\n  - San Pedro de Atacama\n---\n",
    "src/posts/2026-11-20-first-night-in-the-atacama.md": '---\ntitle: "First night in the Atacama"\ndate: 2026-11-20\ncountry: "cl"\nexcerpt: "A bus from Santiago, a cheap hostel and the clearest sky I\'ve ever seen."\n---\n<p>Twenty-three hours on a bus is a long time. <strong>But</strong> the moment the doors opened in San Pedro, it was worth it.</p>\n\n<h2>The sky</h2>\n\n<blockquote>Nobody told me the stars would be this loud.</blockquote>\n',
    "src/posts/2026-11-24-santiago-on-a-budget.md": '---\ntitle: "Santiago on a student budget"\ndate: 2026-11-24\ncountry: "cl"\n---\n<p>Completos, metro and free museums.</p>\n',
  });
}
if (token) start(); else route();
}
