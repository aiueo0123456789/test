import { mouseState,convertCoordinate,keysDown } from "./main.js";
import { BBoxSelect, boxSelectVertices, circleSelectVertices } from "./選択.js";
import { device, GPU } from "./webGPU.js";
import { BBox } from "./BBox.js";
import { c_u_u_sr, c_srw_sr,createTransformInitialDataPipeline,createMovementTransformDataPipeline,createRotateTransformDataPipeline, v_sr,c_srw_sr_sr_sr_u, c_srw_sr_sr, createScalingTransformDataPipeline, v_u_u, animationTransformPipeline } from "./GPUObject.js";
import { calculateLimitBBox } from "./BBox.js";
import { calculateAllAverage } from "./平均.js";
import { vec2 } from "./ベクトル計算.js";
import { baseTransform } from "./オブジェクトで共通の処理.js";
import { hierarchy } from "./ヒエラルキー.js";
import { updateDataForUI } from "./グリッド/制御.js";
import { AllAnimation } from "./アニメーション.js";

class Manager {
    constructor() {
        this.activeAnimation = null;
        this.activeObject = null;
        this.selectVerticesIndexs = [];
        this.selectMeshIndexs = [];
        this.mode = "selectObject";
        this.mode2 = "edit";
        this.toolType = "select";
        this.toolTypeState = "頂点選択";
        this.beforeToolType = this.toolType;
        this.circleRadius = 100;
        this.smoothRadius = 100;
        this.smoothType = "通常";
        this.transformCentralType = "選択物のバウンディングボックス";
        this.selectVerticesBBox = {max: [null, null], min: [null, null]};

        this.selectVerticesBBoxBuffer = GPU.createStorageBuffer(2 * 2 * 4, undefined, ["f32"]);
        this.selectVerticesIndexBuffer = null;
        this.selectVerticesBBoxRenderGroup = GPU.createGroup(v_sr, [{item: this.selectVerticesBBoxBuffer, type: 'b'}]);
        this.selectVerticesBBoxGroup = null;
        this.referenceCoordinatesBuffer = GPU.createStorageBuffer(2 * 4, undefined, ["f32"]);
        this.calculateSelectVerticesBBoxCenterGroup = GPU.createGroup(c_srw_sr, [{item: this.referenceCoordinatesBuffer, type: 'b'}, {item: this.selectVerticesBBoxBuffer, type: 'b'}]);
        this.referenceCoordinatesRenderGroup = GPU.createGroup(v_sr, [{item: this.referenceCoordinatesBuffer, type: 'b'}]);

        this.mouseBuffer = GPU.createStorageBuffer(2 * 4, undefined, ["f32"]);
        this.mouseRenderGroup = GPU.createGroup(v_sr, [{item: this.mouseBuffer, type: 'b'}]);
        this.selectRadiusBuffer = GPU.createUniformBuffer(4, undefined, ["f32"]);
        this.mouseColorBuffer = GPU.createUniformBuffer(4 * 4, undefined, ["f32"]);
        this.mouseRenderConfigGroup = GPU.createGroup(v_u_u, [{item: this.selectRadiusBuffer, type: 'b'}, {item: this.mouseColorBuffer, type: 'b'}]);

        this.backgroundColor = { r: 1, g: 1, b: 1, a: 1 };

        this.startMousePosition = [0,0];

        this.movementBuffer = GPU.createUniformBuffer(2 * 4, undefined, ["f32"]);

        this.undoList = [];
        this.undoDepth = 0;

        this.relatedOfKeyAndMode = {"graphicMeshsEdit": {key: {"g": "move", "s": "scale", "r": "rotate"}, tool: {"move": "g", "scale": "s", "rotate": "r"}},
                                    "modifierEdit": {key: {"g": "move", "s": "scale", "r": "rotate"}, tool: {"move": "g", "scale": "s", "rotate": "r"}},
                                    "lineModifierEdit": {key: {"g": "move", "s": "scale", "r": "rotate", "e": "add"}, tool: {"move": "g", "scale": "s", "rotate": "r", "add": "e"}},
                                    "rotateModifierEdit": {key: {"g": "move", "s": "scale", "r": "rotate"}, tool: {"move": "g", "scale": "s", "rotate": "r"}},
                                    "selectObject": {key: {"g": "move", "s": "scale", "r": "rotate"}, tool: {"move": "g", "scale": "s", "rotate": "r"}}};
    }

