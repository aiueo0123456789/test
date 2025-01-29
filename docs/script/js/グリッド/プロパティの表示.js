import { render } from "../main.js";

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

export function displayProperty(scrollableDiv, isInit) {
    if (isInit) {
    }
    scrollableDiv.innerHTML = "";

    scrollableDiv.className = "scrollable";
    const tagsGrou = document.createElement("div");

    const backgroundColorInput = document.createElement("input");
    backgroundColorInput.type = "color";

    backgroundColorInput.addEventListener("change", () => {
        render.backgroundColor = hexToRgba(backgroundColorInput.value, 1);
    });

    const maskTextures = document.createElement("div");
    maskTextures.className = "scrollable";
    maskTextures.style.height = "200px";
    for (const textureData of render.maskTextures) {
        const nameInputTag = document.createElement("input");
        nameInputTag.type = "text";
        nameInputTag.value = textureData.name;

        nameInputTag.addEventListener("change", () => {
            textureData.name = nameInputTag.value;
        })
        maskTextures.append(nameInputTag);
    }
    const addMaskTextureBtn = document.createElement("button");
    addMaskTextureBtn.textContent = "マスクテクスチャを追加";
    addMaskTextureBtn.addEventListener("click", () => {
        render.addMaskTexture("名称未設定");
    });
    tagsGrou.append(backgroundColorInput, addMaskTextureBtn, maskTextures);
    scrollableDiv.append(tagsGrou);
}