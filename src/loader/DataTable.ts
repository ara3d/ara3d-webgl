import { Parameter } from './Parameter'

/**
 * A sparse-ish, runtime-schema table optimized for:
 * - appending rows where columns are discovered over time
 * - fast column lookup by name
 * - exporting rows for UI grids (e.g., Tabulator)
 *
 * Internals:
 * - canonical storage is columnar: columns: any[][]
 * - name -> column index map
 * - optional rowCount
 *
 * Complexity notes:
 * - addRow is O(k + newCols * rowCountFill) but we fill missing cells
 *   lazily per new column by pushing undefined for existing rows (O(rowCount)).
 * - getColumnFromName is O(1)
 * - getRows materializes rows O(rows * cols) (avoid calling repeatedly in hot paths)
 */
export class DataTable {
  private _colNames: string[] = []
  private _colIndex = new Map<string, number>()
  private _columns: any[][] = []
  private _rowCount = 0

  /** If true, missing cells are exported as null instead of undefined (helpful for some UIs). */
  public exportNullForMissing: boolean = false

  /** If true, column names are treated case-insensitively (stored by normalized key). */
  public caseInsensitiveNames: boolean = false

  // -------------- Core row add APIs --------------

  public addRowFromParameters (parameters: Array<Parameter>): number {
    // coalesce duplicate names in the same row; last value wins
    const names: string[] = new Array(parameters.length)
    const values: any[] = new Array(parameters.length)

    for (let i = 0; i < parameters.length; i++) {
      names[i] = parameters[i].Name
      values[i] = parameters[i].Value
    }
    return this.addRowFromNamesAndValues(names, values)
  }

  /**
   * Adds a row given parallel arrays of names and values.
   * Missing columns get undefined (or null on export).
   * Returns the row index that was added.
   */
  public addRowFromNamesAndValues (names: Array<string>, values: Array<any>): number {
    if (names.length !== values.length) {
      throw new Error(`DataTable.addRowFromNamesAndValues: names.length (${names.length}) != values.length (${values.length})`)
    }

    const rowIndex = this._rowCount
    this._rowCount++

    // First, grow all existing columns by one cell (default undefined).
    for (let c = 0; c < this._columns.length; c++) {
      this._columns[c].push(undefined)
    }

    // Then, set provided cells (creating new columns as needed).
    for (let i = 0; i < names.length; i++) {
      const rawName = names[i]
      if (rawName == null) continue

      const name = String(rawName)
      const key = this.normalizeName(name)

      let col = this._colIndex.get(key)
      if (col === undefined) {
        col = this.addColumnInternal(name)
      }

      this._columns[col][rowIndex] = values[i]
    }

    return rowIndex
  }

  // -------------- Schema / metadata --------------

  public reorderColumns (names: Array<string>) {
    this._colNames = names
    this._colIndex.clear()
    const newCols = []
    for (let i = 0; i < this._colNames.length; i++) {
      this._colIndex.set(this._colNames[i], i)
      newCols.push(this._columns[i])
    }
    this._columns = newCols
  }

  public getColumnNames (): Array<string> {
    return this._colNames.slice()
  }

  public getNumRows (): number {
    return this._rowCount
  }

  public getNumColumns (): number {
    return this._columns.length
  }

  public hasColumn (name: string): boolean {
    return this._colIndex.has(this.normalizeName(name))
  }

  public getColumnIndex (name: string): number {
    const idx = this._colIndex.get(this.normalizeName(name))
    return idx === undefined ? -1 : idx
  }

  public getColumnName (n: number): string {
    if (n < 0 || n >= this._colNames.length) throw new Error(`Column index out of range: ${n}`)
    return this._colNames[n]
  }

  // -------------- Column access --------------

  /** Returns the backing column array (do not mutate unless you know what you're doing). */
  public getColumnFromName (name: string): Array<any> {
    const idx = this.getColumnIndex(name)
    if (idx < 0) throw new Error(`Unknown column: ${name}`)
    return this._columns[idx]
  }

  /** Safe accessor: returns undefined if column doesn't exist. */
  public tryGetColumnFromName (name: string): Array<any> | undefined {
    const idx = this._colIndex.get(this.normalizeName(name))
    return idx === undefined ? undefined : this._columns[idx]
  }

  // -------------- Row access / export --------------

  /**
   * Materializes rows as row-major arrays [ [c0,c1,...], ... ].
   * This is convenient but can be expensive for large tables.
   */
  public getRows (): Array<Array<any>> {
    const rows: any[][] = new Array(this._rowCount)
    const cols = this._columns.length

    for (let r = 0; r < this._rowCount; r++) {
      const row: any[] = new Array(cols)
      for (let c = 0; c < cols; c++) {
        const v = this._columns[c][r]
        row[c] = (v === undefined && this.exportNullForMissing) ? null : v
      }
      rows[r] = row
    }
    return rows
  }

