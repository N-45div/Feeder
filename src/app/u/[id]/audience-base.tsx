import paths from "../../../../data/geo/state-paths.json";

// The audience map's static layer, drawn on the server: state shapes, then Qloo heatmap cells shaded by affinity.
// A geohash-4 cell spans about 0.35 degrees of longitude and 0.18 of latitude: roughly 5.6 x 3.7 units on this map.
const W = 5.8;
const H = 3.9;

function shade(a: number): { fill: string; opacity: number } {
  if (a >= 0.9) return { fill: "#ff6a2b", opacity: 0.95 };
  if (a >= 0.75) return { fill: "#ff6a2b", opacity: 0.55 };
  return { fill: "#ffb89c", opacity: 0.45 };
}

export function AudienceBase({ cells, home }: { cells: [number, number, number][]; home: string }) {
  return (
    <g>
      <g>
        {(paths.paths as { abbr: string; d: string }[]).map((p) => (
          <path key={p.abbr} d={p.d} fill={p.abbr === home ? "#e7e4f0" : "#f6f5fa"} stroke="#c9c3dc" strokeWidth={0.8} />
        ))}
      </g>
      <g>
        {cells.map(([x, y, a], i) => {
          const s = shade(a);
          return <rect key={i} x={x - W / 2} y={y - H / 2} width={W} height={H} fill={s.fill} fillOpacity={s.opacity} />;
        })}
      </g>
    </g>
  );
}
