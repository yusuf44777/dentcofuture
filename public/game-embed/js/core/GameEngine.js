/**
 * Game Engine - Main game loop and rendering
 */

import { CONFIG } from '../config.js';
import { Vector2 } from '../utils/Math.js';
import { InputManager } from './InputManager.js';
import { Game } from './Game.js';
import { AssetLoader } from '../utils/AssetLoader.js';

export class GameEngine {
    constructor(options) {
        this.canvas = options.canvas;
        this.ctx = this.canvas.getContext('2d');
        this.saveData = options.saveData;
        this.assets = options.assets;
        this.audio = options.audio;
        
        this.stateManager = null;
        this.ui = null;
        this.game = null;
        
        this.running = false;
        this.paused = false;
        this.lastTime = 0;
        this.deltaTime = 0;
        this.accumulator = 0;
        this.fixedStep = 1 / CONFIG.FPS;
        
        this.input = new InputManager(this.canvas);
        
        // Setup canvas
        this.handleResize();
        
        // Bind methods
        this.gameLoop = this.gameLoop.bind(this);
    }
    
    setStateManager(stateManager) {
        this.stateManager = stateManager;
    }
    
    setUI(ui) {
        this.ui = ui;
    }
    
    handleResize() {
        // Set canvas internal size (drawing resolution)
        this.canvas.width = CONFIG.SCREEN_WIDTH;
        this.canvas.height = CONFIG.SCREEN_HEIGHT;
        
        this.scale = 1;
        
        console.log(`Canvas set to: ${CONFIG.SCREEN_WIDTH}x${CONFIG.SCREEN_HEIGHT}`);
    }
    
    startGame(upgrade = null, selectedClass = 'fircaci') {
        console.log('🎮 Starting game with class:', selectedClass);
        
        // Ensure canvas is properly sized
        this.handleResize();
        
        // Create new game instance
        this.game = new Game({
            engine: this,
            upgrade,
            selectedClass,
            saveData: this.saveData,
            audio: this.audio
        });
        
        this.running = true;
        this.paused = false;
        this.lastTime = performance.now();
        
        console.log('🎮 Game created, starting loop...');
        
        // Start game loop
        requestAnimationFrame(this.gameLoop);
    }
    
    gameLoop(currentTime) {
        if (!this.running) return;
        
        // Calculate delta time
        this.deltaTime = (currentTime - this.lastTime) / 1000;
        this.lastTime = currentTime;
        
        // Cap delta time to prevent spiral of death
        if (this.deltaTime > 0.25) {
            this.deltaTime = 0.25;
        }
        
        // Check for mobile pause button
        if (this.input.wantsPause()) {
            this.togglePause();
        }
        
        // Update
        if (!this.paused) {
            this.accumulator += this.deltaTime;
            
            while (this.accumulator >= this.fixedStep) {
                this.game.update(this.fixedStep);
                this.accumulator -= this.fixedStep;
            }
        }
        
        // Render
        this.render();
        
        // Update input state
        this.input.update();
        
        // Continue loop
        requestAnimationFrame(this.gameLoop);
    }
    
    render() {
        const ctx = this.ctx;
        
        // Clear
        ctx.fillStyle = CONFIG.COLORS.BG;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw background if game is running
        if (this.game) {
            this.drawBackground(ctx, this.game.wave);
        } else {
            // Draw grid
            this.drawGrid();
        }
        
        // Draw game
        if (this.game) {
            this.game.render(ctx);
        }
    }
    
    drawBackground(ctx, wave) {
        // Choose background theme based on wave
        let theme;
        if (wave >= 7) {
            // Tongue Cavern - dark red/purple
            theme = {
                gradient1: '#1a0a1a',
                gradient2: '#2d1528',
                gradient3: '#3d1a35',
                accent: 'rgba(255, 100, 150, 0.1)',
                gridColor: 'rgba(255, 100, 150, 0.15)'
            };
        } else if (wave >= 4) {
            // Molar Valley - blue/teal
            theme = {
                gradient1: '#0a1520',
                gradient2: '#102535',
                gradient3: '#153545',
                accent: 'rgba(100, 200, 255, 0.1)',
                gridColor: 'rgba(100, 200, 255, 0.15)'
            };
        } else {
            // Gum Lab - green/cyan
            theme = {
                gradient1: '#0a1812',
                gradient2: '#0f2820',
                gradient3: '#14382a',
                accent: 'rgba(120, 220, 180, 0.1)',
                gridColor: 'rgba(120, 220, 180, 0.15)'
            };
        }
        
        // Draw radial gradient background
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const radius = Math.max(this.canvas.width, this.canvas.height);
        
        const bgGradient = ctx.createRadialGradient(centerX, centerY, 0, centerX, centerY, radius);
        bgGradient.addColorStop(0, theme.gradient3);
        bgGradient.addColorStop(0.5, theme.gradient2);
        bgGradient.addColorStop(1, theme.gradient1);
        
        ctx.fillStyle = bgGradient;
        ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Draw subtle grid
        this.drawStyledGrid(ctx, theme.gridColor);
        
        // Draw ambient particles/decorations
        this.drawAmbientEffects(ctx, theme.accent, wave);
    }
    
    drawStyledGrid(ctx, color) {
        const gridSize = 60;
        
        ctx.save();
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        
        // Vertical lines
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        
        // Horizontal lines
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
        
        ctx.restore();
    }
    
