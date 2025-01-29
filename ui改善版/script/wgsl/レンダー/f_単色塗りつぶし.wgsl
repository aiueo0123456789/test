// @group(2) @binding(1) var<uniform> color: vec3<f32>; // 距離を計算する座標

struct FragmentOutput {
    @location(0) color: vec4<f32>,   // カラーバッファ (通常は0番目の出力)
};

@fragment
fn main(
    @location(0) uv: vec2<f32>,
) -> FragmentOutput {
    var output: FragmentOutput;
    output.color = vec4f(0,0,0,1);
    return output;
}