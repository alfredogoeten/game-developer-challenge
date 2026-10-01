import { DEFAULT_GAME_OPTIONS, isGameOptions, type GameOptions } from '../config/gameOptions'

export const GAME_OPTIONS_STORAGE_KEY = 'pirate-battle.options.v1'

export function loadGameOptions(): GameOptions {
  try {
    const storedValue = window.localStorage.getItem(GAME_OPTIONS_STORAGE_KEY)

    if (!storedValue) {
      return DEFAULT_GAME_OPTIONS
    }

    const parsedValue: unknown = JSON.parse(storedValue)
    return isGameOptions(parsedValue) ? parsedValue : DEFAULT_GAME_OPTIONS
  } catch {
    return DEFAULT_GAME_OPTIONS
  }
}

export function saveGameOptions(options: GameOptions): boolean {
  try {
    window.localStorage.setItem(GAME_OPTIONS_STORAGE_KEY, JSON.stringify(options))
    return true
  } catch {
    return false
  }
}
