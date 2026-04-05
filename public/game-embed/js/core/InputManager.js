/**
 * Input Manager - Handles keyboard and mouse input
 */

export class InputManager {
    constructor(canvas) {
        this.canvas = canvas;
        
        // Keyboard state
        this.keys = {};
        this.keysPressed = {};
        this.keysReleased = {};
        
        // Mouse state
        this.mouseX = 0;
        this.mouseY = 0;
        this.mouseButtons = {};
        this.mouseButtonsPressed = {};
        this.mouseButtonsReleased = {};
        
        // Touch state
        this.touchMode = false;
        this.aimTouchId = null;
        
        // Joystick state (for mobile)
        this.joystickDir = { x: 0, y: 0 };
        this.joystickPointerId = null;
        this.joystickStartX = 0;
        this.joystickStartY = 0;
        this.joystickMaxDist = 45;
        this.joystickHandleEl = null;
        this.firePressed = false;
        this.brushPressed = false;
        this.dashPressed = false;
        this.ultimatePressed = false;
        this.comboPressed = false;
        this.pausePressed = false;
        
        this.setupListeners();
    }
    
    setupListeners() {
        // Keyboard events
        window.addEventListener('keydown', (e) => {
            if (!this.keys[e.code]) {
                this.keysPressed[e.code] = true;
            }
            this.keys[e.code] = true;
            
            // Prevent default for game keys
            if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) {
                e.preventDefault();
            }
        });
        
        window.addEventListener('keyup', (e) => {
            this.keys[e.code] = false;
            this.keysReleased[e.code] = true;
        });
        
        // Mouse events
        window.addEventListener('mousemove', (e) => {
            this.mouseX = e.clientX;
            this.mouseY = e.clientY;
        });
        
        window.addEventListener('mousedown', (e) => {
            if (!this.mouseButtons[e.button]) {
                this.mouseButtonsPressed[e.button] = true;
            }
            this.mouseButtons[e.button] = true;
        });
        
        window.addEventListener('mouseup', (e) => {
            this.mouseButtons[e.button] = false;
            this.mouseButtonsReleased[e.button] = true;
        });
        
        // Context menu prevention
        this.canvas.addEventListener('contextmenu', (e) => {
            e.preventDefault();
        });
        
        // Touch events
        this.canvas.addEventListener('touchstart', (e) => {
            this.touchMode = true;
            this.handleTouchStart(e);
        }, { passive: false });
        
        this.canvas.addEventListener('touchmove', (e) => {
            this.handleTouchMove(e);
        }, { passive: false });
        
