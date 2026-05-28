import { defineStore } from "pinia";
import { participantKey } from "../utils/csv.js";

function readJSON(key, fallback) {
  const raw = localStorage.getItem(key);
  if (raw == null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

export const useParticipantStore = defineStore("participantStore", {
  state: () => ({
    candidates: [],
    winners: [],
    index: -1,
    selected: null,
    spinning: false,
    useMultiDisplayMode: false,
  }),
  getters: {
    currentCandidate(state) {
      if (state.index > -1 && state.index < state.candidates.length) {
        return state.candidates[state.index];
      }
      return null;
    },
    getParticipants(state) {
      return [...state.candidates, ...state.winners];
    },
    winnerSelected(state) {
      return state.spinning === false && state.selected !== null;
    },
  },
  actions: {
    loadFromStorage() {
      this.candidates = readJSON("candidates", []);
      this.winners = readJSON("winners", []);
      this.useMultiDisplayMode = readJSON("useMultiDisplayMode", false);
    },
    persistCandidates() {
      localStorage.setItem("candidates", JSON.stringify(this.candidates));
    },
    persistWinners() {
      localStorage.setItem("winners", JSON.stringify(this.winners));
    },
    setMultiDisplayMode(value) {
      this.useMultiDisplayMode = value;
      localStorage.setItem("useMultiDisplayMode", JSON.stringify(value));
    },
    // Replace the candidate pool, excluding anyone who has already won.
    importParticipants(list) {
      const winnerKeys = new Set(this.winners.map(participantKey));
      const filtered = [];
      let skipped = 0;
      for (const p of list) {
        if (winnerKeys.has(participantKey(p))) {
          skipped += 1;
          continue;
        }
        filtered.push(p);
      }
      this.candidates = filtered;
      this.index = -1;
      this.selected = null;
      this.persistCandidates();
      return { imported: filtered.length, skipped };
    },
    resetCandidates() {
      this.candidates = [];
      this.index = -1;
      this.selected = null;
      localStorage.removeItem("candidates");
    },
    resetWinners() {
      this.winners = [];
      localStorage.removeItem("winners");
    },
    pointToRandomCandidate() {
      this.index = this.candidates.length
        ? Math.floor(Math.random() * this.candidates.length)
        : -1;
    },
    // Move the currently pointed-at candidate into winners (as a copy) and
    // remove them from the pool so they can never be drawn again.
    commitSelection() {
      if (this.index < 0 || this.index >= this.candidates.length) return;
      const winner = { ...this.candidates[this.index] };
      this.winners.push(winner);
      this.candidates.splice(this.index, 1);
      this.selected = winner;
      this.index = -1;
      this.persistWinners();
      this.persistCandidates();
    },
    selectRandomCandidate() {
      if (this.spinning) return false;
      if (this.candidates.length === 0) return false;

      this.spinning = true;
      this.selected = null;

      const timeBeforeSlow = Math.floor(Math.random() * 300);
      let i = 0;
      let delay = 10;

      const tick = () => {
        this.pointToRandomCandidate();
        i += 1;
        if (i > timeBeforeSlow) {
          delay += 50;
        }
        if (delay < 500) {
          setTimeout(tick, delay);
        } else {
          this.spinning = false;
          this.commitSelection();
        }
      };

      setTimeout(tick, delay);
      return true;
    },
  },
});
