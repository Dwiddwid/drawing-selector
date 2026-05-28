import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { setActivePinia, createPinia } from "pinia";
import { useParticipantStore } from "./participants.js";

function person(firstName, lastName, extras = {}) {
  return { id: `${firstName}-${lastName}`, firstName, lastName, extras };
}

describe("participant store", () => {
  beforeEach(() => {
    setActivePinia(createPinia());
    localStorage.clear();
  });

  it("does nothing when the pool is empty", () => {
    const store = useParticipantStore();
    expect(store.selectRandomCandidate()).toBe(false);
    expect(store.spinning).toBe(false);
    expect(store.winners).toHaveLength(0);
  });

  it("pointToRandomCandidate stays in range and is -1 when empty", () => {
    const store = useParticipantStore();
    store.pointToRandomCandidate();
    expect(store.index).toBe(-1);

    store.candidates = [person("Ada", "Lovelace"), person("Alan", "Turing")];
    for (let i = 0; i < 50; i++) {
      store.pointToRandomCandidate();
      expect(store.index).toBeGreaterThanOrEqual(0);
      expect(store.index).toBeLessThan(store.candidates.length);
    }
  });

  it("commitSelection moves a copy to winners and removes from the pool", () => {
    const store = useParticipantStore();
    const ada = person("Ada", "Lovelace");
    store.candidates = [ada, person("Alan", "Turing")];
    store.index = 0;

    store.commitSelection();

    expect(store.candidates).toHaveLength(1);
    expect(store.candidates[0].firstName).toBe("Alan");
    expect(store.winners).toHaveLength(1);
    expect(store.selected.firstName).toBe("Ada");
    // stored winner is a copy, not the original object reference
    expect(store.winners[0]).not.toBe(ada);
    expect(store.index).toBe(-1);
    expect(JSON.parse(localStorage.getItem("winners"))).toHaveLength(1);
  });

  it("importParticipants excludes prior winners and persists", () => {
    const store = useParticipantStore();
    store.winners = [person("Ada", "Lovelace")];

    const result = store.importParticipants([
      person("Ada", "Lovelace"),
      person("Alan", "Turing"),
    ]);

    expect(result).toEqual({ imported: 1, skipped: 1 });
    expect(store.candidates).toHaveLength(1);
    expect(store.candidates[0].firstName).toBe("Alan");
    expect(JSON.parse(localStorage.getItem("candidates"))).toHaveLength(1);
  });

  it("loadFromStorage reads persisted state", () => {
    localStorage.setItem(
      "candidates",
      JSON.stringify([person("Ada", "Lovelace")])
    );
    localStorage.setItem("winners", JSON.stringify([person("Alan", "Turing")]));
    localStorage.setItem("useMultiDisplayMode", "true");

    const store = useParticipantStore();
    store.loadFromStorage();

    expect(store.candidates).toHaveLength(1);
    expect(store.winners).toHaveLength(1);
    expect(store.useMultiDisplayMode).toBe(true);
  });

  it("resetCandidates and resetWinners clear state and storage", () => {
    const store = useParticipantStore();
    store.candidates = [person("Ada", "Lovelace")];
    store.winners = [person("Alan", "Turing")];
    store.persistCandidates();
    store.persistWinners();

    store.resetCandidates();
    store.resetWinners();

    expect(store.candidates).toHaveLength(0);
    expect(store.winners).toHaveLength(0);
    expect(localStorage.getItem("candidates")).toBeNull();
    expect(localStorage.getItem("winners")).toBeNull();
  });

  describe("full draw with fake timers", () => {
    beforeEach(() => vi.useFakeTimers());
    afterEach(() => vi.useRealTimers());

    it("runs the spin animation and produces exactly one winner", () => {
      const store = useParticipantStore();
      store.candidates = [
        person("Ada", "Lovelace"),
        person("Alan", "Turing"),
        person("Grace", "Hopper"),
      ];

      expect(store.selectRandomCandidate()).toBe(true);
      expect(store.spinning).toBe(true);

      vi.runAllTimers();

      expect(store.spinning).toBe(false);
      expect(store.winners).toHaveLength(1);
      expect(store.candidates).toHaveLength(2);
      expect(store.selected).not.toBeNull();
    });
  });
});
