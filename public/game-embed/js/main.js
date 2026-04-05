/**
 * Tooth Defenders - Main Entry Point
 * Modern JavaScript roguelike game
 */

import { GameEngine } from './core/GameEngine.js';
import { StateManager } from './core/StateManager.js';
import { AssetLoader } from './utils/AssetLoader.js';
import { AudioManager } from './systems/AudioManager.js';
import { SaveSystem } from './utils/SaveSystem.js';
import { MenuUI } from './ui/MenuUI.js';
import { ProgressionUI } from './ui/ProgressionUI.js';
import { SettingsUI } from './ui/SettingsUI.js';

// Global game instance
let game = null;

/**
 * Initialize the game
 */
async function init() {
    console.log('🦷 Tooth Defenders - Initializing...');
    
    // Get loading elements
    const loadingProgress = document.getElementById('loading-progress');
    const loadingText = document.getElementById('loading-text');
    
    try {
        // Load saved data
        loadingText.textContent = 'Kayıtlar yükleniyor...';
        loadingProgress.style.width = '10%';
        const saveData = SaveSystem.load();
        
        // Initialize audio manager
        loadingText.textContent = 'Ses sistemi hazırlanıyor...';
        loadingProgress.style.width = '30%';
        const audio = new AudioManager(saveData.settings);
        
        // Load assets
        loadingText.textContent = 'Grafikler yükleniyor...';
        loadingProgress.style.width = '50%';
        const assets = await AssetLoader.loadAll((progress) => {
            loadingProgress.style.width = `${50 + progress * 40}%`;
        });
        
        // Initialize state manager
        loadingText.textContent = 'Oyun hazırlanıyor...';
        loadingProgress.style.width = '95%';
        
        // Create game engine
        game = new GameEngine({
            canvas: document.getElementById('game-canvas'),
            saveData,
            assets,
            audio
        });
        
        // Initialize UI managers
        const stateManager = new StateManager(game);
        const menuUI = new MenuUI(game, stateManager);
        const progressionUI = new ProgressionUI(game, stateManager);
        const settingsUI = new SettingsUI(game, stateManager);
        
        // Connect components
        game.setStateManager(stateManager);
        game.setUI({ menuUI, progressionUI, settingsUI });
        
        // Setup in-game settings event listeners
        setupInGameSettings(game, audio);
        
        // Complete loading
        loadingProgress.style.width = '100%';
        loadingText.textContent = 'Hazır!';
        
        // Short delay before showing menu
        await new Promise(resolve => setTimeout(resolve, 500));
        
        // Switch to menu
        stateManager.switchTo('menu');
        
        // Start menu music (will play after first user interaction)
        document.addEventListener('click', () => {
            if (!audio.currentMusic) {
                audio.playMusic('menu');
            }
        }, { once: true });
        
        console.log('✅ Game initialized successfully!');
        
    } catch (error) {
        console.error('❌ Failed to initialize game:', error);
        loadingText.textContent = 'Hata oluştu! Sayfayı yenileyin.';
        loadingProgress.style.background = '#ff6392';
    }
}

// Start when DOM is ready
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
} else {
    init();
}

// Handle window resize
window.addEventListener('resize', () => {
    if (game) {
        game.handleResize();
    }
});

// Handle visibility change (pause when tab is hidden)
document.addEventListener('visibilitychange', () => {
    if (game && document.hidden) {
        game.pause();
    }
});

/**
 * Setup in-game settings event listeners
 */
function setupInGameSettings(gameEngine, audio) {
    // HUD settings button
    document.getElementById('hud-settings-btn')?.addEventListener('click', () => {
        gameEngine.pause();
        gameEngine.showInGameSettings();
    });
    
    // Pause menu settings button
    document.getElementById('pause-settings-btn')?.addEventListener('click', () => {
        gameEngine.showInGameSettings();
    });
    
    // In-game settings close button
    document.getElementById('ingame-settings-close-btn')?.addEventListener('click', () => {
        gameEngine.hideInGameSettings();
    });
    
    // Volume sliders in in-game settings
    const setupVolumeSlider = (sliderId, callback) => {
        const slider = document.getElementById(sliderId);
        if (slider) {
            slider.addEventListener('input', (e) => {
                const value = parseInt(e.target.value) / 100;
                callback(value);
                
                // Update display
                const display = slider.parentElement.querySelector('.volume-value');
                if (display) {
                    display.textContent = `${e.target.value}%`;
                }
            });
        }
    };
    
    setupVolumeSlider('ingame-master-volume', (v) => audio.setMasterVolume(v));
    setupVolumeSlider('ingame-music-volume', (v) => audio.setMusicVolume(v));
    setupVolumeSlider('ingame-sfx-volume', (v) => audio.setSfxVolume(v));
    
    // In-game touch mode toggle
    document.getElementById('ingame-touch-mode')?.addEventListener('change', (e) => {
        const mobileControls = document.getElementById('mobile-controls');
        const hudControls = document.getElementById('hud-controls');
        
        if (e.target.checked) {
            document.body.classList.add('touch-device');
            if (mobileControls) mobileControls.style.display = 'block';
            if (hudControls) hudControls.style.display = 'none';
        } else {
            document.body.classList.remove('touch-device');
            if (mobileControls) mobileControls.style.display = 'none';
            if (hudControls) hudControls.style.display = 'block';
        }
        
        // Sync input manager so joystick works immediately
        if (gameEngine?.input) {
            gameEngine.input.touchMode = e.target.checked;
            if (!e.target.checked) {
                gameEngine.input.aimTouchId = null;
                gameEngine.input.joystickPointerId = null;
                gameEngine.input.joystickDir.x = 0;
                gameEngine.input.joystickDir.y = 0;
                if (gameEngine.input.joystickHandleEl) {
                    gameEngine.input.joystickHandleEl.style.transform = 'translate(0px, 0px)';
                }
                gameEngine.input.firePressed = false;
                gameEngine.input.brushPressed = false;
                gameEngine.input.dashPressed = false;
                gameEngine.input.ultimatePressed = false;
                gameEngine.input.comboPressed = false;
                gameEngine.input.pausePressed = false;
            }
        }
        
        // Save setting
        gameEngine.saveData.settings = gameEngine.saveData.settings || {};
        gameEngine.saveData.settings.touchMode = e.target.checked;
        import('./utils/SaveSystem.js').then(({ SaveSystem }) => {
            SaveSystem.save(gameEngine.saveData);
        });
    });
    
    // Inventory slot click handlers
    document.querySelectorAll('.inventory-slot').forEach(slot => {
        slot.addEventListener('click', () => {
            const index = parseInt(slot.dataset.index);
            if (gameEngine.game && gameEngine.game.player) {
                gameEngine.game.player.activeWeaponIndex = index;
                // Update UI immediately
                document.querySelectorAll('.inventory-slot').forEach((s, i) => {
                    s.classList.toggle('selected', i === index);
                });
            }
        });
    });
}
