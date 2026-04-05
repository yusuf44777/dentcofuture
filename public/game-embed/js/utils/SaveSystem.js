/**
 * Save System - LocalStorage based save/load
 */

const SAVE_KEY = 'tooth_defenders_save';

// Achievement definitions
export const ACHIEVEMENTS = [
    { id: 'first_blood', name: 'İlk Kan', desc: 'İlk düşmanını öldür', icon: '🩸', check: (stats) => stats.totalKills >= 1 },
    { id: 'centurion', name: 'Yüzbaşı', desc: '100 düşman öldür', icon: '💯', check: (stats) => stats.totalKills >= 100 },
    { id: 'elite_hunter', name: 'Elite Avcısı', desc: '10 elite düşman öldür', icon: '⭐', check: (stats) => stats.eliteKills >= 10 },
    { id: 'boss_slayer', name: 'Patron Katili', desc: 'İlk boss\'u yen', icon: '👑', check: (stats) => stats.bossKills >= 1 },
    { id: 'wave_5', name: 'Dayanıklı', desc: 'Dalga 5\'e ulaş', icon: '🌊', check: (stats) => stats.bestWave >= 5 },
    { id: 'wave_10', name: 'Hayatta Kalan', desc: 'Dalga 10\'a ulaş', icon: '🏆', check: (stats) => stats.bestWave >= 10 },
    { id: 'score_5k', name: 'Puan Ustası', desc: '5000 skor yap', icon: '📊', check: (stats) => stats.bestScore >= 5000 },
    { id: 'rich', name: 'Zengin', desc: 'Toplam 500 altın kazan', icon: '💰', check: (stats) => stats.totalGold >= 500 },
    { id: 'risk_taker', name: 'Risk Alan', desc: '3 seri dalga tamamla', icon: '🔥', check: (stats) => stats.maxStreak >= 3 },
    { id: 'shop_lover', name: 'Müşteri', desc: '5 shop ürünü satın al', icon: '🛒', check: (stats) => stats.shopPurchases >= 5 },
    { id: 'synergy_master', name: 'Sinerji Ustası', desc: '3 sinerji aç', icon: '⚡', check: (stats) => stats.synergiesUnlocked >= 3 },
    { id: 'combo_king', name: 'Kombo Kralı', desc: 'x5 kombo yap', icon: '🎯', check: (stats) => stats.maxCombo >= 5 },
];

// Permanent unlocks (meta progression bonuses)
export const PERMANENT_UNLOCKS = [
    { id: 'start_gold', name: 'Başlangıç Altını', desc: '+20 altın ile başla', cost: 100, apply: (player) => { /* applied in game start */ } },
    { id: 'start_hp', name: 'Güçlü Başlangıç', desc: '+15 max can', cost: 150, apply: (player) => { player.maxHealth += 15; player.health += 15; } },
    { id: 'better_drops', name: 'Şanslı Avcı', desc: '+10% drop şansı', cost: 200, apply: (player) => { player.luckBonus = (player.luckBonus || 0) + 0.1; } },
    { id: 'faster_ult', name: 'Hızlı Ultimate', desc: '+20% ultimate şarj', cost: 250, apply: (player) => { player.ultimateChargeRate = 1.2; } },
    { id: 'gold_bonus', name: 'Altın Madenci', desc: '+15% altın kazanımı', cost: 300, apply: (player) => { player.goldBonus = (player.goldBonus || 0) + 0.15; } },
];

