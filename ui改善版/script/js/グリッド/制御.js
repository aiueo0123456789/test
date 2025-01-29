import { GPU } from "../webGPU.js";
import { updateForContextmenu } from "../コンテキストメニュー/制御.js";
import { displayAnimationKey } from "./アニメーションキーの表示.js";
import { displayAnimationManager } from "./アニメーションマネージャーの表示.js";
import { displayInspector } from "./インスペクタの表示.js";
import { displayObjects } from "./オブジェクトの表示.js";
import { displayHierarchy } from "./ヒエラルキーの表示.js";
import { displayProperty } from "./プロパティの表示.js";
import { displayRenderingOrder } from "./表示順番の表示.js";

const modes = {
    "ビュー": displayHierarchy,
    "オブジェクト": displayObjects,
    "ヒエラルキー": displayHierarchy,
    "アニメーション": displayAnimationKey,
    "アニメーションマネージャー": displayAnimationManager,
    "表示順番": displayRenderingOrder,
    "インスペクタ": displayInspector,
    "プロパティ": displayProperty,
};

export const updateDataForUI = {
    "ビュー": false,
    "オブジェクト": false,
    "ヒエラルキー": false,
    "アニメーション": false,
    "アニメーションマネージャー": false,
    "表示順番": false,
    "インスペクタ": false,
    "プロパティ": false,
};

const gridInteriorObjects = [];

export class GridInterior {
    constructor(tag, initMode) {
        gridInteriorObjects.push(this);
        this.targetTag = tag;
        this.targetTag.className = "grid-container";

        this.modeDiv = document.createElement("div");
        this.modeDiv.className = "modeSelect";

        this.mainDiv = document.createElement("div");
        this.mainDiv.className = "grid-main";

        this.modeSelectTag = document.createElement('select');
        for (const mode in modes) {
            const modeSelectOptionTag = document.createElement('option');
            modeSelectOptionTag.textContent = mode;
            modeSelectOptionTag.value = mode;
            if (mode == initMode) {
                modeSelectOptionTag.selected = true;
            }
            this.modeSelectTag.appendChild(modeSelectOptionTag);
        }

        this.modeDiv.append(this.modeSelectTag, this.createModeToolBar(initMode));

        this.targetTag.append(this.modeDiv, this.mainDiv);

        this.modeSelectTag.addEventListener('change', () => {
            this.modeDiv.innerHTML = "";
            this.modeDiv.append(this.modeSelectTag, this.createModeToolBar(this.modeSelectTag.value));
            modes[this.modeSelectTag.value](this.mainDiv, true);
        });

        modes[initMode](this.mainDiv);

        this.mainDiv.addEventListener('contextmenu', (e) => {
            e.preventDefault();
            updateForContextmenu(this.modeSelectTag.value,[e.clientX,e.clientY]);
        });
    }

    createModeToolBar(mode) {
        if (mode == "オブジェクト") {
            const tagDiv = document.createElement("div");
            const filteringSelectTag = document.createElement('select');
            for (const type of ["すべて","グラフィックメッシュ","モディファイア","ベジェモディファイア","回転モディファイア"]) {
                const filteringSelectOptionTag = document.createElement('option');
                filteringSelectOptionTag.textContent = type;
                filteringSelectOptionTag.value = type;
                filteringSelectTag.appendChild(filteringSelectOptionTag);
            }
            filteringSelectTag.addEventListener('change', () => {
                displayObjects(this.mainDiv,false,filteringSelectTag.value);
            });
            tagDiv.append(filteringSelectTag);
            return tagDiv;
        } else if (mode == "アニメーション") {
            const tagDiv = document.createElement("div");
            return tagDiv;
        }
        const tagDiv = document.createElement("div");
        return tagDiv;
    }

    update(updateData) {
        if (updateData[this.modeSelectTag.value]) {
            modes[this.modeSelectTag.value](this.mainDiv);
        }
    }
}

export function updateForUI() {
    for (const gridInteriorObject of gridInteriorObjects) {
        gridInteriorObject.update(updateDataForUI);
    }
    for (const keyName in updateDataForUI) {
        updateDataForUI[keyName] = false;
    }
}

export class Toolbar {
    constructor(tag) {
        this.targetTag = tag;
        this.targetTag.className = "Toolbar";

        this.smoothRadiusBuffer = GPU.createUniformBuffer(4, undefined, ["f32"]);
        GPU.writeBuffer(this.smoothRadiusBuffer, new Float32Array([20]));
        this.smoothTypeBuffer = GPU.createUniformBuffer(4, undefined, ["f32"]);
        GPU.writeBuffer(this.smoothTypeBuffer, new Float32Array([0]));

        this.selectCircleRadius = 20;

        this.selectCircleRadiusInputTag = document.createElement("input");
        this.selectCircleRadiusInputTag.type = "number";
        this.selectCircleRadiusInputTag.value = this.selectCircleRadius;
        this.selectCircleRadiusInputTag.min = 0;
        this.selectCircleRadiusInputTag.max = 100;
        this.selectCircleRadiusInputTag.step = 0.000001;
        this.selectCircleRadiusInputTag.addEventListener('change', () => {
            this.selectCircleRadius = this.selectCircleRadiusInputTag.value;
        })

        this.smoothtypeSelectTag = document.createElement("select");
        for (const type of [["通常", 0],["線形", 1],["逆2乗",2]]) {
            const sleectElement = document.createElement('option'); // h1要素に配列の要素を設定
            sleectElement.value = type[1]; // h1要素に配列の要素を設定
            sleectElement.textContent = type[0]; // h1要素に配列の要素を設定
            this.smoothtypeSelectTag.append(sleectElement);
        }

        this.smoothtypeSelectTag.addEventListener("change", () => {
            GPU.writeBuffer(this.smoothTypeBuffer, new Float32Array([this.smoothtypeSelectTag.value]));
        })

        this.smoothRadiusInputTag = document.createElement("input");
        this.smoothRadiusInputTag.type = "number";
        this.smoothRadiusInputTag.value = 20;
        this.smoothRadiusInputTag.min = 0;
        this.smoothRadiusInputTag.max = 100;
        this.smoothRadiusInputTag.step = 0.000001;

        this.smoothRadiusInputTag.addEventListener('change', () => {
            GPU.writeBuffer(this.smoothRadiusBuffer, new Float32Array([this.smoothRadiusInputTag.value]));
        })

        this.openBtn = document.createElement("button");
        this.openBtn.textContent = "開く";

        this.targetTag.append(this.selectCircleRadiusInputTag,this.smoothtypeSelectTag,this.smoothRadiusInputTag,this.openBtn);
    }
}