        this.canvas.addEventListener('touchend', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });
        
        this.canvas.addEventListener('touchcancel', (e) => {
            this.handleTouchEnd(e);
        }, { passive: false });
        
        // Mobile control buttons
        this.setupMobileControls();
    }
    
    setupMobileControls() {
        const fireBtn = document.getElementById('btn-fire');
        const brushBtn = document.getElementById('btn-brush');
        const dashBtn = document.getElementById('btn-dash');
        const ultimateBtn = document.getElementById('btn-ultimate');
        const comboBtn = document.getElementById('btn-combo');
        const pauseBtn = document.getElementById('btn-mobile-pause');
        const joystickEl = document.getElementById('joystick-left');
        this.joystickHandleEl = joystickEl?.querySelector?.('.joystick-handle') || null;
        
        const supportsPointer = typeof window !== 'undefined' && 'PointerEvent' in window;
        const syncJoystickMaxDistFromDOM = () => {
            if (!joystickEl || !this.joystickHandleEl) return;
            
            const baseEl = joystickEl.querySelector?.('.joystick-base');
            if (!baseEl) return;
            
            const baseRect = baseEl.getBoundingClientRect();
            const handleRect = this.joystickHandleEl.getBoundingClientRect();
            
            if (!baseRect.width || !handleRect.width) return;
            
            const baseSize = Math.min(baseRect.width, baseRect.height);
            const handleSize = Math.min(handleRect.width, handleRect.height);
            const maxDist = (baseSize - handleSize) / 2;
            
            if (Number.isFinite(maxDist) && maxDist > 0) {
                this.joystickMaxDist = Math.max(10, maxDist);
            }
        };
        
        const bindHoldButton = (el, onDown, onUp) => {
            if (!el) return;
            
            const down = (e) => {
                if (e?.preventDefault) e.preventDefault();
                this.touchMode = true;
                onDown();
                
                // Keep receiving events even if finger drifts off the button
                if (supportsPointer && e?.pointerId != null && el.setPointerCapture) {
                    try { el.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                }
            };
            
            const up = (e) => {
                if (e?.preventDefault) e.preventDefault();
                onUp();
            };
            
            if (supportsPointer) {
                el.addEventListener('pointerdown', down);
                el.addEventListener('pointerup', up);
                el.addEventListener('pointercancel', up);
            } else {
                el.addEventListener('touchstart', down, { passive: false });
                el.addEventListener('touchend', up);
                el.addEventListener('touchcancel', up);
            }
        };
        
        const bindTapButton = (el, onTap) => {
            if (!el) return;
            
            const tap = (e) => {
                if (e?.preventDefault) e.preventDefault();
                this.touchMode = true;
                onTap();
            };
            
            if (supportsPointer) {
                el.addEventListener('pointerdown', tap);
            } else {
                el.addEventListener('touchstart', tap, { passive: false });
            }
        };
        
        const resetJoystick = () => {
            this.joystickPointerId = null;
            this.joystickDir.x = 0;
            this.joystickDir.y = 0;
            if (this.joystickHandleEl) {
                this.joystickHandleEl.style.transform = 'translate(0px, 0px)';
            }
        };
        
        const updateJoystickFromPoint = (x, y) => {
            const dx = x - this.joystickStartX;
            const dy = y - this.joystickStartY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            const maxDist = this.joystickMaxDist;
            const clampedDist = Math.min(maxDist, dist);
            
            let clampedDx = 0;
            let clampedDy = 0;
            if (dist > 0) {
                const nx = dx / dist;
                const ny = dy / dist;
                clampedDx = nx * clampedDist;
                clampedDy = ny * clampedDist;
            }
            
            this.joystickDir.x = clampedDx / maxDist;
            this.joystickDir.y = clampedDy / maxDist;
            
            if (this.joystickHandleEl) {
                this.joystickHandleEl.style.transform = `translate(${clampedDx}px, ${clampedDy}px)`;
            }
        };
        
        // Joystick (left) - movement
        if (joystickEl) {
            if (supportsPointer) {
                joystickEl.addEventListener('pointerdown', (e) => {
                    if (e?.preventDefault) e.preventDefault();
                    this.touchMode = true;
                    syncJoystickMaxDistFromDOM();
                    this.joystickPointerId = e.pointerId;
                    this.joystickStartX = e.clientX;
                    this.joystickStartY = e.clientY;
                    updateJoystickFromPoint(e.clientX, e.clientY);
                    try { joystickEl.setPointerCapture(e.pointerId); } catch (_) { /* ignore */ }
                });
                
                joystickEl.addEventListener('pointermove', (e) => {
                    if (this.joystickPointerId !== e.pointerId) return;
                    if (e?.preventDefault) e.preventDefault();
                    updateJoystickFromPoint(e.clientX, e.clientY);
                });
                
                joystickEl.addEventListener('pointerup', (e) => {
                    if (this.joystickPointerId !== e.pointerId) return;
                    if (e?.preventDefault) e.preventDefault();
                    resetJoystick();
                });
                
                joystickEl.addEventListener('pointercancel', (e) => {
                    if (this.joystickPointerId !== e.pointerId) return;
                    resetJoystick();
                });
            } else {
                joystickEl.addEventListener('touchstart', (e) => {
                    e.preventDefault();
                    if (this.joystickPointerId !== null) return;
                    const touch = e.changedTouches?.[0];
                    if (!touch) return;
                    this.touchMode = true;
                    syncJoystickMaxDistFromDOM();
                    this.joystickPointerId = touch.identifier;
                    this.joystickStartX = touch.clientX;
                    this.joystickStartY = touch.clientY;
                    updateJoystickFromPoint(touch.clientX, touch.clientY);
                }, { passive: false });
                
                joystickEl.addEventListener('touchmove', (e) => {
                    e.preventDefault();
                    const t = [...(e.changedTouches || [])].find(tt => tt.identifier === this.joystickPointerId);
                    if (!t) return;
                    updateJoystickFromPoint(t.clientX, t.clientY);
                }, { passive: false });
                
                const endTouch = (e) => {
                    const ended = [...(e.changedTouches || [])].some(tt => tt.identifier === this.joystickPointerId);
                    if (ended) resetJoystick();
                };
                
                joystickEl.addEventListener('touchend', endTouch);
                joystickEl.addEventListener('touchcancel', endTouch);
            }
        }
        
        bindHoldButton(
            fireBtn,
            () => { this.firePressed = true; },
            () => { this.firePressed = false; }
        );
        
        bindHoldButton(
            brushBtn,
            () => { this.brushPressed = true; },
            () => { this.brushPressed = false; }
        );
        
        bindTapButton(
            dashBtn,
            () => { this.dashPressed = true; }
        );
        
        if (ultimateBtn) {
            bindTapButton(
                ultimateBtn,
                () => {
                    if (!ultimateBtn.disabled) {
                        this.ultimatePressed = true;
                    }
                }
            );
        }
        
        bindTapButton(
            comboBtn,
            () => { this.comboPressed = true; }
        );
        
        bindTapButton(
            pauseBtn,
            () => { this.pausePressed = true; }
        );
    }
    
    handleTouchStart(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            // Aim touch: prefer right side touches so it doesn't conflict with left joystick UI.
            if (this.aimTouchId === null && touch.clientX >= window.innerWidth / 2) {
                this.aimTouchId = touch.identifier;
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;
            }
        }
    }
    
    handleTouchMove(e) {
        e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === this.aimTouchId) {
                this.mouseX = touch.clientX;
                this.mouseY = touch.clientY;
            }
        }
    }
    
    handleTouchEnd(e) {
        if (e?.preventDefault) e.preventDefault();
        for (const touch of e.changedTouches) {
            if (touch.identifier === this.aimTouchId) {
                this.aimTouchId = null;
            }
        }
    }
    
    isAiming() {
        return this.aimTouchId !== null;
    }
    
    // Check if key is currently held
    isKeyDown(code) {
        return !!this.keys[code];
    }
    
    // Check if key was just pressed this frame
    isKeyPressed(code) {
        return !!this.keysPressed[code];
    }
    
    // Check if key was just released this frame
    isKeyReleased(code) {
        return !!this.keysReleased[code];
    }
    
    // Check if mouse button is held
    isMouseDown(button = 0) {
        return !!this.mouseButtons[button];
    }
    
    // Check if mouse button was just pressed
    isMousePressed(button = 0) {
        return !!this.mouseButtonsPressed[button];
    }
    
    // Get movement direction from keyboard
    getMovementDir() {
        let x = 0;
        let y = 0;
        
        if (this.isKeyDown('KeyW') || this.isKeyDown('ArrowUp')) y -= 1;
        if (this.isKeyDown('KeyS') || this.isKeyDown('ArrowDown')) y += 1;
        if (this.isKeyDown('KeyA') || this.isKeyDown('ArrowLeft')) x -= 1;
        if (this.isKeyDown('KeyD') || this.isKeyDown('ArrowRight')) x += 1;
        
        // Add joystick input for mobile
        if (this.touchMode) {
            x += this.joystickDir.x;
            y += this.joystickDir.y;
        }
        
        // Normalize diagonal movement
        const len = Math.sqrt(x * x + y * y);
        if (len > 1) {
            x /= len;
            y /= len;
        }
        
        return { x, y };
    }
    
    // Check if fire button is pressed
    wantsFire() {
        return this.isMouseDown(0) || this.isKeyDown('KeyJ') || this.firePressed;
    }
    
    // Check if brush button is pressed
    wantsBrush() {
        return this.isMouseDown(2) || this.isKeyDown('KeyK') || this.isKeyDown('ControlLeft') || this.brushPressed;
    }
    
    // Check if dash button is pressed (Shift or Space or mobile)
    wantsDash() {
        const mobileDash = this.dashPressed;
        if (mobileDash) this.dashPressed = false; // One-shot for mobile
        return this.isKeyPressed('ShiftLeft') || this.isKeyPressed('ShiftRight') || this.isKeyPressed('Space') || mobileDash;
    }
    
    // Check if ultimate button is pressed (Q or mobile)
    wantsUltimate() {
        const mobileUlt = this.ultimatePressed;
        if (mobileUlt) this.ultimatePressed = false; // One-shot
        return this.isKeyPressed('KeyQ') || mobileUlt;
    }
    
    // Check if combo burst button is pressed (E or mobile)
    wantsComboBurst() {
        const mobileCombo = this.comboPressed;
        if (mobileCombo) this.comboPressed = false; // One-shot
        return this.isKeyPressed('KeyE') || mobileCombo;
    }
    
    // Check if pause button is pressed (P or mobile)
    wantsPause() {
        const mobilePause = this.pausePressed;
        if (mobilePause) this.pausePressed = false; // One-shot
        const keyPause = this.keysPressed['KeyP'] || false;
        return keyPause || mobilePause;
    }
    
    // Check weapon switch (1, 2 keys or Tab or scroll wheel)
    wantsWeaponSwitch() {
        if (this.isKeyPressed('Digit1')) return 0;
        if (this.isKeyPressed('Digit2')) return 1;
        if (this.isKeyPressed('Tab')) return 'next';
        return null;
    }
    
    // Clear per-frame state
    update() {
        this.keysPressed = {};
        this.keysReleased = {};
        this.mouseButtonsPressed = {};
        this.mouseButtonsReleased = {};
    }
}
