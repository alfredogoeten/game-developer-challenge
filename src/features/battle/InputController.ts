import type { Action } from "./model";

const bindings: Record<string, Action> = {
  KeyW: "forward", 
  KeyA: "turnLeft", 
  KeyD: "turnRight",
  Space: "front",
  KeyQ: "port",
  KeyE: "starboard",
};

export class InputController {
  private readonly keys = new Map<string, Action>();
  private readonly pointers = new Map<number, Action>();
  private readonly actions = new Set<Action>();
  private readonly isActive: () => boolean;
  private readonly onPause: () => void;
  private readonly onBlur: () => void;

  constructor(
    isActive: () => boolean,
    onPause: () => void,
    onBlur: () => void,
  ) {
    this.isActive = isActive;
    this.onPause = onPause;
    this.onBlur = onBlur;
    window.addEventListener("keydown", this.keyDown);
    window.addEventListener("keyup", this.keyUp);
    window.addEventListener("blur", this.blur);
    document.addEventListener("visibilitychange", this.visibilityChange);
  }

  readonly getActions = (): ReadonlySet<Action> => this.actions;

  pressPointer(id: number, action: Action) {
    if (!this.isActive()) return;
    this.pointers.set(id, action);
    this.updateActions();
  }

  releasePointer(id: number) {
    this.pointers.delete(id);
    this.updateActions();
  }

  clear() {
    this.keys.clear();
    this.pointers.clear();
    this.actions.clear();
  }

  destroy() {
    this.clear();
    window.removeEventListener("keydown", this.keyDown);
    window.removeEventListener("keyup", this.keyUp);
    window.removeEventListener("blur", this.blur);
    document.removeEventListener("visibilitychange", this.visibilityChange);
  }

  private readonly keyDown = (event: KeyboardEvent) => {
    if (event.code === "Escape" && !event.repeat) {
      event.preventDefault();
      this.onPause();
      return;
    }
    const action = bindings[event.code];
    if (!action || !this.isActive()) return;
    event.preventDefault();
    this.keys.set(event.code, action);
    this.updateActions();
  };

  private readonly keyUp = (event: KeyboardEvent) => {
    if (!bindings[event.code]) return;
    if (this.isActive()) event.preventDefault();
    this.keys.delete(event.code);
    this.updateActions();
  };

  private readonly blur = () => {
    if (this.isActive()) this.onBlur();
    this.clear();
  };

  private readonly visibilityChange = () => {
    if (document.hidden) this.blur();
  };

  private updateActions() {
    this.actions.clear();
    for (const action of this.keys.values()) this.actions.add(action);
    for (const action of this.pointers.values()) this.actions.add(action);
  }
}
