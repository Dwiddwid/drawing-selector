import { defineStore } from 'pinia'

export const useParticipantStore = defineStore("participantStore", {
  state: () => ({
    candidates: [],
    winners: [],
    index: -1,
    spinning: false,
  }),
  getters: {
    currentCandidate(state) {
      if (state.index > -1) {
        return state.candidates[state.index];
      } else {
        return null;
      }
    },
    getParticipants(state) {
      return [...state.candidates, ...state.winners];
    },
    winnerSelected(state) {
      return state.spinning === false && state.index > -1;
    },
  },
  actions: {
    pointToRandomCandidate() {
      this.index = Math.floor(Math.random() * this.candidates.length);
    },
    selectRandomCandidate(fakeSelects = 5, blurSpinDuration = 50) {
      if(this.spinning){
        return;
      }
      this.spinning = true;
      if (this.index > -1) {
        this.winners.push(this.candidates[this.index]);
        this.candidates.splice(this.index, 1);
      }

      for (blurSpinDuration; blurSpinDuration--; blurSpinDuration == 0) {
        setTimeout(this.pointToRandomCandidate(), 30000);
      }

      for (fakeSelects; fakeSelects--; fakeSelects == 0) {
        setTimeout(this.pointToRandomCandidate(), 1000);
      }

      this.spinning = false;
    },
  },
});
