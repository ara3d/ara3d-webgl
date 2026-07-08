export interface BimGeometry {
    //= =======================================
    // Instances table
    //= =======================================

    // Index of the entity associated with each instance. Used for looking up meta data.
    InstanceEntityIndex: Int32Array;

    // Indedx of the material associated with each instance.
    InstanceMaterialIndex: Int32Array;

    // Index of the mesh associated with each instance
    InstanceMeshIndex: Int32Array;

    // Index of the transform associated with each instance
    InstanceTransformIndex: Int32Array;

    // Index of the transform associated with each instance
    InstanceFlags: Uint8Array;

    //= =======================================
    // VertexBuffer table
    //= =======================================

    // X values (multiplied by 10,000) in each mesh's local space
    VertexX: Int32Array;

    // Y values (multiplied by 10,000) in each mesh's local space
    VertexY: Int32Array;

    // Z values (multiplied by 10,000) in each mesh's local space
    VertexZ: Int32Array;

    //= =======================================
    // IndexBuffer table
    //= =======================================

    // Each index is local to the corresponding mesh.
    IndexBuffer: Int32Array;

    //= =======================================
    // Mesh table
    //= =======================================

    // This offset is added to index to get the actual vertex in the global vertex
    MeshVertexOffset: Int32Array;

    // The starting index within the index buffer of the current mesh.
    // The number of indices used is defined by subtracting it from the next mesh's starting index
    MeshIndexOffset: Int32Array;

    //= =======================================
    // Material table (bytes 0–255)
    //= =======================================

    MaterialRed: Uint8Array;
    MaterialGreen: Uint8Array;
    MaterialBlue: Uint8Array;
    MaterialAlpha: Uint8Array;
    MaterialRoughness: Uint8Array;
    MaterialMetallic: Uint8Array;

    //= =======================================
    // Transform table
    //= =======================================

    TransformTX: Float32Array;
    TransformTY: Float32Array;
    TransformTZ: Float32Array;
    TransformQX: Float32Array;
    TransformQY: Float32Array;
    TransformQZ: Float32Array;
    TransformQW: Float32Array;
    TransformSX: Float32Array;
    TransformSY: Float32Array;
    TransformSZ: Float32Array;
}
