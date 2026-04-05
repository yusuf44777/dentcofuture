/**
 * Floating Text System
 */

import { Vector2 } from '../utils/Math.js';

class FloatingText {
    constructor(pos, text, color) {
        this.pos = pos.clone();
        this.text = text;
        this.color = color;
        this.lifetime = 1.0;
        this.age = 0;
        this.velocity = new Vector2(0, -60);
    }
    
    get alive() {
        return this.age < this.lifetime;
    }
    
    update(dt) {
        this.pos = this.pos.addScaled(this.velocity, dt);
        this.velocity = this.velocity.scale(0.95);
        this.age += dt;
    }
    
    draw(ctx) {
        const alpha = Math.max(0, 1 - this.age / this.lifetime);
        const scale = 1 + (this.age / this.lifetime) * 0.3;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.scale(scale, scale);
        ctx.globalAlpha = alpha;
        
        // Shadow
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.font = 'bold 18px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(this.text, 1, 1);
        
        // Main text
        ctx.fillStyle = this.color;
        ctx.fillText(this.text, 0, 0);
        
        ctx.restore();
    }
}

export class FloatingTextSystem {
    constructor() {
        this.texts = [];
    }
    
    add(pos, text, color = '#ffffff') {
        this.texts.push(new FloatingText(pos, text, color));
    }
    
    update(dt) {
        for (let i = this.texts.length - 1; i >= 0; i--) {
            this.texts[i].update(dt);
            if (!this.texts[i].alive) {
                this.texts.splice(i, 1);
            }
        }
    }
    
    draw(ctx) {
        for (const text of this.texts) {
            text.draw(ctx);
        }
    }
}
