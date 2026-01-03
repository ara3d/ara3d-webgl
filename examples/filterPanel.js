/**
 * Adds (or updates) a resizable filter panel docked on the RIGHT side of <body>.
 *
 * Usage:
 *   showFilter("Category", categoryMap, (selectedKeys, selectedMap) => { ... })
 *   showFilter(); // hides the panel
 *
 * Signature:
 *   showFilter(string name, filter: Map<value, number[]>, onChange: Function)
 *
 * onChange is called as:
 *   onChange(selectedKeysArray, stateMap, keyToValueMap)
 */
export function showFilter(name, filter, onChange) {
  // Hide if called with no args (or falsy name/filter)
  if (!name || !filter) {
    const existing = document.getElementById("ara3d-filter-panel");
    if (existing) existing.style.display = "none";
    return;
  }

  // ---------- helpers ----------
  const panelId = "ara3d-filter-panel";
  const styleId = "ara3d-filter-panel-style";

  function ensureStyles() {
    if (document.getElementById(styleId)) return;
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
    let panel = document.getElementById(panelId);
    if (panel) return panel;

    panel = document.createElement("div");
    panel.id = panelId;

    // Prevent viewer hotkeys (WASD etc.) when interacting with the panel/search.
    // Use capture so we beat most window-level handlers.
    const stopIfPanelFocused = (ev) => {
      const t = ev.target;
      const isTextInput =
        t instanceof HTMLInputElement ||
        t instanceof HTMLTextAreaElement ||
        t instanceof HTMLSelectElement ||
        (t && t.isContentEditable);

      // If the event originated inside the panel, don't let it bubble to the viewer.
      // If it's a typing context, also prevent default so nothing else consumes it.
      if (panel.contains(t)) {
        ev.stopPropagation();
        if (isTextInput) ev.stopImmediatePropagation?.();
      }
    };

    panel.addEventListener("keydown", stopIfPanelFocused, true);
    panel.addEventListener("keyup", stopIfPanelFocused, true);
    panel.addEventListener("keypress", stopIfPanelFocused, true);

    // Resize handle
    const handle = document.createElement("div");
    handle.className = "ara3d-resize-handle";
    panel.appendChild(handle);

    // Header
    const header = document.createElement("div");
    header.className = "ara3d-header";
    header.innerHTML = `
      <div class="ara3d-title"></div>
      <button class="ara3d-close" title="Close">×</button>
    `;
    panel.appendChild(header);

    // Controls (Isolate removed)
    const controls = document.createElement("div");
    controls.className = "ara3d-controls";
    controls.innerHTML = `
      <button class="ara3d-btn" data-act="all-on">All On</button>
      <button class="ara3d-btn" data-act="all-off">All Off</button>
      <button class="ara3d-btn" data-act="invert">Invert</button>
    `;
    panel.appendChild(controls);

    // Search
    const search = document.createElement("div");
    search.className = "ara3d-search";
    search.innerHTML = `<input type="text" placeholder="Search…" />`;
    panel.appendChild(search);

    // List
    const list = document.createElement("div");
    list.className = "ara3d-list";
    panel.appendChild(list);

    // Footer hint (remove Alt/Ctrl text)
    const footer = document.createElement("div");
    footer.className = "ara3d-footerhint";
    footer.textContent = "Tip: Use Search to quickly find items.";
    panel.appendChild(footer);

    document.body.appendChild(panel);

    // Close behavior
    header.querySelector(".ara3d-close").addEventListener("click", () => {
      panel.style.display = "none";
    });

    // Ensure clicking anywhere in the search area focuses input,
    // and prevent mousedown from stealing focus back to the canvas.
    const searchInput = search.querySelector("input");
    search.addEventListener("mousedown", (e) => {
      e.stopPropagation();
      // Prevent the viewer from treating this as a drag/click on the canvas.
      e.preventDefault();
      searchInput.focus();
    });

    // Resizing behavior
    let resizing = false;
    let startX = 0;
    let startWidth = 0;

    handle.addEventListener("mousedown", (e) => {
      resizing = true;
      startX = e.clientX;
      startWidth = panel.getBoundingClientRect().width;
      e.preventDefault();
      e.stopPropagation();
    });

    window.addEventListener("mousemove", (e) => {
      if (!resizing) return;
      const dx = startX - e.clientX; // moving left increases width
      const newW = Math.max(220, Math.min(window.innerWidth * 0.6, startWidth + dx));
      panel.style.width = `${newW}px`;
    });

    window.addEventListener("mouseup", () => {
      resizing = false;
    });

    return panel;
  }

  function stableKey(v) {
    return typeof v === "string" ? v : String(v);
  }

  // ---------- build UI ----------
  ensureStyles();
  const panel = ensurePanel();
  panel.style.display = "flex";

  const titleEl = panel.querySelector(".ara3d-title");
  const listEl = panel.querySelector(".ara3d-list");
  const searchInput = panel.querySelector(".ara3d-search input");

  titleEl.textContent = name;

  // Sort alphabetically by key (case-insensitive, numeric-aware)
  const collator = new Intl.Collator(undefined, { sensitivity: "base", numeric: true });

  const entries = Array.from(filter.entries()).map(([value, indices]) => ({
    value,
    key: stableKey(value),
    count: Array.isArray(indices) ? indices.length : 0,
  }));
  entries.sort((a, b) => collator.compare(a.key, b.key));

  // State: Map<key, boolean>
  const state = new Map(entries.map((e) => [e.key, true]));
  const keyToValue = new Map(entries.map((e) => [e.key, e.value]));

  function renderList(filterText = "") {
    const ft = filterText.trim().toLowerCase();
    listEl.innerHTML = "";

    for (const e of entries) {
      if (ft && !e.key.toLowerCase().includes(ft)) continue;

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

      // Simple toggle only (no Alt isolate, no Ctrl invert-single)
      cb.addEventListener("click", (ev) => {
        ev.stopPropagation(); // avoid viewer click handlers
        state.set(cb.dataset.key, cb.checked);
        notify();
      });

      listEl.appendChild(row);
    }
  }

  function getSelectedKeys() {
    const out = [];
    for (const [k, v] of state.entries()) if (v) out.push(k);
    return out;
  }

  function notify() {
    if (typeof onChange !== "function") return;
    onChange(getSelectedKeys(), new Map(state), keyToValue);
  }

  // Controls actions
  panel.querySelector(".ara3d-controls").addEventListener("click", (e) => {
    const btn = e.target.closest("button[data-act]");
    if (!btn) return;

    const act = btn.dataset.act;

    if (act === "all-on") {
      for (const k of state.keys()) state.set(k, true);
      renderList(searchInput.value);
      notify();
    } else if (act === "all-off") {
      for (const k of state.keys()) state.set(k, false);
      renderList(searchInput.value);
      notify();
    } else if (act === "invert") {
      for (const [k, v] of state.entries()) state.set(k, !v);
      renderList(searchInput.value);
      notify();
    }
  });

  // Search filter
  searchInput.addEventListener("input", () => renderList(searchInput.value));
  // Also stop key events from escaping the input specifically
  ["keydown", "keyup", "keypress"].forEach((t) =>
    searchInput.addEventListener(
      t,
      (e) => {
        e.stopPropagation();
      },
      true
    )
  );

  // Initial render + initial notify
  renderList("");
  notify();
}
