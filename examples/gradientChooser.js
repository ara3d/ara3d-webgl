// gradientChooser.js
// ES module
// import { showGradientChooser } from "./gradientChooser.js";

/**
 * @typedef {Object} GradientChooserOptions
 * @property {string[]} parameterNames
 * @property {(parameterName:string)=>Array<any>} getValuesForParameter
 *   Returns an array of values (numbers or strings) for the currently selected parameter,
 *   in the same order as your rooms/entities (so you can color by index).
 *
 * @property {(selection: {
 *   parameterName: string,
 *   order: "asc" | "desc",
 *   mode: "numeric" | "categorical",
 *   paletteId: string,
 *   stops: Array<{t:number, color:string}>,
 *   categories?: string[],
 *   domain?: {min:number, max:number},
 *   mapValueToColor: (value:any)=>string,
 * })=>void} onChange
 *
 * @property {string} [mountSelector]      // default "body"
 * @property {string} [title]              // default "Color by Parameter"
 * @property {string} [initialParameter]   // default first in parameterNames
 * @property {"asc"|"desc"} [initialOrder] // default "asc"
 * @property {string} [initialPaletteId]   // default "viridis"
 * @property {number} [categoricalMax]     // default 20 (max categories shown)
 */

const DEFAULT_PALETTES = [
  // Good for numeric (perceptually uniform-ish and common)
  {
    id: "viridis",
    name: "Viridis (numeric)",
    kind: "numeric",
    stops: [
      { t: 0.0, color: "#440154" },
      { t: 0.25, color: "#3B528B" },
      { t: 0.5, color: "#21918C" },
      { t: 0.75, color: "#5EC962" },
      { t: 1.0, color: "#FDE725" },
    ],
  },
  {
    id: "magma",
    name: "Magma (numeric)",
    kind: "numeric",
    stops: [
      { t: 0.0, color: "#000004" },
      { t: 0.25, color: "#3B0F70" },
      { t: 0.5, color: "#8C2981" },
      { t: 0.75, color: "#DE4968" },
      { t: 1.0, color: "#FEEDAA" },
    ],
  },
  // Diverging is useful when values can be above/below a reference (or for contrast)
  {
    id: "blueWhiteRed",
    name: "Blue–White–Red (diverging)",
    kind: "numeric",
    stops: [
      { t: 0.0, color: "#2B6CB0" },
      { t: 0.5, color: "#FFFFFF" },
      { t: 1.0, color: "#C53030" },
    ],
  },
  // Categorical (strings, enums): limited, distinct colors
  {
    id: "category10",
    name: "Category 10 (strings)",
    kind: "categorical",
    colors: [
      "#1f77b4", "#ff7f0e", "#2ca02c", "#d62728", "#9467bd",
      "#8c564b", "#e377c2", "#7f7f7f", "#bcbd22", "#17becf",
    ],
  },
  {
    id: "pastel12",
    name: "Pastel 12 (strings)",
    kind: "categorical",
    colors: [
      "#66c2a5", "#fc8d62", "#8da0cb", "#e78ac3",
      "#a6d854", "#ffd92f", "#e5c494", "#b3b3b3",
      "#a1dab4", "#41b6c4", "#2c7fb8", "#253494",
    ],
  },
];

function ensureStyles() {
  const id = "ara3d-gradient-chooser-style";
  if (document.getElementById(id)) return;
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
    if (k === "class") n.className = v;
    else if (k === "text") n.textContent = v;
    else if (k.startsWith("on") && typeof v === "function") n.addEventListener(k.slice(2).toLowerCase(), v);
    else n.setAttribute(k, String(v));
  }
  for (const c of children) n.appendChild(c);
  return n;
}

function clamp01(t) { return Math.max(0, Math.min(1, t)); }

