/**
 * Asset Loader - Handles loading images and sounds
 */

// Asset paths (relative to js-game folder)
const ASSET_BASE = './assets';

const IMAGE_MANIFEST = {
    // Characters
    player_idle: `${ASSET_BASE}/images/characters/player_idle.png`,
    player_run: `${ASSET_BASE}/images/characters/player_run.png`,
    player_attack: `${ASSET_BASE}/images/characters/player_attack.png`,
    enemy_grunt: `${ASSET_BASE}/images/characters/enemy_germ_grunt.png`,
    enemy_spitter: `${ASSET_BASE}/images/characters/enemy_spitter.png`,
    enemy_tank: `${ASSET_BASE}/images/characters/enemy_tank.png`,
    enemy_boss: `${ASSET_BASE}/images/characters/enemy_boss_caries_king.png`,
    
    // Weapons
    weapon_sword: `${ASSET_BASE}/Sprites/BlueHairedHero/sword.png`,
    
    // Inventory
    inventory_slot: `${ASSET_BASE}/Sprites/Inventory/inventory_slot.png`,
    inventory_slot_selected: `${ASSET_BASE}/Sprites/Inventory/inventory_slot_selected.png`,
    
    // Item Spritesheet
    items_spritesheet: `${ASSET_BASE}/Sprites/Spritesheets/pixelArt.png`,
    
    // Backgrounds
    bg_gum_lab: `${ASSET_BASE}/images/backgrounds/background_gum_lab.png`,
    bg_molar_valley: `${ASSET_BASE}/images/backgrounds/background_molar_valley.png`,
    bg_tongue_cavern: `${ASSET_BASE}/images/backgrounds/background_tongue_cavern.png`,
    
    // Effects
    effect_brush: `${ASSET_BASE}/images/effects/effect_brush_swing.png`,
    effect_hit: `${ASSET_BASE}/images/effects/effect_hit_splash.png`,
    effect_pickup: `${ASSET_BASE}/images/effects/effect_pickup_glow.png`,
    
    // Projectiles
    projectile_toothpaste: `${ASSET_BASE}/images/projectiles/projectile_toothpaste.png`,
    projectile_enemy: `${ASSET_BASE}/images/projectiles/projectile_enemy_spit.png`,
    
    // Powerups
    powerup_heal: `${ASSET_BASE}/images/items/powerup_heal.png`,
    powerup_combo: `${ASSET_BASE}/images/items/powerup_combo.png`,
    upgrade_chip: `${ASSET_BASE}/images/items/upgrade_chip.png`,
    
    // UI
    ui_cursor: `${ASSET_BASE}/images/ui/aim_cursor.png`,
    ui_icon_health: `${ASSET_BASE}/images/ui/ui_icon_health.png`,
    ui_icon_brush: `${ASSET_BASE}/images/ui/ui_icon_brush.png`,
    ui_icon_projectile: `${ASSET_BASE}/images/ui/ui_icon_projectile.png`,
    ui_hud_frame: `${ASSET_BASE}/images/ui/ui_hud_frame.png`,
    
    // Menu
    menu_title: `${ASSET_BASE}/Sprites/Menu/RogueTitle1.png`,
    menu_play: `${ASSET_BASE}/Sprites/Menu/playButton.png`,
    menu_play_large: `${ASSET_BASE}/Sprites/Menu/playButtonLarge.png`,
    menu_back: `${ASSET_BASE}/Sprites/Menu/back.png`,
};

const AUDIO_MANIFEST = {
    // SFX
    sfx_brush: `${ASSET_BASE}/audio/sfx/brush.mp3`,
    sfx_boss: `${ASSET_BASE}/audio/sfx/bos.mp3`,
    sfx_coin: `${ASSET_BASE}/audio/sfx/coin.mp3`,
    sfx_enemy_shot: `${ASSET_BASE}/audio/sfx/enemy_shot.mp3`,
    sfx_hit: `${ASSET_BASE}/audio/sfx/hit.mp3`,
    sfx_hurt: `${ASSET_BASE}/audio/sfx/hurt.mp3`,
    
    // Music
    music_menu: `${ASSET_BASE}/audio/music/MainMenu.ogg`,
};

