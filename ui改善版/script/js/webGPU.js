class WebGPU {
    constructor() {
    }

    // バッファの書き換え
    writeBuffer(target, data, offset = 0) {
        device.queue.writeBuffer(target, offset ,data);
    }

    // シェーダモデルの作成
    createShaderModule(code) {
        return device.createShaderModule({ code });
    }

    // ビットデータの作成
    createBitData(array, struct) {
        const bufferLength = array.length / struct.filter(x => x != "padding").length;
        const buffer = new ArrayBuffer(bufferLength * struct.length * 4);
        const view = new DataView(buffer);

        let offset = 0;
        let index = 0;
        for (let i = 0; i < bufferLength;i ++) {
            for (const bitType of struct) {
                if (bitType == "u32") {
                    view.setUint32(offset, array[index], true);
                    index ++;
                } else if (bitType == "f32") {
                    view.setFloat32(offset, array[index], true);
                    index ++;
                } else if (bitType == "padding") {
                    view.setFloat32(offset, 1, true);
                }
                offset += 4;
            }
        }

        return new Uint8Array(buffer);
    }

    // ユニフォームバッファの作成
    createUniformBuffer(size, data = undefined, struct = ["f32"]) {
        if (data) {
            const buffer = device.createBuffer({
                size: size,
                usage: GPUBufferUsage.UNIFORM,
                mappedAtCreation: true,
            });
            new Uint8Array(buffer.getMappedRange()).set(this.createBitData(data, struct));
            buffer.unmap();
            return buffer;
        } else {
            return device.createBuffer({
                size: size,
                usage: GPUBufferUsage.UNIFORM | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            });
        }
    }

    // ストレージバッファの作成
    createStorageBuffer(size, data = undefined, struct = ["f32"]) {
        if (data) {
            const buffer = device.createBuffer({
                size: size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_SRC | GPUBufferUsage.COPY_DST,
                mappedAtCreation: true,
            });
            new Uint8Array(buffer.getMappedRange()).set(this.createBitData(data, struct));
            buffer.unmap();
            return buffer;
        } else {
            return device.createBuffer({
                size: size,
                usage: GPUBufferUsage.STORAGE | GPUBufferUsage.COPY_DST | GPUBufferUsage.COPY_SRC,
            });
        }
    }

    // バーテックスバッファの作成
    createVertexBuffer(size, data = undefined, struct = ["f32"]) {
        if (data) {
            const buffer = device.createBuffer({
                size: size,
                usage: GPUBufferUsage.VERTEX | GPUBufferUsage.COPY_SRC,
                mappedAtCreation: true,
            });
            new Uint8Array(buffer.getMappedRange()).set(this.createBitData(data, struct));
            buffer.unmap();
            return buffer;
        } else {
            return device.createBuffer({
                size: size,
                usage: GPUBufferUsage.VERTEX,
            });
        }
    }

    createTextureSampler() {
        return device.createSampler({
            magFilter: 'linear',
            minFilter: 'linear',
            addressModeU: 'repeat',
            addressModeV: 'repeat',
        });
    }

    createDepthTexture2D(size) {
        return device.createTexture({
            size: size,
            format: 'depth32float',
            usage: GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    createTexture2D(size, textureFormat = format) {
        return device.createTexture({
            size: size,
            format: textureFormat,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_SRC | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });
    }

    createStorageTexture2D(size) {
        return device.createTexture({
            size: size,
            format: 'rgba8unorm',
            usage: GPUTextureUsage.STORAGE_BINDING | GPUTextureUsage.COPY_SRC,
        });
    }

    async imageToTexture2D(imagePath) {
        const image = new Image();
        const imagePromise = new Promise((resolve, reject) => {
            image.onload = () => resolve(image);
            image.onerror = (e) => reject(e);
        });
        image.src = imagePath;
        const img = await imagePromise;

        if (!(img instanceof HTMLImageElement)) {
            throw new TypeError('Loaded image is not an instance of HTMLImageElement.');
        }

        const reslutTexture = this.createTexture2D([img.width,img.height,1],"rgba8unorm");

        device.queue.copyExternalImageToTexture(
            { source: img},
            { texture: reslutTexture, origin: [0, 0, 0] },
            [img.width,img.height,1]
        );

        return reslutTexture;
    }

    async imagesToSkyBoxTextures(imagePaths) {
        const promises = [
            "left+X.png",
            "right-X.png",
            "up+Y.png",
            "down-Y.png",
            "front+Z.png",
            "back-Z.png",
        ].map(async (src) => {
            const response = await fetch(imagePaths + src);
            return createImageBitmap(await response.blob());
        });
        const imageBitmaps = await Promise.all(promises);

        const cubemapTexture = device.createTexture({
            dimension: '2d',
            size: [imageBitmaps[0].width, imageBitmaps[0].height, 6],
            format: format,
            usage:
                GPUTextureUsage.TEXTURE_BINDING |
                GPUTextureUsage.COPY_DST |
                GPUTextureUsage.RENDER_ATTACHMENT,
        });

        for (let i = 0; i < imageBitmaps.length; i++) {
            const imageBitmap = imageBitmaps[i];
            device.queue.copyExternalImageToTexture(
                { source: imageBitmap },
                { texture: cubemapTexture, origin: [0, 0, i] },
                [imageBitmap.width, imageBitmap.height, 1]
            );
        }

        return cubemapTexture;
    }

    // グループレイアウトの作成
    createGroupLayout(items) {
        function entrieFromType(type) {
            if (type == 'u') {
                return {
                    buffer: {
                        type: 'uniform', // 'read-only-storage'で読みだけ可能なストレージバッファにする
                    },
                };
            }
            if (type == 'srw') {
                return {
                    buffer: {
                        type: 'storage', // 'storage' を使って、ストレージバッファを指定
                        readOnly: false, // 読み書き可能に設定
                    },
                };
            }
            if (type == 'sr') {
                return {
                    buffer: {
                        type: 'read-only-storage', // 'read-only-storage'で読みだけ可能なストレージバッファにする
                    },
                };
            }
            if (type == 't') {
                return {
                    texture: {
                        sampleType: 'float'
                    },
                };
            }
            if (type == 'ct') {
                return {
                    texture: {
                        viewDimension: "cube",
                    },
                };
            }
            if (type == 'ts') {
                return {
                    sampler: {
                        type: 'filtering',
                    },
                };
            }
            if (type == "str") {
                return {
                    storageTexture: {
                        access: 'read-only',
                        format: 'rgba8unorm',
                        viewDimension: '2d',
                    },
                }
            }
            if (type == "stw") {
                return {
                    storageTexture: {
                        access: 'write-only',
                        format: 'rgba8unorm',
                        viewDimension: '2d',
                    },
                }
            }

            console.warn(`グループレイアウトのリソースの振り分けに問題がありました。\n無効なtype[${type}]`);
        }

        function stageFromType(useShaderTypes) {
            // GPUShaderStage のマッピング
            const shaderStageMap = {
                v: GPUShaderStage.VERTEX,    // vertex
                f: GPUShaderStage.FRAGMENT, // fragment
                c: GPUShaderStage.COMPUTE,  // compute
            };

            // 初期値は 0
            let visibility = 0;

            // 指定された配列をループしてビットマスクを生成
            for (const type of useShaderTypes) {
                if (shaderStageMap[type]) {
                    visibility |= shaderStageMap[type];
                } else {
                    console.warn(`グループレイアウトのシェーダーに可視性を示す値に問題がありました。\n無効なtype[${type}]`);
                }
            }

            return visibility;
        }

        return device.createBindGroupLayout({
            entries: items.map((x,i) => {
                return Object.assign({
                        binding: i, // インプットオブジェクトデータ
                        visibility: stageFromType(x.useShaderTypes)
                    },
                    entrieFromType(x.type)
                )
            })
        });
    }

    // グループの作成
    createGroup(groupLayout, items) {
        function entrieFromType(type, item) {
            if (type == 'b') {
                return {
                    resource: {
                        buffer: item,
                    }
                };
            }
            if (type == 't') {
                return {
                    resource: item,
                };
            }
            if (type == 'ts') {
                return {
                    resource: item,
                };
            }
            if (type == 'ct') {
                return {
                    resource: item,
                };
            }
            console.warn(`グループのリソースの振り分けに問題がありました。\n無効なtype[${type}]関連付けられたitem[${item}]`);
        }

        return device.createBindGroup({
            layout: groupLayout,
            entries: items.map((x,i) => {
                return Object.assign({
                        binding: i, // インプットオブジェクトデータ
                    },
                    entrieFromType(x.type, x.item)
                )
            })
        });
    }

    // コンピューターパイプラインの作成
    createComputePipeline(groupLayouts, c) {
        return device.createComputePipeline({
            layout: device.createPipelineLayout({
                bindGroupLayouts: groupLayouts,
            }),
            compute: {
                module: c,
                entryPoint: 'main',
            },
        });
    }

    // レンダーパイプラインの作成
    createRenderPipeline(groupLayouts, v, f, vertexBufferStruct, option = "", topologyType = "t") {
        let shaderLocationOffset = 0;
        const createBuffers = (struct) => {
            const structSize = struct.map(x => {
                if (x == "u") {
                    return 4;
                }
                if (x == "f") {
                    return 4;
                }
                if (x == "f_2") {
                    return 8;
                }
                if (x == "f_3") {
                    return 12;
                }
            });
            let offset = 0;
            return {
                arrayStride: structSize.reduce((sum, x) => {
                    return sum + x;
                },0),
                attributes: struct.map((x, i) => {
                    shaderLocationOffset ++;
                    let format = "float32";
                    if (x == "u") {
                        format = "uint32";
                    }
                    if (x == "f") {
                        format = "float32";
                    }
                    if (x == "f_2") {
                        format = "float32x2";
                    }
                    if (x == "f_3") {
                        format = "float32x3";
                    }
                    offset += structSize[i];
                    return {
                        shaderLocation: shaderLocationOffset - 1,
                        format: format,
                        offset: offset - structSize[i],
                    };
                })
            };
        }
        const vertexBuffers = vertexBufferStruct.map((x) => {
            return createBuffers(x);
        });
        if (option == "2d") {
            return device.createRenderPipeline({
                layout: device.createPipelineLayout({
                    bindGroupLayouts: groupLayouts,
                }),
                vertex: {
                    module: v,
                    entryPoint: 'main',
                    buffers: vertexBuffers,
                },
                fragment: {
                    module: f,
                    entryPoint: 'main',
                    targets: [
                        {
                            // format: 'bgra8unorm',
                            // format: fragmentOutputFormat,
                            format: format,
                            blend: {
                                color: {
                                    srcFactor: 'src-alpha', // ソースのアルファ値
                                    dstFactor: 'one-minus-src-alpha', // 1 - ソースのアルファ値
                                    operation: 'add', // 加算
                                },
                                alpha: {
                                    srcFactor: 'src-alpha',
                                    dstFactor: 'one-minus-src-alpha',
                                    operation: 'add',
                                }
                            }
                        }
                    ],
                },
                primitive: {
                    // topology: 'triangle-list',
                    topology: topologyType == "t" ? 'triangle-list' : 'triangle-strip',
                },
            });
        } else if (option == "mask") {
            return device.createRenderPipeline({
                layout: device.createPipelineLayout({
                    bindGroupLayouts: groupLayouts,
                }),
                vertex: {
                    module: v,
                    entryPoint: 'main',
                    buffers: vertexBuffers,
                },
                fragment: {
                    module: f,
                    entryPoint: 'main',
                    targets: [
                        {
                            format: 'r8unorm', // 出力フォーマットをr8unormに設定
                            blend: {
                                color: {
                                    srcFactor: 'src-alpha', // ソースの透明度
                                    dstFactor: 'one-minus-src-alpha', // 背景の透明度
                                    operation: 'add',
                                },
                                alpha: {
                                    srcFactor: 'one',
                                    dstFactor: 'one-minus-src-alpha',
                                    operation: 'add',
                                },
                            },
                            writeMask: GPUColorWrite.RED, // 赤チャネルのみ書き込み
                        },
                    ],
                },
                primitive: {
                    // topology: 'triangle-list',
                    topology: topologyType == "t" ? 'triangle-list' : 'triangle-strip',
                },
            });
        }else if (option == "cvsCopy") {
            return device.createRenderPipeline({
                layout: device.createPipelineLayout({
                    bindGroupLayouts: groupLayouts,
                }),
                vertex: {
                    module: v,
                    entryPoint: 'main',
                    buffers: [],
                },
                fragment: {
                    module: f,
                    entryPoint: 'main',
                    targets: [
                        {
                            format: format,
                            blend: {
                                color: {
                                    srcFactor: 'src-alpha', // ソースのアルファ値
                                    dstFactor: 'one-minus-src-alpha', // 1 - ソースのアルファ値
                                    operation: 'add', // 加算
                                },
                                alpha: {
                                    srcFactor: 'src-alpha',
                                    dstFactor: 'one-minus-src-alpha',
                                    operation: 'add',
                                }
                            }
                        },
                    ],
                },
                primitive: {
                    topology: 'triangle-strip',
                },
            });
        }
    }

    // コマンドエンコーダを作成
    copyBuffer(resource, copyTarget) {
        const copyCommandEncoder = device.createCommandEncoder();

        copyCommandEncoder.copyBufferToBuffer(
            resource,  // コピー元
            0,        // コピー元のオフセット
            copyTarget,  // コピー先
            0,        // コピー先のオフセット
            resource.size  // コピーするバイト数
        );

        const copyCommandBuffer = copyCommandEncoder.finish();
        device.queue.submit([copyCommandBuffer]);
    }

    // コンピューターシェーダーの実行
    runComputeShader(pipeline, groups, workNumX = 1, workNumY = 1,workNumZ = 1) {
        if (workNumX < 1 || workNumY < 1 || workNumZ < 1) return ;
        const computeCommandEncoder = device.createCommandEncoder();
        const computePassEncoder = computeCommandEncoder.beginComputePass();
        computePassEncoder.setPipeline(pipeline);
        for (let i = 0; i < groups.length; i ++) {
            computePassEncoder.setBindGroup(i, groups[i]);
        }
        computePassEncoder.dispatchWorkgroups(workNumX,workNumY,workNumZ); // ワークグループ数をディスパッチ
        computePassEncoder.end();
        device.queue.submit([computeCommandEncoder.finish()]);
    }

    async copyBufferToArray(buffer, array) {
        // 一時的な読み取り用バッファを作成 (MAP_READ を含む)
        const readBuffer = device.createBuffer({
            size: array.length * 4,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        // コピーコマンドを発行
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, array.length * 4);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // 一時バッファの内容をマップして表示
        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = new Float32Array(readBuffer.getMappedRange());
        for (let i = 0; i < array.length; i ++) {
            array[i] = mappedRange[i];
        }
        readBuffer.unmap();
    }

    async getF32BufferData(buffer, size) {
        if (!size) {
            size = buffer.size;
        }
        // 一時的な読み取り用バッファを作成 (MAP_READ を含む)
        const readBuffer = device.createBuffer({
            size: size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        // コピーコマンドを発行
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, size);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // 一時バッファの内容をマップして表示
        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = readBuffer.getMappedRange();
        const dataArray = new Float32Array(mappedRange.slice(0));

        readBuffer.unmap();
        return dataArray;
    }

    async getU32BufferData(buffer, size) {
        if (!size) {
            size = buffer.size;
        }
        // 一時的な読み取り用バッファを作成 (MAP_READ を含む)
        const readBuffer = device.createBuffer({
            size: size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        // コピーコマンドを発行
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, size);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // 一時バッファの内容をマップして表示
        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = readBuffer.getMappedRange();
        const dataArray = new Uint32Array(mappedRange.slice(0));

        readBuffer.unmap();
        return dataArray;
    }

    async getBufferDataAsStruct(buffer, size, struct) {
        if (!size) {
            size = buffer.size;
        }
        // 一時的な読み取り用バッファを作成
        const readBuffer = device.createBuffer({
            size: size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });
    
        // コピーコマンドを発行
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, size);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);
    
        // 一時バッファの内容をマップ
        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = readBuffer.getMappedRange();
        const rawData = new Uint8Array(mappedRange);
    
        // 構造体に基づいてデータを解析
        const dataView = new DataView(rawData.buffer);
        const structSize = struct.length * 4; // 各フィールドのサイズが 4 バイト固定 (u32, f32)
        const result = [];
    
        let offset = 0;
        for (let i = 0; i < size / structSize; i++) {
            for (const field of struct) {
                if (field === "u32") {
                    result.push(dataView.getUint32(offset, true));
                } else if (field === "f32") {
                    result.push(dataView.getFloat32(offset, true));
                }
                offset += 4; // フィールドのサイズを加算
            }
        }

        readBuffer.unmap();
        return result;
    }

    async consoleBufferData(buffer) {
        // 一時的な読み取り用バッファを作成 (MAP_READ を含む)
        const readBuffer = device.createBuffer({
            size: buffer.size,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        // コピーコマンドを発行
        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyBufferToBuffer(buffer, 0, readBuffer, 0, buffer.size);
        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        // 一時バッファの内容をマップして表示
        await readBuffer.mapAsync(GPUMapMode.READ);
        const mappedRange = readBuffer.getMappedRange();
        const dataArray = new Float32Array(mappedRange.slice(0));

        readBuffer.unmap();
        console.log(dataArray);
        return dataArray;
    }

    async createTextureAtlas(textures, textureSize) {
        // アトラステクスチャのサイズ計算
        const atlasRowCol = Math.ceil(Math.sqrt(textures.length));
        const atlasSize = atlasRowCol * textureSize;

        const atlasTexture = device.createTexture({
            size: [atlasSize, atlasSize],
            format: format,
            usage: GPUTextureUsage.TEXTURE_BINDING | GPUTextureUsage.COPY_DST | GPUTextureUsage.RENDER_ATTACHMENT,
        });

        // 各テクスチャをアトラスにコピー
        const commandEncoder = device.createCommandEncoder();
        textures.forEach((texture, index) => {
            const x = (index % atlasRowCol) * textureSize;
            const y = Math.floor(index / atlasRowCol) * textureSize;

            commandEncoder.copyTextureToTexture(
                { texture },
                { texture: atlasTexture, origin: { x, y } },
                [textureSize, textureSize, 1]
            );
        });

        const commandBuffer = commandEncoder.finish();
        device.queue.submit([commandBuffer]);

        return [atlasTexture, atlasRowCol];
    }

    async textureToBase64(texture) {
        function uint8ArrayToImageData(uint8Array, width, height, alignedBytesPerRow) {
            const bytesPerPixel = 4; // RGBA
            const rowData = new Uint8ClampedArray(width * height * bytesPerPixel);

            // 各行をコピーして余分なパディングをスキップ
            for (let y = 0; y < height; y++) {
                const srcStart = y * alignedBytesPerRow;
                const destStart = y * width * bytesPerPixel;
                rowData.set(uint8Array.subarray(srcStart, srcStart + width * bytesPerPixel), destStart);
            }

            return new ImageData(rowData, width, height);
        }

        const alignedBytesPerRow = Math.ceil((texture.width * 4) / 256) * 256;
        const stagingBuffer = device.createBuffer({
            size: alignedBytesPerRow * texture.height,
            usage: GPUBufferUsage.COPY_DST | GPUBufferUsage.MAP_READ,
        });

        const commandEncoder = device.createCommandEncoder();
        commandEncoder.copyTextureToBuffer(
            { texture, mipLevel: 0, origin: { x: 0, y: 0, z: 0 } },
            { buffer: stagingBuffer, bytesPerRow: alignedBytesPerRow, rowsPerImage: texture.height },
            { width: texture.width, height: texture.height, depthOrArrayLayers: 1 }
        );
        device.queue.submit([commandEncoder.finish()]);

        await stagingBuffer.mapAsync(GPUMapMode.READ);
        const arrayBuffer = stagingBuffer.getMappedRange();
        const uint8Array = new Uint8Array(arrayBuffer);

        // Canvasに描画してPNG形式でエクスポート
        const canvas = document.createElement('canvas');
        canvas.width = texture.width;
        canvas.height = texture.height;
        const context = canvas.getContext('2d');

        // 修正箇所：ImageData作成時にalignedBytesPerRowを考慮
        const imageData = uint8ArrayToImageData(uint8Array, texture.width, texture.height, alignedBytesPerRow);
        context.fillStyle = "white"; // 透明部分を白背景に設定
        context.putImageData(imageData, 0, 0);

        const base64String = canvas.toDataURL('image/png'); // PNG形式を指定
        stagingBuffer.unmap();

        return {data: base64String, width: texture.width, height: texture.height}; // "data:image/png;base64,..." の形式で返される
    }

    async cpyBase64ToTexture(texture, base64String) {
        if (!base64String.startsWith("data:image/")) {
            // プレフィックスを自動的に追加（例: PNG形式として処理）
            base64String = "data:image/png;base64," + base64String;
        }

        // Base64文字列をImageBitmapに変換
        const image = await createImageBitmap(await fetch(base64String).then(res => res.blob()));

        // ImageBitmapのサイズがテクスチャに合うか確認
        if (image.width !== texture.width || image.height !== texture.height) {
            throw new Error("Image size does not match the texture size.");
        }

        // コマンドエンコーダを作成してデータをコピー
        device.queue.copyExternalImageToTexture(
            { source: image },
            { texture: texture },
            {
                width: image.width,
                height: image.height,
                depthOrArrayLayers: 1,
            }
        );

        base64String = null;
        image.close();
    }
}

const adapter = await navigator.gpu.requestAdapter();

export const device = await adapter.requestDevice();

export const format = navigator.gpu.getPreferredCanvasFormat();
console.log(format)

export const GPU = new WebGPU();