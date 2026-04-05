/**
 * State Manager - Manages game screens/states
 */

export class StateManager {
    constructor(engine) {
        this.engine = engine;
        this.currentState = 'loading';
        this.screens = {
            loading: document.getElementById('loading-screen'),
            menu: document.getElementById('menu-screen'),
            progression: document.getElementById('progression-screen'),
            settings: document.getElementById('settings-screen'),
            game: document.getElementById('game-screen'),
            gameover: document.getElementById('gameover-screen')
        };
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Resume button
        document.getElementById('resume-btn')?.addEventListener('click', () => {
            this.engine.resume();
        });
        
        // Quit button
        document.getElementById('quit-btn')?.addEventListener('click', () => {
            this.engine.quitToMenu();
        });
        
        // Retry button
        document.getElementById('retry-btn')?.addEventListener('click', () => {
            this.switchTo('menu');
        });
        
        // Game over menu button
        document.getElementById('gameover-menu-btn')?.addEventListener('click', () => {
            this.switchTo('menu');
        });
        
        // Keyboard shortcuts
        window.addEventListener('keydown', (e) => {
            if (this.currentState === 'game') {
                if (e.code === 'KeyP') {
                    this.engine.togglePause();
                } else if (e.code === 'Escape') {
                    // Escape: Ayarlar açıksa kapat, değilse pause menüyü aç/kapat
                    const settingsOverlay = document.getElementById('ingame-settings-overlay');
                    if (settingsOverlay && settingsOverlay.style.display !== 'none') {
                        this.engine.hideInGameSettings();
                    } else if (this.engine.paused) {
                        this.engine.resume();
                    } else {
                        this.engine.pause();
                    }
                } else if (e.code === 'KeyO') {
                    // O: Direkt ayarları aç/kapat
                    const settingsOverlay = document.getElementById('ingame-settings-overlay');
                    if (settingsOverlay && settingsOverlay.style.display !== 'none') {
                        this.engine.hideInGameSettings();
                        if (this.engine.paused) {
                            this.engine.resume();
                        }
                    } else {
                        this.engine.pause();
                        this.engine.showInGameSettings();
                    }
                }
            }
        });
    }
    
    switchTo(state) {
        // Hide all screens
        Object.values(this.screens).forEach(screen => {
            if (screen) {
                screen.classList.remove('active');
            }
        });
        
        // Show target screen
        const targetScreen = this.screens[state];
        if (targetScreen) {
            targetScreen.classList.add('active');
        }
        
        this.currentState = state;
        
        // State-specific logic
        switch (state) {
            case 'menu':
                this.engine.ui?.menuUI?.refresh();
                break;
            case 'progression':
                this.engine.ui?.progressionUI?.refresh();
                break;
            case 'settings':
                this.engine.ui?.settingsUI?.refresh();
                break;
        }
    }
    
    startGame(upgrade, selectedClass) {
        this.switchTo('game');
        this.engine.startGame(upgrade, selectedClass);
        
        // Show/hide mobile controls based on touch mode
        const mobileControls = document.getElementById('mobile-controls');
        const hudControls = document.getElementById('hud-controls');
        
        const useTouchControls = !!(this.engine.saveData?.settings?.touchMode || document.body.classList.contains('touch-device'));
        
        if (useTouchControls) {
            this.engine.input.touchMode = true;
            if (mobileControls) mobileControls.style.display = 'block';
            if (hudControls) hudControls.style.display = 'none';
        } else {
            if (mobileControls) mobileControls.style.display = 'none';
            if (hudControls) hudControls.style.display = 'block';
        }
    }
    
    gameOver(score, wave, fluorideEarned) {
        // Update game over screen
        document.getElementById('final-score').textContent = score;
        document.getElementById('final-wave').textContent = wave;
        document.getElementById('earned-fluoride').textContent = `+${fluorideEarned} 💎`;
        
        // Switch to game over screen
        this.switchTo('gameover');
    }
}
