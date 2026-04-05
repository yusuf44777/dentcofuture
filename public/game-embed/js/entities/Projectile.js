/**
 * Projectile Entities
 */

import { CONFIG } from '../config.js';
import { Vector2 } from '../utils/Math.js';
import { AssetLoader } from '../utils/AssetLoader.js';

/**
 * Player's toothpaste shot
 */
export class ToothpasteShot {
    constructor(options) {
        this.pos = options.pos.clone();
        this.vel = options.direction.normalize().scale(options.speed);
        this.damage = options.damage;
        this.radius = 8;
        this.alive = true;
        this.lifetime = 0;
        this.angle = Math.atan2(this.vel.y, this.vel.x);
    }
    
    update(dt) {
        this.pos = this.pos.addScaled(this.vel, dt);
        this.lifetime += dt;
        
        // Kill if too old or out of bounds
        if (this.lifetime > 2.5) {
            this.alive = false;
        }
        
        if (this.pos.x < -50 || this.pos.x > CONFIG.SCREEN_WIDTH + 50 ||
            this.pos.y < -50 || this.pos.y > CONFIG.SCREEN_HEIGHT + 50) {
            this.alive = false;
        }
    }
    
    hitCircle(targetPos, targetRadius) {
        return this.pos.distanceTo(targetPos) <= this.radius + targetRadius;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        
        // Try to draw sprite
        const sprite = AssetLoader.getImage('projectile_toothpaste');
        
        if (sprite) {
            const spriteWidth = 32;
            const spriteHeight = 16;
            ctx.drawImage(sprite, -spriteWidth / 2, -spriteHeight / 2, spriteWidth, spriteHeight);
        } else {
            // Fallback: draw original projectile
            // Glow
            ctx.shadowColor = CONFIG.COLORS.SHOT;
            ctx.shadowBlur = 10;
            
            // Main projectile
            const gradient = ctx.createLinearGradient(-12, 0, 12, 0);
            gradient.addColorStop(0, 'rgba(177, 252, 255, 0.3)');
            gradient.addColorStop(0.5, CONFIG.COLORS.SHOT);
            gradient.addColorStop(1, '#ffffff');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(0, 0, 12, 5, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Core
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(4, 0, 3, 0, Math.PI * 2);
            ctx.fill();
            
            // Trail
            ctx.strokeStyle = 'rgba(177, 252, 255, 0.5)';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-8, 0);
            ctx.lineTo(-20, 0);
            ctx.stroke();
        }
        
        ctx.restore();
    }
}

/**
 * Enemy projectile
 */
export class GermProjectile {
    constructor(options) {
        this.pos = options.pos.clone();
        this.vel = options.direction.normalize().scale(options.speed);
        this.damage = options.damage;
        this.radius = 10;
        this.alive = true;
        this.age = 0;
        this.angle = Math.atan2(this.vel.y, this.vel.x);
    }
    
    update(dt) {
        this.pos = this.pos.addScaled(this.vel, dt);
        this.age += dt;
        
        if (this.age > 3.0) {
            this.alive = false;
        }
        
        if (this.pos.x < -50 || this.pos.x > CONFIG.SCREEN_WIDTH + 50 ||
            this.pos.y < -50 || this.pos.y > CONFIG.SCREEN_HEIGHT + 50) {
            this.alive = false;
        }
    }
    
    collides(point, radius) {
        return this.pos.distanceTo(point) <= this.radius + radius;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        ctx.rotate(this.angle);
        
        // Try to draw sprite
        const sprite = AssetLoader.getImage('projectile_enemy');
        
        if (sprite) {
            const spriteSize = 24;
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        } else {
            // Fallback: draw original projectile
            // Glow
            ctx.shadowColor = CONFIG.COLORS.ENEMY_SHOT;
            ctx.shadowBlur = 8;
            
            // Main projectile
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#ffffff');
            gradient.addColorStop(0.4, CONFIG.COLORS.ENEMY_SHOT);
            gradient.addColorStop(1, 'rgba(255, 150, 80, 0.5)');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Spiky appearance
            ctx.strokeStyle = '#ff6633';
            ctx.lineWidth = 2;
            for (let i = 0; i < 4; i++) {
                const angle = (i / 4) * Math.PI * 2;
                ctx.beginPath();
                ctx.moveTo(0, 0);
                ctx.lineTo(Math.cos(angle) * 14, Math.sin(angle) * 14);
                ctx.stroke();
            }
        }
        
        ctx.restore();
    }
}
