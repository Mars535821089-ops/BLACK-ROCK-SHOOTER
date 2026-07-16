import { PET_SPEC, STATE_NAMES, STATES, type StateName } from "../src/pet-spec.js";

const FRAME_INTERVAL_MS = 160;
const DEFAULT_STATE: StateName = "idle";

const pet = document.querySelector<HTMLDivElement>("#pet")!;
const state = document.querySelector<HTMLSelectElement>("#state")!;
const size = document.querySelector<HTMLInputElement>("#size")!;
const sizeValue = document.querySelector<HTMLSpanElement>("[data-testid='size-value']")!;
const stateCount = document.querySelector<HTMLSpanElement>("#state-count")!;
const frameReadout = document.querySelector<HTMLElement>("#frame-readout")!;
const weaponReadout = document.querySelector<HTMLElement>("#weapon-readout")!;

for (const name of STATE_NAMES) {
  state.add(new Option(name.replaceAll("-", " "), name));
}

let timer = 0;

function framePosition(column: number, row: number) {
  const x = (column / (PET_SPEC.columns - 1)) * 100;
  const y = (row / (PET_SPEC.rows - 1)) * 100;
  return `${x}% ${y}%`;
}

function play(name: StateName) {
  window.clearInterval(timer);
  const spec = STATES[name];
  const stateIndex = STATE_NAMES.indexOf(name);
  let frame = 0;

  pet.dataset.state = name;
  pet.dataset.weapon = String(spec.weapon);
  pet.setAttribute("aria-label", `BLACK ROCK SHOOTER ${name.replaceAll("-", " ")} animation`);
  stateCount.textContent = `${String(stateIndex + 1).padStart(2, "0")} / ${String(STATE_NAMES.length).padStart(2, "0")}`;
  weaponReadout.textContent = spec.weapon ? "Visible" : "Hidden";

  const paint = () => {
    pet.dataset.frame = String(frame);
    pet.style.backgroundPosition = framePosition(frame, spec.row);
    frameReadout.textContent = `${String(frame + 1).padStart(2, "0")} / ${String(spec.frames).padStart(2, "0")}`;
    frame = (frame + 1) % spec.frames;
  };

  paint();
  if (!window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
    timer = window.setInterval(paint, FRAME_INTERVAL_MS);
  }
}

function setSize(value: string) {
  document.documentElement.style.setProperty("--pet-size", `${value}px`);
  sizeValue.textContent = `${value} px`;
}

state.addEventListener("change", () => play(state.value as StateName));
size.addEventListener("input", () => setSize(size.value));

state.value = DEFAULT_STATE;
setSize(size.value);
play(DEFAULT_STATE);
