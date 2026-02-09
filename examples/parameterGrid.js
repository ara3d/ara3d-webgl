// parameterGrid.js
// A decoupled Tabulator grid that renders a DataTable into a DOM host.
//
// Usage:
//   const grid = await showParameterGrid({
//     host: document.getElementById("grid"),
//     dataTable: dt,
//     title: "Room Parameters",
//     onCellEdited: ({rowIndex, columnName, value, oldValue}) => { ... },
//   });
//   // later:
//   grid.setDataTable(dt2);
//   grid.destroy();

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

  if (!window.Tabulator) throw new Error("Tabulator failed to load.");
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

function ensureAttachedElement(el) {
  if (!(el instanceof HTMLElement)) throw new Error("showParameterGrid: host must be an HTMLElement.");
  if (!document.documentElement.contains(el)) {
    throw new Error("showParameterGrid: host element is not attached to the document.");
  }
  // If the element is display:none, Tabulator can mis-measure.
  // We can't reliably detect all hidden states, but this catches common cases.
  const style = getComputedStyle(el);
  if (style.display === "none") {
    console.warn("showParameterGrid: host has display:none; Tabulator may not layout correctly until shown.");
  }
}

function defaultColumnEditorForSample(sampleValue) {
  // Keep it simple; you can enrich this later.
  // Tabulator "input" works for most, and is safest.
  return "input";
}

