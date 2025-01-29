import { updateForMenu,createMenuObjectsFromStruct } from "./menu.js";
import { hierarchy } from "../ヒエラルキー.js";
import { stateMachine } from '../main.js';

function deleteA() {
    console.log("アニメーションの削除")
}

function deleteObject() {
    hierarchy.deleteObject(stateMachine.state.data.object);
    stateMachine.externalInputs["ヒエラルキーのオブジェクト選択"] = "選択解除";
}

function addAnimationManager() {
    hierarchy.addEmptyObject("アニメーションマネージャー");
}

function addGraphicMesh() {
    hierarchy.addEmptyObject("グラフィックメッシュ");
}

function addModifier() {
    hierarchy.addEmptyObject("モディファイア");
}

function addLineModifier() {
    hierarchy.addEmptyObject("ベジェモディファイア");
}

function addRotateModifier() {
    hierarchy.addEmptyObject("回転モディファイア");
}

function addAnimation() {
    hierarchy.addAnimationToObject(stateMachine.state.data.object,"名称未設定");
}

class Contextmenu {
    constructor(struct) {
        this.struct = struct;
        this.menuObjects = createMenuObjectsFromStruct(struct);
    }
}

const data = {
    "グリッド": new Contextmenu(
        {id: "グリッド", children:
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
    ),
    "ヒエラルキー": new Contextmenu(
        {id: "ヒエラルキー", children:
            [
                {id: "オブジェクトの追加", children: [
                    {id: "グラフィックメッシュ", children: [], targetFn: addGraphicMesh},
                    {id: "モディファイア", children: [], targetFn: addModifier},
                    {id: "ベジェモディファイア", children: [], targetFn: addLineModifier},
                    {id: "回転モディファイア", children: [], targetFn: addRotateModifier},
                ], targetFn: null},
                {id: "オブジェクトの削除", children: [], targetFn: deleteObject},
            ], targetFn: null
        }
    ),
    "オブジェクト": new Contextmenu(
        {id: "オブジェクト", children:
            [
                {id: "オブジェクトの追加", children: [
                    {id: "グラフィックメッシュ", children: [], targetFn: addGraphicMesh},
                    {id: "モディファイア", children: [], targetFn: addModifier},
                    {id: "ベジェモディファイア", children: [], targetFn: addLineModifier},
                    {id: "回転モディファイア", children: [], targetFn: addRotateModifier},
                ], targetFn: null},
                {id: "オブジェクトの削除", children: [], targetFn: deleteObject},
            ], targetFn: null
        }
    ),
    "アニメーション": new Contextmenu(
        {id: "アニメーション", children:
            [
                {id: "アニメーション追加", children: [], targetFn: addAnimation},
                {id: "アニメーション削除", children: [], targetFn: deleteA},
                {id: "アニメーション", children: [], targetFn: null},
            ], targetFn: null
        }
    ),
    "アニメーションマネージャー": new Contextmenu(
        {id: "アニメーションマネージャー", children:
            [
                {id: "マネージャー追加", children: [], targetFn: addAnimationManager},
                {id: "マネージャー削除", children: [], targetFn: deleteA},
            ], targetFn: null
        }
    ),
};

export function updateForContextmenu(type,position) {
    document.getElementById("contextmenu-container").innerHTML = "";
    if (data[type]) {
        updateForMenu("contextmenu-container", data[type].menuObjects[0]);
    }
    contextmenuContainer.style.top = `${position[1]}px`;
    contextmenuContainer.style.left = `${position[0]}px`;
}

const contextmenuContainer = document.getElementById("contextmenu-container");