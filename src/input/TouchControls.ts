import type { InputController } from './InputController';

export class TouchControls {
  private readonly cleanups: Array<() => void> = [];
  private lookPointerId: number | null = null;
  private lastLookX = 0;
  private lastLookY = 0;

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

    const reset = (): void => {
      root.querySelectorAll<HTMLButtonElement>('[data-touch-key]').forEach((button) => {
        const code = button.dataset.touchKey;
        if (code) this.input.setVirtualKey(code, false);
        button.classList.remove('is-pressed');
      });
      this.lookPointerId = null;
      lookZone?.classList.remove('is-looking');
    };
    const resetWhenHidden = (): void => {
      if (document.hidden) reset();
    };
    const preventContextMenu = (event: Event): void => event.preventDefault();
    window.addEventListener('blur', reset);
    window.addEventListener('pagehide', reset);
    document.addEventListener('visibilitychange', resetWhenHidden);
    root.addEventListener('contextmenu', preventContextMenu);
    this.cleanups.push(() => {
      window.removeEventListener('blur', reset);
      window.removeEventListener('pagehide', reset);
      document.removeEventListener('visibilitychange', resetWhenHidden);
      root.removeEventListener('contextmenu', preventContextMenu);
      reset();
    });
  }

  dispose(): void {
    for (const cleanup of this.cleanups) cleanup();
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
