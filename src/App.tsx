import { useEffect, useRef, useState, type RefObject } from 'react'
import {
  GAME_OPTION_RULES,
  validateGameOptions,
  type GameOptionField,
  type GameOptions,
} from './config/gameOptions'
import { loadGameOptions, saveGameOptions } from './lib/gameOptionsStorage'

type Screen = 'menu' | 'options'

const CONTROL_HINTS = [
  ['Move forward', 'W or ↑'],
  ['Turn', 'A / D or ← / →'],
  ['Front cannon', 'Space'],
  ['Broadside cannons', 'Q / E'],
  ['Pause', 'Esc'],
]

function App() {
  const [screen, setScreen] = useState<Screen>('menu')
  const [gameOptions, setGameOptions] = useState<GameOptions>(loadGameOptions)
  const [statusMessage, setStatusMessage] = useState('')
  const optionsButtonRef = useRef<HTMLButtonElement>(null)

  function openOptions() {
    setStatusMessage('')
    setScreen('options')
  }

  function returnToMenu(message = '') {
    setStatusMessage(message)
    setScreen('menu')
    window.requestAnimationFrame(() => optionsButtonRef.current?.focus())
  }

  function handleSave(options: GameOptions) {
    setGameOptions(options)
    returnToMenu('Options saved.')
  }

  return (
    <main className="app-shell">
      {screen === 'menu' ? (
        <MainMenu
          onOpenOptions={openOptions}
          optionsButtonRef={optionsButtonRef}
          statusMessage={statusMessage}
        />
      ) : (
        <OptionsScreen
          initialOptions={gameOptions}
          onReturnToMenu={() => returnToMenu()}
          onSave={handleSave}
        />
      )}
    </main>
  )
}

type MainMenuProps = {
  onOpenOptions: () => void
  optionsButtonRef: RefObject<HTMLButtonElement | null>
  statusMessage: string
}

function MainMenu({ onOpenOptions, optionsButtonRef, statusMessage }: MainMenuProps) {
  return (
    <section className="menu-panel" aria-labelledby="menu-title">
      <h1 className="sr-only" id="menu-title">Pirate Battle</h1>
      <div className="game-title" aria-hidden="true" />

      <div className="menu-actions" aria-label="Main menu actions">
        <button className="asset-button asset-button--primary" disabled title="Combat is coming in the next milestone." type="button">
          Play
        </button>
        <p className="feature-note">Combat is coming in the next milestone.</p>
        <button className="asset-button asset-button--primary" onClick={onOpenOptions} ref={optionsButtonRef} type="button">
          Options
        </button>
      </div>

      <section className="controls-guide" aria-labelledby="controls-title">
        <h2 id="controls-title">Controls</h2>
        <dl>
          {CONTROL_HINTS.map(([action, key]) => (
            <div key={action}>
              <dt>{action}</dt>
              <dd>{key}</dd>
            </div>
          ))}
        </dl>
      </section>

      <div className="menu-footer-actions" aria-label="Unavailable menu sections">
        <button className="asset-button asset-button--secondary" disabled type="button">
          Ranking
        </button>
        <button className="asset-button asset-button--secondary" disabled type="button">
          Match History
        </button>
      </div>

      <p aria-live="polite" className="screen-reader-status" role="status">
        {statusMessage}
      </p>
    </section>
  )
}

type OptionsScreenProps = {
  initialOptions: GameOptions
  onReturnToMenu: () => void
  onSave: (options: GameOptions) => void
}

