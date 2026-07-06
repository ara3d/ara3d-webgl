import { SimpleEventDispatcher } from 'ste-simple-events'
import { BimOpenSchemaLoader } from '../../loader/bimOpenSchemaLoader'
import { BimData } from '../../loader/bimData'
import { InputHandler } from './inputHandler'

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
  private _loader = new BimOpenSchemaLoader()
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
    this.reg(this.canvas, 'dragenter', this.onDragEnter)
    this.reg(this.canvas, 'dragover', this.onDragOver)
    this.reg(this.canvas, 'dragleave', this.onDragLeave)
    this.reg(this.canvas, 'drop', this.onDrop)
  }

  override reset = () => {
    this._dragDepth = 0
    this.setDropTarget(false)
  }

  private onDragEnter = (event: DragEvent) => {
    if (!this.hasBosFile(event)) return
    event.preventDefault()
    event.stopPropagation()
    this._dragDepth++
    this.setDropTarget(true)
  }

  private onDragOver = (event: DragEvent) => {
    if (!this.hasBosFile(event)) return
    event.preventDefault()
    event.stopPropagation()
    if (event.dataTransfer) {
      event.dataTransfer.dropEffect = 'copy'
    }
  }

  private onDragLeave = (event: DragEvent) => {
    if (!this.hasBosFile(event)) return
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
      this._viewer.removeContent()
      this._viewer.add(bimData.ThreeGeometry)
      this._onBosFileLoaded.dispatch(bimData)
    } catch (err) {
      const error =
                err instanceof Error ? err : new Error(String(err))
      this._onBosFileError.dispatch({ error, file })
    } finally {
      this._loading = false
    }
  }

  private hasBosFile (event: DragEvent): boolean {
    const items = event.dataTransfer?.items
    if (items?.length) {
      for (let i = 0; i < items.length; i++) {
        const item = items[i]
        if (item.kind !== 'file') continue
        const name = item.getAsFile()?.name ?? ''
        if (fileMatchesExtensions(name, this.settings.extensions)) {
          return true
        }
      }
    }

    const files = event.dataTransfer?.files
    if (files?.length) {
      return findBosFile(files, this.settings.extensions) !== undefined
    }

    return false
  }

  private setDropTarget (active: boolean) {
    this.canvas.style.outline = active ? DROP_OUTLINE : ''
    this.canvas.style.outlineOffset = active ? '-3px' : ''
  }
}
