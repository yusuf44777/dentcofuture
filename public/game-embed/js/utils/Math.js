/**
 * Vector2 - 2D Vector class
 */
export class Vector2 {
    constructor(x = 0, y = 0) {
        this.x = x;
        this.y = y;
    }
    
    clone() {
        return new Vector2(this.x, this.y);
    }
    
    set(x, y) {
        this.x = x;
        this.y = y;
        return this;
    }
    
    copy(v) {
        this.x = v.x;
        this.y = v.y;
        return this;
    }
    
    add(v) {
        return new Vector2(this.x + v.x, this.y + v.y);
    }
    
    addScaled(v, scale) {
        return new Vector2(this.x + v.x * scale, this.y + v.y * scale);
    }
    
    sub(v) {
        return new Vector2(this.x - v.x, this.y - v.y);
    }
    
    scale(s) {
        return new Vector2(this.x * s, this.y * s);
    }
    
    length() {
        return Math.sqrt(this.x * this.x + this.y * this.y);
    }
    
    lengthSquared() {
        return this.x * this.x + this.y * this.y;
    }
    
    normalize() {
        const len = this.length();
        if (len === 0) return new Vector2(0, 0);
        return new Vector2(this.x / len, this.y / len);
    }
    
    distanceTo(v) {
        return this.sub(v).length();
    }
    
    rotate(angle) {
        const cos = Math.cos(angle);
        const sin = Math.sin(angle);
        return new Vector2(
            this.x * cos - this.y * sin,
            this.x * sin + this.y * cos
        );
    }
    
    angle() {
        return Math.atan2(this.y, this.x);
    }
    
    angleTo(v) {
        return Math.atan2(v.y - this.y, v.x - this.x);
    }
    
    dot(v) {
        return this.x * v.x + this.y * v.y;
    }
    
    lerp(v, t) {
        return new Vector2(
            this.x + (v.x - this.x) * t,
            this.y + (v.y - this.y) * t
        );
    }
    
    static fromAngle(angle, length = 1) {
        return new Vector2(
            Math.cos(angle) * length,
            Math.sin(angle) * length
        );
    }
    
    static random(length = 1) {
        const angle = Math.random() * Math.PI * 2;
        return Vector2.fromAngle(angle, length);
    }
}

/**
 * Utility functions
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

export function lerp(a, b, t) {
    return a + (b - a) * t;
}

export function randomRange(min, max) {
    return min + Math.random() * (max - min);
}

export function randomInt(min, max) {
    return Math.floor(randomRange(min, max + 1));
}

export function randomChoice(array) {
    return array[Math.floor(Math.random() * array.length)];
}

export function shuffle(array) {
    const result = [...array];
    for (let i = result.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [result[i], result[j]] = [result[j], result[i]];
    }
    return result;
}

export function circleCollision(pos1, radius1, pos2, radius2) {
    return pos1.distanceTo(pos2) <= radius1 + radius2;
}

export function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
}

export function rgbToHex(r, g, b) {
    return '#' + [r, g, b].map(x => {
        const hex = Math.round(x).toString(16);
        return hex.length === 1 ? '0' + hex : hex;
    }).join('');
}

export function colorWithAlpha(color, alpha) {
    const rgb = hexToRgb(color);
    if (!rgb) return color;
    return `rgba(${rgb.r}, ${rgb.g}, ${rgb.b}, ${alpha})`;
}