    drawAmbientEffects(ctx, accentColor, wave) {
        // Draw some floating particles/bubbles in background
        const time = performance.now() / 1000;
        
        ctx.save();
        ctx.fillStyle = accentColor;
        
        for (let i = 0; i < 15; i++) {
            const x = ((i * 137) % this.canvas.width) + Math.sin(time + i) * 20;
            const y = ((i * 89) % this.canvas.height) + Math.cos(time * 0.7 + i) * 15;
            const size = 3 + Math.sin(time * 2 + i * 0.5) * 2;
            
            ctx.beginPath();
            ctx.arc(x, y, size, 0, Math.PI * 2);
            ctx.fill();
        }
        
        ctx.restore();
    }
    
    drawGrid() {
        const ctx = this.ctx;
        const gridSize = 50;
        
        ctx.save();
        ctx.strokeStyle = CONFIG.COLORS.GRID;
        ctx.lineWidth = 1;
        ctx.globalAlpha = 0.3;
        
        for (let x = 0; x <= this.canvas.width; x += gridSize) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, this.canvas.height);
            ctx.stroke();
        }
        
        for (let y = 0; y <= this.canvas.height; y += gridSize) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(this.canvas.width, y);
            ctx.stroke();
        }
        
        ctx.restore();
        
        ctx.globalAlpha = 1;
    }
    
    pause() {
        this.paused = true;
        this.updatePauseOverlay();
    }
    
    resume() {
        this.paused = false;
        this.hidePauseOverlay();
    }
    
    togglePause() {
        if (this.paused) {
            this.resume();
        } else {
            this.pause();
        }
    }
    
    updatePauseOverlay() {
        const overlay = document.getElementById('pause-overlay');
        const scoreEl = document.getElementById('pause-score');
        const waveEl = document.getElementById('pause-wave');
        
        if (!overlay) {
            console.error('pause-overlay not found!');
            return;
        }
        
        if (this.game) {
            if (scoreEl) scoreEl.textContent = this.game.score;
            if (waveEl) waveEl.textContent = this.game.wave;
        }
        
        overlay.style.display = 'flex';
        overlay.style.zIndex = '1000';
        console.log('Pause overlay shown');
    }
    
    hidePauseOverlay() {
        const overlay = document.getElementById('pause-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    gameOver(score, wave) {
        this.running = false;
        
        // Calculate fluoride earned (base + wave bonus + in-game earnings)
        const inGameFluoride = this.game?.fluorideEarned || 0;
        const fluorideEarned = Math.floor(score / 50) + wave * 15 + inGameFluoride;
        
        // Gather game stats for meta progression
        const gameStats = {
            score,
            wave,
            kills: this.game?.totalKills || 0,
            eliteKills: this.game?.eliteKills || 0,
            bossKills: this.game?.boss === null && wave >= 5 ? 1 : 0, // Simplified boss kill tracking
            goldEarned: this.game?.goldEarned || 0,
            maxStreak: this.game?.consecutiveWaves || 0,
            shopPurchases: 0, // Would need to track this
            synergiesUnlocked: Object.keys(this.game?.synergies || {}).filter(k => this.game?.synergies[k]).length,
            maxCombo: Math.floor(this.game?.combo?.multiplier || 1),
        };
        
        // Save progress with meta progression
        this.saveData.fluoride = (this.saveData.fluoride || 0) + fluorideEarned;
        
        // Update stats and check achievements
        import('../utils/SaveSystem.js').then(({ SaveSystem }) => {
            const { stats, newAchievements } = SaveSystem.updateStats(this.saveData, gameStats);
            SaveSystem.save(this.saveData);
            
            // Show achievement notifications (could be passed to game over screen)
            if (newAchievements && newAchievements.length > 0) {
                console.log('🏆 New achievements:', newAchievements.map(a => a.name));
            }
        });
        
        // Show game over screen
        this.stateManager.gameOver(score, wave, fluorideEarned);
    }
    
    quitToMenu() {
        this.running = false;
        this.paused = false;
        this.game = null;
        this.hidePauseOverlay();
        this.hideInGameSettings();
        this.stateManager.switchTo('menu');
    }
    
    showInGameSettings() {
        const overlay = document.getElementById('ingame-settings-overlay');
        if (!overlay) {
            console.error('In-game settings overlay not found!');
            return;
        }
        
        overlay.style.display = 'flex';
        
        // Sync volume sliders with current values
        const masterSlider = document.getElementById('ingame-master-volume');
        const musicSlider = document.getElementById('ingame-music-volume');
        const sfxSlider = document.getElementById('ingame-sfx-volume');
        const touchModeCheckbox = document.getElementById('ingame-touch-mode');
        
        if (this.audio && masterSlider && musicSlider && sfxSlider) {
            masterSlider.value = Math.round(this.audio.masterVolume * 100);
            musicSlider.value = Math.round(this.audio.musicVolume * 100);
            sfxSlider.value = Math.round(this.audio.sfxVolume * 100);
            
            // Update display values
            this.updateVolumeDisplay(masterSlider);
            this.updateVolumeDisplay(musicSlider);
            this.updateVolumeDisplay(sfxSlider);
        }
        
        // Sync touch mode
        if (touchModeCheckbox) {
            const settings = this.saveData.settings || {};
            touchModeCheckbox.checked = settings.touchMode || false;
        }
    }
    
    hideInGameSettings() {
        const overlay = document.getElementById('ingame-settings-overlay');
        if (overlay) {
            overlay.style.display = 'none';
        }
    }
    
    updateVolumeDisplay(slider) {
        const display = slider.parentElement.querySelector('.volume-value');
        if (display) {
            display.textContent = `${slider.value}%`;
        }
    }
    
    getMousePos() {
        const rect = this.canvas.getBoundingClientRect();
        const scaleX = this.canvas.width / rect.width;
        const scaleY = this.canvas.height / rect.height;
        
        return new Vector2(
            (this.input.mouseX - rect.left) * scaleX,
            (this.input.mouseY - rect.top) * scaleY
        );
    }
}
