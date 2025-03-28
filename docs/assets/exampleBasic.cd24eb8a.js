import { V as Viewer, d as VimLoader } from "./vimLoader.55c78aa4.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  const vim = await loader.load("/ara3d-webgl/residence.vim", console);
  viewer.add(vim);
}
runExample();
//# sourceMappingURL=exampleBasic.cd24eb8a.js.map
