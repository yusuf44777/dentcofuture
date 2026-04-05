/**
 * Audio Manager - Handles all game audio
 */

import { AssetLoader } from '../utils/AssetLoader.js';

export class AudioManager {
    constructor(settings = {}) {
        this.enabled = true;
        this.masterVolume = settings.masterVolume ?? 0.8;
        this.musicVolume = settings.musicVolume ?? 0.6;
        this.sfxVolume = settings.sfxVolume ?? 0.9;
        
        this.currentMusic = null;
        this.currentMusicKey = null;
        
        // SFX key mapping
        this.sfxMap = {
            'shoot': 'sfx_hit',
            'brush': 'sfx_brush',
            'hit': 'sfx_hit',
            'hurt': 'sfx_hurt',
            'pickup': 'sfx_coin',
            'enemy_shot': 'sfx_enemy_shot',
            'boss': 'sfx_boss',
            'coin': 'sfx_coin'
        };
        
        // Audio context for web audio
        this.audioContext = null;
    }
    
    async init() {
        try {
            this.audioContext = new (window.AudioContext || window.webkitAudioContext)();
        } catch (e) {
            console.warn('Web Audio API not supported');
        }
    }
    
    setMasterVolume(volume) {
        this.masterVolume = volume;
        this.updateMusicVolume();
    }
    
    setMusicVolume(volume) {
        this.musicVolume = volume;
        this.updateMusicVolume();
    }
    
    setSfxVolume(volume) {
        this.sfxVolume = volume;
    }
    
    updateMusicVolume() {
        if (this.currentMusic) {
            this.currentMusic.volume = this.masterVolume * this.musicVolume;
        }
    }
    
    playMusic(key = 'menu') {
        if (!this.enabled) return;
        
        // Stop current music
        this.stopMusic();
        
        const musicKey = key === 'menu' ? 'music_menu' : 'music_menu';
        const musicAudio = AssetLoader.getSound(musicKey);
        
        if (musicAudio) {
            this.currentMusic = musicAudio.cloneNode();
            this.currentMusic.loop = true;
            this.currentMusic.volume = this.masterVolume * this.musicVolume;
            this.currentMusicKey = key;
            
            this.currentMusic.play().catch(e => {
                console.warn('Music autoplay blocked:', e);
            });
        }
    }
    
    stopMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
            this.currentMusic.currentTime = 0;
            this.currentMusic = null;
            this.currentMusicKey = null;
        }
    }
    
    pauseMusic() {
        if (this.currentMusic) {
            this.currentMusic.pause();
        }
    }
    
    resumeMusic() {
        if (this.currentMusic && this.enabled) {
            this.currentMusic.play().catch(() => {});
        }
    }
    
    playSfx(key) {
        if (!this.enabled) return;
        
        // Resolve actual audio key
        const audioKey = this.sfxMap[key] || `sfx_${key}`;
        const sfxAudio = AssetLoader.getSound(audioKey);
        
        if (sfxAudio) {
            // Clone the audio to allow overlapping sounds
            const sound = sfxAudio.cloneNode();
            sound.volume = this.masterVolume * this.sfxVolume;
            sound.play().catch(() => {});
        }
    }
    
    toggle() {
        this.enabled = !this.enabled;
        if (!this.enabled) {
            this.pauseMusic();
        } else {
            this.resumeMusic();
        }
        return this.enabled;
    }
}
