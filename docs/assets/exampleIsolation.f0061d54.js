import { V as Viewer, d as VimLoader } from "./vimLoader.55c78aa4.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  const vim = await loader.load("/ara3d-webgl/residence.vim", console);
  viewer.add(vim);
  for (const obj2 of vim.getAllObjects()) {
    obj2.visible = false;
  }
  const obj = vim.getObjectFromElement(123);
  obj.visible = true;
  viewer.selection.select(obj);
  viewer.camera.lerp(1).frame(obj);
  vim.scene.material = viewer.materials.isolation;
}
runExample();
//# sourceMappingURL=exampleIsolation.f0061d54.js.map