    async select() {
        const a = async () => {
            const GPUPos = convertCoordinate.screenPosFromGPUPos(mouseState.position);
            if (this.toolType == "select") {
                mouseState.click = false;
                if (this.mode == "graphicMeshsEdit") {
                    if (this.mode2 == "vertices") {
                        if (keysDown["Shift"]) {
                            this.addToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                        } else if (keysDown["a"]) {
                            this.setAllSelectVerticesIndexs(this.activeObject.verticesNum);
                        } else {
                            this.setToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                        }
                    } else {
                        const selectData = await this.activeObject.selectMesh(GPUPos);
                        if (keysDown["Shift"]) {
                            this.addToSelectMeshIndexs(selectData[0]);
                            this.addToSelectVerticesIndexs(selectData[1]);
                        } else {
                            this.setToSelectMeshIndexs(selectData[0]);
                            this.setToSelectVerticesIndexs(selectData[1]);
                        }
                    }
                } else if (this.mode == "modifierEdit") {
                    if (keysDown["Shift"]) {
                        this.addToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                    } else if (keysDown["a"]) {
                        this.setAllSelectVerticesIndexs(this.activeObject.verticesNum);
                    } else {
                        this.setToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                    }
                } else if (this.mode == "lineModifierEdit") {
                    if (keysDown["Shift"]) {
                        this.addToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                    } else if (keysDown["a"]) {
                        this.setAllSelectVerticesIndexs(this.activeObject.verticesNum);
                    } else if (keysDown["l"]) {
                        this.setToSelectVerticesIndexs(await this.activeObject.circleGroupSelectLineModifier(GPUPos, this.circleRadius));
                    } else {
                        this.setToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                    }
                } else if (this.mode == "rotateModifierEdit") {
                    if (keysDown["Shift"]) {
                        this.addToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                    } else if (keysDown["a"]) {
                        this.setAllSelectVerticesIndexs(this.activeObject.verticesNum);
                    } else if (keysDown["l"]) {
                        this.setToSelectVerticesIndexs(await this.activeObject.circleGroupSelectLineModifier(GPUPos, this.circleRadius));
                    } else {
                        this.setToSelectVerticesIndexs(await circleSelectVertices(this.activeObject, GPUPos, this.circleRadius));
                    }
                }
            }
        }
        if (mouseState.click) {
            if (this.mode == "selectObject" && this.mode2 == "edit") {
                mouseState.click = false;
                const GPUPos = convertCoordinate.screenPosFromGPUPos(mouseState.position);
                const selectObject = async () => {
                    for (const modifier of hierarchy.modifiers) {
                        if (await BBoxSelect(modifier, GPUPos,this.circleRadius + 5)) {
                            this.setToActiveObject(modifier);
                            return ;
                        }
                    }
                    for (const graphicMesh of hierarchy.graphicMeshs) {
                        if (await BBoxSelect(graphicMesh, GPUPos,this.circleRadius + 5)) {
                            this.setToActiveObject(graphicMesh);
                            return ;
                        }
                    }
                    this.setToActiveObject(null);
                    return;
                }

                selectObject();
            } else {
                if (this.toolTypeState == "頂点選択") {
                    await a();
                } else if (this.toolTypeState == "確定") {
                    if (mouseState.click) {
                        toolFormSubmit();
                    }
                    await a();
                }
            }
        }
        if (mouseState.hold && keysDown["b"]) {
            const box = BBox([
                convertCoordinate.screenPosFromGPUPos(mouseState.position),
                convertCoordinate.screenPosFromGPUPos(mouseState.clickPosition)
            ]);
            if (this.mode == "selectObject") {
            } else {
                console.log("ああああ")
                this.setToSelectVerticesIndexs(await boxSelectVertices(this.activeObject, box));
            }
        }
    }

