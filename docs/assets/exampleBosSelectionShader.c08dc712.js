import { n as Viewer, aS as WebGLRenderTarget, a0 as NearestFilter, aT as ShaderMaterial, D as DoubleSide, b as Vector2, C as Color, aU as NormalBlending, aV as Scene, a9 as OrthographicCamera, e as Mesh, aJ as PlaneGeometry, aR as Raycaster } from "./bvhPrecompute.worker.858fae95.js";
import { B as BimOpenSchemaLoader } from "./bimOpenSchemaLoader.cde4167e.js";
function debugLog(...args) {
  console.log("[selection-shader-example]", ...args);
}
function toHex(color) {
  return `#${color.getHexString()}`;
}
function requestViewerRender(viewer) {
  if (viewer?.renderer) {
    viewer.renderer.needsUpdate = true;
  }
  viewer?.requestRender?.();
}
function decodeHitToInstanceIndex(object, intersection) {
  const pickData = object?.userData?.pick;
  if (!pickData)
    return null;
  if (pickData.kind === "single") {
    return pickData.instanceIndex ?? null;
  }
  if (pickData.kind === "instanced") {
    if (intersection.instanceId !== void 0 && pickData.instanceIndices) {
      return pickData.instanceIndices[intersection.instanceId] ?? null;
    }
    return null;
  }
  if (pickData.kind === "merged") {
    if (intersection.faceIndex !== void 0 && pickData.triToInstanceIndex) {
      return pickData.triToInstanceIndex[intersection.faceIndex] ?? null;
    }
    return null;
  }
  if (pickData.kind === "viewStateMerged") {
    const mesh = object;
    const geometry = mesh?.geometry;
    const indexAttr = geometry?.getIndex?.();
    const instanceIdAttr = geometry?.getAttribute?.("instanceId");
    if (!geometry || !indexAttr || !instanceIdAttr || intersection.faceIndex === void 0) {
      return null;
    }
    const triIndex = intersection.faceIndex * 3;
    const vertexIndex = indexAttr.array[triIndex];
    const instanceId = instanceIdAttr.array[vertexIndex];
    if (!Number.isFinite(instanceId))
      return null;
    return Math.floor(instanceId);
  }
  return null;
}
async function runExample() {
  const viewer = new Viewer();
  const loader = new BimOpenSchemaLoader();
  console.time("Loading .bos file");
  const bimData = await loader.load("/ara3d-webgl/Snowdon Towers Sample Architectural.bos", {
    renderMode: "view-state"
  });
  console.timeEnd("Loading .bos file");
  const group = bimData.ThreeGeometry;
  viewer.add(group);
  const state = bimData?.ViewState?.state;
  const model = bimData?.ViewState?.model;
  if (!state || !model) {
    throw new Error("Expected view-state render mode to provide bimData.ViewState.{state,model}.");
  }
  const uniformsOpaque = model.materialOpaque.userData?.viewStateSelectionUniforms;
  const uniformsTransparent = model.materialTransparent.userData?.viewStateSelectionUniforms;
  if (!uniformsOpaque || !uniformsTransparent) {
    throw new Error("Expected view-state materials to expose viewStateSelectionUniforms.");
  }
  const size = viewer.viewport.getParentSize();
  const selectionMaskTarget = new WebGLRenderTarget(size.x, size.y, {
    minFilter: NearestFilter,
    magFilter: NearestFilter,
    depthBuffer: true,
    stencilBuffer: false
  });
  selectionMaskTarget.texture.name = "SelectionMask";
  const selectionMaskMaterial = new ShaderMaterial({
    depthTest: true,
    depthWrite: true,
    transparent: false,
    side: DoubleSide,
    uniforms: {
      uViewFlagsTex: { value: state.textures.flags },
      uViewFlagsTexWidth: { value: Math.max(1, state.textures.flags.image.width) },
      uViewFlagsTexHeight: { value: Math.max(1, state.textures.flags.image.height) }
    },
    vertexShader: `
      attribute float instanceId;
      varying float vInstanceId;
      void main() {
        vInstanceId = instanceId;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uViewFlagsTex;
      uniform float uViewFlagsTexWidth;
      uniform float uViewFlagsTexHeight;
      varying float vInstanceId;

      vec4 sampleLookupPacked(sampler2D t, float id, float width, float height) {
        float ix = mod(id, width);
        float iy = floor(id / width);
        vec2 uv = vec2((ix + 0.5) / width, (iy + 0.5) / height);
        return texture2D(t, uv);
      }

      void main() {
        vec4 stateFlags = sampleLookupPacked(
          uViewFlagsTex,
          floor(vInstanceId + 0.5),
          uViewFlagsTexWidth,
          uViewFlagsTexHeight
        );
        float rawFlags = floor(stateFlags.r * 255.0 + 0.5);
        bool isSelected = mod(floor(rawFlags / 2.0), 2.0) >= 1.0;
        if (!isSelected) discard;
        gl_FragColor = vec4(1.0, 0.0, 0.0, 1.0);
      }
    `
  });
  const outlineCompositeMaterial = new ShaderMaterial({
    uniforms: {
      uSelectionMask: { value: selectionMaskTarget.texture },
      uTexelSize: { value: new Vector2(1 / Math.max(1, size.x), 1 / Math.max(1, size.y)) },
      uOutlineColor: { value: new Color("#00d4ff") },
      uOutlineOpacity: { value: 1 },
      uDebugShowMask: { value: 0 },
      uDebugForceEdgeMagenta: { value: 1 }
    },
    transparent: true,
    blending: NormalBlending,
    depthTest: false,
    depthWrite: false,
    vertexShader: `
      varying vec2 vUv;
      void main() {
        vUv = uv;
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }
    `,
    fragmentShader: `
      uniform sampler2D uSelectionMask;
      uniform vec2 uTexelSize;
      uniform vec3 uOutlineColor;
      uniform float uOutlineOpacity;
      uniform float uDebugShowMask;
      uniform float uDebugForceEdgeMagenta;
      varying vec2 vUv;

      float sampleMask(vec2 uv) {
        return texture2D(uSelectionMask, uv).r;
      }

      void main() {
        float center = sampleMask(vUv);
        if (uDebugShowMask > 0.5) {
          gl_FragColor = vec4(vec3(center), 1.0);
          return;
        }

        // Outside-only silhouette halo:
        // dilate selected mask in screen space and subtract original mask.
        float dilated = 0.0;
        for (int dx = -3; dx <= 3; dx++) {
          for (int dy = -3; dy <= 3; dy++) {
            vec2 o = vec2(float(dx), float(dy)) * uTexelSize;
            dilated = max(dilated, sampleMask(vUv + o));
          }
        }
        float ring = max(0.0, dilated - center);
        float alpha = clamp(ring * uOutlineOpacity, 0.0, 1.0);
        if (uDebugForceEdgeMagenta > 0.5) {
          float e = step(0.01, alpha);
          gl_FragColor = vec4(vec3(1.0, 0.0, 1.0), e);
          return;
        }
        gl_FragColor = vec4(uOutlineColor, alpha);
      }
    `
  });
  const compositeScene = new Scene();
  const compositeCamera = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const compositeQuad = new Mesh(new PlaneGeometry(2, 2), outlineCompositeMaterial);
  compositeQuad.frustumCulled = false;
  compositeScene.add(compositeQuad);
  let outlineEnabled = false;
  let showMaskDebug = false;
  let lastPickUv = null;
  const defaultRendererRender = viewer.renderer.render.bind(viewer.renderer);
  const tmpClearColor = new Color();
  const debugPixel = new Uint8Array(4);
  function renderSelectionMask(renderToScreen = false) {
    const renderer = viewer.renderer.renderer;
    const prevRenderTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(tmpClearColor);
    const prevBackground = viewer.scene.background;
    const prevOverrideMaterial = viewer.scene.overrideMaterial;
    renderer.setRenderTarget(renderToScreen ? null : selectionMaskTarget);
    renderer.autoClear = true;
    renderer.setClearColor(0, 0);
    renderer.clear(true, true, true);
    viewer.scene.background = null;
    viewer.scene.overrideMaterial = selectionMaskMaterial;
    renderer.render(viewer.scene, viewer.camera.camPerspective.camera);
    if (!renderToScreen && lastPickUv) {
      const px = Math.max(0, Math.min(selectionMaskTarget.width - 1, Math.floor(lastPickUv.x * selectionMaskTarget.width)));
      const py = Math.max(0, Math.min(selectionMaskTarget.height - 1, Math.floor((1 - lastPickUv.y) * selectionMaskTarget.height)));
      renderer.readRenderTargetPixels(selectionMaskTarget, px, py, 1, 1, debugPixel);
      debugLog("mask probe", {
        pixel: { x: px, y: py },
        rgba: Array.from(debugPixel)
      });
      lastPickUv = null;
    }
    viewer.scene.overrideMaterial = prevOverrideMaterial;
    viewer.scene.background = prevBackground;
    renderer.setRenderTarget(prevRenderTarget);
    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(tmpClearColor, prevClearAlpha);
  }
  function renderOutlineComposite() {
    const renderer = viewer.renderer.renderer;
    const prevRenderTarget = renderer.getRenderTarget();
    const prevAutoClear = renderer.autoClear;
    const prevClearAlpha = renderer.getClearAlpha();
    renderer.getClearColor(tmpClearColor);
    renderer.setRenderTarget(null);
    renderer.autoClear = false;
    renderer.render(compositeScene, compositeCamera);
    renderer.setRenderTarget(prevRenderTarget);
    renderer.autoClear = prevAutoClear;
    renderer.setClearColor(tmpClearColor, prevClearAlpha);
  }
  viewer.renderer.render = function renderWithOptionalOutline() {
    if (!this.needsUpdate && !viewer.camera.hasMoved)
      return;
    if (!outlineEnabled) {
      defaultRendererRender();
      return;
    }
    if (showMaskDebug) {
      renderSelectionMask(true);
      this.needsUpdate = false;
      return;
    }
    defaultRendererRender();
    renderSelectionMask();
    renderOutlineComposite();
    this.needsUpdate = false;
  };
  viewer.viewport.onResize.subscribe(() => {
    const nextSize = viewer.viewport.getParentSize();
    selectionMaskTarget.setSize(nextSize.x, nextSize.y);
    outlineCompositeMaterial.uniforms.uTexelSize.value.set(
      1 / Math.max(1, nextSize.x),
      1 / Math.max(1, nextSize.y)
    );
  });
  const selectedGlobalIds = /* @__PURE__ */ new Set();
  const globalIdToInstanceIndices = /* @__PURE__ */ new Map();
  for (let i = 0; i < bimData.Instances.length; i++) {
    const instance = bimData.Instances[i];
    if (!instance)
      continue;
    const globalId = String(bimData.Resolver.GetInstanceGlobalId(instance));
    const list = globalIdToInstanceIndices.get(globalId);
    if (list) {
      list.push(i);
    } else {
      globalIdToInstanceIndices.set(globalId, [i]);
    }
  }
  let pointerDownPos = null;
  const DRAG_THRESHOLD = 5;
  const raycaster = new Raycaster();
  function collectInstanceIndicesForGlobalIds(globalIds) {
    const ids = [];
    for (const globalId of globalIds) {
      const instanceIndices = globalIdToInstanceIndices.get(globalId);
      if (!instanceIndices)
        continue;
      ids.push(...instanceIndices);
    }
    return ids;
  }
  function refreshOutlineSelectionObjects() {
    if (!outlineEnabled) {
      debugLog("refreshOutlineSelectionObjects skipped", {
        outlineEnabled,
        selectedGlobalIds: selectedGlobalIds.size
      });
      requestViewerRender(viewer);
      return;
    }
    const selectedInstanceIds = new Set(
      collectInstanceIndicesForGlobalIds(selectedGlobalIds)
    );
    const selectedInstanceIdsList = Array.from(selectedInstanceIds);
    const selectedFlagsPreview = selectedInstanceIdsList.slice(0, 8).map((instanceId) => {
      const raw = state.flagsData[instanceId * 4] ?? -1;
      return { instanceId, rawFlagsByte: raw };
    });
    debugLog("refreshOutlineSelectionObjects applied", {
      selectedGlobalIds: selectedGlobalIds.size,
      selectedInstanceIds: selectedInstanceIds.size,
      maskSource: "viewState.flags",
      selectedFlagsPreview,
      selectedInstanceIdsHead: selectedInstanceIdsList.slice(0, 8)
    });
    requestViewerRender(viewer);
  }
  function syncSelectionFlags(nextSelectedGlobalIds) {
    const removed = [];
    const added = [];
    for (const globalId of selectedGlobalIds) {
      if (!nextSelectedGlobalIds.has(globalId))
        removed.push(globalId);
    }
    for (const globalId of nextSelectedGlobalIds) {
      if (!selectedGlobalIds.has(globalId))
        added.push(globalId);
    }
    const removedInstanceIds = collectInstanceIndicesForGlobalIds(removed);
    const addedInstanceIds = collectInstanceIndicesForGlobalIds(added);
    if (removedInstanceIds.length > 0)
      state.setSelected(removedInstanceIds, false);
    if (addedInstanceIds.length > 0)
      state.setSelected(addedInstanceIds, true);
    selectedGlobalIds.clear();
    for (const globalId of nextSelectedGlobalIds)
      selectedGlobalIds.add(globalId);
    updateSelectionPanel();
    refreshOutlineSelectionObjects();
    requestViewerRender(viewer);
  }
  function resetSelection() {
    if (selectedGlobalIds.size > 0) {
      state.setSelected(collectInstanceIndicesForGlobalIds(selectedGlobalIds), false);
      selectedGlobalIds.clear();
    }
    updateSelectionPanel();
    refreshOutlineSelectionObjects();
    requestViewerRender(viewer);
  }
  function handlePointerDown(event) {
    if (event.button !== 0)
      return;
    pointerDownPos = { x: event.clientX, y: event.clientY };
  }
  function handlePointerUp(event) {
    if (event.button !== 0 || !pointerDownPos)
      return;
    const dx = event.clientX - pointerDownPos.x;
    const dy = event.clientY - pointerDownPos.y;
    pointerDownPos = null;
    if (Math.hypot(dx, dy) > DRAG_THRESHOLD)
      return;
    const canvas2 = viewer.viewport.canvas;
    const camera = viewer.camera.three;
    const rect = canvas2.getBoundingClientRect();
    const x = (event.clientX - rect.left) / rect.width * 2 - 1;
    const y = -((event.clientY - rect.top) / rect.height) * 2 + 1;
    lastPickUv = {
      x: (event.clientX - rect.left) / rect.width,
      y: (event.clientY - rect.top) / rect.height
    };
    raycaster.setFromCamera(new Vector2(x, y), camera);
    const intersects = raycaster.intersectObject(group, true);
    debugLog("pointerUp raycast", {
      intersects: intersects.length,
      outlineEnabled
    });
    if (intersects.length === 0) {
      if (!event.ctrlKey && !event.metaKey && !event.shiftKey) {
        resetSelection();
      }
      return;
    }
    for (const intersection of intersects) {
      const instanceIndex = decodeHitToInstanceIndex(intersection.object, intersection);
      if (instanceIndex === null || instanceIndex === void 0)
        continue;
      const instance = bimData.Instances[instanceIndex];
      if (!instance)
        continue;
      const globalId = String(bimData.Resolver.GetInstanceGlobalId(instance));
      debugLog("picked hit resolved", {
        pickKind: intersection.object?.userData?.pick?.kind ?? "none",
        faceIndex: intersection.faceIndex ?? null,
        instanceId: intersection.instanceId ?? null,
        instanceIndex,
        globalId
      });
      const next = new Set(selectedGlobalIds);
      const add = event.shiftKey;
      const toggle = event.ctrlKey || event.metaKey;
      if (toggle) {
        if (next.has(globalId))
          next.delete(globalId);
        else
          next.add(globalId);
      } else if (add) {
        next.add(globalId);
      } else {
        next.clear();
        next.add(globalId);
      }
      syncSelectionFlags(next);
      return;
    }
  }
  function updateSelectionPanel() {
    const countEl = document.getElementById("selection-count");
    const listEl = document.getElementById("selected-list");
    countEl.textContent = String(selectedGlobalIds.size);
    if (selectedGlobalIds.size === 0) {
      listEl.innerHTML = '<div style="opacity: 0.55; padding: 8px;">No items selected</div>';
      return;
    }
    const sortedSelectedGlobalIds = Array.from(selectedGlobalIds).sort();
    const visible = sortedSelectedGlobalIds.slice(0, 40);
    listEl.innerHTML = visible.map((id) => `<div class="selected-item">${id}</div>`).join("");
    if (sortedSelectedGlobalIds.length > visible.length) {
      listEl.innerHTML += `<div style="opacity: 0.55; padding: 6px;">...and ${sortedSelectedGlobalIds.length - visible.length} more</div>`;
    }
  }
  function refreshSliderLabels() {
    const fillMix = parseFloat(document.getElementById("fill-mix").value);
    document.getElementById("fill-mix-value").textContent = fillMix.toFixed(2);
  }
  function applyShaderStylesFromControls() {
    const fillColor = document.getElementById("fill-color").value;
    const fillMix = parseFloat(document.getElementById("fill-mix").value);
    uniformsOpaque.color.set(fillColor);
    uniformsTransparent.color.set(fillColor);
    uniformsOpaque.mix = fillMix;
    uniformsTransparent.mix = fillMix;
    model.materialOpaque.needsUpdate = true;
    model.materialTransparent.needsUpdate = true;
    debugLog("applied shader settings", {
      fillColor,
      fillMix
    });
    refreshSliderLabels();
    requestViewerRender(viewer);
  }
  function createControlPanel() {
    const panel = document.createElement("div");
    panel.id = "selection-shader-panel";
    panel.innerHTML = `
      <h3>Shader Selection Tuning</h3>

      <div class="row">
        <label for="fill-color">Fill Color</label>
        <input id="fill-color" type="color" />
        <div class="value"></div>
      </div>

      <div class="row">
        <label for="fill-mix">Fill Mix</label>
        <input id="fill-mix" type="range" min="0" max="1" step="0.01" />
        <div id="fill-mix-value" class="value">0.00</div>
      </div>

      <div class="controls">
        <button id="apply-selection-style" type="button">Apply Shader Settings</button>
        <button id="toggle-outline" type="button">Outline: Off</button>
        <button id="toggle-mask-debug" type="button">Show Mask: Off</button>
        <button id="select-none" type="button">Clear Selection</button>
      </div>

      <div>Selected: <strong id="selection-count">0</strong></div>
      <div id="selected-list" class="selected-list"></div>

      <div class="hint">
        Click to select. Shift+Click adds. Ctrl/Cmd+Click toggles.<br/>
        Fill Mix affects whole selected surface.
      </div>
    `;
    document.body.appendChild(panel);
    const fillColorInput = document.getElementById("fill-color");
    const fillMixInput = document.getElementById("fill-mix");
    fillColorInput.value = toHex(uniformsOpaque.color);
    fillMixInput.value = String(uniformsOpaque.mix);
    refreshSliderLabels();
    applyShaderStylesFromControls();
    fillMixInput.addEventListener("input", refreshSliderLabels);
    document.getElementById("apply-selection-style").addEventListener("click", applyShaderStylesFromControls);
    document.getElementById("toggle-outline").addEventListener("click", () => {
      outlineEnabled = !outlineEnabled;
      document.getElementById("toggle-outline").textContent = `Outline: ${outlineEnabled ? "On" : "Off"}`;
      debugLog("outline toggled", { outlineEnabled });
      refreshOutlineSelectionObjects();
      requestViewerRender(viewer);
    });
    document.getElementById("toggle-mask-debug").addEventListener("click", () => {
      showMaskDebug = !showMaskDebug;
      outlineCompositeMaterial.uniforms.uDebugShowMask.value = showMaskDebug ? 1 : 0;
      document.getElementById("toggle-mask-debug").textContent = `Show Mask: ${showMaskDebug ? "On" : "Off"}`;
      debugLog("mask debug toggled", { showMaskDebug });
      requestViewerRender(viewer);
    });
    document.getElementById("select-none").addEventListener("click", resetSelection);
  }
  const canvas = viewer.viewport.canvas;
  canvas.addEventListener("pointerdown", handlePointerDown);
  canvas.addEventListener("pointerup", handlePointerUp);
  createControlPanel();
  updateSelectionPanel();
  requestViewerRender(viewer);
}
runExample();
//# sourceMappingURL=exampleBosSelectionShader.c08dc712.js.map
