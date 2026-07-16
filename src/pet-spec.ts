export const PET_SPEC = {
  version: 2,
  columns: 8,
  rows: 11,
  cellWidth: 192,
  cellHeight: 208,
  sheetWidth: 1536,
  sheetHeight: 2288,
} as const;

export const STATES = {
  idle: { row: 0, frames: 6, weapon: false },
  "running-right": { row: 1, frames: 8, weapon: true },
  "running-left": { row: 2, frames: 8, weapon: true },
  waving: { row: 3, frames: 4, weapon: true },
  jumping: { row: 4, frames: 5, weapon: false },
  failed: { row: 5, frames: 8, weapon: true },
  waiting: { row: 6, frames: 6, weapon: false },
  running: { row: 7, frames: 6, weapon: true },
  review: { row: 8, frames: 6, weapon: false },
} as const;

export type StateName = keyof typeof STATES;
export const STATE_NAMES = Object.keys(STATES) as StateName[];

export function cellFor(state: StateName, column: number) {
  if (!Number.isInteger(column) || column < 0 || column >= PET_SPEC.columns) {
    throw new RangeError(`column must be 0-${PET_SPEC.columns - 1}`);
  }
  return {
    left: column * PET_SPEC.cellWidth,
    top: STATES[state].row * PET_SPEC.cellHeight,
  };
}

export function weaponVisibleFor(state: StateName) {
  return STATES[state].weapon;
}
