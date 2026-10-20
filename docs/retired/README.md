# Retired: Shelf Desk

This repository started as Shelf Desk, a school-librarian tool that turned students' games, shows and films into a priced teen
book list using Qloo's book graph. Its evaluation was written down before it ran (`shelf-desk-eval-plan.md`) and scored the
picks on Seattle Public Library teen-shelf checkouts.

It failed. Per circulating copy, the Qloo-ranked picks were borrowed 42% less than an assistant's picks in 2025 and 47% less in
January to August 2026, and did no better than random picks from the same pool (`shelf-desk-seattle-result.json`). An
exploratory mix of the two lists was no better than the assistant alone. For naming the specific books a reader will borrow,
an assistant wins, so the product was dropped and the repository now holds Feeder.

The scripts that produced the result are kept here as they ran (`seattle-arms.mts`, `seattle_eval.py`); they depend on modules
that were removed with the product, so they are a record rather than something to rerun from this tree.