export const AssetLoader = {
    images: {},
    sounds: {},
    loaded: false,
    
    /**
     * Load all game assets
     */
    async loadAll(onProgress = () => {}) {
        const imageKeys = Object.keys(IMAGE_MANIFEST);
        const audioKeys = Object.keys(AUDIO_MANIFEST);
        const totalAssets = imageKeys.length + audioKeys.length;
        let loadedCount = 0;
        
        // Load all images
        const imagePromises = imageKeys.map(async (key) => {
            try {
                const img = await this.loadImage(IMAGE_MANIFEST[key]);
                this.images[key] = img;
            } catch (e) {
                console.warn(`Failed to load image: ${key}`, e);
                this.images[key] = null;
            }
            loadedCount++;
            onProgress(loadedCount / totalAssets);
        });
        
        // Load all audio
        const audioPromises = audioKeys.map(async (key) => {
            try {
                const audio = await this.loadAudio(AUDIO_MANIFEST[key]);
                this.sounds[key] = audio;
            } catch (e) {
                console.warn(`Failed to load audio: ${key}`, e);
                this.sounds[key] = null;
            }
            loadedCount++;
            onProgress(loadedCount / totalAssets);
        });
        
        // Wait for all assets to load
        await Promise.all([...imagePromises, ...audioPromises]);
        
        this.loaded = true;
        
        return {
            images: this.images,
            sounds: this.sounds
        };
    },
    
    /**
     * Get an image by key
     */
    getImage(key) {
        return this.images[key] || null;
    },
    
    /**
     * Get a sound by key
     */
    getSound(key) {
        return this.sounds[key] || null;
    },
    
    /**
     * Draw a sprite from the items spritesheet
     * Spritesheet is 476x1020 with 17 columns, ~28px per sprite
     */
    drawItemSprite(ctx, itemId, x, y, size = 32) {
        const spritesheet = this.images['items_spritesheet'];
        if (!spritesheet) return false;
        
        const SPRITE_SIZE = 28;
        const COLS = 17;
        
        // Item ID to spritesheet position mapping
        const ITEM_POSITIONS = {
            // Row 3 - Potions
            'potion_red': { col: 0, row: 2 },
            'potion_blue': { col: 1, row: 2 },
            'potion_green': { col: 2, row: 2 },
            'potion_purple': { col: 3, row: 2 },
            'potion_yellow': { col: 4, row: 2 },
            
            // Row 4 - More potions/flasks
            'flask_red': { col: 0, row: 3 },
            'flask_blue': { col: 1, row: 3 },
            'flask_green': { col: 2, row: 3 },
            
            // Row 5 - Swords
            'sword_basic': { col: 0, row: 4 },
            'sword_iron': { col: 1, row: 4 },
            'sword_steel': { col: 2, row: 4 },
            'sword_gold': { col: 3, row: 4 },
            'sword_red': { col: 4, row: 4 },
            'sword_blue': { col: 5, row: 4 },
            'sword_purple': { col: 6, row: 4 },
            'dagger': { col: 10, row: 4 },
            'dagger_gold': { col: 11, row: 4 },
            
            // Row 6 - More weapons
            'sword_flame': { col: 0, row: 5 },
            'sword_ice': { col: 1, row: 5 },
            'sword_nature': { col: 2, row: 5 },
            'katana': { col: 3, row: 5 },
            'scimitar': { col: 4, row: 5 },
            'machete': { col: 5, row: 5 },
            
            // Row 7 - Axes and hammers
            'axe_basic': { col: 0, row: 6 },
            'axe_battle': { col: 1, row: 6 },
            'pickaxe': { col: 2, row: 6 },
            'hammer': { col: 6, row: 6 },
            'mace': { col: 7, row: 6 },
            
            // Row 8 - Staffs and spears  
            'staff_wood': { col: 0, row: 7 },
            'staff_fire': { col: 1, row: 7 },
            'staff_ice': { col: 2, row: 7 },
            'spear': { col: 4, row: 7 },
            'trident': { col: 5, row: 7 },
            'halberd': { col: 6, row: 7 },
            
            // Row 9 - More polearms
            'lance': { col: 0, row: 8 },
            'scythe': { col: 3, row: 8 },
            
            // Row 10 - Bows
            'bow_basic': { col: 0, row: 9 },
            'bow_long': { col: 1, row: 9 },
            'crossbow': { col: 3, row: 9 },
            
            // Row 11 - Shields and armor
            'shield_wood': { col: 0, row: 10 },
            'shield_iron': { col: 1, row: 10 },
            'shield_gold': { col: 2, row: 10 },
            'armor_leather': { col: 6, row: 10 },
            'armor_chain': { col: 7, row: 10 },
            'armor_plate': { col: 8, row: 10 },
            
            // Row 12 - Boots and gloves
            'boots_leather': { col: 0, row: 11 },
            'boots_iron': { col: 1, row: 11 },
            'gloves_leather': { col: 4, row: 11 },
            'helmet_iron': { col: 8, row: 11 },
            
            // Row 13 - Gems
            'gem_diamond': { col: 0, row: 12 },
            'gem_sapphire': { col: 1, row: 12 },
            'gem_ruby': { col: 2, row: 12 },
            'gem_emerald': { col: 3, row: 12 },
            'gem_amethyst': { col: 4, row: 12 },
            'coin_gold': { col: 9, row: 12 },
            'coin_silver': { col: 10, row: 12 },
            'key_gold': { col: 12, row: 12 },
            
            // Row 14 - Misc items
            'ring_gold': { col: 0, row: 13 },
            'ring_silver': { col: 1, row: 13 },
            'necklace': { col: 4, row: 13 },
            'scroll': { col: 14, row: 12 },
            'book': { col: 15, row: 12 },
            
            // Row 16 - Effects/status icons
            'fire_icon': { col: 0, row: 15 },
            'ice_icon': { col: 7, row: 16 },
            'lightning_icon': { col: 0, row: 18 },
            'heart': { col: 9, row: 15 },
            'star': { col: 11, row: 16 },
            
            // Row 19-20 - Skills icons
            'skill_attack': { col: 1, row: 19 },
            'skill_defense': { col: 2, row: 19 },
            'skill_magic': { col: 3, row: 19 },
            
            // Projectiles
            'arrow': { col: 0, row: 21 },
            'arrow_fire': { col: 1, row: 21 },
            'arrow_ice': { col: 2, row: 21 },
            
            // Default gun placeholder (using crossbow)
            'gun': { col: 3, row: 9 },
        };
        
        const pos = ITEM_POSITIONS[itemId];
        if (!pos) return false;
        
        const srcX = pos.col * SPRITE_SIZE;
        const srcY = pos.row * SPRITE_SIZE;
        
        ctx.drawImage(
            spritesheet,
            srcX, srcY, SPRITE_SIZE, SPRITE_SIZE,
            x - size / 2, y - size / 2, size, size
        );
        
        return true;
    },
    
    /**
     * Load a single image
     */
    async loadImage(src) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = () => reject(new Error(`Failed to load: ${src}`));
            img.src = src;
        });
    },
    
    /**
     * Load a single audio file
     */
    async loadAudio(src) {
        return new Promise((resolve, reject) => {
            const audio = new Audio();
            audio.oncanplaythrough = () => resolve(audio);
            audio.onerror = () => reject(new Error(`Failed to load: ${src}`));
            audio.preload = 'auto';
            audio.src = src;
        });
    }
};
