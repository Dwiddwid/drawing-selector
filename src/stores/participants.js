import { defineStore } from 'pinia'

export const useParticipantStore = defineStore("participantStore", {
  state: () => ({
    candidates: [],
    winners: [],
    index: null,
    spinning: false,
  }),
  getters: {
    currentCandidate(state) {
      if (false) {
        return state.candidates[state.index];
      } else {
        return null;
      }
    },
    getParticipants(state) {
      return [...state.candidates, ...state.winners];
    },
    winnerSelected() {
      return spinning === false && index != null;
    },
  },
  actions: {
    pointToRandomCandidate: () => {
      this.index = Math.floor(Math.random() * this.candidates.length);
    },
    selectRandomCandidate(fakeSelects = 5, blurSpinDuration = 5) {
      this.spinning = true;
      if (index) {
        winners.push(this.candidates[index]);
        this.candidates.splice(index, 0);
      }

      for (blurSpinDuration; blurSpinDuration--; blurSpinDuration == 0) {
        this.pointToRandomCandidate();
      }

      for (fakeSelects; fakeSelects--; fakeSelects == 0) {
        setTimeout(this.pointToRandomCandidate(), 1000);
      }

      this.spinning = false;
    },
  },
});
