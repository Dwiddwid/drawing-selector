import { defineStore } from 'pinia'

export const useParticipantStore = defineStore("participantStore", {
  state: () => ({
    candidates: [],
    winners: [],
    index: -1,
    spinning: false,
    useMultiDisplayMode: false,
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
      let timeBeforeSlow = Math.floor(Math.random() * 300);
      console.log(timeBeforeSlow)
      
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
        if (j < 500){
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
    startSpinning() {
      // Ensure we aren't already spinning
      if (this.spinning) return;

      this.spinning = true;
      this.index = 0;

      // Set the first period between 1 and 2 seconds
      const firstPeriod = Math.random() * 1000 + 1000;

      // Set the second period between 1 and 3 seconds
      const secondPeriod = Math.random() * 2000 + 1000;

      // Initial interval duration (in milliseconds)
      let intervalDuration = 50;

      // Function to change index
      const change = () => {
        this.pointToRandomCandidate()
        console.log('Index:', this.index);
      };

      // Start changing the index rapidly
      let rapidInterval = setInterval(change, intervalDuration);

      // After the first period, start slowing down the rate of index change
      setTimeout(() => {
        clearInterval(rapidInterval);

        const steps = 20;
        const slowDownDuration = secondPeriod / steps;

        const slowDownChange = (currentStep) => {
          if (currentStep >= steps) {
            this.spinning = false;
            return;
          }

          setTimeout(() => {
            change();
            slowDownChange(currentStep + 1);
          }, intervalDuration + (slowDownDuration * currentStep));
        };

        // Start the slow down process
        slowDownChange(0);
      }, firstPeriod);
    },
  },
});
