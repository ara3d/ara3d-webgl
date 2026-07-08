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
//# sourceMappingURL=bosHotSwap.a48ac0b2.js.map
