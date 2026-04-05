/**
 * Player Entity
 */

import { CONFIG } from '../config.js';
import { Vector2, clamp } from '../utils/Math.js';
import { ToothpasteShot } from './Projectile.js';
import { AssetLoader } from '../utils/AssetLoader.js';

export class Player {
    constructor(options) {
        const upgrade = options.upgrade || {};
        this.affix = options.affix || {};
        
        this.pos = options.pos.clone();
        this.radius = CONFIG.PLAYER_RADIUS;
        
        // Stats with upgrades
        this.baseSpeed = CONFIG.PLAYER_SPEED * (upgrade.speed_mult || 1);
        this.speed = this.baseSpeed;
        
        this.shotCooldownBase = CONFIG.PLAYER_SHOT_COOLDOWN * (upgrade.shot_cd_mult || 1);
        this.brushCooldownBase = CONFIG.PLAYER_BRUSH_COOLDOWN * (upgrade.brush_cd_mult || 1);
        
        this.shotSpeed = CONFIG.PLAYER_SHOT_SPEED * (upgrade.shot_speed_mult || 1);
        this.shotDamage = CONFIG.PLAYER_SHOT_DAMAGE * (upgrade.shot_damage_mult || 1);
        
        this.brushDamage = CONFIG.PLAYER_BRUSH_DAMAGE * (upgrade.brush_damage_mult || 1);
        this.brushRadius = CONFIG.PLAYER_BRUSH_RADIUS + (upgrade.brush_radius_bonus || 0);
        
        this.maxHealth = Math.floor(CONFIG.PLAYER_MAX_HEALTH * (upgrade.health_mult || 1));
        this.health = this.maxHealth;
        
        this.damageReduction = upgrade.damage_reduction || 0;
        this.healthRegen = upgrade.health_regen || 0;
        this.critChance = upgrade.crit_chance || 0;
        
        // Cooldowns
        this.shotCooldown = 0;
        this.brushCooldown = 0;
        this.hurtTimer = 0;
        
        // Dash
        this.dashCooldown = 0;
        this.dashCooldownMax = 1.5; // seconds
        this.dashDuration = 0;
        this.dashDurationMax = 0.15; // seconds
        this.dashSpeed = 800;
        this.dashDirection = new Vector2(0, 0);
        this.isDashing = false;
        
        // Ultimate
        this.ultimateCharge = 0;
        this.ultimateChargeMax = 100;
        this.ultimateActive = false;
        this.ultimateDuration = 0;
        
        // Visual
        this.shotFlash = 0;
        this.lastMove = new Vector2(0, 0);
        this.angle = 0;
        this.isMoving = false;
        this.facingRight = true;
        this.animFrame = 0;
        this.animTimer = 0;
        this.dashTrail = [];
        
        // Sword/Melee attack
        this.swordSwing = 0; // Current swing animation (0-1)
        this.swordSwingDir = 1; // 1 or -1 for swing direction
        this.isSwinging = false;
        
        // Inventory/Weapon System
        this.weapons = [
            { 
                id: 'gun', 
                name: 'Diş Macunu Tabancası', 
                spriteId: 'crossbow',
                icon: '🔫', 
                type: 'ranged',
                damage: this.shotDamage,
                cooldown: this.shotCooldownBase
            },
            { 
                id: 'sword', 
                name: 'Mikrop Kılıcı', 
                spriteId: 'sword_blue',
                icon: '⚔️', 
                type: 'melee',
                damage: this.brushDamage,
                cooldown: this.brushCooldownBase
            }
        ];
        this.activeWeaponIndex = 0;
        this.weaponSwitchCooldown = 0;
        
        // Apply affix
        this.updateAffix(this.affix);
    }
    
    updateAffix(affix) {
        this.affix = affix || {};
        this.brushCooldownBase = CONFIG.PLAYER_BRUSH_COOLDOWN * 
            (this.affix.player_brush_cd || 1);
        this.speed = this.baseSpeed * (this.affix.player_speed || 1);
    }
    