  /**
   * Returns a single row as a dense array (column order = getColumnNames()).
   */
  public getRowArray (rowIndex: number): any[] {
    this.ensureRowIndex(rowIndex)
    const cols = this._columns.length
    const row: any[] = new Array(cols)
    for (let c = 0; c < cols; c++) {
      const v = this._columns[c][rowIndex]
      row[c] = (v === undefined && this.exportNullForMissing) ? null : v
    }
    return row
  }

  /**
   * Returns a row as an object { colName: value }.
   * Great for Tabulator (array-of-objects).
   */
  public getRowObject (rowIndex: number): Record<string, any> {
    this.ensureRowIndex(rowIndex)
    const obj: Record<string, any> = {}
    for (let c = 0; c < this._columns.length; c++) {
      const v = this._columns[c][rowIndex]
      if (v !== undefined || this.exportNullForMissing) {
        obj[this._colNames[c]] = (v === undefined && this.exportNullForMissing) ? null : v
      }
    }
    return obj
  }

  /**
   * Exports table as array of objects (one per row). Ideal for Tabulator data.
   */
  public toObjects (): Array<Record<string, any>> {
    const out: Array<Record<string, any>> = new Array(this._rowCount)
    for (let r = 0; r < this._rowCount; r++) out[r] = this.getRowObject(r)
    return out
  }

  /**
   * Exports a "Tabulator-friendly" columns definition (basic).
   * You can extend it with formatter/editor options upstream.
   */
  public toTabulatorColumns (options?: {
    titleCase?: boolean;
    inferTypes?: boolean;
    sampleRows?: number;
  }): Array<any> {
    const titleCase = options?.titleCase ?? false
    const inferTypes = options?.inferTypes ?? true
    const sampleRows = options?.sampleRows ?? 64

    const cols: any[] = new Array(this._colNames.length)
    for (let c = 0; c < this._colNames.length; c++) {
      const field = this._colNames[c]
      const title = titleCase ? this.toTitleCase(field) : field

      const def: any = { title, field }

      if (inferTypes) {
        const t = this.inferColumnType(c, sampleRows)
        // Tabulator is flexible; these are gentle hints.
        if (t === 'number') def.sorter = 'number'
        else if (t === 'boolean') def.sorter = 'boolean'
        else if (t === 'date') def.sorter = 'date'
        else def.sorter = 'string'
      }

      cols[c] = def
    }
    return cols
  }

  // -------------- Query / filtering helpers --------------

  /**
   * Filters rows by a predicate over row objects.
   * Returns an array of row indices (cheap, keeps table immutable).
   */
  public where (predicate: (row: Record<string, any>, rowIndex: number) => boolean): number[] {
    const result: number[] = []
    for (let r = 0; r < this._rowCount; r++) {
      if (predicate(this.getRowObject(r), r)) result.push(r)
    }
    return result
  }

  /**
   * Fast filter when you only need one column:
   * returns row indices where column satisfies predicate.
   */
  public whereColumn (name: string, predicate: (value: any, rowIndex: number) => boolean): number[] {
    const col = this.getColumnFromName(name)
    const result: number[] = []
    for (let r = 0; r < this._rowCount; r++) {
      if (predicate(col[r], r)) result.push(r)
    }
    return result
  }

  /**
 * Creates a view of the table with only selected rows/columns (copying data).
 * Useful for "materializing" query results for UI/export.
 */
  public project (options: {
  rows?: number[]; // default: all rows
  columns?: string[]; // default: all columns
}): DataTable {
    const rowIdx = options.rows ?? this.range(0, this._rowCount)

    // IMPORTANT: keep the caller's column order if provided.
    // If not provided, use current table order.
    const requestedCols = options.columns ?? this._colNames.slice()

    const t = new DataTable()
    t.exportNullForMissing = this.exportNullForMissing
    t.caseInsensitiveNames = this.caseInsensitiveNames

    // Resolve requested columns ONCE, in order.
    // - srcIndex: where to read from this table (-1 if missing)
    // - outName: the name we will create in the projected table (canonical if found)
    const resolved = requestedCols.map((reqName) => {
      const srcIndex = this.getColumnIndex(reqName)
      const outName = srcIndex >= 0 ? this._colNames[srcIndex] : reqName // preserve canonical name if present
      return { reqName, srcIndex, outName }
    })

    // Pre-create projected columns in the requested order.
    for (const c of resolved) t.ensureColumn(c.outName)

    for (const r of rowIdx) {
      this.ensureRowIndex(r)

      const names: string[] = []
      const vals: any[] = []

      for (const c of resolved) {
        const v = c.srcIndex < 0 ? undefined : this._columns[c.srcIndex][r]
        names.push(c.outName) // ensures output order matches resolved order
        vals.push(v)
      }

      t.addRowFromNamesAndValues(names, vals)
    }

    return t
  }

  /**
   * Builds a simple index for equality lookups on a column.
   * Example: const idx = table.buildIndex("Category"); idx.get("IfcWall") -> row indices
   */
  public buildIndex (name: string): Map<any, number[]> {
    const col = this.getColumnFromName(name)
    const map = new Map<any, number[]>()
    for (let r = 0; r < this._rowCount; r++) {
      const v = col[r]
      let arr = map.get(v)
      if (!arr) {
        arr = []
        map.set(v, arr)
      }
      arr.push(r)
    }
    return map
  }

