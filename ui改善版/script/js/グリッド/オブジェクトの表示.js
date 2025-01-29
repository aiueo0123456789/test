import { hierarchy } from '../ヒエラルキー.js';
import { stateMachine } from '../main.js';

export function displayObjects(targetTag, isInit = false, filtering) {
    targetTag.innerHTML = "";

    const scrollableDiv = document.createElement("div");
    scrollableDiv.className = "scrollable";

    let offset = 0;
    for (const objects of [hierarchy.graphicMeshs, hierarchy.modifiers]) {
        for (const keyName in objects) {
            const object = objects[keyName];
            const type = object.type;
            if (type == filtering || filtering == "すべて") {
                const tagsGrou = document.createElement("div");
                tagsGrou.className = "hierarchy";
                if (stateMachine.state.data.object == object) {
                    tagsGrou.style.backgroundColor = `rgb(70,70,170)`;
                } else {
                    tagsGrou.style.backgroundColor = `rgb(0,0,0,${offset % 2 / 10})`;
                }
                const nameInputTag = document.createElement("input");
                nameInputTag.type = "text";
                nameInputTag.value = object.name;
                nameInputTag.setAttribute('readonly', true);

                const zIindexInputTag = document.createElement("input");
                zIindexInputTag.className = "hierarchy-zIndex";
                zIindexInputTag.type = "number";
                zIindexInputTag.min = 0;
                zIindexInputTag.max = 1000;
                zIindexInputTag.step = 1;
                zIindexInputTag.value = object.zIndex;
        
                const typeImgTag = document.createElement("img");
                if (type == "グラフィックメッシュ") {
                    typeImgTag.src = "config/画像データ/グラフィックメッシュ.png";
                } else if (type == "モディファイア") {
                    typeImgTag.src = "config/画像データ/ベジェモディファイア.png";
                } else if (type == "ベジェモディファイア") {
                    typeImgTag.src = "config/画像データ/ベジェモディファイア.png";
                } else if (type == "回転モディファイア") {
                    typeImgTag.src = "config/画像データ/ベジェモディファイア.png";
                }
        
                const depthAndNameDiv = document.createElement("div");
                depthAndNameDiv.className = "hierarchy-name";
                depthAndNameDiv.append(nameInputTag, typeImgTag);
        
                tagsGrou.append(depthAndNameDiv, zIindexInputTag);
                scrollableDiv.append(tagsGrou);
        
                tagsGrou.addEventListener('click', () => {
                    stateMachine.externalInputs["ヒエラルキーのオブジェクト選択"] = object;
                });
        
                nameInputTag.addEventListener('click', (event) => {
                    event.stopPropagation(); // クリックイベントのバブリングを停止
                });
        
                // ダブルクリック時に編集可能にする
                nameInputTag.addEventListener('dblclick', () => {
                    nameInputTag.removeAttribute('readonly'); // 編集可能にする
                    nameInputTag.focus(); // フォーカスを設定
                });
        
                // フォーカスが外れたら編集不可に戻す
                nameInputTag.addEventListener('blur', () => {
                    hierarchy.changeObjectName(object, nameInputTag.value);
                    nameInputTag.setAttribute('readonly', true); // 編集不可に戻す
                });
        
                zIindexInputTag.addEventListener('click', (event) => {
                    event.stopPropagation(); // クリックイベントのバブリングを停止
                });
        
                zIindexInputTag.addEventListener('input', () => {
                    object.zIndex = Number(zIindexInputTag.value);
                });
        
                offset ++;
            }
        }
    }

    targetTag.append(scrollableDiv)

    if (isInit) {

    }
}