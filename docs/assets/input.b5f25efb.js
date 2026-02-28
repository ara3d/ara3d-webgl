var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => {
  __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
  return value;
};
import { B as Box3, M as Matrix4, a as BufferAttribute, V as Vector3, b as Vector2, P as Plane, L as Line3, T as Triangle, R as REVISION, c as BackSide, D as DoubleSide, F as FrontSide, d as Ray, e as Mesh, f as Line, g as LineSegments, h as LineLoop, i as Points, j as BatchedMesh, S as Sphere, W as WorkerWrapper, k as MeshStandardMaterial, C as Color, l as LineBasicMaterial, I as InstancedMesh, E as EdgesGeometry, t as three_module, m as DefaultInputScheme, K as KEYS, n as Viewer, o as getSettings } from "./bvhPrecompute.worker.858fae95.js";
import { G as GltfLoader } from "./gltfLoader.878a4265.js";
import { B as BimOpenSchemaLoader, l as loadBimGeometryFromZip, _ as __setWorkerClientsForTests, a as __setZipWorkerClientForTests, d as disposeBimOpenSchemaWorkers, V as ViewStateFlag, b as buildViewStateTextures, c as ViewStateTable, s as setViewStateMaterialSelectionColor, e as createViewStateMaterial } from "./bimOpenSchemaLoader.cde4167e.js";
class GizmoOptions {
  constructor(init) {
    __publicField(this, "size", 84);
    __publicField(this, "padding", 4);
    __publicField(this, "bubbleSizePrimary", 8);
    __publicField(this, "bubbleSizeSecondary", 6);
    __publicField(this, "lineWidth", 2);
    __publicField(this, "fontSize", "12px");
    __publicField(this, "fontFamily", "arial");
    __publicField(this, "fontWeight", "bold");
    __publicField(this, "fontColor", "#222222");
    __publicField(this, "className", "gizmo-axis-canvas");
    __publicField(this, "colorX", "#f73c3c");
    __publicField(this, "colorY", "#6ccb26");
    __publicField(this, "colorZ", "#178cf0");
    __publicField(this, "colorXSub", "#942424");
    __publicField(this, "colorYSub", "#417a17");
    __publicField(this, "colorZSub", "#0e5490");
    this.size = init?.size ?? this.size;
    this.padding = init?.padding ?? this.padding;
    this.bubbleSizePrimary = init?.bubbleSizePrimary ?? this.bubbleSizePrimary;
    this.bubbleSizeSecondary = init?.bubbleSizeSecondary ?? this.bubbleSizeSecondary;
    this.lineWidth = init?.lineWidth ?? this.lineWidth;
    this.fontSize = init?.fontSize ?? this.fontSize;
    this.fontFamily = init?.fontFamily ?? this.fontFamily;
    this.fontWeight = init?.fontWeight ?? this.fontWeight;
    this.fontColor = init?.fontColor ?? this.fontColor;
    this.className = init?.className ?? this.className;
    this.colorX = init?.colorX ?? this.colorX;
    this.colorY = init?.colorY ?? this.colorY;
    this.colorZ = init?.colorZ ?? this.colorZ;
    this.colorXSub = init?.colorXSub ?? this.colorXSub;
    this.colorYSub = init?.colorYSub ?? this.colorYSub;
    this.colorZSub = init?.colorZSub ?? this.colorZSub;
  }
}
const CENTER = 0;
const AVERAGE = 1;
const SAH = 2;
const CONTAINED = 2;
const PRIMITIVE_INTERSECT_COST = 1.25;
const TRAVERSAL_COST = 1;
const BYTES_PER_NODE = 6 * 4 + 4 + 4;
const UINT32_PER_NODE = BYTES_PER_NODE / 4;
const IS_LEAFNODE_FLAG = 65535;
const FLOAT32_EPSILON = Math.pow(2, -24);
const SKIP_GENERATION = Symbol("SKIP_GENERATION");
const DEFAULT_OPTIONS = {
  strategy: CENTER,
  maxDepth: 40,
  maxLeafSize: 10,
  useSharedArrayBuffer: false,
  setBoundingBox: true,
  onProgress: null,
  indirect: false,
  verbose: true,
  range: null,
  [SKIP_GENERATION]: false
};
function arrayToBox(nodeIndex32, array, target) {
  target.min.x = array[nodeIndex32];
  target.min.y = array[nodeIndex32 + 1];
  target.min.z = array[nodeIndex32 + 2];
  target.max.x = array[nodeIndex32 + 3];
  target.max.y = array[nodeIndex32 + 4];
  target.max.z = array[nodeIndex32 + 5];
  return target;
}
function getLongestEdgeIndex(bounds) {
  let splitDimIdx = -1;
  let splitDist = -Infinity;
  for (let i = 0; i < 3; i++) {
    const dist = bounds[i + 3] - bounds[i];
    if (dist > splitDist) {
      splitDist = dist;
      splitDimIdx = i;
    }
  }
  return splitDimIdx;
}
function copyBounds(source, target) {
  target.set(source);
}
function unionBounds(a, b, target) {
  let aVal, bVal;
  for (let d = 0; d < 3; d++) {
    const d3 = d + 3;
    aVal = a[d];
    bVal = b[d];
    target[d] = aVal < bVal ? aVal : bVal;
    aVal = a[d3];
    bVal = b[d3];
    target[d3] = aVal > bVal ? aVal : bVal;
  }
}
function expandByPrimitiveBounds(startIndex, primitiveBounds, bounds) {
  for (let d = 0; d < 3; d++) {
    const tCenter = primitiveBounds[startIndex + 2 * d];
    const tHalf = primitiveBounds[startIndex + 2 * d + 1];
    const tMin = tCenter - tHalf;
    const tMax = tCenter + tHalf;
    if (tMin < bounds[d]) {
      bounds[d] = tMin;
    }
    if (tMax > bounds[d + 3]) {
      bounds[d + 3] = tMax;
    }
  }
}
function computeSurfaceArea(bounds) {
  const d0 = bounds[3] - bounds[0];
  const d1 = bounds[4] - bounds[1];
  const d2 = bounds[5] - bounds[2];
  return 2 * (d0 * d1 + d1 * d2 + d2 * d0);
}
function IS_LEAF(n16, uint16Array2) {
  return uint16Array2[n16 + 15] === IS_LEAFNODE_FLAG;
}
function OFFSET(n32, uint32Array2) {
  return uint32Array2[n32 + 6];
}
function COUNT(n16, uint16Array2) {
  return uint16Array2[n16 + 14];
}
function LEFT_NODE(n32) {
  return n32 + UINT32_PER_NODE;
}
function RIGHT_NODE(n32, uint32Array2) {
  const relativeOffset = uint32Array2[n32 + 6];
  return n32 + relativeOffset * UINT32_PER_NODE;
}
function SPLIT_AXIS(n32, uint32Array2) {
  return uint32Array2[n32 + 7];
}
function BOUNDING_DATA_INDEX(n32) {
  return n32;
}
function getBounds(primitiveBounds, offset, count, target, centroidTarget) {
  let minx = Infinity;
  let miny = Infinity;
  let minz = Infinity;
  let maxx = -Infinity;
  let maxy = -Infinity;
  let maxz = -Infinity;
  let cminx = Infinity;
  let cminy = Infinity;
  let cminz = Infinity;
  let cmaxx = -Infinity;
  let cmaxy = -Infinity;
  let cmaxz = -Infinity;
  const boundsOffset = primitiveBounds.offset || 0;
  for (let i = (offset - boundsOffset) * 6, end = (offset + count - boundsOffset) * 6; i < end; i += 6) {
    const cx = primitiveBounds[i + 0];
    const hx = primitiveBounds[i + 1];
    const lx = cx - hx;
    const rx = cx + hx;
    if (lx < minx)
      minx = lx;
    if (rx > maxx)
      maxx = rx;
    if (cx < cminx)
      cminx = cx;
    if (cx > cmaxx)
      cmaxx = cx;
    const cy = primitiveBounds[i + 2];
    const hy = primitiveBounds[i + 3];
    const ly = cy - hy;
    const ry = cy + hy;
    if (ly < miny)
      miny = ly;
    if (ry > maxy)
      maxy = ry;
    if (cy < cminy)
      cminy = cy;
    if (cy > cmaxy)
      cmaxy = cy;
    const cz = primitiveBounds[i + 4];
    const hz = primitiveBounds[i + 5];
    const lz = cz - hz;
    const rz = cz + hz;
    if (lz < minz)
      minz = lz;
    if (rz > maxz)
      maxz = rz;
    if (cz < cminz)
      cminz = cz;
    if (cz > cmaxz)
      cmaxz = cz;
  }
  target[0] = minx;
  target[1] = miny;
  target[2] = minz;
  target[3] = maxx;
  target[4] = maxy;
  target[5] = maxz;
  centroidTarget[0] = cminx;
  centroidTarget[1] = cminy;
  centroidTarget[2] = cminz;
  centroidTarget[3] = cmaxx;
  centroidTarget[4] = cmaxy;
  centroidTarget[5] = cmaxz;
}
const BIN_COUNT = 32;
const binsSort = (a, b) => a.candidate - b.candidate;
const sahBins = /* @__PURE__ */ new Array(BIN_COUNT).fill().map(() => {
  return {
    count: 0,
    bounds: new Float32Array(6),
    rightCacheBounds: new Float32Array(6),
    leftCacheBounds: new Float32Array(6),
    candidate: 0
  };
});
const leftBounds = /* @__PURE__ */ new Float32Array(6);
function getOptimalSplit(nodeBoundingData, centroidBoundingData, primitiveBounds, offset, count, strategy) {
  let axis = -1;
  let pos = 0;
  if (strategy === CENTER) {
    axis = getLongestEdgeIndex(centroidBoundingData);
    if (axis !== -1) {
      pos = (centroidBoundingData[axis] + centroidBoundingData[axis + 3]) / 2;
    }
  } else if (strategy === AVERAGE) {
    axis = getLongestEdgeIndex(nodeBoundingData);
    if (axis !== -1) {
      pos = getAverage(primitiveBounds, offset, count, axis);
    }
  } else if (strategy === SAH) {
    const rootSurfaceArea = computeSurfaceArea(nodeBoundingData);
    let bestCost = PRIMITIVE_INTERSECT_COST * count;
    const boundsOffset = primitiveBounds.offset || 0;
    const cStart = (offset - boundsOffset) * 6;
    const cEnd = (offset + count - boundsOffset) * 6;
    for (let a = 0; a < 3; a++) {
      const axisLeft = centroidBoundingData[a];
      const axisRight = centroidBoundingData[a + 3];
      const axisLength = axisRight - axisLeft;
      const binWidth = axisLength / BIN_COUNT;
      if (count < BIN_COUNT / 4) {
        const truncatedBins = [...sahBins];
        truncatedBins.length = count;
        let b = 0;
        for (let c = cStart; c < cEnd; c += 6, b++) {
          const bin = truncatedBins[b];
          bin.candidate = primitiveBounds[c + 2 * a];
          bin.count = 0;
          const {
            bounds,
            leftCacheBounds,
            rightCacheBounds
          } = bin;
          for (let d = 0; d < 3; d++) {
            rightCacheBounds[d] = Infinity;
            rightCacheBounds[d + 3] = -Infinity;
            leftCacheBounds[d] = Infinity;
            leftCacheBounds[d + 3] = -Infinity;
            bounds[d] = Infinity;
            bounds[d + 3] = -Infinity;
          }
          expandByPrimitiveBounds(c, primitiveBounds, bounds);
        }
        truncatedBins.sort(binsSort);
        let splitCount = count;
        for (let bi = 0; bi < splitCount; bi++) {
          const bin = truncatedBins[bi];
          while (bi + 1 < splitCount && truncatedBins[bi + 1].candidate === bin.candidate) {
            truncatedBins.splice(bi + 1, 1);
            splitCount--;
          }
        }
        for (let c = cStart; c < cEnd; c += 6) {
          const center = primitiveBounds[c + 2 * a];
          for (let bi = 0; bi < splitCount; bi++) {
            const bin = truncatedBins[bi];
            if (center >= bin.candidate) {
              expandByPrimitiveBounds(c, primitiveBounds, bin.rightCacheBounds);
            } else {
              expandByPrimitiveBounds(c, primitiveBounds, bin.leftCacheBounds);
              bin.count++;
            }
          }
        }
        for (let bi = 0; bi < splitCount; bi++) {
          const bin = truncatedBins[bi];
          const leftCount = bin.count;
          const rightCount = count - bin.count;
          const leftBounds2 = bin.leftCacheBounds;
          const rightBounds = bin.rightCacheBounds;
          let leftProb = 0;
          if (leftCount !== 0) {
            leftProb = computeSurfaceArea(leftBounds2) / rootSurfaceArea;
          }
          let rightProb = 0;
          if (rightCount !== 0) {
            rightProb = computeSurfaceArea(rightBounds) / rootSurfaceArea;
          }
          const cost = TRAVERSAL_COST + PRIMITIVE_INTERSECT_COST * (leftProb * leftCount + rightProb * rightCount);
          if (cost < bestCost) {
            axis = a;
            bestCost = cost;
            pos = bin.candidate;
          }
        }
      } else {
        for (let i = 0; i < BIN_COUNT; i++) {
          const bin = sahBins[i];
          bin.count = 0;
          bin.candidate = axisLeft + binWidth + i * binWidth;
          const bounds = bin.bounds;
          for (let d = 0; d < 3; d++) {
            bounds[d] = Infinity;
            bounds[d + 3] = -Infinity;
          }
        }
        for (let c = cStart; c < cEnd; c += 6) {
          const triCenter = primitiveBounds[c + 2 * a];
          const relativeCenter = triCenter - axisLeft;
          let binIndex = ~~(relativeCenter / binWidth);
          if (binIndex >= BIN_COUNT)
            binIndex = BIN_COUNT - 1;
          const bin = sahBins[binIndex];
          bin.count++;
          expandByPrimitiveBounds(c, primitiveBounds, bin.bounds);
        }
        const lastBin = sahBins[BIN_COUNT - 1];
        copyBounds(lastBin.bounds, lastBin.rightCacheBounds);
        for (let i = BIN_COUNT - 2; i >= 0; i--) {
          const bin = sahBins[i];
          const nextBin = sahBins[i + 1];
          unionBounds(bin.bounds, nextBin.rightCacheBounds, bin.rightCacheBounds);
        }
        let leftCount = 0;
        for (let i = 0; i < BIN_COUNT - 1; i++) {
          const bin = sahBins[i];
          const binCount = bin.count;
          const bounds = bin.bounds;
          const nextBin = sahBins[i + 1];
          const rightBounds = nextBin.rightCacheBounds;
          if (binCount !== 0) {
            if (leftCount === 0) {
              copyBounds(bounds, leftBounds);
            } else {
              unionBounds(bounds, leftBounds, leftBounds);
            }
          }
          leftCount += binCount;
          let leftProb = 0;
          let rightProb = 0;
          if (leftCount !== 0) {
            leftProb = computeSurfaceArea(leftBounds) / rootSurfaceArea;
          }
          const rightCount = count - leftCount;
          if (rightCount !== 0) {
            rightProb = computeSurfaceArea(rightBounds) / rootSurfaceArea;
          }
          const cost = TRAVERSAL_COST + PRIMITIVE_INTERSECT_COST * (leftProb * leftCount + rightProb * rightCount);
          if (cost < bestCost) {
            axis = a;
            bestCost = cost;
            pos = bin.candidate;
          }
        }
      }
    }
  } else {
    console.warn(`BVH: Invalid build strategy value ${strategy} used.`);
  }
  return { axis, pos };
}
function getAverage(primitiveBounds, offset, count, axis) {
  let avg = 0;
  const boundsOffset = primitiveBounds.offset;
  for (let i = offset, end = offset + count; i < end; i++) {
    avg += primitiveBounds[(i - boundsOffset) * 6 + axis * 2];
  }
  return avg / count;
}
class BVHNode {
  constructor() {
    this.boundingData = new Float32Array(6);
  }
}
function partition(buffer, stride, primitiveBounds, offset, count, split) {
  let left = offset;
  let right = offset + count - 1;
  const pos = split.pos;
  const axisOffset = split.axis * 2;
  const boundsOffset = primitiveBounds.offset || 0;
  while (true) {
    while (left <= right && primitiveBounds[(left - boundsOffset) * 6 + axisOffset] < pos) {
      left++;
    }
    while (left <= right && primitiveBounds[(right - boundsOffset) * 6 + axisOffset] >= pos) {
      right--;
    }
    if (left < right) {
      for (let i = 0; i < stride; i++) {
        let t0 = buffer[left * stride + i];
        buffer[left * stride + i] = buffer[right * stride + i];
        buffer[right * stride + i] = t0;
      }
      for (let i = 0; i < 6; i++) {
        const l = left - boundsOffset;
        const r = right - boundsOffset;
        const tb = primitiveBounds[l * 6 + i];
        primitiveBounds[l * 6 + i] = primitiveBounds[r * 6 + i];
        primitiveBounds[r * 6 + i] = tb;
      }
      left++;
      right--;
    } else {
      return left;
    }
  }
}
let float32Array, uint32Array, uint16Array, uint8Array;
const MAX_POINTER = Math.pow(2, 32);
function countNodes(node) {
  if ("count" in node) {
    return 1;
  } else {
    return 1 + countNodes(node.left) + countNodes(node.right);
  }
}
function populateBuffer(byteOffset, node, buffer) {
  float32Array = new Float32Array(buffer);
  uint32Array = new Uint32Array(buffer);
  uint16Array = new Uint16Array(buffer);
  uint8Array = new Uint8Array(buffer);
  return _populateBuffer(byteOffset, node);
}
function _populateBuffer(byteOffset, node) {
  const node32Index = byteOffset / 4;
  const node16Index = byteOffset / 2;
  const isLeaf = "count" in node;
  const boundingData = node.boundingData;
  for (let i = 0; i < 6; i++) {
    float32Array[node32Index + i] = boundingData[i];
  }
  if (isLeaf) {
    if (node.buffer) {
      uint8Array.set(new Uint8Array(node.buffer), byteOffset);
      return byteOffset + node.buffer.byteLength;
    } else {
      uint32Array[node32Index + 6] = node.offset;
      uint16Array[node16Index + 14] = node.count;
      uint16Array[node16Index + 15] = IS_LEAFNODE_FLAG;
      return byteOffset + BYTES_PER_NODE;
    }
  } else {
    const { left, right, splitAxis } = node;
    const leftByteOffset = byteOffset + BYTES_PER_NODE;
    let rightByteOffset = _populateBuffer(leftByteOffset, left);
    const currentNodeIndex = byteOffset / BYTES_PER_NODE;
    const rightNodeIndex = rightByteOffset / BYTES_PER_NODE;
    const relativeRightIndex = rightNodeIndex - currentNodeIndex;
    if (relativeRightIndex > MAX_POINTER) {
      throw new Error("MeshBVH: Cannot store relative child node offset greater than 32 bits.");
    }
    uint32Array[node32Index + 6] = relativeRightIndex;
    uint32Array[node32Index + 7] = splitAxis;
    return _populateBuffer(rightByteOffset, right);
  }
}
function buildTree(bvh, primitiveBounds, offset, count, options, loadRange) {
  const {
    maxDepth,
    verbose,
    maxLeafSize,
    strategy,
    onProgress
  } = options;
  const partitionBuffer = bvh.primitiveBuffer;
  const partitionStride = bvh.primitiveBufferStride;
  const cacheCentroidBoundingData = new Float32Array(6);
  let reachedMaxDepth = false;
  const root = new BVHNode();
  getBounds(primitiveBounds, offset, count, root.boundingData, cacheCentroidBoundingData);
  splitNode(root, offset, count, cacheCentroidBoundingData);
  return root;
  function triggerProgress(primitivesProcessed) {
    if (onProgress) {
      onProgress((primitivesProcessed - loadRange.offset) / loadRange.count);
    }
  }
  function splitNode(node, offset2, count2, centroidBoundingData = null, depth = 0) {
    if (!reachedMaxDepth && depth >= maxDepth) {
      reachedMaxDepth = true;
      if (verbose) {
        console.warn(`BVH: Max depth of ${maxDepth} reached when generating BVH. Consider increasing maxDepth.`);
      }
    }
    if (count2 <= maxLeafSize || depth >= maxDepth) {
      triggerProgress(offset2 + count2);
      node.offset = offset2;
      node.count = count2;
      return node;
    }
    const split = getOptimalSplit(node.boundingData, centroidBoundingData, primitiveBounds, offset2, count2, strategy);
    if (split.axis === -1) {
      triggerProgress(offset2 + count2);
      node.offset = offset2;
      node.count = count2;
      return node;
    }
    const splitOffset = partition(partitionBuffer, partitionStride, primitiveBounds, offset2, count2, split);
    if (splitOffset === offset2 || splitOffset === offset2 + count2) {
      triggerProgress(offset2 + count2);
      node.offset = offset2;
      node.count = count2;
    } else {
      node.splitAxis = split.axis;
      const left = new BVHNode();
      const lstart = offset2;
      const lcount = splitOffset - offset2;
      node.left = left;
      getBounds(primitiveBounds, lstart, lcount, left.boundingData, cacheCentroidBoundingData);
      splitNode(left, lstart, lcount, cacheCentroidBoundingData, depth + 1);
      const right = new BVHNode();
      const rstart = splitOffset;
      const rcount = count2 - lcount;
      node.right = right;
      getBounds(primitiveBounds, rstart, rcount, right.boundingData, cacheCentroidBoundingData);
      splitNode(right, rstart, rcount, cacheCentroidBoundingData, depth + 1);
    }
    return node;
  }
}
function buildPackedTree(bvh, options) {
  const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
  const rootRanges = bvh.getRootRanges(options.range);
  const firstRange = rootRanges[0];
  const lastRange = rootRanges[rootRanges.length - 1];
  const fullRange = {
    offset: firstRange.offset,
    count: lastRange.offset + lastRange.count - firstRange.offset
  };
  const primitiveBounds = new Float32Array(6 * fullRange.count);
  primitiveBounds.offset = fullRange.offset;
  bvh.computePrimitiveBounds(fullRange.offset, fullRange.count, primitiveBounds);
  bvh._roots = rootRanges.map((range) => {
    const root = buildTree(bvh, primitiveBounds, range.offset, range.count, options, fullRange);
    const nodeCount = countNodes(root);
    const buffer = new BufferConstructor(BYTES_PER_NODE * nodeCount);
    populateBuffer(0, root, buffer);
    return buffer;
  });
}
class PrimitivePool {
  constructor(getNewPrimitive) {
    this._getNewPrimitive = getNewPrimitive;
    this._primitives = [];
  }
  getPrimitive() {
    const primitives = this._primitives;
    if (primitives.length === 0) {
      return this._getNewPrimitive();
    } else {
      return primitives.pop();
    }
  }
  releasePrimitive(primitive) {
    this._primitives.push(primitive);
  }
}
class _BufferStack {
  constructor() {
    this.float32Array = null;
    this.uint16Array = null;
    this.uint32Array = null;
    const stack = [];
    let prevBuffer = null;
    this.setBuffer = (buffer) => {
      if (prevBuffer) {
        stack.push(prevBuffer);
      }
      prevBuffer = buffer;
      this.float32Array = new Float32Array(buffer);
      this.uint16Array = new Uint16Array(buffer);
      this.uint32Array = new Uint32Array(buffer);
    };
    this.clearBuffer = () => {
      prevBuffer = null;
      this.float32Array = null;
      this.uint16Array = null;
      this.uint32Array = null;
      if (stack.length !== 0) {
        this.setBuffer(stack.pop());
      }
    };
  }
}
const BufferStack = /* @__PURE__ */ new _BufferStack();
let _box1, _box2;
const boxStack = [];
const boxPool = /* @__PURE__ */ new PrimitivePool(() => new Box3());
function shapecast(bvh, root, intersectsBounds, intersectsRange, boundsTraverseOrder, nodeOffset) {
  _box1 = boxPool.getPrimitive();
  _box2 = boxPool.getPrimitive();
  boxStack.push(_box1, _box2);
  BufferStack.setBuffer(bvh._roots[root]);
  const result = shapecastTraverse(0, bvh.geometry, intersectsBounds, intersectsRange, boundsTraverseOrder, nodeOffset);
  BufferStack.clearBuffer();
  boxPool.releasePrimitive(_box1);
  boxPool.releasePrimitive(_box2);
  boxStack.pop();
  boxStack.pop();
  const length = boxStack.length;
  if (length > 0) {
    _box2 = boxStack[length - 1];
    _box1 = boxStack[length - 2];
  }
  return result;
}
function shapecastTraverse(nodeIndex32, geometry, intersectsBoundsFunc, intersectsRangeFunc, nodeScoreFunc = null, nodeIndexOffset = 0, depth = 0) {
  const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array2);
    const count = COUNT(nodeIndex16, uint16Array2);
    arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array2, _box1);
    return intersectsRangeFunc(offset, count, false, depth, nodeIndexOffset + nodeIndex32 / UINT32_PER_NODE, _box1);
  } else {
    let getLeftOffset = function(nodeIndex322) {
      const { uint16Array: uint16Array3, uint32Array: uint32Array3 } = BufferStack;
      let nodeIndex162 = nodeIndex322 * 2;
      while (!IS_LEAF(nodeIndex162, uint16Array3)) {
        nodeIndex322 = LEFT_NODE(nodeIndex322);
        nodeIndex162 = nodeIndex322 * 2;
      }
      return OFFSET(nodeIndex322, uint32Array3);
    }, getRightEndOffset = function(nodeIndex322) {
      const { uint16Array: uint16Array3, uint32Array: uint32Array3 } = BufferStack;
      let nodeIndex162 = nodeIndex322 * 2;
      while (!IS_LEAF(nodeIndex162, uint16Array3)) {
        nodeIndex322 = RIGHT_NODE(nodeIndex322, uint32Array3);
        nodeIndex162 = nodeIndex322 * 2;
      }
      return OFFSET(nodeIndex322, uint32Array3) + COUNT(nodeIndex162, uint16Array3);
    };
    const left = LEFT_NODE(nodeIndex32);
    const right = RIGHT_NODE(nodeIndex32, uint32Array2);
    let c1 = left;
    let c2 = right;
    let score1, score2;
    let box1, box2;
    if (nodeScoreFunc) {
      box1 = _box1;
      box2 = _box2;
      arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array2, box1);
      arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array2, box2);
      score1 = nodeScoreFunc(box1);
      score2 = nodeScoreFunc(box2);
      if (score2 < score1) {
        c1 = right;
        c2 = left;
        const temp5 = score1;
        score1 = score2;
        score2 = temp5;
        box1 = box2;
      }
    }
    if (!box1) {
      box1 = _box1;
      arrayToBox(BOUNDING_DATA_INDEX(c1), float32Array2, box1);
    }
    const isC1Leaf = IS_LEAF(c1 * 2, uint16Array2);
    const c1Intersection = intersectsBoundsFunc(box1, isC1Leaf, score1, depth + 1, nodeIndexOffset + c1 / UINT32_PER_NODE);
    let c1StopTraversal;
    if (c1Intersection === CONTAINED) {
      const offset = getLeftOffset(c1);
      const end = getRightEndOffset(c1);
      const count = end - offset;
      c1StopTraversal = intersectsRangeFunc(offset, count, true, depth + 1, nodeIndexOffset + c1 / UINT32_PER_NODE, box1);
    } else {
      c1StopTraversal = c1Intersection && shapecastTraverse(
        c1,
        geometry,
        intersectsBoundsFunc,
        intersectsRangeFunc,
        nodeScoreFunc,
        nodeIndexOffset,
        depth + 1
      );
    }
    if (c1StopTraversal)
      return true;
    box2 = _box2;
    arrayToBox(BOUNDING_DATA_INDEX(c2), float32Array2, box2);
    const isC2Leaf = IS_LEAF(c2 * 2, uint16Array2);
    const c2Intersection = intersectsBoundsFunc(box2, isC2Leaf, score2, depth + 1, nodeIndexOffset + c2 / UINT32_PER_NODE);
    let c2StopTraversal;
    if (c2Intersection === CONTAINED) {
      const offset = getLeftOffset(c2);
      const end = getRightEndOffset(c2);
      const count = end - offset;
      c2StopTraversal = intersectsRangeFunc(offset, count, true, depth + 1, nodeIndexOffset + c2 / UINT32_PER_NODE, box2);
    } else {
      c2StopTraversal = c2Intersection && shapecastTraverse(
        c2,
        geometry,
        intersectsBoundsFunc,
        intersectsRangeFunc,
        nodeScoreFunc,
        nodeIndexOffset,
        depth + 1
      );
    }
    if (c2StopTraversal)
      return true;
    return false;
  }
}
const _bufferStack1 = /* @__PURE__ */ new BufferStack.constructor();
const _bufferStack2 = /* @__PURE__ */ new BufferStack.constructor();
const _boxPool = /* @__PURE__ */ new PrimitivePool(() => new Box3());
const _leftBox1 = /* @__PURE__ */ new Box3();
const _rightBox1 = /* @__PURE__ */ new Box3();
const _leftBox2 = /* @__PURE__ */ new Box3();
const _rightBox2 = /* @__PURE__ */ new Box3();
let _active = false;
function bvhcast(bvh, otherBvh, matrixToLocal, intersectsRanges) {
  if (_active) {
    throw new Error("MeshBVH: Recursive calls to bvhcast not supported.");
  }
  _active = true;
  const roots = bvh._roots;
  const otherRoots = otherBvh._roots;
  let result;
  let nodeOffset1 = 0;
  let nodeOffset2 = 0;
  const invMat = new Matrix4().copy(matrixToLocal).invert();
  for (let i = 0, il = roots.length; i < il; i++) {
    _bufferStack1.setBuffer(roots[i]);
    nodeOffset2 = 0;
    const localBox = _boxPool.getPrimitive();
    arrayToBox(BOUNDING_DATA_INDEX(0), _bufferStack1.float32Array, localBox);
    localBox.applyMatrix4(invMat);
    for (let j = 0, jl = otherRoots.length; j < jl; j++) {
      _bufferStack2.setBuffer(otherRoots[j]);
      result = _traverse(
        0,
        0,
        matrixToLocal,
        invMat,
        intersectsRanges,
        nodeOffset1,
        nodeOffset2,
        0,
        0,
        localBox
      );
      _bufferStack2.clearBuffer();
      nodeOffset2 += otherRoots[j].byteLength / BYTES_PER_NODE;
      if (result) {
        break;
      }
    }
    _boxPool.releasePrimitive(localBox);
    _bufferStack1.clearBuffer();
    nodeOffset1 += roots[i].byteLength / BYTES_PER_NODE;
    if (result) {
      break;
    }
  }
  _active = false;
  return result;
}
function _traverse(node1Index32, node2Index32, matrix2to1, matrix1to2, intersectsRangesFunc, node1IndexOffset = 0, node2IndexOffset = 0, depth1 = 0, depth2 = 0, currBox = null, reversed = false) {
  let bufferStack1, bufferStack2;
  if (reversed) {
    bufferStack1 = _bufferStack2;
    bufferStack2 = _bufferStack1;
  } else {
    bufferStack1 = _bufferStack1;
    bufferStack2 = _bufferStack2;
  }
  const float32Array1 = bufferStack1.float32Array, uint32Array1 = bufferStack1.uint32Array, uint16Array1 = bufferStack1.uint16Array, float32Array2 = bufferStack2.float32Array, uint32Array2 = bufferStack2.uint32Array, uint16Array2 = bufferStack2.uint16Array;
  const node1Index16 = node1Index32 * 2;
  const node2Index16 = node2Index32 * 2;
  const isLeaf1 = IS_LEAF(node1Index16, uint16Array1);
  const isLeaf2 = IS_LEAF(node2Index16, uint16Array2);
  let result = false;
  if (isLeaf2 && isLeaf1) {
    if (reversed) {
      result = intersectsRangesFunc(
        OFFSET(node2Index32, uint32Array2),
        COUNT(node2Index32 * 2, uint16Array2),
        OFFSET(node1Index32, uint32Array1),
        COUNT(node1Index32 * 2, uint16Array1),
        depth2,
        node2IndexOffset + node2Index32 / UINT32_PER_NODE,
        depth1,
        node1IndexOffset + node1Index32 / UINT32_PER_NODE
      );
    } else {
      result = intersectsRangesFunc(
        OFFSET(node1Index32, uint32Array1),
        COUNT(node1Index32 * 2, uint16Array1),
        OFFSET(node2Index32, uint32Array2),
        COUNT(node2Index32 * 2, uint16Array2),
        depth1,
        node1IndexOffset + node1Index32 / UINT32_PER_NODE,
        depth2,
        node2IndexOffset + node2Index32 / UINT32_PER_NODE
      );
    }
  } else if (isLeaf2) {
    const newBox = _boxPool.getPrimitive();
    arrayToBox(BOUNDING_DATA_INDEX(node2Index32), float32Array2, newBox);
    newBox.applyMatrix4(matrix2to1);
    const cl1 = LEFT_NODE(node1Index32);
    const cr1 = RIGHT_NODE(node1Index32, uint32Array1);
    arrayToBox(BOUNDING_DATA_INDEX(cl1), float32Array1, _leftBox1);
    arrayToBox(BOUNDING_DATA_INDEX(cr1), float32Array1, _rightBox1);
    const intersectCl1 = newBox.intersectsBox(_leftBox1);
    const intersectCr1 = newBox.intersectsBox(_rightBox1);
    result = intersectCl1 && _traverse(
      node2Index32,
      cl1,
      matrix1to2,
      matrix2to1,
      intersectsRangesFunc,
      node2IndexOffset,
      node1IndexOffset,
      depth2,
      depth1 + 1,
      newBox,
      !reversed
    ) || intersectCr1 && _traverse(
      node2Index32,
      cr1,
      matrix1to2,
      matrix2to1,
      intersectsRangesFunc,
      node2IndexOffset,
      node1IndexOffset,
      depth2,
      depth1 + 1,
      newBox,
      !reversed
    );
    _boxPool.releasePrimitive(newBox);
  } else {
    const cl2 = LEFT_NODE(node2Index32);
    const cr2 = RIGHT_NODE(node2Index32, uint32Array2);
    arrayToBox(BOUNDING_DATA_INDEX(cl2), float32Array2, _leftBox2);
    arrayToBox(BOUNDING_DATA_INDEX(cr2), float32Array2, _rightBox2);
    const leftIntersects = currBox.intersectsBox(_leftBox2);
    const rightIntersects = currBox.intersectsBox(_rightBox2);
    if (leftIntersects && rightIntersects) {
      result = _traverse(
        node1Index32,
        cl2,
        matrix2to1,
        matrix1to2,
        intersectsRangesFunc,
        node1IndexOffset,
        node2IndexOffset,
        depth1,
        depth2 + 1,
        currBox,
        reversed
      ) || _traverse(
        node1Index32,
        cr2,
        matrix2to1,
        matrix1to2,
        intersectsRangesFunc,
        node1IndexOffset,
        node2IndexOffset,
        depth1,
        depth2 + 1,
        currBox,
        reversed
      );
    } else if (leftIntersects) {
      if (isLeaf1) {
        result = _traverse(
          node1Index32,
          cl2,
          matrix2to1,
          matrix1to2,
          intersectsRangesFunc,
          node1IndexOffset,
          node2IndexOffset,
          depth1,
          depth2 + 1,
          currBox,
          reversed
        );
      } else {
        const newBox = _boxPool.getPrimitive();
        newBox.copy(_leftBox2).applyMatrix4(matrix2to1);
        const cl1 = LEFT_NODE(node1Index32);
        const cr1 = RIGHT_NODE(node1Index32, uint32Array1);
        arrayToBox(BOUNDING_DATA_INDEX(cl1), float32Array1, _leftBox1);
        arrayToBox(BOUNDING_DATA_INDEX(cr1), float32Array1, _rightBox1);
        const intersectCl1 = newBox.intersectsBox(_leftBox1);
        const intersectCr1 = newBox.intersectsBox(_rightBox1);
        result = intersectCl1 && _traverse(
          cl2,
          cl1,
          matrix1to2,
          matrix2to1,
          intersectsRangesFunc,
          node2IndexOffset,
          node1IndexOffset,
          depth2,
          depth1 + 1,
          newBox,
          !reversed
        ) || intersectCr1 && _traverse(
          cl2,
          cr1,
          matrix1to2,
          matrix2to1,
          intersectsRangesFunc,
          node2IndexOffset,
          node1IndexOffset,
          depth2,
          depth1 + 1,
          newBox,
          !reversed
        );
        _boxPool.releasePrimitive(newBox);
      }
    } else if (rightIntersects) {
      if (isLeaf1) {
        result = _traverse(
          node1Index32,
          cr2,
          matrix2to1,
          matrix1to2,
          intersectsRangesFunc,
          node1IndexOffset,
          node2IndexOffset,
          depth1,
          depth2 + 1,
          currBox,
          reversed
        );
      } else {
        const newBox = _boxPool.getPrimitive();
        newBox.copy(_rightBox2).applyMatrix4(matrix2to1);
        const cl1 = LEFT_NODE(node1Index32);
        const cr1 = RIGHT_NODE(node1Index32, uint32Array1);
        arrayToBox(BOUNDING_DATA_INDEX(cl1), float32Array1, _leftBox1);
        arrayToBox(BOUNDING_DATA_INDEX(cr1), float32Array1, _rightBox1);
        const intersectCl1 = newBox.intersectsBox(_leftBox1);
        const intersectCr1 = newBox.intersectsBox(_rightBox1);
        result = intersectCl1 && _traverse(
          cr2,
          cl1,
          matrix1to2,
          matrix2to1,
          intersectsRangesFunc,
          node2IndexOffset,
          node1IndexOffset,
          depth2,
          depth1 + 1,
          newBox,
          !reversed
        ) || intersectCr1 && _traverse(
          cr2,
          cr1,
          matrix1to2,
          matrix2to1,
          intersectsRangesFunc,
          node2IndexOffset,
          node1IndexOffset,
          depth2,
          depth1 + 1,
          newBox,
          !reversed
        );
        _boxPool.releasePrimitive(newBox);
      }
    }
  }
  return result;
}
const _tempBox = /* @__PURE__ */ new Box3();
const _tempBuffer = /* @__PURE__ */ new Float32Array(6);
class BVH {
  constructor() {
    this._roots = null;
    this.primitiveBuffer = null;
    this.primitiveBufferStride = null;
  }
  init(options) {
    options = {
      ...DEFAULT_OPTIONS,
      ...options
    };
    buildPackedTree(this, options);
  }
  getRootRanges() {
    throw new Error("BVH: getRootRanges() not implemented");
  }
  writePrimitiveBounds() {
    throw new Error("BVH: writePrimitiveBounds() not implemented");
  }
  writePrimitiveRangeBounds(offset, count, targetBuffer, baseIndex) {
    let minX = Infinity;
    let minY = Infinity;
    let minZ = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    let maxZ = -Infinity;
    for (let i = offset, end = offset + count; i < end; i++) {
      this.writePrimitiveBounds(i, _tempBuffer, 0);
      const [lx, ly, lz, rx, ry, rz] = _tempBuffer;
      if (lx < minX)
        minX = lx;
      if (rx > maxX)
        maxX = rx;
      if (ly < minY)
        minY = ly;
      if (ry > maxY)
        maxY = ry;
      if (lz < minZ)
        minZ = lz;
      if (rz > maxZ)
        maxZ = rz;
    }
    targetBuffer[baseIndex + 0] = minX;
    targetBuffer[baseIndex + 1] = minY;
    targetBuffer[baseIndex + 2] = minZ;
    targetBuffer[baseIndex + 3] = maxX;
    targetBuffer[baseIndex + 4] = maxY;
    targetBuffer[baseIndex + 5] = maxZ;
    return targetBuffer;
  }
  computePrimitiveBounds(offset, count, targetBuffer) {
    const boundsOffset = targetBuffer.offset || 0;
    for (let i = offset, end = offset + count; i < end; i++) {
      this.writePrimitiveBounds(i, _tempBuffer, 0);
      const [lx, ly, lz, rx, ry, rz] = _tempBuffer;
      const cx = (lx + rx) / 2;
      const cy = (ly + ry) / 2;
      const cz = (lz + rz) / 2;
      const hx = (rx - lx) / 2;
      const hy = (ry - ly) / 2;
      const hz = (rz - lz) / 2;
      const baseIndex = (i - boundsOffset) * 6;
      targetBuffer[baseIndex + 0] = cx;
      targetBuffer[baseIndex + 1] = hx + (Math.abs(cx) + hx) * FLOAT32_EPSILON;
      targetBuffer[baseIndex + 2] = cy;
      targetBuffer[baseIndex + 3] = hy + (Math.abs(cy) + hy) * FLOAT32_EPSILON;
      targetBuffer[baseIndex + 4] = cz;
      targetBuffer[baseIndex + 5] = hz + (Math.abs(cz) + hz) * FLOAT32_EPSILON;
    }
    return targetBuffer;
  }
  shiftPrimitiveOffsets(offset) {
    const indirectBuffer = this._indirectBuffer;
    if (indirectBuffer) {
      for (let i = 0, l = indirectBuffer.length; i < l; i++) {
        indirectBuffer[i] += offset;
      }
    } else {
      const roots = this._roots;
      for (let rootIndex = 0; rootIndex < roots.length; rootIndex++) {
        const root = roots[rootIndex];
        const uint32Array2 = new Uint32Array(root);
        const uint16Array2 = new Uint16Array(root);
        const totalNodes = root.byteLength / BYTES_PER_NODE;
        for (let node = 0; node < totalNodes; node++) {
          const node32Index = UINT32_PER_NODE * node;
          const node16Index = 2 * node32Index;
          if (IS_LEAF(node16Index, uint16Array2)) {
            uint32Array2[node32Index + 6] += offset;
          }
        }
      }
    }
  }
  traverse(callback, rootIndex = 0) {
    const buffer = this._roots[rootIndex];
    const uint32Array2 = new Uint32Array(buffer);
    const uint16Array2 = new Uint16Array(buffer);
    _traverse2(0);
    function _traverse2(node32Index, depth = 0) {
      const node16Index = node32Index * 2;
      const isLeaf = IS_LEAF(node16Index, uint16Array2);
      if (isLeaf) {
        const offset = uint32Array2[node32Index + 6];
        const count = uint16Array2[node16Index + 14];
        callback(depth, isLeaf, new Float32Array(buffer, node32Index * 4, 6), offset, count);
      } else {
        const left = LEFT_NODE(node32Index);
        const right = RIGHT_NODE(node32Index, uint32Array2);
        const splitAxis = SPLIT_AXIS(node32Index, uint32Array2);
        const stopTraversal = callback(depth, isLeaf, new Float32Array(buffer, node32Index * 4, 6), splitAxis);
        if (!stopTraversal) {
          _traverse2(left, depth + 1);
          _traverse2(right, depth + 1);
        }
      }
    }
  }
  refit() {
    const roots = this._roots;
    for (let rootIndex = 0, rootCount = roots.length; rootIndex < rootCount; rootIndex++) {
      const buffer = roots[rootIndex];
      const uint32Array2 = new Uint32Array(buffer);
      const uint16Array2 = new Uint16Array(buffer);
      const float32Array2 = new Float32Array(buffer);
      const totalNodes = buffer.byteLength / BYTES_PER_NODE;
      for (let nodeIndex = totalNodes - 1; nodeIndex >= 0; nodeIndex--) {
        const nodeIndex32 = nodeIndex * UINT32_PER_NODE;
        const nodeIndex16 = nodeIndex32 * 2;
        const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
        if (isLeaf) {
          const offset = OFFSET(nodeIndex32, uint32Array2);
          const count = COUNT(nodeIndex16, uint16Array2);
          this.writePrimitiveRangeBounds(offset, count, _tempBuffer, 0);
          float32Array2.set(_tempBuffer, nodeIndex32);
        } else {
          const left = LEFT_NODE(nodeIndex32);
          const right = RIGHT_NODE(nodeIndex32, uint32Array2);
          for (let i = 0; i < 3; i++) {
            const leftMin = float32Array2[left + i];
            const leftMax = float32Array2[left + i + 3];
            const rightMin = float32Array2[right + i];
            const rightMax = float32Array2[right + i + 3];
            float32Array2[nodeIndex32 + i] = leftMin < rightMin ? leftMin : rightMin;
            float32Array2[nodeIndex32 + i + 3] = leftMax > rightMax ? leftMax : rightMax;
          }
        }
      }
    }
  }
  getBoundingBox(target) {
    target.makeEmpty();
    const roots = this._roots;
    roots.forEach((buffer) => {
      arrayToBox(0, new Float32Array(buffer), _tempBox);
      target.union(_tempBox);
    });
    return target;
  }
  shapecast(callbacks) {
    let {
      boundsTraverseOrder,
      intersectsBounds,
      intersectsRange,
      intersectsPrimitive,
      scratchPrimitive,
      iterate
    } = callbacks;
    if (intersectsRange && intersectsPrimitive) {
      const originalIntersectsRange = intersectsRange;
      intersectsRange = (offset, count, contained, depth, nodeIndex) => {
        if (!originalIntersectsRange(offset, count, contained, depth, nodeIndex)) {
          return iterate(offset, count, this, intersectsPrimitive, contained, depth, scratchPrimitive);
        }
        return true;
      };
    } else if (!intersectsRange) {
      if (intersectsPrimitive) {
        intersectsRange = (offset, count, contained, depth) => {
          return iterate(offset, count, this, intersectsPrimitive, contained, depth, scratchPrimitive);
        };
      } else {
        intersectsRange = (offset, count, contained) => {
          return contained;
        };
      }
    }
    let result = false;
    let nodeOffset = 0;
    const roots = this._roots;
    for (let i = 0, l = roots.length; i < l; i++) {
      const root = roots[i];
      result = shapecast(this, i, intersectsBounds, intersectsRange, boundsTraverseOrder, nodeOffset);
      if (result) {
        break;
      }
      nodeOffset += root.byteLength / BYTES_PER_NODE;
    }
    return result;
  }
  bvhcast(otherBvh, matrixToLocal, callbacks) {
    let { intersectsRanges } = callbacks;
    return bvhcast(this, otherBvh, matrixToLocal, intersectsRanges);
  }
}
function isSharedArrayBufferSupported() {
  return typeof SharedArrayBuffer !== "undefined";
}
function getVertexCount(geo) {
  return geo.index ? geo.index.count : geo.attributes.position.count;
}
function getTriCount(geo) {
  return getVertexCount(geo) / 3;
}
function getIndexArray(vertexCount, BufferConstructor = ArrayBuffer) {
  if (vertexCount > 65535) {
    return new Uint32Array(new BufferConstructor(4 * vertexCount));
  } else {
    return new Uint16Array(new BufferConstructor(2 * vertexCount));
  }
}
function ensureIndex(geo, options) {
  if (!geo.index) {
    const vertexCount = geo.attributes.position.count;
    const BufferConstructor = options.useSharedArrayBuffer ? SharedArrayBuffer : ArrayBuffer;
    const index = getIndexArray(vertexCount, BufferConstructor);
    geo.setIndex(new BufferAttribute(index, 1));
    for (let i = 0; i < vertexCount; i++) {
      index[i] = i;
    }
  }
}
function getFullPrimitiveRange(geo, range, stride) {
  const primitiveCount = getVertexCount(geo) / stride;
  const drawRange = range ? range : geo.drawRange;
  const start = drawRange.start / stride;
  const end = (drawRange.start + drawRange.count) / stride;
  const offset = Math.max(0, start);
  const count = Math.min(primitiveCount, end) - offset;
  return {
    offset: Math.floor(offset),
    count: Math.floor(count)
  };
}
function getPrimitiveGroupRanges(geo, stride) {
  return geo.groups.map((group) => ({
    offset: group.start / stride,
    count: group.count / stride
  }));
}
function getRootPrimitiveRanges(geo, range, stride) {
  const drawRange = getFullPrimitiveRange(geo, range, stride);
  const primitiveRanges = getPrimitiveGroupRanges(geo, stride);
  if (!primitiveRanges.length) {
    return [drawRange];
  }
  const ranges = [];
  const drawRangeStart = drawRange.offset;
  const drawRangeEnd = drawRange.offset + drawRange.count;
  const primitiveCount = getVertexCount(geo) / stride;
  const events = [];
  for (const group of primitiveRanges) {
    const { offset, count } = group;
    const groupStart = offset;
    const groupCount = isFinite(count) ? count : primitiveCount - offset;
    const groupEnd = offset + groupCount;
    if (groupStart < drawRangeEnd && groupEnd > drawRangeStart) {
      events.push({ pos: Math.max(drawRangeStart, groupStart), isStart: true });
      events.push({ pos: Math.min(drawRangeEnd, groupEnd), isStart: false });
    }
  }
  events.sort((a, b) => {
    if (a.pos !== b.pos) {
      return a.pos - b.pos;
    } else {
      return a.type === "end" ? -1 : 1;
    }
  });
  let activeGroups = 0;
  let lastPos = null;
  for (const event of events) {
    const newPos = event.pos;
    if (activeGroups !== 0 && newPos !== lastPos) {
      ranges.push({
        offset: lastPos,
        count: newPos - lastPos
      });
    }
    activeGroups += event.isStart ? 1 : -1;
    lastPos = newPos;
  }
  return ranges;
}
function generateIndirectBuffer(ranges, useSharedArrayBuffer) {
  const lastRange = ranges[ranges.length - 1];
  const useUint32 = lastRange.offset + lastRange.count > 2 ** 16;
  const length = ranges.reduce((acc, val) => acc + val.count, 0);
  const byteCount = useUint32 ? 4 : 2;
  const buffer = useSharedArrayBuffer ? new SharedArrayBuffer(length * byteCount) : new ArrayBuffer(length * byteCount);
  const indirectBuffer = useUint32 ? new Uint32Array(buffer) : new Uint16Array(buffer);
  let index = 0;
  for (let r = 0; r < ranges.length; r++) {
    const { offset, count } = ranges[r];
    for (let i = 0; i < count; i++) {
      indirectBuffer[index + i] = offset + i;
    }
    index += count;
  }
  return indirectBuffer;
}
class GeometryBVH extends BVH {
  get indirect() {
    return !!this._indirectBuffer;
  }
  get primitiveStride() {
    return null;
  }
  get primitiveBufferStride() {
    return this.indirect ? 1 : this.primitiveStride;
  }
  set primitiveBufferStride(v) {
  }
  get primitiveBuffer() {
    return this.indirect ? this._indirectBuffer : this.geometry.index.array;
  }
  set primitiveBuffer(v) {
  }
  constructor(geometry, options = {}) {
    if (!geometry.isBufferGeometry) {
      throw new Error("BVH: Only BufferGeometries are supported.");
    } else if (geometry.index && geometry.index.isInterleavedBufferAttribute) {
      throw new Error("BVH: InterleavedBufferAttribute is not supported for the index attribute.");
    }
    if (options.useSharedArrayBuffer && !isSharedArrayBufferSupported()) {
      throw new Error("BVH: SharedArrayBuffer is not available.");
    }
    super();
    this.geometry = geometry;
    this.resolvePrimitiveIndex = options.indirect ? (i) => this._indirectBuffer[i] : (i) => i;
    this.primitiveBuffer = null;
    this.primitiveBufferStride = null;
    this._indirectBuffer = null;
    options = {
      ...DEFAULT_OPTIONS,
      ...options
    };
    if (!options[SKIP_GENERATION]) {
      this.init(options);
    }
  }
  init(options) {
    const { geometry, primitiveStride } = this;
    if (options.indirect) {
      const ranges = getRootPrimitiveRanges(geometry, options.range, primitiveStride);
      const indirectBuffer = generateIndirectBuffer(ranges, options.useSharedArrayBuffer);
      this._indirectBuffer = indirectBuffer;
    } else {
      ensureIndex(geometry, options);
    }
    super.init(options);
    if (!geometry.boundingBox && options.setBoundingBox) {
      geometry.boundingBox = this.getBoundingBox(new Box3());
    }
  }
  getRootRanges(range) {
    if (this.indirect) {
      return [{ offset: 0, count: this._indirectBuffer.length }];
    } else {
      return getRootPrimitiveRanges(this.geometry, range, this.primitiveStride);
    }
  }
  raycastObject3D() {
    throw new Error("BVH: raycastObject3D() not implemented");
  }
}
class SeparatingAxisBounds {
  constructor() {
    this.min = Infinity;
    this.max = -Infinity;
  }
  setFromPointsField(points, field) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0, l = points.length; i < l; i++) {
      const p = points[i];
      const val = p[field];
      min = val < min ? val : min;
      max = val > max ? val : max;
    }
    this.min = min;
    this.max = max;
  }
  setFromPoints(axis, points) {
    let min = Infinity;
    let max = -Infinity;
    for (let i = 0, l = points.length; i < l; i++) {
      const p = points[i];
      const val = axis.dot(p);
      min = val < min ? val : min;
      max = val > max ? val : max;
    }
    this.min = min;
    this.max = max;
  }
  isSeparated(other) {
    return this.min > other.max || other.min > this.max;
  }
}
SeparatingAxisBounds.prototype.setFromBox = function() {
  const p = /* @__PURE__ */ new Vector3();
  return function setFromBox(axis, box) {
    const boxMin = box.min;
    const boxMax = box.max;
    let min = Infinity;
    let max = -Infinity;
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          p.x = boxMin.x * x + boxMax.x * (1 - x);
          p.y = boxMin.y * y + boxMax.y * (1 - y);
          p.z = boxMin.z * z + boxMax.z * (1 - z);
          const val = axis.dot(p);
          min = Math.min(val, min);
          max = Math.max(val, max);
        }
      }
    }
    this.min = min;
    this.max = max;
  };
}();
const closestPointLineToLine = function() {
  const dir1 = /* @__PURE__ */ new Vector3();
  const dir2 = /* @__PURE__ */ new Vector3();
  const v02 = /* @__PURE__ */ new Vector3();
  return function closestPointLineToLine2(l1, l2, result) {
    const v0 = l1.start;
    const v10 = dir1;
    const v2 = l2.start;
    const v32 = dir2;
    v02.subVectors(v0, v2);
    dir1.subVectors(l1.end, l1.start);
    dir2.subVectors(l2.end, l2.start);
    const d0232 = v02.dot(v32);
    const d3210 = v32.dot(v10);
    const d3232 = v32.dot(v32);
    const d0210 = v02.dot(v10);
    const d1010 = v10.dot(v10);
    const denom = d1010 * d3232 - d3210 * d3210;
    let d, d2;
    if (denom !== 0) {
      d = (d0232 * d3210 - d0210 * d3232) / denom;
    } else {
      d = 0;
    }
    d2 = (d0232 + d * d3210) / d3232;
    result.x = d;
    result.y = d2;
  };
}();
const closestPointsSegmentToSegment = function() {
  const paramResult = /* @__PURE__ */ new Vector2();
  const temp12 = /* @__PURE__ */ new Vector3();
  const temp22 = /* @__PURE__ */ new Vector3();
  return function closestPointsSegmentToSegment2(l1, l2, target1, target2) {
    closestPointLineToLine(l1, l2, paramResult);
    let d = paramResult.x;
    let d2 = paramResult.y;
    if (d >= 0 && d <= 1 && d2 >= 0 && d2 <= 1) {
      l1.at(d, target1);
      l2.at(d2, target2);
      return;
    } else if (d >= 0 && d <= 1) {
      if (d2 < 0) {
        l2.at(0, target2);
      } else {
        l2.at(1, target2);
      }
      l1.closestPointToPoint(target2, true, target1);
      return;
    } else if (d2 >= 0 && d2 <= 1) {
      if (d < 0) {
        l1.at(0, target1);
      } else {
        l1.at(1, target1);
      }
      l2.closestPointToPoint(target1, true, target2);
      return;
    } else {
      let p;
      if (d < 0) {
        p = l1.start;
      } else {
        p = l1.end;
      }
      let p2;
      if (d2 < 0) {
        p2 = l2.start;
      } else {
        p2 = l2.end;
      }
      const closestPoint = temp12;
      const closestPoint2 = temp22;
      l1.closestPointToPoint(p2, true, temp12);
      l2.closestPointToPoint(p, true, temp22);
      if (closestPoint.distanceToSquared(p2) <= closestPoint2.distanceToSquared(p)) {
        target1.copy(closestPoint);
        target2.copy(p2);
        return;
      } else {
        target1.copy(p);
        target2.copy(closestPoint2);
        return;
      }
    }
  };
}();
const sphereIntersectTriangle = function() {
  const closestPointTemp = /* @__PURE__ */ new Vector3();
  const projectedPointTemp = /* @__PURE__ */ new Vector3();
  const planeTemp = /* @__PURE__ */ new Plane();
  const lineTemp = /* @__PURE__ */ new Line3();
  return function sphereIntersectTriangle2(sphere, triangle3) {
    const { radius, center } = sphere;
    const { a, b, c } = triangle3;
    lineTemp.start = a;
    lineTemp.end = b;
    const closestPoint1 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
    if (closestPoint1.distanceTo(center) <= radius)
      return true;
    lineTemp.start = a;
    lineTemp.end = c;
    const closestPoint2 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
    if (closestPoint2.distanceTo(center) <= radius)
      return true;
    lineTemp.start = b;
    lineTemp.end = c;
    const closestPoint3 = lineTemp.closestPointToPoint(center, true, closestPointTemp);
    if (closestPoint3.distanceTo(center) <= radius)
      return true;
    const plane = triangle3.getPlane(planeTemp);
    const dp = Math.abs(plane.distanceToPoint(center));
    if (dp <= radius) {
      const pp = plane.projectPoint(center, projectedPointTemp);
      const cp = triangle3.containsPoint(pp);
      if (cp)
        return true;
    }
    return false;
  };
}();
const componentKeys = ["x", "y", "z"];
const ZERO_EPSILON = 1e-15;
const ZERO_EPSILON_SQR = ZERO_EPSILON * ZERO_EPSILON;
function isNearZero(value) {
  return Math.abs(value) < ZERO_EPSILON;
}
class ExtendedTriangle extends Triangle {
  constructor(...args) {
    super(...args);
    this.isExtendedTriangle = true;
    this.satAxes = new Array(4).fill().map(() => new Vector3());
    this.satBounds = new Array(4).fill().map(() => new SeparatingAxisBounds());
    this.points = [this.a, this.b, this.c];
    this.plane = new Plane();
    this.isDegenerateIntoSegment = false;
    this.isDegenerateIntoPoint = false;
    this.degenerateSegment = new Line3();
    this.needsUpdate = true;
  }
  intersectsSphere(sphere) {
    return sphereIntersectTriangle(sphere, this);
  }
  update() {
    const a = this.a;
    const b = this.b;
    const c = this.c;
    const points = this.points;
    const satAxes = this.satAxes;
    const satBounds = this.satBounds;
    const axis0 = satAxes[0];
    const sab0 = satBounds[0];
    this.getNormal(axis0);
    sab0.setFromPoints(axis0, points);
    const axis1 = satAxes[1];
    const sab1 = satBounds[1];
    axis1.subVectors(a, b);
    sab1.setFromPoints(axis1, points);
    const axis2 = satAxes[2];
    const sab2 = satBounds[2];
    axis2.subVectors(b, c);
    sab2.setFromPoints(axis2, points);
    const axis3 = satAxes[3];
    const sab3 = satBounds[3];
    axis3.subVectors(c, a);
    sab3.setFromPoints(axis3, points);
    const lengthAB = axis1.length();
    const lengthBC = axis2.length();
    const lengthCA = axis3.length();
    this.isDegenerateIntoPoint = false;
    this.isDegenerateIntoSegment = false;
    if (lengthAB < ZERO_EPSILON) {
      if (lengthBC < ZERO_EPSILON || lengthCA < ZERO_EPSILON) {
        this.isDegenerateIntoPoint = true;
      } else {
        this.isDegenerateIntoSegment = true;
        this.degenerateSegment.start.copy(a);
        this.degenerateSegment.end.copy(c);
      }
    } else if (lengthBC < ZERO_EPSILON) {
      if (lengthCA < ZERO_EPSILON) {
        this.isDegenerateIntoPoint = true;
      } else {
        this.isDegenerateIntoSegment = true;
        this.degenerateSegment.start.copy(b);
        this.degenerateSegment.end.copy(a);
      }
    } else if (lengthCA < ZERO_EPSILON) {
      this.isDegenerateIntoSegment = true;
      this.degenerateSegment.start.copy(c);
      this.degenerateSegment.end.copy(b);
    }
    this.plane.setFromNormalAndCoplanarPoint(axis0, a);
    this.needsUpdate = false;
  }
}
ExtendedTriangle.prototype.closestPointToSegment = function() {
  const point1 = /* @__PURE__ */ new Vector3();
  const point2 = /* @__PURE__ */ new Vector3();
  const edge = /* @__PURE__ */ new Line3();
  return function distanceToSegment(segment, target1 = null, target2 = null) {
    const { start, end } = segment;
    const points = this.points;
    let distSq;
    let closestDistanceSq = Infinity;
    for (let i = 0; i < 3; i++) {
      const nexti = (i + 1) % 3;
      edge.start.copy(points[i]);
      edge.end.copy(points[nexti]);
      closestPointsSegmentToSegment(edge, segment, point1, point2);
      distSq = point1.distanceToSquared(point2);
      if (distSq < closestDistanceSq) {
        closestDistanceSq = distSq;
        if (target1)
          target1.copy(point1);
        if (target2)
          target2.copy(point2);
      }
    }
    this.closestPointToPoint(start, point1);
    distSq = start.distanceToSquared(point1);
    if (distSq < closestDistanceSq) {
      closestDistanceSq = distSq;
      if (target1)
        target1.copy(point1);
      if (target2)
        target2.copy(start);
    }
    this.closestPointToPoint(end, point1);
    distSq = end.distanceToSquared(point1);
    if (distSq < closestDistanceSq) {
      closestDistanceSq = distSq;
      if (target1)
        target1.copy(point1);
      if (target2)
        target2.copy(end);
    }
    return Math.sqrt(closestDistanceSq);
  };
}();
ExtendedTriangle.prototype.intersectsTriangle = function() {
  const saTri2 = /* @__PURE__ */ new ExtendedTriangle();
  const cachedSatBounds = /* @__PURE__ */ new SeparatingAxisBounds();
  const cachedSatBounds2 = /* @__PURE__ */ new SeparatingAxisBounds();
  const tmpVec = /* @__PURE__ */ new Vector3();
  const dir1 = /* @__PURE__ */ new Vector3();
  const dir2 = /* @__PURE__ */ new Vector3();
  const tempDir = /* @__PURE__ */ new Vector3();
  const edge1 = /* @__PURE__ */ new Line3();
  const edge2 = /* @__PURE__ */ new Line3();
  const tempPoint = /* @__PURE__ */ new Vector3();
  const bounds1 = /* @__PURE__ */ new Vector2();
  const bounds2 = /* @__PURE__ */ new Vector2();
  function coplanarIntersectsTriangle(self, other, target, suppressLog) {
    const planeNormal = tmpVec;
    if (!self.isDegenerateIntoPoint && !self.isDegenerateIntoSegment) {
      planeNormal.copy(self.plane.normal);
    } else {
      planeNormal.copy(other.plane.normal);
    }
    const satBounds1 = self.satBounds;
    const satAxes1 = self.satAxes;
    for (let i = 1; i < 4; i++) {
      const sb = satBounds1[i];
      const sa = satAxes1[i];
      cachedSatBounds.setFromPoints(sa, other.points);
      if (sb.isSeparated(cachedSatBounds))
        return false;
      tempDir.copy(planeNormal).cross(sa);
      cachedSatBounds.setFromPoints(tempDir, self.points);
      cachedSatBounds2.setFromPoints(tempDir, other.points);
      if (cachedSatBounds.isSeparated(cachedSatBounds2))
        return false;
    }
    const satBounds2 = other.satBounds;
    const satAxes2 = other.satAxes;
    for (let i = 1; i < 4; i++) {
      const sb = satBounds2[i];
      const sa = satAxes2[i];
      cachedSatBounds.setFromPoints(sa, self.points);
      if (sb.isSeparated(cachedSatBounds))
        return false;
      tempDir.crossVectors(planeNormal, sa);
      cachedSatBounds.setFromPoints(tempDir, self.points);
      cachedSatBounds2.setFromPoints(tempDir, other.points);
      if (cachedSatBounds.isSeparated(cachedSatBounds2))
        return false;
    }
    if (target) {
      if (!suppressLog) {
        console.warn("ExtendedTriangle.intersectsTriangle: Triangles are coplanar which does not support an output edge. Setting edge to 0, 0, 0.");
      }
      target.start.set(0, 0, 0);
      target.end.set(0, 0, 0);
    }
    return true;
  }
  function findSingleBounds(a, b, c, aProj, bProj, cProj, aDist, bDist, cDist, bounds, edge) {
    let t = aDist / (aDist - bDist);
    bounds.x = aProj + (bProj - aProj) * t;
    edge.start.subVectors(b, a).multiplyScalar(t).add(a);
    t = aDist / (aDist - cDist);
    bounds.y = aProj + (cProj - aProj) * t;
    edge.end.subVectors(c, a).multiplyScalar(t).add(a);
  }
  function findIntersectionLineBounds(self, aProj, bProj, cProj, abDist, acDist, aDist, bDist, cDist, bounds, edge) {
    if (abDist > 0) {
      findSingleBounds(self.c, self.a, self.b, cProj, aProj, bProj, cDist, aDist, bDist, bounds, edge);
    } else if (acDist > 0) {
      findSingleBounds(self.b, self.a, self.c, bProj, aProj, cProj, bDist, aDist, cDist, bounds, edge);
    } else if (bDist * cDist > 0 || aDist != 0) {
      findSingleBounds(self.a, self.b, self.c, aProj, bProj, cProj, aDist, bDist, cDist, bounds, edge);
    } else if (bDist != 0) {
      findSingleBounds(self.b, self.a, self.c, bProj, aProj, cProj, bDist, aDist, cDist, bounds, edge);
    } else if (cDist != 0) {
      findSingleBounds(self.c, self.a, self.b, cProj, aProj, bProj, cDist, aDist, bDist, bounds, edge);
    } else {
      return true;
    }
    return false;
  }
  function intersectTriangleSegment(triangle3, degenerateTriangle, target, suppressLog) {
    const segment = degenerateTriangle.degenerateSegment;
    const startDist = triangle3.plane.distanceToPoint(segment.start);
    const endDist = triangle3.plane.distanceToPoint(segment.end);
    if (isNearZero(startDist)) {
      if (isNearZero(endDist)) {
        return coplanarIntersectsTriangle(triangle3, degenerateTriangle, target, suppressLog);
      } else {
        if (target) {
          target.start.copy(segment.start);
          target.end.copy(segment.start);
        }
        return triangle3.containsPoint(segment.start);
      }
    } else if (isNearZero(endDist)) {
      if (target) {
        target.start.copy(segment.end);
        target.end.copy(segment.end);
      }
      return triangle3.containsPoint(segment.end);
    } else {
      if (triangle3.plane.intersectLine(segment, tmpVec) != null) {
        if (target) {
          target.start.copy(tmpVec);
          target.end.copy(tmpVec);
        }
        return triangle3.containsPoint(tmpVec);
      } else {
        return false;
      }
    }
  }
  function intersectTrianglePoint(triangle3, degenerateTriangle, target) {
    const point = degenerateTriangle.a;
    if (isNearZero(triangle3.plane.distanceToPoint(point)) && triangle3.containsPoint(point)) {
      if (target) {
        target.start.copy(point);
        target.end.copy(point);
      }
      return true;
    } else {
      return false;
    }
  }
  function intersectSegmentPoint(segmentTri, pointTri, target) {
    const segment = segmentTri.degenerateSegment;
    const point = pointTri.a;
    segment.closestPointToPoint(point, true, tmpVec);
    if (point.distanceToSquared(tmpVec) < ZERO_EPSILON_SQR) {
      if (target) {
        target.start.copy(point);
        target.end.copy(point);
      }
      return true;
    } else {
      return false;
    }
  }
  function handleDegenerateCases(self, other, target, suppressLog) {
    if (self.isDegenerateIntoSegment) {
      if (other.isDegenerateIntoSegment) {
        const segment1 = self.degenerateSegment;
        const segment2 = other.degenerateSegment;
        const delta1 = dir1;
        const delta2 = dir2;
        segment1.delta(delta1);
        segment2.delta(delta2);
        const startDelta = tmpVec.subVectors(segment2.start, segment1.start);
        const denom = delta1.x * delta2.y - delta1.y * delta2.x;
        if (isNearZero(denom)) {
          return false;
        }
        const t = (startDelta.x * delta2.y - startDelta.y * delta2.x) / denom;
        const u = -(delta1.x * startDelta.y - delta1.y * startDelta.x) / denom;
        if (t < 0 || t > 1 || u < 0 || u > 1) {
          return false;
        }
        const z1 = segment1.start.z + delta1.z * t;
        const z2 = segment2.start.z + delta2.z * u;
        if (isNearZero(z1 - z2)) {
          if (target) {
            target.start.copy(segment1.start).addScaledVector(delta1, t);
            target.end.copy(segment1.start).addScaledVector(delta1, t);
          }
          return true;
        } else {
          return false;
        }
      } else if (other.isDegenerateIntoPoint) {
        return intersectSegmentPoint(self, other, target);
      } else {
        return intersectTriangleSegment(other, self, target, suppressLog);
      }
    } else if (self.isDegenerateIntoPoint) {
      if (other.isDegenerateIntoPoint) {
        if (other.a.distanceToSquared(self.a) < ZERO_EPSILON_SQR) {
          if (target) {
            target.start.copy(self.a);
            target.end.copy(self.a);
          }
          return true;
        } else {
          return false;
        }
      } else if (other.isDegenerateIntoSegment) {
        return intersectSegmentPoint(other, self, target);
      } else {
        return intersectTrianglePoint(other, self, target);
      }
    } else {
      if (other.isDegenerateIntoPoint) {
        return intersectTrianglePoint(self, other, target);
      } else if (other.isDegenerateIntoSegment) {
        return intersectTriangleSegment(self, other, target, suppressLog);
      }
    }
  }
  return function intersectsTriangle(other, target = null, suppressLog = false) {
    if (this.needsUpdate) {
      this.update();
    }
    if (!other.isExtendedTriangle) {
      saTri2.copy(other);
      saTri2.update();
      other = saTri2;
    } else if (other.needsUpdate) {
      other.update();
    }
    const res = handleDegenerateCases(this, other, target, suppressLog);
    if (res !== void 0) {
      return res;
    }
    const plane1 = this.plane;
    const plane2 = other.plane;
    let a1Dist = plane2.distanceToPoint(this.a);
    let b1Dist = plane2.distanceToPoint(this.b);
    let c1Dist = plane2.distanceToPoint(this.c);
    if (isNearZero(a1Dist))
      a1Dist = 0;
    if (isNearZero(b1Dist))
      b1Dist = 0;
    if (isNearZero(c1Dist))
      c1Dist = 0;
    const a1b1Dist = a1Dist * b1Dist;
    const a1c1Dist = a1Dist * c1Dist;
    if (a1b1Dist > 0 && a1c1Dist > 0) {
      return false;
    }
    let a2Dist = plane1.distanceToPoint(other.a);
    let b2Dist = plane1.distanceToPoint(other.b);
    let c2Dist = plane1.distanceToPoint(other.c);
    if (isNearZero(a2Dist))
      a2Dist = 0;
    if (isNearZero(b2Dist))
      b2Dist = 0;
    if (isNearZero(c2Dist))
      c2Dist = 0;
    const a2b2Dist = a2Dist * b2Dist;
    const a2c2Dist = a2Dist * c2Dist;
    if (a2b2Dist > 0 && a2c2Dist > 0) {
      return false;
    }
    dir1.copy(plane1.normal);
    dir2.copy(plane2.normal);
    const intersectionLine = dir1.cross(dir2);
    let componentIndex = 0;
    let maxComponent = Math.abs(intersectionLine.x);
    const comp1 = Math.abs(intersectionLine.y);
    if (comp1 > maxComponent) {
      maxComponent = comp1;
      componentIndex = 1;
    }
    const comp2 = Math.abs(intersectionLine.z);
    if (comp2 > maxComponent) {
      componentIndex = 2;
    }
    const key = componentKeys[componentIndex];
    const a1Proj = this.a[key];
    const b1Proj = this.b[key];
    const c1Proj = this.c[key];
    const a2Proj = other.a[key];
    const b2Proj = other.b[key];
    const c2Proj = other.c[key];
    if (findIntersectionLineBounds(this, a1Proj, b1Proj, c1Proj, a1b1Dist, a1c1Dist, a1Dist, b1Dist, c1Dist, bounds1, edge1)) {
      return coplanarIntersectsTriangle(this, other, target, suppressLog);
    }
    if (findIntersectionLineBounds(other, a2Proj, b2Proj, c2Proj, a2b2Dist, a2c2Dist, a2Dist, b2Dist, c2Dist, bounds2, edge2)) {
      return coplanarIntersectsTriangle(this, other, target, suppressLog);
    }
    if (bounds1.y < bounds1.x) {
      const tmp = bounds1.y;
      bounds1.y = bounds1.x;
      bounds1.x = tmp;
      tempPoint.copy(edge1.start);
      edge1.start.copy(edge1.end);
      edge1.end.copy(tempPoint);
    }
    if (bounds2.y < bounds2.x) {
      const tmp = bounds2.y;
      bounds2.y = bounds2.x;
      bounds2.x = tmp;
      tempPoint.copy(edge2.start);
      edge2.start.copy(edge2.end);
      edge2.end.copy(tempPoint);
    }
    if (bounds1.y < bounds2.x || bounds2.y < bounds1.x) {
      return false;
    }
    if (target) {
      if (bounds2.x > bounds1.x) {
        target.start.copy(edge2.start);
      } else {
        target.start.copy(edge1.start);
      }
      if (bounds2.y < bounds1.y) {
        target.end.copy(edge2.end);
      } else {
        target.end.copy(edge1.end);
      }
    }
    return true;
  };
}();
ExtendedTriangle.prototype.distanceToPoint = function() {
  const target = /* @__PURE__ */ new Vector3();
  return function distanceToPoint(point) {
    this.closestPointToPoint(point, target);
    return point.distanceTo(target);
  };
}();
ExtendedTriangle.prototype.distanceToTriangle = function() {
  const point = /* @__PURE__ */ new Vector3();
  const point2 = /* @__PURE__ */ new Vector3();
  const cornerFields = ["a", "b", "c"];
  const line1 = /* @__PURE__ */ new Line3();
  const line2 = /* @__PURE__ */ new Line3();
  return function distanceToTriangle(other, target1 = null, target2 = null) {
    const lineTarget = target1 || target2 ? line1 : null;
    if (this.intersectsTriangle(other, lineTarget)) {
      if (target1 || target2) {
        if (target1)
          lineTarget.getCenter(target1);
        if (target2)
          lineTarget.getCenter(target2);
      }
      return 0;
    }
    let closestDistanceSq = Infinity;
    for (let i = 0; i < 3; i++) {
      let dist;
      const field = cornerFields[i];
      const otherVec = other[field];
      this.closestPointToPoint(otherVec, point);
      dist = otherVec.distanceToSquared(point);
      if (dist < closestDistanceSq) {
        closestDistanceSq = dist;
        if (target1)
          target1.copy(point);
        if (target2)
          target2.copy(otherVec);
      }
      const thisVec = this[field];
      other.closestPointToPoint(thisVec, point);
      dist = thisVec.distanceToSquared(point);
      if (dist < closestDistanceSq) {
        closestDistanceSq = dist;
        if (target1)
          target1.copy(thisVec);
        if (target2)
          target2.copy(point);
      }
    }
    for (let i = 0; i < 3; i++) {
      const f11 = cornerFields[i];
      const f12 = cornerFields[(i + 1) % 3];
      line1.set(this[f11], this[f12]);
      for (let i2 = 0; i2 < 3; i2++) {
        const f21 = cornerFields[i2];
        const f22 = cornerFields[(i2 + 1) % 3];
        line2.set(other[f21], other[f22]);
        closestPointsSegmentToSegment(line1, line2, point, point2);
        const dist = point.distanceToSquared(point2);
        if (dist < closestDistanceSq) {
          closestDistanceSq = dist;
          if (target1)
            target1.copy(point);
          if (target2)
            target2.copy(point2);
        }
      }
    }
    return Math.sqrt(closestDistanceSq);
  };
}();
class OrientedBox {
  constructor(min, max, matrix) {
    this.isOrientedBox = true;
    this.min = new Vector3();
    this.max = new Vector3();
    this.matrix = new Matrix4();
    this.invMatrix = new Matrix4();
    this.points = new Array(8).fill().map(() => new Vector3());
    this.satAxes = new Array(3).fill().map(() => new Vector3());
    this.satBounds = new Array(3).fill().map(() => new SeparatingAxisBounds());
    this.alignedSatBounds = new Array(3).fill().map(() => new SeparatingAxisBounds());
    this.needsUpdate = false;
    if (min)
      this.min.copy(min);
    if (max)
      this.max.copy(max);
    if (matrix)
      this.matrix.copy(matrix);
  }
  set(min, max, matrix) {
    this.min.copy(min);
    this.max.copy(max);
    this.matrix.copy(matrix);
    this.needsUpdate = true;
  }
  copy(other) {
    this.min.copy(other.min);
    this.max.copy(other.max);
    this.matrix.copy(other.matrix);
    this.needsUpdate = true;
  }
}
OrientedBox.prototype.update = function() {
  return function update() {
    const matrix = this.matrix;
    const min = this.min;
    const max = this.max;
    const points = this.points;
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          const i = (1 << 0) * x | (1 << 1) * y | (1 << 2) * z;
          const v = points[i];
          v.x = x ? max.x : min.x;
          v.y = y ? max.y : min.y;
          v.z = z ? max.z : min.z;
          v.applyMatrix4(matrix);
        }
      }
    }
    const satBounds = this.satBounds;
    const satAxes = this.satAxes;
    const minVec = points[0];
    for (let i = 0; i < 3; i++) {
      const axis = satAxes[i];
      const sb = satBounds[i];
      const index = 1 << i;
      const pi = points[index];
      axis.subVectors(minVec, pi);
      sb.setFromPoints(axis, points);
    }
    const alignedSatBounds = this.alignedSatBounds;
    alignedSatBounds[0].setFromPointsField(points, "x");
    alignedSatBounds[1].setFromPointsField(points, "y");
    alignedSatBounds[2].setFromPointsField(points, "z");
    this.invMatrix.copy(this.matrix).invert();
    this.needsUpdate = false;
  };
}();
OrientedBox.prototype.intersectsBox = function() {
  const aabbBounds = /* @__PURE__ */ new SeparatingAxisBounds();
  return function intersectsBox(box) {
    if (this.needsUpdate) {
      this.update();
    }
    const min = box.min;
    const max = box.max;
    const satBounds = this.satBounds;
    const satAxes = this.satAxes;
    const alignedSatBounds = this.alignedSatBounds;
    aabbBounds.min = min.x;
    aabbBounds.max = max.x;
    if (alignedSatBounds[0].isSeparated(aabbBounds))
      return false;
    aabbBounds.min = min.y;
    aabbBounds.max = max.y;
    if (alignedSatBounds[1].isSeparated(aabbBounds))
      return false;
    aabbBounds.min = min.z;
    aabbBounds.max = max.z;
    if (alignedSatBounds[2].isSeparated(aabbBounds))
      return false;
    for (let i = 0; i < 3; i++) {
      const axis = satAxes[i];
      const sb = satBounds[i];
      aabbBounds.setFromBox(axis, box);
      if (sb.isSeparated(aabbBounds))
        return false;
    }
    return true;
  };
}();
OrientedBox.prototype.intersectsTriangle = function() {
  const saTri = /* @__PURE__ */ new ExtendedTriangle();
  const pointsArr = /* @__PURE__ */ new Array(3);
  const cachedSatBounds = /* @__PURE__ */ new SeparatingAxisBounds();
  const cachedSatBounds2 = /* @__PURE__ */ new SeparatingAxisBounds();
  const cachedAxis = /* @__PURE__ */ new Vector3();
  return function intersectsTriangle(triangle3) {
    if (this.needsUpdate) {
      this.update();
    }
    if (!triangle3.isExtendedTriangle) {
      saTri.copy(triangle3);
      saTri.update();
      triangle3 = saTri;
    } else if (triangle3.needsUpdate) {
      triangle3.update();
    }
    const satBounds = this.satBounds;
    const satAxes = this.satAxes;
    pointsArr[0] = triangle3.a;
    pointsArr[1] = triangle3.b;
    pointsArr[2] = triangle3.c;
    for (let i = 0; i < 3; i++) {
      const sb = satBounds[i];
      const sa = satAxes[i];
      cachedSatBounds.setFromPoints(sa, pointsArr);
      if (sb.isSeparated(cachedSatBounds))
        return false;
    }
    const triSatBounds = triangle3.satBounds;
    const triSatAxes = triangle3.satAxes;
    const points = this.points;
    for (let i = 0; i < 3; i++) {
      const sb = triSatBounds[i];
      const sa = triSatAxes[i];
      cachedSatBounds.setFromPoints(sa, points);
      if (sb.isSeparated(cachedSatBounds))
        return false;
    }
    for (let i = 0; i < 3; i++) {
      const sa1 = satAxes[i];
      for (let i2 = 0; i2 < 4; i2++) {
        const sa2 = triSatAxes[i2];
        cachedAxis.crossVectors(sa1, sa2);
        cachedSatBounds.setFromPoints(cachedAxis, pointsArr);
        cachedSatBounds2.setFromPoints(cachedAxis, points);
        if (cachedSatBounds.isSeparated(cachedSatBounds2))
          return false;
      }
    }
    return true;
  };
}();
OrientedBox.prototype.closestPointToPoint = function() {
  return function closestPointToPoint2(point, target1) {
    if (this.needsUpdate) {
      this.update();
    }
    target1.copy(point).applyMatrix4(this.invMatrix).clamp(this.min, this.max).applyMatrix4(this.matrix);
    return target1;
  };
}();
OrientedBox.prototype.distanceToPoint = function() {
  const target = new Vector3();
  return function distanceToPoint(point) {
    this.closestPointToPoint(point, target);
    return point.distanceTo(target);
  };
}();
OrientedBox.prototype.distanceToBox = function() {
  const xyzFields = ["x", "y", "z"];
  const segments1 = /* @__PURE__ */ new Array(12).fill().map(() => new Line3());
  const segments2 = /* @__PURE__ */ new Array(12).fill().map(() => new Line3());
  const point1 = /* @__PURE__ */ new Vector3();
  const point2 = /* @__PURE__ */ new Vector3();
  return function distanceToBox(box, threshold = 0, target1 = null, target2 = null) {
    if (this.needsUpdate) {
      this.update();
    }
    if (this.intersectsBox(box)) {
      if (target1 || target2) {
        box.getCenter(point2);
        this.closestPointToPoint(point2, point1);
        box.closestPointToPoint(point1, point2);
        if (target1)
          target1.copy(point1);
        if (target2)
          target2.copy(point2);
      }
      return 0;
    }
    const threshold2 = threshold * threshold;
    const min = box.min;
    const max = box.max;
    const points = this.points;
    let closestDistanceSq = Infinity;
    for (let i = 0; i < 8; i++) {
      const p = points[i];
      point2.copy(p).clamp(min, max);
      const dist = p.distanceToSquared(point2);
      if (dist < closestDistanceSq) {
        closestDistanceSq = dist;
        if (target1)
          target1.copy(p);
        if (target2)
          target2.copy(point2);
        if (dist < threshold2)
          return Math.sqrt(dist);
      }
    }
    let count = 0;
    for (let i = 0; i < 3; i++) {
      for (let i1 = 0; i1 <= 1; i1++) {
        for (let i2 = 0; i2 <= 1; i2++) {
          const nextIndex = (i + 1) % 3;
          const nextIndex2 = (i + 2) % 3;
          const index = i1 << nextIndex | i2 << nextIndex2;
          const index2 = 1 << i | i1 << nextIndex | i2 << nextIndex2;
          const p1 = points[index];
          const p2 = points[index2];
          const line1 = segments1[count];
          line1.set(p1, p2);
          const f1 = xyzFields[i];
          const f2 = xyzFields[nextIndex];
          const f3 = xyzFields[nextIndex2];
          const line2 = segments2[count];
          const start = line2.start;
          const end = line2.end;
          start[f1] = min[f1];
          start[f2] = i1 ? min[f2] : max[f2];
          start[f3] = i2 ? min[f3] : max[f2];
          end[f1] = max[f1];
          end[f2] = i1 ? min[f2] : max[f2];
          end[f3] = i2 ? min[f3] : max[f2];
          count++;
        }
      }
    }
    for (let x = 0; x <= 1; x++) {
      for (let y = 0; y <= 1; y++) {
        for (let z = 0; z <= 1; z++) {
          point2.x = x ? max.x : min.x;
          point2.y = y ? max.y : min.y;
          point2.z = z ? max.z : min.z;
          this.closestPointToPoint(point2, point1);
          const dist = point2.distanceToSquared(point1);
          if (dist < closestDistanceSq) {
            closestDistanceSq = dist;
            if (target1)
              target1.copy(point1);
            if (target2)
              target2.copy(point2);
            if (dist < threshold2)
              return Math.sqrt(dist);
          }
        }
      }
    }
    for (let i = 0; i < 12; i++) {
      const l1 = segments1[i];
      for (let i2 = 0; i2 < 12; i2++) {
        const l2 = segments2[i2];
        closestPointsSegmentToSegment(l1, l2, point1, point2);
        const dist = point1.distanceToSquared(point2);
        if (dist < closestDistanceSq) {
          closestDistanceSq = dist;
          if (target1)
            target1.copy(point1);
          if (target2)
            target2.copy(point2);
          if (dist < threshold2)
            return Math.sqrt(dist);
        }
      }
    }
    return Math.sqrt(closestDistanceSq);
  };
}();
class ExtendedTrianglePoolBase extends PrimitivePool {
  constructor() {
    super(() => new ExtendedTriangle());
  }
}
const ExtendedTrianglePool = /* @__PURE__ */ new ExtendedTrianglePoolBase();
const temp = /* @__PURE__ */ new Vector3();
const temp1$2 = /* @__PURE__ */ new Vector3();
function closestPointToPoint(bvh, point, target = {}, minThreshold = 0, maxThreshold = Infinity) {
  const minThresholdSq = minThreshold * minThreshold;
  const maxThresholdSq = maxThreshold * maxThreshold;
  let closestDistanceSq = Infinity;
  let closestDistanceTriIndex = null;
  bvh.shapecast(
    {
      boundsTraverseOrder: (box) => {
        temp.copy(point).clamp(box.min, box.max);
        return temp.distanceToSquared(point);
      },
      intersectsBounds: (box, isLeaf, score) => {
        return score < closestDistanceSq && score < maxThresholdSq;
      },
      intersectsTriangle: (tri, triIndex) => {
        tri.closestPointToPoint(point, temp);
        const distSq = point.distanceToSquared(temp);
        if (distSq < closestDistanceSq) {
          temp1$2.copy(temp);
          closestDistanceSq = distSq;
          closestDistanceTriIndex = triIndex;
        }
        if (distSq < minThresholdSq) {
          return true;
        } else {
          return false;
        }
      }
    }
  );
  if (closestDistanceSq === Infinity)
    return null;
  const closestDistance = Math.sqrt(closestDistanceSq);
  if (!target.point)
    target.point = temp1$2.clone();
  else
    target.point.copy(temp1$2);
  target.distance = closestDistance, target.faceIndex = closestDistanceTriIndex;
  return target;
}
const IS_GT_REVISION_169 = parseInt(REVISION) >= 169;
const IS_LT_REVISION_161 = parseInt(REVISION) <= 161;
const _vA = /* @__PURE__ */ new Vector3();
const _vB = /* @__PURE__ */ new Vector3();
const _vC = /* @__PURE__ */ new Vector3();
const _uvA = /* @__PURE__ */ new Vector2();
const _uvB = /* @__PURE__ */ new Vector2();
const _uvC = /* @__PURE__ */ new Vector2();
const _normalA = /* @__PURE__ */ new Vector3();
const _normalB = /* @__PURE__ */ new Vector3();
const _normalC = /* @__PURE__ */ new Vector3();
const _intersectionPoint = /* @__PURE__ */ new Vector3();
function checkIntersection(ray, pA, pB, pC, point, side, near, far) {
  let intersect;
  if (side === BackSide) {
    intersect = ray.intersectTriangle(pC, pB, pA, true, point);
  } else {
    intersect = ray.intersectTriangle(pA, pB, pC, side !== DoubleSide, point);
  }
  if (intersect === null)
    return null;
  const distance = ray.origin.distanceTo(point);
  if (distance < near || distance > far)
    return null;
  return {
    distance,
    point: point.clone()
  };
}
function checkBufferGeometryIntersection(ray, position, normal, uv, uv1, a, b, c, side, near, far) {
  _vA.fromBufferAttribute(position, a);
  _vB.fromBufferAttribute(position, b);
  _vC.fromBufferAttribute(position, c);
  const intersection = checkIntersection(ray, _vA, _vB, _vC, _intersectionPoint, side, near, far);
  if (intersection) {
    if (uv) {
      _uvA.fromBufferAttribute(uv, a);
      _uvB.fromBufferAttribute(uv, b);
      _uvC.fromBufferAttribute(uv, c);
      intersection.uv = new Vector2();
      const res = Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, intersection.uv);
      if (!IS_GT_REVISION_169) {
        intersection.uv = res;
      }
    }
    if (uv1) {
      _uvA.fromBufferAttribute(uv1, a);
      _uvB.fromBufferAttribute(uv1, b);
      _uvC.fromBufferAttribute(uv1, c);
      intersection.uv1 = new Vector2();
      const res = Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _uvA, _uvB, _uvC, intersection.uv1);
      if (!IS_GT_REVISION_169) {
        intersection.uv1 = res;
      }
      if (IS_LT_REVISION_161) {
        intersection.uv2 = intersection.uv1;
      }
    }
    if (normal) {
      _normalA.fromBufferAttribute(normal, a);
      _normalB.fromBufferAttribute(normal, b);
      _normalC.fromBufferAttribute(normal, c);
      intersection.normal = new Vector3();
      const res = Triangle.getInterpolation(_intersectionPoint, _vA, _vB, _vC, _normalA, _normalB, _normalC, intersection.normal);
      if (intersection.normal.dot(ray.direction) > 0) {
        intersection.normal.multiplyScalar(-1);
      }
      if (!IS_GT_REVISION_169) {
        intersection.normal = res;
      }
    }
    const face = {
      a,
      b,
      c,
      normal: new Vector3(),
      materialIndex: 0
    };
    Triangle.getNormal(_vA, _vB, _vC, face.normal);
    intersection.face = face;
    intersection.faceIndex = a;
    if (IS_GT_REVISION_169) {
      const barycoord = new Vector3();
      Triangle.getBarycoord(_intersectionPoint, _vA, _vB, _vC, barycoord);
      intersection.barycoord = barycoord;
    }
  }
  return intersection;
}
function getSide(materialOrSide) {
  return materialOrSide && materialOrSide.isMaterial ? materialOrSide.side : materialOrSide;
}
function intersectTri(geometry, materialOrSide, ray, tri, intersections, near, far) {
  const triOffset = tri * 3;
  let a = triOffset + 0;
  let b = triOffset + 1;
  let c = triOffset + 2;
  const { index, groups } = geometry;
  if (geometry.index) {
    a = index.getX(a);
    b = index.getX(b);
    c = index.getX(c);
  }
  const { position, normal, uv, uv1 } = geometry.attributes;
  if (Array.isArray(materialOrSide)) {
    const firstIndex = tri * 3;
    for (let i = 0, l = groups.length; i < l; i++) {
      const { start, count, materialIndex } = groups[i];
      if (firstIndex >= start && firstIndex < start + count) {
        const side = getSide(materialOrSide[materialIndex]);
        const intersection = checkBufferGeometryIntersection(ray, position, normal, uv, uv1, a, b, c, side, near, far);
        if (intersection) {
          intersection.faceIndex = tri;
          intersection.face.materialIndex = materialIndex;
          if (intersections) {
            intersections.push(intersection);
          } else {
            return intersection;
          }
        }
      }
    }
  } else {
    const side = getSide(materialOrSide);
    const intersection = checkBufferGeometryIntersection(ray, position, normal, uv, uv1, a, b, c, side, near, far);
    if (intersection) {
      intersection.faceIndex = tri;
      intersection.face.materialIndex = 0;
      if (intersections) {
        intersections.push(intersection);
      } else {
        return intersection;
      }
    }
  }
  return null;
}
function setTriangle(tri, i, index, pos) {
  const ta = tri.a;
  const tb = tri.b;
  const tc = tri.c;
  let i0 = i;
  let i1 = i + 1;
  let i2 = i + 2;
  if (index) {
    i0 = index.getX(i0);
    i1 = index.getX(i1);
    i2 = index.getX(i2);
  }
  ta.x = pos.getX(i0);
  ta.y = pos.getY(i0);
  ta.z = pos.getZ(i0);
  tb.x = pos.getX(i1);
  tb.y = pos.getY(i1);
  tb.z = pos.getZ(i1);
  tc.x = pos.getX(i2);
  tc.y = pos.getY(i2);
  tc.z = pos.getZ(i2);
}
function intersectTris(bvh, materialOrSide, ray, offset, count, intersections, near, far) {
  const { geometry, _indirectBuffer } = bvh;
  for (let i = offset, end = offset + count; i < end; i++) {
    intersectTri(geometry, materialOrSide, ray, i, intersections, near, far);
  }
}
function intersectClosestTri(bvh, materialOrSide, ray, offset, count, near, far) {
  const { geometry, _indirectBuffer } = bvh;
  let dist = Infinity;
  let res = null;
  for (let i = offset, end = offset + count; i < end; i++) {
    let intersection;
    intersection = intersectTri(geometry, materialOrSide, ray, i, null, near, far);
    if (intersection && intersection.distance < dist) {
      res = intersection;
      dist = intersection.distance;
    }
  }
  return res;
}
function iterateOverTriangles(offset, count, bvh, intersectsTriangleFunc, contained, depth, triangle3) {
  const { geometry } = bvh;
  const { index } = geometry;
  const pos = geometry.attributes.position;
  for (let i = offset, l = count + offset; i < l; i++) {
    let tri;
    tri = i;
    setTriangle(triangle3, tri * 3, index, pos);
    triangle3.needsUpdate = true;
    if (intersectsTriangleFunc(triangle3, tri, contained, depth)) {
      return true;
    }
  }
  return false;
}
function refit(bvh, nodeIndices = null) {
  if (nodeIndices && Array.isArray(nodeIndices)) {
    nodeIndices = new Set(nodeIndices);
  }
  const geometry = bvh.geometry;
  const indexArr = geometry.index ? geometry.index.array : null;
  const posAttr = geometry.attributes.position;
  let buffer, uint32Array2, uint16Array2, float32Array2;
  let byteOffset = 0;
  const roots = bvh._roots;
  for (let i = 0, l = roots.length; i < l; i++) {
    buffer = roots[i];
    uint32Array2 = new Uint32Array(buffer);
    uint16Array2 = new Uint16Array(buffer);
    float32Array2 = new Float32Array(buffer);
    _traverse2(0, byteOffset);
    byteOffset += buffer.byteLength;
  }
  function _traverse2(nodeIndex32, byteOffset2, force = false) {
    const nodeIndex16 = nodeIndex32 * 2;
    if (IS_LEAF(nodeIndex16, uint16Array2)) {
      const offset = OFFSET(nodeIndex32, uint32Array2);
      const count = COUNT(nodeIndex16, uint16Array2);
      let minx = Infinity;
      let miny = Infinity;
      let minz = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      let maxz = -Infinity;
      for (let i = 3 * offset, l = 3 * (offset + count); i < l; i++) {
        let index = indexArr[i];
        const x = posAttr.getX(index);
        const y = posAttr.getY(index);
        const z = posAttr.getZ(index);
        if (x < minx)
          minx = x;
        if (x > maxx)
          maxx = x;
        if (y < miny)
          miny = y;
        if (y > maxy)
          maxy = y;
        if (z < minz)
          minz = z;
        if (z > maxz)
          maxz = z;
      }
      if (float32Array2[nodeIndex32 + 0] !== minx || float32Array2[nodeIndex32 + 1] !== miny || float32Array2[nodeIndex32 + 2] !== minz || float32Array2[nodeIndex32 + 3] !== maxx || float32Array2[nodeIndex32 + 4] !== maxy || float32Array2[nodeIndex32 + 5] !== maxz) {
        float32Array2[nodeIndex32 + 0] = minx;
        float32Array2[nodeIndex32 + 1] = miny;
        float32Array2[nodeIndex32 + 2] = minz;
        float32Array2[nodeIndex32 + 3] = maxx;
        float32Array2[nodeIndex32 + 4] = maxy;
        float32Array2[nodeIndex32 + 5] = maxz;
        return true;
      } else {
        return false;
      }
    } else {
      const left = LEFT_NODE(nodeIndex32);
      const right = RIGHT_NODE(nodeIndex32, uint32Array2);
      let forceChildren = force;
      let includesLeft = false;
      let includesRight = false;
      if (nodeIndices) {
        if (!forceChildren) {
          const leftNodeId = left / UINT32_PER_NODE + byteOffset2 / BYTES_PER_NODE;
          const rightNodeId = right / UINT32_PER_NODE + byteOffset2 / BYTES_PER_NODE;
          includesLeft = nodeIndices.has(leftNodeId);
          includesRight = nodeIndices.has(rightNodeId);
          forceChildren = !includesLeft && !includesRight;
        }
      } else {
        includesLeft = true;
        includesRight = true;
      }
      const traverseLeft = forceChildren || includesLeft;
      const traverseRight = forceChildren || includesRight;
      let leftChange = false;
      if (traverseLeft) {
        leftChange = _traverse2(left, byteOffset2, forceChildren);
      }
      let rightChange = false;
      if (traverseRight) {
        rightChange = _traverse2(right, byteOffset2, forceChildren);
      }
      const didChange = leftChange || rightChange;
      if (didChange) {
        for (let i = 0; i < 3; i++) {
          const left_i = left + i;
          const right_i = right + i;
          const minLeftValue = float32Array2[left_i];
          const maxLeftValue = float32Array2[left_i + 3];
          const minRightValue = float32Array2[right_i];
          const maxRightValue = float32Array2[right_i + 3];
          float32Array2[nodeIndex32 + i] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
          float32Array2[nodeIndex32 + i + 3] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;
        }
      }
      return didChange;
    }
  }
}
function intersectRay(nodeIndex32, array, ray, near, far) {
  let tmin, tmax, tymin, tymax, tzmin, tzmax;
  const invdirx = 1 / ray.direction.x, invdiry = 1 / ray.direction.y, invdirz = 1 / ray.direction.z;
  const ox = ray.origin.x;
  const oy = ray.origin.y;
  const oz = ray.origin.z;
  let minx = array[nodeIndex32];
  let maxx = array[nodeIndex32 + 3];
  let miny = array[nodeIndex32 + 1];
  let maxy = array[nodeIndex32 + 3 + 1];
  let minz = array[nodeIndex32 + 2];
  let maxz = array[nodeIndex32 + 3 + 2];
  if (invdirx >= 0) {
    tmin = (minx - ox) * invdirx;
    tmax = (maxx - ox) * invdirx;
  } else {
    tmin = (maxx - ox) * invdirx;
    tmax = (minx - ox) * invdirx;
  }
  if (invdiry >= 0) {
    tymin = (miny - oy) * invdiry;
    tymax = (maxy - oy) * invdiry;
  } else {
    tymin = (maxy - oy) * invdiry;
    tymax = (miny - oy) * invdiry;
  }
  if (tmin > tymax || tymin > tmax)
    return false;
  if (tymin > tmin || isNaN(tmin))
    tmin = tymin;
  if (tymax < tmax || isNaN(tmax))
    tmax = tymax;
  if (invdirz >= 0) {
    tzmin = (minz - oz) * invdirz;
    tzmax = (maxz - oz) * invdirz;
  } else {
    tzmin = (maxz - oz) * invdirz;
    tzmax = (minz - oz) * invdirz;
  }
  if (tmin > tzmax || tzmin > tmax)
    return false;
  if (tzmin > tmin || tmin !== tmin)
    tmin = tzmin;
  if (tzmax < tmax || tmax !== tmax)
    tmax = tzmax;
  return tmin <= far && tmax >= near;
}
function intersectTris_indirect(bvh, materialOrSide, ray, offset, count, intersections, near, far) {
  const { geometry, _indirectBuffer } = bvh;
  for (let i = offset, end = offset + count; i < end; i++) {
    let vi = _indirectBuffer ? _indirectBuffer[i] : i;
    intersectTri(geometry, materialOrSide, ray, vi, intersections, near, far);
  }
}
function intersectClosestTri_indirect(bvh, materialOrSide, ray, offset, count, near, far) {
  const { geometry, _indirectBuffer } = bvh;
  let dist = Infinity;
  let res = null;
  for (let i = offset, end = offset + count; i < end; i++) {
    let intersection;
    intersection = intersectTri(geometry, materialOrSide, ray, _indirectBuffer ? _indirectBuffer[i] : i, null, near, far);
    if (intersection && intersection.distance < dist) {
      res = intersection;
      dist = intersection.distance;
    }
  }
  return res;
}
function iterateOverTriangles_indirect(offset, count, bvh, intersectsTriangleFunc, contained, depth, triangle3) {
  const { geometry } = bvh;
  const { index } = geometry;
  const pos = geometry.attributes.position;
  for (let i = offset, l = count + offset; i < l; i++) {
    let tri;
    tri = bvh.resolveTriangleIndex(i);
    setTriangle(triangle3, tri * 3, index, pos);
    triangle3.needsUpdate = true;
    if (intersectsTriangleFunc(triangle3, tri, contained, depth)) {
      return true;
    }
  }
  return false;
}
function raycast(bvh, root, materialOrSide, ray, intersects, near, far) {
  BufferStack.setBuffer(bvh._roots[root]);
  _raycast$1(0, bvh, materialOrSide, ray, intersects, near, far);
  BufferStack.clearBuffer();
}
function _raycast$1(nodeIndex32, bvh, materialOrSide, ray, intersects, near, far) {
  const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
  const nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array2);
    const count = COUNT(nodeIndex16, uint16Array2);
    intersectTris(bvh, materialOrSide, ray, offset, count, intersects, near, far);
  } else {
    const leftIndex = LEFT_NODE(nodeIndex32);
    if (intersectRay(leftIndex, float32Array2, ray, near, far)) {
      _raycast$1(leftIndex, bvh, materialOrSide, ray, intersects, near, far);
    }
    const rightIndex = RIGHT_NODE(nodeIndex32, uint32Array2);
    if (intersectRay(rightIndex, float32Array2, ray, near, far)) {
      _raycast$1(rightIndex, bvh, materialOrSide, ray, intersects, near, far);
    }
  }
}
const _xyzFields$1 = ["x", "y", "z"];
function raycastFirst(bvh, root, materialOrSide, ray, near, far) {
  BufferStack.setBuffer(bvh._roots[root]);
  const result = _raycastFirst$1(0, bvh, materialOrSide, ray, near, far);
  BufferStack.clearBuffer();
  return result;
}
function _raycastFirst$1(nodeIndex32, bvh, materialOrSide, ray, near, far) {
  const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array2);
    const count = COUNT(nodeIndex16, uint16Array2);
    return intersectClosestTri(bvh, materialOrSide, ray, offset, count, near, far);
  } else {
    const splitAxis = SPLIT_AXIS(nodeIndex32, uint32Array2);
    const xyzAxis = _xyzFields$1[splitAxis];
    const rayDir = ray.direction[xyzAxis];
    const leftToRight = rayDir >= 0;
    let c1, c2;
    if (leftToRight) {
      c1 = LEFT_NODE(nodeIndex32);
      c2 = RIGHT_NODE(nodeIndex32, uint32Array2);
    } else {
      c1 = RIGHT_NODE(nodeIndex32, uint32Array2);
      c2 = LEFT_NODE(nodeIndex32);
    }
    const c1Intersection = intersectRay(c1, float32Array2, ray, near, far);
    const c1Result = c1Intersection ? _raycastFirst$1(c1, bvh, materialOrSide, ray, near, far) : null;
    if (c1Result) {
      const point = c1Result.point[xyzAxis];
      const isOutside = leftToRight ? point <= float32Array2[c2 + splitAxis] : point >= float32Array2[c2 + splitAxis + 3];
      if (isOutside) {
        return c1Result;
      }
    }
    const c2Intersection = intersectRay(c2, float32Array2, ray, near, far);
    const c2Result = c2Intersection ? _raycastFirst$1(c2, bvh, materialOrSide, ray, near, far) : null;
    if (c1Result && c2Result) {
      return c1Result.distance <= c2Result.distance ? c1Result : c2Result;
    } else {
      return c1Result || c2Result || null;
    }
  }
}
const boundingBox$1 = /* @__PURE__ */ new Box3();
const triangle$1 = /* @__PURE__ */ new ExtendedTriangle();
const triangle2$1 = /* @__PURE__ */ new ExtendedTriangle();
const invertedMat$1 = /* @__PURE__ */ new Matrix4();
const obb$3 = /* @__PURE__ */ new OrientedBox();
const obb2$3 = /* @__PURE__ */ new OrientedBox();
function intersectsGeometry(bvh, root, otherGeometry, geometryToBvh) {
  BufferStack.setBuffer(bvh._roots[root]);
  const result = _intersectsGeometry$1(0, bvh, otherGeometry, geometryToBvh);
  BufferStack.clearBuffer();
  return result;
}
function _intersectsGeometry$1(nodeIndex32, bvh, otherGeometry, geometryToBvh, cachedObb = null) {
  const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;
  if (cachedObb === null) {
    if (!otherGeometry.boundingBox) {
      otherGeometry.computeBoundingBox();
    }
    obb$3.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
    cachedObb = obb$3;
  }
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
  if (isLeaf) {
    const thisGeometry = bvh.geometry;
    const thisIndex = thisGeometry.index;
    const thisPos = thisGeometry.attributes.position;
    const otherIndex = otherGeometry.index;
    const otherPos = otherGeometry.attributes.position;
    const offset = OFFSET(nodeIndex32, uint32Array2);
    const count = COUNT(nodeIndex16, uint16Array2);
    invertedMat$1.copy(geometryToBvh).invert();
    if (otherGeometry.boundsTree) {
      arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array2, obb2$3);
      obb2$3.matrix.copy(invertedMat$1);
      obb2$3.needsUpdate = true;
      const res = otherGeometry.boundsTree.shapecast({
        intersectsBounds: (box) => obb2$3.intersectsBox(box),
        intersectsTriangle: (tri) => {
          tri.a.applyMatrix4(geometryToBvh);
          tri.b.applyMatrix4(geometryToBvh);
          tri.c.applyMatrix4(geometryToBvh);
          tri.needsUpdate = true;
          for (let i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
            setTriangle(triangle2$1, i, thisIndex, thisPos);
            triangle2$1.needsUpdate = true;
            if (tri.intersectsTriangle(triangle2$1)) {
              return true;
            }
          }
          return false;
        }
      });
      return res;
    } else {
      const otherTriangleCount = getTriCount(otherGeometry);
      for (let i = offset * 3, l = (count + offset) * 3; i < l; i += 3) {
        setTriangle(triangle$1, i, thisIndex, thisPos);
        triangle$1.a.applyMatrix4(invertedMat$1);
        triangle$1.b.applyMatrix4(invertedMat$1);
        triangle$1.c.applyMatrix4(invertedMat$1);
        triangle$1.needsUpdate = true;
        for (let i2 = 0, l2 = otherTriangleCount * 3; i2 < l2; i2 += 3) {
          setTriangle(triangle2$1, i2, otherIndex, otherPos);
          triangle2$1.needsUpdate = true;
          if (triangle$1.intersectsTriangle(triangle2$1)) {
            return true;
          }
        }
      }
    }
  } else {
    const left = LEFT_NODE(nodeIndex32);
    const right = RIGHT_NODE(nodeIndex32, uint32Array2);
    arrayToBox(BOUNDING_DATA_INDEX(left), float32Array2, boundingBox$1);
    const leftIntersection = cachedObb.intersectsBox(boundingBox$1) && _intersectsGeometry$1(left, bvh, otherGeometry, geometryToBvh, cachedObb);
    if (leftIntersection)
      return true;
    arrayToBox(BOUNDING_DATA_INDEX(right), float32Array2, boundingBox$1);
    const rightIntersection = cachedObb.intersectsBox(boundingBox$1) && _intersectsGeometry$1(right, bvh, otherGeometry, geometryToBvh, cachedObb);
    if (rightIntersection)
      return true;
    return false;
  }
}
const tempMatrix$1 = /* @__PURE__ */ new Matrix4();
const obb$2 = /* @__PURE__ */ new OrientedBox();
const obb2$2 = /* @__PURE__ */ new OrientedBox();
const temp1$1 = /* @__PURE__ */ new Vector3();
const temp2$1 = /* @__PURE__ */ new Vector3();
const temp3$1 = /* @__PURE__ */ new Vector3();
const temp4$1 = /* @__PURE__ */ new Vector3();
function closestPointToGeometry(bvh, otherGeometry, geometryToBvh, target1 = {}, target2 = {}, minThreshold = 0, maxThreshold = Infinity) {
  if (!otherGeometry.boundingBox) {
    otherGeometry.computeBoundingBox();
  }
  obb$2.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
  obb$2.needsUpdate = true;
  const geometry = bvh.geometry;
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const otherPos = otherGeometry.attributes.position;
  const otherIndex = otherGeometry.index;
  const triangle3 = ExtendedTrianglePool.getPrimitive();
  const triangle22 = ExtendedTrianglePool.getPrimitive();
  let tempTarget1 = temp1$1;
  let tempTargetDest1 = temp2$1;
  let tempTarget2 = null;
  let tempTargetDest2 = null;
  if (target2) {
    tempTarget2 = temp3$1;
    tempTargetDest2 = temp4$1;
  }
  let closestDistance = Infinity;
  let closestDistanceTriIndex = null;
  let closestDistanceOtherTriIndex = null;
  tempMatrix$1.copy(geometryToBvh).invert();
  obb2$2.matrix.copy(tempMatrix$1);
  bvh.shapecast(
    {
      boundsTraverseOrder: (box) => {
        return obb$2.distanceToBox(box);
      },
      intersectsBounds: (box, isLeaf, score) => {
        if (score < closestDistance && score < maxThreshold) {
          if (isLeaf) {
            obb2$2.min.copy(box.min);
            obb2$2.max.copy(box.max);
            obb2$2.needsUpdate = true;
          }
          return true;
        }
        return false;
      },
      intersectsRange: (offset, count) => {
        if (otherGeometry.boundsTree) {
          const otherBvh = otherGeometry.boundsTree;
          return otherBvh.shapecast({
            boundsTraverseOrder: (box) => {
              return obb2$2.distanceToBox(box);
            },
            intersectsBounds: (box, isLeaf, score) => {
              return score < closestDistance && score < maxThreshold;
            },
            intersectsRange: (otherOffset, otherCount) => {
              for (let i2 = otherOffset, l2 = otherOffset + otherCount; i2 < l2; i2++) {
                setTriangle(triangle22, 3 * i2, otherIndex, otherPos);
                triangle22.a.applyMatrix4(geometryToBvh);
                triangle22.b.applyMatrix4(geometryToBvh);
                triangle22.c.applyMatrix4(geometryToBvh);
                triangle22.needsUpdate = true;
                for (let i = offset, l = offset + count; i < l; i++) {
                  setTriangle(triangle3, 3 * i, index, pos);
                  triangle3.needsUpdate = true;
                  const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
                  if (dist < closestDistance) {
                    tempTargetDest1.copy(tempTarget1);
                    if (tempTargetDest2) {
                      tempTargetDest2.copy(tempTarget2);
                    }
                    closestDistance = dist;
                    closestDistanceTriIndex = i;
                    closestDistanceOtherTriIndex = i2;
                  }
                  if (dist < minThreshold) {
                    return true;
                  }
                }
              }
            }
          });
        } else {
          const triCount = getTriCount(otherGeometry);
          for (let i2 = 0, l2 = triCount; i2 < l2; i2++) {
            setTriangle(triangle22, 3 * i2, otherIndex, otherPos);
            triangle22.a.applyMatrix4(geometryToBvh);
            triangle22.b.applyMatrix4(geometryToBvh);
            triangle22.c.applyMatrix4(geometryToBvh);
            triangle22.needsUpdate = true;
            for (let i = offset, l = offset + count; i < l; i++) {
              setTriangle(triangle3, 3 * i, index, pos);
              triangle3.needsUpdate = true;
              const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
              if (dist < closestDistance) {
                tempTargetDest1.copy(tempTarget1);
                if (tempTargetDest2) {
                  tempTargetDest2.copy(tempTarget2);
                }
                closestDistance = dist;
                closestDistanceTriIndex = i;
                closestDistanceOtherTriIndex = i2;
              }
              if (dist < minThreshold) {
                return true;
              }
            }
          }
        }
      }
    }
  );
  ExtendedTrianglePool.releasePrimitive(triangle3);
  ExtendedTrianglePool.releasePrimitive(triangle22);
  if (closestDistance === Infinity) {
    return null;
  }
  if (!target1.point) {
    target1.point = tempTargetDest1.clone();
  } else {
    target1.point.copy(tempTargetDest1);
  }
  target1.distance = closestDistance, target1.faceIndex = closestDistanceTriIndex;
  if (target2) {
    if (!target2.point)
      target2.point = tempTargetDest2.clone();
    else
      target2.point.copy(tempTargetDest2);
    target2.point.applyMatrix4(tempMatrix$1);
    tempTargetDest1.applyMatrix4(tempMatrix$1);
    target2.distance = tempTargetDest1.sub(target2.point).length();
    target2.faceIndex = closestDistanceOtherTriIndex;
  }
  return target1;
}
function refit_indirect(bvh, nodeIndices = null) {
  if (nodeIndices && Array.isArray(nodeIndices)) {
    nodeIndices = new Set(nodeIndices);
  }
  const geometry = bvh.geometry;
  const indexArr = geometry.index ? geometry.index.array : null;
  const posAttr = geometry.attributes.position;
  let buffer, uint32Array2, uint16Array2, float32Array2;
  let byteOffset = 0;
  const roots = bvh._roots;
  for (let i = 0, l = roots.length; i < l; i++) {
    buffer = roots[i];
    uint32Array2 = new Uint32Array(buffer);
    uint16Array2 = new Uint16Array(buffer);
    float32Array2 = new Float32Array(buffer);
    _traverse2(0, byteOffset);
    byteOffset += buffer.byteLength;
  }
  function _traverse2(nodeIndex32, byteOffset2, force = false) {
    const nodeIndex16 = nodeIndex32 * 2;
    if (IS_LEAF(nodeIndex16, uint16Array2)) {
      const offset = OFFSET(nodeIndex32, uint32Array2);
      const count = COUNT(nodeIndex16, uint16Array2);
      let minx = Infinity;
      let miny = Infinity;
      let minz = Infinity;
      let maxx = -Infinity;
      let maxy = -Infinity;
      let maxz = -Infinity;
      for (let i = offset, l = offset + count; i < l; i++) {
        const t = 3 * bvh.resolveTriangleIndex(i);
        for (let j = 0; j < 3; j++) {
          let index = t + j;
          index = indexArr ? indexArr[index] : index;
          const x = posAttr.getX(index);
          const y = posAttr.getY(index);
          const z = posAttr.getZ(index);
          if (x < minx)
            minx = x;
          if (x > maxx)
            maxx = x;
          if (y < miny)
            miny = y;
          if (y > maxy)
            maxy = y;
          if (z < minz)
            minz = z;
          if (z > maxz)
            maxz = z;
        }
      }
      if (float32Array2[nodeIndex32 + 0] !== minx || float32Array2[nodeIndex32 + 1] !== miny || float32Array2[nodeIndex32 + 2] !== minz || float32Array2[nodeIndex32 + 3] !== maxx || float32Array2[nodeIndex32 + 4] !== maxy || float32Array2[nodeIndex32 + 5] !== maxz) {
        float32Array2[nodeIndex32 + 0] = minx;
        float32Array2[nodeIndex32 + 1] = miny;
        float32Array2[nodeIndex32 + 2] = minz;
        float32Array2[nodeIndex32 + 3] = maxx;
        float32Array2[nodeIndex32 + 4] = maxy;
        float32Array2[nodeIndex32 + 5] = maxz;
        return true;
      } else {
        return false;
      }
    } else {
      const left = LEFT_NODE(nodeIndex32);
      const right = RIGHT_NODE(nodeIndex32, uint32Array2);
      let forceChildren = force;
      let includesLeft = false;
      let includesRight = false;
      if (nodeIndices) {
        if (!forceChildren) {
          const leftNodeId = left / UINT32_PER_NODE + byteOffset2 / BYTES_PER_NODE;
          const rightNodeId = right / UINT32_PER_NODE + byteOffset2 / BYTES_PER_NODE;
          includesLeft = nodeIndices.has(leftNodeId);
          includesRight = nodeIndices.has(rightNodeId);
          forceChildren = !includesLeft && !includesRight;
        }
      } else {
        includesLeft = true;
        includesRight = true;
      }
      const traverseLeft = forceChildren || includesLeft;
      const traverseRight = forceChildren || includesRight;
      let leftChange = false;
      if (traverseLeft) {
        leftChange = _traverse2(left, byteOffset2, forceChildren);
      }
      let rightChange = false;
      if (traverseRight) {
        rightChange = _traverse2(right, byteOffset2, forceChildren);
      }
      const didChange = leftChange || rightChange;
      if (didChange) {
        for (let i = 0; i < 3; i++) {
          const left_i = left + i;
          const right_i = right + i;
          const minLeftValue = float32Array2[left_i];
          const maxLeftValue = float32Array2[left_i + 3];
          const minRightValue = float32Array2[right_i];
          const maxRightValue = float32Array2[right_i + 3];
          float32Array2[nodeIndex32 + i] = minLeftValue < minRightValue ? minLeftValue : minRightValue;
          float32Array2[nodeIndex32 + i + 3] = maxLeftValue > maxRightValue ? maxLeftValue : maxRightValue;
        }
      }
      return didChange;
    }
  }
}
function raycast_indirect(bvh, root, materialOrSide, ray, intersects, near, far) {
  BufferStack.setBuffer(bvh._roots[root]);
  _raycast(0, bvh, materialOrSide, ray, intersects, near, far);
  BufferStack.clearBuffer();
}
function _raycast(nodeIndex32, bvh, materialOrSide, ray, intersects, near, far) {
  const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
  const nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array2);
    const count = COUNT(nodeIndex16, uint16Array2);
    intersectTris_indirect(bvh, materialOrSide, ray, offset, count, intersects, near, far);
  } else {
    const leftIndex = LEFT_NODE(nodeIndex32);
    if (intersectRay(leftIndex, float32Array2, ray, near, far)) {
      _raycast(leftIndex, bvh, materialOrSide, ray, intersects, near, far);
    }
    const rightIndex = RIGHT_NODE(nodeIndex32, uint32Array2);
    if (intersectRay(rightIndex, float32Array2, ray, near, far)) {
      _raycast(rightIndex, bvh, materialOrSide, ray, intersects, near, far);
    }
  }
}
const _xyzFields = ["x", "y", "z"];
function raycastFirst_indirect(bvh, root, materialOrSide, ray, near, far) {
  BufferStack.setBuffer(bvh._roots[root]);
  const result = _raycastFirst(0, bvh, materialOrSide, ray, near, far);
  BufferStack.clearBuffer();
  return result;
}
function _raycastFirst(nodeIndex32, bvh, materialOrSide, ray, near, far) {
  const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
  if (isLeaf) {
    const offset = OFFSET(nodeIndex32, uint32Array2);
    const count = COUNT(nodeIndex16, uint16Array2);
    return intersectClosestTri_indirect(bvh, materialOrSide, ray, offset, count, near, far);
  } else {
    const splitAxis = SPLIT_AXIS(nodeIndex32, uint32Array2);
    const xyzAxis = _xyzFields[splitAxis];
    const rayDir = ray.direction[xyzAxis];
    const leftToRight = rayDir >= 0;
    let c1, c2;
    if (leftToRight) {
      c1 = LEFT_NODE(nodeIndex32);
      c2 = RIGHT_NODE(nodeIndex32, uint32Array2);
    } else {
      c1 = RIGHT_NODE(nodeIndex32, uint32Array2);
      c2 = LEFT_NODE(nodeIndex32);
    }
    const c1Intersection = intersectRay(c1, float32Array2, ray, near, far);
    const c1Result = c1Intersection ? _raycastFirst(c1, bvh, materialOrSide, ray, near, far) : null;
    if (c1Result) {
      const point = c1Result.point[xyzAxis];
      const isOutside = leftToRight ? point <= float32Array2[c2 + splitAxis] : point >= float32Array2[c2 + splitAxis + 3];
      if (isOutside) {
        return c1Result;
      }
    }
    const c2Intersection = intersectRay(c2, float32Array2, ray, near, far);
    const c2Result = c2Intersection ? _raycastFirst(c2, bvh, materialOrSide, ray, near, far) : null;
    if (c1Result && c2Result) {
      return c1Result.distance <= c2Result.distance ? c1Result : c2Result;
    } else {
      return c1Result || c2Result || null;
    }
  }
}
const boundingBox = /* @__PURE__ */ new Box3();
const triangle = /* @__PURE__ */ new ExtendedTriangle();
const triangle2 = /* @__PURE__ */ new ExtendedTriangle();
const invertedMat = /* @__PURE__ */ new Matrix4();
const obb$1 = /* @__PURE__ */ new OrientedBox();
const obb2$1 = /* @__PURE__ */ new OrientedBox();
function intersectsGeometry_indirect(bvh, root, otherGeometry, geometryToBvh) {
  BufferStack.setBuffer(bvh._roots[root]);
  const result = _intersectsGeometry(0, bvh, otherGeometry, geometryToBvh);
  BufferStack.clearBuffer();
  return result;
}
function _intersectsGeometry(nodeIndex32, bvh, otherGeometry, geometryToBvh, cachedObb = null) {
  const { float32Array: float32Array2, uint16Array: uint16Array2, uint32Array: uint32Array2 } = BufferStack;
  let nodeIndex16 = nodeIndex32 * 2;
  if (cachedObb === null) {
    if (!otherGeometry.boundingBox) {
      otherGeometry.computeBoundingBox();
    }
    obb$1.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
    cachedObb = obb$1;
  }
  const isLeaf = IS_LEAF(nodeIndex16, uint16Array2);
  if (isLeaf) {
    const thisGeometry = bvh.geometry;
    const thisIndex = thisGeometry.index;
    const thisPos = thisGeometry.attributes.position;
    const otherIndex = otherGeometry.index;
    const otherPos = otherGeometry.attributes.position;
    const offset = OFFSET(nodeIndex32, uint32Array2);
    const count = COUNT(nodeIndex16, uint16Array2);
    invertedMat.copy(geometryToBvh).invert();
    if (otherGeometry.boundsTree) {
      arrayToBox(BOUNDING_DATA_INDEX(nodeIndex32), float32Array2, obb2$1);
      obb2$1.matrix.copy(invertedMat);
      obb2$1.needsUpdate = true;
      const res = otherGeometry.boundsTree.shapecast({
        intersectsBounds: (box) => obb2$1.intersectsBox(box),
        intersectsTriangle: (tri) => {
          tri.a.applyMatrix4(geometryToBvh);
          tri.b.applyMatrix4(geometryToBvh);
          tri.c.applyMatrix4(geometryToBvh);
          tri.needsUpdate = true;
          for (let i = offset, l = count + offset; i < l; i++) {
            setTriangle(triangle2, 3 * bvh.resolveTriangleIndex(i), thisIndex, thisPos);
            triangle2.needsUpdate = true;
            if (tri.intersectsTriangle(triangle2)) {
              return true;
            }
          }
          return false;
        }
      });
      return res;
    } else {
      const otherTriangleCount = getTriCount(otherGeometry);
      for (let i = offset, l = count + offset; i < l; i++) {
        const ti = bvh.resolveTriangleIndex(i);
        setTriangle(triangle, 3 * ti, thisIndex, thisPos);
        triangle.a.applyMatrix4(invertedMat);
        triangle.b.applyMatrix4(invertedMat);
        triangle.c.applyMatrix4(invertedMat);
        triangle.needsUpdate = true;
        for (let i2 = 0, l2 = otherTriangleCount * 3; i2 < l2; i2 += 3) {
          setTriangle(triangle2, i2, otherIndex, otherPos);
          triangle2.needsUpdate = true;
          if (triangle.intersectsTriangle(triangle2)) {
            return true;
          }
        }
      }
    }
  } else {
    const left = LEFT_NODE(nodeIndex32);
    const right = RIGHT_NODE(nodeIndex32, uint32Array2);
    arrayToBox(BOUNDING_DATA_INDEX(left), float32Array2, boundingBox);
    const leftIntersection = cachedObb.intersectsBox(boundingBox) && _intersectsGeometry(left, bvh, otherGeometry, geometryToBvh, cachedObb);
    if (leftIntersection)
      return true;
    arrayToBox(BOUNDING_DATA_INDEX(right), float32Array2, boundingBox);
    const rightIntersection = cachedObb.intersectsBox(boundingBox) && _intersectsGeometry(right, bvh, otherGeometry, geometryToBvh, cachedObb);
    if (rightIntersection)
      return true;
    return false;
  }
}
const tempMatrix = /* @__PURE__ */ new Matrix4();
const obb = /* @__PURE__ */ new OrientedBox();
const obb2 = /* @__PURE__ */ new OrientedBox();
const temp1 = /* @__PURE__ */ new Vector3();
const temp2 = /* @__PURE__ */ new Vector3();
const temp3 = /* @__PURE__ */ new Vector3();
const temp4 = /* @__PURE__ */ new Vector3();
function closestPointToGeometry_indirect(bvh, otherGeometry, geometryToBvh, target1 = {}, target2 = {}, minThreshold = 0, maxThreshold = Infinity) {
  if (!otherGeometry.boundingBox) {
    otherGeometry.computeBoundingBox();
  }
  obb.set(otherGeometry.boundingBox.min, otherGeometry.boundingBox.max, geometryToBvh);
  obb.needsUpdate = true;
  const geometry = bvh.geometry;
  const pos = geometry.attributes.position;
  const index = geometry.index;
  const otherPos = otherGeometry.attributes.position;
  const otherIndex = otherGeometry.index;
  const triangle3 = ExtendedTrianglePool.getPrimitive();
  const triangle22 = ExtendedTrianglePool.getPrimitive();
  let tempTarget1 = temp1;
  let tempTargetDest1 = temp2;
  let tempTarget2 = null;
  let tempTargetDest2 = null;
  if (target2) {
    tempTarget2 = temp3;
    tempTargetDest2 = temp4;
  }
  let closestDistance = Infinity;
  let closestDistanceTriIndex = null;
  let closestDistanceOtherTriIndex = null;
  tempMatrix.copy(geometryToBvh).invert();
  obb2.matrix.copy(tempMatrix);
  bvh.shapecast(
    {
      boundsTraverseOrder: (box) => {
        return obb.distanceToBox(box);
      },
      intersectsBounds: (box, isLeaf, score) => {
        if (score < closestDistance && score < maxThreshold) {
          if (isLeaf) {
            obb2.min.copy(box.min);
            obb2.max.copy(box.max);
            obb2.needsUpdate = true;
          }
          return true;
        }
        return false;
      },
      intersectsRange: (offset, count) => {
        if (otherGeometry.boundsTree) {
          const otherBvh = otherGeometry.boundsTree;
          return otherBvh.shapecast({
            boundsTraverseOrder: (box) => {
              return obb2.distanceToBox(box);
            },
            intersectsBounds: (box, isLeaf, score) => {
              return score < closestDistance && score < maxThreshold;
            },
            intersectsRange: (otherOffset, otherCount) => {
              for (let i2 = otherOffset, l2 = otherOffset + otherCount; i2 < l2; i2++) {
                const ti2 = otherBvh.resolveTriangleIndex(i2);
                setTriangle(triangle22, 3 * ti2, otherIndex, otherPos);
                triangle22.a.applyMatrix4(geometryToBvh);
                triangle22.b.applyMatrix4(geometryToBvh);
                triangle22.c.applyMatrix4(geometryToBvh);
                triangle22.needsUpdate = true;
                for (let i = offset, l = offset + count; i < l; i++) {
                  const ti = bvh.resolveTriangleIndex(i);
                  setTriangle(triangle3, 3 * ti, index, pos);
                  triangle3.needsUpdate = true;
                  const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
                  if (dist < closestDistance) {
                    tempTargetDest1.copy(tempTarget1);
                    if (tempTargetDest2) {
                      tempTargetDest2.copy(tempTarget2);
                    }
                    closestDistance = dist;
                    closestDistanceTriIndex = i;
                    closestDistanceOtherTriIndex = i2;
                  }
                  if (dist < minThreshold) {
                    return true;
                  }
                }
              }
            }
          });
        } else {
          const triCount = getTriCount(otherGeometry);
          for (let i2 = 0, l2 = triCount; i2 < l2; i2++) {
            setTriangle(triangle22, 3 * i2, otherIndex, otherPos);
            triangle22.a.applyMatrix4(geometryToBvh);
            triangle22.b.applyMatrix4(geometryToBvh);
            triangle22.c.applyMatrix4(geometryToBvh);
            triangle22.needsUpdate = true;
            for (let i = offset, l = offset + count; i < l; i++) {
              const ti = bvh.resolveTriangleIndex(i);
              setTriangle(triangle3, 3 * ti, index, pos);
              triangle3.needsUpdate = true;
              const dist = triangle3.distanceToTriangle(triangle22, tempTarget1, tempTarget2);
              if (dist < closestDistance) {
                tempTargetDest1.copy(tempTarget1);
                if (tempTargetDest2) {
                  tempTargetDest2.copy(tempTarget2);
                }
                closestDistance = dist;
                closestDistanceTriIndex = i;
                closestDistanceOtherTriIndex = i2;
              }
              if (dist < minThreshold) {
                return true;
              }
            }
          }
        }
      }
    }
  );
  ExtendedTrianglePool.releasePrimitive(triangle3);
  ExtendedTrianglePool.releasePrimitive(triangle22);
  if (closestDistance === Infinity) {
    return null;
  }
  if (!target1.point) {
    target1.point = tempTargetDest1.clone();
  } else {
    target1.point.copy(tempTargetDest1);
  }
  target1.distance = closestDistance, target1.faceIndex = closestDistanceTriIndex;
  if (target2) {
    if (!target2.point)
      target2.point = tempTargetDest2.clone();
    else
      target2.point.copy(tempTargetDest2);
    target2.point.applyMatrix4(tempMatrix);
    tempTargetDest1.applyMatrix4(tempMatrix);
    target2.distance = tempTargetDest1.sub(target2.point).length();
    target2.faceIndex = closestDistanceOtherTriIndex;
  }
  return target1;
}
function convertRaycastIntersect(hit, object, raycaster) {
  if (hit === null) {
    return null;
  }
  hit.point.applyMatrix4(object.matrixWorld);
  hit.distance = hit.point.distanceTo(raycaster.ray.origin);
  hit.object = object;
  return hit;
}
const _obb = /* @__PURE__ */ new OrientedBox();
const _ray = /* @__PURE__ */ new Ray();
const _direction = /* @__PURE__ */ new Vector3();
const _inverseMatrix = /* @__PURE__ */ new Matrix4();
const _worldScale = /* @__PURE__ */ new Vector3();
const _getters = ["getX", "getY", "getZ"];
class MeshBVH extends GeometryBVH {
  static serialize(bvh, options = {}) {
    options = {
      cloneBuffers: true,
      ...options
    };
    const geometry = bvh.geometry;
    const rootData = bvh._roots;
    const indirectBuffer = bvh._indirectBuffer;
    const indexAttribute = geometry.getIndex();
    const result = {
      version: 1,
      roots: null,
      index: null,
      indirectBuffer: null
    };
    if (options.cloneBuffers) {
      result.roots = rootData.map((root) => root.slice());
      result.index = indexAttribute ? indexAttribute.array.slice() : null;
      result.indirectBuffer = indirectBuffer ? indirectBuffer.slice() : null;
    } else {
      result.roots = rootData;
      result.index = indexAttribute ? indexAttribute.array : null;
      result.indirectBuffer = indirectBuffer;
    }
    return result;
  }
  static deserialize(data, geometry, options = {}) {
    options = {
      setIndex: true,
      indirect: Boolean(data.indirectBuffer),
      ...options
    };
    const { index, roots, indirectBuffer } = data;
    if (!data.version) {
      console.warn(
        "MeshBVH.deserialize: Serialization format has been changed and will be fixed up. It is recommended to regenerate any stored serialized data."
      );
      fixupVersion0(roots);
    }
    const bvh = new MeshBVH(geometry, { ...options, [SKIP_GENERATION]: true });
    bvh._roots = roots;
    bvh._indirectBuffer = indirectBuffer || null;
    if (options.setIndex) {
      const indexAttribute = geometry.getIndex();
      if (indexAttribute === null) {
        const newIndex = new BufferAttribute(data.index, 1, false);
        geometry.setIndex(newIndex);
      } else if (indexAttribute.array !== index) {
        indexAttribute.array.set(index);
        indexAttribute.needsUpdate = true;
      }
    }
    return bvh;
    function fixupVersion0(roots2) {
      for (let rootIndex = 0; rootIndex < roots2.length; rootIndex++) {
        const root = roots2[rootIndex];
        const uint32Array2 = new Uint32Array(root);
        const uint16Array2 = new Uint16Array(root);
        for (let node = 0, l = root.byteLength / BYTES_PER_NODE; node < l; node++) {
          const node32Index = UINT32_PER_NODE * node;
          const node16Index = 2 * node32Index;
          if (!IS_LEAF(node16Index, uint16Array2)) {
            uint32Array2[node32Index + 6] = uint32Array2[node32Index + 6] / UINT32_PER_NODE - node;
          }
        }
      }
    }
  }
  get primitiveStride() {
    return 3;
  }
  get resolveTriangleIndex() {
    return this.resolvePrimitiveIndex;
  }
  constructor(geometry, options = {}) {
    if (options.maxLeafTris) {
      console.warn('MeshBVH: "maxLeafTris" option has been deprecated. Use maxLeafSize, instead.');
      options = {
        ...options,
        maxLeafSize: options.maxLeafTris
      };
    }
    super(geometry, options);
  }
  shiftTriangleOffsets(offset) {
    return super.shiftPrimitiveOffsets(offset);
  }
  writePrimitiveBounds(i, targetBuffer, baseIndex) {
    const geometry = this.geometry;
    const indirectBuffer = this._indirectBuffer;
    const posAttr = geometry.attributes.position;
    const index = geometry.index ? geometry.index.array : null;
    const tri = indirectBuffer ? indirectBuffer[i] : i;
    const tri3 = tri * 3;
    let ai = tri3 + 0;
    let bi = tri3 + 1;
    let ci = tri3 + 2;
    if (index) {
      ai = index[ai];
      bi = index[bi];
      ci = index[ci];
    }
    for (let el = 0; el < 3; el++) {
      const a = posAttr[_getters[el]](ai);
      const b = posAttr[_getters[el]](bi);
      const c = posAttr[_getters[el]](ci);
      let min = a;
      if (b < min)
        min = b;
      if (c < min)
        min = c;
      let max = a;
      if (b > max)
        max = b;
      if (c > max)
        max = c;
      targetBuffer[baseIndex + el] = min;
      targetBuffer[baseIndex + el + 3] = max;
    }
    return targetBuffer;
  }
  computePrimitiveBounds(offset, count, targetBuffer) {
    const geometry = this.geometry;
    const indirectBuffer = this._indirectBuffer;
    const posAttr = geometry.attributes.position;
    const index = geometry.index ? geometry.index.array : null;
    const normalized = posAttr.normalized;
    if (offset < 0 || count + offset - targetBuffer.offset > targetBuffer.length / 6) {
      throw new Error("MeshBVH: compute triangle bounds range is invalid.");
    }
    const posArr = posAttr.array;
    const bufferOffset = posAttr.offset || 0;
    let stride = 3;
    if (posAttr.isInterleavedBufferAttribute) {
      stride = posAttr.data.stride;
    }
    const getters = ["getX", "getY", "getZ"];
    const writeOffset = targetBuffer.offset;
    for (let i = offset, l = offset + count; i < l; i++) {
      const tri = indirectBuffer ? indirectBuffer[i] : i;
      const tri3 = tri * 3;
      const boundsIndexOffset = (i - writeOffset) * 6;
      let ai = tri3 + 0;
      let bi = tri3 + 1;
      let ci = tri3 + 2;
      if (index) {
        ai = index[ai];
        bi = index[bi];
        ci = index[ci];
      }
      if (!normalized) {
        ai = ai * stride + bufferOffset;
        bi = bi * stride + bufferOffset;
        ci = ci * stride + bufferOffset;
      }
      for (let el = 0; el < 3; el++) {
        let a, b, c;
        if (normalized) {
          a = posAttr[getters[el]](ai);
          b = posAttr[getters[el]](bi);
          c = posAttr[getters[el]](ci);
        } else {
          a = posArr[ai + el];
          b = posArr[bi + el];
          c = posArr[ci + el];
        }
        let min = a;
        if (b < min)
          min = b;
        if (c < min)
          min = c;
        let max = a;
        if (b > max)
          max = b;
        if (c > max)
          max = c;
        const halfExtents = (max - min) / 2;
        const el2 = el * 2;
        targetBuffer[boundsIndexOffset + el2 + 0] = min + halfExtents;
        targetBuffer[boundsIndexOffset + el2 + 1] = halfExtents + (Math.abs(min) + halfExtents) * FLOAT32_EPSILON;
      }
    }
    return targetBuffer;
  }
  raycastObject3D(object, raycaster, intersects = []) {
    const { material } = object;
    if (material === void 0) {
      return;
    }
    _inverseMatrix.copy(object.matrixWorld).invert();
    _ray.copy(raycaster.ray).applyMatrix4(_inverseMatrix);
    _worldScale.setFromMatrixScale(object.matrixWorld);
    _direction.copy(_ray.direction).multiply(_worldScale);
    const scaleFactor = _direction.length();
    const near = raycaster.near / scaleFactor;
    const far = raycaster.far / scaleFactor;
    if (raycaster.firstHitOnly === true) {
      let hit = this.raycastFirst(_ray, material, near, far);
      hit = convertRaycastIntersect(hit, object, raycaster);
      if (hit) {
        intersects.push(hit);
      }
    } else {
      const hits = this.raycast(_ray, material, near, far);
      for (let i = 0, l = hits.length; i < l; i++) {
        const hit = convertRaycastIntersect(hits[i], object, raycaster);
        if (hit) {
          intersects.push(hit);
        }
      }
    }
    return intersects;
  }
  refit(nodeIndices = null) {
    const refitFunc = this.indirect ? refit_indirect : refit;
    return refitFunc(this, nodeIndices);
  }
  raycast(ray, materialOrSide = FrontSide, near = 0, far = Infinity) {
    const roots = this._roots;
    const intersects = [];
    const raycastFunc = this.indirect ? raycast_indirect : raycast;
    for (let i = 0, l = roots.length; i < l; i++) {
      raycastFunc(this, i, materialOrSide, ray, intersects, near, far);
    }
    return intersects;
  }
  raycastFirst(ray, materialOrSide = FrontSide, near = 0, far = Infinity) {
    const roots = this._roots;
    let closestResult = null;
    const raycastFirstFunc = this.indirect ? raycastFirst_indirect : raycastFirst;
    for (let i = 0, l = roots.length; i < l; i++) {
      const result = raycastFirstFunc(this, i, materialOrSide, ray, near, far);
      if (result != null && (closestResult == null || result.distance < closestResult.distance)) {
        closestResult = result;
      }
    }
    return closestResult;
  }
  intersectsGeometry(otherGeometry, geomToMesh) {
    let result = false;
    const roots = this._roots;
    const intersectsGeometryFunc = this.indirect ? intersectsGeometry_indirect : intersectsGeometry;
    for (let i = 0, l = roots.length; i < l; i++) {
      result = intersectsGeometryFunc(this, i, otherGeometry, geomToMesh);
      if (result) {
        break;
      }
    }
    return result;
  }
  shapecast(callbacks) {
    const triangle3 = ExtendedTrianglePool.getPrimitive();
    const result = super.shapecast(
      {
        ...callbacks,
        intersectsPrimitive: callbacks.intersectsTriangle,
        scratchPrimitive: triangle3,
        iterate: this.indirect ? iterateOverTriangles_indirect : iterateOverTriangles
      }
    );
    ExtendedTrianglePool.releasePrimitive(triangle3);
    return result;
  }
  bvhcast(otherBvh, matrixToLocal, callbacks) {
    let {
      intersectsRanges,
      intersectsTriangles
    } = callbacks;
    const triangle1 = ExtendedTrianglePool.getPrimitive();
    const indexAttr1 = this.geometry.index;
    const positionAttr1 = this.geometry.attributes.position;
    const assignTriangle1 = this.indirect ? (i1) => {
      const ti = this.resolveTriangleIndex(i1);
      setTriangle(triangle1, ti * 3, indexAttr1, positionAttr1);
    } : (i1) => {
      setTriangle(triangle1, i1 * 3, indexAttr1, positionAttr1);
    };
    const triangle22 = ExtendedTrianglePool.getPrimitive();
    const indexAttr2 = otherBvh.geometry.index;
    const positionAttr2 = otherBvh.geometry.attributes.position;
    const assignTriangle2 = otherBvh.indirect ? (i2) => {
      const ti2 = otherBvh.resolveTriangleIndex(i2);
      setTriangle(triangle22, ti2 * 3, indexAttr2, positionAttr2);
    } : (i2) => {
      setTriangle(triangle22, i2 * 3, indexAttr2, positionAttr2);
    };
    if (intersectsTriangles) {
      if (!(otherBvh instanceof MeshBVH)) {
        throw new Error('MeshBVH: "intersectsTriangles" callback can only be used with another MeshBVH.');
      }
      const iterateOverDoubleTriangles = (offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2) => {
        for (let i2 = offset2, l2 = offset2 + count2; i2 < l2; i2++) {
          assignTriangle2(i2);
          triangle22.a.applyMatrix4(matrixToLocal);
          triangle22.b.applyMatrix4(matrixToLocal);
          triangle22.c.applyMatrix4(matrixToLocal);
          triangle22.needsUpdate = true;
          for (let i1 = offset1, l1 = offset1 + count1; i1 < l1; i1++) {
            assignTriangle1(i1);
            triangle1.needsUpdate = true;
            if (intersectsTriangles(triangle1, triangle22, i1, i2, depth1, nodeIndex1, depth2, nodeIndex2)) {
              return true;
            }
          }
        }
        return false;
      };
      if (intersectsRanges) {
        const originalIntersectsRanges = intersectsRanges;
        intersectsRanges = function(offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2) {
          if (!originalIntersectsRanges(offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2)) {
            return iterateOverDoubleTriangles(offset1, count1, offset2, count2, depth1, nodeIndex1, depth2, nodeIndex2);
          }
          return true;
        };
      } else {
        intersectsRanges = iterateOverDoubleTriangles;
      }
    }
    return super.bvhcast(otherBvh, matrixToLocal, { intersectsRanges });
  }
  intersectsBox(box, boxToMesh) {
    _obb.set(box.min, box.max, boxToMesh);
    _obb.needsUpdate = true;
    return this.shapecast(
      {
        intersectsBounds: (box2) => _obb.intersectsBox(box2),
        intersectsTriangle: (tri) => _obb.intersectsTriangle(tri)
      }
    );
  }
  intersectsSphere(sphere) {
    return this.shapecast(
      {
        intersectsBounds: (box) => sphere.intersectsBox(box),
        intersectsTriangle: (tri) => tri.intersectsSphere(sphere)
      }
    );
  }
  closestPointToGeometry(otherGeometry, geometryToBvh, target1 = {}, target2 = {}, minThreshold = 0, maxThreshold = Infinity) {
    const closestPointToGeometryFunc = this.indirect ? closestPointToGeometry_indirect : closestPointToGeometry;
    return closestPointToGeometryFunc(
      this,
      otherGeometry,
      geometryToBvh,
      target1,
      target2,
      minThreshold,
      maxThreshold
    );
  }
  closestPointToPoint(point, target = {}, minThreshold = 0, maxThreshold = Infinity) {
    return closestPointToPoint(
      this,
      point,
      target,
      minThreshold,
      maxThreshold
    );
  }
}
const _raycastFunctions = {
  "Mesh": Mesh.prototype.raycast,
  "Line": Line.prototype.raycast,
  "LineSegments": LineSegments.prototype.raycast,
  "LineLoop": LineLoop.prototype.raycast,
  "Points": Points.prototype.raycast,
  "BatchedMesh": BatchedMesh.prototype.raycast
};
const _mesh = /* @__PURE__ */ new Mesh();
const _batchIntersects = [];
function acceleratedRaycast(raycaster, intersects) {
  if (this.isBatchedMesh) {
    acceleratedBatchedMeshRaycast.call(this, raycaster, intersects);
  } else {
    const { geometry } = this;
    if (geometry.boundsTree) {
      geometry.boundsTree.raycastObject3D(this, raycaster, intersects);
    } else {
      let raycastFunction;
      if (this instanceof Mesh) {
        raycastFunction = _raycastFunctions.Mesh;
      } else if (this instanceof LineSegments) {
        raycastFunction = _raycastFunctions.LineSegments;
      } else if (this instanceof LineLoop) {
        raycastFunction = _raycastFunctions.LineLoop;
      } else if (this instanceof Line) {
        raycastFunction = _raycastFunctions.Line;
      } else if (this instanceof Points) {
        raycastFunction = _raycastFunctions.Points;
      } else {
        throw new Error("BVH: Fallback raycast function not found.");
      }
      raycastFunction.call(this, raycaster, intersects);
    }
  }
}
function acceleratedBatchedMeshRaycast(raycaster, intersects) {
  if (this.boundsTrees) {
    const boundsTrees = this.boundsTrees;
    const drawInfo = this._drawInfo || this._instanceInfo;
    const drawRanges = this._drawRanges || this._geometryInfo;
    const matrixWorld = this.matrixWorld;
    _mesh.material = this.material;
    _mesh.geometry = this.geometry;
    const oldBoundsTree = _mesh.geometry.boundsTree;
    const oldDrawRange = _mesh.geometry.drawRange;
    if (_mesh.geometry.boundingSphere === null) {
      _mesh.geometry.boundingSphere = new Sphere();
    }
    for (let i = 0, l = drawInfo.length; i < l; i++) {
      if (!this.getVisibleAt(i)) {
        continue;
      }
      const geometryId = drawInfo[i].geometryIndex;
      _mesh.geometry.boundsTree = boundsTrees[geometryId];
      this.getMatrixAt(i, _mesh.matrixWorld).premultiply(matrixWorld);
      if (!_mesh.geometry.boundsTree) {
        this.getBoundingBoxAt(geometryId, _mesh.geometry.boundingBox);
        this.getBoundingSphereAt(geometryId, _mesh.geometry.boundingSphere);
        const drawRange = drawRanges[geometryId];
        _mesh.geometry.setDrawRange(drawRange.start, drawRange.count);
      }
      _mesh.raycast(raycaster, _batchIntersects);
      for (let j = 0, l2 = _batchIntersects.length; j < l2; j++) {
        const intersect = _batchIntersects[j];
        intersect.object = this;
        intersect.batchId = i;
        intersects.push(intersect);
      }
      _batchIntersects.length = 0;
    }
    _mesh.geometry.boundsTree = oldBoundsTree;
    _mesh.geometry.drawRange = oldDrawRange;
    _mesh.material = null;
    _mesh.geometry = null;
  } else {
    _raycastFunctions.BatchedMesh.call(this, raycaster, intersects);
  }
}
const _BvhRaycastManager = class {
  constructor(options) {
    __publicField(this, "bvhCache", /* @__PURE__ */ new Map());
    __publicField(this, "bvhPrecomputeWorker", null);
    __publicField(this, "bvhPrecomputeGeneration", 0);
    __publicField(this, "nextBvhPrecomputeTaskId", 1);
    __publicField(this, "pendingBvhTasks", /* @__PURE__ */ new Map());
    __publicField(this, "pendingBvhGeometries", /* @__PURE__ */ new Set());
    __publicField(this, "bvhPrecomputeStats", {
      generation: 0,
      startedAtMs: 0,
      queued: 0,
      completed: 0,
      failed: 0,
      workerBuildTotalMs: 0,
      workerBuildMaxMs: 0
    });
    __publicField(this, "onLog");
    __publicField(this, "nowMs");
    this.onLog = options?.onLog;
    this.nowMs = options?.nowMs ?? (() => typeof performance !== "undefined" ? performance.now() : Date.now());
  }
  ensureRaycastAcceleration() {
    if (_BvhRaycastManager.raycastPatched)
      return;
    const meshPrototype = Mesh.prototype;
    const fallbackRaycast = meshPrototype.raycast;
    _BvhRaycastManager.originalMeshRaycast = fallbackRaycast;
    meshPrototype.raycast = function(raycaster, intersects) {
      const geometry = this.geometry;
      if (geometry?.boundsTree) {
        acceleratedRaycast.call(this, raycaster, intersects);
        return;
      }
      if (!_BvhRaycastManager.originalMeshRaycast)
        return;
      _BvhRaycastManager.originalMeshRaycast.call(this, raycaster, intersects);
    };
    _BvhRaycastManager.raycastPatched = true;
  }
  getOrCreateBVH(geometry) {
    let bvh = this.bvhCache.get(geometry);
    if (!bvh) {
      bvh = new MeshBVH(geometry, { maxLeafSize: 10, indirect: true });
      this.bvhCache.set(geometry, bvh);
      geometry.boundsTree = bvh;
    }
    return bvh;
  }
  clearCache() {
    this.bvhCache.clear();
  }
  resetPrecomputeQueue() {
    this.bvhPrecomputeGeneration += 1;
    this.pendingBvhTasks.clear();
    this.pendingBvhGeometries.clear();
    this.bvhPrecomputeStats = {
      generation: this.bvhPrecomputeGeneration,
      startedAtMs: 0,
      queued: 0,
      completed: 0,
      failed: 0,
      workerBuildTotalMs: 0,
      workerBuildMaxMs: 0
    };
  }
  queuePrecomputeForGroup(group) {
    if (!group)
      return;
    const worker = this.ensureBvhPrecomputeWorker();
    if (!worker)
      return;
    const generation = this.bvhPrecomputeGeneration;
    this.bvhPrecomputeStats = {
      generation,
      startedAtMs: this.nowMs(),
      queued: 0,
      completed: 0,
      failed: 0,
      workerBuildTotalMs: 0,
      workerBuildMaxMs: 0
    };
    group.traverse((child) => {
      const mesh = child;
      if (!mesh.isMesh || !mesh.geometry)
        return;
      const geometry = mesh.geometry;
      const positionAttribute = geometry.getAttribute("position");
      const indexAttribute = geometry.getIndex();
      if (!positionAttribute || !indexAttribute)
        return;
      if (positionAttribute.itemSize !== 3)
        return;
      if (geometry.boundsTree || this.bvhCache.has(geometry) || this.pendingBvhGeometries.has(geometry)) {
        return;
      }
      const positionArray = positionAttribute.array;
      const indexArray = indexAttribute.array;
      if (!(positionArray instanceof Float32Array))
        return;
      if (!(indexArray instanceof Uint16Array || indexArray instanceof Uint32Array || indexArray instanceof Int32Array)) {
        return;
      }
      const taskId = this.nextBvhPrecomputeTaskId++;
      const position = positionArray.slice();
      const index = indexArray.slice();
      this.pendingBvhTasks.set(taskId, { generation, geometry });
      this.pendingBvhGeometries.add(geometry);
      this.bvhPrecomputeStats.queued += 1;
      const message = {
        type: "build",
        taskId,
        generation,
        position,
        index
      };
      const transferList = [position.buffer, index.buffer];
      worker.postMessage(message, transferList);
    });
    if (this.bvhPrecomputeStats.queued === 0) {
      this.log("precompute skipped (no eligible geometries)", {
        generation: this.bvhPrecomputeStats.generation,
        queued: 0,
        completed: 0,
        failed: 0,
        elapsedMs: 0,
        workerBuildTotalMs: 0,
        workerBuildMaxMs: 0
      });
      return;
    }
    this.log("precompute start", {
      generation: this.bvhPrecomputeStats.generation,
      queued: this.bvhPrecomputeStats.queued,
      completed: 0,
      failed: 0
    });
  }
  dispose() {
    this.clearCache();
    this.resetPrecomputeQueue();
    if (this.bvhPrecomputeWorker) {
      this.bvhPrecomputeWorker.terminate();
      this.bvhPrecomputeWorker = null;
    }
  }
  ensureBvhPrecomputeWorker() {
    if (this.bvhPrecomputeWorker)
      return this.bvhPrecomputeWorker;
    if (typeof Worker === "undefined")
      return null;
    try {
      const worker = new WorkerWrapper();
      worker.onmessage = (event) => {
        this.handleBvhPrecomputeWorkerMessage(event.data);
      };
      worker.onerror = (event) => {
        console.warn("[BvhRaycastManager] BVH precompute worker error:", event.message);
      };
      this.bvhPrecomputeWorker = worker;
      return worker;
    } catch (error) {
      console.warn("[BvhRaycastManager] Failed to initialize BVH precompute worker:", error);
      return null;
    }
  }
  handleBvhPrecomputeWorkerMessage(message) {
    const pending = this.pendingBvhTasks.get(message.taskId);
    if (!pending)
      return;
    this.pendingBvhTasks.delete(message.taskId);
    this.pendingBvhGeometries.delete(pending.geometry);
    if (pending.generation !== this.bvhPrecomputeGeneration || message.generation !== pending.generation) {
      return;
    }
    if (message.type === "error") {
      this.bvhPrecomputeStats.failed += 1;
      console.warn("[BvhRaycastManager] BVH precompute failed:", message.message);
      this.maybeLogBvhPrecomputeDone(pending.generation);
      return;
    }
    const geometry = pending.geometry;
    if (geometry.boundsTree) {
      this.bvhPrecomputeStats.completed += 1;
      this.bvhPrecomputeStats.workerBuildTotalMs += message.buildDurationMs;
      this.bvhPrecomputeStats.workerBuildMaxMs = Math.max(
        this.bvhPrecomputeStats.workerBuildMaxMs,
        message.buildDurationMs
      );
      this.maybeLogBvhPrecomputeDone(pending.generation);
      return;
    }
    try {
      const bvh = MeshBVH.deserialize(message.serialized, geometry, { setIndex: false });
      this.bvhCache.set(geometry, bvh);
      geometry.boundsTree = bvh;
      this.bvhPrecomputeStats.completed += 1;
      this.bvhPrecomputeStats.workerBuildTotalMs += message.buildDurationMs;
      this.bvhPrecomputeStats.workerBuildMaxMs = Math.max(
        this.bvhPrecomputeStats.workerBuildMaxMs,
        message.buildDurationMs
      );
    } catch (error) {
      this.bvhPrecomputeStats.failed += 1;
      console.warn("[BvhRaycastManager] Failed to deserialize precomputed BVH:", error);
    }
    this.maybeLogBvhPrecomputeDone(pending.generation);
  }
  maybeLogBvhPrecomputeDone(generation) {
    if (generation !== this.bvhPrecomputeStats.generation)
      return;
    if (this.pendingBvhTasks.size > 0)
      return;
    if (this.bvhPrecomputeStats.queued === 0)
      return;
    const elapsedMs = this.nowMs() - this.bvhPrecomputeStats.startedAtMs;
    this.log("precompute done", {
      generation: this.bvhPrecomputeStats.generation,
      queued: this.bvhPrecomputeStats.queued,
      completed: this.bvhPrecomputeStats.completed,
      failed: this.bvhPrecomputeStats.failed,
      elapsedMs,
      workerBuildTotalMs: this.bvhPrecomputeStats.workerBuildTotalMs,
      workerBuildMaxMs: this.bvhPrecomputeStats.workerBuildMaxMs
    });
  }
  log(stage, payload) {
    this.onLog?.(stage, payload);
  }
};
let BvhRaycastManager = _BvhRaycastManager;
__publicField(BvhRaycastManager, "raycastPatched", false);
__publicField(BvhRaycastManager, "originalMeshRaycast", null);
const SELECTION_OVERLAY_FILL_OPACITY = 1;
const SELECTION_EDGE_COLOR = 16776960;
const SELECTION_EDGE_THRESHOLD_DEG = 30;
const SELECTION_EDGE_ELEMENT_LIMIT = 500;
class SelectionOverlayHelper {
  constructor(options) {
    __publicField(this, "edgeCacheRaw", /* @__PURE__ */ new Map());
    __publicField(this, "edgeColor");
    __publicField(this, "edgeThresholdDeg");
    __publicField(this, "edgeElementLimit");
    __publicField(this, "fillOpacity");
    this.fillOpacity = options?.fillOpacity ?? SELECTION_OVERLAY_FILL_OPACITY;
    this.edgeColor = options?.edgeColor ?? SELECTION_EDGE_COLOR;
    this.edgeThresholdDeg = options?.edgeThresholdDeg ?? SELECTION_EDGE_THRESHOLD_DEG;
    this.edgeElementLimit = options?.edgeElementLimit ?? SELECTION_EDGE_ELEMENT_LIMIT;
  }
  createSelectionFillMaterial(colorString, opacity = this.fillOpacity) {
    return new MeshStandardMaterial({
      color: new Color(colorString),
      roughness: 1,
      metalness: 0,
      flatShading: true,
      side: DoubleSide,
      transparent: opacity < 1,
      opacity,
      depthTest: true,
      depthWrite: false
    });
  }
  getEffectiveSelectionVisualConfig(selectedCount) {
    return {
      fillEnabled: selectedCount > 0,
      edgesEnabled: selectedCount > 0 && selectedCount < this.edgeElementLimit
    };
  }
  addSelectionEdgeLines(overlayObject) {
    const edgeMaterial = new LineBasicMaterial({
      color: this.edgeColor,
      transparent: true,
      opacity: 1,
      depthTest: false,
      depthWrite: false
    });
    const meshes = [];
    const instancedMeshes = [];
    overlayObject.traverse((child) => {
      if (child instanceof InstancedMesh && child.geometry) {
        instancedMeshes.push(child);
        return;
      }
      if (child instanceof Mesh && child.geometry) {
        meshes.push(child);
      }
    });
    for (const mesh of meshes) {
      const edges = this.getOrCreateSelectionEdgesGeometry(mesh.geometry, this.edgeThresholdDeg);
      const lineSegments = new LineSegments(edges, edgeMaterial);
      lineSegments.renderOrder = 1e3;
      mesh.add(lineSegments);
    }
    const instanceMatrix = new Matrix4();
    for (const instancedMesh of instancedMeshes) {
      const edges = this.getOrCreateSelectionEdgesGeometry(
        instancedMesh.geometry,
        this.edgeThresholdDeg
      );
      for (let instanceIndex = 0; instanceIndex < instancedMesh.count; instanceIndex++) {
        instancedMesh.getMatrixAt(instanceIndex, instanceMatrix);
        const lineSegments = new LineSegments(edges, edgeMaterial);
        lineSegments.renderOrder = 1e3;
        lineSegments.matrixAutoUpdate = false;
        lineSegments.matrix.copy(instanceMatrix);
        instancedMesh.add(lineSegments);
      }
    }
  }
  dispose() {
    for (const geometry of this.edgeCacheRaw.values()) {
      geometry.dispose();
    }
    this.edgeCacheRaw.clear();
  }
  getOrCreateSelectionEdgesGeometry(sourceGeometry, thresholdDeg) {
    const cached = this.edgeCacheRaw.get(sourceGeometry);
    if (cached)
      return cached;
    const edges = new EdgesGeometry(sourceGeometry, thresholdDeg);
    this.edgeCacheRaw.set(sourceGeometry, edges);
    return edges;
  }
}
const ARA3D = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  THREE: three_module,
  DefaultInputScheme,
  KEYS,
  Viewer,
  GizmoOptions,
  getSettings,
  GltfLoader,
  BimOpenSchemaLoader,
  loadBimGeometryFromZip,
  __setWorkerClientsForTests,
  __setZipWorkerClientForTests,
  disposeBimOpenSchemaWorkers,
  ViewStateFlag,
  buildViewStateTextures,
  ViewStateTable,
  setViewStateMaterialSelectionColor,
  createViewStateMaterial,
  BvhRaycastManager,
  SELECTION_OVERLAY_FILL_OPACITY,
  SELECTION_EDGE_COLOR,
  SELECTION_EDGE_THRESHOLD_DEG,
  SELECTION_EDGE_ELEMENT_LIMIT,
  SelectionOverlayHelper
}, Symbol.toStringTag, { value: "Module" }));
console.log(ARA3D);
//# sourceMappingURL=input.b5f25efb.js.map
