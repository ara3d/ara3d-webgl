import { SimpleEventDispatcher } from 'ste-simple-events'
import { BimOpenSchemaLoader } from '../../loader/bimOpenSchemaLoader'
import { BimData } from '../../loader/bimData'
import { InputHandler } from './inputHandler'
import { Viewer } from '../viewer'

const DROP_OUTLINE = '3px dashed rgba(255, 255, 255, 0.85)'

function fileMatchesExtensions (name: string, extensions: string[]): boolean {
  const lower = name.toLowerCase()
  return extensions.some((ext) => lower.endsWith(ext.toLowerCase()))
}

function findBosFile (files: FileList, extensions: string[]): File | undefined {
  for (let i = 0; i < files.length; i++) {
    const file = files[i]
    if (fileMatchesExtensions(file.name, extensions)) {
      return file
    }
  }
  return undefined
}

/**
 * Handles drag-and-drop of local BOS files onto the viewer canvas.
 */
export class BosFileDropHandler extends InputHandler {
  private _viewer: Viewer
  private _loader = new BimOpenSchemaLoader()

  constructor (viewer: Viewer) {
    super(viewer)
    this._viewer = viewer
  }

  private _dragDepth = 0
  private _loading = false

  private _onBosFileLoading = new SimpleEventDispatcher<File>()
  private _onBosFileLoaded = new SimpleEventDispatcher<BimData>()
  private _onBosFileError = new SimpleEventDispatcher<{
        error: Error;
        file: File;
    }>()

  get onBosFileLoading () {
    return this._onBosFileLoading.asEvent()
  }

  get onBosFileLoaded () {
    return this._onBosFileLoaded.asEvent()
  }

  get onBosFileError () {
    return this._onBosFileError.asEvent()
  }

  private get canvas () {
    return this._viewer.viewport.canvas
  }

  private get settings () {
    return this._viewer.settings.fileDrop
  }

  protected override addListeners (): void {
    // Allow file drops anywhere in the page; canvas handler loads the model.
    this.reg(window, 'dragover', this.onWindowDragOver)
    this.reg(window, 'drop', this.onWindowDrop)

    this.reg(this.canvas, 'dragenter', this.onDragEnter)
    this.reg(this.canvas, 'dragover', this.onDragOver)
    this.reg(this.canvas, 'dragleave', this.onDragLeave)
    this.reg(this.canvas, 'drop', this.onDrop)
  }

  private onWindowDragOver = (event: DragEvent) => {
    if (this.isFileDrag(event)) {
      event.preventDefault()
    }
  }

  private onWindowDrop = (event: DragEvent) => {
    if (this.isFileDrag(event)) {
      event.preventDefault()
    }
  }

  override reset = () => {
    this._dragDepth = 0
    this.setDropTarget(false)
  }

  private onDragEnter = (event: DragEvent) => {
    if (!this.isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    this._dragDepth++
    this.setDropTarget(true)
  }

  private onDragOver = (event: DragEvent) => {
    if (!this.isFileDrag(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  private onDragLeave = (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    this._dragDepth = Math.max(0, this._dragDepth - 1)
    if (this._dragDepth === 0) {
      this.setDropTarget(false)
    }
  }

  private onDrop = async (event: DragEvent) => {
    event.preventDefault()
    event.stopPropagation()
    this._dragDepth = 0
    this.setDropTarget(false)

    const files = event.dataTransfer?.files
    if (!files?.length || this._loading) return

    const file = findBosFile(files, this.settings.extensions)
    if (!file) return

    this._loading = true
    this._onBosFileLoading.dispatch(file)

    try {
      const bimData = await this._loader.loadFromFile(file, {
        loadParameters: this.settings.loadParameters
      })
      if (this.settings.autoAdd) {
        this._viewer.removeContent()
        this._viewer.add(bimData.ThreeGeometry)
      }
      this._onBosFileLoaded.dispatch(bimData)
    } catch (err) {
      const error =
                err instanceof Error ? err : new Error(String(err))
      this._onBosFileError.dispatch({ error, file })
    } finally {
      this._loading = false
    }
  }

  /**
   * True when the drag carries files. Filenames are not available until drop,
   * so extension checks belong in onDrop only.
   */
  private isFileDrag (event: DragEvent): boolean {
    const dt = event.dataTransfer
    if (!dt) return false

    const types = dt.types
    if (types) {
      for (let i = 0; i < types.length; i++) {
        if (types[i] === 'Files') return true
      }
    }

    const items = dt.items
    if (items?.length) {
      for (let i = 0; i < items.length; i++) {
        if (items[i].kind === 'file') return true
      }
    }

    return false
  }

  private setDropTarget (active: boolean) {
    this.canvas.style.outline = active ? DROP_OUTLINE : ''
    this.canvas.style.outlineOffset = active ? '-3px' : ''
  }
}
