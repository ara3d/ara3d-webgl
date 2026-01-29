import { V as Viewer, w as MeshStandardMaterial } from "./compressors.ca4e4f79.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.180bc89b.js";
function showFilter(name, filter, onChange) {
  if (!name || !filter) {
    const existing = document.getElementById("ara3d-filter-panel");
    if (existing)
      existing.style.display = "none";
    return;
  }
  const panelId = "ara3d-filter-panel";
  const styleId = "ara3d-filter-panel-style";
  function ensureStyles() {
    if (document.getElementById(styleId))
      return;
    const style = document.createElement("style");
    style.id = styleId;
    style.textContent = `
      #${panelId}{
        position: fixed;
        top: 0;
        right: 0;
        height: 100vh;
        width: 320px;
        min-width: 220px;
        max-width: 60vw;
        display: flex;
        flex-direction: column;
        background: rgba(20,20,22,0.92);
        color: #f2f2f2;
        border-left: 1px solid rgba(255,255,255,0.12);
        box-shadow: -10px 0 30px rgba(0,0,0,0.35);
        z-index: 999999;
        font-family: system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif;
      }
      #${panelId} .ara3d-resize-handle{
        position: absolute;
        left: -6px;
        top: 0;
        width: 12px;
        height: 100%;
        cursor: ew-resize;
      }
      #${panelId} .ara3d-header{
        padding: 12px 12px 10px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        display: flex;
        align-items: center;
        gap: 10px;
      }
      #${panelId} .ara3d-title{
        font-size: 14px;
        font-weight: 700;
        letter-spacing: 0.2px;
        flex: 1;
        user-select: none;
      }
      #${panelId} .ara3d-close{
        border: 0;
        background: transparent;
        color: rgba(255,255,255,0.75);
        font-size: 18px;
        line-height: 18px;
        cursor: pointer;
        padding: 4px 6px;
        border-radius: 8px;
      }
      #${panelId} .ara3d-close:hover{
        background: rgba(255,255,255,0.08);
        color: #fff;
      }
      #${panelId} .ara3d-controls{
        display: flex;
        gap: 8px;
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
        flex-wrap: wrap;
      }
      #${panelId} .ara3d-btn{
        border: 1px solid rgba(255,255,255,0.15);
        background: rgba(255,255,255,0.06);
        color: rgba(255,255,255,0.9);
        padding: 6px 10px;
        border-radius: 10px;
        cursor: pointer;
        font-size: 12px;
        user-select: none;
      }
      #${panelId} .ara3d-btn:hover{
        background: rgba(255,255,255,0.10);
      }
      #${panelId} .ara3d-search{
        padding: 10px 12px;
        border-bottom: 1px solid rgba(255,255,255,0.12);
      }
      #${panelId} .ara3d-search input{
        width: 100%;
        box-sizing: border-box;
        padding: 8px 10px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,0.16);
        background: rgba(0,0,0,0.25);
        color: #fff;
        outline: none;
        font-size: 12px;
      }
      #${panelId} .ara3d-list{
        overflow: auto;
        padding: 8px 8px 12px;
        flex: 1;
      }
      #${panelId} .ara3d-item{
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 6px 6px;
        border-radius: 10px;
      }
      #${panelId} .ara3d-item:hover{
        background: rgba(255,255,255,0.06);
      }
      #${panelId} .ara3d-item label{
        display: flex;
        align-items: center;
        gap: 8px;
        cursor: pointer;
        width: 100%;
      }
      #${panelId} .ara3d-item input[type="checkbox"]{
        width: 16px;
        height: 16px;
        cursor: pointer;
      }
      #${panelId} .ara3d-item .ara3d-value{
        flex: 1;
        font-size: 12px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      #${panelId} .ara3d-item .ara3d-count{
        font-size: 11px;
        opacity: 0.7;
        padding-left: 8px;
      }
      #${panelId} .ara3d-footerhint{
        padding: 10px 12px;
        border-top: 1px solid rgba(255,255,255,0.12);
        font-size: 11px;
        opacity: 0.7;
        user-select: none;
      }
    `;
    document.head.appendChild(style);
  }
  function ensurePanel() {
    let panel2 = document.getElementById(panelId);
    if (panel2)
      return panel2;
    panel2 = document.createElement("div");
    panel2.id = panelId;
    const stopIfPanelFocused = (ev) => {
      const t = ev.target;
      const isTextInput = t instanceof HTMLInputElement || t instanceof HTMLTextAreaElement || t instanceof HTMLSelectElement || t && t.isContentEditable;
      if (panel2.contains(t)) {
        ev.stopPropagation();
        if (isTextInput)
          ev.stopImmediatePropagation?.();
      }
    };
    panel2.addEventListener("keydown", stopIfPanelFocused, true);
    panel2.addEventListener("keyup", stopIfPanelFocused, true);
    panel2.addEventListener("keypress", stopIfPanelFocused, true);
    const handle = document.createElement("div");
    handle.className = "ara3d-resize-handle";
    panel2.appendChild(handle);
    const header = document.createElement("div");
    header.className = "ara3d-header";
    header.innerHTML = `
      <div class="ara3d-title"></div>
      <button class="ara3d-close" title="Close">\xD7</button>
    `;
    panel2.appendChild(header);
    const controls = document.createElement("div");
    controls.className = "ara3d-controls";
    controls.innerHTML = `
      <button class="ara3d-btn" data-act="all-on">All On</button>
      <button class="ara3d-btn" data-act="all-off">All Off</button>
      <button class="ara3d-btn" data-act="invert">Invert</button>
    `;
    panel2.appendChild(controls);
    const search = document.createElement("div");
    search.className = "ara3d-search";
    search.innerHTML = `<input type="text" placeholder="Search\u2026" />`;
    panel2.appendChild(search);
    const list = document.createElement("div");
    list.className = "ara3d-list";
    panel2.appendChild(list);
    const footer = document.createElement("div");
    footer.className = "ara3d-footerhint";
    footer.textContent = "Tip: Use Search to quickly find items.";
    panel2.appendChild(footer);
    document.body.appendChild(panel2);
    header.querySelector(".ara3d-close").addEventListener("click", () => {
      panel2.style.display = "none";
    });
    const searchInput2 = search.querySelector("input");
    search.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      e.preventDefault();
      searchInput2.focus();
    });
    let resizing = false;
    let startX = 0;
    let startWidth = 0;
    handle.addEventListener("mousedown", (e) => {
      resizing = true;
      startX = e.clientX;
      startWidth = panel2.getBoundingClientRect().width;
      e.preventDefault();
      e.stopPropagation();
    });
    window.addEventListener("mousemove", (e) => {
      if (!resizing)
        return;
      const dx = startX - e.clientX;
      const newW = Math.max(220, Math.min(window.innerWidth * 0.6, startWidth + dx));
      panel2.style.width = `${newW}px`;
    });
    window.addEventListener("mouseup", () => {
      resizing = false;
    });
    return panel2;
  }
  function stableKey(v) {
    return typeof v === "string" ? v : String(v);
  }
  ensureStyles();
  const panel = ensurePanel();
  panel.style.display = "flex";
  const titleEl = panel.querySelector(".ara3d-title");
  const listEl = panel.querySelector(".ara3d-list");
  const searchInput = panel.querySelector(".ara3d-search input");
  titleEl.textContent = name;
  const collator = new Intl.Collator(void 0, { sensitivity: "base", numeric: true });
  const entries = Array.from(filter.entries()).map(([value, indices]) => ({
    value,
    key: stableKey(value),
    count: Array.isArray(indices) ? indices.length : 0
  }));
  entries.sort((a, b) => collator.compare(a.key, b.key));
  const state = new Map(entries.map((e) => [e.key, true]));
  const keyToValue = new Map(entries.map((e) => [e.key, e.value]));
  function renderList(filterText = "") {
    const ft = filterText.trim().toLowerCase();
    listEl.innerHTML = "";
    for (const e of entries) {
      if (ft && !e.key.toLowerCase().includes(ft))
        continue;
      const row = document.createElement("div");
      row.className = "ara3d-item";
      row.innerHTML = `
        <label title="${e.key}">
          <input type="checkbox" />
          <span class="ara3d-value"></span>
          <span class="ara3d-count">${e.count}</span>
        </label>
      `;
      const cb = row.querySelector("input");
      const valueEl = row.querySelector(".ara3d-value");
      cb.checked = state.get(e.key) === true;
      cb.dataset.key = e.key;
      valueEl.textContent = e.key;
      cb.addEventListener("click", (ev) => {
        ev.stopPropagation();
        state.set(cb.dataset.key, cb.checked);
        notify();
      });
      listEl.appendChild(row);
    }
  }
  function getSelectedKeys() {
    const out = [];
    for (const [k, v] of state.entries())
      if (v)
        out.push(k);
    return out;
  }
  function notify() {
    if (typeof onChange !== "function")
      return;
    onChange(getSelectedKeys(), new Map(state), keyToValue);
  }
  panel.querySelector(".ara3d-controls").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn)
      return;
    const act = btn.dataset.act;
    if (act === "all-on") {
      for (const k of state.keys())
        state.set(k, true);
      renderList(searchInput.value);
      notify();
    } else if (act === "all-off") {
      for (const k of state.keys())
        state.set(k, false);
      renderList(searchInput.value);
      notify();
    } else if (act === "invert") {
      for (const [k, v] of state.entries())
        state.set(k, !v);
      renderList(searchInput.value);
      notify();
    }
  });
  searchInput.addEventListener("input", () => renderList(searchInput.value));
  ["keydown", "keyup", "keypress"].forEach(
    (t) => searchInput.addEventListener(
      t,
      (e) => {
        e.stopPropagation();
      },
      true
    )
  );
  renderList("");
  notify();
}
async function runExample() {
  const viewer = new Viewer();
  const loader = new BimOpenSchemaLoader();
  console.time("Loading .bos file");
  const bimData = await loader.load("/ara3d-webgl/rac_basic_sample_project-2025.bos");
  console.timeEnd("Loading .bos file");
  let group = bimData.ThreeGeometry;
  viewer.add(group);
  const catToInstances = bimData.Query.CategoryToInstances();
  let first = true;
  function updateVisible(map) {
    if (first) {
      first = false;
      return;
    }
    const instances = [];
    const ghostMaterial = new MeshStandardMaterial({
      color: 8956671,
      transparent: true,
      opacity: 0.1,
      roughness: 0.8,
      metalness: 0,
      depthWrite: false
    });
    for (let [name, checked] of map) {
      const list = catToInstances.get(name);
      if (checked) {
        for (let i = 0; i < list.length; i++)
          instances.push(list[i]);
      } else {
        for (let i = 0; i < list.length; i++) {
          const instance = { ...list[i], material: ghostMaterial };
          instances.push(instance);
        }
      }
    }
    const newGroup = bimData.rebuildGeometry(instances);
    viewer.remove(group);
    group = newGroup;
    viewer.add(group);
  }
  console.time("Creating filter");
  showFilter(
    "Category",
    catToInstances,
    (keys, map) => updateVisible(map)
  );
  console.timeEnd("Creating filter");
}
runExample();
//# sourceMappingURL=exampleBosFilters.a7433919.js.map
