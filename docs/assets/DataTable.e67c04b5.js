var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
class DataTable {
  constructor() {
    __publicField(this, "_colNames", []);
    __publicField(this, "_colIndex", /* @__PURE__ */ new Map());
    __publicField(this, "_columns", []);
    __publicField(this, "_rowCount", 0);
    __publicField(this, "exportNullForMissing", false);
    __publicField(this, "caseInsensitiveNames", false);
  }
  addRowFromParameters(parameters) {
    const names = new Array(parameters.length);
    const values = new Array(parameters.length);
    for (let i = 0; i < parameters.length; i++) {
      names[i] = parameters[i].Name;
      values[i] = parameters[i].Value;
    }
    return this.addRowFromNamesAndValues(names, values);
  }
  addRowFromNamesAndValues(names, values) {
    if (names.length !== values.length) {
      throw new Error(`DataTable.addRowFromNamesAndValues: names.length (${names.length}) != values.length (${values.length})`);
    }
    const rowIndex = this._rowCount;
    this._rowCount++;
    for (let c = 0; c < this._columns.length; c++) {
      this._columns[c].push(void 0);
    }
    for (let i = 0; i < names.length; i++) {
      const rawName = names[i];
      if (rawName == null)
        continue;
      const name = String(rawName);
      const key = this.normalizeName(name);
      let col = this._colIndex.get(key);
      if (col === void 0) {
        col = this.addColumnInternal(name);
      }
      this._columns[col][rowIndex] = values[i];
    }
    return rowIndex;
  }
  reorderColumns(names) {
    this._colNames = names;
    this._colIndex.clear();
    const newCols = [];
    for (let i = 0; i < this._colNames.length; i++) {
      this._colIndex.set(this._colNames[i], i);
      newCols.push(this._columns[i]);
    }
    this._columns = newCols;
  }
  getColumnNames() {
    return this._colNames.slice();
  }
  getNumRows() {
    return this._rowCount;
  }
  getNumColumns() {
    return this._columns.length;
  }
  hasColumn(name) {
    return this._colIndex.has(this.normalizeName(name));
  }
  getColumnIndex(name) {
    const idx = this._colIndex.get(this.normalizeName(name));
    return idx === void 0 ? -1 : idx;
  }
  getColumnName(n) {
    if (n < 0 || n >= this._colNames.length)
      throw new Error(`Column index out of range: ${n}`);
    return this._colNames[n];
  }
  getColumnFromName(name) {
    const idx = this.getColumnIndex(name);
    if (idx < 0)
      throw new Error(`Unknown column: ${name}`);
    return this._columns[idx];
  }
  tryGetColumnFromName(name) {
    const idx = this._colIndex.get(this.normalizeName(name));
    return idx === void 0 ? void 0 : this._columns[idx];
  }
  getRows() {
    const rows = new Array(this._rowCount);
    const cols = this._columns.length;
    for (let r = 0; r < this._rowCount; r++) {
      const row = new Array(cols);
      for (let c = 0; c < cols; c++) {
        const v = this._columns[c][r];
        row[c] = v === void 0 && this.exportNullForMissing ? null : v;
      }
      rows[r] = row;
    }
    return rows;
  }
  getRowArray(rowIndex) {
    this.ensureRowIndex(rowIndex);
    const cols = this._columns.length;
    const row = new Array(cols);
    for (let c = 0; c < cols; c++) {
      const v = this._columns[c][rowIndex];
      row[c] = v === void 0 && this.exportNullForMissing ? null : v;
    }
    return row;
  }
  getRowObject(rowIndex) {
    this.ensureRowIndex(rowIndex);
    const obj = {};
    for (let c = 0; c < this._columns.length; c++) {
      const v = this._columns[c][rowIndex];
      if (v !== void 0 || this.exportNullForMissing) {
        obj[this._colNames[c]] = v === void 0 && this.exportNullForMissing ? null : v;
      }
    }
    return obj;
  }
  toObjects() {
    const out = new Array(this._rowCount);
    for (let r = 0; r < this._rowCount; r++)
      out[r] = this.getRowObject(r);
    return out;
  }
  toTabulatorColumns(options) {
    const titleCase = options?.titleCase ?? false;
    const inferTypes = options?.inferTypes ?? true;
    const sampleRows = options?.sampleRows ?? 64;
    const cols = new Array(this._colNames.length);
    for (let c = 0; c < this._colNames.length; c++) {
      const field = this._colNames[c];
      const title = titleCase ? this.toTitleCase(field) : field;
      const def = { title, field };
      if (inferTypes) {
        const t = this.inferColumnType(c, sampleRows);
        if (t === "number")
          def.sorter = "number";
        else if (t === "boolean")
          def.sorter = "boolean";
        else if (t === "date")
          def.sorter = "date";
        else
          def.sorter = "string";
      }
      cols[c] = def;
    }
    return cols;
  }
  where(predicate) {
    const result = [];
    for (let r = 0; r < this._rowCount; r++) {
      if (predicate(this.getRowObject(r), r))
        result.push(r);
    }
    return result;
  }
  whereColumn(name, predicate) {
    const col = this.getColumnFromName(name);
    const result = [];
    for (let r = 0; r < this._rowCount; r++) {
      if (predicate(col[r], r))
        result.push(r);
    }
    return result;
  }
  project(options) {
    const rowIdx = options.rows ?? this.range(0, this._rowCount);
    const requestedCols = options.columns ?? this._colNames.slice();
    const t = new DataTable();
    t.exportNullForMissing = this.exportNullForMissing;
    t.caseInsensitiveNames = this.caseInsensitiveNames;
    const resolved = requestedCols.map((reqName) => {
      const srcIndex = this.getColumnIndex(reqName);
      const outName = srcIndex >= 0 ? this._colNames[srcIndex] : reqName;
      return { reqName, srcIndex, outName };
    });
    for (const c of resolved)
      t.ensureColumn(c.outName);
    for (const r of rowIdx) {
      this.ensureRowIndex(r);
      const names = [];
      const vals = [];
      for (const c of resolved) {
        const v = c.srcIndex < 0 ? void 0 : this._columns[c.srcIndex][r];
        names.push(c.outName);
        vals.push(v);
      }
      t.addRowFromNamesAndValues(names, vals);
    }
    return t;
  }
  buildIndex(name) {
    const col = this.getColumnFromName(name);
    const map = /* @__PURE__ */ new Map();
    for (let r = 0; r < this._rowCount; r++) {
      const v = col[r];
      let arr = map.get(v);
      if (!arr) {
        arr = [];
        map.set(v, arr);
      }
      arr.push(r);
    }
    return map;
  }
  ensureColumn(name) {
    const key = this.normalizeName(name);
    const idx = this._colIndex.get(key);
    if (idx !== void 0)
      return idx;
    return this.addColumnInternal(name);
  }
  addColumn(name, defaultValue = void 0) {
    const key = this.normalizeName(name);
    if (this._colIndex.has(key))
      throw new Error(`Column already exists: ${name}`);
    const idx = this.addColumnInternal(name);
    if (defaultValue !== void 0) {
      const col = this._columns[idx];
      for (let r = 0; r < this._rowCount; r++)
        col[r] = defaultValue;
    }
    return idx;
  }
  setValue(rowIndex, columnName, value) {
    this.ensureRowIndex(rowIndex);
    const c = this.ensureColumn(columnName);
    this._columns[c][rowIndex] = value;
  }
  getValue(rowIndex, columnName) {
    this.ensureRowIndex(rowIndex);
    const c = this.getColumnIndex(columnName);
    return c < 0 ? void 0 : this._columns[c][rowIndex];
  }
  clone() {
    const t = new DataTable();
    t.exportNullForMissing = this.exportNullForMissing;
    t.caseInsensitiveNames = this.caseInsensitiveNames;
    t._colNames = this._colNames.slice();
    t._colIndex = new Map(this._colIndex);
    t._columns = this._columns.map((col) => col.slice());
    t._rowCount = this._rowCount;
    return t;
  }
  addColumnInternal(displayName) {
    const idx = this._columns.length;
    this._colNames.push(displayName);
    this._colIndex.set(this.normalizeName(displayName), idx);
    const col = new Array(this._rowCount);
    for (let r = 0; r < this._rowCount; r++)
      col[r] = void 0;
    this._columns.push(col);
    return idx;
  }
  normalizeName(name) {
    return this.caseInsensitiveNames ? name.toLowerCase() : name;
  }
  ensureRowIndex(rowIndex) {
    if (rowIndex < 0 || rowIndex >= this._rowCount) {
      throw new Error(`Row index out of range: ${rowIndex} (rows=${this._rowCount})`);
    }
  }
  range(start, end) {
    const n = Math.max(0, end - start);
    const arr = new Array(n);
    for (let i = 0; i < n; i++)
      arr[i] = start + i;
    return arr;
  }
  inferColumnType(colIndex, sampleRows) {
    const col = this._columns[colIndex];
    const n = Math.min(this._rowCount, sampleRows);
    let sawNumber = false;
    let sawBoolean = false;
    let sawDate = false;
    let sawOther = false;
    for (let r = 0; r < n; r++) {
      const v = col[r];
      if (v === void 0 || v === null)
        continue;
      const t = typeof v;
      if (t === "number")
        sawNumber = true;
      else if (t === "boolean")
        sawBoolean = true;
      else if (v instanceof Date)
        sawDate = true;
      else if (t === "string") {
        if (!sawDate && this.looksLikeDate(v))
          sawDate = true;
        else
          sawOther = true;
      } else {
        sawOther = true;
      }
      if (sawOther)
        break;
    }
    if (!sawOther && sawBoolean && !sawNumber && !sawDate)
      return "boolean";
    if (!sawOther && sawNumber && !sawBoolean && !sawDate)
      return "number";
    if (!sawOther && sawDate && !sawBoolean && !sawNumber)
      return "date";
    return "string";
  }
  looksLikeDate(s) {
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s);
  }
  toTitleCase(s) {
    return s.replace(/([A-Z])/g, " $1").replace(/[_-]+/g, " ").trim().replace(/\s+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  }
  static mostlySame(values) {
    if (!values)
      return true;
    if (values.length <= 1)
      return true;
    const first = values[0];
    const isFirstNumber = Number.isFinite(first);
    for (const v of values) {
      if (v != first) {
        if (isFirstNumber && Number.isFinite(v)) {
          if (Math.abs(first - v) > 1e-3) {
            return false;
          }
        } else {
          return false;
        }
      }
    }
    return true;
  }
  isColumnMostlySame(columnName) {
    const col = this.tryGetColumnFromName(columnName);
    return DataTable.mostlySame(col);
  }
}
export {
  DataTable as D
};
//# sourceMappingURL=DataTable.e67c04b5.js.map
