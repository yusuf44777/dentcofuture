/**
 * Settings UI Manager
 */

export class SettingsUI {
    constructor(engine, stateManager) {
        this.engine = engine;
        this.stateManager = stateManager;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Back button
        document.getElementById('settings-back-btn')?.addEventListener('click', () => {
            this.saveSettings();
            this.stateManager.switchTo('menu');
        });
        
        // Volume sliders
        this.setupVolumeSlider('master-volume', (value) => {
            this.engine.audio.setMasterVolume(value / 100);
        });
        
        this.setupVolumeSlider('music-volume', (value) => {
            this.engine.audio.setMusicVolume(value / 100);
        });
        
        this.setupVolumeSlider('sfx-volume', (value) => {
            this.engine.audio.setSfxVolume(value / 100);
        });
        
        // Touch mode
        document.getElementById('touch-mode')?.addEventListener('change', (e) => {
            this.engine.saveData.settings = this.engine.saveData.settings || {};
            this.engine.saveData.settings.touchMode = e.target.checked;
            
            // Sync input manager
            if (this.engine.input) {
                this.engine.input.touchMode = e.target.checked;
                if (!e.target.checked) {
                    this.engine.input.aimTouchId = null;
                    this.engine.input.joystickPointerId = null;
                    this.engine.input.joystickDir.x = 0;
                    this.engine.input.joystickDir.y = 0;
                    if (this.engine.input.joystickHandleEl) {
                        this.engine.input.joystickHandleEl.style.transform = 'translate(0px, 0px)';
                    }
                    this.engine.input.firePressed = false;
                    this.engine.input.brushPressed = false;
                    this.engine.input.dashPressed = false;
                    this.engine.input.ultimatePressed = false;
                    this.engine.input.comboPressed = false;
                    this.engine.input.pausePressed = false;
                }
            }
            
            // Show/hide mobile controls
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
        });
    }
    
    setupVolumeSlider(id, callback) {
        const slider = document.getElementById(id);
        if (!slider) return;
        
        slider.addEventListener('input', (e) => {
            const value = parseInt(e.target.value);
            callback(value);
            
            // Update display
            const parent = slider.parentElement;
            const display = parent.querySelector('.volume-value');
            if (display) {
                display.textContent = `${value}%`;
            }
        });
    }
    
    refresh() {
        const settings = this.engine.saveData.settings || {};
        
        // Master volume
        const masterSlider = document.getElementById('master-volume');
        if (masterSlider) {
            const value = Math.round((settings.masterVolume ?? 0.8) * 100);
            masterSlider.value = value;
            masterSlider.parentElement.querySelector('.volume-value').textContent = `${value}%`;
        }
        
        // Music volume
        const musicSlider = document.getElementById('music-volume');
        if (musicSlider) {
            const value = Math.round((settings.musicVolume ?? 0.6) * 100);
            musicSlider.value = value;
            musicSlider.parentElement.querySelector('.volume-value').textContent = `${value}%`;
        }
        
        // SFX volume
        const sfxSlider = document.getElementById('sfx-volume');
        if (sfxSlider) {
            const value = Math.round((settings.sfxVolume ?? 0.9) * 100);
            sfxSlider.value = value;
            sfxSlider.parentElement.querySelector('.volume-value').textContent = `${value}%`;
        }
        
        // Touch mode
        const touchMode = document.getElementById('touch-mode');
        if (touchMode) {
            const isTouchMode = settings.touchMode || false;
            touchMode.checked = isTouchMode;
            
            // Apply mobile controls visibility
            const mobileControls = document.getElementById('mobile-controls');
            const hudControls = document.getElementById('hud-controls');
            
            if (isTouchMode) {
                document.body.classList.add('touch-device');
                if (mobileControls) mobileControls.style.display = 'block';
                if (hudControls) hudControls.style.display = 'none';
            }
        }
    }
    
    saveSettings() {
        const masterSlider = document.getElementById('master-volume');
        const musicSlider = document.getElementById('music-volume');
        const sfxSlider = document.getElementById('sfx-volume');
        const touchMode = document.getElementById('touch-mode');
        
        this.engine.saveData.settings = {
            masterVolume: parseInt(masterSlider?.value || 80) / 100,
            musicVolume: parseInt(musicSlider?.value || 60) / 100,
            sfxVolume: parseInt(sfxSlider?.value || 90) / 100,
            touchMode: touchMode?.checked || false
        };
        
        import('../utils/SaveSystem.js').then(({ SaveSystem }) => {
            SaveSystem.save(this.engine.saveData);
        });
    }
}
