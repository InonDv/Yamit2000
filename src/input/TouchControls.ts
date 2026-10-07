import type { InputController } from './InputController';

export class TouchControls {
  private readonly cleanups: Array<() => void> = [];
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;
  private joystickPointerId: number | null = null;
  private resetJoystick: (() => void) | null = null;

  constructor(
    root: HTMLElement,
    private readonly input: InputController,
  ) {
    const touchCapable =
      navigator.maxTouchPoints > 0 || window.matchMedia('(pointer: coarse)').matches;
    root.hidden = !touchCapable;
    if (!touchCapable) return;

    root.querySelectorAll<HTMLButtonElement>('[data-touch-key]').forEach((button) => {
      const code = button.dataset.touchKey;
      if (!code) return;
      const press = (event: PointerEvent): void => {
        event.preventDefault();
        button.setPointerCapture(event.pointerId);
        button.classList.add('is-pressed');
        this.input.setVirtualKey(code, true);
      };
      const release = (event: PointerEvent): void => {
        event.preventDefault();
        button.classList.remove('is-pressed');
        this.input.setVirtualKey(code, false);
      };
      button.addEventListener('pointerdown', press);
      button.addEventListener('pointerup', release);
      button.addEventListener('pointercancel', release);
      button.addEventListener('lostpointercapture', release);
      this.cleanups.push(() => {
        button.removeEventListener('pointerdown', press);
        button.removeEventListener('pointerup', release);
        button.removeEventListener('pointercancel', release);
        button.removeEventListener('lostpointercapture', release);
      });
    });

    const lookZone = root.querySelector<HTMLElement>('#touch-look-zone');
    if (lookZone) this.bindLookZone(lookZone);
    const joystick = root.querySelector<HTMLElement>('#touch-joystick');
    const joystickKnob = root.querySelector<HTMLElement>('#touch-joystick-knob');
    if (joystick && joystickKnob) this.bindJoystick(joystick, joystickKnob);

    const reset = (): void => {
      root.querySelectorAll<HTMLButtonElement>('[data-touch-key]').forEach((button) => {
        const code = button.dataset.touchKey;
        if (code) this.input.setVirtualKey(code, false);
        button.classList.remove('is-pressed');
      });
      this.lookPointerId = null;
      lookZone?.classList.remove('is-looking');
      this.resetJoystick?.();
    };
    const resetWhenHidden = (): void => {
      if (document.hidden) reset();
    };
    const preventContextMenu = (event: Event): void => event.preventDefault();
    const preventBrowserGesture = (event: Event): void => event.preventDefault();
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', resetWhenHidden);
    document.addEventListener('touchmove', preventBrowserGesture, { passive: false });
    document.addEventListener('gesturestart', preventBrowserGesture, { passive: false });
    document.addEventListener('dblclick', preventBrowserGesture, { passive: false });
    root.addEventListener('contextmenu', preventContextMenu);
    this.cleanups.push(() => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      document.removeEventListener('visibilitychange', resetWhenHidden);
      document.removeEventListener('touchmove', preventBrowserGesture);
      document.removeEventListener('gesturestart', preventBrowserGesture);
      document.removeEventListener('dblclick', preventBrowserGesture);
      root.removeEventListener('contextmenu', preventContextMenu);
      reset();
    });
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup();
  }

  private bindJoystick(zone: HTMLElement, knob: HTMLElement): void {
    const releaseKeys = (): void => {
      for (const code of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) {
        this.input.setVirtualKey(code, false);
      }
    };
    const reset = (): void => {
      this.joystickPointerId = null;
      knob.style.transform = 'translate(0px, 0px)';
      zone.classList.remove('is-active');
      releaseKeys();
    };
    const update = (event: PointerEvent): void => {
      const bounds = zone.getBoundingClientRect();
      const radius = bounds.width * 0.31;
      let x = event.clientX - (bounds.left + bounds.width / 2);
      let y = event.clientY - (bounds.top + bounds.height / 2);
      const distance = Math.hypot(x, y);
      if (distance > radius) {
        const scale = radius / distance;
        x *= scale;
        y *= scale;
      }
      knob.style.transform = `translate(${x}px, ${y}px)`;
      const threshold = radius * 0.28;
      this.input.setVirtualKey('KeyW', y < -threshold);
      this.input.setVirtualKey('KeyS', y > threshold);
      this.input.setVirtualKey('KeyA', x < -threshold);
      this.input.setVirtualKey('KeyD', x > threshold);
    };
    const start = (event: PointerEvent): void => {
      if (this.joystickPointerId !== null) return;
      event.preventDefault();
      this.joystickPointerId = event.pointerId;
      zone.setPointerCapture(event.pointerId);
      zone.classList.add('is-active');
      update(event);
    };
    const move = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointerId) return;
      event.preventDefault();
      update(event);
    };
    const finish = (event: PointerEvent): void => {
      if (event.pointerId !== this.joystickPointerId) return;
      event.preventDefault();
      reset();
    };
    this.resetJoystick = reset;
    zone.addEventListener('pointerdown', start);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', finish);
    zone.addEventListener('pointercancel', finish);
    zone.addEventListener('lostpointercapture', finish);
    this.cleanups.push(() => {
      zone.removeEventListener('pointerdown', start);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', finish);
      zone.removeEventListener('pointercancel', finish);
      zone.removeEventListener('lostpointercapture', finish);
      reset();
      if (this.resetJoystick === reset) this.resetJoystick = null;
    });
  }

  private bindLookZone(zone: HTMLElement): void {
    const start = (event: PointerEvent): void => {
      if (this.lookPointerId !== null) return;
      event.preventDefault();
      this.lookPointerId = event.pointerId;
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
      zone.setPointerCapture(event.pointerId);
      zone.classList.add('is-looking');
    };
    const move = (event: PointerEvent): void => {
      if (event.pointerId !== this.lookPointerId) return;
      event.preventDefault();
      this.input.addLookDelta(
        event.clientX - this.lastLookX,
        event.clientY - this.lastLookY,
      );
      this.lastLookX = event.clientX;
      this.lastLookY = event.clientY;
    };
    const finish = (event: PointerEvent): void => {
      if (event.pointerId !== this.lookPointerId) return;
      event.preventDefault();
      this.lookPointerId = null;
      zone.classList.remove('is-looking');
    };
    zone.addEventListener('pointerdown', start);
    zone.addEventListener('pointermove', move);
    zone.addEventListener('pointerup', finish);
    zone.addEventListener('pointercancel', finish);
    zone.addEventListener('lostpointercapture', finish);
    this.cleanups.push(() => {
      zone.removeEventListener('pointerdown', start);
      zone.removeEventListener('pointermove', move);
      zone.removeEventListener('pointerup', finish);
      zone.removeEventListener('pointercancel', finish);
      zone.removeEventListener('lostpointercapture', finish);
    });
  }
}
