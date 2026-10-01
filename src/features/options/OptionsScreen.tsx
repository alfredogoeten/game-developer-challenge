import { useEffect, useRef, useState } from "react";
import {
  GAME_OPTION_RULES,
  validateGameOptions,
  type GameOptionField,
  type GameOptions,
} from "./gameOptions";
import { saveGameOptions } from "./gameOptionsStorage";

type OptionsScreenProps = {
  initialOptions: GameOptions;
  onReturnToMenu: () => void;
  onSave: (options: GameOptions) => void;
};

export function OptionsScreen({
  initialOptions,
  onReturnToMenu,
  onSave,
}: OptionsScreenProps) {
  const [draft, setDraft] = useState<GameOptions>(initialOptions);
  const [saveError, setSaveError] = useState("");
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false);
  const titleRef = useRef<HTMLHeadingElement>(null);
  const backButtonRef = useRef<HTMLButtonElement>(null);
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null);
  const discardButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    titleRef.current?.focus();
  }, []);

  useEffect(() => {
    if (isDiscardDialogOpen) {
      keepEditingButtonRef.current?.focus();
    }
  }, [isDiscardDialogOpen]);

  const hasUnsavedChanges =
    draft.sessionDurationSeconds !== initialOptions.sessionDurationSeconds ||
    draft.enemySpawnIntervalSeconds !==
      initialOptions.enemySpawnIntervalSeconds;

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (
        event.key !== "Escape" ||
        event.defaultPrevented ||
        event.repeat ||
        isDiscardDialogOpen
      ) {
        return;
      }

      event.preventDefault();
      if (hasUnsavedChanges) {
        setIsDiscardDialogOpen(true);
      } else {
        onReturnToMenu();
      }
    }

    window.addEventListener("keydown", handleEscape);
    return () => window.removeEventListener("keydown", handleEscape);
  }, [hasUnsavedChanges, isDiscardDialogOpen, onReturnToMenu]);

  function updateDraft(field: GameOptionField, value: number) {
    setDraft((current) => ({ ...current, [field]: value }));
    setSaveError("");
  }

  function adjustOption(field: GameOptionField, direction: -1 | 1) {
    const rule = GAME_OPTION_RULES[field];
    const currentIndex = rule.values.indexOf(draft[field]);
    const defaultIndex = rule.values.indexOf(rule.defaultValue);
    const startIndex = currentIndex === -1 ? defaultIndex : currentIndex;
    const nextIndex = Math.min(
      rule.values.length - 1,
      Math.max(0, startIndex + direction),
    );

    updateDraft(field, rule.values[nextIndex]);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const validationErrors = validateGameOptions(draft);

    if (Object.keys(validationErrors).length > 0) {
      setSaveError(
        "The selected options are invalid. Please choose an available value.",
      );
      return;
    }

    if (!saveGameOptions(draft)) {
      setSaveError("Your options could not be saved. Please try again.");
      return;
    }

    onSave(draft);
  }

  function requestReturnToMenu() {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true);
      return;
    }

    onReturnToMenu();
  }

  function keepEditing() {
    setIsDiscardDialogOpen(false);
    window.requestAnimationFrame(() => backButtonRef.current?.focus());
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === "Escape") {
      event.preventDefault();
      keepEditing();
      return;
    }

    if (event.key !== "Tab") {
      return;
    }

    const firstButton = keepEditingButtonRef.current;
    const lastButton = discardButtonRef.current;

    if (!firstButton || !lastButton) {
      return;
    }

    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault();
      lastButton.focus();
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault();
      firstButton.focus();
    }
  }

  return (
    <section
      className="menu-panel options-panel"
      aria-labelledby="options-title"
    >
      <button
        aria-label="Back to main menu"
        aria-keyshortcuts="Escape"
        className="back-button"
        onClick={requestReturnToMenu}
        ref={backButtonRef}
        title="Back to main menu (Esc)"
        type="button"
      >
        <span aria-hidden="true" className="back-button__arrow" />
      </button>
      <h1 id="options-title" ref={titleRef} tabIndex={-1}>
        Options
      </h1>
      <p className="options-intro">
        Choose the settings for your next game session.
      </p>

      <form noValidate onSubmit={handleSubmit}>
        <OptionField
          field="sessionDurationSeconds"
          label="Game session time"
          onAdjust={adjustOption}
          value={draft.sessionDurationSeconds}
        />
        <OptionField
          field="enemySpawnIntervalSeconds"
          label="Enemy spawn time"
          onAdjust={adjustOption}
          value={draft.enemySpawnIntervalSeconds}
        />

        {saveError ? (
          <p className="form-message form-message--error" role="alert">
            {saveError}
          </p>
        ) : null}

        <div className="form-actions form-actions--single">
          <button className="asset-button asset-button--primary" type="submit">
            Save
          </button>
        </div>
      </form>

      {isDiscardDialogOpen ? (
        <div className="confirmation-backdrop">
          <section
            aria-labelledby="discard-dialog-title"
            aria-modal="true"
            className="confirmation-dialog"
            onKeyDown={handleDialogKeyDown}
            role="dialog"
          >
            <h2 id="discard-dialog-title">Discard changes?</h2>
            <p>Your unsaved options will be lost.</p>
            <div className="dialog-actions">
              <button
                className="asset-button asset-button--secondary"
                onClick={keepEditing}
                ref={keepEditingButtonRef}
                type="button"
              >
                Cancel
              </button>
              <button
                className="asset-button asset-button--primary"
                onClick={onReturnToMenu}
                ref={discardButtonRef}
                type="button"
              >
                Discard changes
              </button>
            </div>
          </section>
        </div>
      ) : null}
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
        <button
          aria-label={`Decrease ${label}`}
          className="round-button round-button--minus"
          disabled={currentIndex <= 0}
          onClick={() => onAdjust(field, -1)}
          type="button"
        />
        <output
          aria-label={`${label}: ${value} seconds`}
          className="option-value"
          data-testid={`${field}-value`}
        >
          {value} <span aria-hidden="true">s</span>
        </output>
        <button
          aria-label={`Increase ${label}`}
          className="round-button round-button--plus"
          disabled={currentIndex >= rule.values.length - 1}
          onClick={() => onAdjust(field, 1)}
          type="button"
        />
      </div>
    </fieldset>
  );
}
