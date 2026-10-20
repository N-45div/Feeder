# Evaluation plan (written before the full test runs)

This file is committed before the test below is run, so the method can't be tuned to the result. The Evidence page reports the
outcome as defined here, whether it's a win, a tie or a loss.

## Question

Does Qloo's taste data show where a university's out-of-state freshmen come from, beyond what population and distance already
explain, and does it do that better than an assistant asked the same question?

## The pilot (exploratory, already seen)

On Oct 21 2026 ten universities were tried by hand: Alabama, Michigan, USC, Arizona State, Oregon, Clemson, Syracuse, Boston
University, Colorado Boulder and Ole Miss. Across them:
- the plain mean of Qloo heatmap affinity per state had a Spearman of 0.40 with the actual number of freshmen from each state;
- population and distance alone had 0.79;
- what population and distance leave unexplained, the Qloo score tracked with a partial Spearman of +0.49, positive for all ten.

The pilot also showed that small states with few map cells (Rhode Island, Hawaii) score high on a plain mean. **These ten
universities are excluded from the test.**

## Ground truth

IPEDS Fall Enrollment, "Residence and migration of first-time degree/certificate-seeking undergraduates": `EF2022C` (revised
file) for Fall 2022, and `EF2020C` (revised) for Fall 2020 as a replication. US Department of Education, NCES; public domain.
The count used is `EFRES01`: all first-time students from each state. Institution details come from the 2024 directory (`HD2024`).

## Universities (fixed by rule before any Qloo call on them)

- In HD2024, four-year (`ICLEVEL` = 1), degree-granting, in the 50 states or DC.
- In Fall 2022, at least 1,000 first-time students, of whom at least 20% came from outside the home state.
- Resolved in Qloo with `/search` (brand type) to an entity whose name matches the IPEDS name or one of its IPEDS aliases. The
  match ignores case, a leading "The", punctuation, and a trailing campus label such as "Main Campus". Anything else is
  dropped: for example, "Ohio State University" resolving to "Ohio State Football".
- The ten pilot universities are excluded.
- The report states how many universities qualify and how many resolve.

## States

The 50 states and DC, minus each university's home state. A state with fewer than 10 heatmap cells is left out for that
university.

## Scores (the arms)

1. **Qloo.** One national heatmap per university: `filter.type=urn:heatmap`, `signal.interests.entities=<university>`,
   `filter.location.query=United States`. A state's score is the popularity-weighted mean affinity of the cells whose centres
   fall inside it.
2. **Gravity.** The log of the state's 2020 census population and the log of the distance from campus to the state's 2020
   population centre.
3. **Assistant only.** Claude Haiku 5.5 is given the university's name and ranks every state except the home state by how many
   out-of-state first-time freshmen the university draws from it. No tools and no data.
4. **Placebo.** The Qloo state scores of a different university from the test set, using a fixed random pairing (seed 21).

## Outcome

y = log(1 + first-time students from the state), Fall 2022.

## Analysis

- **Primary: does Qloo add anything beyond gravity?**
  - For each university, fit OLS of y on log population and log distance.
  - Take the partial Spearman of the Qloo score with the residual.
  - Report the mean over universities, with a 95% interval from 2,000 bootstrap resamples of universities.
  - Do the same for the placebo and for the assistant.
- **Secondary: better predictions?**
  - For each university, compute the out-of-sample Spearman of predicted against actual y for four models:
    - gravity;
    - gravity plus Qloo;
    - gravity plus the assistant;
    - gravity plus Qloo plus the assistant.
  - Coefficients are fitted on all the other universities (leave one university out).
  - Report paired bootstrap differences.
- **Replication.** Repeat both on Fall 2020.
- **Robustness.**
  - A plain (unweighted) mean of affinity.
  - The hit rate of each score's top 10 states against the actual top 10.

## What counts as a win

All three conditions must hold:
- Qloo's mean partial Spearman is above zero, its interval excludes zero, and it is above the placebo's.
- Gravity plus Qloo beats gravity alone out of sample, with the interval excluding zero, in both years.
- Qloo against the assistant is reported either way. If the assistant adds more, the product leads with the combination and
  says so.

## What this does not establish

- Qloo's data is from 2026; the enrollment data is from 2020 and 2022. This measures alignment, not a forecast.
- Where students come from also reflects past recruiting, alumni, athletics and price. The test can't separate taste from those.
- It is state-level only. IPEDS has no metro detail, so the metros Feeder suggests within a state are not tested here.
- Only first-time students are counted. Transfers and graduate students are not.

## Amendment 1 (Oct 21 2026, after resolving names, before any heatmap or assistant call for the test set)

- Two resolution fixes, both made before any score was computed:
  - **Aliases shorter than four characters don't count.** Georgetown University's IPEDS alias "GU" matched an unrelated entity.
  - **"Online" isn't treated as a campus label.** Treating it as one let "University of Arkansas" match "Arkansas Online".
- Result: 133 of the 260 qualifying universities resolve, and 124 of those are outside the pilot.
