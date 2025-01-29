struct Rotate {
    movement: vec2<f32>,
    angle: f32,
    scale: f32,
}

struct Output {
    movement: vec2<f32>,
}

struct ModifierBox {
    max: vec2<f32>,
    min: vec2<f32>,
}

@group(0) @binding(0) var<storage, read_write> outputData: array<vec2<f32>>; // 出力
@group(0) @binding(1) var<uniform> modifierBox: ModifierBox;
@group(0) @binding(2) var<uniform> fineness: vec2<u32>; // キーに含まれる頂点の数
@group(1) @binding(0) var<uniform> centerPosition: vec2<f32>; // キーに含まれる頂点の数
@group(1) @binding(1) var<uniform> rotateData: Rotate; // キーに含まれる頂点の数

fn rotate2D(point: vec2<f32>, angle: f32) -> vec2<f32> {
    let cosTheta = cos(angle);
    let sinTheta = sin(angle);

    let xPrime = point.x * cosTheta - point.y * sinTheta;
    let yPrime = point.x * sinTheta + point.y * cosTheta;

    return vec2<f32>(xPrime, yPrime);
}

@compute @workgroup_size(16,16)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {

    if (global_id.x >= fineness.x + 1 || global_id.y >= fineness.y + 1) {
        return;
    }
    let pointIndex = global_id.x + global_id.y * (fineness.x + 1);

    let pos = modifierBox.min + ((vec2f(global_id.xy) / vec2f(fineness.xy)) * (modifierBox.max - modifierBox.min));
    let rotatePos = rotate2D(outputData[pointIndex] + pos - centerPosition, rotateData.angle) * rotateData.scale + centerPosition + rotateData.movement - pos;
    outputData[pointIndex] = rotatePos;
}