  // -------------- Mutation / utilities --------------

  /** Ensures a column exists; returns its index. */
  public ensureColumn (name: string): number {
    const key = this.normalizeName(name)
    const idx = this._colIndex.get(key)
    if (idx !== undefined) return idx
    return this.addColumnInternal(name)
  }

  /** Adds a column with optional default value for existing rows. */
  public addColumn (name: string, defaultValue: any = undefined): number {
    const key = this.normalizeName(name)
    if (this._colIndex.has(key)) throw new Error(`Column already exists: ${name}`)
    const idx = this.addColumnInternal(name)
    if (defaultValue !== undefined) {
      const col = this._columns[idx]
      for (let r = 0; r < this._rowCount; r++) col[r] = defaultValue
    }
    return idx
  }

  /** Sets a value in a given row/column; auto-creates the column if needed. */
  public setValue (rowIndex: number, columnName: string, value: any): void {
    this.ensureRowIndex(rowIndex)
    const c = this.ensureColumn(columnName)
    this._columns[c][rowIndex] = value
  }

  public getValue (rowIndex: number, columnName: string): any {
    this.ensureRowIndex(rowIndex)
    const c = this.getColumnIndex(columnName)
    return c < 0 ? undefined : this._columns[c][rowIndex]
  }

  /** Returns a shallow copy of the internal state (columns are cloned). */
  public clone (): DataTable {
    const t = new DataTable()
    t.exportNullForMissing = this.exportNullForMissing
    t.caseInsensitiveNames = this.caseInsensitiveNames
    t._colNames = this._colNames.slice()
    t._colIndex = new Map(this._colIndex)
    t._columns = this._columns.map(col => col.slice())
    t._rowCount = this._rowCount
    return t
  }

  // -------------- Private helpers --------------

  private addColumnInternal (displayName: string): number {
    const idx = this._columns.length
    this._colNames.push(displayName)
    this._colIndex.set(this.normalizeName(displayName), idx)

    // New column must have existing rows filled with undefined.
    const col = new Array<any>(this._rowCount)
    // (JS arrays are "holey" if left uninitialized; explicitly fill for predictable access.)
    for (let r = 0; r < this._rowCount; r++) col[r] = undefined

    this._columns.push(col)
    return idx
  }

  private normalizeName (name: string): string {
    return this.caseInsensitiveNames ? name.toLowerCase() : name
  }

  private ensureRowIndex (rowIndex: number): void {
    if (rowIndex < 0 || rowIndex >= this._rowCount) {
      throw new Error(`Row index out of range: ${rowIndex} (rows=${this._rowCount})`)
    }
  }

  private range (start: number, end: number): number[] {
    const n = Math.max(0, end - start)
    const arr = new Array<number>(n)
    for (let i = 0; i < n; i++) arr[i] = start + i
    return arr
  }

  private inferColumnType (colIndex: number, sampleRows: number): 'number' | 'boolean' | 'date' | 'string' {
    const col = this._columns[colIndex]
    const n = Math.min(this._rowCount, sampleRows)

    let sawNumber = false; let sawBoolean = false; let sawDate = false; let sawOther = false
    for (let r = 0; r < n; r++) {
      const v = col[r]
      if (v === undefined || v === null) continue
      const t = typeof v
      if (t === 'number') sawNumber = true
      else if (t === 'boolean') sawBoolean = true
      else if (v instanceof Date) sawDate = true
      else if (t === 'string') {
        // naive date sniff
        if (!sawDate && this.looksLikeDate(v)) sawDate = true
        else sawOther = true
      } else {
        sawOther = true
      }
      if (sawOther) break
    }

    if (!sawOther && sawBoolean && !sawNumber && !sawDate) return 'boolean'
    if (!sawOther && sawNumber && !sawBoolean && !sawDate) return 'number'
    if (!sawOther && sawDate && !sawBoolean && !sawNumber) return 'date'
    return 'string'
  }

  private looksLikeDate (s: string): boolean {
    // very lightweight heuristic (ISO-ish)
    return /^\d{4}-\d{2}-\d{2}/.test(s) || /^\d{2}\/\d{2}\/\d{4}/.test(s)
  }

  private toTitleCase (s: string): string {
    return s.replace(/([A-Z])/g, ' $1').replace(/[_-]+/g, ' ').trim().replace(/\s+/g, ' ')
      .replace(/\b\w/g, c => c.toUpperCase())
  }

  static mostlySame (values: Array<any>): boolean {
    if (!values) return true
    if (values.length <= 1) return true
    const first = values[0]
    const isFirstNumber = Number.isFinite(first)
    for (const v of values) {
      if (v != first) {
        if (isFirstNumber && Number.isFinite(v)) {
          if (Math.abs(first - v) > 0.001) { return false }
        } else {
          return false
        }
      }
    }
    return true
  }

  public isColumnMostlySame (columnName: string): boolean {
    const col = this.tryGetColumnFromName(columnName)
    return DataTable.mostlySame(col)
  }
}
