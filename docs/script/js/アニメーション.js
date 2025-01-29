import { device,GPU } from "./webGPU.js";
import { c_sr, c_sr_u,c_srw,animationTransformPipeline, c_srw_sr } from "./GPUObject.js";

export class AllAnimation {
    constructor(name, belongObject) {
        this.type = "all";
        this.weight = 0;
        this.s_verticesAnimationBuffer = null;
        this.u_animationWeightBuffer = GPU.createUniformBuffer(4, undefined, ['f32']);
        this.adaptAnimationGroup2 = null;
        this.animationBufferGroup = null;

        this.name = name;

        this.belongAnimationManager = null;
        this.belongObject = belongObject;
    }

    // gc対象にしてメモリ解放
    destroy() {
        this.type = "all";
        this.weight = 0;
        this.s_verticesAnimationBuffer = null;
        this.u_animationWeightBuffer = null;
        this.adaptAnimationGroup2 = null;
        this.animationBufferGroup = null;

        this.name = null;

        this.belongAnimationManager = null;
        this.belongObject = null;
    }

    emptyInit() {
        this.s_verticesAnimationBuffer = GPU.createStorageBuffer(this.belongObject.verticesNum * 2 * 4, Array(this.belongObject.verticesNum * 2).fill(0), ["f32","f32"]);
        this.adaptAnimationGroup2 = GPU.createGroup(c_sr_u, [{item: this.s_verticesAnimationBuffer, type: 'b'}, {item: this.u_animationWeightBuffer, type: 'b'}]);
        this.animationBufferGroup = GPU.createGroup(c_srw, [{item: this.s_verticesAnimationBuffer, type: 'b'}]);
    }

    async getSaveData() {
        return [...await GPU.getF32BufferData(this.s_verticesAnimationBuffer)];
    }

    setAnimationData(verticesAnimationData) {
        let trueData;
        trueData = [];
        for (const index in verticesAnimationData) {
            trueData.push(verticesAnimationData[index])
        }
        this.s_verticesAnimationBuffer = GPU.createStorageBuffer(trueData.length * 4, trueData, ["f32","f32"]);
        this.adaptAnimationGroup2 = GPU.createGroup(c_sr_u, [{item: this.s_verticesAnimationBuffer, type: 'b'}, {item: this.u_animationWeightBuffer, type: 'b'}]);
        this.animationBufferGroup = GPU.createGroup(c_srw, [{item: this.s_verticesAnimationBuffer, type: 'b'}]);
    }

    transformAnimationData(transformDataGroup) {
        const animationTransformGroup1 = GPU.createGroup(c_srw_sr, [{item: this.s_verticesAnimationBuffer, type: 'b'}, {item: this.belongObject.s_baseVerticesPositionBuffer, type: 'b'}]);
        GPU.runComputeShader(animationTransformPipeline, [animationTransformGroup1, transformDataGroup], Math.ceil(this.belongObject.verticesNum / 64));
    }
}

export class LimitAnimation {
    constructor(name, belongObject) {
        this.type = "limit";
        this.containedIndexs = [];
        this.containedVerticesNum = 0;
        this.weight = 0;
        this.s_verticesAnimationBuffer = null;
        this.u_animationWeightBuffer = GPU.createUniformBuffer(4, undefined, ['f32']);
        this.adaptAnimationGroup2 = null;
        this.animationBufferGroup = null;

        this.name = name;

        this.belongAnimationManager = "";
        this.belongObject = belongObject;
    }

    // gc対象にしてメモリ解放
    destroy() {
        this.containedIndexs = null;
        this.containedVerticesNum = null;
        this.weight = null;
        this.s_verticesAnimationBuffer = null;
        this.u_animationWeightBuffer = null;
        this.adaptAnimationGroup2 = null;
        this.animationBufferGroup = null;
        this.name = null;
        this.belongAnimationManager = null;
        this.belongObject = null;
    }

    setAnimationData(containedIndexs, verticesAnimationData) {
        this.containedVerticesNum = containedIndexs.length;
        this.containedIndexs = containedIndexs;
        this.s_verticesAnimationBuffer = GPU.createStorageBuffer(verticesAnimationData.length * 4, verticesAnimationData, ["u32","f32","f32","f32"]);
        this.adaptAnimationGroup2 = GPU.createGroup(c_sr_u, [{item: this.s_verticesAnimationBuffer, type: 'b'}, {item: this.u_animationWeightBuffer, type: 'b'}]);
        this.animationBufferGroup = GPU.createGroup(c_srw, [{item: this.s_verticesAnimationBuffer, type: 'b'}]);
    }

