@group(0) @binding(0) var outputTexture: texture_storage_2d<rgba8unorm, write>; // 出力テクスチャ
@group(0) @binding(1) var inputTexture: texture_2d<f32>;
// @group(1) @binding(0) var maskTexture: texture_2d<f32>;

@compute @workgroup_size(16, 16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let point = global_id.xy;

    let textureSize = textureDimensions(inputTexture);

    if (textureSize.x <= point.x || textureSize.y <= point.y) {
        return ;
    }

    // テクスチャに結果を書き込む
    // if (textureLoad(maskTexture, point, 0).a >= 0.0) {
    //     textureStore(outputTexture, point, textureLoad(inputTexture, point, 0));
    // } else {
    //     textureStore(outputTexture, point, vec4<f32>(0.0));
    // }
    textureStore(outputTexture, point, textureLoad(inputTexture, point, 0));
    // textureStore(outputTexture, point, vec4<f32>(1.0,1.0,0.0,1.0));
}