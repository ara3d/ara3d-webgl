import { V as Viewer, d as VimLoader } from "./vimLoader.55c78aa4.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  const vim = await loader.load("/residence.vim", console);
  viewer.add(vim);
  const all = [...vim.getAllObjects()].filter((o) => o.hasMesh);
  for (let i = 0; i < all.length; i++) {
    const element = await all[i].getBimElement();
    const name = element.familyName;
    if (typeof name === "string" && name.includes("Window")) {
      all[i].outline = true;
    }
  }
}
runExample();
//# sourceMappingURL=exampleOutline.c1fef2fa.js.map
