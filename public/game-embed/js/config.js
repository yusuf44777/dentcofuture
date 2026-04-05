/**
 * Game Configuration
 * All game settings and constants
 */

export const CONFIG = {
    // Screen
    SCREEN_WIDTH: 1280,
    SCREEN_HEIGHT: 720,
    FPS: 60,
    
    // Player
    PLAYER_SPEED: 270,
    PLAYER_RADIUS: 30,
    PLAYER_MAX_HEALTH: 110,
    PLAYER_SHOT_COOLDOWN: 0.26,
    PLAYER_SHOT_SPEED: 540,
    PLAYER_SHOT_DAMAGE: 18,
    PLAYER_BRUSH_COOLDOWN: 1.05,
    PLAYER_BRUSH_RADIUS: 86,
    PLAYER_BRUSH_DAMAGE: 12,
    
    // Enemies
    GERM_BASE_HEALTH: 30,
    GERM_BASE_SPEED: 90,
    GERM_SPAWN_INTERVAL_START: 2.5,
    GERM_SPAWN_INTERVAL_MIN: 0.75,
    GERM_SPAWN_ACCELERATION: 0.02,
    GERM_CONTACT_DAMAGE: 10,
    
    // Enemy Variants
    SPITTER_BASE_HEALTH: 26,
    SPITTER_BASE_SPEED: 80,
    SPITTER_FIRE_COOLDOWN: 1.8,
    SPITTER_PROJECTILE_SPEED: 360,
    SPITTER_PROJECTILE_DAMAGE: 8,
    
    TANK_BASE_HEALTH: 80,
    TANK_BASE_SPEED: 54,
    TANK_CONTACT_DAMAGE: 16,
    TANK_ARMOR: 0.25,
    
    // Boss
    BOSS_WAVE_INTERVAL: 5,
    BOSS_HEALTH_BASE: 360,
    BOSS_SPEED: 65,
    BOSS_FIRE_RATE: 1.1,
    BOSS_PROJECTILE_SPEED: 420,
    BOSS_PROJECTILE_DAMAGE: 12,
    
    // Combo
    COMBO_RESET_TIME: 3.0,
    COMBO_STEP: 0.35,
    COMBO_MAX: 4.5,
    COMBO_DECAY_RATE: 0.35,
    
    // Powerups
    POWERUP_DROP_CHANCE: 0.22,
    POWERUP_HEAL_AMOUNT: 20,
    
    // Visual
    PLAYFIELD_MARGIN: 32,
    
    // Colors
    COLORS: {
        BG: '#0a0e12',
        PLAYER: '#6cd6ff',
        GERM: '#ff6392',
        SPITTER: '#ffaa5c',
        TANK: '#b48cff',
        BOSS: '#ffd666',
        SHOT: '#b1fcff',
        ENEMY_SHOT: '#ff9650',
        BRUSH: '#78dcb4',
        POWERUP: '#ffdd7c',
        GRID: '#1a222a'
    }
};

// Affixes (Wave modifiers)
export const AFFIXES = [
    {
        key: 'sugar_rush',
        name: 'Şeker Sıçraması',
        desc: 'Mikroplar hızlı, +%10 skor',
        enemy_speed: 1.15,
        score: 1.1
    },
    {
        key: 'kirec_zirhi',
        name: 'Kireç Zırhı',
        desc: 'Zırhlı ama yavaş',
        enemy_speed: 0.9,
        enemy_health: 1.22
    },
    {
        key: 'mentol_firtina',
        name: 'Mentol Fırtınası',
        desc: 'Fırça bekleme süresi %15 kısaldı',
        player_brush_cd: 0.85
    },
    {
        key: 'asit_buhari',
        name: 'Asit Buharı',
        desc: 'Düşman atışları sık, -%5 skor',
        enemy_attack_rate: 0.8,
        score: 0.95
    }
];

// Classes
export const CLASSES = {
    fircaci: {
        name: 'Fırçacı',
        desc: 'Yakın dövüş uzmanı. Fırça hasarı ve alanı artmış.',
        icon: '🪥',
        color: '#78dcb4',
        base_mods: {
            brush_damage_mult: 1.3,
            brush_radius_bonus: 15,
            brush_cd_mult: 0.85,
            shot_damage_mult: 0.9
        },
        unlock_cost: 0
    },
    macuncu: {
        name: 'Macuncu',
        desc: 'Uzak saldırı uzmanı. Atış hasarı ve hızı artmış.',
        icon: '💧',
        color: '#6cd6ff',
        base_mods: {
            shot_damage_mult: 1.35,
            shot_speed_mult: 1.2,
            shot_cd_mult: 0.85,
            brush_damage_mult: 0.85
        },
        unlock_cost: 0
    },
    florur: {
        name: 'Florür Tank',
        desc: 'Zırhlı savaşçı. Yüksek can, yavaş hareket.',
        icon: '🛡️',
        color: '#b48cff',
        base_mods: {
            health_mult: 1.5,
            speed_mult: 0.85,
            damage_reduction: 0.15
        },
        unlock_cost: 500
    },
    dis_ipi: {
        name: 'Diş İpi',
        desc: 'Hız uzmanı. Çok hızlı hareket, düşük can.',
        icon: '⚡',
        color: '#ffdd7c',
        base_mods: {
            speed_mult: 1.4,
            health_mult: 0.75,
            shot_cd_mult: 0.8,
            brush_cd_mult: 0.8
        },
        unlock_cost: 500
    }
};

