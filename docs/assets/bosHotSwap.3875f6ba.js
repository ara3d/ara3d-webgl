function bindBosHotSwap(viewer, setModel) {
  const drop = viewer.inputs.bosFileDrop;
  if (!drop)
    return;
  drop.onBosFileLoaded.subscribe((bimData) => {
    viewer.removeContent();
    setModel(bimData);
  });
}
export {
  bindBosHotSwap as b
};
//# sourceMappingURL=bosHotSwap.3875f6ba.js.map