function OptionsScreen({ initialOptions, onReturnToMenu, onSave }: OptionsScreenProps) {
  const [draft, setDraft] = useState<GameOptions>(initialOptions)
  const [saveError, setSaveError] = useState('')
  const [isDiscardDialogOpen, setIsDiscardDialogOpen] = useState(false)
  const titleRef = useRef<HTMLHeadingElement>(null)
  const backButtonRef = useRef<HTMLButtonElement>(null)
  const keepEditingButtonRef = useRef<HTMLButtonElement>(null)
  const discardButtonRef = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    titleRef.current?.focus()
  }, [])

  useEffect(() => {
    if (isDiscardDialogOpen) {
      keepEditingButtonRef.current?.focus()
    }
  }, [isDiscardDialogOpen])

  const hasUnsavedChanges = draft.sessionDurationSeconds !== initialOptions.sessionDurationSeconds
    || draft.enemySpawnIntervalSeconds !== initialOptions.enemySpawnIntervalSeconds

  useEffect(() => {
    function handleEscape(event: KeyboardEvent) {
      if (event.key !== 'Escape' || event.defaultPrevented || event.repeat || isDiscardDialogOpen) {
        return
      }

      event.preventDefault()
      if (hasUnsavedChanges) {
        setIsDiscardDialogOpen(true)
      } else {
        onReturnToMenu()
      }
    }

    window.addEventListener('keydown', handleEscape)
    return () => window.removeEventListener('keydown', handleEscape)
  }, [hasUnsavedChanges, isDiscardDialogOpen, onReturnToMenu])

  function updateDraft(field: GameOptionField, value: number) {
    setDraft((current) => ({ ...current, [field]: value }))
    setSaveError('')
  }

  function adjustOption(field: GameOptionField, direction: -1 | 1) {
    const rule = GAME_OPTION_RULES[field]
    const currentIndex = rule.values.indexOf(draft[field])
    const defaultIndex = rule.values.indexOf(rule.defaultValue)
    const startIndex = currentIndex === -1 ? defaultIndex : currentIndex
    const nextIndex = Math.min(rule.values.length - 1, Math.max(0, startIndex + direction))

    updateDraft(field, rule.values[nextIndex])
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()

    const validationErrors = validateGameOptions(draft)

    if (Object.keys(validationErrors).length > 0) {
      setSaveError('The selected options are invalid. Please choose an available value.')
      return
    }

    if (!saveGameOptions(draft)) {
      setSaveError('Your options could not be saved. Please try again.')
      return
    }

    onSave(draft)
  }

  function requestReturnToMenu() {
    if (hasUnsavedChanges) {
      setIsDiscardDialogOpen(true)
      return
    }

    onReturnToMenu()
  }

  function keepEditing() {
    setIsDiscardDialogOpen(false)
    window.requestAnimationFrame(() => backButtonRef.current?.focus())
  }

  function handleDialogKeyDown(event: React.KeyboardEvent<HTMLElement>) {
    if (event.key === 'Escape') {
      event.preventDefault()
      keepEditing()
      return
    }

    if (event.key !== 'Tab') {
      return
    }

    const firstButton = keepEditingButtonRef.current
    const lastButton = discardButtonRef.current

    if (!firstButton || !lastButton) {
      return
    }

    if (event.shiftKey && document.activeElement === firstButton) {
      event.preventDefault()
      lastButton.focus()
    } else if (!event.shiftKey && document.activeElement === lastButton) {
      event.preventDefault()
      firstButton.focus()
    }
  }

  return (
    <section className="menu-panel options-panel" aria-labelledby="options-title">
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
      <h1 id="options-title" ref={titleRef} tabIndex={-1}>Options</h1>
      <p className="options-intro">Choose the settings for your next game session.</p>

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

        {saveError ? <p className="form-message form-message--error" role="alert">{saveError}</p> : null}

        <div className="form-actions form-actions--single">
          <button className="asset-button asset-button--primary" type="submit">Save</button>
        </div>
      </form>

      {isDiscardDialogOpen ? (
        <div className="confirmation-backdrop">
          <section aria-labelledby="discard-dialog-title" aria-modal="true" className="confirmation-dialog" onKeyDown={handleDialogKeyDown} role="dialog">
            <h2 id="discard-dialog-title">Discard changes?</h2>
            <p>Your unsaved options will be lost.</p>
            <div className="dialog-actions">
              <button className="asset-button asset-button--secondary" onClick={keepEditing} ref={keepEditingButtonRef} type="button">
                Cancel
              </button>
              <button className="asset-button asset-button--primary" onClick={onReturnToMenu} ref={discardButtonRef} type="button">
                Discard changes
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </section>
  )
}

type OptionFieldProps = {
  field: GameOptionField
  label: string
  onAdjust: (field: GameOptionField, direction: -1 | 1) => void
  value: number
}

function OptionField({ field, label, onAdjust, value }: OptionFieldProps) {
  const rule = GAME_OPTION_RULES[field]
  const currentIndex = rule.values.indexOf(value)

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
        <output aria-label={`${label}: ${value} seconds`} className="option-value" data-testid={`${field}-value`}>
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
  )
}

export default App
