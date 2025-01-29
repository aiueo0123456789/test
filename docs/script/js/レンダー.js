import { GPU, device, format } from './webGPU.js';
import { graphicMeshsMeshRenderPipeline, modifierMeshRenderPipeline, renderPipeline,circlesFromAllVerticesRenderPipeline,circlesFromPartVerticesRenderPipeline,lineRenderPipeline,bezierRenderPipeline,BBoxRenderPipeline,cvsDrawPipeline,sampler, v_u_u_f_ts, activeColorGroup, inactiveColorGroup, activeBBoxColorGroup, inactiveBBoxColorGroup, textureRenderPipeline, rotateModifierTextureGroup, inactiveRotateModifierColorGroup, activeRotateModifierColorGroup, maskRenderPipeline, referenceCoordinatesColorGroup } from "./GPUObject.js";
import { hierarchy } from './ヒエラルキー.js';
import { stateMachine } from './main.js';
import { updateDataForUI } from './グリッド/制御.js';

function hexToRgba(hex, alpha = 1) {
    // #を取り除く
    hex = hex.replace(/^#/, '');
    // R, G, Bを取り出して整数に変換
    const r = parseInt(hex.slice(0, 2), 16) / 255;
    const g = parseInt(hex.slice(2, 4), 16) / 255;
    const b = parseInt(hex.slice(4, 6), 16) / 255;
    // RGBA形式で返す0
    return { r, g, b, a: alpha };
}

const maskTextureSize = [2048,2048];

export class Render {
    constructor(cvs, camera) {
        this.cvs = cvs;
        this.ctx = cvs.getContext('webgpu');
        this.ctx.configure({
            device: device,
            format: format
        });

        this.backgroundColor = { r: 1, g: 1, b: 1, a: 1 };

        this.cvsAspectBuffer = GPU.createUniformBuffer(2 * 4, undefined, ["f32"]);
        this.resizeCVS();
        this.camera = camera;
        this.staticGroup = GPU.createGroup(v_u_u_f_ts, [{item: this.cvsAspectBuffer, type: 'b'}, {item: camera.cameraDataBuffer, type: 'b'}, {item: sampler, type: 'ts'}]);

        this.maskTextures = [
            {name: "base", textureView: GPU.createTexture2D([1,1],"r8unorm").createView(), renderingObjects: []},
            {name: "test1", textureView: GPU.createTexture2D(maskTextureSize,"r8unorm").createView(), renderingObjects: []},
        ];

        if (true) { // 白のマスクテクスチャ
            const commandEncoder = device.createCommandEncoder();
            const value = this.maskTextures[0];
            const maskRenderPass = commandEncoder.beginRenderPass({
                colorAttachments: [
                    {
                        view: value.textureView,
                        clearValue: { r: 1, g: 0, b: 0, a: 0 },
                        loadOp: 'clear',
                        storeOp: 'store',
                    },
                ],
            });
            // 処理の終了と送信
            maskRenderPass.end();
            device.queue.submit([commandEncoder.finish()]);
        }
    }

    destroy() {
        this.maskTextures.length = 0;
    }

    addMaskTexture(name) {
        updateDataForUI["プロパティ"] = true;
        this.maskTextures.push({name: name, textureView: GPU.createTexture2D(maskTextureSize,"r8unorm").createView(), renderingObjects: []});
    }

    searchMaskTextureFromName(name) {
        for (const texture of this.maskTextures) {
            if (texture.name == name) return texture;
        }
        console.warn("マスクテクスチャが見つかりませんでした");
        return null;
    }

    resizeCVS() {
        GPU.writeBuffer(this.cvsAspectBuffer, new Float32Array([1 / this.cvs.width, 1 /  this.cvs.height]));
    }

    renderObjects() {
        const commandEncoder = device.createCommandEncoder();
        for (const textureKey in this.maskTextures) {
            const value = this.maskTextures[textureKey];
            if (value.renderingObjects.length > 0) {
                const maskRenderPass = commandEncoder.beginRenderPass({
                    colorAttachments: [
                        {
                            view: value.textureView,
                            clearValue: { r: 0, g: 0, b: 0, a: 0 },
                            loadOp: 'clear',
                            storeOp: 'store',
                        },
                    ],
                });
                // オブジェクト表示
                maskRenderPass.setPipeline(maskRenderPipeline);
                maskRenderPass.setBindGroup(0, this.staticGroup);
                for (const graphicMesh of value.renderingObjects) {
                    maskRenderPass.setBindGroup(1, graphicMesh.maskRenderGroup);
                    maskRenderPass.setVertexBuffer(0, graphicMesh.v_meshIndexBuffer);
                    maskRenderPass.draw(graphicMesh.meshNum * 3, 1, 0, 0);
                }
                // 処理の終了と送信
                maskRenderPass.end();
            }
        }
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.ctx.getCurrentTexture().createView(),
                    clearValue: this.backgroundColor,
                    loadOp: 'clear',
                    storeOp: 'store',
                },
            ],
        });
        // オブジェクト表示
        renderPass.setPipeline(renderPipeline);
        renderPass.setBindGroup(0, this.staticGroup);
        for (const graphicMesh of hierarchy.renderingOrder) {
            if (graphicMesh.isInit && graphicMesh.isHide) {
                renderPass.setBindGroup(1, graphicMesh.renderGroup);
                renderPass.setVertexBuffer(0, graphicMesh.v_meshIndexBuffer);
                renderPass.draw(graphicMesh.meshNum * 3, 1, 0, 0);
            }
        }
        // 処理の終了と送信
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
    }

    renderGUI() {
        const commandEncoder = device.createCommandEncoder();
        const renderPass = commandEncoder.beginRenderPass({
            colorAttachments: [
                {
                    view: this.ctx.getCurrentTexture().createView(),
                    loadOp: 'load',
                    storeOp: 'store',
                },
            ],
        });
        // オブジェクト表示
        renderPass.setBindGroup(0, this.staticGroup);
        if (stateMachine.searchStringInNowState("グラフィックメッシュ編集")) {
            const graphicMeshs = stateMachine.state.data.object;
            renderPass.setBindGroup(1, graphicMeshs.GUIMeshRenderGroup);
            renderPass.setBindGroup(2, activeBBoxColorGroup);
            renderPass.setPipeline(graphicMeshsMeshRenderPipeline);
            renderPass.draw(3 * 4, graphicMeshs.meshNum, 0, 0); // (3 * 4) 3つの辺を4つの頂点を持つ四角形で表示する
            renderPass.setBindGroup(1, graphicMeshs.GUIVerticesRenderGroup);
            renderPass.setBindGroup(2, inactiveColorGroup);
            renderPass.setPipeline(circlesFromAllVerticesRenderPipeline);
            renderPass.draw(4, graphicMeshs.verticesNum, 0, 0);
            if (stateMachine.state.data.selectVerticesIndexs.length) {
                renderPass.setPipeline(circlesFromPartVerticesRenderPipeline);
                renderPass.setBindGroup(2, stateMachine.state.data.selectVerticesIndexsGroup);
                renderPass.setBindGroup(3, activeColorGroup);
                renderPass.draw(4, stateMachine.state.data.selectVerticesIndexs.length, 0, 0);
            }
        } else if (stateMachine.searchStringInNowState("モディファイア編集")) {
            const modifier = stateMachine.state.data.object;
            renderPass.setBindGroup(1, modifier.GUIMeshRenderGroup);
            renderPass.setBindGroup(2, activeBBoxColorGroup);
            renderPass.setPipeline(modifierMeshRenderPipeline);
            renderPass.draw(4 * 4, modifier.meshNum, 0, 0); // (4 * 4) 4つの辺を4つの頂点を持つ四角形で表示する
            renderPass.setBindGroup(1, modifier.GUIVerticesRenderGroup);
            renderPass.setBindGroup(2, inactiveColorGroup);
            renderPass.setPipeline(circlesFromAllVerticesRenderPipeline);
            renderPass.draw(4, modifier.verticesNum, 0, 0);
            if (stateMachine.state.data.selectVerticesIndexs.length) {
                renderPass.setPipeline(circlesFromPartVerticesRenderPipeline);
                renderPass.setBindGroup(2, stateMachine.state.data.selectVerticesIndexsGroup);
                renderPass.setBindGroup(3, activeColorGroup);
                renderPass.draw(4, stateMachine.state.data.selectVerticesIndexs.length, 0, 0);
            }
        } else if (stateMachine.searchStringInNowState("ベジェモディファイア編集")) {
            const modifier = stateMachine.state.data.object;
            renderPass.setBindGroup(1, modifier.GUIrenderGroup);
            renderPass.setBindGroup(2, inactiveColorGroup);
            renderPass.setPipeline(bezierRenderPipeline);
            renderPass.draw(2 * 50, modifier.pointNum - 1, 0, 0);
            renderPass.setPipeline(circlesFromAllVerticesRenderPipeline);
            renderPass.draw(4, modifier.verticesNum, 0, 0);
            if (stateMachine.state.data.selectVerticesIndexs.length) {
                renderPass.setPipeline(circlesFromPartVerticesRenderPipeline);
                renderPass.setBindGroup(2, stateMachine.state.data.selectVerticesIndexsGroup);
                renderPass.setBindGroup(3, activeColorGroup);
                renderPass.draw(4, stateMachine.state.data.selectVerticesIndexs.length, 0, 0);
            }
        } else if (stateMachine.searchStringInNowState("回転モディファイア編集")) {

        } else if (stateMachine.searchStringInNowState("オブジェクト選択")) {
            if (!stateMachine.state.data.IsHideForGUI) {
                renderPass.setPipeline(BBoxRenderPipeline);
                renderPass.setBindGroup(2, inactiveBBoxColorGroup);
                for (const graphicMesh of hierarchy.graphicMeshs) {
                    if (graphicMesh.isInit && graphicMesh.isHide) {
                        renderPass.setBindGroup(1, graphicMesh.BBoxRenderGroup);
                        renderPass.draw(4, 1, 0, 0);
                    }
                }
                for (const modifier of hierarchy.modifiers) {
                    renderPass.setBindGroup(1, modifier.BBoxRenderGroup);
                    renderPass.draw(4, 1, 0, 0);
                }
                for (const modifier of hierarchy.lineModifiers) {
                    renderPass.setBindGroup(1, modifier.BBoxRenderGroup);
                    renderPass.draw(4, 1, 0, 0);
                }
                renderPass.setPipeline(textureRenderPipeline);
                renderPass.setBindGroup(2, rotateModifierTextureGroup);
                renderPass.setBindGroup(3, inactiveRotateModifierColorGroup);
                for (const modifier of hierarchy.rotateModifiers) {
                    renderPass.setBindGroup(1, modifier.BBoxRenderGroup);
                    renderPass.draw(4, 1, 0, 0);
                }
                if (stateMachine.state.data.object) {
                    if (stateMachine.state.data.object.type == "回転モディファイア") {
                        renderPass.setPipeline(textureRenderPipeline);
                        renderPass.setBindGroup(2, rotateModifierTextureGroup);
                        renderPass.setBindGroup(3, activeRotateModifierColorGroup);
                        renderPass.setBindGroup(1, stateMachine.state.data.object.BBoxRenderGroup);
                        renderPass.draw(4, 1, 0, 0);
                    } else {
                        renderPass.setPipeline(BBoxRenderPipeline);
                        renderPass.setBindGroup(1, stateMachine.state.data.object.BBoxRenderGroup);
                        renderPass.setBindGroup(2, activeBBoxColorGroup);
                        renderPass.draw(4, 1, 0, 0);
                    }
                }
            }
        }
        if (stateMachine.state.data.selectVerticesBBoxRenderGroup) {
            renderPass.setPipeline(BBoxRenderPipeline);
            renderPass.setBindGroup(1, stateMachine.state.data.selectVerticesBBoxRenderGroup);
            renderPass.setBindGroup(2, activeColorGroup);
            renderPass.draw(4, 1, 0, 0);
            renderPass.setPipeline(circlesFromAllVerticesRenderPipeline);
            renderPass.setBindGroup(1, stateMachine.state.data.referenceCoordinatesRenderGroup);
            renderPass.setBindGroup(2, referenceCoordinatesColorGroup);
            renderPass.draw(4, 1, 0, 0);
        }
        renderPass.setPipeline(circlesFromAllVerticesRenderPipeline);
        renderPass.setBindGroup(1, stateMachine.mouseRenderGroup);
        renderPass.setBindGroup(2, stateMachine.mouseRenderConfigGroup);
        renderPass.draw(4, 1, 0, 0);
        renderPass.setBindGroup(2, stateMachine.smoothRadiusRenderConfig);
        renderPass.draw(4, 1, 0, 0);
        // 処理の終了と送信
        renderPass.end();
        device.queue.submit([commandEncoder.finish()]);
    }
}