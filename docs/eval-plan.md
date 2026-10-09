# Evaluation plan (written before any result is computed)

This file is committed before the evaluation runs, so the method can't be tuned to the result. The Proof tab reports the outcome exactly as defined here, whether positive, a tie or negative.

## Question

When a librarian buys the books Shelf Desk suggests for a set of student interests, do those books actually get borrowed by teens more than books chosen another way?

## Ground truth

Seattle Public Library open data (public domain, data.seattle.gov), queried live by `scripts/` with no key:
- **Checkouts by Title (Physical Items)** for items shelved in Teen collections (codes beginning `ny`, per the library's ILS data dictionary).
- **Outcome:** checkouts per circulating copy (distinct item barcodes) over two windows: calendar 2025 (primary) and January-August 2026 (holdout).
- May-July 2024 is excluded everywhere: the library's systems were down.

Only aggregate counts per title are kept. No patron data exists in these datasets.

## Arms

20 interest seeds (10 games, 8 shows, 2 films) from the catalogue, 20 titles per seed per arm:
1. **Shelf Desk:** the product's engine (teen filter stack, cleanup, author cap).
2. **LLM only:** the same seed, a fixed prompt asking for 20 teen books published since 2005 for a reader who loves it, no tools.
3. **Popularity order:** the same candidate pool as arm 1, re-ordered by Qloo popularity instead of interest affinity. This separates "fits the interest" from "is a popular teen book".
4. **Random:** 20 titles drawn at random from arm 1's pool (fixed seed).

## Matching

- Titles join to Seattle's teen shelf by normalised title plus author surname, with ISBN-13 used where both sides have it.
- The match rate is reported per arm. An unmatched title means Seattle never shelved it as teen, not that nobody read it.
- A bounds analysis scores unmatched titles as zero.

## Analysis

- Log checkouts per copy, compared arm against arm, with standard errors clustered by seed.
- Controls: publication-year band, graphic versus prose.
- A version with and without log copies, because copies respond to demand.
- Leave-one-author-out as a robustness check.

## What would count as a win

Shelf Desk beats LLM-only and random by 25% or more, with a 95% interval for the difference that excludes zero, in both windows. Arm 1 beating arm 3 shows the interest signal matters beyond popularity.

If Shelf Desk only ties the best baseline, the claim becomes: "ties the strongest baseline, every title real, newer, and tied to the interests students named."

## What this does not establish

- Seattle is a public library, not a school.
- Borrowing is not reading, and nothing here measures reading outcomes.
- Qloo's graph reflects the present, so a 2025 backtest benefits from hindsight. The 2026 holdout and a frozen prospective list are there to limit that.
