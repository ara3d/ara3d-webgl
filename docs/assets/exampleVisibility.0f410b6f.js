import { V as Viewer, d as VimLoader, m as Sphere } from "./vimLoader.55c78aa4.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  const vim = await loader.load("/residence.vim", console);
  viewer.add(vim);
  const all = [...vim.getAllObjects()].filter((o) => o.hasMesh);
  const radius = all.map(
    (o) => o.getBoundingBox().getBoundingSphere(new Sphere()).radius
  );
  for (let i = 0; i < all.length; i++) {
    all[i].visible = radius[i] > 15;
  }
}
runExample();
//# sourceMappingURL=exampleVisibility.0f410b6f.js.map
