import { render } from "../main.js";
import { GPU } from "../webGPU.js";
import { updateCenterPosition } from "../オブジェクトで共通の処理.js";
import { hierarchy } from "../ヒエラルキー.js";
import { stateMachine } from '../main.js';
import { createMeshFromTexture } from '../画像からメッシュを作る.js';
import { vec2 } from "../ベクトル計算.js";

export function displayInspector(scrollableDiv, isInit) {
    if (isInit) {
    }
    scrollableDiv.innerHTML = "";

    const object = stateMachine.state.data.object;

    scrollableDiv.className = "scrollable";
    if (object) {
        const nameInputTag = document.createElement("input");
        nameInputTag.type = "text";
        nameInputTag.value = object.name;

        const changeCenterPositionFn = () => {
            updateCenterPosition(object, [Number(centerPositionInputTagForX.value), Number(centerPositionInputTagForY.value)])
        }

        const BBoxMinDivTag = document.createElement("div");
        BBoxMinDivTag.className = "coordinate-input";

        const BBoxMinInputTagForX = document.createElement("input");
        BBoxMinInputTagForX.type = "number";
        BBoxMinInputTagForX.value = object.BBoxArray[0];
        BBoxMinInputTagForX.addEventListener('change', changeCenterPositionFn);
        const BBoxMinInputTagForY = document.createElement("input");
        BBoxMinInputTagForY.type = "number";
        BBoxMinInputTagForY.value = object.BBoxArray[1];
        BBoxMinInputTagForY.addEventListener('change', changeCenterPositionFn);

        BBoxMinDivTag.append(BBoxMinInputTagForX,BBoxMinInputTagForY);

        const BBoxMaxDivTag = document.createElement("div");
        BBoxMaxDivTag.className = "coordinate-input";

        const BBoxMaxInputTagForX = document.createElement("input");
        BBoxMaxInputTagForX.type = "number";
        BBoxMaxInputTagForX.value = object.BBoxArray[2];
        BBoxMaxInputTagForX.addEventListener('change', changeCenterPositionFn);
        const BBoxMaxInputTagForY = document.createElement("input");
        BBoxMaxInputTagForY.type = "number";
        BBoxMaxInputTagForY.value = object.BBoxArray[3];
        BBoxMaxInputTagForY.addEventListener('change', changeCenterPositionFn);

        BBoxMaxDivTag.append(BBoxMaxInputTagForX,BBoxMaxInputTagForY);

        const centerPositionDivTag = document.createElement("div");
        centerPositionDivTag.className = "coordinate-input";

        const centerPositionInputTagForX = document.createElement("input");
        centerPositionInputTagForX.type = "number";
        centerPositionInputTagForX.value = (object.BBoxArray[0] + object.BBoxArray[2]) / 2;
        centerPositionInputTagForX.addEventListener('change', changeCenterPositionFn);
        const centerPositionInputTagForY = document.createElement("input");
        centerPositionInputTagForY.type = "number";
        centerPositionInputTagForY.value = (object.BBoxArray[1] + object.BBoxArray[3]) / 2;
        centerPositionInputTagForY.addEventListener('change', changeCenterPositionFn);

        BBoxMinDivTag.append(BBoxMinInputTagForX,BBoxMinInputTagForY);
        BBoxMaxDivTag.append(BBoxMaxInputTagForX,BBoxMaxInputTagForY);
        centerPositionDivTag.append(centerPositionInputTagForX,centerPositionInputTagForY);

        const parentSelectTag = document.createElement("select");
        if (true) {
            const sleectElement = document.createElement('option'); // h1要素に配列の要素を設定
            sleectElement.value = ""; // h1要素に配列の要素を設定
            sleectElement.textContent = "なし"; // h1要素に配列の要素を設定
            if (!object.parent) {
                sleectElement.selected = true;
            }
            parentSelectTag.append(sleectElement);
        }
        const createModifierOptionTag = (modifier,type) => {
            const sleectElement = document.createElement('option'); // h1要素に配列の要素を設定
            sleectElement.value = `${type}${modifier.name}`; // h1要素に配列の要素を設定
            sleectElement.textContent = `${modifier.name}`; // h1要素に配列の要素を設定
            if (object.parent == modifier) {
                sleectElement.selected = true;
            }
            parentSelectTag.append(sleectElement);
        }
        hierarchy.modifiers.forEach(modifier => {
            createModifierOptionTag(modifier,"_m");
        })
        hierarchy.lineModifiers.forEach(modifier => {
            createModifierOptionTag(modifier,"lm");
        })
        hierarchy.rotateModifiers.forEach(modifier => {
            createModifierOptionTag(modifier,"rm");
        })

        nameInputTag.addEventListener('change', () => {
            hierarchy.changeObjectName(object, nameInputTag.value);
        });

        parentSelectTag.addEventListener('change', () => {
            if (parentSelectTag.value == "") {
                hierarchy.sortHierarchy("", object);
            } else {
                let type;
                if (parentSelectTag.value.slice(0,2) == "_m") type = "モディファイア";
                if (parentSelectTag.value.slice(0,2) == "lm") type = "ベジェモディファイア";
                if (parentSelectTag.value.slice(0,2) == "rm") type = "回転モディファイア";
                hierarchy.sortHierarchy(hierarchy.searchObjectFromName(parentSelectTag.value.slice(2), type), object);
            }
        });

        if (object.type == "グラフィックメッシュ") {
            const zIndexInputTag = document.createElement("input");
            zIndexInputTag.type = "number";
            zIndexInputTag.value = object.zIndex;
            zIndexInputTag.addEventListener('change', () => {
                console.log(Number(zIndexInputTag.value))
                object.zIndex = Number(zIndexInputTag.value);
            });

            const textureInputTag = document.createElement("input");
            textureInputTag.type = "file";
            textureInputTag.accept = "image/*"; // 画像ファイルのみ選択可能にする

            const textureView = document.createElement("canvas");
            textureView.style.width = "200px";
            textureView.style.height = "200px";

            const createAutoMeshForTextureBtnTag = document.createElement("button");
            createAutoMeshForTextureBtnTag.textContent = "メッシュの自動生成";

            const maskTexturesSelectTag = document.createElement("select");
            render.maskTextures.forEach(textureData => {
                const sleectElement = document.createElement('option'); // h1要素に配列の要素を設定
                sleectElement.value = textureData.name; // h1要素に配列の要素を設定
                sleectElement.textContent = textureData.name; // h1要素に配列の要素を設定
                if (object.maskTargetTexture == textureData) {
                    sleectElement.selected = true;
                }
                maskTexturesSelectTag.append(sleectElement);
            })

            const maskRenderingTargetTextureSelectTag = document.createElement("select");
            render.maskTextures.forEach(textureData => {
                const sleectElement = document.createElement('option'); // h1要素に配列の要素を設定
                sleectElement.value = textureData.name; // h1要素に配列の要素を設定
                sleectElement.textContent = textureData.name; // h1要素に配列の要素を設定
                if (object.maskRenderingTargetTexture == textureData) {
                    sleectElement.selected = true;
                }
                maskRenderingTargetTextureSelectTag.append(sleectElement);
            })

            scrollableDiv.append(nameInputTag, parentSelectTag, BBoxMinDivTag, BBoxMaxDivTag, centerPositionDivTag, zIndexInputTag, textureInputTag, textureView, createAutoMeshForTextureBtnTag, maskTexturesSelectTag, maskRenderingTargetTextureSelectTag);

            createAutoMeshForTextureBtnTag.addEventListener("click", async () => {
                const meshData = await createMeshFromTexture(object.texture, 6, [100,100], 0, 5);
                for (let i = 0; i < meshData[0].length; i ++) {
                    vec2.add(meshData[0][i], meshData[0][i], [(object.BBoxArray[0] + object.BBoxArray[2]) / 2, (object.BBoxArray[1] + object.BBoxArray[3]) / 2]);
                }
                object.setMeshData(...meshData);
            })

            textureInputTag.addEventListener("change", async (event) => {
                const file = event.target.files[0]; // 選択されたファイル
                if (file) {
                    const fileName = file.name.split(".")[0];
                    hierarchy.changeObjectName(object, fileName);
                    // ファイルのプレビュー表示例
                    object.texture = await GPU.imageToTexture2D(URL.createObjectURL(file));
                    object.textureView = object.texture.createView();
                    object.setGroup();
                }
            });

            maskRenderingTargetTextureSelectTag.addEventListener('change', () => {
                object.changeMaskmaskRenderingTargetTexture(render.searchMaskTextureFromName(maskRenderingTargetTextureSelectTag.value));
            });

            maskTexturesSelectTag.addEventListener('change', () => {
                object.changeMaskTargetTexture(render.searchMaskTextureFromName(maskTexturesSelectTag.value));
            });
        } else if (object.type == "モディファイア") {
            const changeFinenessFn = () => {
                object.updateFineness([Number(finenessInputTagForX.value) ,Number(finenessInputTagForY.value)]);
            }

            const finenessInputTagForX = document.createElement("input");
            finenessInputTagForX.type = "number";
            finenessInputTagForX.addEventListener('change', changeFinenessFn);
            const finenessInputTagForY = document.createElement("input");
            finenessInputTagForY.type = "number";
            finenessInputTagForY.addEventListener('change', changeFinenessFn);
            if (object.fineness) {
                finenessInputTagForX.value = object.fineness[0];
                finenessInputTagForY.value = object.fineness[1];
            } else {
                finenessInputTagForX.value = 0;
                finenessInputTagForY.value = 0;
            }

            const finenessDivTag = document.createElement("div");
            finenessDivTag.className = "coordinate-input";

            finenessDivTag.append(finenessInputTagForX, finenessInputTagForY);

            scrollableDiv.append(nameInputTag, parentSelectTag, BBoxMinDivTag, BBoxMaxDivTag, centerPositionDivTag, finenessDivTag);
        } else if (object.type == "ベジェモディファイア") {
            scrollableDiv.append(nameInputTag, parentSelectTag, BBoxMinDivTag, BBoxMaxDivTag, centerPositionDivTag);
        } else if (object.type == "回転モディファイア") {
            scrollableDiv.append(nameInputTag, parentSelectTag, BBoxMinDivTag, BBoxMaxDivTag, centerPositionDivTag);
        }
    }
}