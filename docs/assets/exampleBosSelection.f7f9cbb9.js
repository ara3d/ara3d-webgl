import { V as Viewer, aw as Raycaster, w as MeshStandardMaterial, i as Vector2 } from "./compressors.ca4e4f79.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.180bc89b.js";
async function runExample() {
  const viewer = new Viewer();
  const loader = new BimOpenSchemaLoader();
  console.time("Loading .bos file");
  const bimData = await loader.load("/ara3d-webgl/rac_basic_sample_project-2025.bos");
  console.timeEnd("Loading .bos file");
  let group = bimData.ThreeGeometry;
  const originalGroup = bimData.ThreeGeometry;
  viewer.add(group);
  const selectedGlobalIds = /* @__PURE__ */ new Set();
  let pointerDownPos = null;
  const DRAG_THRESHOLD = 5;
  const raycaster = new Raycaster();
  const ghostMaterial = new MeshStandardMaterial({
    color: 8956671,
    transparent: true,
    opacity: 0.1,
    roughness: 0.8,
    metalness: 0,
    depthWrite: false
  });
  function decodeHitToInstanceIndex(object, intersection) {
    const pickData = object.userData.pick;
    if (!pickData)
      return null;
    if (pickData.kind === "single") {
      return pickData.instanceIndex;
    } else if (pickData.kind === "instanced") {
      if (intersection.instanceId !== void 0 && pickData.instanceIndices) {
        return pickData.instanceIndices[intersection.instanceId];
      }
      return null;
    } else if (pickData.kind === "merged") {
      if (intersection.faceIndex !== void 0 && pickData.triToInstanceIndex) {
        return pickData.triToInstanceIndex[intersection.faceIndex];
      }
      return null;
    }
    return null;
  }
  function rebuildGeometryWithSelection() {
    const instances = [];
    for (const instance of bimData.Instances) {
      const globalId = bimData.Resolver.GetInstanceGlobalId(instance);
      if (selectedGlobalIds.has(globalId)) {
        instances.push(instance);
      } else {
        instances.push({ ...instance, material: ghostMaterial });
      }
    }
    const newGroup = bimData.rebuildGeometry(instances);
    viewer.remove(group);
    group = newGroup;
    viewer.add(group);
    updateSelectionPanel();
  }
  function resetSelection() {
    selectedGlobalIds.clear();
    viewer.remove(group);
    group = originalGroup;
    viewer.add(group);
    updateSelectionPanel();
  }
  function handlePointerDown(event) {
    if (event.button !== 0)
      return;
    pointerDownPos = { x: event.clientX, y: event.clientY };
  }
  function handlePointerUp(event) {
    if (event.button !== 0)
      return;
    if (!pointerDownPos)
      return;
    const dx = event.clientX - pointerDownPos.x;
    const dy = event.clientY - pointerDownPos.y;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance > DRAG_THRESHOLD) {
      pointerDownPos = null;
      return;
    }
    pointerDownPos = null;
    const canvas2 = viewer.viewport.canvas;
    const camera = viewer.camera.three;
    const rect = canvas2.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    raycaster.setFromCamera(new Vector2(x, y), camera);
    const intersects = raycaster.intersectObject(group, true);
    if (intersects.length === 0) {
      if (!event.ctrlKey && !event.shiftKey) {
        resetSelection();
      }
      return;
    }
    for (const intersection of intersects) {
      const instanceIndex = decodeHitToInstanceIndex(intersection.object, intersection);
      if (instanceIndex !== null && instanceIndex !== void 0) {
        const instance = bimData.Instances[instanceIndex];
        if (instance) {
          const globalId = bimData.Resolver.GetInstanceGlobalId(instance);
          let mode = "replace";
          if (event.ctrlKey || event.metaKey) {
            mode = "toggle";
          } else if (event.shiftKey) {
            mode = "add";
          }
          if (mode === "toggle") {
            if (selectedGlobalIds.has(globalId)) {
              selectedGlobalIds.delete(globalId);
            } else {
              selectedGlobalIds.add(globalId);
            }
          } else if (mode === "add") {
            selectedGlobalIds.add(globalId);
          } else {
            selectedGlobalIds.clear();
            selectedGlobalIds.add(globalId);
          }
          rebuildGeometryWithSelection();
          console.log(`Selected instance ${instanceIndex}, GlobalId: ${globalId}, Mode: ${mode}`);
          return;
        }
      }
    }
    if (!event.ctrlKey && !event.shiftKey) {
      resetSelection();
    }
  }
  function createSelectionPanel() {
    const panel = document.createElement("div");
    panel.id = "selection-panel";
    panel.innerHTML = `
            <h3>Selection</h3>
            <div class="info">
                <div>Selected: <span id="selection-count">0</span></div>
            </div>
            <div class="controls">
                <button id="reset-selection">Reset</button>
            </div>
            <div class="selected-list" id="selected-list"></div>
            <div class="hint">
                <div>Click: Replace selection</div>
                <div>Ctrl+Click: Toggle selection</div>
                <div>Shift+Click: Add to selection</div>
            </div>
        `;
    document.body.appendChild(panel);
    document.getElementById("reset-selection").addEventListener("click", () => {
      resetSelection();
    });
  }
  function updateSelectionPanel() {
    const countEl = document.getElementById("selection-count");
    const listEl = document.getElementById("selected-list");
    if (countEl) {
      countEl.textContent = selectedGlobalIds.size;
    }
    if (listEl) {
      if (selectedGlobalIds.size === 0) {
        listEl.innerHTML = '<div style="opacity: 0.5; padding: 8px;">No items selected</div>';
      } else {
        const items = Array.from(selectedGlobalIds).slice(0, 50);
        listEl.innerHTML = items.map(
          (id) => `<div class="selected-item">${id}</div>`
        ).join("");
        if (selectedGlobalIds.size > 50) {
          listEl.innerHTML += `<div style="opacity: 0.5; padding: 4px; font-size: 10px;">... and ${selectedGlobalIds.size - 50} more</div>`;
        }
      }
    }
  }
  const canvas = viewer.viewport.canvas;
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  createSelectionPanel();
  updateSelectionPanel();
  console.log("Viewport selection example ready. Click on objects to select them.");
}
runExample();
//# sourceMappingURL=exampleBosSelection.f7f9cbb9.js.map
