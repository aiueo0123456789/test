import {createStorageBuffer, createGroup, getU32BufferData} from './createWebgpuData.js';
import {vecAdd, vecScale, vecNormalize, vecSubNormalize, distance, vecCross3, vecScale2, vecSub, BBox, vecIsSame, vecDot, vecAverage} from './vectorMath.js';

export class CreateMeshFromTexture {
    constructor(device, groupLayout, pipeline) {
        this.device = device;
        this.groupLayout = groupLayout;
        this.pipeline = pipeline;

        this.worker = new Worker('script/js/delaunayThreaded.js');
    }

    async createMeshFromTexture(texture, imageSize, validImageSize, fineness) {
        const imageBufferSize = vecAdd(imageSize, [1,1]);
        // ドロネー三角形分割
        function delaunay(edge, scale) {
            // ドロネー三角形分割でつかうローカル関数
            // 線分ABと線分CDが交差するかどうかを判定
            function isIntersecting(A, B, C, D) {
                // 向きを計算
                const abCrossCd = vecCross3(A, B, C) * vecCross3(A, B, D);
                const cdCrossAb = vecCross3(C, D, A) * vecCross3(C, D, B);
    
                // 両方の線分が他方の線分を囲んでいる場合、交差している
                if (abCrossCd < 0 && cdCrossAb < 0) {
                    return true;
                }
    
                // 線分が端点で接している場合（共線の場合）
                // A, BとCが同一線上にあり、C, DとBが同一線上にあるとき
                if (abCrossCd === 0 && isOnSegment(A, B, C)) return true;
                if (cdCrossAb === 0 && isOnSegment(C, D, A)) return true;
    
                return false;
            }
    
            // 線分の端点が線分上にあるか判定
            function isOnSegment(A, B, C) {
                return (Math.min(A[0], B[0]) <= C[0] && C[0] <= Math.max(A[0], B[0]) &&
                        Math.min(A[1], B[1]) <= C[1] && C[1] <= Math.max(A[1], B[1]));
            }
    
            // 点がポリゴン内にあるかを判定する関数
            function isPointInsidePolygon(point, polygon) {
                let vecCross3ings = 0;
                const x = point[0];
                const y = point[1];
    
                // ポリゴンの頂点を順番に処理
                let lastPos = polygon[polygon.length - 1];
                for (let i = 0; i < polygon.length; i++) {
                    const p1 = polygon[i];

                    // 点が辺の水平線と交差するかチェック
                    if (y >= Math.min(p1[1], lastPos[1]) && y <= Math.max(p1[1], lastPos[1])) {
                        // 交差する線分がある場合
                        const xIntersect = (y - p1[1]) * (lastPos[0] - p1[0]) / (lastPos[1] - p1[1]) + p1[0];
                        // const xIntersect = (p1[0] - lastPos[0]) / (p1[1] - lastPos[1]) * (y - lastPos[1]) + lastPos[0];
    
                        // 点が交差線より左にある場合に交差カウント
                        if (xIntersect > x) {
                            vecCross3ings++;
                        }
                    }

                    lastPos = p1;
                }
    
                // 交差回数が奇数なら内部、偶数なら外部
                return vecCross3ings % 2 === 1;
            }
    
            function areArraysEqual(arr1, arr2) {
                // 長さが異なる場合は false を返す
                if (arr1.length !== arr2.length) return false;
    
                // 配列をソートして要素を比較
                const sortedArr1 = [...arr1].sort();
                const sortedArr2 = [...arr2].sort();
    
                return sortedArr1.every((value, index) => value === sortedArr2[index]);
            }
    
            function getTriangleCenterPoint(p1,p2,p3) {
                const c = 2 * ((p2[0] - p1[0]) * (p3[1] - p1[1]) - (p2[1] - p1[1]) * (p3[0] - p1[0]));
    
                const a = (p2[0] * p2[0] - p1[0] * p1[0] + p2[1] * p2[1] - p1[1] * p1[1]);
                const b = (p3[0] * p3[0] - p1[0] * p1[0] + p3[1] * p3[1] - p1[1] * p1[1]);
                return [
                    ((p3[1] - p1[1]) * a + (p1[1] - p2[1]) * b) / c,
                    ((p1[0] - p3[0]) * a + (p2[0] - p1[0]) * b) / c
                ];
            }
    
            function uniqueEdgeSet(stack, edge) {
                // エッジをソートしてセットとして扱う
                const sortedEdge = edge[0] < edge[1] ? edge : [edge[1], edge[0]];
                for (const e of stack) {
                    if (e[0] === sortedEdge[0] && e[1] === sortedEdge[1]) {
                        return ; // 重複するエッジが存在する
                    }
                }
                stack.push(sortedEdge); // エッジが存在しない場合のみ追加
                return ;
            }

            function isLineConstraint(index1,index2) {
                return index1 < edge.length && index2 < edge.length && index1 + 1 == index2;
            }

            function isSquareConvex(p1,p2,p3,p4) {
                // 四角形の各点で外積を計算
                const cross1 = vecCross3(p1, p2, p3);
                const cross2 = vecCross3(p2, p3, p4);
                const cross3 = vecCross3(p3, p4, p1);
                const cross4 = vecCross3(p4, p1, p2);

                // すべての外積の符号が同じかを確認
                const allPositive = cross1 > 0 && cross2 > 0 && cross3 > 0 && cross4 > 0;
                const allNegative = cross1 < 0 && cross2 < 0 && cross3 < 0 && cross4 < 0;

                return allPositive || allNegative;
            }
    
            const verticesData = [];
            if (true) {
                let lastVec = vecSubNormalize(edge[edge.length - 1], edge[0]);
                lastVec = [-lastVec[1], lastVec[0]];
                let lastPos = edge[edge.length - 1];
                for (let i = 0; i < edge.length; i ++) {
                    const pos = edge[i];;
                    let vec = vecSubNormalize(lastPos, pos);
                    vec = [-vec[1], vec[0]];
                    const newPos = vecAdd(pos, vecScale(vecNormalize(vecAdd(vec,lastVec)), scale));
                    verticesData.push(newPos);
                    if (Number.isNaN(newPos[0]) && Number.isNaN(newPos[1])) {
                        console.error(pos, lastPos, rot, vec, lastVec, "NaNになった")
                    }
                    lastPos = pos;
                    lastVec = vec;
                }
            }
    
            const boundingBox = BBox(edge);
            let offset = 0;
            for (let y = boundingBox.min[1]; y < boundingBox.max[1]; y += fineness[0]) {
                offset ++;
                for (let x = boundingBox.min[0]; x < boundingBox.max[0]; x += fineness[1]) {
                    const pos = [x + offset % 2 * fineness[0] / 2,y];
                    if (isPointInsidePolygon(pos, edge)) {
                        verticesData.push(pos);
                    }
                }
            }
    
            // ドロネー三角形分割のメイン処理
            const vertices = [[-100000,-100000],[0,100000],[100000,-10000]].concat(verticesData);
            const mesh = [[0,1,2]];
    
            // メイン
            for (let i = 3; i < vertices.length; i ++) {
                let stack = [];
                for (let j = mesh.length - 1; j >= 0; j --) {
                    const i1 = mesh[j][0];
                    const i2 = mesh[j][1];
                    const i3 = mesh[j][2];
                    const center = getTriangleCenterPoint(vertices[i1],vertices[i2],vertices[i3]);
    
                    const circleRadius = distance(center, vertices[i1]);
    
                    if (distance(center, vertices[i]) < circleRadius) {
                        uniqueEdgeSet(stack, [i1, i2]);
                        uniqueEdgeSet(stack, [i2, i3]);
                        uniqueEdgeSet(stack, [i3, i1]);
                        mesh.splice(j,1);
                        mesh.push([i1,i2,i]);
                        mesh.push([i2,i3,i]);
                        mesh.push([i3,i1,i]);
                    }
                }
                while (stack.length != 0) {
                    const edge = stack.pop();
    
                    const targetTriangles = [];
                    const getIndex = [];
    
                    for (let k = 0; k < mesh.length; k ++) {
                        if (mesh[k].includes(edge[0]) && mesh[k].includes(edge[1])) {
                            targetTriangles.push(mesh[k]);
                            getIndex.push(k);
                        }
                    }
    
                    if (targetTriangles.length < 2) {
                        continue;
                    }
    
                    if (areArraysEqual(targetTriangles[0],targetTriangles[1])) {
                        mesh.splice(getIndex[1],1);
                        mesh.splice(getIndex[0],1);
                        continue;
                    }
    
                    const c = targetTriangles[0].filter(value => !edge.includes(value));
                    const d = targetTriangles[1].filter(value => !edge.includes(value));
    
                    const center = getTriangleCenterPoint(vertices[edge[0]],vertices[edge[1]],vertices[c]);
    
                    const circleRadius = distance(center, vertices[edge[0]]);
    
                    if (isLineConstraint(edge[0],edge[1])) { // ABが線分制約
                    } else if (isLineConstraint(c,d) && isSquareConvex(vertices[edge[0]],vertices[edge[1]],vertices[c],vertices[d])) { // cdが線分制約であり四角形ABCDが凸
                        mesh.splice(getIndex[1],1);
                        mesh.splice(getIndex[0],1);
    
                        mesh.push([edge[0],c,d]);
                        mesh.push([edge[1],c,d]);
    
                        uniqueEdgeSet(stack, [edge[0], d]);
                        uniqueEdgeSet(stack, [d, edge[1]]);
                        uniqueEdgeSet(stack, [edge[1], c]);
                        uniqueEdgeSet(stack, [c, edge[0]]);
                        // uniqueEdgeSet(stack, [c, d]);
                    } else if (distance(center, vertices[d]) < circleRadius) {
                        mesh.splice(getIndex[1],1);
                        mesh.splice(getIndex[0],1);
    
                        mesh.push([edge[0],c,d]);
                        mesh.push([edge[1],c,d]);
    
                        uniqueEdgeSet(stack, [edge[0], d]);
                        uniqueEdgeSet(stack, [d, edge[1]]);
                        uniqueEdgeSet(stack, [edge[1], c]);
                        uniqueEdgeSet(stack, [c, edge[0]]);
                    }
                }
            }
    
            // [[-10000,-10000],[0,10000],[10000,-10000]]のさくじょ
            vertices.splice(0,1);
            vertices.splice(0,1);
            vertices.splice(0,1);
    
            // [[-10000,-10000],[0,10000],[10000,-10000]]を消した分のindexの調整
            for (let i = mesh.length - 1; i >= 0; i --) {
                mesh[i][0] -= 3;
                mesh[i][1] -= 3;
                mesh[i][2] -= 3;
                mesh[i] = mesh[i].sort(function(first, second){
                    return first - second;
                });
                if (mesh[i][0] < 0 || mesh[i][1] < 0 || mesh[i][2] < 0) {
                    mesh.splice(i,1);
                }
            }

            const aaaa = (indexs) => {
                const p0 = vertices[indexs[0]];
                const p1 = vertices[indexs[1]];
                const p2 = vertices[indexs[2]];
                const point = vecScale(vecAdd(p0, vecAdd(p1, p2)), 1 / 3);
                if (!isPointInsidePolygon(point, edge)) {
                    return true;
                }
                // if (isLineConstraint(indexs[0], indexs[1])) {
                //     let vec1 = vecSubNormalize(p0, p1);
                //     vec1 = [-vec1[1], vec1[0]];
                //     let vec2 = vecSubNormalize(vecAverage(p0, p1), p2);
                //     if (vecDot(vec1, vec2) > 0) {
                //         return true;
                //     }
                // }
                // if (isLineConstraint(indexs[1], indexs[2])) {
                //     let vec1 = vecSubNormalize(p1, p2);
                //     vec1 = [-vec1[1], vec1[0]];
                //     let vec2 = vecSubNormalize(vecAverage(p1, p2), p0);
                //     if (vecDot(vec1, vec2) > 0) {
                //         return true;
                //     }
                // }
                return false;
            }

            // 不要な面の削除
            for (let i = mesh.length - 1; i >= 0; i --) {
                const result = aaaa(mesh[i]);
                if (result) {
                    mesh.splice(i, 1);
                }
            }
    
            return [vertices.map(x => {
                const validPosition = vecScale2(vecScale2(x, [1 / imageSize[0], 1 / imageSize[1]]), validImageSize);
                return vecSub([validPosition[0], validImageSize[1] - validPosition[1]], vecScale(validImageSize, 0.5));
            }), vertices.map(x => {
                const a = vecScale2(x, [1 / imageSize[0], 1 / imageSize[1]]);
                return [a[0], a[1]];
            }), mesh];
        }
    
        function simplifyPolygon(points, epsilon, minInterval = 10) {
            // 始点と終点が同じ場合、終点を削除
            if (points[0][0] === points[points.length - 1][0] &&
                points[0][1] === points[points.length - 1][1]) {
                points.pop();
            }
        
            const dmax = points.reduce((max, p, i) => {
                if (i === 0 || i === points.length - 1) return max; // スキップ
        
                // 距離を計算
                const d = pointToLineDistance(p, points[0], points[points.length - 1]);
        
                // 最大距離を更新
                return Math.max(max, d);
            }, 0);
        
            if (dmax > epsilon) {
                // 最大距離の点を特定
                const index = points.findIndex((p, i) => {
                    if (i === 0 || i === points.length - 1) return false; // スキップ
                    return pointToLineDistance(p, points[0], points[points.length - 1]) === dmax;
                });
        
                // 再帰的に分割
                const firstHalf = simplifyPolygon(points.slice(0, index + 1), epsilon, minInterval);
                const secondHalf = simplifyPolygon(points.slice(index), epsilon, minInterval);
        
                // 結果を結合して返す
                return firstHalf.slice(0, -1).concat(secondHalf);
            } else {
                // 始点と終点をそのまま返す
                const simplified = [points[0], points[points.length - 1]];
        
                // 最小間隔を保つためにフィルタリング
                return filterByInterval(points, simplified, minInterval);
            }
        }
        
        function pointToLineDistance(point, lineStart, lineEnd) {
            const [x, y] = point;
            const [x1, y1] = lineStart;
            const [x2, y2] = lineEnd;
        
            // 始点と終点が同じ場合は距離を 0 にする
            if (x1 === x2 && y1 === y2) {
                console.warn("Line start and end points are identical:", lineStart, lineEnd);
                return 0;
            }
        
            const num = Math.abs((y2 - y1) * x - (x2 - x1) * y + x2 * y1 - y2 * x1);
            const den = Math.sqrt((y2 - y1) ** 2 + (x2 - x1) ** 2);
            return num / den;
        }
        
        function filterByInterval(originalPoints, simplifiedPoints, minInterval) {
            const result = [simplifiedPoints[0]];
        
            for (let i = 1; i < originalPoints.length; i++) {
                const [x1, y1] = result[result.length - 1];
                const [x2, y2] = originalPoints[i];
        
                const distance = Math.sqrt((x2 - x1) ** 2 + (y2 - y1) ** 2);
                if (distance >= minInterval) {
                    result.push([x2, y2]);
                }
            }
        
            // 終点を追加
            const lastPoint = simplifiedPoints[simplifiedPoints.length - 1];
            if (!vecIsSame(result[result.length - 1],lastPoint)) {
                result.push(lastPoint);
            }
        
            return result;
        }
        
        // 並び替え
        function connectLines(lines) {
            const connectedLines = [];
        
            while (lines.length != 0) {
                // まだ処理されていない線分を探す
                const currentChain = [];
                let currentLine = lines[0];
                lines.splice(0, 1);
        
                // 連続する線分をつなげる
                currentChain.push(currentLine[0]);
                currentChain.push(currentLine[1]);

                let lastPosition = currentLine[1];
        
                // 前方向につなげる
                while (true) {
                    let isFind = true;
                    for (let i = 0; i < lines.length; i ++) {
                        const line = lines[i];
                        if (isPointsEqual(line[0], lastPosition)) {
                            currentChain.push(line[1]);
                            lastPosition = line[1];
                            lines.splice(i, 1);
                            isFind = false;
                            break ;
                        } else if (isPointsEqual(line[1], lastPosition)) {
                            currentChain.push(line[0]);
                            lastPosition = line[0];
                            lines.splice(i, 1);
                            isFind = false;
                            break ;
                        }
                    }
                    if (isFind) break; // 次が見つからなければ終了
                }

                // 後方向につなげる
                lastPosition = currentChain[0];
                while (true) {
                    let isFind = true;
                    for (let i = 0; i < lines.length; i ++) {
                        const line = lines[i];
                        if (isPointsEqual(line[0], lastPosition)) {
                            currentChain.unshift(line[1]);
                            lastPosition = line[1];
                            lines.splice(i, 1);
                            isFind = false;
                            break ;
                        } else if (isPointsEqual(line[1], lastPosition)) {
                            currentChain.unshift(line[0]);
                            lastPosition = line[0];
                            lines.splice(i, 1);
                            isFind = false;
                            break ;
                        }
                    }
                    if (isFind) break; // 次が見つからなければ終了
                }

                connectedLines.push(currentChain);
            }

            return connectedLines;
        }

        function isPointsEqual(p1, p2) {
            if (p1[0] != p2[0]) {
                return false;
            }
            if (p1[1] != p2[1]) {
                return false;
            }
            return true;
        }

        const resultbuffer = createStorageBuffer(this.device, imageBufferSize[0] * imageBufferSize[1] * 4, undefined, ["u32"]);

        const group = createGroup(this.device, this.groupLayout, [{item: resultbuffer, type: "b"}, {item: texture.createView(), type: "t"}]);
        const computeCommandEncoder = this.device.createCommandEncoder();
        const computePassEncoder = computeCommandEncoder.beginComputePass();
        computePassEncoder.setBindGroup(0, group);
        computePassEncoder.setPipeline(this.pipeline);
        computePassEncoder.dispatchWorkgroups(Math.ceil(imageBufferSize[0] / 16), Math.ceil(imageBufferSize[1] / 16), 1); // ワークグループ数をディスパッチ
        computePassEncoder.end();
        this.device.queue.submit([computeCommandEncoder.finish()]);

        const result = await getU32BufferData(this.device, resultbuffer, resultbuffer.size);

        let collectedLines = [];

        const threadIsComplete = [];

        const threadProcessingNum = 50000;
        for (let i = 0; i < result.length; i += threadProcessingNum) {
            threadIsComplete.push(false);
            this.worker.postMessage({result: result.slice(i, i + threadProcessingNum), imageBufferSize: imageBufferSize, threadedIndex: i / threadProcessingNum, startIndex: i, endIndex: i + threadProcessingNum});
        }

        this.worker.onmessage = function(event) {
            const e = event.data;
            collectedLines = collectedLines.concat(e.collectedLines); // 65ミリ秒
            threadIsComplete[e.threadedIndex] = true;
        };

        async function checkThreadIsComplete() {
            return new Promise((resolve) => {
                function loop() {
                    if (threadIsComplete.some(x => x === false)) {
                        requestAnimationFrame(loop); // 再帰的に呼び出す
                    } else {
                        resolve(); // すべての要素がtrueになったらPromiseを解決
                    }
                }
                loop(); // 初回呼び出し
            });
        }

        await checkThreadIsComplete();

        collectedLines = connectLines(collectedLines); // 辺のデータを修正

        collectedLines = collectedLines.map(x => {
            return simplifyPolygon(x, 1.5, 20);
        });

        const resultData = [[],[],[]];
        let verticesNumOffset = 0;
        for (const data of collectedLines) {
            if (data.length < 3) break;
            const delaunayResult = delaunay(data, 10);
            resultData[0].push(...delaunayResult[0]);
            resultData[1].push(...delaunayResult[1]);
            resultData[2].push(...delaunayResult[2].map(x => {
                return [x[0] + verticesNumOffset, x[1] + verticesNumOffset, x[2] + verticesNumOffset];
            }));
            verticesNumOffset += delaunayResult[0].length;
        }
        return resultData;
    }
}