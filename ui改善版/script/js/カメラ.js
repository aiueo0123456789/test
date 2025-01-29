
import { device,GPU } from './webGPU.js';
import { v_u } from './GPUObject.js';

export class Camera {
    constructor() {
        this.position = [500,-500];
        this.zoomMax = 100;
        this.zoomMin = 0.5;
        this.zoom = 2;
        this.cameraDataBuffer = GPU.createUniformBuffer((2 + 1 + 1) * 4, undefined, ["f32", "f32", "f32"]);
        // this.cameraGroup = GPU.createGroup(v_u, [{item: this.cameraDataBuffer, type: "b"}]);
    }

    updateCamera() {
        device.queue.writeBuffer(this.cameraDataBuffer, 0, new Float32Array([...this.position, this.zoom, 0]));
    }
}