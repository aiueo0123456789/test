import { hierarchy } from './ヒエラルキー.js';
import { vec2 } from './ベクトル計算.js'
import { ConvertCoordinate } from './座標の変換.js'
import { Camera } from './カメラ.js';
import { Render } from './レンダー.js';

import { createGridsObject,gridUpdate  } from "./グリッド/grid.js";
import { GridInterior, Toolbar, updateDataForUI, updateForUI } from "./グリッド/制御.js";
import { StateMachine } from './状態遷移.js';

// 構造の作成
const layout =
    {id: "main", type: "w", children: [
        {id: "c1", type: "h", children: [
            {id: "render-toolbar", type: "", children: []},
            {id: "ui2", type: "w", children: [
                {id: "ui2_0", type: "", children: []},
                {id: "ui2_1", type: "", children: []},
            ]},
        ]},
        {id: "ui1", type: "h", children: [
            {id: "ui1_0", type: "", children: []},
            {id: "ui1_1", type: "", children: []},
        ]},
    ]}
;

// 構造からグリッドオブジェクトを作成
createGridsObject(null, layout);

// appをリセットしてグリッドオブジェクトを表示
const appDiv = document.getElementById("app");
appDiv.innerHTML = "";
gridUpdate("app");

const renderAndToolbar = document.getElementById("render-toolbar");
const cvs = document.createElement("canvas");
const toolBar = document.createElement("div");
toolBar.id = "toolbar";
toolBar.className = "toolbar";
renderAndToolbar.append(toolBar);
renderAndToolbar.append(cvs);

export const ui1_0 = document.getElementById("ui1_0");

export const ui1_1 = document.getElementById("ui1_1");

export const ui2_0 = document.getElementById("ui2_0");
export const ui2_1 = document.getElementById("ui2_1");

export const toolbar = new Toolbar(document.getElementById("toolbar"));
export const stateMachine = new StateMachine();
new GridInterior(ui1_0, "ヒエラルキー");
new GridInterior(ui1_1, "アニメーション");
new GridInterior(ui2_0, "アニメーションマネージャー");
new GridInterior(ui2_1, "インスペクタ");

export const keysDown = {};
let projectName = "名称未設定";
let loadData = null;
const camera = new Camera();
camera.updateCamera();
let cvsRect = cvs.getBoundingClientRect();
cvs.width = cvsRect.width * 2;
cvs.height = cvsRect.height * 2;
let cvsK = cvs.height / cvsRect.height;

export const mouseState = {click: false, hold: false, holdFrameCount: 0, clickPosition: [0,0], clickPositionForGPU:[0,0], position: [0,0], lastPosition: [0,0], positionForGPU: [0,0], velocity: [0,0]};
export const convertCoordinate = new ConvertCoordinate(cvs,camera);
export const render = new Render(cvs,camera);

async function init() {
    hierarchy.destroy();
    for (const data of loadData.modifiers) {
        await hierarchy.addObject(data,"");
    }
    for (const data of loadData.lineModifiers) {
        await hierarchy.addObject(data,"");
    }
    for (const data of loadData.rotateModifiers) {
        await hierarchy.addObject(data,"");
    }
    for (const data of loadData.graphicMeshs) {
        await hierarchy.addObject(data,"");
    }
    for (const data of loadData.animationManager) {
        hierarchy.addObject(data,"");
    }
    hierarchy.setHierarchy(loadData.hierarchy);
    loadData = null;
    Object.keys(updateDataForUI).forEach(key => {
        updateDataForUI[key] = true;
    });
    console.log(hierarchy);
    update();
}

export async function load(path) {
    const objectJSON = await fetch(`config/${path}`).then(x => x.json()); // JSONを解析してJavaScriptオブジェクトに変換;
    console.log(objectJSON)
    return objectJSON;
}

function update() {
    if (loadData) {
        init();
    } else {
        stateMachine.stateUpdate();
        camera.updateCamera();
        hierarchy.updateRenderingOrder(100);
        hierarchy.runHierarchy(stateMachine.searchStringInNowState("オブジェクト選択"));
        render.renderObjects();
        render.renderGUI();
        updateForUI();
        requestAnimationFrame(update);
    }
}

update();

// ResizeObserverを作成
const resizeObserver = new ResizeObserver(entries => {
    for (let entry of entries) {
        // 要素の新しいサイズを取得
        cvsRect = cvs.getBoundingClientRect();
        console.log(cvsRect)
        cvs.width = cvsRect.width * 3;
        cvs.height = cvsRect.height * 3;
        cvsK = cvs.height / cvsRect.height;
        render.resizeCVS();
    }
});

// 要素のリサイズを監視
resizeObserver.observe(cvs);