    update(dt, moveDir, mousePos, wantsFire, wantsBrush, wantsDash = false, wantsUltimate = false, weaponSwitch = null) {
        // Update weapon switch cooldown
        this.weaponSwitchCooldown = Math.max(0, this.weaponSwitchCooldown - dt);
        
        // Handle weapon switching
        if (weaponSwitch !== null && this.weaponSwitchCooldown <= 0) {
            if (weaponSwitch === 'next') {
                this.activeWeaponIndex = (this.activeWeaponIndex + 1) % this.weapons.length;
                this.weaponSwitchCooldown = 0.2;
            } else if (typeof weaponSwitch === 'number' && weaponSwitch < this.weapons.length) {
                this.activeWeaponIndex = weaponSwitch;
                this.weaponSwitchCooldown = 0.2;
            }
        }
        
        // Update dash cooldown
        this.dashCooldown = Math.max(0, this.dashCooldown - dt);
        
        // Handle dashing
        if (this.isDashing) {
            this.dashDuration -= dt;
            
            // Add trail effect
            this.dashTrail.push({
                pos: this.pos.clone(),
                alpha: 1
            });
            
            // Move in dash direction
            this.pos.x += this.dashDirection.x * this.dashSpeed * dt;
            this.pos.y += this.dashDirection.y * this.dashSpeed * dt;
            
            if (this.dashDuration <= 0) {
                this.isDashing = false;
            }
        } else {
            // Normal movement
            this.isMoving = moveDir.x !== 0 || moveDir.y !== 0;
            if (this.isMoving) {
                this.pos.x += moveDir.x * this.speed * dt;
                this.pos.y += moveDir.y * this.speed * dt;
                this.lastMove = new Vector2(moveDir.x, moveDir.y);
                
                // Update facing direction
                if (moveDir.x !== 0) {
                    this.facingRight = moveDir.x > 0;
                }
                
                // Update animation
                this.animTimer += dt;
                if (this.animTimer > 0.1) {
                    this.animTimer = 0;
                    this.animFrame = (this.animFrame + 1) % 4;
                }
            } else {
                this.animFrame = 0;
                this.animTimer = 0;
            }
            
            // Start dash
            if (wantsDash && this.dashCooldown <= 0 && this.isMoving) {
                this.isDashing = true;
                this.dashDuration = this.dashDurationMax;
                this.dashCooldown = this.dashCooldownMax;
                this.dashDirection = this.lastMove.normalize();
            }
        }
        
        // Update dash trail
        for (let i = this.dashTrail.length - 1; i >= 0; i--) {
            this.dashTrail[i].alpha -= dt * 5;
            if (this.dashTrail[i].alpha <= 0) {
                this.dashTrail.splice(i, 1);
            }
        }
        
        // Clamp to playfield
        this.pos.x = clamp(this.pos.x, CONFIG.PLAYFIELD_MARGIN, 
            CONFIG.SCREEN_WIDTH - CONFIG.PLAYFIELD_MARGIN);
        this.pos.y = clamp(this.pos.y, CONFIG.PLAYFIELD_MARGIN, 
            CONFIG.SCREEN_HEIGHT - CONFIG.PLAYFIELD_MARGIN);
        
        // Update angle to face mouse
        if (mousePos) {
            this.angle = this.pos.angleTo(mousePos);
        }
        
        // Update cooldowns
        this.shotCooldown = Math.max(0, this.shotCooldown - dt);
        this.brushCooldown = Math.max(0, this.brushCooldown - dt);
        this.hurtTimer = Math.max(0, this.hurtTimer - dt);
        this.shotFlash = Math.max(0, this.shotFlash - dt);
        
        // Health regeneration
        if (this.healthRegen > 0) {
            this.health = Math.min(this.maxHealth, this.health + this.healthRegen * dt);
        }
        
        let shots = null;
        let brushSwing = null;
        let ultimateBlast = null;
        
        // Ultimate ability
        if (wantsUltimate && this.ultimateCharge >= this.ultimateChargeMax) {
            ultimateBlast = {
                pos: this.pos.clone(),
                radius: 200
            };
            this.ultimateCharge = 0;
        }
        
        // Get active weapon
        const activeWeapon = this.weapons[this.activeWeaponIndex];
        
        // Primary attack (left click) - uses active weapon
        if (wantsFire && mousePos && !this.isDashing) {
            if (activeWeapon.type === 'ranged' && this.shotCooldown <= 0) {
                // Ranged attack - shoot projectile
                const direction = mousePos.sub(this.pos);
                if (direction.lengthSquared() > 0) {
                    // Check for critical hit
                    let damage = this.shotDamage;
                    if (Math.random() < this.critChance) {
                        damage *= 2;
                    }
                    
                    shots = [new ToothpasteShot({
                        pos: this.pos.clone(),
                        direction: direction,
                        speed: this.shotSpeed,
                        damage: damage
                    })];
                    
                    this.shotCooldown = this.shotCooldownBase;
                    this.shotFlash = 0.15;
                }
            } else if (activeWeapon.type === 'melee' && this.brushCooldown <= 0) {
                // Melee attack - sword swing
                brushSwing = {
                    pos: this.pos.clone(),
                    radius: this.brushRadius,
                    angle: this.angle
                };
                this.brushCooldown = this.brushCooldownBase;
                this.isSwinging = true;
                this.swordSwing = 0;
                this.swordSwingDir = this.swordSwingDir * -1;
            }
        }
        
        // Secondary attack (right click) - always sword swing regardless of active weapon
        if (wantsBrush && this.brushCooldown <= 0) {
            brushSwing = {
                pos: this.pos.clone(),
                radius: this.brushRadius,
                angle: this.angle
            };
            this.brushCooldown = this.brushCooldownBase;
            this.isSwinging = true;
            this.swordSwing = 0;
            this.swordSwingDir = this.swordSwingDir * -1;
        }
        
        // Update sword swing animation
        if (this.isSwinging) {
            this.swordSwing += dt * 8; // Animation speed
            if (this.swordSwing >= 1) {
                this.isSwinging = false;
                this.swordSwing = 0;
            }
        }
        
        return { shots, brushSwing, ultimateBlast };
    }
    
