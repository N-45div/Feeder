// One list of Feeder's tools with the words a model sees, used by both the in-page agent and the MCP server.

import type { z } from "zod";
import { audienceHotspots, hotspotsInput } from "./hotspots";
import { boardInput, briefInput, evidenceInput, findInput, findUniversities, getEvidence, metroBrief, metrosInput, recruiterMetros, stateBoard, tripPlan, tripsInput } from "./tools";

export interface FeederTool<S extends z.ZodObject = z.ZodObject> {
  title: string;
  description: string;
  input: S;
  run: (input: z.infer<S>) => Promise<unknown>;
  /** True when a call can reach Qloo live (a new metro brief); everything else reads stored data. */
  live?: boolean;
}

const define = <S extends z.ZodObject>(t: FeederTool<S>) => t as unknown as FeederTool;

export const FEEDER_TOOLS: Record<string, FeederTool> = {
  find_universities: define({
    title: "Find a university",
    description: "Finds four-year US universities Feeder covers by name, city or state, and returns each one's id. Use it first: the other tools need an id.",
    input: findInput,
    run: findUniversities,
  }),
  state_board: define({
    title: "State board",
    description:
      "For one university, every state outside its home state with: Fall 2022 first-time freshmen from there, what population and distance alone predict, Qloo pull " +
      "(how much people aged 24 and younger there lean toward the university), and a group: untapped (pull high, freshmen below prediction), stronghold, earned (freshmen without " +
      "pull) or quiet. Use for where to recruit harder, where the university is already strong, and why.",
    input: boardInput,
    run: stateBoard,
  }),
  recruiter_metros: define({
    title: "Metros for recruiter travel",
    description: "The metros of 500,000+ people outside the home state where Qloo pull among people 24 and younger is strongest, with population and distance from campus.",
    input: metrosInput,
    run: recruiterMetros,
  }),
  metro_brief: define({
    title: "Metro brief",
    description:
      "For one university and one metro: the high schools Qloo ranks highest for people who lean toward the university (with addresses), other colleges " +
      "nearby that compete for the same students, the music and TV young people in that audience like there, a visit day (the top schools in driving " +
      "order plus an access stop: a large low-income public school, from federal data) and upcoming college fairs. Use for visit lists and outreach messaging.",
    input: briefInput,
    run: metroBrief,
    live: true,
  }),
  audience_hotspots: define({
    title: "Ask Qloo where an audience lives",
    description:
      "Asks Qloo live where people aged 24 and younger who lean toward the university live, optionally narrowed to those who also like one brand, show, " +
      "film, artist or game (for example 'Patagonia' for an outdoor programme, 'Minecraft' for computer science, 'Grey's Anatomy' for nursing). Returns " +
      "the metros of 500,000+ outside the home state where that audience is strongest, and each metro's place on the university's own list. Use when " +
      "someone asks where to find students for a programme, sport or interest.",
    input: hotspotsInput,
    run: audienceHotspots,
    live: true,
  }),
  plan_trips: define({
    title: "Plan recruiter trips",
    description:
      "Plans recruiter travel for a university: the strongest-pull metros, split west to east into one territory per recruiter and two nearby stops a week. " +
      "Optionally kept to one Census region. Returns who goes where each week.",
    input: tripsInput,
    run: tripPlan,
  }),
  get_evidence: define({
    title: "How Feeder was tested",
    description: "The pre-registered test against federal enrollment data, what it showed (including where an AI assistant does better) and Feeder's limits. Use when asked how sure the numbers are.",
    input: evidenceInput,
    run: getEvidence,
  }),
};