    async tool() {
        await this.select();
        const xyKeyDown = () => {
            if (keysDown["x"]) {
                return "x";
            } else if (keysDown["y"]) {
                return "y";
            } else {
                return "xy";
            }
        }
        const keys = this.relatedOfKeyAndMode[this.mode];

        const fn1 = () => {
            for (const keyName in keys.key) {
                if (keysDown[keyName] && keys.key[keyName] != this.toolType) {
                    keysDown[keyName] = false;
                    this.toolType = keys.key[keyName];
                    this.toolTypeState = "頂点選択";
                }
            }
        }

        fn1();
        const toolIsChange = this.toolType != this.beforeToolType;
        if (this.mode == "selectObject") {
        } else if (this.mode == "rotateModifierEdit") {
        } else {
            if (this.toolType != "select") {
                if (this.toolTypeState == "頂点選択" && keysDown[keys.tool[this.toolType]]) {
                    this.objectTrasform(true, false, this.toolType, xyKeyDown());
                    this.toolTypeState = "移動";
                }
                if (this.toolTypeState == "移動") {
                    const b = this.objectTrasform(false, false, this.toolType, xyKeyDown());
                    if (!b) {
                        this.toolTypeState = "頂点選択";
                    }
                }
                if (mouseState.click) {
                    mouseState.click = false;
                    if (this.toolTypeState == "移動") {
                        toolFormDisplay(this.toolType);
                        this.toolTypeState = "確定";
                    } else if (this.toolTypeState == "確定") {
                        toolFormDisplay(this.toolType);
                        this.toolType = "select";
                        this.toolTypeState = "頂点選択";
                    }
                }
            }
        }
        this.beforeToolType = this.toolType;
    }

    setActiveAnimation(animation) {
        this.activeAnimation = animation;
        updateDataForUI["アニメーション"] = true;
    }

    clearToSelectMeshIndexs() {
        this.selectMeshIndexs = [];
    }

    setToSelectMeshIndexs(indexs) {
        this.selectMeshIndexs = indexs;
    }

    addToSelectMeshIndexs(indexs) {
        for (const index of indexs) {
            if (!this.selectMeshIndexs.includes(index)) {
                this.selectMeshIndexs.push(index);
            }
        }
    }

