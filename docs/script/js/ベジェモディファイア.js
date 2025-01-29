import { device,GPU } from "./webGPU.js";
import { Children } from "./子要素.js";
import { AllAnimation } from "./アニメーション.js";
import { v_sr,c_sr_sr,c_sr,c_srw,c_srw_sr } from "./GPUObject.js";
import { setBaseBBox, setParentModifierWeight } from "./オブジェクトで共通の処理.js";

export class LineModifier {
    constructor(name) {
        this.name = name;
        this.isInit = false;

        this.CPUBaseVerticesPositionData = [];
        this.s_baseVerticesPositionBuffer = null;
        this.s_renderVerticesPositionBuffer = null;
        this.s_controlPointBuffer = null;
        this.type = "ベジェモディファイア";
        this.renderBBoxData = {max: [1,1], min: [-1,-1]};
        this.GPUAnimationDatas = [];
        this.modifierDataGroup = null;
        this.modifierTransformDataGroup = null;
        this.adaptAnimationGroup1 = null;
        this.s_verticesModifierEffectBuffer = null;

        this.calculateAllBBoxGroup = null;
        this.GUIrenderGroup = null;

        this.BBoxArray = [0,0,0,0];
        this.BBoxBuffer = GPU.createStorageBuffer(4 * 4, undefined, ["f32"]);
        this.BBoxRenderGroup = GPU.createGroup(v_sr, [{item: this.BBoxBuffer, type: 'b'}]);

        this.baseBBoxArray = [0,0,0,0];
        this.baseBBoxBuffer = GPU.createStorageBuffer(4 * 4, undefined, ["f32"]);

        this.roop = true;
        this.verticesNum = 0;
        this.pointNum = 0;
        this.baseTransformIsLock = false;

        this.children = new Children();

        this.init({baseVertices: [-100,0, -150,0, -50,50, 100,0, 50,-50, 150,0]});
    }

    // gc対象にしてメモリ解放
    destroy() {
        this.GPUAnimationDatas.forEach(animtion => {
            animtion.destroy();
        });
        this.GPUAnimationDatas.length = 0;
        this.name = null;
        this.CPUBaseVerticesPositionData = null;
        this.s_baseVerticesPositionBuffer = null;
        this.s_renderVerticesPositionBuffer = null;
        this.s_controlPointBuffer = null;
        this.type = null;
        this.renderBBoxData = null;
        this.GPUAnimationDatas = null;
        this.modifierTransformDataGroup = null;
        this.adaptAnimationGroup1 = null;
        this.s_verticesModifierEffectBuffer = null;

        this.calculateAllBBoxGroup = null;
        this.GUIrenderGroup = null;

        this.BBoxArray = null;
        this.BBoxBuffer = null;
        this.BBoxRenderGroup = null;

        this.roop = null;
        this.verticesNum = null;
        this.pointNum = null;
        this.baseTransformIsLock = null;

        this.children = null;
    }

    init(data) {
        console.log(data)
        this.verticesNum = data.baseVertices.length / 2;
        this.pointNum = this.verticesNum / 3;

        this.GPUAnimationDatas = [];
        for (const keyName in data.animationKeyDatas) {
            const animationData = data.animationKeyDatas[keyName];
            const animation = new AllAnimation(keyName, this);
            animation.setAnimationData(animationData.transformData);
            this.GPUAnimationDatas.push(animation);
        }

        this.s_verticesModifierEffectBuffer = GPU.createStorageBuffer(4, undefined, ['f32']);

        this.s_baseVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, data.baseVertices, ["f32","f32","f32","f32","f32","f32"]);
        this.s_renderVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, undefined, ["f32","f32","f32","f32","f32","f32"]);

        this.isInit = true;

        this.setGroup();
        setBaseBBox(this);
    }

    addBaseVertices(add) {
        const newBuffer = GPU.createStorageBuffer((this.verticesNum + add.length) * (2) * 4, undefined, ["f32","f32","f32","f32","f32","f32"]);
        GPU.copyBuffer(this.s_baseVerticesPositionBuffer, newBuffer);
        GPU.writeBuffer(newBuffer, new Float32Array(add.flat(1)), this.verticesNum * (2) * 4);
        this.verticesNum = this.verticesNum + add.length;
        this.pointNum = this.verticesNum / 3;
        this.s_baseVerticesPositionBuffer = newBuffer;
        this.s_renderVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, undefined, ["f32","f32","f32","f32","f32","f32"]);
        this.setGroup();

        this.children.weightReset();
        setParentModifierWeight(this);
    }

    deleteLineVertices(sub) {
        console.log("削除")
        const deleteIndex = sub.sort(function(first, second){
            return second - first;
        });

        for (const index of deleteIndex) {
            if (index % 3 == 0) {
                this.CPUBaseVerticesPositionData.splice(index, 3);
            }
        }
        this.verticesNum = this.CPUBaseVerticesPositionData.length / 3;
        this.s_baseVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, this.CPUBaseVerticesPositionData.flat(), ["f32","f32","f32","f32","f32","f32"]);
        this.s_renderVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, undefined, ["f32","f32","f32","f32","f32","f32"]);
        this.setGroup();

        this.children.weightReset();
        setParentModifierWeight(this);
    }

    setGroup() {
        this.modifierDataGroup = GPU.createGroup(c_sr, [{item: this.s_baseVerticesPositionBuffer, type: "b"}]);
        this.modifierTransformDataGroup = GPU.createGroup(c_sr_sr, [{item: this.s_baseVerticesPositionBuffer, type: "b"}, {item: this.s_renderVerticesPositionBuffer, type: "b"}]);
        this.adaptAnimationGroup1 = GPU.createGroup(c_srw, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
        this.collisionVerticesGroup = GPU.createGroup(c_sr, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);

        this.modifierTransformGroup = GPU.createGroup(c_srw_sr, [{item: this.s_renderVerticesPositionBuffer, type: "b"}, {item: this.s_verticesModifierEffectBuffer, type: "b"}]);

        this.setParentModifierWeightGroup = GPU.createGroup(c_srw_sr, [{item: this.s_verticesModifierEffectBuffer, type: 'b'}, {item: this.s_baseVerticesPositionBuffer, type: 'b'}]);
        this.calculateAllBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.BBoxBuffer, type: 'b'}, {item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
        this.calculateAllBaseBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.baseBBoxBuffer, type: 'b'}, {item: this.s_baseVerticesPositionBuffer, type: 'b'}]);
        this.GUIrenderGroup = GPU.createGroup(v_sr, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
    }

    async getSaveData() {
        const animationKeyDatas = {};
        await Promise.all(
            this.GPUAnimationDatas.map(async (animation) => {
                animationKeyDatas[animation.name] = {
                    transformData: await animation.getSaveData(),
                };
            })
        );
        return {
            name: this.name,
            type: this.type,
            baseVertices: [...await GPU.getF32BufferData(this.s_baseVerticesPositionBuffer)],
            animationKeyDatas: animationKeyDatas,
        };
    }
}