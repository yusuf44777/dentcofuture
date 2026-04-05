/**
 * Boss Enemy
 */

import { CONFIG } from '../config.js';
import { Vector2, clamp } from '../utils/Math.js';
import { GermProjectile } from './Projectile.js';
import { AssetLoader } from '../utils/AssetLoader.js';

export class BossGerm {
    constructor(pos, wave, affix = {}) {
        this.pos = pos.clone();
        this.radius = 50;
        this.type = 'boss';
        this.affix = affix;
        this.color = CONFIG.COLORS.BOSS;
        
        // Stats
        this.health = CONFIG.BOSS_HEALTH_BASE + (wave - 1) * 60;
        this.maxHealth = this.health;
        this.speed = CONFIG.BOSS_SPEED;
        
        // Attack pattern
        this.fireTimer = 0.8;
        this.spin = 0;
        this.phase = 0;
        
        // Visual
        this.pulseTimer = 0;
    }
    
    update(target, dt) {
        // Slow drift toward target
        const direction = target.sub(this.pos);
        if (direction.lengthSquared() > 0) {
            const normalized = direction.normalize();
            this.pos = this.pos.addScaled(normalized, this.speed * dt);
        }
        
        // Clamp to playfield
        this.pos.x = clamp(this.pos.x, CONFIG.PLAYFIELD_MARGIN + 12, 
            CONFIG.SCREEN_WIDTH - CONFIG.PLAYFIELD_MARGIN - 12);
        this.pos.y = clamp(this.pos.y, CONFIG.PLAYFIELD_MARGIN + 12, 
            CONFIG.SCREEN_HEIGHT - CONFIG.PLAYFIELD_MARGIN - 12);
        
        // Shooting
        this.fireTimer -= dt;
        const shots = [];
        
        if (this.fireTimer <= 0) {
            const normalized = direction.lengthSquared() > 0 
                ? direction.normalize() 
                : new Vector2(1, 0);
            
            // Targeted shot
            shots.push(new GermProjectile({
                pos: this.pos,
                direction: normalized,
                speed: CONFIG.BOSS_PROJECTILE_SPEED,
                damage: CONFIG.BOSS_PROJECTILE_DAMAGE
            }));
            
            // Spinning ring of projectiles
            for (let i = 0; i < 5; i++) {
                const angle = (i / 5) * Math.PI * 2 + this.spin;
                shots.push(new GermProjectile({
                    pos: this.pos,
                    direction: Vector2.fromAngle(angle),
                    speed: CONFIG.BOSS_PROJECTILE_SPEED * 0.8,
                    damage: CONFIG.BOSS_PROJECTILE_DAMAGE * 0.8
                }));
            }
            
            this.fireTimer = CONFIG.BOSS_FIRE_RATE * (this.affix.enemy_attack_rate || 1);
            this.spin += 0.6;
        }
        
        this.pulseTimer += dt;
        
        return shots;
    }
    
    collides(point, radius) {
        return this.pos.distanceTo(point) <= this.radius + radius;
    }
    
    takeDamage(dmg) {
        this.health -= dmg;
        return {
            killed: this.health <= 0,
            damage: dmg
        };
    }
    