// ホイール操作
cvs.addEventListener('wheel', (event) => {
    if (keysDown["Alt"]) {
        camera.zoom += event.deltaY / 200;
        camera.zoom = Math.max(Math.min(camera.zoom,camera.zoomMax),camera.zoomMin);
    } else {
        camera.position = vec2.addR(camera.position, vec2.scaleR([-event.deltaX, event.deltaY], 1 / camera.zoom));
    }

    event.preventDefault();
}, { passive: false });

cvs.addEventListener('mousemove', (event) => {
        const mouseX = (event.clientX - cvsRect.left) * cvsK; // Calculate mouse X relative to canvas
        const mouseY = cvs.height - ((event.clientY - cvsRect.top) * cvsK); // Calculate mouse Y relative to canvas
        mouseState.position = [mouseX,mouseY];
        mouseState.positionForGPU = convertCoordinate.screenPosFromGPUPos(mouseState.position);
});

cvs.addEventListener('mousedown', (event) => {
        const mouseX = (event.clientX - cvsRect.left) * cvsK; // Calculate mouse X relative to canvas
        const mouseY = cvs.height - ((event.clientY - cvsRect.top) * cvsK); // Calculate mouse Y relative to
        mouseState.clickPosition = [mouseX,mouseY];
        mouseState.clickPositionForGPU = convertCoordinate.screenPosFromGPUPos(mouseState.position);
        mouseState.position = [mouseX,mouseY];
        mouseState.positionForGPU = convertCoordinate.screenPosFromGPUPos(mouseState.position);
        mouseState.hold = true;
        mouseState.holdFrameCount = 0;
        mouseState.click = true;
});

cvs.addEventListener('mouseup', () => {
        mouseState.hold = false;
        mouseState.holdFrameCount = 0;
});

// キーのダウンを検知
document.addEventListener('keydown',function(event) {
    const isCtrlOrCmd = event.ctrlKey || event.metaKey;
    if (isCtrlOrCmd && event.key === 'z') {
        if (event.shiftKey) {
            keysDown["redo"] = true;
        } else {
            keysDown["undo"] = true;
        }
        event.preventDefault(); // デフォルトの動作を防ぐ場合
    } else {
        keysDown[event.key] = true;
        console.log(event.key,"down")
        if (event.key === "Tab" || event.key === "Shift" || event.key === "Meta") {
            // デフォルト動作を無効化
            event.preventDefault();
            console.log(event.key,"のデフォルト動作を無効化しました");
        }
    }
});

// キーのアップを検知
document.addEventListener('keyup',function(event) {
    keysDown[event.key] = false;
    console.log(event.key,"up")
});

// セーブ
document.getElementById("save-btn").addEventListener("click", async () => {
    // JSONデータを作成
    const data = {
        hierarchy: hierarchy.getSaveData(),
        graphicMeshs: await Promise.all(
            hierarchy.graphicMeshs.map(graphicMeshs => {
                return graphicMeshs.getSaveData(); // Promise を返す
            })
        ),
        modifiers: await Promise.all(
            hierarchy.modifiers.map(modifier => {
                return modifier.getSaveData(); // Promise を返す
            })
        ),
        lineModifiers: await Promise.all(
            hierarchy.lineModifiers.map(modifier => {
                return modifier.getSaveData(); // Promise を返す
            })
        ),
        rotateModifiers: await Promise.all(
            hierarchy.rotateModifiers.map(modifier => {
                return modifier.getSaveData(); // Promise を返す
            })
        ),
        animationManager: Object.keys(hierarchy.animationManagers).map(keyName => {
            const animationManager = hierarchy.animationManagers[keyName];
            return animationManager.getSaveData(); // Promise を返す
        }),
    };

    // JSONデータを文字列化
    const jsonString = JSON.stringify(data, null, 2);

    // Blobを作成
    const blob = new Blob([jsonString], { type: "application/json" });

    // ダウンロード用のリンクを作成
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `${projectName}.json`;

    // リンクをクリックしてダウンロードを開始
    a.click();

    // メモリ解放
    URL.revokeObjectURL(a.href);
});

document.getElementById("open-btn").addEventListener("change", async (event) => {
    const file = event.target.files[0]; // 選択したファイルを取得
    if (file && file.type === "application/json") {
        const reader = new FileReader();

        reader.onload = function(e) {
            try {
                // JSONの内容をパースする
                loadData = JSON.parse(e.target.result);
            } catch (error) {
                console.error("JSONの解析に失敗しました:", error);
            }
        };

    reader.onerror = function() {
        console.error("ファイルの読み込みに失敗しました");
    };

      // ファイルをテキストとして読み込む
    reader.readAsText(file);
    } else {
        console.error("選択したファイルはJSONではありません");
    }
});

document.getElementById("projectName-input").addEventListener("change", async (event) => {
    projectName = event.target.value;
});