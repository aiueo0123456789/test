import { device,GPU } from "./webGPU.js";
import { AllAnimation } from "./アニメーション.js";
import { v_sr_sr,c_srw,c_srw_sr,c_srw_sr_sr,v_sr_sr_f_t,v_sr, c_sr, f_str, c_stw_t, v_sr_sr_f_t_t_u } from "./GPUObject.js";
import { render } from "./main.js";

export class GraphicMesh {
    constructor(name) {
        this.name = name;
        this.type = "グラフィックメッシュ";
        this.isInit = false;
        this.baseTransformIsLock = false;
        this.isHide = true;
        this.zIndex = 0;

        // バッファの宣言
        this.s_baseVerticesPositionBuffer = null;
        this.s_baseVerticesUVBuffer = null;
        this.s_renderVerticesPositionBuffer = null;
        this.v_meshIndexBuffer = null;
        this.s_meshIndexBuffer = null;
        this.s_verticesModifierEffectBuffer = null;
        this.texture = null;
        this.textureView = null;

        // グループの宣言
        this.adaptAnimationGroup1 = null;
        this.renderGroup = null;
        this.setParentModifierWeightGroup = null;
        this.modifierTransformGroup = null;
        this.rotateModifierTransformGroup = null;
        this.collisionVerticesGroup = null;
        this.collisionMeshGroup1 = null;
        this.collisionMeshResultBuffer = null;

        // その他
        this.GPUAnimationDatas = [];

        this.CPUMeshIndexData = null;

        this.BBoxArray = [0,0,0,0];
        this.BBoxBuffer = GPU.createStorageBuffer(4 * 4, undefined, ["f32"]);
        this.BBoxRenderGroup = GPU.createGroup(v_sr, [{item: this.BBoxBuffer, type: 'b'}]);

        this.baseBBoxArray = [0,0,0,0];
        this.baseBBoxBuffer = GPU.createStorageBuffer(4 * 4, undefined, ["f32"]);

        this.verticesNum = null;
        this.meshNum = null;

        this.parent = "";
        this.accessLock = false; // 生成中にデータの読み取り書き換えなどをしないように

        this.maskRenderingTargetTexture = null;
        this.maskTargetTexture = render.searchMaskTextureFromName("base");
        this.maskTypeBuffer = GPU.createUniformBuffer(4, undefined, ["f32"]);
        GPU.writeBuffer(this.maskTypeBuffer, new Float32Array([0])); // 0　マスク 反転マスク

        if (this.maskRenderingTargetTexture) {
            this.maskRenderingTargetTexture.renderingObjects.push(this);
        }
    }

    // gc対象にしてメモリ解放
    destroy() {
        this.GPUAnimationDatas.forEach(animtion => {
            animtion.destroy();
        });
        if (this.maskRenderingTargetTexture) {
            this.maskRenderingTargetTexture.renderingObjects.splice(this.maskRenderingTargetTexture.renderingObjects.indexOf(this), 1);
        }
        this.name = null;
        this.type = null;
        this.baseTransformIsLock = null;
        this.isHide = null;
        this.zIndex = null;
        // ブッファの宣言
        this.s_baseVerticesPositionBuffer = null;
        this.s_baseVerticesUVBuffer = null;
        this.s_renderVerticesPositionBuffer = null;
        this.v_meshIndexBuffer = null;
        this.s_meshIndexBuffer = null;
        this.s_verticesModifierEffectBuffer = null;
        this.texture = null;
        this.textureView = null;

        // グループの宣言
        this.adaptAnimationGroup1 = null;
        this.renderGroup = null;
        this.setParentModifierWeightGroup = null;
        this.modifierTransformGroup = null;
        this.rotateModifierTransformGroup = null;
        this.collisionVerticesGroup = null;
        this.collisionMeshGroup1 = null;
        this.collisionMeshResultBuffer = null;

        // その他
        this.GPUAnimationDatas = null;

        this.CPUMeshIndexData = null;

        this.verticesNum = null;
        this.meshNum = null;

        this.parent = "";
        this.accessLock = null;
    }

