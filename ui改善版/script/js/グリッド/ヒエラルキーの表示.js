import { hierarchy } from '../ヒエラルキー.js';
import { stateMachine } from '../main.js';

function select(a,b,bool) {
    return bool ? a : b;
}

export function displayHierarchy(scrollableDiv, isInit = false) {
    if (isInit) {
        scrollableDiv.replaceChildren();
    }

    scrollableDiv.className = "scrollable";

    let offset = 0;
    const updateOrCreateNode = (object, depth, index) => {
        const existingNode = scrollableDiv.children[index];

        // 既存ノードを探す
        let tagsGrouId = "hierarchy{depth:" + String(depth) + "name:" + object.name + object.type + select("true", "false", stateMachine.state.data.object == object) + select("true","false",object.isHide) +  "}";

        if (existingNode && existingNode.id === tagsGrouId) {
            // ノードが存在し、IDが一致する場合は更新のみ
            existingNode.style.backgroundColor = select(`rgb(70,70,170)`, `rgb(0,0,0,${index % 2 / 10})`, stateMachine.state.data.object == object);
            // 必要なら名称や zIndex の更新
            const nameInputTag = existingNode.querySelector("input[type=text]");
            if (nameInputTag.value !== object.name) {
                nameInputTag.value = object.name;
            }

            if (object.type == "グラフィックメッシュ") {
                const zIindexInputTag = existingNode.querySelector("input[type=number]");
                if (zIindexInputTag.value != object.zIndex) {
                    zIindexInputTag.value = object.zIndex;
                }

                const hideCheckTag = existingNode.querySelector("input[type=checkbox]");
                if (hideCheckTag.checked != object.isHide) {
                    hideCheckTag.hideCheckTag = object.isHide;
                }
            }
        } else {
            // ノードが存在しない場合は新規作成
            const tagsGrou = document.createElement("div");
            tagsGrou.className = "hierarchy";
            tagsGrou.id = tagsGrouId;
            tagsGrou.style.backgroundColor = select(`rgb(70,70,170)`, `rgb(0,0,0,${index % 2 / 10})`, stateMachine.state.data.object == object);

            const nameInputTag = document.createElement("input");
            nameInputTag.type = "text";
            nameInputTag.value = object.name;
            nameInputTag.setAttribute('readonly', true);

            const depthSpanTag = document.createElement("span");
            depthSpanTag.style.width = String(depth * 20) + "px";

            const typeImgTag = document.createElement("img");
            if (object.type === "グラフィックメッシュ") {
                typeImgTag.src = "config/画像データ/グラフィックメッシュ.png";
            } else if (object.type == "モディファイア") {
                typeImgTag.src = "config/画像データ/モディファイア.png";
            } else if (object.type == "ベジェモディファイア") {
                typeImgTag.src = "config/画像データ/ベジェモディファイア.png";
            } else if (object.type == "回転モディファイア") {
                typeImgTag.src = "config/画像データ/ベジェモディファイア.png";
            }

            const depthAndNameDiv = document.createElement("div");
            depthAndNameDiv.className = "hierarchy-name";
            depthAndNameDiv.append(depthSpanTag, nameInputTag, typeImgTag);

            if (object.type == "グラフィックメッシュ") {
                const zIindexInputTag = document.createElement("input");
                zIindexInputTag.className = "hierarchy-zIndex";
                zIindexInputTag.type = "number";
                zIindexInputTag.min = 0;
                zIindexInputTag.max = 1000;
                zIindexInputTag.step = 1;
                zIindexInputTag.value = object.zIndex;

                const hideCheckTag = document.createElement("input");
                hideCheckTag.className = "hierarchy-hide";
                hideCheckTag.type = "checkbox";
                hideCheckTag.checked = object.isHide;

                tagsGrou.append(depthAndNameDiv, zIindexInputTag, hideCheckTag);

                zIindexInputTag.addEventListener('change', () => {
                    object.zIndex = Number(zIindexInputTag.value);
                });

                hideCheckTag.addEventListener('change', () => {
                    object.isHide = hideCheckTag.checked;
                });
            } else {
                tagsGrou.append(depthAndNameDiv);
            }

            tagsGrou.addEventListener('click', () => {
                stateMachine.externalInputs["ヒエラルキーのオブジェクト選択"] = object;
            });

            nameInputTag.addEventListener('dblclick', () => {
                nameInputTag.removeAttribute('readonly');
                nameInputTag.focus();
            });

            nameInputTag.addEventListener('blur', () => {
                hierarchy.changeObjectName(object, nameInputTag.value);
                nameInputTag.setAttribute('readonly', true);
            });

            // 新しいノードを挿入
            const referenceNode = scrollableDiv.children[index];
            scrollableDiv.insertBefore(tagsGrou, referenceNode || null);
        }
    };

    const childrenRoop = (children, depth) => {
        children.forEach((object) => {
            updateOrCreateNode(object, depth, offset);
            offset++;
            if (Array.isArray(object.children?.objects)) {
                childrenRoop(object.children.objects, depth + 1);
            }
        });
    };

    childrenRoop(hierarchy.surface, 0);

    // 余分なノードを削除
    while (scrollableDiv.children.length > offset) {
        scrollableDiv.lastChild.remove();
    }
}