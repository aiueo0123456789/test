import { BBox, calculateLimitBBox } from "./BBox.js";
import { c_sr, c_srw_sr, c_srw_sr_sr_sr_u, c_u_u_sr, createMovementTransformDataPipeline, createRotateTransformDataPipeline, createScalingTransformDataPipeline, createTransformInitialDataPipeline, v_sr, v_u_u } from "./GPUObject.js";
import { keysDown, mouseState } from "./main.js";
import { GPU } from "./webGPU.js";
import { baseTransform } from "./オブジェクトで共通の処理.js";
import { updateDataForUI } from "./グリッド/制御.js";
import { hierarchy } from "./ヒエラルキー.js";
import { vec2 } from "./ベクトル計算.js";
import { calculateAllAverage } from "./平均.js";
import { BBoxSelect, boxSelectVertices, circleSelectVertices } from "./選択.js";
import { toolbar } from "./main.js";

function isPlainObject(obj) {
    return obj instanceof Object && Object.getPrototypeOf(obj) === Object.prototype;
}

function IsString(value) {
    return typeof value === "string" || value instanceof String;
}

let previousKeysDown = {};
export class StateMachine {
    constructor() {
        this.movementBuffer = GPU.createUniformBuffer(2 * 4, undefined, ["f32"]);
        this.selectVerticesBBoxBuffer = GPU.createStorageBuffer(2 * 2 * 4, undefined, ["f32"]);
        this.referenceCoordinatesBuffer = GPU.createStorageBuffer(2 * 4, undefined, ["f32"]);
        this.calculateSelectVerticesBBoxCenterGroup = GPU.createGroup(c_srw_sr, [{item: this.referenceCoordinatesBuffer, type: 'b'}, {item: this.selectVerticesBBoxBuffer, type: 'b'}]);
        this.configGroup = GPU.createGroup(c_u_u_sr, [{item: toolbar.smoothTypeBuffer, type: "b"}, {item: toolbar.smoothRadiusBuffer, type: "b"}, {item: this.referenceCoordinatesBuffer, type: "b"}]);

        this.mouseBuffer = GPU.createStorageBuffer(2 * 4, undefined, ["f32"]);
        this.mouseRenderGroup = GPU.createGroup(v_sr, [{item: this.mouseBuffer, type: 'b'}]);
        this.selectRadiusBuffer = GPU.createUniformBuffer(4, undefined, ["f32"]);
        this.mouseColorBuffer = GPU.createUniformBuffer(4 * 4, undefined, ["f32"]);
        this.mouseRenderConfigGroup = GPU.createGroup(v_u_u, [{item: this.selectRadiusBuffer, type: 'b'}, {item: this.mouseColorBuffer, type: 'b'}]);
        this.smoothRadiusRenderConfig = GPU.createGroup(v_u_u, [{item: toolbar.smoothRadiusBuffer, type: 'b'}, {item: this.mouseColorBuffer, type: 'b'}]);

        GPU.writeBuffer(this.mouseColorBuffer, new Float32Array([0,0,0,0.2]));

        this.undoList = [];
        this.undoDepth = 0;

        this.externalInputs = {"ヒエラルキーのオブジェクト選択": false, "オブジェクトのアニメーションキー選択": false};
        this.structs = { // データの構造: {ステートが変わったタイミングでセットされるデータの構造や定数(&をつけることで前ステートからデータを受け渡しできる)}, データの更新関数: ステートの持つデータを更新する関数, ステートの更新: [{条件: ステートの切り替え条件([]配列指定でandを実現), 次のステート: 条件が揃った時に変わるステート, データの初期化: データに参照がある場合するか}...]
            "オブジェクト選択": {データの構造: {object: null, IsHideForGUI: false}, データの更新関数: null, ステートの更新: [
                {条件: [["クリック",this.SelectGraphicMesh.bind(this)], [this.hierarchySelectGraphicMesh.bind(this)]], 次のステート: "オブジェクト選択-グラフィックメッシュ"},
                {条件: [["クリック",this.SelectModifier.bind(this)], [this.hierarchySelectModifierMesh.bind(this)]], 次のステート: "オブジェクト選択-モディファイア"},
                {条件: [["クリック",this.SelectLineModifier.bind(this)], [this.hierarchySelectLineModifierMesh.bind(this)]], 次のステート: "オブジェクト選択-ベジェモディファイア"},
                {条件: [["クリック",this.SelectRotateModifier.bind(this)], [this.hierarchySelectRotateModifier.bind(this)]], 次のステート: "オブジェクト選択-回転モディファイア"},
            ]},

            // グラフィックメッシュの編集
            "オブジェクト選択-グラフィックメッシュ": {初期化関数: () => {updateDataForUI["ヒエラルキー"] = true; updateDataForUI["インスペクタ"] = true; updateDataForUI["アニメーション"] = true;},データの構造: {object: "&object", IsHideForGUI: "&IsHideForGUI", animation: null}, データの更新関数: null, ステートの更新: [
                {条件: [["クリック"],["input-ヒエラルキーのオブジェクト選択"]], 次のステート: "オブジェクト選択", ステート変更後ループさせるか: true},
                {条件: [["/Tab"]], 次のステート: "グラフィックメッシュ編集-選択"},
            ]},
            "グラフィックメッシュ編集-選択": {データの構造: {
                object: "&object",
                animation: "&animation",
                selectVerticesIndexs: {isInclude: "&selectVerticesIndexs", not: []},
                selectVerticesIndexBuffer: {isInclude: "&selectVerticesIndexBuffer", not: null},
                selectVerticesBBoxGroup: {isInclude: "&selectVerticesBBoxGroup", not: null},
                selectVerticesIndexsGroup: {isInclude: "&selectVerticesIndexsGroup", not: null},
                selectVerticesBBoxRenderGroup: GPU.createGroup(v_sr, [{item: this.selectVerticesBBoxBuffer, type: 'b'}]),
                referenceCoordinatesRenderGroup: GPU.createGroup(v_sr, [{item: this.referenceCoordinatesBuffer, type: 'b'}]),
            }, データの更新関数: this.setSelectVertices.bind(this), ステートの更新: [
                {条件: [["/Tab"]], 次のステート: "オブジェクト選択-グラフィックメッシュ", データの初期化: false},
                {条件: [["/g", this.transformForBool.bind(this)]], 次のステート: "グラフィックメッシュ編集-並行移動"},
                {条件: [["/s", this.transformForBool.bind(this)]], 次のステート: "グラフィックメッシュ編集-拡大縮小"},
                {条件: [["/r", this.transformForBool.bind(this)]], 次のステート: "グラフィックメッシュ編集-回転"},
            ]},
            "グラフィックメッシュ編集-並行移動": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createMoveTransformData.bind(this), ステートの更新: [
                {条件: [["/g"],["クリック"]], 次のステート: "グラフィックメッシュ編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},
            "グラフィックメッシュ編集-拡大縮小": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createScalaingTransformData.bind(this), ステートの更新: [
                {条件: [["/s"],["クリック"]], 次のステート: "グラフィックメッシュ編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},
            "グラフィックメッシュ編集-回転": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createRotateTransformData.bind(this), ステートの更新: [
                {条件: [["/r"],["クリック"]], 次のステート: "グラフィックメッシュ編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},

            // モディファイアの編集
            "オブジェクト選択-モディファイア": {初期化関数: () => {updateDataForUI["ヒエラルキー"] = true; updateDataForUI["インスペクタ"] = true; updateDataForUI["アニメーション"] = true;}, データの構造: {object: "&object", IsHideForGUI: "&IsHideForGUI"}, データの更新関数: null, ステートの更新: [
                {条件: [["クリック"],["input-ヒエラルキーのオブジェクト選択"]], 次のステート: "オブジェクト選択", ステート変更後ループさせるか: true},
                {条件: [["/Tab"]], 次のステート: "モディファイア編集-選択"},
            ]},
            "モディファイア編集-選択": {データの構造: {
                object: "&object",
                animation: "&animation",
                selectVerticesIndexs: {isInclude: "&selectVerticesIndexs", not: []},
                selectVerticesIndexBuffer: {isInclude: "&selectVerticesIndexBuffer", not: null},
                selectVerticesBBoxGroup: {isInclude: "&selectVerticesBBoxGroup", not: null},
                selectVerticesIndexsGroup: {isInclude: "&selectVerticesIndexsGroup", not: null},
                selectVerticesBBoxRenderGroup: GPU.createGroup(v_sr, [{item: this.selectVerticesBBoxBuffer, type: 'b'}]),
                referenceCoordinatesRenderGroup: GPU.createGroup(v_sr, [{item: this.referenceCoordinatesBuffer, type: 'b'}]),
            }, データの更新関数: this.setSelectVertices.bind(this), ステートの更新: [
                {条件: [["/Tab"]], 次のステート: "オブジェクト選択-グラフィックメッシュ", データの初期化: false},
                {条件: [["/g", this.transformForBool.bind(this)]], 次のステート: "モディファイア編集-並行移動"},
                {条件: [["/s", this.transformForBool.bind(this)]], 次のステート: "モディファイア編集-拡大縮小"},
                {条件: [["/r", this.transformForBool.bind(this)]], 次のステート: "モディファイア編集-回転"},
            ]},
            "モディファイア編集-並行移動": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createMoveTransformData.bind(this), ステートの更新: [
                {条件: [["/g"],["クリック"]], 次のステート: "モディファイア編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},
            "モディファイア編集-拡大縮小": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createScalaingTransformData.bind(this), ステートの更新: [
                {条件: [["/s"],["クリック"]], 次のステート: "モディファイア編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},
            "モディファイア編集-回転": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createRotateTransformData.bind(this), ステートの更新: [
                {条件: [["/r"],["クリック"]], 次のステート: "モディファイア編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},

            //　ベジェモディファイアの編集
            "オブジェクト選択-ベジェモディファイア": {初期化関数: () => {updateDataForUI["ヒエラルキー"] = true; updateDataForUI["インスペクタ"] = true; updateDataForUI["アニメーション"] = true;}, データの構造: {object: "&object", IsHideForGUI: "&IsHideForGUI"}, データの更新関数: null, ステートの更新: [
                {条件: [["クリック"],["input-ヒエラルキーのオブジェクト選択"]], 次のステート: "オブジェクト選択", ステート変更後ループさせるか: true},
                {条件: [["/Tab"]], 次のステート: "ベジェモディファイア編集-選択"},
            ]},
            "ベジェモディファイア編集-選択": {データの構造: {
                object: "&object",
                animation: "&animation",
                selectVerticesIndexs: {isInclude: "&selectVerticesIndexs", not: []},
                selectVerticesIndexBuffer: {isInclude: "&selectVerticesIndexBuffer", not: null},
                selectVerticesBBoxGroup: {isInclude: "&selectVerticesBBoxGroup", not: null},
                selectVerticesIndexsGroup: {isInclude: "&selectVerticesIndexsGroup", not: null},
                selectVerticesBBoxRenderGroup: GPU.createGroup(v_sr, [{item: this.selectVerticesBBoxBuffer, type: 'b'}]),
                referenceCoordinatesRenderGroup: GPU.createGroup(v_sr, [{item: this.referenceCoordinatesBuffer, type: 'b'}]),
            }, データの更新関数: this.setSelectVertices.bind(this), ステートの更新: [
                {条件: [["/Tab"]], 次のステート: "オブジェクト選択-グラフィックメッシュ", データの初期化: false},
                {条件: [["/e"]], 次のステート: "ベジェモディファイア編集-頂点追加", ステート変更後ループさせるか: true},
                {条件: [["/g", this.transformForBool.bind(this)]], 次のステート: "ベジェモディファイア編集-並行移動"},
                {条件: [["/s", this.transformForBool.bind(this)]], 次のステート: "ベジェモディファイア編集-拡大縮小"},
                {条件: [["/r", this.transformForBool.bind(this)]], 次のステート: "ベジェモディファイア編集-回転"},
            ]},
            "ベジェモディファイア編集-頂点追加": {データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: null, ステートの更新: [
                {条件: [["すぐに"]], 次のステート: "ベジェモディファイア編集-選択", 終了関数: this.addVertices.bind(this)},
            ]},
            "ベジェモディファイア編集-並行移動": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createMoveTransformData.bind(this), ステートの更新: [
                {条件: [["/g"],["クリック"]], 次のステート: "ベジェモディファイア編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},
            "ベジェモディファイア編集-拡大縮小": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createScalaingTransformData.bind(this), ステートの更新: [
                {条件: [["/s"],["クリック"]], 次のステート: "ベジェモディファイア編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},
            "ベジェモディファイア編集-回転": {初期化関数: this.createTransformDataInit.bind(this), データの構造: {object: "&object", animation: "&animation", selectVerticesIndexs: "&selectVerticesIndexs", selectVerticesIndexBuffer: "&selectVerticesIndexBuffer", selectVerticesIndexsGroup: "&selectVerticesIndexsGroup", selectVerticesBBoxRenderGroup: "&selectVerticesBBoxRenderGroup", referenceCoordinatesRenderGroup: "&referenceCoordinatesRenderGroup", selectVerticesBBoxGroup: "&selectVerticesBBoxGroup"}, データの更新関数: this.createRotateTransformData.bind(this), ステートの更新: [
                {条件: [["/r"],["クリック"]], 次のステート: "ベジェモディファイア編集-選択", 終了関数: this.createTransformUndoData.bind(this)},
            ]},

            //　回転モディファイアの編集
            "オブジェクト選択-回転モディファイア": {初期化関数: () => {updateDataForUI["ヒエラルキー"] = true; updateDataForUI["インスペクタ"] = true; updateDataForUI["アニメーション"] = true;}, データの構造: {object: "&object", IsHideForGUI: "&IsHideForGUI"}, データの更新関数: null, ステートの更新: [
                {条件: [["クリック"],["input-ヒエラルキーのオブジェクト選択"]], 次のステート: "オブジェクト選択", ステート変更後ループさせるか: true},
            ]},
        };
        this.state = {id: "オブジェクト選択", data: this.structs["オブジェクト選択"].データの構造};
    }

    hierarchySelectGraphicMesh() {
        if (this.externalInputs["ヒエラルキーのオブジェクト選択"]) {
            if (this.externalInputs["ヒエラルキーのオブジェクト選択"].type == "グラフィックメッシュ") {
                this.state.data.object = this.externalInputs["ヒエラルキーのオブジェクト選択"];
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    hierarchySelectModifierMesh() {
        if (this.externalInputs["ヒエラルキーのオブジェクト選択"]) {
            if (this.externalInputs["ヒエラルキーのオブジェクト選択"].type == "モディファイア") {
                this.state.data.object = this.externalInputs["ヒエラルキーのオブジェクト選択"];
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    hierarchySelectLineModifierMesh() {
        if (this.externalInputs["ヒエラルキーのオブジェクト選択"]) {
            if (this.externalInputs["ヒエラルキーのオブジェクト選択"].type == "ベジェモディファイア") {
                this.state.data.object = this.externalInputs["ヒエラルキーのオブジェクト選択"];
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    hierarchySelectRotateModifier() {
        if (this.externalInputs["ヒエラルキーのオブジェクト選択"]) {
            if (this.externalInputs["ヒエラルキーのオブジェクト選択"] == "選択解除") {
                this.state.data.object = "";
                return false;
            }
            if (this.externalInputs["ヒエラルキーのオブジェクト選択"].type == "回転モディファイア") {
                this.state.data.object = this.externalInputs["ヒエラルキーのオブジェクト選択"];
                return true;
            } else {
                return false;
            }
        } else {
            return false;
        }
    }

    async SelectModifier() { // モディファイアを選択する関数
        for (const modifier of hierarchy.modifiers) {
            if (await BBoxSelect(modifier, mouseState.positionForGPU,toolbar.selectCircleRadius + 5)) {
                this.state.data.object = modifier;
                return true;
            }
        }
        this.state.data.object = null;
        return false;
    }

    async SelectLineModifier() { // モディファイアを選択する関数
        for (const modifier of hierarchy.lineModifiers) {
            if (await BBoxSelect(modifier, mouseState.positionForGPU,toolbar.selectCircleRadius + 5)) {
                this.state.data.object = modifier;
                return true;
            }
        }
        this.state.data.object = null;
        return false;
    }

    async SelectRotateModifier() { // モディファイアを選択する関数
        for (const modifier of hierarchy.rotateModifiers) {
            if (await BBoxSelect(modifier, mouseState.positionForGPU,toolbar.selectCircleRadius + 5)) {
                this.state.data.object = modifier;
                return true;
            }
        }
        this.state.data.object = null;
        return false;
    }

    async SelectGraphicMesh() { // グラフィックメッシュを選択する関数
        for (const graphicMesh of hierarchy.graphicMeshs) {
            if (await BBoxSelect(graphicMesh, mouseState.positionForGPU,toolbar.selectCircleRadius + 5)) {
                this.state.data.object = graphicMesh;
                return true;
            }
        }
        this.state.data.object = null;
        return false;
    }

    transformForBool() { // 変形を適応する頂点が存在しているかとそのデータ
        if (this.state.data.selectVerticesIndexs.length > 0) {
            return true;
        } else {
            return false;
        }
    }

    async setSelectVertices() {
        const updateSelectVerticesIndexs = (indexs, isAdd) => {
            if (isAdd) {
                for (const index of indexs) {
                    if (!this.state.data.selectVerticesIndexs.includes(index)) {
                        this.state.data.selectVerticesIndexs.push(index);
                    }
                }
            } else {
                this.state.data.selectVerticesIndexs = indexs;
            }
        }
        if (mouseState.click) {
            updateSelectVerticesIndexs(await circleSelectVertices(this.state.data.object, mouseState.positionForGPU, toolbar.selectCircleRadius), keysDown["Shift"]);
            if (this.state.data.selectVerticesIndexs.length) {
                this.state.data.selectVerticesIndexBuffer = GPU.createStorageBuffer(this.state.data.selectVerticesIndexs.length * 4, this.state.data.selectVerticesIndexs, ["u32"]);
                this.state.data.selectVerticesBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.selectVerticesBBoxBuffer, type: "b"}, {item: this.state.data.selectVerticesIndexBuffer, type: "b"}]);
                this.state.data.selectVerticesIndexsGroup = GPU.createGroup(v_sr, [{item: this.state.data.selectVerticesIndexBuffer, type: "b"}]);
            }
        } else if (mouseState.holdFrameCount > 10) {
            updateSelectVerticesIndexs(await boxSelectVertices(this.state.data.object, vec2.createBBox([
                mouseState.positionForGPU,
                mouseState.clickPositionForGPU
            ])), keysDown["Shift"]);
            if (this.state.data.selectVerticesIndexs.length) {
                this.state.data.selectVerticesIndexBuffer = GPU.createStorageBuffer(this.state.data.selectVerticesIndexs.length * 4, this.state.data.selectVerticesIndexs, ["u32"]);
                this.state.data.selectVerticesBBoxGroup = GPU.createGroup(c_srw_sr, [{item: this.selectVerticesBBoxBuffer, type: "b"}, {item: this.state.data.selectVerticesIndexBuffer, type: "b"}]);
                this.state.data.selectVerticesIndexsGroup = GPU.createGroup(v_sr, [{item: this.state.data.selectVerticesIndexBuffer, type: "b"}]);
            }
        }
        if (this.state.data.selectVerticesIndexs.length) {
            calculateLimitBBox(this.state.data.selectVerticesBBoxGroup, this.state.data.object.collisionVerticesGroup, this.state.data.selectVerticesIndexs.length);
        }
        if (this.externalInputs["オブジェクトのアニメーションキー選択"]) {
            this.state.data.animation = this.externalInputs["オブジェクトのアニメーションキー選択"];
            updateDataForUI["アニメーション"] = true;
            console.log(this.state.data)
        }
    }

    async createTransformDataInit() {
        const object = this.state.data.object;
        GPU.writeBuffer(this.movementBuffer, new Float32Array([0,0]));
        calculateAllAverage(this.calculateSelectVerticesBBoxCenterGroup, 2);
        const weightBuffer = GPU.createStorageBuffer(this.state.data.object.verticesNum * 4, undefined, ["f32"]);
        const weightAndIndexsGroup = GPU.createGroup(c_srw_sr,  [{item: weightBuffer, type: "b"}, {item: this.state.data.selectVerticesIndexBuffer, type: "b"}]);
        GPU.runComputeShader(createTransformInitialDataPipeline,[weightAndIndexsGroup, this.configGroup, object.collisionVerticesGroup],Math.ceil(object.verticesNum / 64));
        this.state.data.originalVerticesBuffer = GPU.createStorageBuffer(object.s_renderVerticesPositionBuffer.size, undefined, ["f32"]);
        GPU.copyBuffer(object.s_renderVerticesPositionBuffer, this.state.data.originalVerticesBuffer);
        this.state.data.transformDataBuffer = GPU.createStorageBuffer(object.s_renderVerticesPositionBuffer.size, undefined, ["f32"]);
        this.state.data.transformDataGroup = GPU.createGroup(c_sr, [{item: this.state.data.transformDataBuffer, type: 'b'}]);
        this.state.data.createTransformDataGroup = GPU.createGroup(c_srw_sr_sr_sr_u, [{item: this.state.data.transformDataBuffer, type: "b"}, {item: this.referenceCoordinatesBuffer, type: "b"}, {item: this.state.data.originalVerticesBuffer, type: "b"}, {item: weightBuffer, type: "b"}, {item: this.movementBuffer, type: "b"}]);
        this.state.data.referenceCoordinates = await GPU.getF32BufferData(this.referenceCoordinatesBuffer);
        this.state.data.referenceBBox = await GPU.getF32BufferData(this.selectVerticesBBoxBuffer);
    }

    async createTransformUndoData() {
        const object = this.state.data.object;
        const resultVerticesBuffer = GPU.createStorageBuffer(object.s_renderVerticesPositionBuffer.size, undefined, ["f32"]);
        GPU.copyBuffer(object.s_renderVerticesPositionBuffer, resultVerticesBuffer);
        this.addUndoData("変形の巻き戻し", {object: this.state.data.animation ? this.state.data.animation : object, undo: GPU.createGroup(c_sr, [{item: this.state.data.originalVerticesBuffer, type: 'b'}]), redo: GPU.createGroup(c_sr, [{item: resultVerticesBuffer, type: 'b'}])});
    }

    createMoveTransformData() {
        if (this.state.data.referenceCoordinates) {
            const movement = vec2.subR(mouseState.positionForGPU, this.state.data.referenceCoordinates);
            if (keysDown["x"]) {
                GPU.writeBuffer(this.movementBuffer, new Float32Array(vec2.mulR(movement, [1,0])));
            } else if (keysDown["y"]) {
                GPU.writeBuffer(this.movementBuffer, new Float32Array(vec2.mulR(movement, [0,1])));
            } else {
                GPU.writeBuffer(this.movementBuffer, new Float32Array(movement));
            }
            GPU.runComputeShader(createMovementTransformDataPipeline, [this.state.data.createTransformDataGroup], Math.ceil(this.state.data.object.verticesNum / 64));
            if (this.state.data.animation) {
                this.state.data.animation.transformAnimationData(this.state.data.transformDataGroup);
            } else {
                baseTransform(this.state.data.object, this.state.data.transformDataGroup);
            }
        }
    }

    createScalaingTransformData() {
        if (this.state.data.referenceCoordinates) {
            const movement = vec2.divR(vec2.subR(mouseState.positionForGPU, this.state.data.referenceCoordinates), vec2.subR([this.state.data.referenceBBox[2], this.state.data.referenceBBox[3]], this.state.data.referenceCoordinates));
            if (keysDown["x"]) {
                GPU.writeBuffer(this.movementBuffer, new Float32Array([movement[0], 1]));
            } else if (keysDown["y"]) {
                GPU.writeBuffer(this.movementBuffer, new Float32Array([1, movement[1]]));
            } else {
                GPU.writeBuffer(this.movementBuffer, new Float32Array(movement));
            }
            GPU.runComputeShader(createScalingTransformDataPipeline, [this.state.data.createTransformDataGroup], Math.ceil(this.state.data.object.verticesNum / 64));
            if (this.state.data.animation) {
                this.state.data.animation.transformAnimationData(this.state.data.transformDataGroup);
            } else {
                baseTransform(this.state.data.object, this.state.data.transformDataGroup);
            }
        }
    }

    createRotateTransformData() {
        if (this.state.data.referenceCoordinates) {
            GPU.writeBuffer(this.movementBuffer, new Float32Array([vec2.angleAFromB(this.state.data.referenceCoordinates, mouseState.positionForGPU)]));
            GPU.runComputeShader(createRotateTransformDataPipeline, [this.state.data.createTransformDataGroup], Math.ceil(this.state.data.object.verticesNum / 64));
            if (this.state.data.animation) {
                this.state.data.animation.transformAnimationData(this.state.data.transformDataGroup);
            } else {
                baseTransform(this.state.data.object, this.state.data.transformDataGroup);
            }
        }
    }

    addVertices() {
        if (this.state.data.object.type == "ベジェモディファイア") {
            this.state.data.object.addBaseVertices([mouseState.positionForGPU, vec2.addR(mouseState.positionForGPU,[100,0]), vec2.addR(mouseState.positionForGPU,[-100,0])]);
        }
    }

    addUndoData(action, data) {
        for (let i = 0; i < this.undoDepth; i ++) {
            this.undoList.splice(this.undoList.length - 1, 1);
        }
        this.undoDepth = 0;
        this.undoList.push({action, data});
        while (this.undoList.length > 50) {
            this.undoList.splice(0, 1);
        }
        console.log(this.undoList)
    }

    undo() {
        console.log(this.undoDepth, this.undoList)
        if (this.undoDepth == this.undoList.length) {
            console.log("取り消すデータがありません");
            return false;
        }
        this.undoDepth ++;
        const undoData = this.undoList[this.undoList.length - this.undoDepth];
        if (undoData.action == "変形の巻き戻し") {
            const object = undoData.data.object;
            if (object.type) {
                baseTransform(object, undoData.data.undo);
            } else {
                object.transformAnimationData(undoData.data.undo);
            }
        }
        return true;
    }

    redo() {
        if (this.undoDepth == 0) {
            console.log("取り消すデータがありません");
            return false;
        }
        const undoData = this.undoList[this.undoList.length - this.undoDepth];
        if (undoData.action == "変形の巻き戻し") {
            const object = undoData.data.object;
            if (object.type) {
                baseTransform(object, undoData.data.redo);
            } else {
                object.transformAnimationData(undoData.data.redo);
            }
        }
        this.undoDepth --;
        return true;
    }

    // 現在のステートに文字列が含まれるか
    searchStringInNowState(string) {
        return this.state.id.split("-").includes(string);
    }

    // ステート更新
    async stateUpdate() {
        GPU.writeBuffer(this.mouseBuffer, new Float32Array(mouseState.positionForGPU));
        GPU.writeBuffer(this.selectRadiusBuffer, new Float32Array([toolbar.selectCircleRadius]));
        let roop = true;
        while (roop) {
            const nowStateStruct = this.structs[this.state.id];
            if (nowStateStruct.データの更新関数) {
                await nowStateStruct.データの更新関数();
            }
            let bools = false;
            for (const data of nowStateStruct.ステートの更新) {
                for (const ands of data.条件) {
                    let bool = true;
                    for (const 条件 of ands) {
                        if (typeof 条件 === 'function') {
                            const result = await 条件();
                            if (result) {
                                if (isPlainObject(result)) {
                                    // newData = result;
                                }
                            } else {
                                bool = false;
                                break ;
                            }
                        } else if (条件 == "すぐに") {

                        } else if (条件 == "クリック") {
                            if (!mouseState.click) {
                                bool = false;
                                break ;
                            }
                        } else if (条件[0] == "/") {
                            if (!(keysDown[条件.slice(1)] && !previousKeysDown[条件.slice(1)])) {
                                bool = false;
                                break ;
                            }
                        } else if (条件.length >= 7 && 条件.slice(0,6) == "input-") {
                            if (!this.externalInputs[条件.slice(6,)]) {
                                bool = false;
                            }
                        } else if (!keysDown[条件]) {
                            bool = false;
                            break ;
                        }
                    }
                    if (bool) {
                        bools = true;
                        break ;
                    }
                }
                let newData = {};
                for (const dataName in this.structs[data.次のステート].データの構造) {
                    const initData = this.structs[data.次のステート].データの構造[dataName];
                    if (isPlainObject(initData) && ("isInclude" in initData) && ("not" in initData)) {
                        if (initData.isInclude.slice(1) in this.state.data) {
                            newData[dataName] = this.state.data[initData.isInclude.slice(1)];
                        } else {
                            newData[dataName] = initData.not;
                        }
                    } else if (IsString(initData) && initData[0] == "&") {
                        newData[dataName] = this.state.data[initData.slice(1)];
                    } else {
                        newData[dataName] = initData;
                    }
                }
                if (bools) {
                    if (data.終了関数 && typeof data.終了関数 == "function") {
                        data.終了関数();
                    }
                    this.state = {id: data.次のステート, data: newData};
                    if (this.structs[data.次のステート].初期化関数 && typeof this.structs[data.次のステート].初期化関数 === 'function') this.structs[data.次のステート].初期化関数();
                    if (!data.ステート変更後ループさせるか) roop = false;
                    break ;
                }
            }
            if (!bools) roop = false;
        }
        // 巻き戻し巻き戻しの取り消し
        if (keysDown["undo"]) {
            this.undo();
            keysDown["undo"] = false;
        }
        if (keysDown["redo"]) {
            this.redo();
            keysDown["redo"] = false;
        }
        mouseState.click = false;
        if (mouseState.hold) {
            mouseState.holdFrameCount ++;
        }
        for (const keyName in this.externalInputs) {
            this.externalInputs[keyName] = false;
        }
        previousKeysDown = structuredClone(keysDown);
    }
}