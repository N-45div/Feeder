// Qloo silently ignores parameters that do not apply to the requested entity type,
// which shows up as a plausible but wrong result. Check before calling /v2/insights.
// Source: docs.qloo.com "Available parameters by entity type" and "Parameters".

import type { QueryParams } from "./client";

export const ENTITY_TYPES = [
  "urn:entity:artist",
  "urn:entity:book",
  "urn:entity:brand",
  "urn:entity:destination",
  "urn:entity:movie",
  "urn:entity:person",
  "urn:entity:place",
  "urn:entity:podcast",
  "urn:entity:tv_show",
  // The hackathon guide writes urn:entity:video_game, but the live API rejects it (400).
  "urn:entity:videogame",
] as const;

export const OUTPUT_TYPES = ["urn:heatmap", "urn:demographics", "urn:tag"] as const;

export type EntityType = (typeof ENTITY_TYPES)[number];

const COMMON = [
  "filter.type",
  "filter.tags",
  "operator.filter.tags",
  "filter.exclude.tags",
  "operator.exclude.tags",
  "filter.exclude.entities",
  "filter.popularity.min",
  "filter.popularity.max",
  "filter.parents.types",
  "filter.external.exists",
  "filter.exists",
  "filter.results.entities",
  "filter.results.entities.query",
  "signal.interests.entities",
  "signal.interests.entities.weight",
  "signal.interests.tags",
  "signal.interests.tags.weight",
  "operator.signal.interests.tags",
  "signal.demographics.age",
  "signal.demographics.age.weight",
  "signal.demographics.gender",
  "signal.demographics.gender.weight",
  "signal.demographics.audiences",
  "signal.demographics.audiences.weight",
  "signal.location",
  "signal.location.query",
  "signal.location.radius",
  "signal.location.weight",
  "bias.trends",
  "bias.content_based",
  "feature.explainability",
  "diversify.by",
  "diversify.take",
  "backfill.cross_domain.take",
  "backfill.content_based.take",
  "take",
  "page",
  "offset",
];

const SCREEN = ["filter.release_year.min", "filter.release_year.max", "filter.release_country", "filter.rating.min", "filter.rating.max", "filter.content_rating"];

const LOCATION = [
  "filter.location",
  "filter.location.query",
  "filter.location.radius",
  "filter.location.geohash",
  "filter.location.metro",
  "filter.exclude.location",
  "filter.exclude.location.query",
  "filter.exclude.location.geohash",
  "filter.exclude.location.radius",
  "filter.geocode.name",
  "filter.geocode.admin1_region",
  "filter.geocode.admin2_region",
  "filter.geocode.country_code",
  "filter.address",
];

const PLACE_ONLY = [
  "filter.price_level.min",
  "filter.price_level.max",
  "filter.price_range.from",
  "filter.price_range.to",
  "filter.hours",
  "filter.hotel_class.min",
  "filter.hotel_class.max",
  "filter.properties.business_rating.min",
  "filter.properties.business_rating.max",
  "filter.external.tripadvisor.rating.min",
  "filter.external.tripadvisor.rating.max",
  "filter.external.tripadvisor.rating.count.min",
  "filter.external.tripadvisor.rating.count.max",
  "filter.references_brand",
  "sort_by",
  "bias.quality",
];

const HEATMAP = ["output.heatmap.boundary", "heatmap.dimensions"];

const BY_TYPE: Record<string, string[]> = {
  "urn:entity:artist": [],
  "urn:entity:brand": [],
  "urn:entity:podcast": [],
  "urn:entity:videogame": [],
  "urn:entity:book": ["filter.publication_year.min", "filter.publication_year.max"],
  "urn:entity:movie": SCREEN,
  "urn:entity:tv_show": [
    ...SCREEN,
    "filter.finale_year.min",
    "filter.finale_year.max",
    "filter.latest_known_year.min",
    "filter.latest_known_year.max",
  ],
  "urn:entity:person": [
    "filter.date_of_birth.min",
    "filter.date_of_birth.max",
    "filter.date_of_death.min",
    "filter.date_of_death.max",
    "filter.gender",
  ],
  "urn:entity:place": [...LOCATION, ...PLACE_ONLY],
  "urn:entity:destination": LOCATION,
  "urn:heatmap": HEATMAP,
  "urn:demographics": [],
  "urn:tag": [],
};

const ALL_KNOWN = new Set([...COMMON, ...Object.values(BY_TYPE).flat()]);

export const MAX_INSIGHTS_TAKE = 50;

/** Returns human-readable problems; an empty list means the request is safe to send. */
export function checkInsightsParams(params: QueryParams): string[] {
  const problems: string[] = [];
  const type = params["filter.type"];
  if (typeof type !== "string" || !(type in BY_TYPE)) {
    return [`filter.type must be one of ${Object.keys(BY_TYPE).join(", ")}`];
  }
  const allowed = new Set([...COMMON, ...BY_TYPE[type]]);
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === null) continue;
    if (!ALL_KNOWN.has(key)) problems.push(`${key} is not a documented insights parameter`);
    else if (!allowed.has(key)) problems.push(`${key} is ignored for ${type}`);
  }
  const take = params.take;
  if (typeof take === "number" && (take < 1 || take > MAX_INSIGHTS_TAKE)) {
    problems.push(`take must be between 1 and ${MAX_INSIGHTS_TAKE}`);
  }
  if (type === "urn:entity:destination" && !params["signal.interests.entities"]) {
    problems.push("urn:entity:destination requires signal.interests.entities");
  }
  return problems;
}
