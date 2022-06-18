import { defineStore } from 'pinia'

export const useParticipantStore = defineStore({
  id: 'participants',
  state: () => ({
    candidates: [],
    winners: [],
    index: null,
    spinning: false
  }),
  getters: {
    getRandomCandidate: (state) => {
      state.candidates[index]
    },
    getParticipants(state) {
      return [...state.candidates, ...state.winners]
    },
    winnerSelected(){
      return spinning === false && index != null
    }
  },
  actions: {
    getRandomCandidate: () => {
      this.index = Math.floor(Math.random() * this.candidates.length)
    },
    selectRandomCandidate(fakeSelects=5, blurSpinDuration=5) {
      this.spinning = true;
      if (index){
        winners.push(this.candidates[index])
        this.candidates.splice(index,0);
      }

      for (blurSpinDuration; blurSpinDuration--; blurSpinDuration == 0){
        this.getRandomCandidate();
      }
      
      for (fakeSelects; fakeSelects--; fakeSelects == 0){
        setTimeout(this.getRandomCandidate(), 1000)
      }

      this.spinning = false;
    }
  }
})
