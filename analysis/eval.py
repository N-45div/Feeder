"""Feeder's evaluation, exactly as written in docs/eval-plan.md (with amendments 1 and 2).

Inputs: data/ipeds/*.json, data/geo/states.json (public), data/cache/{resolved,state-pulls}.json and data/cache/assistant/*.json
(Qloo and assistant output, gitignored). Writes aggregates only to data/eval/feeder.json.
Run: python analysis/eval.py
"""

import json
import math
import random
from pathlib import Path

import numpy as np
from scipy.stats import spearmanr

ROOT = Path(__file__).resolve().parent.parent
BOOT = 2000


def load(path):
    return json.loads((ROOT / path).read_text(encoding="utf-8"))


universities = {u["unitid"]: u for u in load("data/ipeds/universities.json")["universities"]}
residence = load("data/ipeds/residence.json")
states = {s["name"]: s for s in load("data/geo/states.json")["states"]}
fips_name = {s["fips"]: s["name"] for s in states.values()}
resolved = load("data/cache/resolved.json")
pulls = load("data/cache/state-pulls.json")
# Amendment 2: pull among people aged 24 and younger, from the same heatmap call with an age signal.
YOUNG_PATH = ROOT / "data/cache/state-pulls-young.json"
pulls_young = load("data/cache/state-pulls-young.json") if YOUNG_PATH.exists() else {}
assistant = {}
for f in (ROOT / "data/cache/assistant").glob("*.json"):
    assistant[int(f.stem)] = json.loads(f.read_text(encoding="utf-8"))["order"]

test = sorted(int(k) for k, r in resolved.items() if r.get("entityId") and not r.get("pilot") and k in pulls)
# Placebo: a fixed random pairing within the test set (seed 21), each university scored with another's pull.
shuffled = test[:]
random.Random(21).shuffle(shuffled)
placebo_of = {shuffled[i]: shuffled[(i + 1) % len(shuffled)] for i in range(len(shuffled))}


def km(lat1, lon1, lat2, lon2):
    p = math.pi / 180
    a = math.sin((lat2 - lat1) * p / 2) ** 2 + math.cos(lat1 * p) * math.cos(lat2 * p) * math.sin((lon2 - lon1) * p / 2) ** 2
    return 12742 * math.asin(math.sqrt(a))


def frame(uid, year, field="pull"):
    """Rows for one university: states other than home with a pull score."""
    u = universities[uid]
    counts = residence[f"fall{year}"].get(str(uid), {}).get("states", {})
    by_name = {fips_name[int(k)]: v for k, v in counts.items() if int(k) in fips_name}
    order = assistant.get(uid, [])
    rank = {s: i for i, s in enumerate(order)}
    rows = []
    for name, s in states.items():
        if name == u["state"] or name not in pulls[str(uid)]:
            continue
        rows.append({
            "state": name,
            "y": math.log1p(by_name.get(name, 0)),
            "logpop": math.log(s["pop2020"]),
            "logdist": math.log(max(km(u["lat"], u["lon"], s["lat"], s["lon"]), 1.0)),
            "qloo": pulls[str(uid)][name][field],
            "placebo": pulls[str(placebo_of[uid])].get(name, {}).get(field, float("nan")),
            "assistant": 1 - rank[name] / max(len(order) - 1, 1) if name in rank else float("nan"),
            "young": pulls_young.get(str(uid), {}).get(name, {}).get(field, float("nan")),
            "placebo_young": pulls_young.get(str(placebo_of[uid]), {}).get(name, {}).get(field, float("nan")),
        })
    return rows


def resid(rows):
    X = np.column_stack([np.ones(len(rows)), [r["logpop"] for r in rows], [r["logdist"] for r in rows]])
    y = np.array([r["y"] for r in rows])
    beta, *_ = np.linalg.lstsq(X, y, rcond=None)
    return y - X @ beta


def partial(rows, key):
    keep = [i for i, r in enumerate(rows) if not math.isnan(r[key])]
    if len(keep) < 10:
        return float("nan")
    e = resid(rows)
    return spearmanr([rows[i][key] for i in keep], e[keep]).statistic


def boot_mean(values, seed=7):
    v = np.array([x for x in values if not math.isnan(x)])
    rng = np.random.default_rng(seed)
    means = [rng.choice(v, len(v)).mean() for _ in range(BOOT)]
    return {"mean": round(float(v.mean()), 3), "ci95": [round(float(np.percentile(means, 2.5)), 3), round(float(np.percentile(means, 97.5)), 3)], "n": int(len(v))}


def boot_diff(a, b, seed=7):
    pairs = np.array([(x, y) for x, y in zip(a, b) if not (math.isnan(x) or math.isnan(y))])
    d = pairs[:, 0] - pairs[:, 1]
    rng = np.random.default_rng(seed)
    means = [rng.choice(d, len(d)).mean() for _ in range(BOOT)]
    return {"mean": round(float(d.mean()), 3), "ci95": [round(float(np.percentile(means, 2.5)), 3), round(float(np.percentile(means, 97.5)), 3)], "n": int(len(d))}


def zs(values):
    v = np.array(values, dtype=float)
    sd = np.nanstd(v)
    return (v - np.nanmean(v)) / sd if sd > 0 else v * 0


MODELS = {"gravity": [], "gravity+qloo": ["qloo"], "gravity+assistant": ["assistant"], "gravity+qloo+assistant": ["qloo", "assistant"]}


