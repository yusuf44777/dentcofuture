/**
 * Germ Entities (Enemies)
 */

import { CONFIG } from '../config.js';
import { Vector2, randomRange, clamp, randomChoice } from '../utils/Math.js';
import { GermProjectile } from './Projectile.js';
import { AssetLoader } from '../utils/AssetLoader.js';

/**
 * Apply affix modifier to a value
 */
function applyAffix(value, affix, key) {
    return value * (affix[key] || 1);
}

/**
 * Elite modifiers - special abilities for elite enemies
 */
const ELITE_MODIFIERS = [
    { name: 'Hızlı', color: '#00ffff', speedMult: 1.8, healthMult: 1.0, damageMult: 1.0, reward: 1.5 },
    { name: 'Zırhlı', color: '#8888ff', speedMult: 0.8, healthMult: 2.0, damageMult: 1.2, reward: 2.0 },
    { name: 'Vampir', color: '#ff00ff', speedMult: 1.0, healthMult: 1.5, damageMult: 1.5, reward: 2.5, lifesteal: true },
    { name: 'Patlayıcı', color: '#ff8800', speedMult: 1.2, healthMult: 1.2, damageMult: 1.0, reward: 2.0, explodes: true },
    { name: 'Bölünen', color: '#88ff88', speedMult: 1.0, healthMult: 1.0, damageMult: 0.8, reward: 3.0, splits: true },
];

/**
 * Base Germ - Basic enemy that chases player
 */
export class Germ {
    constructor(pos, wave = 1, affix = {}) {
        this.pos = pos.clone();
        this.radius = 26;
        this.type = 'grunt';
        this.affix = affix;
        this.color = CONFIG.COLORS.GERM;
        
        // Stats scale with wave
        const baseHealth = CONFIG.GERM_BASE_HEALTH + (wave - 1) * 3;
        this.health = applyAffix(baseHealth, affix, 'enemy_health');
        this.maxHealth = this.health;
        
        const baseSpeed = CONFIG.GERM_BASE_SPEED + randomRange(-12, 18) + (wave - 1) * 4;
        this.speed = applyAffix(baseSpeed, affix, 'enemy_speed');
        
        this.contactDamage = CONFIG.GERM_CONTACT_DAMAGE + wave * 0.5;
        this.biteCooldown = 0;
        
        // Visual
        this.wobble = Math.random() * Math.PI * 2;
    }
    
