import { V as Viewer, B as BimOpenSchemaLoader, C as Color, y as MeshStandardMaterial, z as DoubleSide } from "./viewer.bb973d67.js";
import { b as bindBosHotSwap } from "./bosHotSwap.a48ac0b2.js";
const paletteState = {
  saturation: 0.45,
  lightness: 0.2,
  seedHue: 0.1
};
const PHI = 0.618033988749895;
let viewer = null;
let bimData = null;
let levelToInstances = null;
let currentGroup = null;
function generateRandomMaterialsForMap(map, { saturation, lightness, seedHue }) {
  const out = /* @__PURE__ */ new Map();
  let h = seedHue;
  for (const key of map.keys()) {
    h = (h + PHI) % 1;
    const color = new Color().setHSL(h, saturation, lightness);
    const material = new MeshStandardMaterial({
      color,
      roughness: 0.85,
      metalness: 0,
      flatShading: true,
      side: DoubleSide
    });
    out.set(key, material);
  }
  return out;
}
function buildInstancesWithMaterials() {
  const materialsByLevel = generateRandomMaterialsForMap(levelToInstances, paletteState);
  const instances = [];
  for (const [levelKey, instGroup] of levelToInstances) {
    let material = materialsByLevel.get(levelKey);
    if (!material)
      continue;
    for (const inst of instGroup) {
      instances.push({ ...inst, material });
    }
  }
  return instances;
}
function rebuildSceneGeometry() {
  if (!viewer || !bimData || !levelToInstances)
    return;
  if (currentGroup) {
    viewer.remove?.(currentGroup);
    currentGroup = null;
  }
  const instances = buildInstancesWithMaterials();
  currentGroup = bimData.rebuildGeometry(instances);
  viewer.add(currentGroup);
}
function debounce(fn, ms) {
  let t = null;
  return (...args) => {
    clearTimeout(t);
    t = setTimeout(() => fn(...args), ms);
  };
}
const rebuildDebounced = debounce(rebuildSceneGeometry, 60);
function setText(id, txt) {
  document.getElementById(id).textContent = txt;
}
function syncUI() {
  const sat = document.getElementById("sat");
  const lit = document.getElementById("lit");
  const seed = document.getElementById("seed");
  sat.value = String(paletteState.saturation);
  lit.value = String(paletteState.lightness);
  seed.value = String(paletteState.seedHue);
  setText("satVal", paletteState.saturation.toFixed(2));
  setText("litVal", paletteState.lightness.toFixed(2));
  setText("seedVal", paletteState.seedHue.toFixed(3));
}
function bindUI() {
  const sat = document.getElementById("sat");
  const lit = document.getElementById("lit");
  const seed = document.getElementById("seed");
  const shuffle = document.getElementById("shuffle");
  const reset = document.getElementById("reset");
  sat.addEventListener("input", () => {
    paletteState.saturation = Number(sat.value);
    setText("satVal", paletteState.saturation.toFixed(2));
    rebuildDebounced();
  });
  lit.addEventListener("input", () => {
    paletteState.lightness = Number(lit.value);
    setText("litVal", paletteState.lightness.toFixed(2));
    rebuildDebounced();
  });
  seed.addEventListener("input", () => {
    paletteState.seedHue = Number(seed.value);
    setText("seedVal", paletteState.seedHue.toFixed(3));
    rebuildDebounced();
  });
  shuffle.addEventListener("click", () => {
    paletteState.seedHue = Math.random();
    syncUI();
    rebuildSceneGeometry();
  });
  reset.addEventListener("click", () => {
    paletteState.saturation = 0.45;
    paletteState.lightness = 0.2;
    paletteState.seedHue = 0.1;
    syncUI();
    rebuildSceneGeometry();
  });
}
function setModel(data) {
  bimData = data;
  levelToInstances = bimData.Query.LevelToInstances();
  rebuildSceneGeometry();
}
async function runExample() {
  viewer = new Viewer({
    fileDrop: { enable: true, autoAdd: false, loadParameters: true }
  });
  const loader = new BimOpenSchemaLoader();
  syncUI();
  bindUI();
  bindBosHotSwap(viewer, setModel);
  console.time("Loading .bos file");
  const data = await loader.load("/ara3d-webgl/Snowdon Towers Sample Architectural.bos", { loadParameters: true });
  console.timeEnd("Loading .bos file");
  setModel(data);
}
runExample();
//# sourceMappingURL=exampleBosLevelColors.ea7ccba2.js.map
