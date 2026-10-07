export class InputController {
  private readonly held = new Set<string>();
  private readonly virtualHeld = new Set<string>();
  private readonly pressed = new Set<string>();
  private pointerDeltaX = 0;
  private pointerDeltaY = 0;

  constructor(private readonly element: HTMLElement) {
    window.addEventListener('keydown', this.onKeyDown);
    window.addEventListener('keyup', this.onKeyUp);
    window.addEventListener('blur', this.onBlur);
    element.addEventListener('pointerdown', this.onPointerDown);
    window.addEventListener('pointermove', this.onPointerMove);
  }

  isHeld(code: string): boolean {
    return this.held.has(code) || this.virtualHeld.has(code);
  }

  consumePressed(code: string): boolean {
    const wasPressed = this.pressed.has(code);
    this.pressed.delete(code);
    return wasPressed;
  }

  consumePointerDeltaX(): number {
    const delta = this.pointerDeltaX;
    this.pointerDeltaX = 0;
    return delta;
  }

  consumePointerDeltaY(): number {
    const delta = this.pointerDeltaY;
    this.pointerDeltaY = 0;
    return delta;
  }

  setVirtualKey(code: string, isHeld: boolean): void {
    if (isHeld) {
      if (!this.virtualHeld.has(code) && !this.held.has(code)) {
        this.pressed.add(code);
      }
      this.virtualHeld.add(code);
    } else {
      this.virtualHeld.delete(code);
    }
  }

  addLookDelta(x: number, y: number): void {
    this.pointerDeltaX += x;
    this.pointerDeltaY += y;
  }

  dispose(): void {
    window.removeEventListener('keydown', this.onKeyDown);
    window.removeEventListener('keyup', this.onKeyUp);
    window.removeEventListener('blur', this.onBlur);
    this.element.removeEventListener('pointerdown', this.onPointerDown);
    window.removeEventListener('pointermove', this.onPointerMove);
  }

  private readonly onKeyDown = (event: KeyboardEvent): void => {
    if (
      event.code.startsWith('Arrow') ||
      ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space'].includes(event.code)
    ) {
      event.preventDefault();
    }
    if (!this.held.has(event.code)) {
      this.pressed.add(event.code);
    }
    this.held.add(event.code);
  };

  private readonly onKeyUp = (event: KeyboardEvent): void => {
    this.held.delete(event.code);
  };

  private readonly onBlur = (): void => {
    this.held.clear();
    this.virtualHeld.clear();
    this.pressed.clear();
    this.pointerDeltaX = 0;
    this.pointerDeltaY = 0;
  };

  private readonly onPointerDown = (event: PointerEvent): void => {
    if (
      event.pointerType !== 'mouse' ||
      !window.matchMedia('(pointer: fine)').matches
    ) {
      return;
    }
    try {
      void Promise.resolve(this.element.requestPointerLock?.()).catch(() => {
        // Pointer lock is optional; keyboard camera controls remain available.
      });
    } catch {
      // Some browsers expose the API but reject it synchronously.
    }
  };

  private readonly onPointerMove = (event: PointerEvent): void => {
    if (document.pointerLockElement === this.element) {
      this.pointerDeltaX += event.movementX;
      this.pointerDeltaY += event.movementY;
    }
  };
}