    update(target, dt) {
        // Move toward target
        const direction = target.sub(this.pos);
        if (direction.lengthSquared() > 0) {
            const normalized = direction.normalize();
            this.pos = this.pos.addScaled(normalized, this.speed * dt);
        }
        
        // Update cooldowns
        this.biteCooldown = Math.max(0, this.biteCooldown - dt);
        
        // Clamp to playfield
        this.pos.x = clamp(this.pos.x, CONFIG.PLAYFIELD_MARGIN, 
            CONFIG.SCREEN_WIDTH - CONFIG.PLAYFIELD_MARGIN);
        this.pos.y = clamp(this.pos.y, CONFIG.PLAYFIELD_MARGIN, 
            CONFIG.SCREEN_HEIGHT - CONFIG.PLAYFIELD_MARGIN);
        
        // Visual wobble
        this.wobble += dt * 5;
        
        return []; // No projectiles for basic germ
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
    
    canBite() {
        return this.biteCooldown <= 0;
    }
    
    setBiteCooldown() {
        this.biteCooldown = 0.8;
    }
    
    draw(ctx) {
        const wobbleOffset = Math.sin(this.wobble) * 2;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y + wobbleOffset);
        
        // Try to draw sprite
        const sprite = AssetLoader.getImage('enemy_grunt');
        
        if (sprite) {
            const spriteSize = 56;
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        } else {
            // Fallback: draw circle
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(0, this.radius - 5, this.radius * 0.8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Main body
            const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#ff8ab0');
            gradient.addColorStop(0.7, this.color);
            gradient.addColorStop(1, '#cc4060');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Outline
            ctx.strokeStyle = '#1e0820';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Eyes
            this.drawEyes(ctx);
        }
        
        // Health bar if damaged
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
    
    drawEyes(ctx) {
        // Left eye
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.ellipse(-8, -5, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Right eye
        ctx.beginPath();
        ctx.ellipse(8, -5, 8, 10, 0, 0, Math.PI * 2);
        ctx.fill();
        
        // Pupils
        ctx.fillStyle = '#1e0820';
        ctx.beginPath();
        ctx.arc(-6, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -3, 4, 0, Math.PI * 2);
        ctx.fill();
    }
    
    drawHealthBar(ctx) {
        const barWidth = 30;
        const barHeight = 4;
        const y = -this.radius - 8;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-barWidth / 2, y, barWidth, barHeight);
        
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = '#ff6392';
        ctx.fillRect(-barWidth / 2, y, barWidth * healthRatio, barHeight);
    }
}

/**
 * Spitter Germ - Ranged enemy that shoots projectiles
 */
export class SpitterGerm extends Germ {
    constructor(pos, wave = 1, affix = {}) {
        super(pos, wave, affix);
        
        this.type = 'spitter';
        this.radius = 24;
        this.color = CONFIG.COLORS.SPITTER;
        
        // Override stats
        const baseHealth = CONFIG.SPITTER_BASE_HEALTH + (wave - 1) * 3;
        this.health = applyAffix(baseHealth, affix, 'enemy_health');
        this.maxHealth = this.health;
        
        const baseSpeed = CONFIG.SPITTER_BASE_SPEED + randomRange(-8, 12) + (wave - 1) * 3;
        this.speed = applyAffix(baseSpeed, affix, 'enemy_speed');
        
        this.contactDamage = CONFIG.GERM_CONTACT_DAMAGE + wave * 0.3;
        
        // Shooting
        this.fireTimer = randomRange(0.2, CONFIG.SPITTER_FIRE_COOLDOWN);
        this.fireRateMult = affix.enemy_attack_rate || 1;
    }
    
    update(target, dt) {
        const direction = target.sub(this.pos);
        const distance = direction.length();
        const normalized = distance > 0 ? direction.normalize() : new Vector2(1, 0);
        
        // Maintain medium range
        if (distance > 240) {
            this.pos = this.pos.addScaled(normalized, this.speed * dt);
        } else if (distance < 170) {
            this.pos = this.pos.addScaled(normalized, -this.speed * 0.5 * dt);
        } else {
            // Strafe
            const strafe = normalized.rotate(Math.PI / 2);
            this.pos = this.pos.addScaled(strafe, this.speed * 0.35 * dt);
        }
        
        // Clamp to playfield
        this.pos.x = clamp(this.pos.x, CONFIG.PLAYFIELD_MARGIN, 
            CONFIG.SCREEN_WIDTH - CONFIG.PLAYFIELD_MARGIN);
        this.pos.y = clamp(this.pos.y, CONFIG.PLAYFIELD_MARGIN, 
            CONFIG.SCREEN_HEIGHT - CONFIG.PLAYFIELD_MARGIN);
        
        // Shooting
        this.fireTimer -= dt;
        const shots = [];
        
        if (this.fireTimer <= 0) {
            shots.push(new GermProjectile({
                pos: this.pos,
                direction: normalized,
                speed: CONFIG.SPITTER_PROJECTILE_SPEED,
                damage: CONFIG.SPITTER_PROJECTILE_DAMAGE
            }));
            this.fireTimer = CONFIG.SPITTER_FIRE_COOLDOWN * this.fireRateMult;
        }
        
        this.biteCooldown = Math.max(0, this.biteCooldown - dt);
        this.wobble += dt * 4;
        
        return shots;
    }
    
    draw(ctx) {
        const wobbleOffset = Math.sin(this.wobble) * 2;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y + wobbleOffset);
        
        // Try to draw sprite
        const sprite = AssetLoader.getImage('enemy_spitter');
        
        if (sprite) {
            const spriteSize = 52;
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        } else {
            // Fallback: draw circle
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
            ctx.beginPath();
            ctx.ellipse(0, this.radius - 5, this.radius * 0.8, 6, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Main body - more elongated
            const gradient = ctx.createRadialGradient(-4, -4, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#ffcc88');
            gradient.addColorStop(0.7, this.color);
            gradient.addColorStop(1, '#cc7733');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.ellipse(0, 0, this.radius, this.radius * 0.85, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Outline
            ctx.strokeStyle = '#28140a';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Single big eye
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.arc(0, -2, 12, 0, Math.PI * 2);
            ctx.fill();
            
            ctx.fillStyle = '#28140a';
            ctx.beginPath();
            ctx.arc(2, 0, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Health bar if damaged
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
}

/**
 * Tank Germ - Slow but tanky enemy with armor
 */
export class TankGerm extends Germ {
    constructor(pos, wave = 1, affix = {}) {
        super(pos, wave, affix);
        
        this.type = 'tank';
        this.radius = 32;
        this.color = CONFIG.COLORS.TANK;
        
        // Override stats
        const baseHealth = CONFIG.TANK_BASE_HEALTH + (wave - 1) * 6;
        this.health = applyAffix(baseHealth, affix, 'enemy_health');
        this.maxHealth = this.health;
        
        const baseSpeed = CONFIG.TANK_BASE_SPEED + randomRange(-6, 8) + (wave - 1) * 2;
        this.speed = applyAffix(baseSpeed, affix, 'enemy_speed');
        
        this.contactDamage = CONFIG.TANK_CONTACT_DAMAGE + wave * 0.7;
        this.armor = CONFIG.TANK_ARMOR;
    }
    
    takeDamage(dmg) {
        const effective = dmg * (1 - this.armor);
        this.health -= effective;
        return {
            killed: this.health <= 0,
            damage: effective
        };
    }
    
    draw(ctx) {
        const wobbleOffset = Math.sin(this.wobble) * 1.5;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y + wobbleOffset);
        
        // Try to draw sprite
        const sprite = AssetLoader.getImage('enemy_tank');
        
        if (sprite) {
            const spriteSize = 68;
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
        } else {
            // Fallback: draw circle
            // Shadow
            ctx.fillStyle = 'rgba(0, 0, 0, 0.4)';
            ctx.beginPath();
            ctx.ellipse(0, this.radius - 5, this.radius * 0.9, 8, 0, 0, Math.PI * 2);
            ctx.fill();
            
            // Armor ring
            ctx.strokeStyle = '#5a3a80';
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius - 3, 0, Math.PI * 2);
            ctx.stroke();
            
            // Main body
            const gradient = ctx.createRadialGradient(-6, -6, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#d4b8ff');
            gradient.addColorStop(0.6, this.color);
            gradient.addColorStop(1, '#8060b0');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius - 6, 0, Math.PI * 2);
            ctx.fill();
            
            // Outline
            ctx.strokeStyle = '#3c285a';
            ctx.lineWidth = 2;
            ctx.stroke();
            
            // Angry eyes
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.ellipse(-10, -5, 6, 8, -0.2, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.ellipse(10, -5, 6, 8, 0.2, 0, Math.PI * 2);
            ctx.fill();
            
            // Angry eyebrows
            ctx.strokeStyle = '#3c285a';
            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(-16, -14);
            ctx.lineTo(-6, -10);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(16, -14);
            ctx.lineTo(6, -10);
            ctx.stroke();
            
            ctx.fillStyle = '#3c285a';
            ctx.beginPath();
            ctx.arc(-8, -3, 3, 0, Math.PI * 2);
            ctx.fill();
            ctx.beginPath();
            ctx.arc(12, -3, 3, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Health bar if damaged
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
    
    drawHealthBar(ctx) {
        const barWidth = 40;
        const barHeight = 5;
        const y = -this.radius - 10;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-barWidth / 2, y, barWidth, barHeight);
        
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = '#b48cff';
        ctx.fillRect(-barWidth / 2, y, barWidth * healthRatio, barHeight);
    }
}
/**
 * Elite Germ - Stronger version with special abilities
 */
export class EliteGerm extends Germ {
    constructor(pos, wave = 1, affix = {}) {
        super(pos, wave, affix);
        
        this.type = 'elite';
        this.isElite = true;
        
        // Pick random elite modifier
        this.modifier = randomChoice(ELITE_MODIFIERS);
        this.eliteName = this.modifier.name;
        this.color = this.modifier.color;
        
        // Apply modifier stats
        this.health *= this.modifier.healthMult * 1.5;
        this.maxHealth = this.health;
        this.speed *= this.modifier.speedMult;
        this.contactDamage *= this.modifier.damageMult;
        this.rewardMult = this.modifier.reward;
        
        // Special abilities
        this.lifesteal = this.modifier.lifesteal || false;
        this.explodes = this.modifier.explodes || false;
        this.splits = this.modifier.splits || false;
        
        this.radius = 30;
        this.glowTimer = 0;
    }
    
    update(target, dt) {
        this.glowTimer += dt * 3;
        return super.update(target, dt);
    }
    
    draw(ctx) {
        const wobbleOffset = Math.sin(this.wobble) * 2;
        const glowPulse = Math.sin(this.glowTimer) * 0.3 + 0.7;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y + wobbleOffset);
        
        // Elite glow effect
        const glowGradient = ctx.createRadialGradient(0, 0, this.radius * 0.5, 0, 0, this.radius * 2);
        glowGradient.addColorStop(0, this.color + '60');
        glowGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = glowGradient;
        ctx.globalAlpha = glowPulse;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius * 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Main body
        const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#ffffff');
        gradient.addColorStop(0.5, this.color);
        gradient.addColorStop(1, '#333333');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Elite crown
        ctx.fillStyle = '#ffd700';
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * (this.radius - 5);
            const y = Math.sin(angle) * (this.radius - 5) - 5;
            ctx.beginPath();
            ctx.moveTo(x, y - 8);
            ctx.lineTo(x - 4, y);
            ctx.lineTo(x + 4, y);
            ctx.closePath();
            ctx.fill();
        }
        
        // Outline
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Eyes
        this.drawEyes(ctx);
        
        // Elite name above
        ctx.fillStyle = this.color;
        ctx.font = 'bold 10px Nunito';
        ctx.textAlign = 'center';
        ctx.fillText(this.eliteName, 0, -this.radius - 15);
        
        // Health bar
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
    
    drawHealthBar(ctx) {
        const barWidth = 40;
        const barHeight = 6;
        const y = -this.radius - 28;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.7)';
        ctx.fillRect(-barWidth / 2 - 1, y - 1, barWidth + 2, barHeight + 2);
        
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = this.color;
        ctx.fillRect(-barWidth / 2, y, barWidth * healthRatio, barHeight);
    }
}

/**
 * Spawner Germ - Spawns smaller germs
 */
export class SpawnerGerm extends Germ {
    constructor(pos, wave = 1, affix = {}) {
        super(pos, wave, affix);
        
        this.type = 'spawner';
        this.radius = 35;
        this.color = '#ff6699';
        
        this.health = 60 + wave * 8;
        this.maxHealth = this.health;
        this.speed = 40;
        
        this.spawnTimer = 3;
        this.spawnCooldown = 4 - Math.min(wave * 0.2, 2);
        this.maxSpawns = 3;
        this.spawnCount = 0;
        
        this.pulseTimer = 0;
    }
    
    update(target, dt) {
        this.pulseTimer += dt * 2;
        
        // Slow movement
        const direction = target.sub(this.pos);
        if (direction.lengthSquared() > 0) {
            const normalized = direction.normalize();
            this.pos = this.pos.addScaled(normalized, this.speed * dt);
        }
        
        this.pos.x = clamp(this.pos.x, CONFIG.PLAYFIELD_MARGIN, CONFIG.SCREEN_WIDTH - CONFIG.PLAYFIELD_MARGIN);
        this.pos.y = clamp(this.pos.y, CONFIG.PLAYFIELD_MARGIN, CONFIG.SCREEN_HEIGHT - CONFIG.PLAYFIELD_MARGIN);
        
        this.biteCooldown = Math.max(0, this.biteCooldown - dt);
        this.wobble += dt * 3;
        
        // Spawn minions
        this.spawnTimer -= dt;
        const spawns = [];
        
        if (this.spawnTimer <= 0 && this.spawnCount < this.maxSpawns) {
            spawns.push({ type: 'minion', pos: this.pos.clone() });
            this.spawnCount++;
            this.spawnTimer = this.spawnCooldown;
        }
        
        return spawns;
    }
    
    draw(ctx) {
        const pulse = Math.sin(this.pulseTimer) * 3;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // Spawn aura
        ctx.fillStyle = 'rgba(255, 102, 153, 0.2)';
        ctx.beginPath();
        ctx.arc(0, 0, this.radius + 15 + pulse, 0, Math.PI * 2);
        ctx.fill();
        
        // Main body - blob shape
        const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#ffaacc');
        gradient.addColorStop(0.7, this.color);
        gradient.addColorStop(1, '#cc3366');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        // Outline
        ctx.strokeStyle = '#993366';
        ctx.lineWidth = 3;
        ctx.stroke();
        
        // Spawn indicators
        for (let i = 0; i < this.maxSpawns - this.spawnCount; i++) {
            const angle = (i / 3) * Math.PI * 2 - Math.PI / 2;
            const x = Math.cos(angle) * 15;
            const y = Math.sin(angle) * 15;
            ctx.fillStyle = '#ffccdd';
            ctx.beginPath();
            ctx.arc(x, y, 6, 0, Math.PI * 2);
            ctx.fill();
        }
        
        // Eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-8, -5, 8, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(8, -5, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#660033';
        ctx.beginPath();
        ctx.arc(-6, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(10, -3, 4, 0, Math.PI * 2);
        ctx.fill();
        
        // Label
        ctx.fillStyle = '#ffccdd';
        ctx.font = 'bold 9px Nunito';
        ctx.textAlign = 'center';
        ctx.fillText('SPAWNER', 0, -this.radius - 8);
        
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
}

/**
 * Minion Germ - Small weak germ spawned by Spawner
 */
export class MinionGerm extends Germ {
    constructor(pos, wave = 1, affix = {}) {
        super(pos, wave, affix);
        
        this.type = 'minion';
        this.radius = 14;
        this.color = '#ffaacc';
        
        this.health = 8 + wave;
        this.maxHealth = this.health;
        this.speed = 100 + wave * 5;
        this.contactDamage = 3;
    }
    
    draw(ctx) {
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#ff6699';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Tiny eyes
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(-4, -2, 4, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(4, -2, 4, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.fillStyle = '#660033';
        ctx.beginPath();
        ctx.arc(-3, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.arc(5, -1, 2, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
}

/**
 * Shielded Germ - Has a shield that must be broken first
 */
export class ShieldedGerm extends Germ {
    constructor(pos, wave = 1, affix = {}) {
        super(pos, wave, affix);
        
        this.type = 'shielded';
        this.radius = 26;
        this.color = '#6688ff';
        
        this.health = 35 + wave * 5;
        this.maxHealth = this.health;
        this.speed = 65 + wave * 3;
        
        this.shieldHealth = 25 + wave * 3;
        this.maxShieldHealth = this.shieldHealth;
        this.shieldRegenTimer = 0;
        this.shieldRegenDelay = 5;
        
        this.shieldPulse = 0;
    }
    
    update(target, dt) {
        this.shieldPulse += dt * 4;
        
        // Shield regeneration
        if (this.shieldHealth < this.maxShieldHealth && this.shieldHealth > 0) {
            this.shieldRegenTimer += dt;
            if (this.shieldRegenTimer >= this.shieldRegenDelay) {
                this.shieldHealth = Math.min(this.maxShieldHealth, this.shieldHealth + dt * 5);
            }
        }
        
        return super.update(target, dt);
    }
    
    takeDamage(dmg) {
        this.shieldRegenTimer = 0; // Reset regen timer on hit
        
        if (this.shieldHealth > 0) {
            const shieldDamage = Math.min(this.shieldHealth, dmg);
            this.shieldHealth -= shieldDamage;
            const overflow = dmg - shieldDamage;
            
            if (overflow > 0) {
                this.health -= overflow;
            }
            
            return {
                killed: this.health <= 0,
                damage: dmg,
                shieldBroken: this.shieldHealth <= 0 && shieldDamage > 0
            };
        }
        
        this.health -= dmg;
        return {
            killed: this.health <= 0,
            damage: dmg
        };
    }
    
    draw(ctx) {
        const wobbleOffset = Math.sin(this.wobble) * 2;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y + wobbleOffset);
        
        // Shield effect
        if (this.shieldHealth > 0) {
            const shieldPulse = Math.sin(this.shieldPulse) * 3;
            const shieldAlpha = 0.3 + (this.shieldHealth / this.maxShieldHealth) * 0.4;
            
            ctx.strokeStyle = `rgba(100, 150, 255, ${shieldAlpha})`;
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius + 8 + shieldPulse, 0, Math.PI * 2);
            ctx.stroke();
            
            ctx.fillStyle = `rgba(100, 150, 255, ${shieldAlpha * 0.3})`;
            ctx.fill();
        }
        
        // Main body
        const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#99bbff');
        gradient.addColorStop(0.7, this.color);
        gradient.addColorStop(1, '#3355aa');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#223388';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Eyes
        this.drawEyes(ctx);
        
        // Shield bar
        if (this.shieldHealth > 0) {
            const barWidth = 30;
            const barHeight = 4;
            const y = -this.radius - 15;
            
            ctx.fillStyle = 'rgba(0, 0, 50, 0.5)';
            ctx.fillRect(-barWidth / 2, y, barWidth, barHeight);
            
            const shieldRatio = this.shieldHealth / this.maxShieldHealth;
            ctx.fillStyle = '#6699ff';
            ctx.fillRect(-barWidth / 2, y, barWidth * shieldRatio, barHeight);
        }
        
        // Health bar
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
}

/**
 * Healer Germ - Heals nearby allies
 */
export class HealerGerm extends Germ {
    constructor(pos, wave = 1, affix = {}) {
        super(pos, wave, affix);
        
        this.type = 'healer';
        this.radius = 24;
        this.color = '#44ff88';
        
        this.health = 30 + wave * 4;
        this.maxHealth = this.health;
        this.speed = 50;
        
        this.healRange = 120;
        this.healAmount = 3 + wave * 0.5;
        this.healTimer = 0;
        this.healCooldown = 2;
        
        this.healPulse = 0;
        this.isHealing = false;
    }
    
    update(target, dt) {
        this.healPulse += dt * 3;
        this.healTimer -= dt;
        
        // Keep distance from player but stay near allies
        const direction = target.sub(this.pos);
        const distance = direction.length();
        
        if (distance < 200) {
            // Run away
            const normalized = direction.normalize();
            this.pos = this.pos.addScaled(normalized, -this.speed * dt);
        } else if (distance > 350) {
            // Get closer
            const normalized = direction.normalize();
            this.pos = this.pos.addScaled(normalized, this.speed * 0.5 * dt);
        }
        
        this.pos.x = clamp(this.pos.x, CONFIG.PLAYFIELD_MARGIN, CONFIG.SCREEN_WIDTH - CONFIG.PLAYFIELD_MARGIN);
        this.pos.y = clamp(this.pos.y, CONFIG.PLAYFIELD_MARGIN, CONFIG.SCREEN_HEIGHT - CONFIG.PLAYFIELD_MARGIN);
        
        this.biteCooldown = Math.max(0, this.biteCooldown - dt);
        this.wobble += dt * 4;
        
        // Return heal pulse info
        this.isHealing = this.healTimer <= 0;
        if (this.isHealing) {
            this.healTimer = this.healCooldown;
            return { healPulse: { pos: this.pos.clone(), range: this.healRange, amount: this.healAmount } };
        }
        
        return null;
    }
    
    draw(ctx) {
        const wobbleOffset = Math.sin(this.wobble) * 2;
        const pulse = Math.sin(this.healPulse) * 0.2 + 0.8;
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y + wobbleOffset);
        
        // Heal aura
        const auraGradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.healRange);
        auraGradient.addColorStop(0, 'rgba(68, 255, 136, 0.1)');
        auraGradient.addColorStop(1, 'transparent');
        ctx.fillStyle = auraGradient;
        ctx.globalAlpha = pulse;
        ctx.beginPath();
        ctx.arc(0, 0, this.healRange, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
        
        // Main body
        const gradient = ctx.createRadialGradient(-5, -5, 0, 0, 0, this.radius);
        gradient.addColorStop(0, '#aaffcc');
        gradient.addColorStop(0.7, this.color);
        gradient.addColorStop(1, '#22aa55');
        
        ctx.fillStyle = gradient;
        ctx.beginPath();
        ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.strokeStyle = '#118844';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Cross symbol
        ctx.fillStyle = '#ffffff';
        ctx.fillRect(-3, -10, 6, 20);
        ctx.fillRect(-10, -3, 20, 6);
        
        // Label
        ctx.fillStyle = '#aaffcc';
        ctx.font = 'bold 9px Nunito';
        ctx.textAlign = 'center';
        ctx.fillText('HEALER', 0, -this.radius - 8);
        
        if (this.health < this.maxHealth) {
            this.drawHealthBar(ctx);
        }
        
        ctx.restore();
    }
    
    drawHealthBar(ctx) {
        const barWidth = 30;
        const barHeight = 4;
        const y = -this.radius - 20;
        
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(-barWidth / 2, y, barWidth, barHeight);
        
        const healthRatio = this.health / this.maxHealth;
        ctx.fillStyle = '#44ff88';
        ctx.fillRect(-barWidth / 2, y, barWidth * healthRatio, barHeight);
    }
}