export const SaveSystem = {
    /**
     * Load save data from localStorage
     */
    load() {
        try {
            const data = localStorage.getItem(SAVE_KEY);
            if (data) {
                const parsed = JSON.parse(data);
                // Ensure new fields exist
                return {
                    ...this.getDefaultSave(),
                    ...parsed,
                    stats: { ...this.getDefaultSave().stats, ...(parsed.stats || {}) },
                    achievements: parsed.achievements || [],
                    permanentUnlocks: parsed.permanentUnlocks || [],
                };
            }
        } catch (e) {
            console.warn('Failed to load save data:', e);
        }
        
        return this.getDefaultSave();
    },
    
    getDefaultSave() {
        return {
            playerName: 'Ajan',
            selectedClass: 'fircaci',
            bestScore: 0,
            bestWave: 0,
            fluoride: 0,
            unlockedClasses: ['fircaci', 'macuncu'],
            unlockedSkills: [],
            unlockedCompanions: [],
            selectedCompanion: null,
            achievements: [],
            permanentUnlocks: [],
            stats: {
                totalKills: 0,
                eliteKills: 0,
                bossKills: 0,
                totalGold: 0,
                maxStreak: 0,
                shopPurchases: 0,
                synergiesUnlocked: 0,
                maxCombo: 0,
                gamesPlayed: 0,
            },
            settings: {
                masterVolume: 0.8,
                musicVolume: 0.6,
                sfxVolume: 0.9,
                touchMode: false
            }
        };
    },
    
    /**
     * Save data to localStorage
     */
    save(data) {
        try {
            localStorage.setItem(SAVE_KEY, JSON.stringify(data));
            return true;
        } catch (e) {
            console.warn('Failed to save data:', e);
            return false;
        }
    },
    
    /**
     * Update stats and check achievements
     */
    updateStats(saveData, newStats) {
        const stats = saveData.stats || {};
        
        // Update cumulative stats
        stats.totalKills = (stats.totalKills || 0) + (newStats.kills || 0);
        stats.eliteKills = (stats.eliteKills || 0) + (newStats.eliteKills || 0);
        stats.bossKills = (stats.bossKills || 0) + (newStats.bossKills || 0);
        stats.totalGold = (stats.totalGold || 0) + (newStats.goldEarned || 0);
        stats.shopPurchases = (stats.shopPurchases || 0) + (newStats.shopPurchases || 0);
        stats.synergiesUnlocked = Math.max(stats.synergiesUnlocked || 0, newStats.synergiesUnlocked || 0);
        stats.gamesPlayed = (stats.gamesPlayed || 0) + 1;
        
        // Update max stats
        stats.maxStreak = Math.max(stats.maxStreak || 0, newStats.maxStreak || 0);
        stats.maxCombo = Math.max(stats.maxCombo || 0, newStats.maxCombo || 0);
        
        // Update best scores (in saveData, not stats)
        if (newStats.score > (saveData.bestScore || 0)) {
            saveData.bestScore = newStats.score;
        }
        if (newStats.wave > (saveData.bestWave || 0)) {
            saveData.bestWave = newStats.wave;
        }
        
        saveData.stats = stats;
        
        // Check achievements
        const newAchievements = this.checkAchievements(saveData);
        
        return { stats, newAchievements };
    },
    
    /**
     * Check and unlock new achievements
     */
    checkAchievements(saveData) {
        const stats = { ...saveData.stats, bestScore: saveData.bestScore, bestWave: saveData.bestWave };
        const unlocked = saveData.achievements || [];
        const newUnlocks = [];
        
        for (const achievement of ACHIEVEMENTS) {
            if (!unlocked.includes(achievement.id) && achievement.check(stats)) {
                unlocked.push(achievement.id);
                newUnlocks.push(achievement);
            }
        }
        
        saveData.achievements = unlocked;
        return newUnlocks;
    },
    
    /**
     * Purchase permanent unlock
     */
    purchaseUnlock(saveData, unlockId) {
        const unlock = PERMANENT_UNLOCKS.find(u => u.id === unlockId);
        if (!unlock) return false;
        
        if (saveData.fluoride < unlock.cost) return false;
        if (saveData.permanentUnlocks.includes(unlockId)) return false;
        
        saveData.fluoride -= unlock.cost;
        saveData.permanentUnlocks.push(unlockId);
        
        return true;
    },
    
    /**
     * Get unlocked permanent bonuses
     */
    getUnlockedBonuses(saveData) {
        return PERMANENT_UNLOCKS.filter(u => saveData.permanentUnlocks.includes(u.id));
    },
    
    /**
     * Clear all save data
     */
    clear() {
        try {
            localStorage.removeItem(SAVE_KEY);
            return true;
        } catch (e) {
            console.warn('Failed to clear save data:', e);
            return false;
        }
    },
    
    /**
     * Check if save data exists
     */
    exists() {
        return localStorage.getItem(SAVE_KEY) !== null;
    }
};