function hexToRgb(hex) {
  const h = hex.replace("#", "").trim();
  const full = h.length === 3 ? h.split("").map(ch => ch + ch).join("") : h;
  const n = parseInt(full, 16);
  return { r: (n >> 16) & 255, g: (n >> 8) & 255, b: n & 255 };
}
function rgbToHex({ r, g, b }) {
  const to2 = (x) => x.toString(16).padStart(2, "0");
  return "#" + to2(r) + to2(g) + to2(b);
}
function lerp(a, b, t) { return a + (b - a) * t; }

function lerpColor(c0, c1, t) {
  const a = hexToRgb(c0);
  const b = hexToRgb(c1);
  return rgbToHex({
    r: Math.round(lerp(a.r, b.r, t)),
    g: Math.round(lerp(a.g, b.g, t)),
    b: Math.round(lerp(a.b, b.b, t)),
  });
}

function sampleStops(stops, t) {
  t = clamp01(t);
  if (!stops?.length) return "#cccccc";
  if (t <= stops[0].t) return stops[0].color;
  if (t >= stops[stops.length - 1].t) return stops[stops.length - 1].color;

  for (let i = 0; i < stops.length - 1; i++) {
    const a = stops[i], b = stops[i + 1];
    if (t >= a.t && t <= b.t) {
      const u = (t - a.t) / Math.max(1e-9, (b.t - a.t));
      return lerpColor(a.color, b.color, u);
    }
  }
  return stops[stops.length - 1].color;
}

function computeMode(values) {
  // If at least half of non-empty values parse as finite numbers -> numeric
  let n = 0, num = 0;
  for (const v of values) {
    if (v == null || v === "") continue;
    n++;
    const x = typeof v === "number" ? v : Number(v);
    if (Number.isFinite(x)) num++;
  }
  if (n === 0) return "categorical";
  return (num / n) >= 0.5 ? "numeric" : "categorical";
}

function computeDomain(values) {
  let min = Infinity, max = -Infinity;
  for (const v of values) {
    const x = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(x)) continue;
    min = Math.min(min, x);
    max = Math.max(max, x);
  }
  if (!Number.isFinite(min) || !Number.isFinite(max)) return { min: 0, max: 1 };
  if (min === max) return { min, max: min + 1e-9 };
  return { min, max };
}

function uniqueCategories(values, cap) {
  const seen = new Set();
  const out = [];
  for (const v of values) {
    if (v == null || v === "") continue;
    const s = String(v);
    if (seen.has(s)) continue;
    seen.add(s);
    out.push(s);
    if (out.length >= cap) break;
  }
  // stable-ish ordering: keep discovery order (often meaningful)
  return out;
}

function makeNumericMapper(stops, domain, order) {
  const { min, max } = domain;
  return (value) => {
    const x = typeof value === "number" ? value : Number(value);
    if (!Number.isFinite(x)) return "#bbbbbb";
    let t = (x - min) / (max - min);
    t = clamp01(t);
    if (order === "desc") t = 1 - t;
    return sampleStops(stops, t);
  };
}

function makeCategoricalMapper(colors, categories, order) {
  // map category string -> color by index
  const list = order === "desc" ? [...categories].reverse() : categories;
  const map = new Map();
  for (let i = 0; i < list.length; i++) {
    map.set(list[i], colors[i % colors.length]);
  }
  return (value) => {
    if (value == null || value === "") return "#bbbbbb";
    const s = String(value);
    return map.get(s) ?? "#bbbbbb";
  };
}

function gradientCssFromStops(stops, order) {
  const s = order === "desc" ? [...stops].map(p => ({ t: 1 - p.t, color: p.color })).sort((a,b)=>a.t-b.t) : stops;
  const parts = s.map(p => `${p.color} ${(p.t * 100).toFixed(1)}%`);
  return `linear-gradient(90deg, ${parts.join(", ")})`;
}

/**
 * Show a compact gradient chooser.
 * Returns a small API: { destroy(), setParameterNames(names), setSelectedParameter(name) }
 */