def design(rows, extra):
    cols = [[r["logpop"] for r in rows], [r["logdist"] for r in rows]]
    for key in extra:
        vals = [r[key] for r in rows]
        vals = [0.5 if math.isnan(x) else x for x in vals]
        cols.append(zs(vals))
    return np.column_stack(cols)


def out_of_sample(frames, models=MODELS):
    """Leave one university out: pooled OLS on the others (with a per-university intercept removed by demeaning)."""
    result = {m: {} for m in models}
    for m, extra in models.items():
        blocks = {}
        for uid, rows in frames.items():
            X = design(rows, extra)
            y = np.array([r["y"] for r in rows])
            blocks[uid] = (X - X.mean(axis=0), y - y.mean(), X, y)
        for uid in frames:
            Xs = np.vstack([b[0] for k, b in blocks.items() if k != uid])
            ys = np.concatenate([b[1] for k, b in blocks.items() if k != uid])
            beta, *_ = np.linalg.lstsq(Xs, ys, rcond=None)
            _, _, X, y = blocks[uid]
            result[m][uid] = spearmanr(X @ beta, y).statistic
    return result


def top10(rows, key):
    actual = sorted(rows, key=lambda r: -r["y"])[:10]
    pick = sorted([r for r in rows if not math.isnan(r[key])], key=lambda r: -r[key])[:10]
    return len({r["state"] for r in actual} & {r["state"] for r in pick}) / 10


def report(year, field="pull"):
    frames = {uid: frame(uid, year, field) for uid in test}
    frames = {k: v for k, v in frames.items() if len(v) >= 20}
    for rows in frames.values():
        for r in rows:
            r["gravity"] = r["logpop"] - r["logdist"]
    p = {k: {uid: partial(rows, k) for uid, rows in frames.items()} for k in ("qloo", "placebo", "assistant")}
    oos = out_of_sample(frames)
    ids = list(frames)
    return {
        "universities": len(frames),
        "partial_spearman_vs_gravity_residual": {k: boot_mean(list(v.values())) for k, v in p.items()},
        "qloo_minus_placebo": boot_diff([p["qloo"][u] for u in ids], [p["placebo"][u] for u in ids]),
        "qloo_minus_assistant": boot_diff([p["qloo"][u] for u in ids], [p["assistant"][u] for u in ids]),
        "out_of_sample_spearman": {m: boot_mean(list(v.values())) for m, v in oos.items()},
        "gravity_plus_qloo_minus_gravity": boot_diff([oos["gravity+qloo"][u] for u in ids], [oos["gravity"][u] for u in ids]),
        "gravity_plus_assistant_minus_gravity": boot_diff([oos["gravity+assistant"][u] for u in ids], [oos["gravity"][u] for u in ids]),
        "all_three_minus_gravity_plus_assistant": boot_diff([oos["gravity+qloo+assistant"][u] for u in ids], [oos["gravity+assistant"][u] for u in ids]),
        "top10_hit_rate": {k: round(float(np.mean([top10(frames[u], k) for u in ids])), 3) for k in ("qloo", "assistant", "gravity", "placebo")},
    }


YOUNG_MODELS = {
    "gravity": [],
    "gravity+qloo": ["qloo"],
    "gravity+young": ["young"],
    "gravity+assistant": ["assistant"],
    "gravity+assistant+young": ["assistant", "young"],
}


def report_young(year):
    """Amendment 2: young-audience pull against all-ages pull, the assistant and its own placebo."""
    frames = {uid: frame(uid, year) for uid in test}
    frames = {k: v for k, v in frames.items() if len(v) >= 20}
    p = {k: {uid: partial(rows, k) for uid, rows in frames.items()} for k in ("qloo", "young", "placebo_young", "assistant")}
    ids = [u for u in frames if not math.isnan(p["young"][u])]
    oos = out_of_sample({u: frames[u] for u in ids}, YOUNG_MODELS)
    pick = lambda d: [d[u] for u in ids]
    return {
        "universities": len(ids),
        "partial_spearman_vs_gravity_residual": {k: boot_mean(pick(v)) for k, v in p.items()},
        "young_minus_all_ages": boot_diff(pick(p["young"]), pick(p["qloo"])),
        "young_minus_assistant": boot_diff(pick(p["young"]), pick(p["assistant"])),
        "young_minus_placebo": boot_diff(pick(p["young"]), pick(p["placebo_young"])),
        "out_of_sample_spearman": {m: boot_mean(list(v.values())) for m, v in oos.items()},
        "gravity_plus_young_minus_gravity_plus_all_ages": boot_diff(pick(oos["gravity+young"]), pick(oos["gravity+qloo"])),
        "assistant_plus_young_minus_gravity_plus_assistant": boot_diff(pick(oos["gravity+assistant+young"]), pick(oos["gravity+assistant"])),
        "top10_hit_rate": {k: round(float(np.mean([top10(frames[u], k) for u in ids])), 3) for k in ("young", "qloo", "assistant")},
    }


def main():
    result = {
        "plan": "docs/eval-plan.md (amendment 1)",
        "test_universities": len(test),
        "fall2022": report("2022"),
        "fall2020_replication": report("2020"),
        "robustness_plain_mean_affinity_fall2022": report("2022", field="meanAffinity")["partial_spearman_vs_gravity_residual"],
    }
    if pulls_young:
        result["amendment2_young"] = {"fall2022": report_young("2022"), "fall2020_replication": report_young("2020")}
    out = ROOT / "data/eval"
    out.mkdir(parents=True, exist_ok=True)
    (out / "feeder.json").write_text(json.dumps(result, indent=1) + "\n", encoding="utf-8")
    print(json.dumps(result, indent=1))


if __name__ == "__main__":
    main()