function buildFieldMappings(columnNames, { reservedPrefix = "__" } = {}) {
  const used = new Set();
  const fieldForName = new Map(); // displayName -> safeField
  const nameForField = new Map(); // safeField -> displayName

  for (const colName of columnNames) {
    // Keep reserved fields intact if they already look safe.
    // (So "__entity" can remain "__entity" and be used for keying.)
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
  // Expect DataTable.toObjects() returns { [originalName]: value }
  const objs = dataTable.toObjects();
  // Remap keys to safe fields where needed.
  if (!objs.length) return [];

  // If mapping is identity for all keys, return directly.
  let needsRemap = false;
  for (const k of Object.keys(objs[0])) {
    if (fieldForName.get(k) !== k) { needsRemap = true; break; }
  }
  if (!needsRemap) return objs;

  return objs.map(o => {
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
    editableColumns = "all", // "all" | "none" | string[] (column names)
    columnOverrides = {},    // by column name: { editor, formatter, width, ... }
    sampleRowsForEditor = 32,
  } = opts;

  const colNames = dataTable.getColumnNames();

  const hidden = new Set(hiddenColumns.map(String));
  const frozen = new Set(frozenColumns.map(String));

  const editableSet =
    editableColumns === "all" ? null :
    editableColumns === "none" ? new Set() :
    new Set(editableColumns.map(String));

  // Use column sample to pick basic editor (still default to input)
  const rows = dataTable.getNumRows();
  const sampleN = Math.min(rows, sampleRowsForEditor);

  const columns = colNames.map((name) => {
    const field = fieldForName.get(name) ?? name;
    const override = columnOverrides[name] ?? {};

    let editor = override.editor;
    if (editor === undefined) {
      // Determine editable default
      const isEditable =
        editableSet === null ? true :
        editableSet.has(name);

      if (!isEditable || String(name).startsWith("__")) editor = false;
      else {
        // sample one value
        const col = dataTable.tryGetColumnFromName(name);
        let sample = undefined;
        if (col) {
          for (let i = 0; i < sampleN; i++) {
            const v = col[i];
            if (v !== undefined && v !== null) { sample = v; break; }
          }
        }
        editor = defaultColumnEditorForSample(sample);
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
      ...(frozen.has(name) ? { frozen: true } : {}),
      ...(hidden.has(name) ? { visible: false } : {}),
      ...override,
    };

    return colDef;
  });

  return columns;
}

/**
 * showParameterGrid
 *
 * @param {{
 *   host: HTMLElement,
 *   dataTable: any, // your DataTable instance
 *   title?: string,
 *   showSearch?: boolean,
 *   minColumnWidthPx?: number,
 *   frozenColumns?: string[],
 *   hiddenColumns?: string[],
 *   editableColumns?: "all" | "none" | string[],
 *   columnOverrides?: Record<string, any>,
 *   tabulatorOptions?: any,
 *   onCellEdited?: (e:{rowIndex:number, columnName:string, value:any, oldValue:any, rowData:any})=>void,
 * }} opts
 */
export async function showParameterGrid(opts) {
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
  } = opts ?? {};

  if (!host) throw new Error("showParameterGrid: host is required.");
  ensureAttachedElement(host);

  if (!dataTable) throw new Error("showParameterGrid: dataTable is required.");
  if (typeof dataTable.getColumnNames !== "function" || typeof dataTable.toObjects !== "function") {
    throw new Error("showParameterGrid: dataTable must look like the DataTable class (getColumnNames, toObjects, ...).");
  }

  // Build DOM (decoupled)
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
  searchInput.placeholder = "Filter…";
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

  // --- Build mappings/columns/data from DataTable
  const colNames = dataTable.getColumnNames();
  const { fieldForName, nameForField } = buildFieldMappings(colNames);

  const columns = buildColumnsFromDataTable(dataTable, {
    fieldForName,
    frozenColumns,
    hiddenColumns,
    minColumnWidthPx,
    editableColumns,
    columnOverrides,
  });

  const tableData = dataTableToTabulatorObjects(dataTable, fieldForName);

  titleEl.textContent = `${title} (${dataTable.getNumRows?.() ?? tableData.length} rows, ${colNames.length} cols)`;

  // --- Create Tabulator
  const table = new window.Tabulator(gridHost, {
    data: tableData,
    columns,
    layout: "fitData",  // good for many columns (horizontal scroll)
    height: "100%",
    movableColumns: true,
    reactiveData: true,
    clipboard: true,
    rowHeight: 28,
    headerHeight: 32,
    columnDefaults: {
      tooltip: true,
      minWidth: minColumnWidthPx,
    },
    ...tabulatorOptions,
  });

  // Robust: only mutate after built
  let built = false;
  table.on("tableBuilt", () => { built = true; });

  // Filter: scans row values (fine for small/medium)
  if (showSearch) {
    searchInput.addEventListener("input", () => {
      const q = searchInput.value.trim().toLowerCase();
      if (!q) { table.clearFilter(true); return; }

      table.setFilter((row) => {
        for (const k in row) {
          if (k.startsWith("__")) continue;
          const v = row[k];
          if (v == null) continue;
          if (String(v).toLowerCase().includes(q)) return true;
        }
        return false;
      });
    });
  }

  // Cell edits -> callback with original column name
  if (onCellEdited) {
    table.on("cellEdited", (cell) => {
      const field = cell.getField(); // safe field
      const columnName = nameForField.get(field) ?? field;

      const value = cell.getValue();
      const oldValue = cell.getOldValue?.(); // Tabulator provides getOldValue on cell component
      const row = cell.getRow();
      const rowIndex = row.getPosition(true); // note: changes with sorting/filtering
      const rowData = row.getData();

      onCellEdited({ rowIndex, columnName, value, oldValue, rowData });
    });
  }

  // Public API
  function setDataTable(newDataTable) {
    if (!newDataTable) return;

    // Rebuild columns + data from scratch (simple + robust)
    const newColNames = newDataTable.getColumnNames();
    const maps = buildFieldMappings(newColNames);
    const newColumns = buildColumnsFromDataTable(newDataTable, {
      fieldForName: maps.fieldForName,
      frozenColumns,
      hiddenColumns,
      minColumnWidthPx,
      editableColumns,
      columnOverrides,
    });
    const newData = dataTableToTabulatorObjects(newDataTable, maps.fieldForName);

    // Ensure Tabulator is built before applying
    const apply = () => {
      table.setColumns(newColumns);
      table.setData(newData);
      titleEl.textContent = `${title} (${newDataTable.getNumRows?.() ?? newData.length} rows, ${newColNames.length} cols)`;
    };

    if (built) apply();
    else table.on("tableBuilt", apply);
  }

  function destroy() {
    try { table?.destroy?.(); } catch {}
    host.innerHTML = "";
  }

  return { table, setDataTable, destroy };
}