    async init(data) {
        this.accessLock = false;
        this.texture = GPU.createTexture2D([data.texture.width, data.texture.height, 1],"rgba8unorm");
        // this.texture = GPU.createTexture2D([data.texture.width, data.texture.height, 1]);
        await GPU.cpyBase64ToTexture(this.texture, data.texture.data);

        this.CPUMeshIndexData = data.meshIndex;

        this.zIndex = data.zIndex;
        this.verticesNum = data.baseVerticesPosition.length / 2;
        this.meshNum = this.CPUMeshIndexData.length;
        this.s_baseVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, data.baseVerticesPosition, ['f32','f32']);
        this.s_baseVerticesUVBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, data.baseVerticesUV, ['f32','f32']);
        this.s_renderVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, undefined, ['f32']);
        this.s_verticesModifierEffectBuffer = GPU.createStorageBuffer(4, undefined, ['f32']);

        this.v_meshIndexBuffer = GPU.createVertexBuffer(this.meshNum * 3 * 4, this.CPUMeshIndexData.flat(), ['u32']);
        this.s_meshIndexBuffer = GPU.createStorageBuffer(this.meshNum * 4 * 4, this.CPUMeshIndexData.map((x) => {
            return [...x, 0];
        }).flat(), ['u32']);

        this.GPUAnimationDatas = [];
        for (const keyName in data.animationKeyDatas) {
            const animationData = data.animationKeyDatas[keyName];
            const animation = new AllAnimation(keyName, this);
            animation.setAnimationData(animationData.transformData);
            this.GPUAnimationDatas.push(animation);
        }

        this.textureView = this.texture.createView(); // これを先に処理しようとするとエラーが出る

        if (data.maskRenderingTargetTexture) {
            this.maskRenderingTargetTexture = render.searchMaskTextureFromName(data.maskRenderingTargetTexture);
            this.maskRenderingTargetTexture.renderingObjects.push(this);
        }
        this.maskTargetTexture = render.searchMaskTextureFromName(data.maskTargetTexture);

        this.isInit = true;
        this.setGroup();

        // data.texture = null; // base64のデータが邪魔だから消す

        this.accessLock = true;
    }

    setMeshData(vertices, uv, mesh) {
        this.CPUMeshIndexData = mesh;

        this.verticesNum = vertices.length;
        this.meshNum = this.CPUMeshIndexData.length;
        this.s_baseVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, vertices.flat(), ['f32','f32']);
        this.s_baseVerticesUVBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, uv.flat(), ['f32','f32']);
        this.s_renderVerticesPositionBuffer = GPU.createStorageBuffer(this.verticesNum * (2) * 4, undefined, ['f32']);
        this.s_verticesModifierEffectBuffer = GPU.createStorageBuffer(4, undefined, ['f32']);

        this.v_meshIndexBuffer = GPU.createVertexBuffer( this.meshNum * 3 * 4, this.CPUMeshIndexData.flat(), ['u32']);
        this.s_meshIndexBuffer = GPU.createStorageBuffer(this.meshNum * 4 * 4, this.CPUMeshIndexData.map((x) => {
            return [...x, 0];
        }).flat(), ['u32']);

        if (!this.isInit && this.texture) {
            this.GPUAnimationDatas = [];
            this.isInit = true;
        }

        this.setGroup();
    }

    changeMaskTargetTexture(target) {
        this.maskTargetTexture = target;
        this.renderGroup = GPU.createGroup(v_sr_sr_f_t_t_u, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}, {item: this.s_baseVerticesUVBuffer, type: 'b'}, {item: this.textureView, type: 't'}, {item: this.maskTargetTexture.textureView, type: 't'}, {item: this.maskTypeBuffer, type: "b"}]);
    }

    changeMaskmaskRenderingTargetTexture(target) {
        this.maskRenderingTargetTexture = target;
        if (this.maskRenderingTargetTexture) {
            this.maskRenderingTargetTexture.renderingObjects.push(this);
        }
    }

    setVerticesGroup() {

    }

    setGroup() {
        if (!this.isInit) return ;
        this.adaptAnimationGroup1 = GPU.createGroup(c_srw, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);

        this.rotateModifierTransformGroup = GPU.createGroup(c_srw, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);

        this.modifierTransformGroup = GPU.createGroup(c_srw_sr, [{item: this.s_renderVerticesPositionBuffer, type: "b"}, {item: this.s_verticesModifierEffectBuffer, type: "b"}]);

        this.collisionVerticesGroup = GPU.createGroup(c_sr, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
        this.collisionMeshResultBuffer = GPU.createStorageBuffer(this.meshNum * (1) * 4, undefined, ["f32"]);
        this.collisionMeshGroup1 = GPU.createGroup(c_srw_sr_sr, [{item: this.collisionMeshResultBuffer, type: "b"}, {item: this.s_renderVerticesPositionBuffer, type: 'b'}, {item: this.s_meshIndexBuffer, type: 'b'}]);

        this.renderGroup = GPU.createGroup(v_sr_sr_f_t_t_u, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}, {item: this.s_baseVerticesUVBuffer, type: 'b'}, {item: this.textureView, type: 't'}, {item: this.maskTargetTexture.textureView, type: 't'}, {item: this.maskTypeBuffer, type: "b"}]);
        this.maskRenderGroup = GPU.createGroup(v_sr_sr_f_t, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}, {item: this.s_baseVerticesUVBuffer, type: 'b'}, {item: this.textureView, type: 't'}]);
        this.calculateAllBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.BBoxBuffer, type: 'b'}, {item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
        this.calculateAllBaseBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.baseBBoxBuffer, type: 'b'}, {item: this.s_baseVerticesPositionBuffer, type: 'b'}]);
        this.GUIMeshRenderGroup = GPU.createGroup(v_sr_sr, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}, {item: this.s_meshIndexBuffer, type: 'b'}]);
        this.GUIVerticesRenderGroup = GPU.createGroup(v_sr, [{item: this.s_renderVerticesPositionBuffer, type: 'b'}]);
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
        let modifierEffectData = null;
        if (this.parent) {
            if (this.parent.type == "モディファイア") {
                modifierEffectData = await GPU.getBufferDataAsStruct(this.s_verticesModifierEffectBuffer, this.verticesNum * (4 + 4) * 4, ["u32","u32","u32","u32","f32","f32","f32","f32"]);
            } else {
               modifierEffectData = await GPU.getBufferDataAsStruct(this.s_verticesModifierEffectBuffer, this.verticesNum * (1 + 1) * 4, ["u32","f32"]);
            }
        }

        const textureData = await GPU.textureToBase64(this.texture);
        return {
            name: this.name,
            type: this.type,
            baseTransformIsLock: this.baseTransformIsLock,
            zIndex: this.zIndex,
            baseVerticesPosition: [...await GPU.getF32BufferData(this.s_baseVerticesPositionBuffer)],
            baseVerticesUV: [...await GPU.getF32BufferData(this.s_baseVerticesUVBuffer)],
            meshIndex: this.CPUMeshIndexData,
            animationKeyDatas: animationKeyDatas,
            modifierEffectData: modifierEffectData,
            texture: textureData,
            maskRenderingTargetTexture: this.maskRenderingTargetTexture ? this.maskRenderingTargetTexture.name : null,
            maskTargetTexture: this.maskTargetTexture.name,
        };
    }
}