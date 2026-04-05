/**
 * Game - Main game logic
 */

import { CONFIG, AFFIXES, CLASSES } from '../config.js';
import { Vector2, randomChoice, randomRange, clamp } from '../utils/Math.js';
import { Player } from '../entities/Player.js';
import { Germ, SpitterGerm, TankGerm, EliteGerm, SpawnerGerm, MinionGerm, ShieldedGerm, HealerGerm } from '../entities/Germ.js';
import { BossGerm, MiniBoss } from '../entities/Boss.js';
import { Powerup } from '../entities/Powerup.js';
import { ComboSystem } from '../systems/ComboSystem.js';
import { ParticleSystem } from '../systems/ParticleSystem.js';
import { FloatingTextSystem } from '../systems/FloatingTextSystem.js';
import { AssetLoader } from '../utils/AssetLoader.js';

export class Game {
    constructor(options) {
        this.engine = options.engine;
        this.audio = options.audio;
        this.saveData = options.saveData;
        
        // Get class modifiers
        const selectedClass = options.selectedClass || 'fircaci';
        const classMods = CLASSES[selectedClass]?.base_mods || {};
        
        // Combine upgrade with class mods
        const combinedMods = this.combineMods(options.upgrade || {}, classMods);
        
        // Roll affix for this wave
        this.affix = randomChoice(AFFIXES);
        
        // Create player
        this.player = new Player({
            pos: new Vector2(CONFIG.SCREEN_WIDTH / 2, CONFIG.SCREEN_HEIGHT / 2),
            affix: this.affix,
            upgrade: combinedMods
        });
        
        // Game entities
        this.germs = [];
        this.powerups = [];
        this.projectiles = [];
        this.enemyProjectiles = [];
        this.boss = null;
        this.miniBoss = null;
        
        // Game state
        this.score = 0;
        this.kills = 0;
        this.wave = 1;
        this.waveKills = 0; // Kills in current wave
        this.killsToNextWave = 12; // Kills needed to advance wave
        this.spawnTimer = CONFIG.GERM_SPAWN_INTERVAL_START;
        this.spawnInterval = CONFIG.GERM_SPAWN_INTERVAL_START;
        this.nextBossWave = CONFIG.BOSS_WAVE_INTERVAL;
        
        // Gold/Currency system
        this.gold = 0;
        this.goldEarned = 0;
        
        // Elite spawn chance (increases with wave)
        this.eliteChance = 0.05;
        
        // Synergy tracking
        this.synergies = {
            speedBonus: 0,
            damageBonus: 0,
            defenseBonus: 0,
            critBonus: 0,
            regenBonus: 0
        };
        this.appliedUpgrades = []; // Track applied upgrades for synergy calc
        
        // Systems
        this.combo = new ComboSystem();
        this.particles = new ParticleSystem();
        this.texts = new FloatingTextSystem();
        
        // Stats tracking
        this.totalKills = 0;
        this.brushKills = 0;
        this.eliteKills = 0;
        
        // Wave reward system
        this.isSelectingReward = false;
        this.availableRewards = [];
        
        // Shop system
        this.isInShop = false;
        this.shopItems = [];
        
        // Risk/Reward system
        this.isChoosingRisk = false;
        this.consecutiveWaves = 0; // Waves completed without taking reward
        
        // Player name
        this.playerName = this.saveData?.playerName || 'Oyuncu';
        
        // Play music
        this.audio?.playMusic();
        
        // Update HUD
        this.updateHUD();
    }
    
    // Wave rewards definition
    static WAVE_REWARDS = [
        // Common rewards
        { id: 'heal', name: 'Şifa', icon: '❤️', desc: '+30 Can', rarity: 'common', apply: (player) => player.heal(30) },
        { id: 'speed', name: 'Hız', icon: '💨', desc: '+15% Hareket', rarity: 'common', apply: (player) => player.speed *= 1.15 },
        { id: 'damage', name: 'Güç', icon: '💪', desc: '+20% Hasar', rarity: 'common', tags: ['damage'], apply: (player) => player.shotDamage *= 1.2 },
        { id: 'firerate', name: 'Ateş Hızı', icon: '🔫', desc: '+15% Ateş Hızı', rarity: 'common', tags: ['damage'], apply: (player) => player.shotCooldownBase *= 0.85 },
        { id: 'brush', name: 'Fırça Gücü', icon: '🪥', desc: '+25% Fırça Hasarı', rarity: 'common', tags: ['damage'], apply: (player) => player.brushDamage *= 1.25 },
        
        // Rare rewards
        { id: 'maxhp', name: 'Dayanıklılık', icon: '🛡️', desc: '+25 Maks Can', rarity: 'rare', tags: ['defense'], apply: (player) => { player.maxHealth += 25; player.heal(25); } },
        { id: 'crit', name: 'Kritik', icon: '⚡', desc: '+10% Kritik Şans', rarity: 'rare', tags: ['crit', 'damage'], apply: (player) => player.critChance += 0.1 },
        { id: 'regen', name: 'Rejenerasyon', icon: '💚', desc: '+2 Can/sn', rarity: 'rare', tags: ['regen', 'defense'], apply: (player) => player.healthRegen += 2 },
        { id: 'armor', name: 'Zırh', icon: '🔷', desc: '+10% Hasar Azaltma', rarity: 'rare', tags: ['defense'], apply: (player) => player.damageReduction = Math.min(0.5, player.damageReduction + 0.1) },
        { id: 'dashcd', name: 'Çevik Atılma', icon: '🌀', desc: '-0.3sn Atılma CD', rarity: 'rare', tags: ['speed'], apply: (player) => player.dashCooldownMax = Math.max(0.5, player.dashCooldownMax - 0.3) },
        
        // Epic rewards
        { id: 'fullheal', name: 'Tam Şifa', icon: '💖', desc: 'Tam Can Doldur', rarity: 'epic', tags: ['defense'], apply: (player) => player.health = player.maxHealth },
        { id: 'ultcharge', name: 'Enerji Patlaması', icon: '⭐', desc: '+50 Ultimate Şarj', rarity: 'epic', tags: ['damage'], apply: (player) => player.addUltimateCharge(50) },
        { id: 'multihit', name: 'Çoklu Vuruş', icon: '🎯', desc: '+30% Tüm Hasar', rarity: 'epic', tags: ['damage'], apply: (player) => { player.shotDamage *= 1.3; player.brushDamage *= 1.3; } },
    ];
    
