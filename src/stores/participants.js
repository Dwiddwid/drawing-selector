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
    selectRandomCandidate() {
      if(this.spinning){
        return;
      }
      else {
        this.spinning = true;
      }
      var timeBeforeSlow = Math.floor(Math.random() * 400) + 100;

      
      if (this.index > -1) {
        this.candidates.splice(this.index, 1);
      }

      let i = 0;
      let j = 10

      setTimeout(function run() {
        this.pointToRandomCandidate();
        i++;
        if(i > timeBeforeSlow){
          j = j+50;
        }
        if (j < 700){
          setTimeout(run.bind(this), j);
        }
        else {
          this.spinning = false;
          this.winners.push(this.candidates[this.index]);
          localStorage.setItem("winners", JSON.stringify(this.winners));
        }
      }.bind(this), j);

      // for (blurSpinDuration; blurSpinDuration--; blurSpinDuration == 0) {
      //   await delay(1000)
      //   this.pointToRandomCandidate()
      // }

      // for (fakeSelects; fakeSelects--; fakeSelects == 0) {
      //   setTimeout(this.pointToRandomCandidate(), 1000);
      // }

      //this.spinning = false;
    },
  },
});
