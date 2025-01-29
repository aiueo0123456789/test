import { searchAnimation } from "./オブジェクトで共通の処理.js";
import { hierarchy } from "./ヒエラルキー.js";

export class AnimationManager {
    constructor(name) {
        this.type = "アニメーションマネージャー";
        this.name = name;
        this.weight = 0;
        this.containedAnimations = [];
    }

    // gc対象にしてメモリ解放
    destroy() {
        this.name = null;
        this.weight = null;
        this.containedAnimations = null;
    }

    update() {
        for (const animation of this.containedAnimations) {
            animation.weight = this.weight;
        }
    }

    init(data) {
        for (const [name, type, animationName] of data.containedAnimations) {
            const object = hierarchy.searchObjectFromName(name, type);
            const animation = searchAnimation(object, animationName);
            this.containedAnimations.push(animation);
            animation.belongAnimationManager = this;
        }
    }

    getSaveData() {
        return {
            type: this.type,
            name: this.name,
            containedAnimations : this.containedAnimations.map(x => {
                return [x.belongObject.name, x.belongObject.type, x.name];
            }),
        };
    }
}
