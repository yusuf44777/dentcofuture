/**
 * Combo System
 */

import { CONFIG } from '../config.js';

export class ComboSystem {
    constructor() {
        this.multiplier = 1.0;
        this.timer = 0;
        this.burstReady = false;
        this.burstThreshold = 3.0; // Combo x3.0'da burst hazır
        this.lastMilestone = 1;
    }
    
    registerHit() {
        this.timer = CONFIG.COMBO_RESET_TIME;
    }
    
    registerKill() {
        const prevMultiplier = this.multiplier;
        this.multiplier = Math.min(CONFIG.COMBO_MAX, this.multiplier + CONFIG.COMBO_STEP);
        this.timer = CONFIG.COMBO_RESET_TIME;
        
        // Check for milestone (every x1.0 increase)
        const currentMilestone = Math.floor(this.multiplier);
        if (currentMilestone > this.lastMilestone && currentMilestone >= 2) {
            this.lastMilestone = currentMilestone;
            return { milestone: currentMilestone, burst: false };
        }
        
        // Check if burst is ready
        if (this.multiplier >= this.burstThreshold && !this.burstReady) {
            this.burstReady = true;
            return { milestone: 0, burstReady: true };
        }
        
        return { milestone: 0, burst: false };
    }
    
    // Trigger combo burst (damages all nearby enemies)
    triggerBurst() {
        if (!this.burstReady) return null;
        
        this.burstReady = false;
        
        // Consume half the combo
        const burstDamage = Math.floor(this.multiplier * 15);
        this.multiplier = Math.max(1.0, this.multiplier * 0.5);
        this.lastMilestone = Math.floor(this.multiplier);
        
        return {
            damage: burstDamage,
            radius: 150
        };
    }
    
    boost(amount) {
        this.multiplier = Math.min(CONFIG.COMBO_MAX, this.multiplier + amount);
        this.timer = CONFIG.COMBO_RESET_TIME;
    }
    
    update(dt) {
        if (this.timer > 0) {
            this.timer -= dt;
        } else {
            if (this.multiplier > 1.0) {
                const prevMult = this.multiplier;
                this.multiplier = Math.max(1.0, this.multiplier - dt * CONFIG.COMBO_DECAY_RATE);
                
                // Reset burst if combo drops below threshold
                if (this.multiplier < this.burstThreshold) {
                    this.burstReady = false;
                }
                
                // Update milestone
                if (Math.floor(this.multiplier) < this.lastMilestone) {
                    this.lastMilestone = Math.floor(this.multiplier);
                }
            }
        }
    }
}
