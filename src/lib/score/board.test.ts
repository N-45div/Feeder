import { describe, expect, it } from "vitest";
import { stateBoard, type StateInfo } from "./board";

// Six states on a line east of campus, equal population; freshmen fall with distance except where noted.
const states: StateInfo[] = Array.from({ length: 7 }, (_, i) => ({ fips: i + 1, name: `S${i + 1}`, pop2020: 1_000_000, lat: 40, lon: -100 + i * 3 }));
const campus = { lat: 40, lon: -100, stateFips: 1 };

describe("stateBoard", () => {
  it("leaves out the home state and states without pull", () => {
    const pulls = { S2: { pull: 0.5 }, S3: { pull: 0.5 }, S4: { pull: 0.5 }, S5: { pull: 0.5 }, S6: { pull: 0.5 }, S1: { pull: 0.9 } };
    const board = stateBoard(campus, states, { 2: 100, 3: 50, 4: 30, 5: 20, 6: 15 }, pulls);
    expect(board.map((r) => r.state).sort()).toEqual(["S2", "S3", "S4", "S5", "S6"]);
  });

  it("groups states by pull against the median and freshmen against geography", () => {
    const pulls = { S2: { pull: 0.9 }, S3: { pull: 0.8 }, S4: { pull: 0.2 }, S5: { pull: 0.1 }, S6: { pull: 0.7 }, S7: { pull: 0.3 } };
    // S3 draws far more than its distance suggests; S6 far fewer.
    const board = stateBoard(campus, states, { 2: 100, 3: 400, 4: 30, 5: 20, 6: 1, 7: 12 }, pulls);
    const group = Object.fromEntries(board.map((r) => [r.state, r.group]));
    expect(group.S3).toBe("stronghold");
    expect(group.S6).toBe("untapped");
    expect(board[0].state).toBe("S2");
    const s6 = board.find((r) => r.state === "S6")!;
    expect(s6.gap).toBeLessThan(0);
    expect(s6.expected).toBeGreaterThan(s6.freshmen);
  });

  it("needs at least five states", () => {
    expect(stateBoard(campus, states, {}, { S2: { pull: 1 } })).toEqual([]);
  });
});