    updateSelectVerticesBBoxData() {
        if (this.selectVerticesIndexs.length > 0 && this.activeObject) {
            this.selectVerticesIndexBuffer = GPU.createStorageBuffer(this.selectVerticesIndexs.length * 4, this.selectVerticesIndexs, ["u32"]);
            this.selectVerticesBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.selectVerticesBBoxBuffer, type: "b"}, {item: this.selectVerticesIndexBuffer, type: "b"}]);
            this.selectVerticesIndexsGroup = GPU.createGroup(v_sr, [{item: this.selectVerticesIndexBuffer, type: "b"}]);
        }
    }

    // グラフィックメッシュの頂点編集
    addToSelectVerticesIndexs(indexs) {
        for (const index of indexs) {
            if (!this.selectVerticesIndexs.includes(index)) {
                this.selectVerticesIndexs.push(index);
            }
        }
        this.updateSelectVerticesBBoxData();
    }

    setAllSelectVerticesIndexs(verticesNum) {
        this.clearToSelectVerticesIndexs();
        this.updateSelectVerticesBBoxData();
    }

    clearToSelectVerticesIndexs() { // 頂点選択解除
        this.selectVerticesIndexs = [];
        this.updateSelectVerticesBBoxData();
    }

    setToSelectVerticesIndexs(indexs) { // 頂点選択セット
        this.clearToSelectVerticesIndexs();
        this.selectVerticesIndexs = indexs;
        this.updateSelectVerticesBBoxData();
    }

    setToActiveObject(object) {
        this.activeObject = object;
        updateDataForUI["ヒエラルキー"] = true;
        updateDataForUI["アニメーション"] = true;
        updateDataForUI["インスペクタ"] = true;
    }

    setSelectVerticesBBox() { // 選択されている頂点たちのBBoxを計算
        if (this.selectVerticesIndexs.length > 0 && this.activeObject) {
            calculateLimitBBox(this.selectVerticesBBoxGroup, this.activeObject.collisionVerticesGroup, this.selectVerticesIndexs.length);
            this.selectVerticesBBox = {max: [null, null], min: [null, null]};
            // calculateAllAverage(this.calculateSelectVerticesBBoxCenterGroup, 2);
        } else {
            GPU.writeBuffer(this.selectVerticesBBoxBuffer, new Float32Array([0,0,0,0]))
            this.selectVerticesBBox = {max: [null, null], min: [null, null]};
        }
    }

    // モディファイア
    objectTrasform(isInit, isDecision, type, option = "xy", values = null) {
        if (values) {
            GPU.writeBuffer(this.movementBuffer, new Float32Array(values));
        } else {
            if (this.referenceCoordinates) {
                if (type == "move") {
                    this.movement = vec2.subR(mouseState.positionForGPU, this.referenceCoordinates);
                } else if (type == "scale") {
                    this.movement = vec2.divR(vec2.subR(mouseState.positionForGPU, this.referenceCoordinates), vec2.reverseScaleR(vec2.subR([this.referenceBBox[2],this.referenceBBox[3]], [this.referenceBBox[0],this.referenceBBox[1]]), 2));
                } else if (type == "rotate") {
                    this.movement = [vec2.angleAFromB(this.referenceCoordinates, mouseState.positionForGPU)];
                }
                GPU.writeBuffer(this.movementBuffer, new Float32Array(this.movement));
            }
        }
        if (this.activeObject.type == "グラフィックメッシュ") {
            if (this.selectVerticesIndexs.length > 0 && this.activeObject) {
                if (this.activeAnimation) {
                    console.log("グラフィックメッシュ")
                    this.createTransformData(this.activeObject, isInit, isDecision, type, option, values);
                } else {
                    console.log("グラフィックメッシュベース変形")
                    return this.createBaseTransformData(this.activeObject, isInit, isDecision, type, option, values);
                }
            } else {
                warnDisplay("更新するグラフィックメッシュ頂点が選択されていません");
                return 0;
            }
        } else {
            if (this.activeAnimation) {
                if (this.activeObject.type == "回転モディファイア") {
                    if (type == "move") {
                        this.activeObject.updateRotateModifierPosition(vecReverseScale(vecScale2(mouseState.velocity, [2 / cvs2.width, 2 / cvs2.height]), cameraObject.zoom));
                    } else if (type == "scale") {
                        this.activeObject.setScaleFromPoint(convertCoordinate.screenPosFromGPUPos(mouseState.position));
                    } else if (type == "rotate") {
                        this.activeObject.setAngleFromPoint(convertCoordinate.screenPosFromGPUPos(mouseState.position));
                    }
                } else if (this.activeObject.type == "ベジェモディファイア") {
                    this.createTransformData(this.activeObject, isInit, isDecision, type, option, values);
                } else if (this.selectVerticesIndexs.length > 0 && this.activeObject) {
                    this.createTransformData(this.activeObject, isInit, isDecision, type, option, values);
                } else {
                    warnDisplay("モディファイアが選択されていないため、アニメーションの更新ができません");
                }
            } else {
                if (this.activeObject.type == "ベジェモディファイア") {
                    this.createBaseTransformData(this.activeObject, isInit, isDecision, type, option, values);
                } else {
                    warnDisplay("更新するアニメーションが選択されていません");
                }
            }
        }
        return 1;
    }

    async createTransformDataInit(object) {
        this.startMousePosition = [...mouseState.positionForGPU];
        this.movement = [0,0];
        GPU.writeBuffer(this.movementBuffer, new Float32Array(this.movement));
        calculateAllAverage(this.calculateSelectVerticesBBoxCenterGroup, 2);
        this.weightBuffer = GPU.createStorageBuffer(this.activeObject.verticesNum * 4, undefined, ["f32"]);
        const weightAndIndexsGroup = GPU.createGroup(c_srw_sr,  [{item: this.weightBuffer, type: "b"}, {item: this.selectVerticesIndexBuffer, type: "b"}]);
        this.smoothRadiusBuffer = GPU.createUniformBuffer(4, [this.smoothRadius], ["f32"]);
        this.smoothTypeBuffer = GPU.createUniformBuffer(4, [2], ["f32"]);
        this.configGroup = GPU.createGroup(c_u_u_sr, [{item: this.smoothTypeBuffer, type: "b"}, {item: this.smoothRadiusBuffer, type: "b"}, {item: this.referenceCoordinatesBuffer, type: "b"}]);
        GPU.runComputeShader(createTransformInitialDataPipeline,[weightAndIndexsGroup, this.configGroup, object.collisionVerticesGroup],Math.ceil(object.verticesNum / 64));
        this.originalVerticesBuffer = GPU.createStorageBuffer(object.s_renderVerticesPositionBuffer.size, undefined, ["f32"]);
        GPU.copyBuffer(object.s_renderVerticesPositionBuffer, this.originalVerticesBuffer);
        this.transformDataBuffer = GPU.createStorageBuffer(object.s_renderVerticesPositionBuffer.size, undefined, ["f32"]);
        this.createTransformDataGroup = GPU.createGroup(c_srw_sr_sr_sr_u, [{item: this.transformDataBuffer, type: "b"}, {item: this.referenceCoordinatesBuffer, type: "b"}, {item: this.originalVerticesBuffer, type: "b"}, {item: this.weightBuffer, type: "b"}, {item: this.movementBuffer, type: "b"}]);
        this.referenceCoordinates = await GPU.getF32BufferData(this.referenceCoordinatesBuffer, this.referenceCoordinatesBuffer.size);
        this.referenceBBox = await GPU.getF32BufferData(this.selectVerticesBBoxBuffer, this.selectVerticesBBoxBuffer.size);
    }

    createBaseTransformData(object, isInit, isDecision, type, option, values) {
        if (isInit) {
            this.createTransformDataInit(object);
        }
        if (type == "move") {
            GPU.runComputeShader(createMovementTransformDataPipeline, [this.createTransformDataGroup], Math.ceil(object.verticesNum / 64));
        } else if (type == "scale") {
            GPU.runComputeShader(createScalingTransformDataPipeline, [this.createTransformDataGroup], Math.ceil(object.verticesNum / 64));
        } else if (type == "rotate") {
            GPU.runComputeShader(createRotateTransformDataPipeline, [this.createTransformDataGroup], Math.ceil(object.verticesNum / 64));
        }
        baseTransform(object, this.transformDataBuffer);
        return true;
    }

    createTransformData(object, isInit, isDecision, type, option, values) {
        if (isInit) {
            this.createTransformDataInit(object);
        }
        if (type == "move") {
            GPU.runComputeShader(createMovementTransformDataPipeline, [this.createTransformDataGroup], Math.ceil(object.verticesNum / 64));
        } else if (type == "scale") {
            GPU.runComputeShader(createScalingTransformDataPipeline, [this.createTransformDataGroup], Math.ceil(object.verticesNum / 64));
        } else if (type == "rotate") {
            GPU.runComputeShader(createRotateTransformDataPipeline, [this.createTransformDataGroup], Math.ceil(object.verticesNum / 64));
        }
        this.activeAnimation.transformAnimationData(this.transformDataBuffer);
    }

    deepCopy(data) {
        return JSON.parse(JSON.stringify(data));
    }

    addUndo(data) {
        for (let i = 0; i < this.undoDepth; i ++) {
            this.undoList.splice(this.undoList.length - 1, 1);
        }
        this.undoDepth = 0;
        this.undoList.push(data);
        while (this.undoList.length > 100) {
            this.undoList.splice(0, 1);
        }
        console.log(this.undoList)
    }

    undo() {
        if (this.undoDepth == this.undoList.length) {
            warnDisplay("取り消すデータがありません");
            return ;
        }
        this.undoDepth ++;
        const undoData = this.undoList[this.undoList.length - this.undoDepth];
        if (undoData.type == "アニメーションの変更") {
            const transformData = undoData.data.oldData;
            undoData.target.transformAnimationData(transformData, 0);
        } else if (undoData.type == "ベースの変更") {
            const transformData = undoData.data.oldData;
            undoData.target.updateBaseVertices(transformData, 0);
        } else if (undoData.type == "ベース頂点の削除") {

        }
    }

    redo() {
        if (this.undoDepth == 0) {
            warnDisplay("取り消すデータがありません");
            return ;
        }
        const undoData = this.undoList[this.undoList.length - this.undoDepth];
        if (undoData.type == "アニメーションの変更") {
            const transformData = undoData.data.newData;
            undoData.target.transformAnimationData(transformData, 0);
        } else if (undoData.type == "ベースの変更") {
            const transformData = undoData.data.newData;
            undoData.target.updateBaseVertices(transformData, 0);
        }
        this.undoDepth --;
    }

    async update() {
        GPU.writeBuffer(this.mouseBuffer, new Float32Array(mouseState.positionForGPU));
        // GPU.writeBuffer(this.mouseBuffer, new Float32Array(mouseState.position));
        // GPU.writeBuffer(this.selectRadiusBuffer, new Float32Array([convertCoordinate.sizeClmapFromCPU(this.circleRadius)]));
        GPU.writeBuffer(this.selectRadiusBuffer, new Float32Array([this.circleRadius]));
        GPU.writeBuffer(this.mouseColorBuffer, new Float32Array([0,0,0,0.1]));
        // this.setSelectVerticesBBox();
        // if (keysDown["Tab"]) {
        //     keysDown["Tab"] = false;
        //     if (this.mode == "selectObject") {
        //         if (this.activeObject) {
        //             if (this.activeObject.type == "グラフィックメッシュ") {
        //                 this.clearToSelectVerticesIndexs();
        //                 this.mode = "graphicMeshsEdit";
        //                 this.mode2 = "vertices";
        //                 this.activeAnimation = null;
        //                 updateDataForUI["アニメーション"] = true;
        //                 updateDataForUI["インスペクタ"] = true;
        //             } else if (this.activeObject.type == "モディファイア") {
        //                 this.clearToSelectVerticesIndexs();
        //                 this.mode = "modifierEdit";
        //                 this.activeAnimation = null;
        //                 updateDataForUI["アニメーション"] = true;
        //                 updateDataForUI["インスペクタ"] = true;
        //             } else if (this.activeObject.type == "回転モディファイア") {
        //                 this.clearToSelectVerticesIndexs();
        //                 this.mode = "rotateModifierEdit";
        //                 this.activeAnimation = null;
        //                 updateDataForUI["アニメーション"] = true;
        //                 updateDataForUI["インスペクタ"] = true;
        //             } else if (this.activeObject.type == "ベジェモディファイア") {
        //                 this.clearToSelectVerticesIndexs();
        //                 this.mode = "lineModifierEdit";
        //                 this.activeAnimation = null;
        //                 updateDataForUI["アニメーション"] = true;
        //                 updateDataForUI["インスペクタ"] = true;
        //             }
        //         } else {
        //             warnDisplay("編集モードに入るためにはオブジェクトを選択してください");
        //         }
        //     } else {
        //         this.clearToSelectVerticesIndexs();
        //         this.mode = "selectObject";
        //         this.mode2 = "edit";
        //         this.activeAnimation = null;
        //         updateDataForUI["アニメーション"] = true;
        //         updateDataForUI["インスペクタ"] = true;
        //     }
        // } else {
        //     if (this.mode == "graphicMeshsEdit") {
        //         if (keysDown["1"]) {
        //             this.mode2 = "vertices";
        //         }
        //         if (keysDown["2"]) {
        //             this.mode2 = "mesh";
        //         }
        //     } else if (this.mode == "selectObject") {
        //         if (keysDown["1"]) {
        //             this.mode2 = "edit";
        //         }
        //         if (keysDown["2"]) {
        //             this.mode2 = "view";
        //         }
        //     }
        // }
        // await this.tool();
    }
}

