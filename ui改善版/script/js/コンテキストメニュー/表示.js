import { createMenuObject, update } from "./menu.js";

function deleteA() {
    console.log("アニメーションの削除")
}

class Contextmenu {
    constructor(struct) {
        this.struct = struct;

        createMenuObject(null,this.struct);
        update("contextmenu-container");
    }
}

document.getElementById("contextmenu-container").innerHTML = "";
const test = new Contextmenu(
    {id: "テスト", children:
        [
            {id: "オブジェクト", children: [
                {id: "グラフィックメッシュ", children: [], targetFn: null},
                {id: "モディファイア", children: [], targetFn: null},
            ], targetFn: null},
            {id: "アニメーション追加", children: [], targetFn: null},
            {id: "アニメーション削除", children: [], targetFn: deleteA},
            {id: "アニメーション", children: [], targetFn: null},
        ], targetFn: null
    }
);

const contextmenuContainer = document.getElementById("contextmenu-container");


document.addEventListener('contextmenu', (e) => {
    e.preventDefault();
    update("contextmenu-container");
    console.log(e.screenX,e.screenY)
    console.log(e.clientX,e.clientY)
    contextmenuContainer.style.top = `${e.clientY}px`;
    contextmenuContainer.style.left = `${e.clientX}px`;
});

// キーのダウンを検知
window.addEventListener('keydown',function(event) {
    console.log(document.getElementById("contextmenu-container").innerHTML);
    if (event.key == "r") {
        document.getElementById("contextmenu-container").innerHTML = "";
    }
    if (event.key == "a") {
    }
});