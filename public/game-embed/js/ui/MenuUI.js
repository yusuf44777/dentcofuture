/**
 * Menu UI Manager
 */

import { UPGRADE_PRESETS, CLASSES } from '../config.js';
import { shuffle } from '../utils/Math.js';

export class MenuUI {
    constructor(engine, stateManager) {
        this.engine = engine;
        this.stateManager = stateManager;
        
        this.selectedUpgrade = null;
        this.upgradeOptions = [];
        
        this.setupEventListeners();
        this.rollUpgrades();
    }
    
    setupEventListeners() {
        // Start game button
        document.getElementById('start-game-btn')?.addEventListener('click', () => {
            this.startGame();
        });
        
        // Progression button
        document.getElementById('progression-btn')?.addEventListener('click', () => {
            this.stateManager.switchTo('progression');
        });
        
        // Settings button
        document.getElementById('settings-btn')?.addEventListener('click', () => {
            this.stateManager.switchTo('settings');
        });
        
        // Player name input
        document.getElementById('player-name')?.addEventListener('change', (e) => {
            this.engine.saveData.playerName = e.target.value;
            import('../utils/SaveSystem.js').then(({ SaveSystem }) => {
                SaveSystem.save(this.engine.saveData);
            });
        });
        
        // Class selector
        document.getElementById('class-select')?.addEventListener('change', (e) => {
            this.engine.saveData.selectedClass = e.target.value;
            this.updatePlayerAvatar();
        });
    }
    
    rollUpgrades() {
        // Get 3 random upgrades
        this.upgradeOptions = shuffle([...UPGRADE_PRESETS]).slice(0, 3);
        this.selectedUpgrade = this.upgradeOptions[0];
        this.renderUpgrades();
    }
    
    renderUpgrades() {
        const container = document.getElementById('upgrade-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        this.upgradeOptions.forEach((upgrade, index) => {
            const card = document.createElement('div');
            card.className = `upgrade-card ${upgrade === this.selectedUpgrade ? 'selected' : ''}`;
            card.innerHTML = `
                <div class="upgrade-icon">${upgrade.icon}</div>
                <div class="upgrade-info">
                    <div class="upgrade-name">${upgrade.name}</div>
                    <div class="upgrade-desc">${upgrade.desc}</div>
                </div>
                <div class="upgrade-check">✓</div>
            `;
            
            card.addEventListener('click', () => {
                this.selectUpgrade(upgrade);
            });
            
            container.appendChild(card);
        });
    }
    
    selectUpgrade(upgrade) {
        this.selectedUpgrade = upgrade;
        this.renderUpgrades();
    }
    
    updatePlayerAvatar() {
        const classId = this.engine.saveData.selectedClass || 'fircaci';
        const classData = CLASSES[classId];
        const avatar = document.getElementById('player-avatar');
        
        if (avatar && classData) {
            avatar.textContent = classData.icon;
        }
    }
    
    refresh() {
        const saveData = this.engine.saveData;
        
        // Update stats
        document.getElementById('best-score').textContent = saveData.bestScore || 0;
        document.getElementById('best-wave').textContent = saveData.bestWave || 0;
        document.getElementById('fluoride-amount').textContent = saveData.fluoride || 0;
        
        // Update player info
        document.getElementById('player-name').value = saveData.playerName || 'Ajan';
        
        // Update class selector
        const classSelect = document.getElementById('class-select');
        if (classSelect) {
            classSelect.value = saveData.selectedClass || 'fircaci';
            
            // Update locked classes
            const unlockedClasses = saveData.unlockedClasses || ['fircaci', 'macuncu'];
            for (const option of classSelect.options) {
                const classId = option.value;
                const classData = CLASSES[classId];
                
                if (!unlockedClasses.includes(classId)) {
                    option.textContent = `${classData.name} 🔒 (${classData.unlock_cost} 💎)`;
                    option.disabled = true;
                } else {
                    option.textContent = classData.name;
                    option.disabled = false;
                }
            }
        }
        
        this.updatePlayerAvatar();
        this.rollUpgrades();
    }
    
    startGame() {
        const selectedClass = this.engine.saveData.selectedClass || 'fircaci';
        const upgrade = this.selectedUpgrade?.mods || {};
        
        this.stateManager.startGame(upgrade, selectedClass);
    }
}