export const manager = new Manager();


const toolFormHTMLElement = document.getElementById('tarsform-form');
const moveValue1HTMLElement = document.getElementById('toolForm-move-value1');
const moveValue2HTMLElement = document.getElementById('toolForm-move-value2');
const toorFormValues = document.getElementById('toorForm-values');
let toolFormType = "";
let isToolFormOpen = false;

function toolFormDisplay(type) {
    isToolFormOpen = true;
    toolFormType = type;
    const toorFormValuesP = document.getElementById('toorFormValues-p');
    toorFormValues.classList.remove('hidden');
    moveValue1HTMLElement.value = manager.movement[0];
    moveValue2HTMLElement.value = manager.movement[1];
    if (type == "move") {
        toorFormValuesP.textContent = "移動量";
    } else if (type == "scale") {
        toorFormValuesP.textContent = "拡大縮小量";
    } else if (type == "rotate") {
        toorFormValuesP.textContent = "回転量";
    }
    toolFormHTMLElement.classList.remove('hidden');
}

function getValues() {
    if (toolFormType == "rotate") return Number(moveValue1HTMLElement.value);
    return [Number(moveValue1HTMLElement.value), Number(moveValue2HTMLElement.value)]
}

moveValue1HTMLElement.addEventListener(('change'), () => {
    manager.objectTrasform(false, false, toolFormType, "xy", getValues());
})

