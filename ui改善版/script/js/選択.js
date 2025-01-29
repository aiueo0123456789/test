import { GPU } from "./webGPU.js";
import { c_srw_u,circleSelectVerticesPipeline,boxSelectVerticesPipeline } from "./GPUObject.js";
import { convertCoordinate } from "./main.js";
import { vec2 } from "./ベクトル計算.js";

export async function circleSelectVertices(object, point, radius) {
    radius = convertCoordinate.GPUSizeFromCPU(radius);
    const resultBuffer = GPU.createStorageBuffer(object.verticesNum * (1) * 4, undefined, ["f32"]);
    const pointBuffer = GPU.createUniformBuffer(2 * 4, point, ["f32","f32"]);
    const collisionVerticesGroup = GPU.createGroup(c_srw_u, [{item: resultBuffer, type: "b"},{item: pointBuffer, type: "b"}]);

    GPU.runComputeShader(circleSelectVerticesPipeline, [collisionVerticesGroup, object.collisionVerticesGroup], Math.ceil(object.verticesNum / 64));

    const collisionResult = await GPU.getF32BufferData(resultBuffer, resultBuffer.size);

    const result = [];
    for (let i = 0; i < collisionResult.length; i ++) {
        const dist = collisionResult[i];
        if (dist < radius) {
            result.push(i);
        }
    }

    return result;
}

export async function boxSelectVertices(object, boundingBox) {
    const resultBuffer = GPU.createStorageBuffer(object.verticesNum * (1) * 4, undefined, ["f32"]);
    const pointBuffer = GPU.createUniformBuffer(4 * 4, boundingBox.max.concat(boundingBox.min), ["f32","f32"]);
    const collisionBoxGroup = GPU.createGroup(c_srw_u, [{item: resultBuffer, type: "b"},{item: pointBuffer, type: "b"}]);

    GPU.runComputeShader(boxSelectVerticesPipeline, [collisionBoxGroup, object.collisionVerticesGroup], Math.ceil(object.verticesNum / 64));

    const collisionResult = await GPU.getF32BufferData(resultBuffer, resultBuffer.size);

    const result = [];
    for (let i = 0; i < collisionResult.length; i ++) {
        const dist = collisionResult[i];
        if (dist > 50) {
            result.push(i);
        }
    }

    return result;
}

export async function BBoxSelect(object, point, radius) {
    radius = convertCoordinate.GPUSizeFromCPU(radius);
    if (!object.BBoxBuffer) return ;
    const data = await GPU.getF32BufferData(object.BBoxBuffer);
    if (!data) return false;
    const min = [data[0], data[1]];
    const max = [data[2], data[3]];

    const collisionBBox = () => {
        return vec2.distanceR(max, point) < radius ||
               vec2.distanceR(min, point) < radius ||
               vec2.distanceR([max[0], min[1]], point) < radius ||
               vec2.distanceR([min[0], max[1]], point) < radius;
    }

    return collisionBBox();
}