    // Add ultimate charge on kill
    addUltimateCharge(amount = 10) {
        this.ultimateCharge = Math.min(this.ultimateChargeMax, this.ultimateCharge + amount);
    }
    
    takeDamage(amount) {
        const reduced = amount * (1 - this.damageReduction);
        this.health = Math.max(0, this.health - reduced);
        this.hurtTimer = 0.25;
    }
    
    heal(amount) {
        this.health = Math.min(this.maxHealth, this.health + amount);
    }
    
    draw(ctx) {
        // Draw dash trail first (behind player)
        for (const trail of this.dashTrail) {
            ctx.save();
            ctx.translate(trail.pos.x, trail.pos.y);
            ctx.globalAlpha = trail.alpha * 0.5;
            
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#00ffff');
            gradient.addColorStop(1, 'transparent');
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            ctx.restore();
        }
        
        ctx.save();
        ctx.translate(this.pos.x, this.pos.y);
        
        // Dash glow effect
        if (this.isDashing) {
            ctx.shadowColor = '#00ffff';
            ctx.shadowBlur = 30;
        }
        
        // Hurt flash
        if (this.hurtTimer > 0) {
            ctx.globalAlpha = 0.7 + Math.sin(this.hurtTimer * 40) * 0.3;
        }
        
        // Try to draw sprite
        const spriteKey = this.isMoving ? 'player_run' : 'player_idle';
        const sprite = AssetLoader.getImage(spriteKey);
        
        if (sprite) {
            // Draw sprite
            const spriteSize = 64;
            ctx.save();
            
            // Flip if facing left
            if (!this.facingRight) {
                ctx.scale(-1, 1);
            }
            
            ctx.drawImage(sprite, -spriteSize / 2, -spriteSize / 2, spriteSize, spriteSize);
            ctx.restore();
            
            // Draw sword if swinging
            if (this.isSwinging) {
                this.drawSword(ctx);
            }
            
            // Shot flash effect
            if (this.shotFlash > 0) {
                ctx.globalAlpha = this.shotFlash / 0.15;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(this.facingRight ? 20 : -20, 0, 8, 0, Math.PI * 2);
                ctx.fill();
            }
        } else {
            // Fallback: draw circle
            const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, this.radius);
            gradient.addColorStop(0, '#8eeaff');
            gradient.addColorStop(0.7, CONFIG.COLORS.PLAYER);
            gradient.addColorStop(1, '#4ac0e8');
            
            ctx.fillStyle = gradient;
            ctx.beginPath();
            ctx.arc(0, 0, this.radius, 0, Math.PI * 2);
            ctx.fill();
            
            // Outline
            ctx.strokeStyle = '#4ac0e8';
            ctx.lineWidth = 3;
            ctx.stroke();
            
            // Direction indicator
            ctx.rotate(this.angle);
            ctx.fillStyle = '#ffffff';
            ctx.beginPath();
            ctx.moveTo(this.radius + 5, 0);
            ctx.lineTo(this.radius - 8, -8);
            ctx.lineTo(this.radius - 8, 8);
            ctx.closePath();
            ctx.fill();
            
            // Shot flash effect
            if (this.shotFlash > 0) {
                ctx.globalAlpha = this.shotFlash / 0.15;
                ctx.fillStyle = '#ffffff';
                ctx.beginPath();
                ctx.arc(this.radius, 0, 8, 0, Math.PI * 2);
                ctx.fill();
            }
            
            // Draw sword if swinging (fallback mode)
            if (this.isSwinging) {
                this.drawSword(ctx);
            }
        }
        
