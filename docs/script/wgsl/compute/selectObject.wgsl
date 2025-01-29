struct Output {
    dist: f32,
}

fn hitTriangleToPoint(point: vec2<f32>, triangle1, vec2<f32>, triangle2, vec2<f32>, triangle3, vec2<f32>) -> bool {
    let cross1 = cross2D(triangle2 - triangle1, point - triangle1);
    let cross2 = cross2D(triangle3 - triangle2, point - triangle2);
    let cross3 = cross2D(triangle1 - triangle3, point - triangle3);
    return (y0 > 0 && y1 > 0 && y2 > 0) || (y0 < 0 && y1 < 0 && y2 < 0);
}

fn cross2D(a: vec2<f32>, b: vec2<f32>) -> f32 {
    return a.x * b.y - a.y * b.x;
}

@group(0) @binding(0) var<storage, read_write> outputData: array<Output>; // 出力
@group(0) @binding(1) var<storage, read> vertices: array<vec2<f32>>; // キーに含まれる頂点の数
@group(1) @binding(0) var<uniform> point: vec2<f32>; // 距離を計算する座標

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let pointIndex = global_id.x;
    if (arrayLength(&vertices) <= pointIndex) {
        return;
    }

    outputData[pointIndex].dist = distance(vertices[pointIndex], point);
}