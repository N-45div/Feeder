"""Seattle teen-shelf evaluation, following docs/eval-plan.md.

Reads data/cache/eval/seattle-arms.json (built by analysis/seattle-arms.mts) and writes aggregates only to
data/eval/seattle.json. Outcome: log checkouts per circulating copy for matched titles; errors clustered by seed.
Run: python analysis/seattle_eval.py
"""

import json
from pathlib import Path

import numpy as np
import pandas as pd
import statsmodels.formula.api as smf

ROOT = Path(__file__).resolve().parent.parent
ARMS = ["desk", "llm", "popularity", "random"]


def frame(rows: list, window: str) -> pd.DataFrame:
    out = []
    for r in rows:
        m = r.get(window)
        out.append(
            {
                "seed": r["seed"],
                "arm": r["arm"],
                "author": (r.get("author") or "").lower(),
                "matched": m is not None,
                "checkouts": m["checkouts"] if m else 0,
                "copies": m["copies"] if m else 0,
                "graphic": int(bool(m and m["graphic"])),
                "year_band": "unknown" if not (m and m["year"]) else ("<=2015" if m["year"] <= 2015 else ("2016-20" if m["year"] <= 2020 else "2021+")),
            }
        )
    df = pd.DataFrame(out)
    df["arm"] = pd.Categorical(df["arm"], categories=ARMS)
    return df


def vs_desk(model) -> dict:
    """Desk's advantage over each arm, in percent: exp(-coef) - 1 (positive = Desk titles circulate more)."""
    out = {}
    ci = model.conf_int()
    for arm in ARMS[1:]:
        term = f"C(arm)[T.{arm}]"
        if term not in model.params:
            continue
        b, lo, hi = model.params[term], ci.loc[term, 0], ci.loc[term, 1]
        out[arm] = {"desk_advantage_pct": round(100 * (np.exp(-b) - 1), 1), "ci95": [round(100 * (np.exp(-hi) - 1), 1), round(100 * (np.exp(-lo) - 1), 1)], "p": round(float(model.pvalues[term]), 4)}
    return out


def fit(df: pd.DataFrame, extra: str = ""):
    d = df[df["matched"] & (df["copies"] > 0)].copy()
    d["y"] = np.log(d["checkouts"] / d["copies"])
    d["log_copies"] = np.log(d["copies"])
    return smf.ols(f"y ~ C(arm){extra}", data=d).fit(cov_type="cluster", cov_kwds={"groups": d["seed"]})


def window_report(rows: list, window: str) -> dict:
    df = frame(rows, window)
    main = fit(df)
    report = {
        "titles_per_arm": {a: int((df["arm"] == a).sum()) for a in ARMS},
        "match_rate_pct": {a: round(100 * df[df["arm"] == a]["matched"].mean(), 1) for a in ARMS},
        "matched_titles": {a: int(df[(df["arm"] == a) & df["matched"]].shape[0]) for a in ARMS},
        "median_checkouts_per_copy": {a: round(float((df[(df["arm"] == a) & df["matched"]].eval("checkouts / copies")).median()), 2) for a in ARMS},
        "main": vs_desk(main),
        "with_log_copies": vs_desk(fit(df, " + log_copies")),
        "with_graphic_and_year": vs_desk(fit(df, " + graphic + C(year_band)")),
    }
    # Bounds: unmatched titles count as zero checkouts; mean checkouts per suggested title, seed-bootstrapped.
    per = df.assign(cpc=np.where(df["copies"] > 0, df["checkouts"] / df["copies"].clip(lower=1), 0.0))
    seeds = per["seed"].unique()
    rng = np.random.default_rng(13)
    boot = {a: [] for a in ARMS}
    for _ in range(2000):
        sample = pd.concat([per[per["seed"] == s] for s in rng.choice(seeds, len(seeds))])
        for a in ARMS:
            boot[a].append(sample[sample["arm"] == a]["cpc"].mean())
    report["bounds_mean_checkouts_per_copy_unmatched_zero"] = {a: {"mean": round(float(per[per["arm"] == a]["cpc"].mean()), 2), "ci95": [round(float(np.percentile(boot[a], 2.5)), 2), round(float(np.percentile(boot[a], 97.5)), 2)]} for a in ARMS}
    # Leave-one-author-out: range of Desk's advantage over the LLM arm.
    authors = df[df["matched"]]["author"].value_counts().index[:15]
    loo = []
    for a in authors:
        r = vs_desk(fit(df[df["author"] != a])).get("llm")
        if r:
            loo.append(r["desk_advantage_pct"])
    report["leave_one_author_out_desk_vs_llm_pct"] = [min(loo), max(loo)] if loo else None
    return report


def main() -> None:
    rows = json.loads((ROOT / "data/cache/eval/seattle-arms.json").read_text(encoding="utf-8"))
    result = {
        "source": "Seattle Public Library, Checkouts by Title (Physical Items), public domain",
        "seeds": len({r["seed"] for r in rows}),
        "primary_teen_shelves": {"2025": window_report(rows, "teen2025"), "2026_jan_aug": window_report(rows, "teen2026")},
        "exploratory_teen_and_children_shelves": {"2025": window_report(rows, "any2025"), "2026_jan_aug": window_report(rows, "any2026")},
    }
    out = ROOT / "data/eval"
    out.mkdir(parents=True, exist_ok=True)
    (out / "seattle.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    for name, w in result["primary_teen_shelves"].items():
        print(name, "match %", w["match_rate_pct"], "| main", w["main"])


if __name__ == "__main__":
    main()