    // Shop items - can be purchased with gold
    static SHOP_ITEMS = [
        // Weapons
        { id: 'tripleshot', name: 'Üçlü Atış', icon: '🔱', desc: '3 mermi ateşle', cost: 80, rarity: 'epic', tags: ['damage'], apply: (player) => { player.tripleShot = true; } },
        { id: 'piercing', name: 'Delici Mermi', icon: '📍', desc: 'Mermiler düşmandan geçer', cost: 60, rarity: 'rare', tags: ['damage'], apply: (player) => { player.piercingShots = true; } },
        { id: 'bigbrush', name: 'Dev Fırça', icon: '🖌️', desc: '+50% Fırça Menzili', cost: 50, rarity: 'rare', tags: ['damage'], apply: (player) => player.brushRadius *= 1.5 },
        
        // Defense
        { id: 'shield', name: 'Enerji Kalkanı', icon: '🛡️', desc: 'Hasarın %15 ini blokla', cost: 70, rarity: 'rare', tags: ['defense'], apply: (player) => player.damageReduction += 0.15 },
        { id: 'secondwind', name: 'İkinci Şans', icon: '💫', desc: 'Ölünce 1 kez canlan', cost: 100, rarity: 'epic', tags: ['defense'], apply: (player) => { player.secondWind = true; } },
        { id: 'lifesteal', name: 'Can Çalma', icon: '🧛', desc: 'Hasarın %10 u can olur', cost: 90, rarity: 'epic', tags: ['damage', 'regen'], apply: (player) => { player.lifesteal = 0.1; } },
        
        // Utility
        { id: 'magnet', name: 'Mıknatıs', icon: '🧲', desc: 'Güçlendirmeler sana gelir', cost: 40, rarity: 'common', tags: ['utility'], apply: (player) => { player.magnetRange = 150; } },
        { id: 'lucky', name: 'Şanslı', icon: '🍀', desc: '+20% Drop şansı', cost: 45, rarity: 'common', tags: ['utility'], apply: (player) => { player.luckBonus = 0.2; } },
        { id: 'goldbonus', name: 'Altın Avcısı', icon: '💰', desc: '+30% Altın kazanımı', cost: 35, rarity: 'common', tags: ['utility'], apply: (player) => { player.goldBonus = 0.3; } },
    ];
    
    // Synergy definitions - bonuses for having multiple upgrades of same type
    static SYNERGIES = {
        damage: [
            { count: 2, name: 'Saldırgan', bonus: '+10% Hasar', apply: (player) => player.shotDamage *= 1.1 },
            { count: 4, name: 'Yıkıcı', bonus: '+15% Kritik', apply: (player) => player.critChance += 0.15 },
        ],
        defense: [
            { count: 2, name: 'Dayanıklı', bonus: '+20 Max Can', apply: (player) => { player.maxHealth += 20; player.heal(20); } },
            { count: 4, name: 'Yenilmez', bonus: '+20% Hasar Azaltma', apply: (player) => player.damageReduction = Math.min(0.6, player.damageReduction + 0.2) },
        ],
        speed: [
            { count: 2, name: 'Çevik', bonus: '+15% Hız', apply: (player) => player.speed *= 1.15 },
            { count: 3, name: 'Rüzgar', bonus: 'Dash hasarı verir', apply: (player) => { player.dashDamage = 20; } },
        ],
        regen: [
            { count: 2, name: 'Şifacı', bonus: '+3 Can/sn', apply: (player) => player.healthRegen += 3 },
        ],
        crit: [
            { count: 2, name: 'Keskin', bonus: '+2x Kritik Hasar', apply: (player) => { player.critDamage = 3; } },
        ],
    };
    
    combineMods(upgrade, classMods) {
        const combined = { ...upgrade };
        
        for (const [key, value] of Object.entries(classMods)) {
            if (key in combined) {
                if (key.includes('mult')) {
                    combined[key] *= value;
                } else {
                    combined[key] += value;
                }
            } else {
                combined[key] = value;
            }
        }
        
        return combined;
    }

    getAutoAimTargetPos(fromPos) {
        let bestPos = null;
        let bestDistSq = Infinity;
        
        const consider = (entity) => {
            if (!entity?.pos) return;
            const dx = entity.pos.x - fromPos.x;
            const dy = entity.pos.y - fromPos.y;
            const distSq = dx * dx + dy * dy;
            if (distSq < bestDistSq) {
                bestDistSq = distSq;
                bestPos = entity.pos;
            }
        };
        
        for (const germ of this.germs) {
            consider(germ);
        }
        consider(this.miniBoss);
        consider(this.boss);
        
        return bestPos ? bestPos.clone() : null;
    }
    
    update(dt) {
        // Don't update while selecting reward
        if (this.isSelectingReward) {
            return;
        }
        
        const input = this.engine.input;
        
        // Update player
        const moveDir = input.getMovementDir();
        const wantsFire = input.wantsFire();
        const wantsBrush = input.wantsBrush();
        const wantsDash = input.wantsDash();
        const wantsUltimate = input.wantsUltimate();
        const weaponSwitch = input.wantsWeaponSwitch();

        let mousePos = this.engine.getMousePos();
        const touchMode = input.touchMode || this.engine.saveData?.settings?.touchMode;
        
        // Mobile/touch fallback: aim at nearest enemy unless the player is actively aiming on the canvas.
        if (touchMode && !input.isAiming()) {
            const autoAimPos = this.getAutoAimTargetPos(this.player.pos);
            if (autoAimPos) {
                mousePos = autoAimPos;
            } else {
                const moveVec = new Vector2(moveDir.x, moveDir.y);
                const hasMove = moveVec.lengthSquared() > 0;
                const lastMove = this.player.lastMove || new Vector2(0, 0);
                const hasLastMove = lastMove.lengthSquared() > 0;
                
                const aimDir = hasMove
                    ? moveVec.normalize()
                    : (hasLastMove ? lastMove.normalize() : new Vector2(1, 0));
                
                mousePos = this.player.pos.addScaled(aimDir, 180);
            }
        }
        
        const { shots, brushSwing, ultimateBlast } = this.player.update(dt, moveDir, mousePos, wantsFire, wantsBrush, wantsDash, wantsUltimate, weaponSwitch);
        
        // Handle player shots
        if (shots && shots.length > 0) {
            this.projectiles.push(...shots);
            this.audio?.playSfx('shoot');
        }
        
        // Handle brush attack
        if (brushSwing) {
            this.audio?.playSfx('brush');
            const brushKills = this.applyBrushDamage(brushSwing);
            this.brushKills += brushKills;
        }
        
        // Handle ultimate blast
        if (ultimateBlast) {
            this.applyUltimateBlast(ultimateBlast);
            this.audio?.playSfx('brush'); // Use brush sound for now
        }
        
        // Check for combo burst (E key)
        if (input.wantsComboBurst()) {
            const burst = this.combo.triggerBurst();
            if (burst) {
                this.applyComboBurst(burst);
            }
        }
        
        // Spawn enemies
        this.maybeSpawnGerm(dt);
        
        // Maybe spawn mini-boss
        this.maybeSpawnMiniBoss();
        
        // Update entities
        this.updateProjectiles(dt);
        this.updateGerms(dt);
        this.updateEnemyProjectiles(dt);
        this.updateBoss(dt);
        this.updateMiniBoss(dt);
        this.updatePowerups(dt);
        
        // Update systems
        this.combo.update(dt);
        this.particles.update(dt);
        this.texts.update(dt);
        
        // Update HUD
        this.updateHUD();
        
        // Check game over
        if (this.player.health <= 0) {
            this.engine.gameOver(this.score, this.wave);
        }
    }
    
    maybeSpawnGerm(dt) {
        this.spawnTimer -= dt;
        
        if (this.spawnTimer <= 0) {
            this.spawnGerm();
            this.spawnInterval = Math.max(
                CONFIG.GERM_SPAWN_INTERVAL_MIN,
                this.spawnInterval - CONFIG.GERM_SPAWN_ACCELERATION
            );
            this.spawnTimer = this.spawnInterval;
        }
    }
    
