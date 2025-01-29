class Vec2 {
    constructor() {
    }

    create() {
        return new Float32Array(2);
    }

    add(t,a,b) {
        t[0] = a[0] + b[0];
        t[1] = a[1] + b[1];
    }

    addR(a,b) {
        return [a[0] + b[0], a[1] + b[1]];
    }

    sub(t,a,b) {
        t[0] = a[0] - b[0];
        t[1] = a[1] - b[1];
    }

    subR(a,b) {
        return [a[0] - b[0], a[1] - b[1]];
    }

    scale(t,a,b) {
        t[0] = a[0] * b;
        t[1] = a[1] * b;
    }

    scaleR(a,b) {
        return [a[0] * b, a[1] * b];
    }

    reverseScale(t,a,b) {
        t[0] = a[0] / b;
        t[1] = a[1] / b;
    }

    reverseScaleR(a,b) {
        return [a[0] / b, a[1] / b];
    }

    mul(t,a,b) {
        t[0] = a[0] * b[0];
        t[1] = a[1] * b[1];
    }

    mulR(a,b) {
        return [a[0] * b[0], a[1] * b[1]];
    }

    div(t,a,b) {
        t[0] = a[0] / b[0];
        t[1] = a[1] / b[1];
    }

    divR(a,b) {
        return [a[0] / b[0], a[1] / b[1]];
    }

    angleAFromB(a, b) {
        const delta = [b[0] - a[0], b[1] - a[1]]

        return Math.atan2(delta[1], delta[0]);
    }

    normalizeR(a) {
        const len = Math.sqrt(a[0] * a[0] + a[1] * a[1]);
        return [a[0] / len, a[1] / len];
    }

    subAndnormalizeR(a,b) {
        const sub = [a[0] - b[0], a[1] - b[1]];
        const len = Math.sqrt(sub[0] * sub[0] + sub[1] * sub[1]);
        return [sub[0] / len, sub[1] / len];
    }

    cross3R(a, b, c) {
        return (b[0] - a[0]) * (c[1] - a[1]) - (b[1] - a[1]) * (c[0] - a[0]);
    }

    distanceR(a, b) {
        const sub = [a[0] - b[0], a[1] - b[1]];
        return Math.sqrt(sub[0] ** 2 + sub[1] ** 2);
    }

    same(a,b) {
        return a[0] == b[0] && a[1] == b[1];
    }

    max(a) {
        return Math.max(a[0], a[1]);
    }

    createBBox(points) {
        if (!points.length) return {max: [NaN, NaN], min: [NaN, NaN]};
        let maxX = points[0][0];
        let maxY = points[0][1];
        let minX = points[0][0];
        let minY = points[0][1];
        for (let i = 1; i < points.length; i ++) {
            maxX = Math.max(points[i][0], maxX);
            maxY = Math.max(points[i][1], maxY);
            minX = Math.min(points[i][0], minX);
            minY = Math.min(points[i][1], minY);
        }
        return {max: [maxX,maxY], min: [minX,minY]};
    }
}

export const vec2 = new Vec2();