    draw(ctx) {
        const pulse = Math.sin(this.pulseTimer * 3) * 3;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // Try to draw sprite
        const sprite = AssetLoader.getImage('enemy_boss');
        
        if (sprite) {
            // Outer glow effect
            const glowGradient = ctx.createRadialGradient(0, 0, 60, 0, 0, 100 + pulse);
            glowGradient.addColorStop(0, 'rgba(255, 214, 102, 0.4)');
            glowGradient.addColorStop(1, 'rgba(255, 214, 102, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, 100 + pulse, 0, Math.PI * 2);
            ctx.fill();
            
            const spriteSize = 120;
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        } else {
            // Fallback: draw original boss
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(0, this.radius - 5, this.radius * 0.9, 12, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Outer glow
            const glowGradient = ctx.createRadialGradient(0, 0, this.radius - 10, 0, 0, this.radius + 20);
            glowGradient.addColorStop(0, 'rgba(255, 214, 102, 0.5)');
            glowGradient.addColorStop(1, 'rgba(255, 214, 102, 0)');
            ctx.fillStyle = glowGradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 20 + pulse, 0, Math.PI * 2);
            ctx.fill();
            
            // Crown/spikes
            ctx.fillStyle = '#ffaa33';
            for (let i = 0; i < 8; i++) {
                const angle = (i / 8) * Math.PI * 2 + this.spin * 0.1;
                const spikeLen = 20 + Math.sin(this.pulseTimer * 2 + i) * 5;
                
                ctx.save();
                ctx.rotate(angle);
                ctx.beginPath();
                ctx.moveTo(this.radius - 5, -8);
                ctx.lineTo(this.radius + spikeLen, 0);
                ctx.lineTo(this.radius - 5, 8);
                ctx.closePath();
                ctx.fill();
                ctx.restore();
            }
            
            // Main body
            const gradient = ctx.createRadialGradient(-10, -10, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#fff5cc');
            gradient.addColorStop(0.5, this.color);
            gradient.addColorStop(1, '#cc9933');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Outline
            ctx.strokeStyle = '#5a3c1e';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Inner ring
            ctx.strokeStyle = 'rgba(90, 60, 30, 0.3)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius - 6, 0, Math.PI * 2);
            ctx.stroke();
            
            // Face
            this.drawFace(ctx);
        }
        
        // Draw boss health bar at top of screen
        this.drawBossHealthBar(ctx);
        
        ctx.restore();
    }
    
    drawBossHealthBar(ctx) {
        // Reset transform for screen-space rendering
        ctx.restore();
        ctx.save();
        
        const barWidth = 400;
        const barHeight = 16;
        const x = (CONFIG.SCREEN_WIDTH - barWidth) / 2;
        const y = 20;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(x - 2, y - 2, barWidth + 4, barHeight + 4);
        
        // Health
        const healthRatio = this.health / this.maxHealth;
        const gradient = ctx.createLinearGradient(x, 0, x + barWidth, 0);
        gradient.addColorStop(0, '#ff6633');
        gradient.addColorStop(0.5, '#ffaa33');
        gradient.addColorStop(1, '#ff6633');
        ctx.fillStyle = gradient;
        ctx.fillRect(x, y, barWidth * healthRatio, barHeight);
        
        // Border
        ctx.strokeStyle = '#ffd666';
        ctx.lineWidth = 2;
        ctx.strokeRect(x, y, barWidth, barHeight);
        
        // Boss name
        ctx.fillStyle = '#ffd666';
        ctx.font = 'bold 14px Nunito, sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('👑 ÇÜRÜK KRALI', CONFIG.SCREEN_WIDTH / 2, y + barHeight + 16);
    }
    
    drawFace(ctx) {
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-15, -8, 12, 14, -0.1, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.ellipse(15, -8, 12, 14, 0.1, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#5a3c1e';
        ctx.beginPath();
        ctx.arc(-12, -5, 6, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(18, -5, 6, 0, Math.PI * 2);
        ctx.fill();
        
        // Eyebrows (angry)
        ctx.strokeStyle = '#5a3c1e';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.moveTo(-25, -22);
        ctx.lineTo(-8, -16);
        ctx.stroke();
        ctx.beginPath();
        ctx.moveTo(25, -22);
        ctx.lineTo(8, -16);
        ctx.stroke();
        
        // Mouth
        ctx.strokeStyle = '#5a3c1e';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.arc(0, 12, 15, 0.2, Math.PI - 0.2);
        ctx.stroke();
        
        // Teeth
        ctx.fillStyle = '#ffffff';
        for (let i = -2; i <= 2; i++) {
            ctx.fillRect(-4 + i * 6, 14, 5, 8);
        }
    }
}

/**
 * Mini-Boss - Smaller boss that appears on waves 3 and 6
 */
export class MiniBoss {
    constructor(pos, wave, type = 'speeder') {
        this.pos = pos.clone();
        this.type = type;
        this.wave = wave;
        
        // Different mini-boss types
        if (type === 'speeder') {
            this.name = '⚡ Hızlı Çürük';
            this.radius = 30;
            this.health = 80 + wave * 20;
            this.maxHealth = this.health;
            this.speed = 180;
            this.color = '#ff9933';
            this.fireRate = 0.8;
            this.projectileCount = 3;
        } else if (type === 'tank') {
            this.name = '🛡️ Zırhlı Çürük';
            this.radius = 40;
            this.health = 200 + wave * 30;
            this.maxHealth = this.health;
            this.speed = 60;
            this.color = '#9966cc';
            this.fireRate = 1.5;
            this.projectileCount = 1;
        } else {
            this.name = '💀 Toksik Çürük';
            this.radius = 35;
            this.health = 120 + wave * 25;
            this.maxHealth = this.health;
            this.speed = 100;
            this.color = '#66cc66';
            this.fireRate = 0.5;
            this.projectileCount = 6;
        }
        
        this.fireTimer = this.fireRate;
        this.pulseTimer = 0;
        this.angle = 0;
    }
    
    update(target, dt) {
        // Move toward target
        const direction = target.sub(this.pos);
        if (direction.lengthSquared() > 0) {
            const normalized = direction.normalize();
            this.pos = this.pos.addScaled(normalized, this.speed * dt);
        }
        
        // Clamp to playfield
        this.pos.x = clamp(this.pos.x, CONFIG.PLAYFIELD_MARGIN + 10, 
            CONFIG.SCREEN_WIDTH - CONFIG.PLAYFIELD_MARGIN - 10);
        this.pos.y = clamp(this.pos.y, CONFIG.PLAYFIELD_MARGIN + 10, 
            CONFIG.SCREEN_HEIGHT - CONFIG.PLAYFIELD_MARGIN - 10);
        
        // Shooting
        this.fireTimer -= dt;
        const shots = [];
        
        if (this.fireTimer <= 0) {
            const normalized = direction.lengthSquared() > 0 
                ? direction.normalize() 
                : new Vector2(1, 0);
            
            for (let i = 0; i < this.projectileCount; i++) {
                const spreadAngle = (i - (this.projectileCount - 1) / 2) * 0.2;
                const angle = Math.atan2(normalized.y, normalized.x) + spreadAngle;
                
                shots.push(new GermProjectile({
                    pos: this.pos,
                    direction: Vector2.fromAngle(angle),
                    speed: 200,
                    damage: 8
                }));
            }
            
            this.fireTimer = this.fireRate;
        }
        
        this.pulseTimer += dt;
        this.angle += dt * 2;
        
        return shots;
    }
    
    takeDamage(amount) {
        this.health -= amount;
        return { killed: this.health <= 0, damage: amount };
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // Pulse effect
        const pulse = 1 + Math.sin(this.pulseTimer * 4) * 0.08;
        ctx.scale(pulse, pulse);
        
        // Glow
        ctx.shadowColor = this.color;
        ctx.shadowBlur = 20;
        
        // Body
        const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
        gradient.addColorStop(0, this.color);
        gradient.addColorStop(0.7, this.color);
        gradient.addColorStop(1, '#333');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Spikes
        ctx.fillStyle = this.color;
        const spikeCount = 6;
        for (let i = 0; i < spikeCount; i++) {
            const angle = (i / spikeCount) * Math.PI * 2 + this.angle;
            ctx.save();
            ctx.rotate(angle);
            ctx.beginPath();
            ctx.moveTo(this.radius - 5, -8);
            ctx.lineTo(this.radius + 12, 0);
            ctx.lineTo(this.radius - 5, 8);
            ctx.closePath();
            ctx.fill();
            ctx.restore();
        }
        
        // Face
        ctx.shadowBlur = 0;
        
        // Eyes
        ctx.fillStyle = '#fff';
        ctx.beginPath();
        ctx.arc(-10, -5, 8, 0, Math.PI * 2);
        ctx.arc(10, -5, 8, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#000';
        ctx.beginPath();
        ctx.arc(-8, -3, 4, 0, Math.PI * 2);
        ctx.arc(12, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Angry mouth
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(0, 8, 10, 0.3, Math.PI - 0.3);
        ctx.stroke();
        
        ctx.restore();
        
        // Health bar above mini-boss
        this.drawHealthBar(ctx);
    }
    
    drawHealthBar(ctx) {
        const barWidth = 60;
        const barHeight = 6;
        const x = this.pos.x - barWidth / 2;
        const y = this.pos.y - this.radius - 15;
        
        // Background
        ctx.fillStyle = '#333';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = this.color;
        ctx.fillRect(x, y, barWidth * healthRatio, barHeight);
        
        // Border
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
}
