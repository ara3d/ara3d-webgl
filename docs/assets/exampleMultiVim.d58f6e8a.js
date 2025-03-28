import { V as Viewer, d as VimLoader, l as Vector3 } from "./vimLoader.55c78aa4.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new VimLoader();
  viewer.add(await loader.load("/residence.vim", console, { position: new Vector3(-50, 0, -50) }));
  viewer.add(await loader.load("/residence.vim", console, { position: new Vector3(-50, 0, 50) }));
  viewer.add(await loader.load("/residence.vim", console, { position: new Vector3(50, 0, -50) }));
  viewer.add(await loader.load("/residence.vim", console, { position: new Vector3(50, 0, 50) }));
}
runExample();
//# sourceMappingURL=exampleMultiVim.d58f6e8a.js.map