// Skill Tree
export const SKILL_TREE = {
    // Attack Branch
    attack_1: {
        name: 'Keskin Kıllar',
        desc: 'Atış hasarı +%10',
        branch: 'attack',
        tier: 1,
        cost: 100,
        mods: { shot_damage_mult: 1.1 },
        requires: []
    },
    attack_2: {
        name: 'Hızlı Tetik',
        desc: 'Atış hızı +%15',
        branch: 'attack',
        tier: 2,
        cost: 200,
        mods: { shot_cd_mult: 0.85 },
        requires: ['attack_1']
    },
    attack_3: {
        name: 'Delici Mermi',
        desc: 'Atış hasarı +%20',
        branch: 'attack',
        tier: 3,
        cost: 400,
        mods: { shot_damage_mult: 1.2 },
        requires: ['attack_2']
    },
    attack_4: {
        name: 'Ölümcül Vuruş',
        desc: 'Kritik şans +%15',
        branch: 'attack',
        tier: 4,
        cost: 600,
        mods: { crit_chance: 0.15 },
        requires: ['attack_3']
    },
    
    // Defense Branch
    defense_1: {
        name: 'Kalın Deri',
        desc: 'Can +%15',
        branch: 'defense',
        tier: 1,
        cost: 100,
        mods: { health_mult: 1.15 },
        requires: []
    },
    defense_2: {
        name: 'Direnç',
        desc: 'Hasar azaltma +%10',
        branch: 'defense',
        tier: 2,
        cost: 200,
        mods: { damage_reduction: 0.1 },
        requires: ['defense_1']
    },
    defense_3: {
        name: 'Yenilenme',
        desc: 'Can yenileme +2/sn',
        branch: 'defense',
        tier: 3,
        cost: 400,
        mods: { health_regen: 2 },
        requires: ['defense_2']
    },
    defense_4: {
        name: 'Ölümsüz',
        desc: 'Can +%30',
        branch: 'defense',
        tier: 4,
        cost: 600,
        mods: { health_mult: 1.3 },
        requires: ['defense_3']
    },
    
    // Utility Branch
    utility_1: {
        name: 'Hızlı Adımlar',
        desc: 'Hareket hızı +%10',
        branch: 'utility',
        tier: 1,
        cost: 100,
        mods: { speed_mult: 1.1 },
        requires: []
    },
    utility_2: {
        name: 'Fırça Ustası',
        desc: 'Fırça CD -%15',
        branch: 'utility',
        tier: 2,
        cost: 200,
        mods: { brush_cd_mult: 0.85 },
        requires: ['utility_1']
    },
    utility_3: {
        name: 'Geniş Fırça',
        desc: 'Fırça alanı +20',
        branch: 'utility',
        tier: 3,
        cost: 400,
        mods: { brush_radius_bonus: 20 },
        requires: ['utility_2']
    },
    utility_4: {
        name: 'Kombo Ustası',
        desc: 'Kombo süresi +%50',
        branch: 'utility',
        tier: 4,
        cost: 600,
        mods: { combo_time_mult: 1.5 },
        requires: ['utility_3']
    }
};

// Companions
export const COMPANIONS = {
    mini_fircaci: {
        name: 'Mini Fırçacı',
        desc: 'Yanında dönerek düşmanlara hasar verir',
        icon: '🪥',
        color: '#78dcb4',
        unlock_cost: 300,
        stats: {
            damage: 5,
            orbit_radius: 60,
            orbit_speed: 2
        }
    },
    koruyucu: {
        name: 'Koruyucu',
        desc: 'Düşman mermilerini engeller',
        icon: '🛡️',
        color: '#6cd6ff',
        unlock_cost: 400,
        stats: {
            block_radius: 40,
            orbit_radius: 50,
            orbit_speed: 1.5
        }
    },
    toplayici: {
        name: 'Toplayıcı',
        desc: 'Yakındaki power-up\'ları otomatik toplar',
        icon: '🧲',
        color: '#ffdd7c',
        unlock_cost: 350,
        stats: {
            collect_radius: 150,
            orbit_radius: 70,
            orbit_speed: 1
        }
    }
};

// Upgrade Presets (for menu selection)
export const UPGRADE_PRESETS = [
    {
        key: 'steril_kit',
        name: 'Steril Kit',
        desc: '+%20 Can',
        icon: '❤️',
        mods: { health_mult: 1.2 }
    },
    {
        key: 'turbo_brush',
        name: 'Turbo Brush',
        desc: 'Fırça CD -%20, yarıçap +10',
        icon: '🪥',
        mods: { brush_cd_mult: 0.8, brush_radius_bonus: 10 }
    },
    {
        key: 'basinc_macun',
        name: 'Basınçlı Macun',
        desc: 'Atış hasarı +%25',
        icon: '💧',
        mods: { shot_damage_mult: 1.25 }
    },
    {
        key: 'mentol_adim',
        name: 'Mentol Adım',
        desc: 'Hareket +%12',
        icon: '👟',
        mods: { speed_mult: 1.12 }
    },
    {
        key: 'florur_darb',
        name: 'Florür Darbe',
        desc: 'Fırça hasarı +%25',
        icon: '⚡',
        mods: { brush_damage_mult: 1.25 }
    }
];
