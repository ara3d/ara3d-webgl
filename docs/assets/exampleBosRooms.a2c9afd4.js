import { V as Viewer, B as BimOpenSchemaLoader, y as MeshStandardMaterial, C as Color } from "./viewer.cf996c39.js";
import { D as DataTable } from "./DataTable.080f84a9.js";
const TABULATOR_CSS = "https://unpkg.com/tabulator-tables@6.3.1/dist/css/tabulator.min.css";
const TABULATOR_JS = "https://unpkg.com/tabulator-tables@6.3.1/dist/js/tabulator.min.js";
async function ensureTabulatorLoaded() {
  if (window.Tabulator)
    return;
  if (!document.querySelector(`link[data-tabulator="true"]`)) {
    const link = document.createElement("link");
    link.rel = "stylesheet";
    link.href = TABULATOR_CSS;
    link.dataset.tabulator = "true";
    document.head.appendChild(link);
  }
  await new Promise((resolve, reject) => {
    const existing = document.querySelector(`script[data-tabulator="true"]`);
    if (existing) {
      existing.addEventListener("load", resolve, { once: true });
      existing.addEventListener("error", reject, { once: true });
      if (window.Tabulator)
        resolve();
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
  if (!window.Tabulator)
    throw new Error("Tabulator failed to load.");
}
function sanitizeFieldName(name, used) {
  let f = String(name).replace(/[^a-zA-Z0-9_]/g, "_");
  if (!f)
    f = "col";
  if (/^\d/.test(f))
    f = "_" + f;
  let out = f;
  let i = 2;
  while (used.has(out))
    out = `${f}_${i++}`;
  used.add(out);
  return out;
}
function ensureAttachedElement(el2) {
  if (!(el2 instanceof HTMLElement))
    throw new Error("showParameterGrid: host must be an HTMLElement.");
  if (!document.documentElement.contains(el2)) {
    throw new Error("showParameterGrid: host element is not attached to the document.");
  }
  const style = getComputedStyle(el2);
  if (style.display === "none") {
    console.warn("showParameterGrid: host has display:none; Tabulator may not layout correctly until shown.");
  }
}
function defaultColumnEditorForSample(sampleValue) {
  return "input";
}
function buildFieldMappings(columnNames, { reservedPrefix = "__" } = {}) {
  const used = /* @__PURE__ */ new Set();
  const fieldForName = /* @__PURE__ */ new Map();
  const nameForField = /* @__PURE__ */ new Map();
  for (const colName of columnNames) {
    const s = String(colName);
    let field;
    if (s.startsWith(reservedPrefix) && /^[a-zA-Z0-9_]+$/.test(s)) {
      field = s;
      used.add(field);
    } else {
      field = sanitizeFieldName(s, used);
    }
    fieldForName.set(s, field);
    nameForField.set(field, s);
  }
  return { fieldForName, nameForField };
}
function dataTableToTabulatorObjects(dataTable, fieldForName) {
  const objs = dataTable.toObjects();
  if (!objs.length)
    return [];
  let needsRemap = false;
  for (const k of Object.keys(objs[0])) {
    if (fieldForName.get(k) !== k) {
      needsRemap = true;
      break;
    }
  }
  if (!needsRemap)
    return objs;
  return objs.map((o) => {
    const out = {};
    for (const [k, v] of Object.entries(o)) {
      const field = fieldForName.get(k) ?? k;
      out[field] = v;
    }
    return out;
  });
}
function buildColumnsFromDataTable(dataTable, opts) {
  const {
    fieldForName,
    frozenColumns = [],
    hiddenColumns = [],
    minColumnWidthPx = 140,
    editableColumns = "all",
    columnOverrides = {},
    sampleRowsForEditor = 32
  } = opts;
  const colNames = dataTable.getColumnNames();
  const hidden = new Set(hiddenColumns.map(String));
  const frozen = new Set(frozenColumns.map(String));
  const editableSet = editableColumns === "all" ? null : editableColumns === "none" ? /* @__PURE__ */ new Set() : new Set(editableColumns.map(String));
  const rows = dataTable.getNumRows();
  const sampleN = Math.min(rows, sampleRowsForEditor);
  const columns = colNames.map((name) => {
    const field = fieldForName.get(name) ?? name;
    const override = columnOverrides[name] ?? {};
    let editor = override.editor;
    if (editor === void 0) {
      const isEditable = editableSet === null ? true : editableSet.has(name);
      if (!isEditable || String(name).startsWith("__"))
        editor = false;
      else {
        const col = dataTable.tryGetColumnFromName(name);
        if (col) {
          for (let i = 0; i < sampleN; i++) {
            const v = col[i];
            if (v !== void 0 && v !== null) {
              break;
            }
          }
        }
        editor = defaultColumnEditorForSample();
      }
    }
    const colDef = {
      title: name,
      field,
      editor,
      minWidth: minColumnWidthPx,
      headerSort: true,
      resizable: true,
      tooltip: true,
      ...frozen.has(name) ? { frozen: true } : {},
      ...hidden.has(name) ? { visible: false } : {},
      ...override
    };
    return colDef;
  });
  return columns;
}
async function showParameterGrid(opts) {
  await ensureTabulatorLoaded();
  const {
    host,
    dataTable,
    title = "Parameters",
    showSearch = true,
    minColumnWidthPx = 140,
    frozenColumns = [],
    hiddenColumns = [],
    editableColumns = "all",
    columnOverrides = {},
    tabulatorOptions = {},
    onCellEdited = null,
    onRowHover = null
  } = opts ?? {};
  if (!host)
    throw new Error("showParameterGrid: host is required.");
  ensureAttachedElement(host);
  if (!dataTable)
    throw new Error("showParameterGrid: dataTable is required.");
  if (typeof dataTable.getColumnNames !== "function" || typeof dataTable.toObjects !== "function") {
    throw new Error("showParameterGrid: dataTable must look like the DataTable class (getColumnNames, toObjects, ...).");
  }
  host.innerHTML = "";
  const container = document.createElement("div");
  container.style.display = "flex";
  container.style.flexDirection = "column";
  container.style.height = "100%";
  container.style.minHeight = "0";
  const bar = document.createElement("div");
  bar.style.display = "flex";
  bar.style.alignItems = "center";
  bar.style.gap = "8px";
  bar.style.padding = "10px";
  bar.style.borderBottom = "1px solid rgba(0,0,0,0.08)";
  bar.style.background = "#fafafa";
  const titleEl = document.createElement("div");
  titleEl.style.fontWeight = "600";
  titleEl.style.fontSize = "14px";
  titleEl.style.flex = "1";
  titleEl.style.whiteSpace = "nowrap";
  titleEl.style.overflow = "hidden";
  titleEl.style.textOverflow = "ellipsis";
  titleEl.textContent = title;
  const searchWrap = document.createElement("div");
  searchWrap.style.display = showSearch ? "block" : "none";
  const searchInput = document.createElement("input");
  searchInput.type = "search";
  searchInput.placeholder = "Filter\u2026";
  searchInput.style.width = "240px";
  searchInput.style.maxWidth = "40vw";
  searchInput.style.padding = "6px 8px";
  searchInput.style.border = "1px solid rgba(0,0,0,0.18)";
  searchInput.style.borderRadius = "8px";
  searchInput.style.fontSize = "13px";
  searchInput.style.outline = "none";
  searchInput.style.background = "#fff";
  searchWrap.appendChild(searchInput);
  bar.appendChild(titleEl);
  bar.appendChild(searchWrap);
  const gridHost = document.createElement("div");
  gridHost.style.flex = "1 1 auto";
  gridHost.style.minHeight = "0";
  container.appendChild(bar);
  container.appendChild(gridHost);
  host.appendChild(container);
  const colNames = dataTable.getColumnNames();
  const { fieldForName, nameForField } = buildFieldMappings(colNames);
  hiddenColumns.push("__rowIndex");
  const columns = buildColumnsFromDataTable(dataTable, {
    fieldForName,
    frozenColumns,
    hiddenColumns,
    minColumnWidthPx,
    editableColumns,
    columnOverrides
  });
  const tableData = dataTableToTabulatorObjects(dataTable, fieldForName).map((o, i) => ({ __rowIndex: i, ...o }));
  titleEl.textContent = `${title} (${dataTable.getNumRows?.() ?? tableData.length} rows, ${colNames.length} cols)`;
  const table = new window.Tabulator(gridHost, {
    data: tableData,
    columns,
    layout: "fitData",
    height: "100%",
    movableColumns: true,
    reactiveData: true,
    clipboard: true,
    rowHeight: 28,
    headerHeight: 32,
    columnDefaults: {
      tooltip: true,
      minWidth: minColumnWidthPx
    },
    ...tabulatorOptions
  });
  let built = false;
  table.on("tableBuilt", () => {
    built = true;
  });
  if (showSearch) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) {
        table.clearFilter(true);
        return;
      }
      table.setFilter((row) => {
        for (const k in row) {
          if (k.startsWith("__"))
            continue;
          const v = row[k];
          if (v == null)
            continue;
          if (String(v).toLowerCase().includes(q))
            return true;
        }
        return false;
      });
    });
  }
  if (onCellEdited) {
    table.on("cellEdited", (cell) => {
      const field = cell.getField();
      const columnName = nameForField.get(field) ?? field;
      const value = cell.getValue();
      const oldValue = cell.getOldValue?.();
      const row = cell.getRow();
      const rowIndex = row.getPosition(true);
      const rowData = row.getData();
      onCellEdited({ rowIndex, columnName, value, oldValue, rowData });
    });
  }
  if (onRowHover) {
    let last = -1;
    const emit = (idx) => {
      if (idx === last)
        return;
      last = idx;
      onRowHover(idx);
    };
    table.on("rowMouseEnter", (e, row) => {
      const data = row.getData();
      if (typeof data.__rowIndex === "number")
        emit(data.__rowIndex);
      else
        emit(row.getPosition(true));
    });
    table.on("rowMouseLeave", () => {
      emit(-1);
    });
    gridHost.addEventListener("mouseleave", () => emit(-1));
  }
  function setDataTable(newDataTable) {
    if (!newDataTable)
      return;
    const newColNames = newDataTable.getColumnNames();
    const maps = buildFieldMappings(newColNames);
    const newColumns = buildColumnsFromDataTable(newDataTable, {
      fieldForName: maps.fieldForName,
      frozenColumns,
      hiddenColumns,
      minColumnWidthPx,
      editableColumns,
      columnOverrides
    });
    const newData = dataTableToTabulatorObjects(newDataTable, maps.fieldForName);
    const apply = () => {
      table.setColumns(newColumns);
      table.setData(newData);
      titleEl.textContent = `${title} (${newDataTable.getNumRows?.() ?? newData.length} rows, ${newColNames.length} cols)`;
    };
    if (built)
      apply();
    else
      table.on("tableBuilt", apply);
  }
  function destroy() {
    try {
      table?.destroy?.();
    } catch {
    }
    host.innerHTML = "";
  }
  return { table, setDataTable, destroy };
}
const DEFAULT_PALETTES = [
  {
    id: "viridis",
    name: "Viridis (numeric)",
    kind: "numeric",
    stops: [
      { t: 0, color: "#440154" },
      { t: 0.25, color: "#3B528B" },
      { t: 0.5, color: "#21918C" },
      { t: 0.75, color: "#5EC962" },
      { t: 1, color: "#FDE725" }
    ]
  },
  {
    id: "magma",
    name: "Magma (numeric)",
    kind: "numeric",
    stops: [
      { t: 0, color: "#000004" },
      { t: 0.25, color: "#3B0F70" },
      { t: 0.5, color: "#8C2981" },
      { t: 0.75, color: "#DE4968" },
      { t: 1, color: "#FEEDAA" }
    ]
  },
  {
    id: "blueWhiteRed",
    name: "Blue\u2013White\u2013Red (diverging)",
    kind: "numeric",
    stops: [
      { t: 0, color: "#2B6CB0" },
      { t: 0.5, color: "#FFFFFF" },
      { t: 1, color: "#C53030" }
    ]
  },
  {
    id: "category10",
    name: "Category 10 (strings)",
    kind: "categorical",
    colors: [
      "#1f77b4",
      "#ff7f0e",
      "#2ca02c",
      "#d62728",
      "#9467bd",
      "#8c564b",
      "#e377c2",
      "#7f7f7f",
      "#bcbd22",
      "#17becf"
    ]
  },
  {
    id: "pastel12",
    name: "Pastel 12 (strings)",
    kind: "categorical",
    colors: [
      "#66c2a5",
      "#fc8d62",
      "#8da0cb",
      "#e78ac3",
      "#a6d854",
      "#ffd92f",
      "#e5c494",
      "#b3b3b3",
      "#a1dab4",
      "#41b6c4",
      "#2c7fb8",
      "#253494"
    ]
  }
];
function ensureStyles() {
  const id = "ara3d-gradient-chooser-style";
  if (document.getElementById(id))
    return;
  const style = document.createElement("style");
  style.id = id;
  style.textContent = `
    .ara3d-gradpanel {
      position: fixed;
      left: 12px;
      bottom: 12px;
      width: 360px;
      max-width: calc(100vw - 24px);
      background: #fff;
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 14px;
      box-shadow: 0 12px 30px rgba(0,0,0,0.12);
      font-family: system-ui, -apple-system, Segoe UI, Roboto, Arial, sans-serif;
      overflow: hidden;
      z-index: 9999;
    }
    .ara3d-gradpanel .hdr {
      display: flex;
      align-items: center;
      gap: 8px;
      padding: 10px 12px;
      background: #fafafa;
      border-bottom: 1px solid rgba(0,0,0,0.08);
    }
    .ara3d-gradpanel .hdr .title {
      font-weight: 650;
      font-size: 13.5px;
      flex: 1;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .ara3d-gradpanel .hdr button {
      border: 1px solid rgba(0,0,0,0.15);
      background: #fff;
      border-radius: 10px;
      padding: 6px 10px;
      cursor: pointer;
      font-size: 12px;
    }
    .ara3d-gradpanel .body {
      padding: 10px 12px 12px 12px;
      display: flex;
      flex-direction: column;
      gap: 10px;
    }
    .ara3d-row {
      display: grid;
      grid-template-columns: 120px 1fr;
      gap: 10px;
      align-items: center;
    }
    .ara3d-row label { font-size: 12px; color: rgba(0,0,0,0.70); }
    .ara3d-row select, .ara3d-row input[type="checkbox"] {
      font-size: 12px;
    }
    .ara3d-row select {
      width: 100%;
      padding: 7px 8px;
      border: 1px solid rgba(0,0,0,0.18);
      border-radius: 10px;
      background: #fff;
      outline: none;
    }

    .ara3d-preview {
      border: 1px solid rgba(0,0,0,0.12);
      border-radius: 12px;
      overflow: hidden;
      background: #fff;
    }
    .ara3d-bar {
      height: 18px;
      width: 100%;
    }
    .ara3d-ticks {
      display: flex;
      justify-content: space-between;
      padding: 6px 8px 8px 8px;
      font-size: 11px;
      color: rgba(0,0,0,0.72);
    }
    .ara3d-note {
      font-size: 11px;
      color: rgba(0,0,0,0.6);
      line-height: 1.2;
    }
    .ara3d-smallrow {
      display: flex;
      gap: 10px;
      align-items: center;
      font-size: 12px;
      color: rgba(0,0,0,0.72);
    }
    .ara3d-smallrow input[type="radio"] { transform: translateY(1px); }
  `;
  document.head.appendChild(style);
}
function el(tag, attrs = {}, children = []) {
  const n = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs)) {
    if (k === "class")
      n.className = v;
    else if (k === "text")
      n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function")
      n.addEventListener(k.slice(2).toLowerCase(), v);
    else
      n.setAttribute(k, String(v));
  }
  for (const c of children)
    n.appendChild(c);
  return n;
}
function clamp01(t) {
  return Math.max(0, Math.min(1, t));
}
function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map((ch) => ch + ch).join("") : h;
  const n = parseInt(full, 16);
  return { r: n >> 16 & 255, g: n >> 8 & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  const to2 = (x) => x.toString(16).padStart(2, "0");
  return "#" + to2(r) + to2(g) + to2(b);
}
function lerp(a, b, t) {
  return a + (b - a) * t;
}
function lerpColor(c0, c1, t) {
  const a = hexToRgb(c0);
  const b = hexToRgb(c1);
  return rgbToHex({
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t))
  });
}
function sampleStops(stops, t) {
  t = clamp01(t);
  if (!stops?.length)
    return "#cccccc";
  if (t <= stops[0].t)
    return stops[0].color;
  if (t >= stops[stops.length - 1].t)
    return stops[stops.length - 1].color;
  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / Math.max(1e-9, b.t - a.t);
      return lerpColor(a.color, b.color, u);
    }
  }
  return stops[stops.length - 1].color;
}
function computeMode(values) {
  let n = 0, num = 0;
  for (const v of values) {
    if (v == null || v === "")
      continue;
    n++;
    const x = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(x))
      num++;
  }
  if (n === 0)
    return "categorical";
  return num / n >= 0.5 ? "numeric" : "categorical";
}
function computeDomain(values) {
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    const x = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(x))
      continue;
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max))
    return { min: 0, max: 1 };
  if (min === max)
    return { min, max: min + 1e-9 };
  return { min, max };
}
function uniqueCategories(values, cap) {
  const seen = /* @__PURE__ */ new Set();
  const out = [];
  for (const v of values) {
    if (v == null || v === "")
      continue;
    const s = String(v);
    if (seen.has(s))
      continue;
    seen.add(s);
    out.push(s);
    if (out.length >= cap)
      break;
  }
  return out;
}
function makeNumericMapper(stops, domain, order) {
  const { min, max } = domain;
  return (value) => {
    const x = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(x))
      return "#bbbbbb";
    let t = (x - min) / (max - min);
    t = clamp01(t);
    if (order === "desc")
      t = 1 - t;
    return sampleStops(stops, t);
  };
}
function makeCategoricalMapper(colors, categories, order) {
  const list = order === "desc" ? [...categories].reverse() : categories;
  const map = /* @__PURE__ */ new Map();
  for (let i = 0; i < list.length; i++) {
    map.set(list[i], colors[i % colors.length]);
  }
  return (value) => {
    if (value == null || value === "")
      return "#bbbbbb";
    const s = String(value);
    return map.get(s) ?? "#bbbbbb";
  };
}
function gradientCssFromStops(stops, order) {
  const s = order === "desc" ? [...stops].map((p) => ({ t: 1 - p.t, color: p.color })).sort((a, b) => a.t - b.t) : stops;
  const parts = s.map((p) => `${p.color} ${(p.t * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}
function showGradientChooser(options) {
  ensureStyles();
  const {
    parameterNames,
    getValuesForParameter,
    onChange,
    mountSelector = "body",
    title = "Color by Parameter",
    initialParameter = parameterNames?.[0] ?? "",
    initialOrder = "asc",
    initialPaletteId = "viridis",
    categoricalMax = 20
  } = options ?? {};
  if (!Array.isArray(parameterNames) || parameterNames.length === 0) {
    throw new Error("showGradientChooser: parameterNames must be a non-empty array.");
  }
  if (typeof getValuesForParameter !== "function") {
    throw new Error("showGradientChooser: getValuesForParameter(parameterName) is required.");
  }
  if (typeof onChange !== "function") {
    throw new Error("showGradientChooser: onChange callback is required.");
  }
  const root = el("div", { class: "ara3d-gradpanel" });
  const hdr = el("div", { class: "hdr" }, [
    el("div", { class: "title", text: title }),
    el("button", { text: "Close", onClick: () => api.destroy() })
  ]);
  const paramSelect = el("select");
  const paletteSelect = el("select");
  const ascRadio = el("input", { type: "radio", name: "ara3d-order", value: "asc" });
  const descRadio = el("input", { type: "radio", name: "ara3d-order", value: "desc" });
  const modeNumeric = el("input", { type: "radio", name: "ara3d-mode", value: "numeric" });
  const modeCategorical = el("input", { type: "radio", name: "ara3d-mode", value: "categorical" });
  const bar = el("div", { class: "ara3d-bar" });
  const tickL = el("div", { text: "" });
  const tickM = el("div", { text: "" });
  const tickR = el("div", { text: "" });
  const ticks = el("div", { class: "ara3d-ticks" }, [tickL, tickM, tickR]);
  const preview = el("div", { class: "ara3d-preview" }, [bar, ticks]);
  const note = el("div", { class: "ara3d-note", text: "" });
  const body = el("div", { class: "body" });
  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Parameter" }),
    paramSelect
  ]));
  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Palette" }),
    paletteSelect
  ]));
  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Order" }),
    el("div", { class: "ara3d-smallrow" }, [
      ascRadio,
      el("span", { text: "Ascending" }),
      descRadio,
      el("span", { text: "Descending" })
    ])
  ]));
  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Mode" }),
    el("div", { class: "ara3d-smallrow" }, [
      modeNumeric,
      el("span", { text: "Numeric" }),
      modeCategorical,
      el("span", { text: "Categorical" })
    ])
  ]));
  body.appendChild(preview);
  body.appendChild(note);
  root.appendChild(hdr);
  root.appendChild(body);
  const mount = document.querySelector(mountSelector);
  if (!mount)
    throw new Error(`showGradientChooser: mountSelector not found: ${mountSelector}`);
  mount.appendChild(root);
  let selectedParameter = initialParameter;
  let selectedOrder = initialOrder;
  let selectedPaletteId = initialPaletteId;
  let selectedMode = "numeric";
  function setParamOptions(names) {
    paramSelect.innerHTML = "";
    for (const n of names) {
      paramSelect.appendChild(el("option", { value: n, text: n }));
    }
  }
  function setPaletteOptions() {
    paletteSelect.innerHTML = "";
    for (const p of DEFAULT_PALETTES) {
      paletteSelect.appendChild(el("option", { value: p.id, text: p.name }));
    }
  }
  function pickPaletteForMode(mode) {
    const p = DEFAULT_PALETTES.find((x) => x.id === selectedPaletteId);
    if (mode === "numeric") {
      if (p?.kind === "numeric")
        return;
      selectedPaletteId = "viridis";
    } else {
      if (p?.kind === "categorical")
        return;
      selectedPaletteId = "category10";
    }
  }
  function getPalette() {
    return DEFAULT_PALETTES.find((p) => p.id === selectedPaletteId) ?? DEFAULT_PALETTES[0];
  }
  function refresh() {
    const values = getValuesForParameter(selectedParameter) ?? [];
    const inferred2 = computeMode(values);
    if (selectedMode !== "numeric" && selectedMode !== "categorical")
      selectedMode = inferred2;
    selectedMode = modeNumeric.checked ? "numeric" : modeCategorical.checked ? "categorical" : inferred2;
    pickPaletteForMode(selectedMode);
    paletteSelect.value = selectedPaletteId;
    const palette = getPalette();
    if (selectedMode === "numeric") {
      const domain = computeDomain(values);
      const stops = palette.stops ?? DEFAULT_PALETTES[0].stops;
      bar.style.background = gradientCssFromStops(stops, selectedOrder);
      const min = domain.min;
      const max = domain.max;
      const mid = (min + max) / 2;
      tickL.textContent = selectedOrder === "asc" ? String(min) : String(max);
      tickM.textContent = String(mid);
      tickR.textContent = selectedOrder === "asc" ? String(max) : String(min);
      note.textContent = `Numeric mode: maps ${selectedParameter} from [${min} \u2026 ${max}] to colors.`;
      const mapValueToColor = makeNumericMapper(stops, domain, selectedOrder);
      onChange({
        parameterName: selectedParameter,
        order: selectedOrder,
        mode: "numeric",
        paletteId: palette.id,
        stops,
        domain,
        mapValueToColor
      });
    } else {
      const categories = uniqueCategories(values, categoricalMax);
      const colors = palette.colors ?? DEFAULT_PALETTES.find((p) => p.id === "category10").colors;
      const list = selectedOrder === "desc" ? [...categories].reverse() : categories;
      const stripes = list.length ? list : ["(none)"];
      const stripeStops = stripes.map((_, i) => {
        const t0 = i / stripes.length;
        const t1 = (i + 1) / stripes.length;
        const c = colors[i % colors.length];
        return `${c} ${(t0 * 100).toFixed(1)}%, ${c} ${(t1 * 100).toFixed(1)}%`;
      });
      bar.style.background = `linear-gradient(90deg, ${stripeStops.join(", ")})`;
      tickL.textContent = stripes[0] ?? "";
      tickM.textContent = stripes[Math.floor((stripes.length - 1) / 2)] ?? "";
      tickR.textContent = stripes[stripes.length - 1] ?? "";
      note.textContent = `Categorical mode: ${Math.min(categories.length, categoricalMax)} categories shown (first seen).`;
      const mapValueToColor = makeCategoricalMapper(colors, categories, selectedOrder);
      onChange({
        parameterName: selectedParameter,
        order: selectedOrder,
        mode: "categorical",
        paletteId: palette.id,
        categories,
        stops: [],
        mapValueToColor
      });
    }
  }
  setParamOptions(parameterNames);
  setPaletteOptions();
  paramSelect.value = selectedParameter;
  paletteSelect.value = selectedPaletteId;
  ascRadio.checked = selectedOrder === "asc";
  descRadio.checked = selectedOrder === "desc";
  const inferred = computeMode(getValuesForParameter(selectedParameter) ?? []);
  selectedMode = inferred;
  modeNumeric.checked = inferred === "numeric";
  modeCategorical.checked = inferred === "categorical";
  pickPaletteForMode(selectedMode);
  paletteSelect.value = selectedPaletteId;
  paramSelect.addEventListener("change", () => {
    selectedParameter = paramSelect.value;
    const inf = computeMode(getValuesForParameter(selectedParameter) ?? []);
    selectedMode = inf;
    modeNumeric.checked = inf === "numeric";
    modeCategorical.checked = inf === "categorical";
    pickPaletteForMode(selectedMode);
    paletteSelect.value = selectedPaletteId;
    refresh();
  });
  paletteSelect.addEventListener("change", () => {
    selectedPaletteId = paletteSelect.value;
    refresh();
  });
  ascRadio.addEventListener("change", () => {
    selectedOrder = "asc";
    refresh();
  });
  descRadio.addEventListener("change", () => {
    selectedOrder = "desc";
    refresh();
  });
  modeNumeric.addEventListener("change", () => {
    selectedMode = "numeric";
    pickPaletteForMode(selectedMode);
    paletteSelect.value = selectedPaletteId;
    refresh();
  });
  modeCategorical.addEventListener("change", () => {
    selectedMode = "categorical";
    pickPaletteForMode(selectedMode);
    paletteSelect.value = selectedPaletteId;
    refresh();
  });
  refresh();
  const api = {
    destroy() {
      root.remove();
    },
    setParameterNames(names) {
      setParamOptions(names);
      if (!names.includes(selectedParameter)) {
        selectedParameter = names[0] ?? "";
        paramSelect.value = selectedParameter;
      }
      refresh();
    },
    setSelectedParameter(name) {
      if (!parameterNames.includes(name))
        return;
      selectedParameter = name;
      paramSelect.value = name;
      refresh();
    }
  };
  return api;
}
function setupDividerResize() {
  const app = document.getElementById("app");
  const right = document.getElementById("rightPane");
  const divider = document.getElementById("divider");
  let dragging = false;
  divider.addEventListener("pointerdown", (e) => {
    dragging = true;
    divider.setPointerCapture(e.pointerId);
    e.preventDefault();
  });
  divider.addEventListener("pointermove", (e) => {
    if (!dragging)
      return;
    const totalW = app.getBoundingClientRect().width;
    const x = e.clientX;
    const rightW = Math.max(360, Math.min(totalW * 0.75, totalW - x));
    right.style.width = `${rightW}px`;
  });
  divider.addEventListener("pointerup", (e) => {
    dragging = false;
    try {
      divider.releasePointerCapture(e.pointerId);
    } catch {
    }
  });
}
function ghostedInstance(i) {
  const ghostMaterial = new MeshStandardMaterial({
    color: i.material.color,
    transparent: true,
    opacity: 0.2,
    roughness: 0.8,
    metalness: 0,
    depthWrite: false
  });
  return { ...i, material: ghostMaterial };
}
async function runExample() {
  setupDividerResize();
  const leftPane = document.getElementById("leftPane");
  const gridHost = document.getElementById("gridHost");
  const viewer = new Viewer({ fileDrop: { enable: false } });
  const canvas = document.querySelector(".ara3d-canvas");
  leftPane.appendChild(canvas);
  const loader = new BimOpenSchemaLoader();
  const bimData = await loader.load(
    "/ara3d-webgl/Snowdon Towers Sample Architectural.bos",
    { loadParameters: true }
  );
  const roomInstances = [];
  for (const inst of bimData.Instances) {
    inst.visible = bimData.Resolver.GetInstanceCategoryName(inst) === "Rooms";
    if (inst.visible)
      roomInstances.push(inst);
  }
  let currentRoom = null;
  let ghostGroup = null;
  let mainGroup = null;
  let singleRooms = [];
  let ghostedRoomInstances = [];
  function rebuild() {
    viewer.remove(mainGroup);
    viewer.remove(ghostGroup);
    viewer.remove(currentRoom);
    ghostedRoomInstances = roomInstances.map(ghostedInstance);
    singleRooms = roomInstances.map((i) => bimData.rebuildGeometry([i]));
    mainGroup = bimData.rebuildGeometry(roomInstances);
    ghostGroup = bimData.rebuildGeometry(ghostedRoomInstances);
    viewer.add(mainGroup);
  }
  const materialCache = /* @__PURE__ */ new Map();
  function getMaterialForColor(hexColor) {
    const key = String(hexColor);
    let m = materialCache.get(key);
    if (!m) {
      m = new MeshStandardMaterial({
        color: new Color(key),
        roughness: 0.85,
        metalness: 0,
        flatShading: true
      });
      materialCache.set(key, m);
    }
    return m;
  }
  function applyRoomColors(values, mapValueToColor) {
    for (let i = 0; i < roomInstances.length; i++) {
      const inst = roomInstances[i];
      const v = values[i];
      const color = mapValueToColor(v);
      inst.material = getMaterialForColor(color);
    }
    rebuild();
  }
  const roomTable = new DataTable();
  roomTable.exportNullForMissing = true;
  roomTable.ensureColumn("__entity");
  roomTable.ensureColumn("RoomName");
  const entityToRowIndex = /* @__PURE__ */ new Map();
  for (const inst of roomInstances) {
    const entityKey = inst.entity;
    const params = bimData.Resolver.ParameterMap.get(inst.entity) ?? [];
    const names = ["__entity", "RoomName"];
    const values = [entityKey, bimData.Resolver.GetInstanceName(inst) ?? ""];
    for (const p of params) {
      if (!p?.Name)
        continue;
      names.push(String(p.Name));
      values.push(p.Value);
    }
    const rowIndex = roomTable.addRowFromNamesAndValues(names, values);
    entityToRowIndex.set(entityKey, rowIndex);
  }
  function getValuesForParameter(parameterName) {
    const col = roomTable.tryGetColumnFromName(parameterName);
    if (!col)
      return roomInstances.map((_) => null);
    return col.slice();
  }
  let currentColoring = {
    parameterName: "RoomName",
    mapValueToColor: (v) => "#808080"
  };
  function refreshColorsFromCurrentChoice() {
    const values = getValuesForParameter(currentColoring.parameterName);
    applyRoomColors(values, currentColoring.mapValueToColor);
  }
  function selectElement(rowIndex) {
    viewer.remove(mainGroup);
    viewer.remove(ghostGroup);
    viewer.remove(currentRoom);
    if (rowIndex >= 0) {
      console.log(rowIndex);
      currentRoom = singleRooms[rowIndex];
      viewer.add(ghostGroup);
      viewer.add(currentRoom);
    } else {
      viewer.add(mainGroup);
    }
  }
  const pinnedFirst = ["RoomName"];
  const pinnedSet = new Set(pinnedFirst);
  const skippedSet = new Set(roomTable.getColumnNames().filter((n) => roomTable.isColumnMostlySame(n)));
  const colNames = roomTable.getColumnNames();
  const orderedColNames = [
    ...pinnedFirst.filter((c) => colNames.includes(c)),
    ...colNames.filter((c) => !pinnedSet.has(c) && !skippedSet.has(c)).sort((a, b) => a.localeCompare(b))
  ];
  await showParameterGrid({
    host: gridHost,
    dataTable: roomTable.project({ columns: orderedColNames }),
    title: "Room Parameters",
    frozenColumns: ["RoomName"],
    hiddenColumns: ["__entity"],
    onCellEdited: ({ rowIndex, columnName, value, rowData }) => {
      const entity = rowData?.__entity;
      const stableRowIndex = entity !== void 0 && entityToRowIndex.has(entity) ? entityToRowIndex.get(entity) : rowIndex;
      roomTable.setValue(stableRowIndex, columnName, value);
      if (columnName === currentColoring.parameterName) {
        refreshColorsFromCurrentChoice();
      }
    },
    onRowHover: (rowIndex) => {
      selectElement(rowIndex);
    }
  });
  rebuild();
  showGradientChooser({
    parameterNames: orderedColNames,
    getValuesForParameter,
    onChange: ({ parameterName, mapValueToColor, mode, order }) => {
      console.log("Color by:", parameterName, "mode:", mode, "order:", order);
      currentColoring.parameterName = parameterName;
      currentColoring.mapValueToColor = mapValueToColor;
      refreshColorsFromCurrentChoice();
    },
    title: "Color Rooms"
  });
  refreshColorsFromCurrentChoice();
}
runExample();
//# sourceMappingURL=exampleBosRooms.a2c9afd4.js.map
