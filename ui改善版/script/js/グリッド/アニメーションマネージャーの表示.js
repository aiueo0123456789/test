import { hierarchy } from "../ヒエラルキー.js";

export function displayAnimationManager(scrollableDiv, isInit) {
    if (isInit) {
        scrollableDiv.replaceChildren();
    }

    scrollableDiv.className = "scrollable";

    for (const animationManager of hierarchy.animationManagers) {
        const tagsGrou = document.createElement("div");
        tagsGrou.className = "flexBox";
        const nameInputTag = document.createElement("input");
        nameInputTag.style.width = "150px";
        nameInputTag.type = "text";
        nameInputTag.value = animationManager.name;
        const weightSliderInputTag = document.createElement("input");
        weightSliderInputTag.style.width = "100%";
        weightSliderInputTag.type = "range";
        weightSliderInputTag.max = 1;
        weightSliderInputTag.min = 0;
        weightSliderInputTag.step = 0.00001;
        weightSliderInputTag.value = animationManager.weight;
        const weightInputTag = document.createElement("input");
        weightInputTag.style.width = "60px";
        weightInputTag.type = "input";
        weightInputTag.max = 1;
        weightInputTag.min = 0;
        weightInputTag.step = 0.00001;
        weightInputTag.value = animationManager.weight;
        // スライダーのイベントリスナーを追加
        weightSliderInputTag.addEventListener('input', () => {
            animationManager.weight = Number(weightSliderInputTag.value);
            weightInputTag.value = Number(weightSliderInputTag.value);
        });

        const containedAnimationsDiv = document.createElement("div");
        containedAnimationsDiv.className = "scrollable";
        containedAnimationsDiv.style.height = "200px";
        for (const animation of animationManager.containedAnimations) {
            const nameTag = document.createElement("p");
            nameTag.textContent = animation.name;
            containedAnimationsDiv.append(nameTag);
        }
        tagsGrou.append(nameInputTag, weightSliderInputTag, weightInputTag);
        scrollableDiv.append(tagsGrou, containedAnimationsDiv);
    }
}