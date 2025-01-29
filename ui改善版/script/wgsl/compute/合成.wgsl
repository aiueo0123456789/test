@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>;
@group(1) @binding(0) var storageTextureArray: texture_storage_3d<rgba8unorm, write>;

@compute
fn main(@builtin(global_invocation_id) id: vec3<u32>) {
    let textureSize = textureDimensions(glowTexture);

    for (var z = 0u; z < textureSize.z; z ++) {
        let texCoord = vec3<u32>(id.xy, z);
        textureStore(storageTextureArray, texCoord, vec4<f32>(1.0, 0.0, 0.0, 1.0));
    }
}