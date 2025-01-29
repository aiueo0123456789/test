import { GPU } from "./webGPU.js";
import { calculateAllBBoxPipeline,calculateLimitBBoxPipeline,c_srw } from "./GPUObject.js";

const aaaBuffer = GPU.createStorageBuffer((2 + 2) * 4, undefined, ["f32"]);
const aaaGroup = GPU.createGroup(c_srw, [{item: aaaBuffer, type: "b"}]);
export function calculateAllBBox(group, verticesNum) {
    GPU.runComputeShader(calculateAllBBoxPipeline, [group, aaaGroup], Math.ceil(verticesNum / 20 / 64));
}

export function calculateLimitBBox(group0, group1, indexsNum) { // 選択されている頂点のBBox計算用
    GPU.runComputeShader(calculateLimitBBoxPipeline, [group0, group1, aaaGroup], Math.ceil(indexsNum / 20 / 64));
}

export function BBox(points) {
    if (!points.length) return {max: [NaN, NaN], min: [NaN, NaN]};
    let maxX = points[0][0];
    let maxY = points[0][1];
    let minX = points[0][0];
    let minY = points[0][1];
    for (let i = 1; i < points.length; i ++) {
        maxX = Math.max(points[i][0], maxX);
        maxY = Math.max(points[i][1], maxY);
        minX = Math.min(points[i][0], minX);
        minY = Math.min(points[i][1], minY);
    }
    return {max: [maxX,maxY], min: [minX,minY]};
}