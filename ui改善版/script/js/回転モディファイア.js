import { device,GPU } from "./webGPU.js";
import { v_u,c_u } from "./GPUObject.js";
import { Children } from "./子要素.js";

export class RotateModifier {
    constructor(name) {
        this.name = name;
        this.isInit = false;

        this.type = "回転モディファイア";
        this.angle = 0;
        this.scale = 1;
        this.centerPosition = [0,0];
        this.movement = [0,0];
        this.renderData = [0,0,0]; // [x,y,angle]
        this.renderBBoxData = {max: [1,1], min: [-1,-1]};
        this.GPUAnimationDatas = [];
        this.rotateDataBuffer = GPU.createUniformBuffer((2 + 1 + 1) * 4, undefined, ["f32"]);
        this.modifierTransformDataGroup = GPU.createGroup(c_u, [{item: this.rotateDataBuffer, type: "b"}]);

        this.BBoxRenderGroup = GPU.createGroup(v_u, [{item: this.rotateDataBuffer, type: "b"}]);

        this.children = new Children();

        this.parent = "";
    }

    // gc対象にしてメモリ解放
    destroy() {
        Object.keys(this.GPUAnimationDatas).forEach(keyName => { // アニメーションデータとの循環参照をクリア
            this.GPUAnimationDatas[keyName].destroy();
            delete this.GPUAnimationDatas[keyName];
        });
        hierarchy.deleteHierarchy(this);
        this.name = null;
        this.type = null;
        this.angle = null;
        this.scale = null;
        this.centerPosition = null;
        this.movement = null;
        this.renderData = null; // [x,y,angle]
        this.renderBBoxData = null;
        this.GPUAnimationDatas = null;
        this.rotateDataBuffer = null;
        this.modifierTransformDataGroup = null;

        this.children = null;

        this.parent = "";
    }

    init() {
        GPU.writeBuffer(this.rotateDataBuffer, new Float32Array([0,0, 50, 0]));
        this.isInit = true;
    }

    setAngleFromPoint(point) {
        this.angle = getAngle2D(vecAdd(this.centerPosition, this.movement), point);
    }

    setScaleFromPoint(point) {
        this.scale = vecLength(vecSub(vecAdd(this.centerPosition, this.movement), point)) / 10;
    }

    rotatePosition() {
        return [Math.cos(this.angle), Math.sin(this.angle)];
    }

    addAnimationData(keyName) {
        // this.GPUAnimationDatas[keyName] = {weight: 0, data: []};
    }

    updateRotateModifierPosition(add) {
        this.movement = vecAdd(this.movement, add);
    }

    updateModifierAnimation() {
        // GPU.writeBuffer(this.rotateDataBuffer, new Float32Array([...this.movement, this.scale, this.angle]));
    }

    async getSaveData() {
        const animationKeyDatas = {};
        return {
            name: this.name,
            type: this.type,
            centerPosition: this.centerPosition,
            animationKeyDatas: animationKeyDatas,
        };
    }
}