moveValue2HTMLElement.addEventListener(('change'), () => {
    manager.objectTrasform(false, false, toolFormType, "xy", getValues());
})

let isModalOpen = false;
// 変形の適応
document.getElementById('toolForm-submit').addEventListener(('click'), () => {
    console.log("適応")
    manager.objectTrasform(false, true, toolFormType, "xy", getValues());
    toolFormHTMLElement.classList.add('hidden');
    toorFormValues.classList.add('hidden');
    manager.toolType = "select";
    manager.toolTypeState = "頂点選択";
    isToolFormOpen = false;
})

function toolFormSubmit() {
    console.log("適応")
    manager.objectTrasform(false, true, toolFormType, "xy", getValues());
    toolFormHTMLElement.classList.add('hidden');
    toorFormValues.classList.add('hidden');
    manager.toolType = "select";
    manager.toolTypeState = "頂点選択";
    isToolFormOpen = false;
}

const warnModal = document.getElementById('warnModel');
const warnModalErrorText = document.getElementById('errorText');
const warnCloasModalButton = document.getElementById('warnModelCloseButton');
warnCloasModalButton.addEventListener('click', () => {
    warnModal.classList.add('hidden');
    isModalOpen = false;
});

function warnDisplay(warnText) {
    isModalOpen = true;
    warnModal.classList.remove('hidden');
    warnModalErrorText.textContent = warnText;
}