    spawnGerm() {
        // Spawn from edge
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (side) {
            case 0: // Top
                x = randomRange(0, CONFIG.SCREEN_WIDTH);
                y = -30;
                break;
            case 1: // Right
                x = CONFIG.SCREEN_WIDTH + 30;
                y = randomRange(0, CONFIG.SCREEN_HEIGHT);
                break;
            case 2: // Bottom
                x = randomRange(0, CONFIG.SCREEN_WIDTH);
                y = CONFIG.SCREEN_HEIGHT + 30;
                break;
            case 3: // Left
                x = -30;
                y = randomRange(0, CONFIG.SCREEN_HEIGHT);
                break;
        }
        
        const pos = new Vector2(x, y);
        
        // Choose germ type based on wave and randomness
        const roll = Math.random();
        let germ;
        
        // Elite chance increases with wave
        const eliteRoll = Math.random();
        const eliteChance = this.eliteChance + (this.wave - 1) * 0.02; // +2% per wave
        const isElite = eliteRoll < eliteChance && this.wave >= 2;
        
        if (isElite) {
            // Spawn elite enemy
            germ = new EliteGerm(pos, this.wave, this.affix);
        } else if (this.wave >= 5 && roll < 0.08) {
            // Healer germ (wave 5+)
            germ = new HealerGerm(pos, this.wave, this.affix);
        } else if (this.wave >= 4 && roll < 0.12) {
            // Spawner germ (wave 4+)
            germ = new SpawnerGerm(pos, this.wave, this.affix);
        } else if (this.wave >= 3 && roll < 0.18) {
            // Shielded germ (wave 3+)
            germ = new ShieldedGerm(pos, this.wave, this.affix);
        } else if (this.wave >= 3 && roll < 0.28) {
            // Tank germ
            germ = new TankGerm(pos, this.wave, this.affix);
        } else if (this.wave >= 2 && roll < 0.45) {
            // Spitter germ
            germ = new SpitterGerm(pos, this.wave, this.affix);
        } else {
            // Basic germ
            germ = new Germ(pos, this.wave, this.affix);
        }
        
        this.germs.push(germ);
        
        // Check for boss wave (every 5 waves)
        if (this.wave % 5 === 0 && this.waveKills >= this.killsToNextWave - 3 && !this.boss) {
            this.spawnBoss();
        }
    }
    
    // Get random spawn position from edge of screen
    getRandomSpawnPosition() {
        const side = Math.floor(Math.random() * 4);
        let x, y;
        
        switch (side) {
            case 0: // Top
                x = randomRange(50, CONFIG.SCREEN_WIDTH - 50);
                y = -40;
                break;
            case 1: // Right
                x = CONFIG.SCREEN_WIDTH + 40;
                y = randomRange(50, CONFIG.SCREEN_HEIGHT - 50);
                break;
            case 2: // Bottom
                x = randomRange(50, CONFIG.SCREEN_WIDTH - 50);
                y = CONFIG.SCREEN_HEIGHT + 40;
                break;
            case 3: // Left
            default:
                x = -40;
                y = randomRange(50, CONFIG.SCREEN_HEIGHT - 50);
                break;
        }
        
        return new Vector2(x, y);
    }
    
    spawnBoss() {
        const pos = new Vector2(CONFIG.SCREEN_WIDTH / 2, -60);
        this.boss = new BossGerm(pos, this.wave, this.affix);
        
        // Show boss bar
        document.getElementById('boss-bar').style.display = 'block';
    }
    
    updateProjectiles(dt) {
        for (let i = this.projectiles.length - 1; i >= 0; i--) {
            const proj = this.projectiles[i];
            proj.update(dt);
            
            if (!proj.alive) {
                this.projectiles.splice(i, 1);
                continue;
            }
            
            // Check collision with germs
            for (const germ of this.germs) {
                if (proj.hitCircle(germ.pos, germ.radius)) {
                    const { killed, damage } = germ.takeDamage(proj.damage);
                    proj.alive = false;
                    
                    this.particles.burst(germ.pos, CONFIG.COLORS.SHOT, 4);
                    this.combo.registerHit();
                    
                    if (killed) {
                        this.handleEnemyKill(germ);
                    }
                    break;
                }
            }
            
            // Check collision with mini-boss
            if (this.miniBoss && proj.alive && proj.hitCircle(this.miniBoss.pos, this.miniBoss.radius)) {
                const { killed, damage } = this.miniBoss.takeDamage(proj.damage);
                proj.alive = false;
                
                this.particles.burst(this.miniBoss.pos, this.miniBoss.color, 4);
                this.combo.registerHit();
                
                if (killed) {
                    this.handleMiniBossKill();
                }
            }
            
            // Check collision with boss
            if (this.boss && proj.alive && proj.hitCircle(this.boss.pos, this.boss.radius)) {
                const { killed, damage } = this.boss.takeDamage(proj.damage);
                proj.alive = false;
                
                this.particles.burst(this.boss.pos, CONFIG.COLORS.BOSS, 6);
                this.combo.registerHit();
                
                if (killed) {
                    this.handleBossKill();
                }
            }
        }
    }
    
    updateGerms(dt) {
        for (let i = this.germs.length - 1; i >= 0; i--) {
            const germ = this.germs[i];
            
            try {
                const result = germ.update(this.player.pos, dt);
                
                // Handle different return types
                if (result && result !== null) {
                    // Array result - can be projectiles, spawns, etc.
                    if (Array.isArray(result) && result.length > 0) {
                        for (const item of result) {
                            if (!item) continue;
                            
                            // Spawner minion spawn
                            if (item.type === 'minion' && item.pos) {
                                const offset = Vector2.random(30);
                                const spawnPos = item.pos.add ? item.pos.add(offset) : new Vector2(item.pos.x + offset.x, item.pos.y + offset.y);
                                const minion = new MinionGerm(spawnPos, this.wave, this.affix);
                                this.germs.push(minion);
                                this.particles.burst(item.pos, '#ffaacc', 8);
                            }
                            // GermProjectile (has pos and vel - from SpitterGerm, etc.)
                            else if (item.pos && item.vel && item.alive !== undefined) {
                                this.enemyProjectiles.push(item);
                            }
                        }
                    }
                    // Healer germ heals allies
                    else if (result.healPulse && result.healPulse.pos) {
                        const { pos, range, amount } = result.healPulse;
                        for (const ally of this.germs) {
                            if (ally !== germ && ally.pos && pos.distanceTo && pos.distanceTo(ally.pos) <= range) {
                                ally.health = Math.min(ally.maxHealth, ally.health + amount);
                                this.particles.burst(ally.pos, '#44ff88', 3);
                            }
                        }
                        // Visual heal effect
                        this.particles.ring(pos, '#44ff88', range);
                    }
                }
            } catch (err) {
                console.error('Error updating germ:', germ?.type, err);
            }
            
            // Check collision with player
            if (germ.collides(this.player.pos, this.player.radius)) {
                if (germ.canBite()) {
                    this.player.takeDamage(germ.contactDamage);
                    germ.setBiteCooldown();
                    this.particles.burst(this.player.pos, germ.color || CONFIG.COLORS.GERM, 6);
                    this.audio?.playSfx('hurt');
                    
                    // Elite vampir lifesteal
                    if (germ.lifesteal) {
                        germ.health = Math.min(germ.maxHealth, germ.health + germ.contactDamage * 0.5);
                    }
                }
            }
        }
    }
    
    updateEnemyProjectiles(dt) {
        for (let i = this.enemyProjectiles.length - 1; i >= 0; i--) {
            const proj = this.enemyProjectiles[i];
            proj.update(dt);
            
            if (!proj.alive) {
                this.enemyProjectiles.splice(i, 1);
                continue;
            }
            
            // Check collision with player
            if (proj.collides(this.player.pos, this.player.radius)) {
                this.player.takeDamage(proj.damage);
                proj.alive = false;
                this.particles.burst(this.player.pos, CONFIG.COLORS.ENEMY_SHOT, 4);
                this.audio?.playSfx('hurt');
            }
        }
    }
    
