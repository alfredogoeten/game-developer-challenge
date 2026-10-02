import { useEffect, useRef, useState } from "react";
import { GAME_OPTION_RULES, type GameOptionField, type GameOptions } from "./gameOptions";
import { saveGameOptions } from "./gameOptionsStorage";

type OptionsScreenProps = {
  initialOptions: GameOptions;
  onReturnToMenu: () => void;
  onChange: (options: GameOptions) => void;
};

export function OptionsScreen({ initialOptions, onReturnToMenu, onChange }: OptionsScreenProps) {
  const [options, setOptions] = useState<GameOptions>(initialOptions);
  const [saveError, setSaveError] = useState("");
  const titleRef = useRef<HTMLHeadingElement>(null);

  useEffect(() => { titleRef.current?.focus(); }, []);
  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== "Escape" || event.defaultPrevented || event.repeat) return;
      event.preventDefault();
      onReturnToMenu();
    }
    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [onReturnToMenu]);

  function adjustOption(field: GameOptionField, direction: -1 | 1) {
    const rule = GAME_OPTION_RULES[field];
    const currentIndex = rule.values.indexOf(options[field]);
    const nextIndex = Math.min(rule.values.length - 1, Math.max(0, currentIndex + direction));
    if (nextIndex === currentIndex) return;
    const nextOptions = { ...options, [field]: rule.values[nextIndex] };
    if (!saveGameOptions(nextOptions)) {
      setSaveError("Your options could not be saved. Please try again.");
      return;
    }
    setSaveError("");
    setOptions(nextOptions);
    onChange(nextOptions);
  }

  return (
    <section className="menu-panel options-panel" aria-labelledby="options-title">
      <h1 id="options-title" ref={titleRef} tabIndex={-1}>Options</h1>
      <p className="options-intro">Choose the settings for your next game session.</p>
      <div className="options-fields">
        <OptionField field="sessionDurationSeconds" label="Game session time" onAdjust={adjustOption} value={options.sessionDurationSeconds} />
        <OptionField field="enemySpawnIntervalSeconds" label="Enemy spawn time" onAdjust={adjustOption} value={options.enemySpawnIntervalSeconds} />
      </div>
      {saveError ? <p className="form-message form-message--error" role="alert">{saveError}</p> : null}
      <div className="form-actions form-actions--single">
        <button aria-keyshortcuts="Escape" className="asset-button asset-button--primary" onClick={onReturnToMenu} type="button">MAIN MENU</button>
      </div>
    </section>
  );
}

type OptionFieldProps = {
  field: GameOptionField;
  label: string;
  onAdjust: (field: GameOptionField, direction: -1 | 1) => void;
  value: number;
};

function OptionField({ field, label, onAdjust, value }: OptionFieldProps) {
  const rule = GAME_OPTION_RULES[field];
  const currentIndex = rule.values.indexOf(value);
  return (
    <fieldset className="option-field">
      <legend>{label}</legend>
      <div className="option-control">
        <button aria-label={`Decrease ${label}`} className="round-button round-button--minus" disabled={currentIndex <= 0} onClick={() => onAdjust(field, -1)} type="button"><span aria-hidden="true" className="round-button__icon" /></button>
        <output aria-label={`${label}: ${value} seconds`} className="option-value" data-testid={`${field}-value`}>{value} <span aria-hidden="true">s</span></output>
        <button aria-label={`Increase ${label}`} className="round-button round-button--plus" disabled={currentIndex >= rule.values.length - 1} onClick={() => onAdjust(field, 1)} type="button"><span aria-hidden="true" className="round-button__icon" /></button>
      </div>
    </fieldset>
  );
}
