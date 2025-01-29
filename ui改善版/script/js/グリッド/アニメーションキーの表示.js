import { stateMachine } from '../main.js';
import { hierarchy } from '../ヒエラルキー.js';
import { updateDataForUI } from "./制御.js";

function select(a,b,bool) {
    return bool ? a : b;
}

export function displayAnimationKey(scrollableDiv, isInit) {
    if (isInit) {
        scrollableDiv.replaceChildren();
    }

    scrollableDiv.className = "scrollable";

    let offset = 0;
    const updateOrCreateNode = (animation, index) => {
        const existingNode = scrollableDiv.children[index];

        // 既存ノードを探す
        let tagsGrouId = "hierarchy:animeiton" + animation.name + animation.type + select("true", "false", stateMachine.state.data.animation == animation);

        if (existingNode && existingNode.id === tagsGrouId) {
            // ノードが存在し、IDが一致する場合は更新のみ
            existingNode.style.backgroundColor = select(`rgb(70,70,170)`, `rgb(0,0,0,${index % 2 / 10})`, stateMachine.state.data.animation == animation);
            // 必要なら名称や zIndex の更新
            const nameInputTag = existingNode.querySelector("input[type=text]");
            if (nameInputTag.value !== animation.name) {
                nameInputTag.value = animation.name;
            }
        } else {
            // ノードが存在しない場合は新規作成
            const tagsGrou = document.createElement("div");
            tagsGrou.className = "flexBox";
            tagsGrou.style.backgroundColor = select(`rgb(70,70,170)`, `rgb(0,0,0,${index % 2 / 10})`, stateMachine.state.data.animation == animation);
            const nameInputTag = document.createElement("input");
            nameInputTag.style.width = "150px";
            nameInputTag.type = "text";
            nameInputTag.value = animation.name;
            const weightSliderInputTag = document.createElement("input");
            weightSliderInputTag.style.width = "100%";
            weightSliderInputTag.type = "range";
            weightSliderInputTag.max = 1;
            weightSliderInputTag.min = 0;
            weightSliderInputTag.step = 0.00001;
            weightSliderInputTag.value = animation.weight;
            const weightInputTag = document.createElement("input");
            weightInputTag.style.width = "60px";
            weightInputTag.type = "input";
            weightInputTag.max = 1;
            weightInputTag.min = 0;
            weightInputTag.step = 0.00001;
            weightInputTag.value = animation.weight;

            const managerSelectTag = document.createElement("select");
            if (true) {
                const sleectElement = document.createElement('option'); // h1要素に配列の要素を設定
                sleectElement.value = ""; // h1要素に配列の要素を設定
                sleectElement.textContent = "なし"; // h1要素に配列の要素を設定
                if (!animation.belongAnimationManager) {
                    sleectElement.selected = true;
                }
                managerSelectTag.append(sleectElement);
            }
            hierarchy.animationManagers.forEach(manager => {
                const sleectElement = document.createElement('option'); // h1要素に配列の要素を設定
                sleectElement.value = `${manager.name}`; // h1要素に配列の要素を設定
                sleectElement.textContent = `${manager.name}`; // h1要素に配列の要素を設定
                if (animation.belongAnimationManager == manager) {
                    sleectElement.selected = true;
                }
                managerSelectTag.append(sleectElement);
            })

            // スライダーのイベントリスナーを追加
            weightSliderInputTag.addEventListener('input', () => {
                animation.weight = Number(weightSliderInputTag.value);
                weightInputTag.value = Number(weightSliderInputTag.value);
            });
            weightSliderInputTag.addEventListener('click', (event) => {
                event.stopPropagation();
            })
            tagsGrou.addEventListener('click', () => {
                // manager.setActiveAnimation(animation);
                stateMachine.externalInputs["オブジェクトのアニメーションキー選択"] = animation;
            })
            nameInputTag.addEventListener('change', () => {
                animation.name = nameInputTag.value;
                updateDataForUI["アニメーション"] = animation;
            })
            nameInputTag.addEventListener('click', (event) => {
                event.stopPropagation();
            })
            managerSelectTag.addEventListener('click', (event) => {
                event.stopPropagation();
            })
            managerSelectTag.addEventListener('change', () => {
                if (managerSelectTag.value == "") {
                    hierarchy.deleteAnimationManagerLink(animation);
                } else {
                    hierarchy.setAnimationManagerLink(hierarchy.searchObjectFromName(managerSelectTag.value, "アニメーションマネージャー"),animation);
                }
            })

            tagsGrou.append(nameInputTag, weightSliderInputTag, weightInputTag, managerSelectTag);

            // 新しいノードを挿入
            const referenceNode = scrollableDiv.children[index];
            scrollableDiv.insertBefore(tagsGrou, referenceNode || null);
        }
    };

    if (stateMachine.state.data.object) {
        console.log("更新",stateMachine.state.data.object)
        const animationKey = stateMachine.state.data.object.GPUAnimationDatas;
        for (const animation of animationKey) {
            updateOrCreateNode(animation, offset)
            offset ++;
        }
    }

    // 余分なノードを削除
    while (scrollableDiv.children.length > offset) {
        scrollableDiv.lastChild.remove();
    }
}