    updateBoss(dt) {
        if (!this.boss) return;
        
        const shots = this.boss.update(this.player.pos, dt);
        
        if (shots && shots.length > 0) {
            this.enemyProjectiles.push(...shots);
        }
        
        // Update boss health bar
        const healthFill = document.getElementById('boss-health-fill');
        const healthRatio = this.boss.health / this.boss.maxHealth;
        healthFill.style.width = `${healthRatio * 100}%`;
        
        // Check collision with player
        if (this.boss.collides(this.player.pos, this.player.radius)) {
            this.player.takeDamage(CONFIG.GERM_CONTACT_DAMAGE * 1.5);
            this.particles.burst(this.player.pos, CONFIG.COLORS.BOSS, 8);
        }
    }
    
    // Mini-boss spawn check
    maybeSpawnMiniBoss() {
        // Spawn mini-boss on waves 3 and 6 (and every 3 waves after)
        if (!this.miniBoss && !this.boss && (this.wave === 3 || this.wave === 6 || (this.wave > 6 && this.wave % 3 === 0))) {
            // Only spawn once per wave
            if (!this.miniBossSpawnedThisWave) {
                const types = ['speeder', 'tank', 'toxic'];
                const type = types[this.wave % 3];
                
                const spawnPos = this.getRandomSpawnPosition();
                this.miniBoss = new MiniBoss(spawnPos, this.wave, type);
                this.miniBossSpawnedThisWave = true;
                
                this.texts.add(
                    new Vector2(CONFIG.SCREEN_WIDTH / 2, 100),
                    `⚠️ ${this.miniBoss.name} GELDİ!`,
                    this.miniBoss.color
                );
                
                this.audio?.playSfx('wave');
            }
        }
    }
    
    updateMiniBoss(dt) {
        if (!this.miniBoss) return;
        
        const shots = this.miniBoss.update(this.player.pos, dt);
        
        if (shots && shots.length > 0) {
            this.enemyProjectiles.push(...shots);
        }
        
        // Check collision with player
        const dist = this.player.pos.distanceTo(this.miniBoss.pos);
        if (dist < this.player.radius + this.miniBoss.radius) {
            this.player.takeDamage(CONFIG.GERM_CONTACT_DAMAGE * 1.2);
            this.particles.burst(this.player.pos, this.miniBoss.color, 6);
        }
    }
    
    handleMiniBossKill() {
        this.score += 150;
        
        // Big death explosion effects
        this.particles.deathExplosion(this.miniBoss.pos, this.miniBoss.color, this.miniBoss.radius);
        this.particles.ring(this.miniBoss.pos, '#ffffff', 120);
        this.particles.screenFlash(this.miniBoss.color, 0.3);
        
        this.texts.add(this.miniBoss.pos, 'Mini-Boss Yenildi!', '#ffdd7c');
        this.texts.add(this.miniBoss.pos.add(new Vector2(0, 30)), '+150', CONFIG.COLORS.POWERUP);
        
        // Add fluoride bonus
        this.fluorideEarned = (this.fluorideEarned || 0) + 25;
        this.texts.add(this.miniBoss.pos.add(new Vector2(0, 50)), '+25 💎', '#ffdd7c');
        
        // Add ultimate charge
        this.player.addUltimateCharge(30);
        
        // Drop powerups
        for (let i = 0; i < 2; i++) {
            const offset = Vector2.random(30);
            this.powerups.push(new Powerup(this.miniBoss.pos.add(offset)));
        }
        
        this.audio?.playSfx('kill');
        this.miniBoss = null;
    }
    
    updatePowerups(dt) {
        for (let i = this.powerups.length - 1; i >= 0; i--) {
            const powerup = this.powerups[i];
            powerup.update(dt);
            
            // Check collision with player
            if (powerup.collides(this.player.pos, this.player.radius)) {
                powerup.apply(this.player, this.combo);
                this.powerups.splice(i, 1);
                
                this.particles.burst(powerup.pos, CONFIG.COLORS.POWERUP, 8);
                this.texts.add(powerup.pos, powerup.label, CONFIG.COLORS.POWERUP);
                this.audio?.playSfx('powerup');
            }
        }
    }
    
    applyBrushDamage(brushSwing) {
        const { pos, radius, angle } = brushSwing;
        let kills = 0;
        
        // Visual effect - sword slash arc
        this.particles.ring(pos, '#ffffff', radius * 0.8);
        
        // Create slash trail particles
        for (let i = 0; i < 8; i++) {
            const slashAngle = (angle || 0) + (i - 4) * 0.15;
            const slashPos = new Vector2(
                pos.x + Math.cos(slashAngle) * radius * 0.6,
                pos.y + Math.sin(slashAngle) * radius * 0.6
            );
            this.particles.burst(slashPos, '#ffdd88', 2);
        }
        
        // Collect germs to damage first (to avoid modifying array while iterating)
        const germsToProcess = [];
        for (let i = this.germs.length - 1; i >= 0; i--) {
            const germ = this.germs[i];
            if (germ && pos.distanceTo(germ.pos) <= radius + germ.radius) {
                germsToProcess.push(germ);
            }
        }
        
        // Now process damage
        for (const germ of germsToProcess) {
            const { killed, damage } = germ.takeDamage(this.player.brushDamage);
            this.particles.burst(germ.pos, '#ff8844', 4);
            
            if (killed) {
                this.handleEnemyKill(germ, true);
                kills++;
            }
        }
        
        // Damage mini-boss
        if (this.miniBoss && pos.distanceTo(this.miniBoss.pos) <= radius + this.miniBoss.radius) {
            const { killed, damage } = this.miniBoss.takeDamage(this.player.brushDamage);
            this.particles.burst(this.miniBoss.pos, '#ff8844', 5);
            
            if (killed) {
                this.handleMiniBossKill();
            }
        }
        
        // Damage boss
        if (this.boss && pos.distanceTo(this.boss.pos) <= radius + this.boss.radius) {
            const { killed, damage } = this.boss.takeDamage(this.player.brushDamage);
            this.particles.burst(this.boss.pos, '#ff8844', 7);
            
            if (killed) {
                this.handleBossKill();
            }
        }
        
        return kills;
    }
    
    // Ultimate ability - big area damage
    applyUltimateBlast(blast) {
        const { pos, radius } = blast;
        
        // Big visual effect - multiple rings (using arrow function to preserve 'this')
        for (let r = 50; r <= radius; r += 50) {
            const ringRadius = r;
            const particles = this.particles;
            setTimeout(() => {
                if (particles) {
                    particles.ring(pos, '#00ffff', ringRadius);
                }
            }, (r - 50) * 2);
        }
        
        // Flash effect
        this.particles.burst(pos, '#ffffff', 30);
        
        // Collect germs to kill first (to avoid modifying array while iterating)
        const germsToKill = [];
        for (let i = this.germs.length - 1; i >= 0; i--) {
            const germ = this.germs[i];
            if (germ && pos.distanceTo(germ.pos) <= radius + germ.radius) {
                germsToKill.push(germ);
            }
        }
        
        // Now kill them
        for (const germ of germsToKill) {
            // Create death effect
            this.particles.burst(germ.pos, '#00ffff', 20);
            this.handleEnemyKill(germ, false);
        }
        
        // Heavy damage to boss
        if (this.boss && pos.distanceTo(this.boss.pos) <= radius + this.boss.radius) {
            const { killed } = this.boss.takeDamage(100); // Big damage
            this.particles.burst(this.boss.pos, '#00ffff', 25);
            
            if (killed) {
                this.handleBossKill();
            }
        }
        
        // Heavy damage to mini-boss
        if (this.miniBoss && pos.distanceTo(this.miniBoss.pos) <= radius + this.miniBoss.radius) {
            const { killed } = this.miniBoss.takeDamage(60);
            this.particles.burst(this.miniBoss.pos, '#00ffff', 20);
            
            if (killed) {
                this.handleMiniBossKill();
            }
        }
        
        // Floating text
        this.texts.add(pos, 'ULTIMATE!', '#00ffff');
    }
    
