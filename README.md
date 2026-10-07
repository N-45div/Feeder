# Shelf Desk

A collection-development and reading-programme assistant for school librarians.

A librarian runs an anonymous interest survey (games, shows, hobbies, topics: tallies only, no names), uploads the library's holdings, and gets:
- a purchase list that fits the budget, with the reason behind every title;
- a gap report against what students are into;
- a reading-programme kit for reluctant readers.

Book matching uses [Qloo](https://qloo.com)'s cross-domain taste graph. No student data is collected or stored.

**Status:** in development for the Qloo Agentic Hackathon (Sep 30 – Oct 30, 2026).

## Run locally

```bash
npm install
cp .env.example .env.local   # add your Qloo hackathon key
npm run dev
```

## License

MIT, see [LICENSE](LICENSE).
