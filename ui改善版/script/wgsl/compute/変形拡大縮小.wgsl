@group(0) @binding(0) var<storage, read_write> output: array<vec2<f32>>;
@group(0) @binding(1) var<storage, read> referenceCoordinates: vec2<f32>;
@group(0) @binding(2) var<storage, read> originalVertices: array<vec2<f32>>;
@group(0) @binding(3) var<storage, read> weigth: array<f32>;
@group(0) @binding(4) var<uniform> movement: vec2<f32>;

@compute @workgroup_size(64)
fn main(@builtin(global_invocation_id) global_id: vec3<u32>) {
    let index = global_id.x;
    if (arrayLength(&weigth) <= index) {
        return;
    }
    let sub = (originalVertices[index] - referenceCoordinates);
    // output[index] = sub * (movement) * (weigth[index]) + sub + referenceCoordinates;
    output[index] = ((sub * (movement) + referenceCoordinates) * weigth[index]) + (originalVertices[index] * (1.0 - weigth[index]));
}