    // Combo burst - area damage when combo is x3+
    applyComboBurst(burst) {
        const pos = this.player.pos;
        const { damage, radius } = burst;
        
        // Visual effects - expanding ring with combo color
        this.particles.ring(pos, '#ffdd7c', radius);
        this.particles.burst(pos, '#ffdd7c', 25);
        
        // Screen flash effect
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const x = pos.x + Math.cos(angle) * radius * 0.7;
            const y = pos.y + Math.sin(angle) * radius * 0.7;
            this.particles.burst(new Vector2(x, y), '#ffaa00', 5);
        }
        
        // Collect germs to damage/kill first (to avoid modifying array while iterating)
        const germsToProcess = [];
        for (let i = this.germs.length - 1; i >= 0; i--) {
            const germ = this.germs[i];
            if (germ && pos.distanceTo(germ.pos) <= radius + germ.radius) {
                germsToProcess.push(germ);
            }
        }
        
        // Now process damage
        for (const germ of germsToProcess) {
            const { killed } = germ.takeDamage(damage);
            this.particles.burst(germ.pos, '#ffdd7c', 8);
            
            if (killed) {
                this.handleEnemyKill(germ, false);
            }
        }
        
        // Damage mini-boss
        if (this.miniBoss && pos.distanceTo(this.miniBoss.pos) <= radius + this.miniBoss.radius) {
            const { killed } = this.miniBoss.takeDamage(damage);
            this.particles.burst(this.miniBoss.pos, '#ffdd7c', 12);
            
            if (killed) {
                this.handleMiniBossKill();
            }
        }
        
        // Damage boss
        if (this.boss && pos.distanceTo(this.boss.pos) <= radius + this.boss.radius) {
            const { killed } = this.boss.takeDamage(damage);
            this.particles.burst(this.boss.pos, '#ffdd7c', 15);
            
            if (killed) {
                this.handleBossKill();
            }
        }
        