export function showGradientChooser(options) {
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
    categoricalMax = 20,
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

  // UI elements
  const root = el("div", { class: "ara3d-gradpanel" });
  const hdr = el("div", { class: "hdr" }, [
    el("div", { class: "title", text: title }),
    el("button", { text: "Close", onClick: () => api.destroy() }),
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

  // Rows
  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Parameter" }),
    paramSelect,
  ]));

  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Palette" }),
    paletteSelect,
  ]));

  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Order" }),
    el("div", { class: "ara3d-smallrow" }, [
      ascRadio, el("span", { text: "Ascending" }),
      descRadio, el("span", { text: "Descending" }),
    ]),
  ]));

  body.appendChild(el("div", { class: "ara3d-row" }, [
    el("label", { text: "Mode" }),
    el("div", { class: "ara3d-smallrow" }, [
      modeNumeric, el("span", { text: "Numeric" }),
      modeCategorical, el("span", { text: "Categorical" }),
    ]),
  ]));

  body.appendChild(preview);
  body.appendChild(note);

  root.appendChild(hdr);
  root.appendChild(body);

  // Mount
  const mount = document.querySelector(mountSelector);
  if (!mount) throw new Error(`showGradientChooser: mountSelector not found: ${mountSelector}`);
  mount.appendChild(root);

  // State
  let selectedParameter = initialParameter;
  let selectedOrder = initialOrder;
  let selectedPaletteId = initialPaletteId;
  let selectedMode = "numeric"; // will auto-detect and then set

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
    // Keep current if compatible; otherwise choose a sensible default
    const p = DEFAULT_PALETTES.find(x => x.id === selectedPaletteId);
    if (mode === "numeric") {
      if (p?.kind === "numeric") return;
      selectedPaletteId = "viridis";
    } else {
      if (p?.kind === "categorical") return;
      selectedPaletteId = "category10";
    }
  }

  function getPalette() {
    return DEFAULT_PALETTES.find(p => p.id === selectedPaletteId) ?? DEFAULT_PALETTES[0];
  }

  function refresh() {
    const values = getValuesForParameter(selectedParameter) ?? [];
    const inferred = computeMode(values);

    // If user hasn't explicitly picked a mode yet, follow inference.
    // (We still let user override via the radio buttons.)
    if (selectedMode !== "numeric" && selectedMode !== "categorical") selectedMode = inferred;

    // If the currently checked mode disagrees with selectedMode, sync from UI
    // (UI is source of truth after init)
    selectedMode = modeNumeric.checked ? "numeric" : (modeCategorical.checked ? "categorical" : inferred);

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

      note.textContent = `Numeric mode: maps ${selectedParameter} from [${min} … ${max}] to colors.`;

      const mapValueToColor = makeNumericMapper(stops, domain, selectedOrder);

      onChange({
        parameterName: selectedParameter,
        order: selectedOrder,
        mode: "numeric",
        paletteId: palette.id,
        stops,
        domain,
        mapValueToColor,
      });
    } else {
      const categories = uniqueCategories(values, categoricalMax);
      const colors = palette.colors ?? DEFAULT_PALETTES.find(p => p.id === "category10").colors;

      // Show a "striped" preview for categorical
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
        stops: [], // not used
        mapValueToColor,
      });
    }
  }

  // Init selects
  setParamOptions(parameterNames);
  setPaletteOptions();
  paramSelect.value = selectedParameter;
  paletteSelect.value = selectedPaletteId;

  ascRadio.checked = selectedOrder === "asc";
  descRadio.checked = selectedOrder === "desc";

  // Auto-detect mode on first load
  const inferred = computeMode(getValuesForParameter(selectedParameter) ?? []);
  selectedMode = inferred;
  modeNumeric.checked = inferred === "numeric";
  modeCategorical.checked = inferred === "categorical";
  pickPaletteForMode(selectedMode);
  paletteSelect.value = selectedPaletteId;

  // Wire events
  paramSelect.addEventListener("change", () => {
    selectedParameter = paramSelect.value;
    // re-infer when parameter changes
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

  // Do initial callback
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
      if (!parameterNames.includes(name)) return;
      selectedParameter = name;
      paramSelect.value = name;
      refresh();
    },
  };

  return api;
}
