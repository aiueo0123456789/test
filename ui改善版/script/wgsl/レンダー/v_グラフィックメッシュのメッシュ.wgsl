struct Camera {
    position: vec2<f32>,
    zoom: f32,
    padding: f32,
}

struct Meshu {
    i1: u32,
    i2: u32,
    i3: u32,
    padding: u32,
}

@group(0) @binding(0) var<uniform> cvsAspect: vec2<f32>;
@group(0) @binding(1) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> verticesPosition: array<vec2<f32>>;
@group(1) @binding(1) var<storage, read> mesh: array<Meshu>; // メッシュを構成する頂点インデックス
@group(2) @binding(0) var<uniform> size: f32;
@group(2) @binding(1) var<uniform> colors: vec4<f32>;

struct VertexOutput {
    @builtin(position) position: vec4<f32>, // クリッピング座標系での頂点位置
    @location(0) uv: vec2<f32>,
}

const pointData = array<vec4<f32>, 4>(
    vec4<f32>(-1.0, -1.0, 0.0, 1.0), // 左下
    vec4<f32>(-1.0,  1.0, 0.0, 0.0), // 左上
    vec4<f32>( 1.0, -1.0, 1.0, 1.0), // 右下
    vec4<f32>( 1.0,  1.0, 1.0, 0.0), // 右上
);

// バーテックスシェーダー
@vertex
fn main(
    @builtin(instance_index) instanceIndex: u32, // インスタンスのインデックス
    @builtin(vertex_index) vertexIndex: u32
    ) -> VertexOutput {
    // 頂点データを取得
    // let index = instanceIndex * 2u;
    let index = instanceIndex;
    let indexs = mesh[index];

    var position1 = vec2<f32>(0.0);
    var position2 = vec2<f32>(0.0);
    if (vertexIndex / 4u == 0u) {
        position1 = verticesPosition[indexs.i1];
        position2 = verticesPosition[indexs.i2];
    } else if (vertexIndex / 4u == 1u) {
        position1 = verticesPosition[indexs.i2];
        position2 = verticesPosition[indexs.i3];
    } else {
        position1 = verticesPosition[indexs.i3];
        position2 = verticesPosition[indexs.i1];
    }
    // let point = pointData[vertexIndex % 4u];
    let sub = position2 - position1;
    let normal = normalize(vec2<f32>(-sub.y, sub.x)); // 仮の法線
    var offset = vec2<f32>(0.0);

    if (vertexIndex % 4u == 0u) {
        offset = position1 - (normal * size) / camera.zoom;
    } else if (vertexIndex % 4u == 1u) {
        offset = position1 + (normal * size) / camera.zoom;
    } else if (vertexIndex % 4u == 2u) {
        offset = position2 - (normal * size) / camera.zoom;
    } else {
        offset = position2 + (normal * size) / camera.zoom;
    }

    var output: VertexOutput;
    output.position = vec4f((offset - camera.position) * camera.zoom * cvsAspect, 0, 1.0);
    // output.uv = point.zw;
    output.uv = offset;
    return output;
}