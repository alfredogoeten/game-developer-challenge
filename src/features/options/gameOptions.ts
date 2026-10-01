export type GameOptions = {
  sessionDurationSeconds: number;
  enemySpawnIntervalSeconds: number;
};

export type GameOptionField = keyof GameOptions;

type PresetOptionRule = {
  defaultValue: number;
  values: readonly number[];
};

export const GAME_OPTION_RULES: Record<GameOptionField, PresetOptionRule> = {
  sessionDurationSeconds: {
    defaultValue: 120,
    values: [60, 120, 180],
  },
  enemySpawnIntervalSeconds: {
    defaultValue: 3,
    values: [2, 3, 4, 5, 6, 7, 8, 9, 10],
  },
};

export const DEFAULT_GAME_OPTIONS: GameOptions = {
  sessionDurationSeconds: GAME_OPTION_RULES.sessionDurationSeconds.defaultValue,
  enemySpawnIntervalSeconds:
    GAME_OPTION_RULES.enemySpawnIntervalSeconds.defaultValue,
};

export type GameOptionErrors = Partial<Record<GameOptionField, string>>;

export function validateGameOptions(value: unknown): GameOptionErrors {
  if (!isRecord(value)) {
    return {
      sessionDurationSeconds: "Game session time is required.",
      enemySpawnIntervalSeconds: "Enemy spawn time is required.",
    };
  }

  return {
    ...validateOption("sessionDurationSeconds", value.sessionDurationSeconds),
    ...validateOption(
      "enemySpawnIntervalSeconds",
      value.enemySpawnIntervalSeconds,
    ),
  };
}

export function isGameOptions(value: unknown): value is GameOptions {
  return Object.keys(validateGameOptions(value)).length === 0;
}

function validateOption(
  field: GameOptionField,
  value: unknown,
): GameOptionErrors {
  const rule = GAME_OPTION_RULES[field];

  if (typeof value !== "number" || !Number.isInteger(value)) {
    return { [field]: "Choose one of the available values." };
  }

  if (!rule.values.includes(value)) {
    return { [field]: `Choose one of: ${rule.values.join(", ")} seconds.` };
  }

  return {};
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}
