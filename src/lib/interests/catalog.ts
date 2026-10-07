// The fixed interest list a librarian tallies from. Fixed choices keep the survey anonymous (no free text)
// and let every interest be resolved to Qloo ahead of time. Entities are matched by name at resolve time;
// topics map to Qloo genre tags.

export type InterestCategory = "games" | "screen" | "topics";

export type Interest =
  | { id: string; label: string; category: "games"; entityType: "urn:entity:videogame"; query: string }
  | { id: string; label: string; category: "screen"; entityType: "urn:entity:tv_show" | "urn:entity:movie"; query: string }
  | { id: string; label: string; category: "topics"; tagQuery: string };

const game = (id: string, label: string, query = label): Interest => ({ id, label, category: "games", entityType: "urn:entity:videogame", query });
const show = (id: string, label: string, query = label): Interest => ({ id, label, category: "screen", entityType: "urn:entity:tv_show", query });
const film = (id: string, label: string, query = label): Interest => ({ id, label, category: "screen", entityType: "urn:entity:movie", query });
const topic = (id: string, label: string, tagQuery = label.toLowerCase()): Interest => ({ id, label, category: "topics", tagQuery });

export const INTERESTS: Interest[] = [
  game("minecraft", "Minecraft"),
  game("roblox", "Roblox"),
  game("fortnite", "Fortnite"),
  game("zelda", "The Legend of Zelda", "The Legend of Zelda: Breath of the Wild"),
  game("pokemon-games", "Pokémon games", "Pokemon Scarlet"),
  game("among-us", "Among Us"),
  game("fnaf", "Five Nights at Freddy's"),
  game("genshin", "Genshin Impact"),
  game("last-of-us", "The Last of Us"),
  game("call-of-duty", "Call of Duty"),
  game("animal-crossing", "Animal Crossing", "Animal Crossing: New Horizons"),
  game("stardew", "Stardew Valley"),
  game("undertale", "Undertale"),
  game("valorant", "Valorant"),
  game("league-of-legends", "League of Legends"),
  game("hollow-knight", "Hollow Knight"),
  show("stranger-things", "Stranger Things"),
  show("wednesday", "Wednesday"),
  show("percy-jackson", "Percy Jackson and the Olympians"),
  show("avatar-tla", "Avatar: The Last Airbender"),
  show("heartstopper", "Heartstopper"),
  show("arcane", "Arcane"),
  show("demon-slayer", "Demon Slayer", "Demon Slayer: Kimetsu no Yaiba"),
  show("jujutsu-kaisen", "Jujutsu Kaisen"),
  show("one-piece", "One Piece"),
  show("my-hero-academia", "My Hero Academia"),
  show("attack-on-titan", "Attack on Titan"),
  show("outer-banks", "Outer Banks"),
  show("cobra-kai", "Cobra Kai"),
  film("spider-verse", "Spider-Verse films", "Spider-Man: Across the Spider-Verse"),
  film("hunger-games", "The Hunger Games films", "The Hunger Games"),
  topic("basketball", "Basketball"),
  topic("soccer", "Soccer"),
  topic("football", "American football", "football"),
  topic("skateboarding", "Skateboarding"),
  topic("cooking", "Cooking"),
  topic("horror", "Horror"),
  topic("mystery", "Mystery"),
  topic("romance", "Romance"),
  topic("fantasy", "Fantasy"),
  topic("science-fiction", "Science fiction"),
  topic("space", "Space"),
  topic("history", "History"),
  topic("mythology", "Mythology"),
  topic("animals", "Animals"),
  topic("art", "Drawing and art", "art"),
  topic("music-making", "Making music", "music"),
  topic("technology", "Coding and technology", "technology"),
  topic("fashion", "Fashion"),
  topic("manga", "Anime and manga", "manga"),
  topic("graphic-novels", "Graphic novels"),
  topic("poetry", "Poetry"),
  topic("humor", "Funny books", "humor"),
  topic("dystopian", "Dystopian worlds", "dystopian"),
  topic("survival", "Survival and adventure", "survival"),
  topic("superheroes", "Superheroes"),
  topic("sports-biography", "Athletes' true stories", "sports biography"),
];

export const INTEREST_BY_ID = new Map(INTERESTS.map((i) => [i.id, i]));
