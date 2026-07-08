/**
 * Subscribe to BOS file drops and delegate scene composition to the example.
 * Use with fileDrop.autoAdd: false so the example owns geometry after load.
 */
export function bindBosHotSwap (viewer, setModel) {
  const drop = viewer.inputs.bosFileDrop
  if (!drop) return
  drop.onBosFileLoaded.subscribe((bimData) => {
    viewer.removeContent()
    setModel(bimData)
  })
}
