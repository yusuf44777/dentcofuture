/**
 * Particle System
 */

import { Vector2, randomRange, hexToRgb } from '../utils/Math.js';

class Particle {
    constructor(pos, vel, color, lifetime, size = 4) {
        this.pos = pos.clone();
        this.vel = vel.clone();
        this.color = color;
        this.lifetime = lifetime;
        this.age = 0;
        this.size = size;
    }
    
    get alive() {
        return this.age < this.lifetime;
    }
    
    update(dt) {
        this.pos = this.pos.addScaled(this.vel, dt);
        this.vel = this.vel.scale(0.98); // Friction
        this.age += dt;
    }
    
    draw(ctx) {
        const alpha = Math.max(0, 1 - this.age / this.lifetime);
        const size = this.size * alpha;
        
        ctx.globalAlpha = alpha;
        ctx.fillStyle = this.color;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, size, 0, Math.PI * 2);
        ctx.fill();
        ctx.globalAlpha = 1;
    }
}

class RingParticle {
    constructor(pos, color, maxRadius) {
        this.pos = pos.clone();
        this.color = color;
        this.maxRadius = maxRadius;
        this.radius = 0;
        this.lifetime = 0.3;
        this.age = 0;
    }
    
    get alive() {
        return this.age < this.lifetime;
    }
    
    update(dt) {
        this.age += dt;
        this.radius = this.maxRadius * (this.age / this.lifetime);
    }
    
    draw(ctx) {
        const alpha = Math.max(0, 1 - this.age / this.lifetime);
        
        ctx.globalAlpha = alpha * 0.6;
        ctx.strokeStyle = this.color;
        ctx.lineWidth = 4 * alpha;
        ctx.beginPath();
        ctx.arc(this.pos.x, this.pos.y, this.radius, 0, Math.PI * 2);
        ctx.stroke();
        ctx.globalAlpha = 1;
    }
}

export class ParticleSystem {
    constructor() {
        this.particles = [];
        this.rings = [];
    }
    
    burst(pos, color, amount = 6) {
        for (let i = 0; i < amount; i++) {
            const angle = randomRange(0, Math.PI * 2);
            const speed = randomRange(30, 140);
            const vel = Vector2.fromAngle(angle, speed);
            
            this.particles.push(new Particle(
                pos,
                vel,
                color,
                randomRange(0.3, 0.5),
                randomRange(3, 6)
            ));
        }
    }
    
    ring(pos, color, radius) {
        this.rings.push(new RingParticle(pos, color, radius));
    }
    
    trail(pos, color, amount = 3) {
        for (let i = 0; i < amount; i++) {
            const offset = Vector2.random(5);
            const vel = Vector2.random(20);
            
            this.particles.push(new Particle(
                pos.add(offset),
                vel,
                color,
                0.2,
                2
            ));
        }
    }
    
    // Death explosion effect - bigger and more dramatic
    deathExplosion(pos, color, entitySize = 20) {
        // Inner burst
        for (let i = 0; i < 15; i++) {
            const angle = randomRange(0, Math.PI * 2);
            const speed = randomRange(100, 250);
            const vel = Vector2.fromAngle(angle, speed);
            
            this.particles.push(new Particle(
                pos,
                vel,
                color,
                randomRange(0.4, 0.7),
                randomRange(4, 8)
            ));
        }
        
        // Outer ring of particles
        for (let i = 0; i < 8; i++) {
            const angle = (i / 8) * Math.PI * 2;
            const speed = randomRange(80, 150);
            const vel = Vector2.fromAngle(angle, speed);
            
            this.particles.push(new Particle(
                pos.add(Vector2.fromAngle(angle, entitySize * 0.5)),
                vel,
                '#ffffff',
                0.3,
                3
            ));
        }
        
        // Expanding ring
        this.ring(pos, color, entitySize * 2);
    }
    
    // Screen shake particles (visual only)
    screenFlash(color = '#ffffff', intensity = 0.5) {
        // Just create a big burst at center
        for (let i = 0; i < 20; i++) {
            const x = randomRange(100, 1180);
            const y = randomRange(100, 620);
            const pos = new Vector2(x, y);
            
            this.particles.push(new Particle(
                pos,
                Vector2.random(30),
                color,
                0.15,
                randomRange(2, 4)
            ));
        }
    }
    
    update(dt) {
        // Update particles
        for (let i = this.particles.length - 1; i >= 0; i--) {
            this.particles[i].update(dt);
            if (!this.particles[i].alive) {
                this.particles.splice(i, 1);
            }
        }
        
        // Update rings
        for (let i = this.rings.length - 1; i >= 0; i--) {
            this.rings[i].update(dt);
            if (!this.rings[i].alive) {
                this.rings.splice(i, 1);
            }
        }
    }
    
    draw(ctx) {
        // Draw rings first (behind particles)
        for (const ring of this.rings) {
            ring.draw(ctx);
        }
        
        // Draw particles
        for (const particle of this.particles) {
            particle.draw(ctx);
        }
    }
}