        this.texts.add(pos, `KOMBO PATLAMASI! ${damage}`, '#ffdd7c');
        this.audio?.playSfx('brush');
    }
    
    handleEnemyKill(germ, isBrush = false) {
        // Safety check
        if (!germ || !germ.pos) return;
        
        // Remove germ (check if not already removed)
        const index = this.germs.indexOf(germ);
        if (index > -1) {
            this.germs.splice(index, 1);
        } else {
            // Already removed, skip processing
            return;
        }
        
        // Handle elite death effects
        if (germ.isElite) {
            this.eliteKills++;
            
            // Elite special death effects
            if (germ.explodes) {
                // Damage nearby enemies and player
                this.particles.ring(germ.pos, '#ff8800', 100);
                for (const other of this.germs) {
                    if (germ.pos.distanceTo(other.pos) < 100) {
                        other.takeDamage(30);
                    }
                }
                if (germ.pos.distanceTo(this.player.pos) < 100) {
                    this.player.takeDamage(15);
                }
            }
            
            if (germ.splits) {
                // Spawn 2 smaller germs
                for (let i = 0; i < 2; i++) {
                    const offset = Vector2.random(25);
                    const minion = new MinionGerm(germ.pos.add(offset), this.wave, this.affix);
                    minion.health *= 1.5;
                    minion.maxHealth = minion.health;
                    this.germs.push(minion);
                }
            }
        }
        
        // Death explosion effect
        this.particles.deathExplosion(germ.pos, germ.color || CONFIG.COLORS.GERM, germ.radius);
        this.combo.registerKill();
        this.audio?.playSfx('kill');
        
        // Score calculation with enemy type bonuses
        const typeScores = {
            'grunt': 10, 'spitter': 20, 'tank': 30, 'shielded': 25,
            'spawner': 40, 'healer': 35, 'elite': 50, 'minion': 5
        };
        const baseScore = typeScores[germ.type] || 10;
        const eliteMultiplier = germ.isElite ? (germ.rewardMult || 2) : 1;
        const scoreMultiplier = this.affix.score || 1;
        const comboMultiplier = this.combo.multiplier;
        const finalScore = Math.round(baseScore * eliteMultiplier * scoreMultiplier * comboMultiplier);
        
        this.score += finalScore;
        this.kills++;
        this.totalKills++;
        
        // Gold earned per kill
        const baseGold = germ.isElite ? 8 : (typeScores[germ.type] >= 25 ? 3 : 1);
        const goldBonus = this.player.goldBonus || 0;
        const goldEarned = Math.floor(baseGold * (1 + goldBonus));
        this.gold += goldEarned;
        this.goldEarned += goldEarned;
        
        // Earn fluoride per kill
        const fluoridePerKill = germ.isElite ? 5 : (germ.type === 'tank' ? 3 : germ.type === 'spitter' ? 2 : 1);
        this.fluorideEarned = (this.fluorideEarned || 0) + fluoridePerKill;
        
        // Add ultimate charge
        const ultimateCharge = germ.isElite ? 15 : (germ.type === 'tank' ? 8 : germ.type === 'spitter' ? 5 : 3);
        this.player.addUltimateCharge(ultimateCharge);
        
        // Player lifesteal
        if (this.player.lifesteal > 0) {
            const healAmount = finalScore * this.player.lifesteal * 0.1;
            this.player.heal(healAmount);
        }
        
        // Show floating text
        this.texts.add(germ.pos, `+${finalScore}`, germ.isElite ? '#ffdd7c' : CONFIG.COLORS.POWERUP);
        if (goldEarned > 2) {
            this.texts.add(germ.pos.add(new Vector2(0, 20)), `+${goldEarned}💰`, '#ffd700');
        }
        
        // Maybe drop powerup (elite always drops)
        const dropChance = germ.isElite ? 1.0 : (CONFIG.POWERUP_DROP_CHANCE + (this.player.luckBonus || 0));
        if (Math.random() < dropChance) {
            this.powerups.push(new Powerup(germ.pos.clone()));
            if (germ.isElite) {
                // Elite drops extra powerup
                this.powerups.push(new Powerup(germ.pos.add(Vector2.random(20))));
            }
        }
        
        // Track wave kills and check wave progression
        this.waveKills++;
        if (this.waveKills >= this.killsToNextWave) {
            this.showRiskRewardChoice();
        }
    }
    
    handleBossKill() {
        if (!this.boss) return;
        
        // Epic death explosion effects
        this.particles.deathExplosion(this.boss.pos, CONFIG.COLORS.BOSS, this.boss.radius);
        this.particles.ring(this.boss.pos, '#ffffff', 150);
        this.particles.ring(this.boss.pos, '#ffdd7c', 200);
        this.particles.screenFlash('#ffdd7c', 0.5);
        
        this.audio?.playSfx('boss_kill');
        
        // Score
        const baseScore = 500;
        const comboMultiplier = this.combo.multiplier;
        const finalScore = Math.round(baseScore * comboMultiplier);
        
        this.score += finalScore;
        this.texts.add(this.boss.pos, `BOSS YENİLDİ!`, '#ffdd7c');
        this.texts.add(this.boss.pos.add(new Vector2(0, 30)), `+${finalScore}`, CONFIG.COLORS.BOSS);
        
        // Boss gold and fluoride bonus
        this.gold += 50;
        this.goldEarned += 50;
        this.fluorideEarned = (this.fluorideEarned || 0) + 50;
        this.texts.add(this.boss.pos.add(new Vector2(0, 60)), '+50 💎 +50 💰', '#78dcb4');
        
        // Add ultimate charge
        this.player.addUltimateCharge(50);
        
        // Drop powerups
        for (let i = 0; i < 3; i++) {
            const offset = Vector2.random(50);
            this.powerups.push(new Powerup(this.boss.pos.add(offset)));
        }
        
        // Clean up
        this.boss = null;
        this.nextBossWave += CONFIG.BOSS_WAVE_INTERVAL;
        document.getElementById('boss-bar').style.display = 'none';
        
        // Advance wave with reward selection
        this.showRiskRewardChoice();
    }
    
    advanceWave() {
        this.wave++;
        this.waveKills = 0; // Reset wave kill counter
        this.killsToNextWave = Math.min(25, 12 + this.wave * 2); // Increase kills needed per wave (12, 14, 16... max 25)
        
        // Increase elite chance
        this.eliteChance = Math.min(0.25, 0.05 + this.wave * 0.015);
        
        this.affix = randomChoice(AFFIXES);
        this.player.updateAffix(this.affix);
        
        // Reset mini-boss spawn flag for next wave
        this.miniBossSpawnedThisWave = false;
        
        this.texts.add(
            new Vector2(CONFIG.SCREEN_WIDTH / 2, CONFIG.SCREEN_HEIGHT / 2),
            `Dalga ${this.wave}!`,
            CONFIG.COLORS.PLAYER
        );
        
        this.audio?.playSfx('wave');
        
        // Check for shop wave (every 3 waves)
        if (this.wave > 1 && (this.wave - 1) % 3 === 0) {
            setTimeout(() => this.showShop(), 500);
        }
    }
    
    // Risk/Reward choice - Continue for more rewards or take rewards now
    showRiskRewardChoice() {
        this.isChoosingRisk = true;
        this.isSelectingReward = true;
        
        const overlay = document.getElementById('wave-reward-overlay');
        const optionsContainer = document.getElementById('reward-options');
        const titleEl = document.getElementById('wave-reward-title');
        const subtitleEl = document.getElementById('wave-reward-subtitle');
        const isTouchUI = document.body.classList.contains('touch-device') || this.saveData?.settings?.touchMode;
        
        if (!overlay || !optionsContainer) {
            console.error('Risk reward overlay elements not found!');
            this.isChoosingRisk = false;
            this.isSelectingReward = false;
            this.advanceWave();
            return;
        }
        
        if (isTouchUI) {
            if (titleEl) titleEl.style.display = 'none';
            if (subtitleEl) subtitleEl.style.display = 'none';
        }
        
        // Calculate bonus for continuing
        const continueBonus = Math.floor(20 + this.consecutiveWaves * 15);
        const riskMultiplier = 1 + this.consecutiveWaves * 0.5;
        
        optionsContainer.innerHTML = `
            <div class="risk-choice-container">
                <h2 class="risk-title">⚔️ DALGA ${this.wave} TAMAMLANDI!</h2>
                <p class="risk-subtitle">Altın: ${this.gold} 💰 | Seri: ${this.consecutiveWaves}</p>
                
                <div class="risk-options">
                    <div class="risk-card continue" data-choice="continue">
                        <div class="risk-icon">🔥</div>
                        <div class="risk-name">DEVAM ET</div>
                        <div class="risk-desc">
                            <p>+${continueBonus} bonus altın</p>
                            <p>Düşmanlar ${Math.round((riskMultiplier - 1) * 100)}% daha güçlü</p>
                            <p class="risk-warning">⚠️ Ölürsen hepsini kaybedersin!</p>
                        </div>
                    </div>
                    
                    <div class="risk-card collect" data-choice="collect">
                        <div class="risk-icon">🎁</div>
                        <div class="risk-name">ÖDÜL AL</div>
                        <div class="risk-desc">
                            <p>3 güçlendirmeden birini seç</p>
                            <p>Kazançların güvende</p>
                            <p class="risk-safe">✓ Güvenli seçim</p>
                        </div>
                    </div>
                </div>
            </div>
        `;
        
        // Add click handlers
        optionsContainer.querySelectorAll('.risk-card').forEach(card => {
            card.addEventListener('click', () => {
                const choice = card.dataset.choice;
                this.handleRiskChoice(choice, continueBonus, riskMultiplier);
            });
        });
        
        overlay.style.display = 'flex';
    }
    
    handleRiskChoice(choice, bonus, riskMultiplier) {
        const overlay = document.getElementById('wave-reward-overlay');
        
        if (choice === 'continue') {
            // Continue - get bonus gold, enemies get stronger
            this.consecutiveWaves++;
            this.gold += bonus;
            this.goldEarned += bonus;
            
            // Make enemies stronger
            this.affix = {
                ...this.affix,
                enemy_health: (this.affix.enemy_health || 1) * (1 + this.consecutiveWaves * 0.15),
                enemy_speed: (this.affix.enemy_speed || 1) * (1 + this.consecutiveWaves * 0.05),
            };
            
            this.texts.add(
                new Vector2(CONFIG.SCREEN_WIDTH / 2, CONFIG.SCREEN_HEIGHT / 2 - 50),
                `+${bonus} 💰 Bonus!`,
                '#ffd700'
            );
            this.texts.add(
                new Vector2(CONFIG.SCREEN_WIDTH / 2, CONFIG.SCREEN_HEIGHT / 2),
                `${this.consecutiveWaves}x Seri!`,
                '#ff6666'
            );
            
            overlay.style.display = 'none';
            this.isChoosingRisk = false;
            this.isSelectingReward = false;
            this.advanceWave();
        } else {
            // Collect - show reward selection
            this.consecutiveWaves = 0;
            this.isChoosingRisk = false;
            this.showWaveRewards();
        }
    }
    
    // Show wave reward selection screen
    showWaveRewards() {
        this.isSelectingReward = true;
        
        // Generate 3 random rewards with weighted rarity
        const rewards = Game.WAVE_REWARDS;
        const selected = [];
        const used = new Set();
        
        let attempts = 0;
        const maxAttempts = 50; // Prevent infinite loop
        
        while (selected.length < 3 && attempts < maxAttempts) {
            attempts++;
            
            // Weight by rarity: common 60%, rare 30%, epic 10%
            const roll = Math.random();
            let targetRarity;
            if (roll < 0.1) targetRarity = 'epic';
            else if (roll < 0.4) targetRarity = 'rare';
            else targetRarity = 'common';
            
            const candidates = rewards.filter(r => r.rarity === targetRarity && !used.has(r.id));
            if (candidates.length > 0) {
                const reward = randomChoice(candidates);
                selected.push(reward);
                used.add(reward.id);
            } else {
                // Fallback: try any unused reward
                const anyReward = rewards.filter(r => !used.has(r.id));
                if (anyReward.length > 0) {
                    const reward = randomChoice(anyReward);
                    selected.push(reward);
                    used.add(reward.id);
                }
            }
        }
        
        // If still not enough, fill with duplicates
        while (selected.length < 3 && rewards.length > 0) {
            selected.push(randomChoice(rewards));
        }
        
        this.availableRewards = selected;
        
        // Show UI
        const overlay = document.getElementById('wave-reward-overlay');
        const optionsContainer = document.getElementById('reward-options');
        const titleEl = document.getElementById('wave-reward-title');
        const subtitleEl = document.getElementById('wave-reward-subtitle');
        const isTouchUI = document.body.classList.contains('touch-device') || this.saveData?.settings?.touchMode;
        
        if (!overlay || !optionsContainer) {
            console.error('Wave reward overlay elements not found!');
            this.isSelectingReward = false;
            this.advanceWave();
            return;
        }
        
        if (isTouchUI) {
            if (titleEl) {
                titleEl.style.display = '';
                titleEl.textContent = '🎁 Dalga Tamamlandı!';
            }
            if (subtitleEl) {
                subtitleEl.style.display = '';
                subtitleEl.textContent = 'Bir geliştirme seç:';
            }
        }
        
        if (selected.length === 0) {
            console.warn('No rewards available, skipping selection');
            this.isSelectingReward = false;
            this.advanceWave();
            return;
        }
        
        optionsContainer.innerHTML = selected.map((reward, index) => `
            <div class="reward-card ${reward.rarity}" data-index="${index}">
                <div class="reward-icon">${reward.icon}</div>
                <div class="reward-name">${reward.name}</div>
                <div class="reward-desc">${reward.desc}</div>
                <div class="reward-rarity ${reward.rarity}">${
                    reward.rarity === 'common' ? 'Yaygın' : 
                    reward.rarity === 'rare' ? 'Nadir' : 'Epik'
                }</div>
            </div>
        `).join('');
        
        // Add click handlers
        optionsContainer.querySelectorAll('.reward-card').forEach(card => {
            card.addEventListener('click', () => {
                const index = parseInt(card.dataset.index);
                this.selectReward(index);
            });
        });
        
        overlay.style.display = 'flex';
    }
    
    // Apply selected reward
    selectReward(index) {
        const reward = this.availableRewards[index];
        if (reward) {
            reward.apply(this.player);
            
            // Track for synergy
            if (reward.tags) {
                this.appliedUpgrades.push(reward);
                this.checkSynergies();
            }
            
            // Visual feedback
            this.texts.add(
                this.player.pos.clone(),
                `${reward.icon} ${reward.name}!`,
                reward.rarity === 'epic' ? '#ffdd7c' : reward.rarity === 'rare' ? '#b19cd9' : '#6cd6ff'
            );
            
            this.audio?.playSfx('powerup');
        }
        
        // Hide overlay and continue game
        document.getElementById('wave-reward-overlay').style.display = 'none';
        this.isSelectingReward = false;
        
        // Now advance the wave
        this.advanceWave();
    }
    
    // Check and apply synergies based on collected upgrades
    checkSynergies() {
        const tagCounts = {};
        
        // Count tags from all applied upgrades
        for (const upgrade of this.appliedUpgrades) {
            if (upgrade.tags) {
                for (const tag of upgrade.tags) {
                    tagCounts[tag] = (tagCounts[tag] || 0) + 1;
                }
            }
        }
        
        // Check each synergy type
        for (const [type, tiers] of Object.entries(Game.SYNERGIES)) {
            const count = tagCounts[type] || 0;
            
            for (const tier of tiers) {
                const synergyKey = `${type}_${tier.count}`;
                
                if (count >= tier.count && !this.synergies[synergyKey]) {
                    // Apply synergy bonus
                    tier.apply(this.player);
                    this.synergies[synergyKey] = true;
                    
                    // Show synergy notification
                    this.texts.add(
                        new Vector2(CONFIG.SCREEN_WIDTH / 2, 150),
                        `⚡ SİNERJİ: ${tier.name}!`,
                        '#ffd700'
                    );
                    this.texts.add(
                        new Vector2(CONFIG.SCREEN_WIDTH / 2, 180),
                        tier.bonus,
                        '#ffaa00'
                    );
                    
                    this.audio?.playSfx('powerup');
                }
            }
        }
    }
    
    // Shop system - appears every 3 waves
    showShop() {
        this.isInShop = true;
        this.isSelectingReward = true;
        
        // Generate shop items (3 random items)
        const allItems = Game.SHOP_ITEMS.filter(item => {
            // Filter out already purchased items (for unique items)
            if (item.id === 'secondwind' && this.player.secondWind) return false;
            if (item.id === 'tripleshot' && this.player.tripleShot) return false;
            if (item.id === 'piercing' && this.player.piercingShots) return false;
            return true;
        });
        
        const shopItems = [];
        const used = new Set();
        
        for (let i = 0; i < 4 && allItems.length > 0; i++) {
            const available = allItems.filter(item => !used.has(item.id));
            if (available.length > 0) {
                const item = randomChoice(available);
                shopItems.push(item);
                used.add(item.id);
            }
        }
        
        this.shopItems = shopItems;
        
        const overlay = document.getElementById('wave-reward-overlay');
        const optionsContainer = document.getElementById('reward-options');
        const titleEl = document.getElementById('wave-reward-title');
        const subtitleEl = document.getElementById('wave-reward-subtitle');
        const isTouchUI = document.body.classList.contains('touch-device') || this.saveData?.settings?.touchMode;
        
        if (!overlay || !optionsContainer) {
            this.isInShop = false;
            this.isSelectingReward = false;
            return;
        }
        
        if (isTouchUI) {
            if (titleEl) titleEl.style.display = 'none';
            if (subtitleEl) subtitleEl.style.display = 'none';
        }
        
        optionsContainer.innerHTML = `
            <div class="shop-container">
                <h2 class="shop-title">🏪 MAĞAZA</h2>
                <p class="shop-gold">Altın: ${this.gold} 💰</p>
                
                <div class="shop-items">
                    ${shopItems.map((item, index) => `
                        <div class="shop-item ${item.rarity} ${this.gold < item.cost ? 'disabled' : ''}" 
                             data-index="${index}" data-cost="${item.cost}">
                            <div class="shop-item-icon">${item.icon}</div>
                            <div class="shop-item-name">${item.name}</div>
                            <div class="shop-item-desc">${item.desc}</div>
                            <div class="shop-item-cost">${item.cost} 💰</div>
                        </div>
                    `).join('')}
                </div>
                
                <button class="shop-skip-btn">Atla →</button>
            </div>
        `;
        
        // Add click handlers for items
        optionsContainer.querySelectorAll('.shop-item:not(.disabled)').forEach(card => {
            card.addEventListener('click', () => {
                const index = parseInt(card.dataset.index);
                const cost = parseInt(card.dataset.cost);
                this.purchaseShopItem(index, cost);
            });
        });
        
        // Skip button
        optionsContainer.querySelector('.shop-skip-btn')?.addEventListener('click', () => {
            this.closeShop();
        });
        
        overlay.style.display = 'flex';
    }
    
    purchaseShopItem(index, cost) {
        if (this.gold < cost) return;
        
        const item = this.shopItems[index];
        if (!item) return;
        
        // Deduct gold
        this.gold -= cost;
        
        // Apply item
        item.apply(this.player);
        
        // Track for synergy
        if (item.tags) {
            this.appliedUpgrades.push(item);
            this.checkSynergies();
        }
        
        // Visual feedback
        this.texts.add(
            this.player.pos.clone(),
            `${item.icon} ${item.name} satın alındı!`,
            '#ffd700'
        );
        
        this.audio?.playSfx('powerup');
        
        // Close shop
        this.closeShop();
    }
    
    closeShop() {
        document.getElementById('wave-reward-overlay').style.display = 'none';
        this.isInShop = false;
        this.isSelectingReward = false;
    }
    
    updateHUD() {
        // Player name
        const playerNameEl = document.getElementById('hud-player-name');
        if (playerNameEl) {
            playerNameEl.textContent = this.playerName || 'Oyuncu';
        }
        
        // Score and wave
        document.getElementById('hud-score').textContent = this.score;
        document.getElementById('hud-wave').textContent = this.wave;
        
        // Gold display
        const goldEl = document.getElementById('hud-gold');
        if (goldEl) {
            goldEl.textContent = this.gold;
        }
        
        // Streak display
        const streakEl = document.getElementById('hud-streak');
        if (streakEl) {
            if (this.consecutiveWaves > 0) {
                streakEl.textContent = `🔥 x${this.consecutiveWaves}`;
                streakEl.style.display = 'block';
            } else {
                streakEl.style.display = 'none';
            }
        }
        
        // Wave progress
        const waveProgressFill = document.getElementById('wave-progress-fill');
        const waveKillsText = document.getElementById('wave-kills-text');
        if (waveProgressFill) {
            const waveProgress = (this.waveKills / this.killsToNextWave) * 100;
            waveProgressFill.style.width = `${Math.min(100, waveProgress)}%`;
        }
        if (waveKillsText) {
            waveKillsText.textContent = `${this.waveKills}/${this.killsToNextWave}`;
        }
        
        // Affix
        const affixEl = document.getElementById('hud-affix');
        if (this.affix) {
            affixEl.textContent = this.affix.name;
        }
        
        // Health
        const healthRatio = this.player.health / this.player.maxHealth;
        document.getElementById('health-fill').style.width = `${healthRatio * 100}%`;
        document.getElementById('health-text').textContent = 
            `${Math.ceil(this.player.health)}/${this.player.maxHealth}`;
        
        // Combo
        const comboValue = document.getElementById('hud-combo');
        comboValue.textContent = `x${this.combo.multiplier.toFixed(1)}`;
        if (this.combo.multiplier >= 2) {
            comboValue.style.color = '#ffdd7c';
        } else {
            comboValue.style.color = '#6cd6ff';
        }
        
        const comboRatio = this.combo.timer / CONFIG.COMBO_RESET_TIME;
        document.getElementById('combo-fill').style.width = `${comboRatio * 100}%`;
        
        // Dash cooldown
        const dashFill = document.getElementById('dash-fill');
        if (dashFill) {
            const dashReady = this.player.dashCooldown <= 0;
            const dashRatio = dashReady ? 1 : 1 - (this.player.dashCooldown / this.player.dashCooldownMax);
            dashFill.style.width = `${dashRatio * 100}%`;
            dashFill.classList.toggle('ready', dashReady);
        }
        
        // Ultimate charge
        const ultimateFill = document.getElementById('ultimate-fill');
        if (ultimateFill) {
            const ultReady = this.player.ultimateCharge >= this.player.ultimateChargeMax;
            const ultRatio = this.player.ultimateCharge / this.player.ultimateChargeMax;
            ultimateFill.style.width = `${ultRatio * 100}%`;
            ultimateFill.classList.toggle('ready', ultReady);
        }
        
        // Combo burst indicator
        const comboBurstEl = document.getElementById('combo-burst-ability');
        if (comboBurstEl) {
            comboBurstEl.style.display = this.combo.burstReady ? 'flex' : 'none';
        }
        
        // Update inventory/weapon slots
        this.updateInventoryUI();
        
        // Update mobile button states
        this.updateMobileButtons();
    }
    
    updateInventoryUI() {
        const slots = document.querySelectorAll('.inventory-slot');
        slots.forEach((slot, index) => {
            if (index === this.player.activeWeaponIndex) {
                slot.classList.add('selected');
            } else {
                slot.classList.remove('selected');
            }
            
            // Draw weapon emoji on canvas
            const canvas = document.getElementById(`slot-canvas-${index}`);
            if (canvas && this.player.weapons[index]) {
                const ctx = canvas.getContext('2d');
                ctx.clearRect(0, 0, 40, 40);
                
                const weapon = this.player.weapons[index];
                
                // Draw emoji icon
                ctx.font = '28px Arial';
                ctx.textAlign = 'center';
                ctx.textBaseline = 'middle';
                ctx.fillText(weapon.icon, 20, 20);
            }
        });
        
        // Setup click handlers for inventory slots (only once)
        if (!this.inventoryClicksSetup) {
            slots.forEach((slot, index) => {
                slot.addEventListener('click', () => {
                    this.player.activeWeaponIndex = index;
                });
            });
            this.inventoryClicksSetup = true;
        }
    }
    
    updateMobileButtons() {
        // Dash button cooldown
        const dashBtn = document.getElementById('btn-dash');
        if (dashBtn) {
            const dashReady = this.player.dashCooldown <= 0;
            dashBtn.classList.toggle('on-cooldown', !dashReady);
        }
        
        // Ultimate button
        const ultBtn = document.getElementById('btn-ultimate');
        const ultChargeFill = document.getElementById('ult-charge-fill');
        if (ultBtn) {
            const ultReady = this.player.ultimateCharge >= this.player.ultimateChargeMax;
            ultBtn.disabled = !ultReady;
            ultBtn.classList.toggle('ready', ultReady);
            
            if (ultChargeFill) {
                const ultRatio = (this.player.ultimateCharge / this.player.ultimateChargeMax) * 100;
                ultChargeFill.style.width = `${ultRatio}%`;
            }
        }
        
        // Combo button
        const comboBtn = document.getElementById('btn-combo');
        if (comboBtn) {
            comboBtn.style.display = this.combo.burstReady ? 'flex' : 'none';
        }
    }
    
    render(ctx) {
        // Draw projectiles
        for (const proj of this.projectiles) {
            proj.draw(ctx);
        }
        
        // Draw enemy projectiles
        for (const proj of this.enemyProjectiles) {
            proj.draw(ctx);
        }
        
        // Draw powerups
        for (const powerup of this.powerups) {
            powerup.draw(ctx);
        }
        
        // Draw germs
        for (const germ of this.germs) {
            germ.draw(ctx);
        }
        
        // Draw mini-boss
        if (this.miniBoss) {
            this.miniBoss.draw(ctx);
        }
        
        // Draw boss
        if (this.boss) {
            this.boss.draw(ctx);
        }
        
        // Draw player
        this.player.draw(ctx);
        
        // Draw particles
        this.particles.draw(ctx);
        
        // Draw floating texts
        this.texts.draw(ctx);
        
        // Draw brush range indicator when brush ready
        if (this.player.brushCooldown <= 0) {
            this.drawBrushIndicator(ctx);
        }
    }
    
    drawBrushIndicator(ctx) {
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.BRUSH;
        ctx.lineWidth = 2;
        ctx.globalAlpha = 0.3;
        ctx.setLineDash([5, 5]);
        ctx.beginPath();
        ctx.arc(this.player.pos.x, this.player.pos.y, this.player.brushRadius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }
}
