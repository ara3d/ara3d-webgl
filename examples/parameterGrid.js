// parameterGrid.js
// Usage (in your module):
//   import { showParameterGrid } from "./parameterGrid.js";
//   showParameterGrid({ instances, resolver: r, onCellSelected: (rowIndex, info) => {...} });

const TABULATOR_CSS = "https://unpkg.com/tabulator-tables@6.3.1/dist/css/tabulator.min.css";
const TABULATOR_JS  = "https://unpkg.com/tabulator-tables@6.3.1/dist/js/tabulator.min.js";

async function ensureTabulatorLoaded() {
  if (window.Tabulator) return;

  // CSS
  if (!document.querySelector(`link[data-tabulator="true"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TABULATOR_CSS;
    link.dataset.tabulator = "true";
    document.head.appendChild(link);
  }

  // JS
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-tabulator="true"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      // If it was already loaded, resolve immediately
      if (window.Tabulator) resolve();
      return;
    }

    const script = document.createElement("script");
    script.src = TABULATOR_JS;
    script.async = true;
    script.dataset.tabulator = "true";
    script.onload = resolve;
    script.onerror = reject;
    document.head.appendChild(script);
  });

  if (!window.Tabulator) {
    throw new Error("Tabulator failed to load.");
  }
}

function ensureBaseStyles() {
  const id = "ara3d-paramgrid-split-styles";
  if (document.getElementById(id)) return;

  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    html, body { height: 100%; margin: 0; }
    .ara3d-split {
      position: fixed; inset: 0;
      display: flex; flex-direction: row;
      overflow: hidden;
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      background: #fff;
    }
    .ara3d-left {
      min-width: 320px;
      flex: 1 1 auto;
      position: relative;
      overflow: hidden;
    }
    .ara3d-canvas { width: 100%; height: 100%; display: block; }

    .ara3d-divider {
      width: 8px;
      cursor: col-resize;
      background: linear-gradient(to right, rgba(0,0,0,0.03), rgba(0,0,0,0.10), rgba(0,0,0,0.03));
      user-select: none;
      touch-action: none;
    }

    .ara3d-right {
      width: 560px; /* initial width */
      min-width: 360px;
      max-width: 75vw;
      display: flex;
      flex-direction: column;
      border-left: 1px solid rgba(0,0,0,0.12);
      overflow: hidden;
    }
    .ara3d-gridbar {
      display: flex;
      gap: 8px;
      align-items: center;
      padding: 10px;
      border-bottom: 1px solid rgba(0,0,0,0.08);
      background: #fafafa;
    }
    .ara3d-gridtitle { font-weight: 600; font-size: 14px; flex: 1; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .ara3d-gridsearch input {
      width: 240px;
      max-width: 40vw;
      padding: 6px 8px;
      border: 1px solid rgba(0,0,0,0.18);
      border-radius: 8px;
      font-size: 13px;
      outline: none;
      background: #fff;
    }
    .ara3d-gridhost { flex: 1 1 auto; min-height: 0; }
    /* Make cells less cramped */
    .tabulator .tabulator-cell { padding: 6px 8px; }
    .tabulator .tabulator-col { padding: 6px 8px; }
  `;
  document.head.appendChild(style);
}

function makeSplitLayout(canvas) {
  // If already split, reuse.
  let split = document.querySelector(".ara3d-split");
  if (split) return split;

  const splitEl = document.createElement("div");
  splitEl.className = "ara3d-split";

  const left = document.createElement("div");
  left.className = "ara3d-left";

  const divider = document.createElement("div");
  divider.className = "ara3d-divider";

  const right = document.createElement("div");
  right.className = "ara3d-right";

  // Move canvas into left pane
  left.appendChild(canvas);

  splitEl.appendChild(left);
  splitEl.appendChild(divider);
  splitEl.appendChild(right);

  // Put split as only top-level layout container (safe for demos)
  document.body.appendChild(splitEl);

  // Divider drag-to-resize (simple + robust)
  let dragging = false;
  divider.addEventListener("pointerdown", (e) => {
    dragging = true;
    divider.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  divider.addEventListener("pointermove", (e) => {
    if (!dragging) return;
    const totalW = splitEl.getBoundingClientRect().width;
    const x = e.clientX;
    const rightW = Math.max(360, Math.min(totalW * 0.75, totalW - x));
    right.style.width = `${rightW}px`;
  });
  divider.addEventListener("pointerup", (e) => {
    dragging = false;
    try { divider.releasePointerCapture(e.pointerId); } catch {}
  });

  return splitEl;
}

function sanitizeFieldName(name, used) {
  let f = String(name).replace(/[^a-zA-Z0-9_]/g, "_");
  if (!f) f = "col";
  if (/^\d/.test(f)) f = "_" + f;
  let out = f;
  let i = 2;
  while (used.has(out)) out = `${f}_${i++}`;
  used.add(out);
  return out;
}

/**
 * showParameterGrid
 *
 * @param {{
 *   instances: any[],
 *   resolver: any,
 *   roomCategoryName?: string,
 *   panelTitle?: string,
 *   onCellSelected: (rowIndex:number, info:any)=>void,
 *   onCellEdited?: (rowIndex:number, info:any)=>void,
 *   initialGridWidthPx?: number,
 *   minColumnWidthPx?: number,
 * }} opts
 */
export async function showParameterGrid(opts) {
  await ensureTabulatorLoaded();
  ensureBaseStyles();

  const {
    instances,
    resolver,
    roomCategoryName = "Rooms",
    panelTitle = "Room Parameters",
    initialGridWidthPx = 560,
    minColumnWidthPx = 160,
  } = opts ?? {};

  if (!instances || !resolver) throw new Error("showParameterGrid: instances + resolver are required.");
  
  const canvas = document.querySelector(".ara3d-canvas");
  if (!canvas) throw new Error("showParameterGrid: could not find .ara3d-canvas");

  const split = makeSplitLayout(canvas);
  const right = split.querySelector(".ara3d-right");
  right.style.width = `${initialGridWidthPx}px`;

  // Right panel contents
  right.innerHTML = "";
  const bar = document.createElement("div");
  bar.className = "ara3d-gridbar";

  const titleEl = document.createElement("div");
  titleEl.className = "ara3d-gridtitle";
  titleEl.textContent = panelTitle;

  const searchWrap = document.createElement("div");
  searchWrap.className = "ara3d-gridsearch";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Filter rooms…";
  searchWrap.appendChild(searchInput);

  bar.appendChild(titleEl);
  bar.appendChild(searchWrap);

  const host = document.createElement("div");
  host.className = "ara3d-gridhost";

  right.appendChild(bar);
  right.appendChild(host);

  // Build rows + collect parameter names
  const paramNameSet = new Set();
  const roomRows = [];
  for (const inst of instances) {
    if (resolver.GetInstanceCategoryName(inst) !== roomCategoryName) continue;

    const entity = inst.entity;
    const roomName = resolver.GetInstanceName(inst) ?? "";
    const params = resolver.ParameterMap?.get(entity) ?? [];
    for (const p of params) {
      if (p?.Name != null) paramNameSet.add(String(p.Name));
    }
    roomRows.push({ inst, entity, roomName, params });
  }

  const paramNames = Array.from(paramNameSet).sort((a, b) => a.localeCompare(b));

  // Map parameter names to safe fields for Tabulator
  const usedFields = new Set();
  const fieldFor = new Map();
  fieldFor.set("RoomName", "RoomName");
  usedFields.add("RoomName");
  for (const pn of paramNames) fieldFor.set(pn, sanitizeFieldName(pn, usedFields));

  // Create tabular row data
  const tableData = roomRows.map((r, rowIndex) => {
    const obj = {
      __rowIndex: rowIndex,
      __entity: r.entity,
      __instance: r.inst,
      RoomName: r.roomName,
    };
    for (const p of r.params) {
      const name = String(p.Name);
      const field = fieldFor.get(name);
      if (field) obj[field] = p.Value;
    }
    return obj;
  });

  // Columns (RoomName + all params), with a sane minimum width
  const columns = [
    { title: "RoomName", field: "RoomName", editor: "input", minWidth: minColumnWidthPx, headerSort: true, resizable: true, frozen: true },
    ...paramNames.map((pn) => ({
      title: pn,
      field: fieldFor.get(pn),
      editor: "input",
      minWidth: minColumnWidthPx,
      headerSort: true,
      resizable: true,
    })),
  ];

  titleEl.textContent = `${panelTitle} (${roomRows.length} rooms, ${paramNames.length} params)`;

  // Build Tabulator
  const table = new window.Tabulator(host, {
    data: tableData,
    columns,
    // With many columns, you WANT horizontal scrolling:
    layout: "fitData",                 // columns size to data; table scrolls horizontally
    height: "100%",                    // enable internal vertical scroll
    movableColumns: true,
    reactiveData: true,
    clipboard: true,
    columnDefaults: {
      tooltip: true,
      minWidth: minColumnWidthPx,
    },
    rowHeight: 28,
    headerHeight: 32,
  });

  // Simple filter: search RoomName + visible cells
  searchInput.addEventListener("input", () => {
    const q = searchInput.value.trim().toLowerCase();
    if (!q) {
      table.clearFilter(true);
      return;
    }
    table.setFilter((data) => {
      // quick & dirty: scan values (fine for ~54 rooms)
      for (const k in data) {
        if (k.startsWith("__")) continue;
        const v = data[k];
        if (v == null) continue;
        const s = String(v).toLowerCase();
        if (s.includes(q)) return true;
      }
      return false;
    });
  });

  // Return a tiny API
  return {
    table,
    destroy() {
      table?.destroy?.();
      // keep split layout; remove grid only
      right.innerHTML = "";
    },
  };
}
