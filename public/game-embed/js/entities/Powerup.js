/**
 * Powerup Entity
 */

import { CONFIG } from '../config.js';
import { Vector2, randomChoice } from '../utils/Math.js';
import { AssetLoader } from '../utils/AssetLoader.js';

export class Powerup {
    constructor(pos, kind = null) {
        this.pos = pos.clone();
        this.radius = 18;
        this.kind = kind || randomChoice(['heal', 'combo']);
        this.label = this.kind === 'heal' ? 'İyileşme' : 'Kombo';
        this.time = 0;
        
        // Visual
        this.bobOffset = Math.random() * Math.PI * 2;
    }
    
    update(dt) {
        this.time += dt;
    }
    
    apply(player, combo) {
        if (this.kind === 'heal') {
            player.heal(CONFIG.POWERUP_HEAL_AMOUNT);
        } else {
            combo.boost(0.6);
        }
    }
    
    collides(point, radius) {
        return this.pos.distanceTo(point) <= this.radius + radius;
    }
    
    draw(ctx) {
        const wobble = Math.sin(this.time * 5 + this.bobOffset) * 3;
        const scale = 1 + Math.sin(this.time * 3) * 0.1;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y + wobble);
        ctx.scale(scale, scale);
        
        // Try to draw sprite
        const spriteKey = this.kind === 'heal' ? 'powerup_heal' : 'powerup_combo';
        const sprite = AssetLoader.getImage(spriteKey);
        
        if (sprite) {
            // Glow effect
            const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius + 15);
            glowGradient.addColorStop(0, 'rgba(255, 221, 124, 0.6)');
            glowGradient.addColorStop(1, 'rgba(255, 221, 124, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 15, 0, Math.PI * 2);
            ctx.fill();
            
            const spriteSize = 40;
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
            
            // Sparkles
            this.drawSparkles(ctx);
        } else {
            // Fallback: draw original powerup
            // Glow
            const glowGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius + 10);
            glowGradient.addColorStop(0, 'rgba(255, 221, 124, 0.6)');
            glowGradient.addColorStop(1, 'rgba(255, 221, 124, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 10, 0, Math.PI * 2);
            ctx.fill();
            
            // Main body
            const gradient = ctx.createRadialGradient(-3, -3, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.5, CONFIG.COLORS.POWERUP);
            gradient.addColorStop(1, '#cc9933');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Outline
            ctx.strokeStyle = '#28140a';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Icon
            ctx.fillStyle = '#28140a';
            ctx.font = 'bold 16px Nunito, sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(this.kind === 'heal' ? '❤️' : '⚡', 0, 0);
            
            // Sparkles
            this.drawSparkles(ctx);
        }
        
        ctx.restore();
    }
    
    drawSparkles(ctx) {
        ctx.fillStyle = '#ffffff';
        for (let i = 0; i < 4; i++) {
            const angle = (i / 4) * Math.PI * 2 + this.time * 2;
            const dist = this.radius + 5 + Math.sin(this.time * 3 + i) * 3;
            const x = Math.cos(angle) * dist;
            const y = Math.sin(angle) * dist;
            const size = 2 + Math.sin(this.time * 4 + i) * 1;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
    }
}
