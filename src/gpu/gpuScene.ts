/** Number of 32-bit words in one `DrawIndexedIndirect` command. */
export const DRAW_COMMAND_WORDS = 5

/** Number of floats per instance record: a 4x4 matrix followed by an RGBA color. */
export const INSTANCE_FLOATS = 20

/** A contiguous run of draw commands rendered with one pipeline. */
export type DrawRange = {
    first: number;
    count: number;
}

/**
 * A whole BIM model flattened into the buffers a WebGPU indirect draw needs.
 * All arrays are plain typed arrays, ready to be uploaded without further work.
 */
export type GpuScene = {
    /** Raw BOS vertex columns (integers scaled by `vertexScale`). */
    vertexX: Int32Array;
    vertexY: Int32Array;
    vertexZ: Int32Array;

    /** Multiply a vertex column value by this to get model units. */
    vertexScale: number;

    /** Mesh-local indices; each draw command supplies its own base vertex. */
    indices: Uint32Array;

    /** `INSTANCE_FLOATS` per instance: column-major matrix then RGBA. */
    instanceData: Float32Array;

    /** World space bounding sphere per instance: center xyz then radius. */
    instanceSpheres: Float32Array;

    /** Index into the BOS Instances table for each instance, for picking. */
    instanceIds: Uint32Array;

    /** `DRAW_COMMAND_WORDS` per draw: indexCount, instanceCount, firstIndex, baseVertex, firstInstance. */
    drawCommands: Uint32Array;

    opaque: DrawRange;
    transparent: DrawRange;

    triangleCount: number;
    boundsMin: [number, number, number];
    boundsMax: [number, number, number];
}

export const drawCount = (s: GpuScene) => s.drawCommands.length / DRAW_COMMAND_WORDS
export const instanceCount = (s: GpuScene) => s.instanceIds.length
