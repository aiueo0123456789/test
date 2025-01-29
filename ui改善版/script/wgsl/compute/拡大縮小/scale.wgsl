struct Output {
    index: u32,
    padding: f32,
    movement: vec2<f32>,
}

struct ActiveIndex {
    padding: f32, // パディングで4バイトを確保
    k: f32,
    index: u32,
    index2: u32,
};

struct Transform {
    scale: vec2<f32>,
    dsit: f32,
    useType: u32,
}

@group(0) @binding(0) var<storage, read_write> outputData: array<Output>; // 出力
@group(0) @binding(1) var<storage, read> renderVerticesData: array<vec2<f32>>; // 距離計算用
@group(1) @binding(0) var<storage, read> activeIndexs: array<ActiveIndex>; // 頂点インデックスのデータ
@group(1) @binding(1) var<uniform> centerPosition: vec2<f32>; // 中心座標
@group(1) @binding(2) var<uniform> transformData: Transform; // 変形に必要なデータ

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let threadIndex = global_id.x;
    if (arrayLength(&activeIndexs) <= threadIndex) {
        return;
    }

    let pointIndex = activeIndexs[threadIndex].index2;

    let sub = renderVerticesData[activeIndexs[threadIndex].index] - centerPosition;

    outputData[pointIndex].movement += sub * transformData.scale * activeIndexs[threadIndex].k;
}