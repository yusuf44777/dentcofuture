/**
 * Progression UI Manager
 */

import { SKILL_TREE, COMPANIONS, CLASSES } from '../config.js';

export class ProgressionUI {
    constructor(engine, stateManager) {
        this.engine = engine;
        this.stateManager = stateManager;
        
        this.setupEventListeners();
    }
    
    setupEventListeners() {
        // Back button
        document.getElementById('progression-back-btn')?.addEventListener('click', () => {
            this.stateManager.switchTo('menu');
        });
    }
    
    refresh() {
        const saveData = this.engine.saveData;
        
        // Update fluoride display
        document.getElementById('progression-fluoride').textContent = saveData.fluoride || 0;
        
        // Render skill trees
        this.renderSkillTree('attack', 'attack-skills');
        this.renderSkillTree('defense', 'defense-skills');
        this.renderSkillTree('utility', 'utility-skills');
        
        // Render companions
        this.renderCompanions();
    }
    
    renderSkillTree(branch, containerId) {
        const container = document.getElementById(containerId);
        if (!container) return;
        
        container.innerHTML = '';
        
        const saveData = this.engine.saveData;
        const unlockedSkills = saveData.unlockedSkills || [];
        
        // Get skills for this branch and sort by tier
        const branchSkills = Object.entries(SKILL_TREE)
            .filter(([key, skill]) => skill.branch === branch)
            .sort((a, b) => a[1].tier - b[1].tier);
        
        for (const [skillId, skill] of branchSkills) {
            const isUnlocked = unlockedSkills.includes(skillId);
            const canUnlock = this.canUnlockSkill(skillId, skill, unlockedSkills, saveData.fluoride || 0);
            
            const node = document.createElement('div');
            node.className = `skill-node ${isUnlocked ? 'unlocked' : ''} ${!canUnlock && !isUnlocked ? 'locked' : ''}`;
            node.innerHTML = `
                <div class="skill-name">${skill.name}</div>
                <div class="skill-desc">${skill.desc}</div>
                ${!isUnlocked ? `<div class="skill-cost">${skill.cost} 💎</div>` : ''}
            `;
            
            if (!isUnlocked && canUnlock) {
                node.addEventListener('click', () => {
                    this.unlockSkill(skillId, skill);
                });
            }
            
            container.appendChild(node);
        }
    }
    
    canUnlockSkill(skillId, skill, unlockedSkills, fluoride) {
        // Check if player has enough fluoride
        if (fluoride < skill.cost) return false;
        
        // Check if requirements are met
        for (const req of skill.requires) {
            if (!unlockedSkills.includes(req)) return false;
        }
        
        return true;
    }
    
    unlockSkill(skillId, skill) {
        const saveData = this.engine.saveData;
        
        if ((saveData.fluoride || 0) < skill.cost) return;
        
        saveData.fluoride -= skill.cost;
        saveData.unlockedSkills = saveData.unlockedSkills || [];
        saveData.unlockedSkills.push(skillId);
        
        import('../utils/SaveSystem.js').then(({ SaveSystem }) => {
            SaveSystem.save(saveData);
        });
        
        this.refresh();
    }
    
    renderCompanions() {
        const container = document.getElementById('companion-list');
        if (!container) return;
        
        container.innerHTML = '';
        
        const saveData = this.engine.saveData;
        const unlockedCompanions = saveData.unlockedCompanions || [];
        const selectedCompanion = saveData.selectedCompanion;
        
        for (const [companionId, companion] of Object.entries(COMPANIONS)) {
            const isUnlocked = unlockedCompanions.includes(companionId);
            const isSelected = selectedCompanion === companionId;
            
            const card = document.createElement('div');
            card.className = `companion-card ${isSelected ? 'selected' : ''} ${!isUnlocked ? 'locked' : ''}`;
            card.innerHTML = `
                <div class="companion-icon">${companion.icon}</div>
                <div class="companion-name">${companion.name}</div>
                ${!isUnlocked ? `<div class="companion-cost">${companion.unlock_cost} 💎</div>` : ''}
            `;
            
            card.addEventListener('click', () => {
                if (isUnlocked) {
                    this.selectCompanion(companionId);
                } else {
                    this.unlockCompanion(companionId, companion);
                }
            });
            
            container.appendChild(card);
        }
    }
    
    selectCompanion(companionId) {
        const saveData = this.engine.saveData;
        saveData.selectedCompanion = companionId;
        
        import('../utils/SaveSystem.js').then(({ SaveSystem }) => {
            SaveSystem.save(saveData);
        });
        
        this.refresh();
    }
    
    unlockCompanion(companionId, companion) {
        const saveData = this.engine.saveData;
        
        if ((saveData.fluoride || 0) < companion.unlock_cost) return;
        
        saveData.fluoride -= companion.unlock_cost;
        saveData.unlockedCompanions = saveData.unlockedCompanions || [];
        saveData.unlockedCompanions.push(companionId);
        
        import('../utils/SaveSystem.js').then(({ SaveSystem }) => {
            SaveSystem.save(saveData);
        });
        
        this.refresh();
    }
}
