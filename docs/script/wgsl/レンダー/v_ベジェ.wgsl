struct Camera {
    position: vec2<f32>,
    zoom: f32,
    padding: f32,
}

struct Bezier {
    p: vec2<f32>,
    c1: vec2<f32>,
    c2: vec2<f32>,
}

@group(0) @binding(0) var<uniform> cvsAspect: vec2<f32>;
@group(0) @binding(1) var<uniform> camera: Camera;
@group(1) @binding(0) var<storage, read> verticesPosition: array<Bezier>;
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

fn mathBezier(p1: vec2<f32>, c1: vec2<f32>, c2: vec2<f32>, p2: vec2<f32>, t: f32) -> vec2<f32> {
    let u = 1.0 - t;
    return p1 * pow(u, 3.0) + c1 * 3.0 * pow(u, 2.0) * t + c2 * 3.0 * u * pow(t, 2.0) + p2 * pow(t, 3.0);
}

// バーテックスシェーダー
@vertex
fn main(
    @builtin(instance_index) instanceIndex: u32, // インスタンスのインデックス
    @builtin(vertex_index) vertexIndex: u32
    ) -> VertexOutput {
    // 頂点データを取得
    let index = instanceIndex;
    let point1 = verticesPosition[index];
    let point2 = verticesPosition[index + 1u];
    let deltaT = 1.0 / 50.0;
    let t = f32(vertexIndex / 2u) / 50.0;
    let position1 = mathBezier(point1.p, point1.c2, point2.c1, point2.p, t);
    let position2 = mathBezier(point1.p, point1.c2, point2.c1, point2.p, t + deltaT);
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