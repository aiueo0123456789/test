import { device,GPU } from "./webGPU.js";
import { Children } from "./子要素.js";
import { AllAnimation } from "./アニメーション.js";
import { vec2 } from "./ベクトル計算.js";
import { v_sr,c_sr,c_u_u,c_srw,c_srw_sr,c_srw_u_u,c_srw_sr_u_u,v_sr_u, c_sr_sr } from "./GPUObject.js";

export class Modifier {
    constructor(name) {
        this.name = name;
        this.isInit = false;
        this.type = "モディファイア";

        this.verticesNum = null;
        this.meshNum = null;
        this.fineness = null;
        this.u_finenessBuffer = null;
        this.s_renderVerticesPositionBuffer = null;
        this.s_verticesModifierEffectBuffer = null;
        this.modifierDataGroup = null;
        this.setParentModifierWeightGroup = null;
        this.modifierTransformDataGroup = null;

        this.modifierTransformGroup = null;
        this.rotateModifierTransformGroup = null;

        this.collisionVerticesGroup = null;

        this.updateModifierRenderVerticesGroup = null;
        this.adaptAnimationGroup1 = null;

        this.GUIMeshRenderGroup = null;
        this.GUIVerticesRenderGroup = null;

        this.BBoxArray = [0,0,0,0];
        this.BBoxBuffer = GPU.createStorageBuffer(4 * 4, undefined, ["f32"]);
        this.BBoxRenderGroup = GPU.createGroup(v_sr, [{item: this.BBoxBuffer, type: 'b'}]);

        this.GPUAnimationDatas = [];
        this.renderBBoxData = {max: [], min: []};

        this.boundingBox = {max: [], min: []};
        this.u_boundingBoxBuffer = null;

        this.parent = "";

        this.children = new Children();

        this.init({fineness: [1,1], boundingBox: {min: [-100,-100], max: [100,100]}, animationKeyDatas: []}); // 初期化
    }

    // gc対象にしてメモリ解放
    destroy() {
        this.GPUAnimationDatas.forEach(animtion => {
            animtion.destroy();
        });
        this.name = null;
        this.type = null;
        this.verticesNum = null;
        this.fineness = null;
        this.u_finenessBuffer = null;
        this.s_renderVerticesPositionBuffer = null;
        this.s_verticesModifierEffectBuffer = null;
        this.modifierDataGroup = null;
        this.setParentModifierWeightGroup = null;
        this.modifierTransformDataGroup = null;

        this.modifierTransformGroup = null;
        this.rotateModifierTransformGroup = null;

        this.collisionVerticesGroup = null;

        this.updateModifierRenderVerticesGroup = null;
        this.adaptAnimationGroup1 = null;

        this.GPUAnimationDatas = null;
        this.renderBBoxData = null;

        this.boundingBox = null;
        this.u_boundingBoxBuffer = null;

        this.parent = "";

        this.children = null;
    }

    init(data) {
        this.fineness = data.fineness;
        this.verticesNum = (this.fineness[0] + 1) * (this.fineness[1] + 1);
        this.meshNum = this.fineness[0] * this.fineness[1];

        this.boundingBox = data.boundingBox;
        this.u_boundingBoxBuffer = GPU.createUniformBuffer( 2 * (2) * 4, undefined, ["f32"]);
        device.queue.writeBuffer(this.u_boundingBoxBuffer, 0, new Float32Array([...this.boundingBox.max, ...this.boundingBox.min]));
        this.u_finenessBuffer = GPU.createUniformBuffer( 2 * 4, this.fineness, ["u32"]);
        this.GPUAnimationDatas = [];
        for (const keyName in data.animationKeyDatas) {
            const animationData = data.animationKeyDatas[keyName];
            const animation = new AllAnimation(keyName, this);
            animation.setAnimationData(animationData.transformData);
            this.GPUAnimationDatas.push(animation);
        }

        this.s_baseVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, this.createVertices(data.fineness, data.boundingBox).flat(), ["f32"]);
        this.s_renderVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, undefined, ["f32"]);

        this.s_verticesModifierEffectBuffer = GPU.createStorageBuffer(this.verticesNum * (4 + 4) * 4, undefined, ["f32"]);
        this.isInit = true;

        this.setBindGroup();
    }

    updateFineness(newFineness) {
        this.init({fineness: newFineness, boundingBox: this.boundingBox, animationKeyDatas: []});
    }

    createVertices(fineness, boundingBox) {
        const result = [];
        for (let y = 0; y < fineness[1] + 1; y ++) {
            for (let x = 0; x < fineness[0] + 1; x ++) {
                const pos = vec2.addR(vec2.mulR(vec2.divR([x,y], fineness),vec2.subR(boundingBox.max,boundingBox.min)), boundingBox.min);
                result.push(pos);
            }
        }
        return result;
    }

    setBindGroup() {
        this.collisionVerticesGroup = GPU.createGroup(c_sr, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
        this.updateModifierRenderVerticesGroup = GPU.createGroup(c_srw_sr_u_u, [{item: this.s_renderVerticesPositionBuffer, type: "b"}, {item: this.s_renderVerticesPositionBuffer, type: 'b'}, {item: this.u_boundingBoxBuffer, type: "b"}, {item: this.u_finenessBuffer, type: "b"}]);

        this.adaptAnimationGroup1 = GPU.createGroup(c_srw, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);

        this.setParentModifierWeightGroup = GPU.createGroup(c_srw_sr, [{item: this.s_verticesModifierEffectBuffer, type: 'b'}, {item: this.s_baseVerticesPositionBuffer, type: 'b'}]);
        this.modifierDataGroup = GPU.createGroup(c_u_u, [{item: this.u_boundingBoxBuffer, type: 'b'}, {item: this.u_finenessBuffer, type: 'b'}]);

        this.modifierTransformDataGroup = GPU.createGroup(c_sr_sr, [{item: this.s_baseVerticesPositionBuffer, type: 'b'}, {item: this.s_renderVerticesPositionBuffer, type: 'b'}]);

        this.modifierTransformGroup = GPU.createGroup(c_srw_sr, [{item: this.s_renderVerticesPositionBuffer, type: "b"}, {item: this.s_verticesModifierEffectBuffer, type: "b"}]);
        this.rotateModifierTransformGroup = GPU.createGroup(c_srw_u_u, [{item: this.s_renderVerticesPositionBuffer, type: "b"}, {item: this.u_boundingBoxBuffer, type: "b"}, {item: this.u_finenessBuffer, type: "b"}]);

        this.calculateAllBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.BBoxBuffer, type: 'b'}, {item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
        this.GUIVerticesRenderGroup = GPU.createGroup(v_sr, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
        this.GUIMeshRenderGroup = GPU.createGroup(v_sr_u, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}, {item: this.u_finenessBuffer, type: 'b'}]);
    }

    async getSaveData() {
        const animationKeyDatas = {};
        await Promise.all(
            this.GPUAnimationDatas.map(async (animation) => {
                animationKeyDatas[animation.name]  = {
                    transformData: await animation.getSaveData(),
                };
            })
        );
        return {
            name: this.name,
            type: this.type,
            boundingBox: this.boundingBox,
            fineness: this.fineness,
            animationKeyDatas: animationKeyDatas,
        };
    }
}