        ctx.restore();
        
        // Health bar below player
        this.drawHealthBar(ctx);
    }
    
    // drawGun fonksiyonu kaldırıldı
    
    drawSword(ctx) {
        // Calculate swing arc angle
        const swingArc = Math.PI * 0.8; // Total arc in radians
        const startAngle = this.angle - swingArc / 2 * this.swordSwingDir;
        const currentAngle = startAngle + swingArc * this.swordSwing * this.swordSwingDir;
        
        ctx.save();
        ctx.rotate(currentAngle);
        // Distance from player center (reach towards hand)
        ctx.translate(this.radius + 5, 0);
        
        const swordImg = AssetLoader.getImage('weapon_sword');
        // Sword sprite points roughly up-right by default, rotate +45° to align with angle
        ctx.rotate(Math.PI / 4);
        if (swordImg) {
            const scale = 1.0;
            const w = swordImg.width * scale;
            const h = swordImg.height * scale;
            // Pivot around the handle (tuned for 48x48 sword sprites)
            const pivotX = (13 / 48) * w;
            const pivotY = (34 / 48) * h;
            const prevSmoothing = ctx.imageSmoothingEnabled;
            ctx.imageSmoothingEnabled = false;
            ctx.drawImage(swordImg, -pivotX, -pivotY, w, h);
            ctx.imageSmoothingEnabled = prevSmoothing;
        } else {
            // Fallback: emoji
            ctx.font = '36px Arial';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('⚔️', 0, 0);
        }
        
        // Swing trail effect
        const trailAlpha = (1 - this.swordSwing) * 0.4;
        ctx.globalAlpha = trailAlpha;
        ctx.fillStyle = '#ffffff';
        ctx.beginPath();
        ctx.arc(15, 0, 8, 0, Math.PI * 2);
        ctx.fill();
        
        ctx.restore();
    }
    
    drawHealthBar(ctx) {
        const barWidth = 50;
        const barHeight = 6;
        const x = this.pos.x - barWidth / 2;
        const y = this.pos.y + this.radius + 10;
        
        // Background
        ctx.fillStyle = 'rgba(0, 0, 0, 0.5)';
        ctx.fillRect(x, y, barWidth, barHeight);
        
        // Health
        const healthRatio = this.health / this.maxHealth;
        const healthColor = healthRatio > 0.5 ? '#78dcb4' : 
                           healthRatio > 0.25 ? '#ffdd7c' : '#ff6392';
        ctx.fillStyle = healthColor;
        ctx.fillRect(x, y, barWidth * healthRatio, barHeight);
        
        // Border
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 1;
        ctx.strokeRect(x, y, barWidth, barHeight);
    }
}
