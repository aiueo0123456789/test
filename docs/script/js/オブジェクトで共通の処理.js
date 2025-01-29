import { GPU,device } from "./webGPU.js";
import { c_srw,c_srw_sr,adaptAllAnimationToVerticesPipeline,adaptLimitAnimationToVerticesPipeline,modifierTransformPipeline,rotateModifierTransformPipeline,lineModifierTransformPipeline, v_sr_sr_sr, c_sr, baseTransformPipeline, setModifierWeightToGraphicMeshPipeline, v_u_f_ts, sampler, renderPipeline, textureMaskPipeline, setLineModifierWeightToGraphicMeshPipeline, updateCenterPositionPipeline, c_u } from "./GPUObject.js";
import { BBox, calculateAllBBox } from "./BBox.js";

export function updateVertices(object) {
    if (!object.isInit) return ;
    if (object.type == "回転モディファイア") {
        GPU.writeBuffer(object.rotateDataBuffer, new Float32Array([...object.movement, object.scale, object.angle]));
    } else {
        object.GPUAnimationDatas.forEach(animation => {
            GPU.writeBuffer(animation.u_animationWeightBuffer, new Float32Array([animation.weight]));
        });

        // コマンドエンコーダを作成
        const computeCommandEncoder = device.createCommandEncoder();

        // レンダリング頂点の初期位置をベース頂点にセット
        computeCommandEncoder.copyBufferToBuffer(
            object.s_baseVerticesPositionBuffer,  // コピー元
            0,        // コピー元のオフセット
            object.s_renderVerticesPositionBuffer,  // コピー先
            0,        // コピー先のオフセット
            object.verticesNum * (2) * 4  // コピーするバイト数
        );

        const computePassEncoder = computeCommandEncoder.beginComputePass();
        // アニメーションの適応
        computePassEncoder.setBindGroup(0, object.adaptAnimationGroup1);
        object.GPUAnimationDatas.forEach(animation => {
            if (animation.type == "all") {
                computePassEncoder.setPipeline(adaptAllAnimationToVerticesPipeline);
                computePassEncoder.setBindGroup(1, animation.adaptAnimationGroup2);
                computePassEncoder.dispatchWorkgroups(Math.ceil(object.verticesNum / 64), 1, 1); // ワークグループ数をディスパッチ
            } else {
                if (animation.containedVerticesNum > 0) {
                    computePassEncoder.setPipeline(adaptLimitAnimationToVerticesPipeline);
                    computePassEncoder.setBindGroup(1, animation.adaptAnimationGroup2);
                    computePassEncoder.dispatchWorkgroups(Math.ceil(animation.containedVerticesNum / 64), 1, 1); // ワークグループ数をディスパッチ
                }
            }
        });
        // モディファイアの適応
        if (object.parent != "") {
            computePassEncoder.setBindGroup(0, object.modifierTransformGroup);
            computePassEncoder.setBindGroup(1, object.parent.modifierTransformDataGroup);
            if (object.parent.type == "モディファイア") {
                computePassEncoder.setPipeline(modifierTransformPipeline);
            } else if (object.parent.type == "回転モディファイア") {
                computePassEncoder.setPipeline(rotateModifierTransformPipeline);
            } else if (object.parent.type == "ベジェモディファイア") {
                computePassEncoder.setPipeline(lineModifierTransformPipeline);
            }
            computePassEncoder.dispatchWorkgroups(Math.ceil(object.verticesNum / 64), 1, 1); // ワークグループ数をディスパッチ
        }

        computePassEncoder.end();
        device.queue.submit([computeCommandEncoder.finish()]);

        // バウンディングボックス
        calculateAllBBox(object.calculateAllBBoxGroup, object.verticesNum);
        GPU.copyBufferToArray(object.BBoxBuffer,object.BBoxArray);
    }
}

export function setParentModifierWeight(object) {
    if (object.parent != "") {
        if (object.parent.type == "モディファイア") {
            object.s_verticesModifierEffectBuffer = GPU.createStorageBuffer(object.verticesNum * (4 + 4) * 4, undefined, ["f32"]);
            object.setParentModifierWeightGroup = GPU.createGroup(c_srw_sr, [{item: object.s_verticesModifierEffectBuffer, type: 'b'}, {item: object.s_baseVerticesPositionBuffer, type: 'b'}]);
            GPU.runComputeShader(setModifierWeightToGraphicMeshPipeline, [object.setParentModifierWeightGroup, object.parent.modifierDataGroup], Math.ceil(object.verticesNum / 64));
        } else if (object.parent.type == "ベジェモディファイア") {
            object.s_verticesModifierEffectBuffer = GPU.createStorageBuffer(object.verticesNum * (1 + 1) * 4, undefined, ["f32"]);
            object.setParentModifierWeightGroup = GPU.createGroup(c_srw_sr, [{item: object.s_verticesModifierEffectBuffer, type: 'b'}, {item: object.s_baseVerticesPositionBuffer, type: 'b'}]);
            GPU.runComputeShader(setLineModifierWeightToGraphicMeshPipeline, [object.setParentModifierWeightGroup, object.parent.modifierDataGroup], Math.ceil(object.verticesNum / 64));
        }
        object.modifierTransformGroup = GPU.createGroup(c_srw_sr, [{item: object.s_renderVerticesPositionBuffer, type: 'b'}, {item: object.s_verticesModifierEffectBuffer, type: 'b'}]);
    }
}

export function setChildrenBBox(object) {
    if (!object.children) {
        console.warn("子要素が存在しません","setChildrenBBox:",object);
        return 0;
    }
    const childrenBBox = [];
    for (const child of object.children) {
        childrenBBox.push(...child.baseBBoxArray);
    }
    GPU.writeBuffer(object.u_boundingBoxBuffer, new Float32Array(BBox(childrenBBox)));
}

export function setBaseBBox(object) {
    calculateAllBBox(object.calculateAllBaseBBoxGroup, object.verticesNum);
    GPU.copyBufferToArray(object.baseBBoxBuffer,object.baseBBoxArray);
}

export function baseTransform(object, transformDataGroup) {
    const baseTransformGroup1 = GPU.createGroup(c_srw, [{item: object.s_baseVerticesPositionBuffer, type: 'b'}]);
    GPU.runComputeShader(baseTransformPipeline, [baseTransformGroup1, transformDataGroup], Math.ceil(object.verticesNum / 64));

    setBaseBBox(object);
    setParentModifierWeight(object);
}

const centerPositionBuffer = GPU.createUniformBuffer(2 * 4, undefined, ["f32"]);
const updateCenterPositionGroup2 = GPU.createGroup(c_u, [{item: centerPositionBuffer, type: 'b'}]);
export function updateCenterPosition(object, centerPosition) {
    GPU.writeBuffer(centerPositionBuffer, new Float32Array(centerPosition));
    const baseTransformGroup1 = GPU.createGroup(c_srw_sr, [{item: object.s_baseVerticesPositionBuffer, type: 'b'}, {item: object.baseBBox, type: 'b'}]);
    GPU.runComputeShader(updateCenterPositionPipeline, [baseTransformGroup1, updateCenterPositionGroup2], Math.ceil(object.verticesNum / 64));
    setBaseBBox(object);
}

export function searchAnimation(object, animationName) {
    for (const animation of object.GPUAnimationDatas) {
        if (animation.name == animationName) return animation;
    }
}