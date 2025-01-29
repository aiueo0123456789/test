@group(0) @binding(0) var<storage, read_write> output: array<f32>;
@group(0) @binding(1) var<storage, read> verticesIndexs: array<u32>;
@group(1) @binding(0) var<uniform> smoothType: f32;
@group(1) @binding(1) var<uniform> radius: f32;
@group(1) @binding(2) var<storage, read> referenceCoordinates: vec2<f32>;
@group(2) @binding(0) var<storage, read> vertices: array<vec2<f32>>;

fn arrayIncludes(value: u32) -> bool {
    for (var i = 0u; i < arrayLength(&verticesIndexs); i = i + 1u) {
        if (verticesIndexs[i] == value) {
            return true;
        }
    }
    return false;
}

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (arrayLength(&vertices) <= index) {
        return;
    }
    if (smoothType == 0.0) { // 通常
        if (arrayIncludes(index)) {
            output[index] = 1.0;
        } else {
            output[index] = 0.0;
        }
    } else if (smoothType == 1.0) { // 1次関数
        if (arrayIncludes(index)) {
            output[index] = 1.0;
        } else {
            let dist = distance(vertices[index], referenceCoordinates);
            if (dist < radius) {
                output[index] = 1.0 - dist / radius;
            } else {
                output[index] = 0.0;
            }
        }
    } else if (smoothType == 2.0) { // 2次関数
        if (arrayIncludes(index)) {
            output[index] = 1.0;
        } else {
            let dist = distance(vertices[index], referenceCoordinates);
            if (dist < radius) {
                output[index] = pow((1.0 - dist / radius), 2.0);
            } else {
                output[index] = 0.0;
            }
        }
    }
}