    transformAnimationData(transformData, isAdditionOrOverwriting) {
        // すでに頂点がアニメーションキーに存在しているか
        const notEnoughIndex = [];
        for (const item of transformData[0]) {
            if (!this.containedIndexs.includes(item)) notEnoughIndex.push(item);
        }
        // 存在しなければデータを修正する
        if (notEnoughIndex.length > 0) {
            const newData = [];
            const newLen = this.containedVerticesNum + notEnoughIndex.length;
            notEnoughIndex.forEach(x => {
                newData.push(x, 0, ...[0,0]);
            });
            const s_newVerticesAnimationBuffer = GPU.createStorageBuffer(newLen * (1 + 1 + 2) * 4, undefined, ['u32','f32','f32','f32']);

            // コマンドエンコーダを作成
            const copyCommandEncoder = device.createCommandEncoder();

            if (this.containedVerticesNum > 0) {
                copyCommandEncoder.copyBufferToBuffer(
                    this.s_verticesAnimationBuffer,  // コピー元
                    0,        // コピー元のオフセット
                    s_newVerticesAnimationBuffer,  // コピー先
                    0,        // コピー先のオフセット
                    this.containedVerticesNum * (1 + 1 + 2) * 4  // コピーするバイト数
                );
            }

            const copyCommandBuffer = copyCommandEncoder.finish();
            device.queue.submit([copyCommandBuffer]);

            device.queue.writeBuffer(s_newVerticesAnimationBuffer, this.containedVerticesNum * (1 + 1 + 2) * 4, createBitData(newData, ["u32", "f32", "f32", "f32"]));

            const adaptAnimationGroup2 = GPU.createGroup(c_sr_u, [{item: s_newVerticesAnimationBuffer, type: 'b'}, {item: this.u_animationWeightBuffer, type: 'b'}]);
            this.containedIndexs = (this.containedIndexs).concat(notEnoughIndex);
            this.containedVerticesNum = newLen;
            this.s_verticesAnimationBuffer = s_newVerticesAnimationBuffer;
            this.adaptAnimationGroup2 = adaptAnimationGroup2;
        }
        const data = [];
        for (let i = 0; i < transformData[0].length; i ++) {
            const indexAndWeight = transformData[0][i];
            const movement = transformData[2][i];
            data.push(...movement, this.containedIndexs.indexOf(indexAndWeight), isAdditionOrOverwriting);
        }
        const activeIndexBuffer = GPU.createStorageBuffer(transformData[0].length * (4) * 4, data, ["f32", "f32", "u32", "f32"]);
        const animationTransformGroup1 = GPU.createGroup(c_srw, [{item: this.s_verticesAnimationBuffer, type: 'b'}]);
        const animationTransformGroup2 = GPU.createGroup(sr_GroupLayout, [{item: activeIndexBuffer, type: 'b'}]);

        runComputeShader(device, animationTransformPipeline, [animationTransformGroup1, animationTransformGroup2], Math.ceil(transformData[0].length / 64));
    }

    deleteAnimationDataPartialOf(deleteIndexs, isVertexDeletion) {
        const newVerticesNum = this.containedVerticesNum - deleteIndexs.length;
        const s_newVerticesAnimationBuffer = GPU.createStorageBuffer(newVerticesNum * (1 + 1 + 2) * 4, undefined, ['u32','f32','f32','f32']);
        const s_deleteIndexsBuffer = GPU.createStorageBuffer(eleteIndexs.length * (1) * 4, deleteIndexs, ['u32']);
        const correspondingIndex = [];
        for (let i = 0; i < this.containedIndexs.length; i ++) {
            const index = this.containedIndexs[i];
            if (!deleteIndexs.includes(index))  {
                correspondingIndex.push(i);
            }
        }
        if (newVerticesNum > 0) {
            const s_correspondingIndexBuffer = GPU.createStorageBuffer(newVerticesNum * (1) * 4, correspondingIndex, ['u32']);
            const u_isVertexDeletionBuffer = GPU.createUniformBuffer( (1) * 4, isVertexDeletion ? [1] : [0], ['f32']);
            const deleteVerticesGroup = GPU.createGroup(deleteVerticesGroupLayout, [{item: s_newVerticesAnimationBuffer, type: "b"}, {item: this.s_verticesAnimationBuffer, type: "b"}, {item: s_correspondingIndexBuffer, type: "b"}, {item: s_deleteIndexsBuffer, type: "b"}, {item: u_isVertexDeletionBuffer, type: "b"}]);

            runComputeShader(device, deleteVerticesPipeline, [deleteVerticesGroup], Math.ceil(newVerticesNum / 64));

            this.s_verticesAnimationBuffer = s_newVerticesAnimationBuffer;
            for (let i = this.containedIndexs.length - 1; i >= 0; i --) {
                if (deleteIndexs.includes(this.containedIndexs[i])) {
                    this.containedIndexs.splice(i, 1);
                } else {
                    if (isVertexDeletion) {
                        for (const index of deleteIndexs) {
                            if (this.containedIndexs[i] >= index) {
                                this.containedIndexs[i] --;
                            }
                        }
                    }
                }
            }
            this.containedVerticesNum = newVerticesNum;
            this.adaptAnimationGroup2 = GPU.createGroup(c_sr_u, [{item: s_newVerticesAnimationBuffer, type: 'b'}, {item: this.u_animationWeightBuffer, type: 'b'}]);
        } else {
            this.containedVerticesNum = 0;
            this.s_verticesAnimationBuffer = null;
            this.adaptAnimationGroup2 = null;
        }
    }
}