import { useState } from "react";
import { percent } from "./api";
export default function Stats({ tab, stats: s, game, team, onFilm }) {
  const [sort, setSort] = useState("count");
  const [playerSort, setPlayerSort] = useState("scrimmage");
  if (!s) return <p role="status">Loading statistics…</p>;
  const teamName = (k) => game[k];
  function table(headers, rows) {
    return (
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              {headers.map((h) => (
                <th key={h}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={i}>
                {row.map((v, j) => (
                  <td key={j}>{v ?? "—"}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <p className="empty-row">
            No charted entries for this selection yet.
          </p>
        )}
      </div>
    );
  }
  const metrics = [
    ["Charted plays", s.charted],
    ["Run share", percent(s.run_pct)],
    ["Pass share", percent(s.pass_pct)],
    ["Offensive yards", s.yards],
    ["Completions", s.completions],
    ["Completion rate", percent(s.completion_pct)],
    ["Interceptions", s.interceptions],
    ["Fumbles / lost", `${s.fumbles} / ${s.fumbles_lost}`],
  ];
  const grouped = (rows) =>
    table(
      [
        "Team",
        "Play / formation",
        "Calls",
        "Yards",
        "Yards/call",
        "Successful",
        "Success %",
        "Run %",
        "Pass %",
      ],
      [...rows]
        .sort((a, b) =>
          sort === "worst"
            ? a.success_pct - b.success_pct || b.count - a.count
            : (b[sort] ?? 0) - (a[sort] ?? 0) || b.count - a.count,
        )
        .map((r) => [
          teamName(r.team),
          r.name,
          r.count,
          r.yards,
          r.average,
          `${r.successes}/${r.count}`,
          percent(r.success_pct),
          percent(r.run_pct),
          percent(r.pass_pct),
        ]),
    );
  return (
    <>
      <div className="scope">
        <span className="dot" />
        {team === "all" ? "Both teams" : teamName(team)} · {s.charted} charted
        in this view · {s.total_clips} clips in game
      </div>
      {!s.charted && (
        <div className="banner">
          Upload clips and mark their entries charted to populate these screens.{" "}
          <button onClick={onFilm}>Open film review →</button>
        </div>
      )}
      {tab === "overview" && (
        <>
          <div className="metrics">
            {metrics.map(([label, value]) => (
              <div className="metric" key={label}>
                <span>{label}</span>
                <strong>{value}</strong>
              </div>
            ))}
          </div>
          <div className="two-col">
            <section className="panel">
              <h3>Play selection</h3>
              <div className="split-bar">
                <div style={{ width: `${s.run_pct ?? 0}%` }} />
                <div style={{ width: `${s.pass_pct ?? 0}%` }} />
              </div>
              <p>
                <span className="accent">{s.runs} runs</span> / {s.passes}{" "}
                passes
              </p>
              <p className="muted">
                Run/pass shares exclude special teams and other plays.
              </p>
            </section>
            <section className="panel">
              <h3>Efficiency</h3>
              <strong className="big">
                {s.average_yards ?? "—"} <small>yards / offensive play</small>
              </strong>
              <p>{percent(s.success_pct)} successful across charted plays</p>
              <p className="muted">
                A completion counts as successful unless possession is lost.
              </p>
            </section>
          </div>
          <section className="panel">
            <h3>Yardage by clip</h3>
            {table(
              ["Clip", "Team", "Type", "Play", "Yards", "Result"],
              s.clips.map((c) => [
                `${c.position}. ${c.name}`,
                teamName(c.offense),
                c.play_type,
                c.play_name,
                c.yards,
                c.success ? "Successful" : "Unsuccessful",
              ]),
            )}
          </section>
        </>
      )}
      {["plays", "formations", "tendencies"].includes(tab) && (
        <section className="panel">
          <div className="section-head">
            <h3>
              {tab === "plays"
                ? "Which plays work?"
                : tab === "formations"
                  ? "Formation breakdown"
                  : "Observed formation tendencies"}
            </h3>
            <label>
              Sort
              <select value={sort} onChange={(e) => setSort(e.target.value)}>
                <option value="count">Most called</option>
                <option value="success_pct">Highest success rate</option>
                <option value="worst">Lowest success rate</option>
                <option value="average">Most yards per call</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Compare success with call count: one successful attempt is a small
            sample. Teams stay separate. These are observed tendencies, not
            predictions.
          </p>
          {grouped(tab === "plays" ? s.plays : s.formations)}
        </section>
      )}
      {tab === "players" && (
        <section className="panel">
          <div className="section-head">
            <h3>Yardage leaders</h3>
            <label>
              Rank players by
              <select
                value={playerSort}
                onChange={(e) => setPlayerSort(e.target.value)}
              >
                <option value="scrimmage">Scrimmage yards</option>
                <option value="rushing">Rushing yards</option>
                <option value="receiving">Receiving yards</option>
                <option value="passing">Passing yards</option>
              </select>
            </label>
          </div>
          <p className="muted">
            Scrimmage yards combine rushing + receiving. Passing yards are
            separate to avoid double counting. Missing jersey numbers are not
            assigned to a player.
          </p>
          {table(
            [
              "Team",
              "#",
              "Scrimmage",
              "Rushing",
              "Receiving",
              "Passing",
              "Carries",
              "Catches / targets",
              "Comp / att",
              "INT thrown",
            ],
            [...s.players]
              .sort((a, b) => b[playerSort] - a[playerSort])
              .map((p) => [
                teamName(p.team),
                p.jersey,
                p.scrimmage,
                p.rushing,
                p.receiving,
                p.passing,
                p.carries,
                `${p.catches}/${p.targets}`,
                `${p.completions}/${p.attempts}`,
                p.interceptions_thrown,
              ]),
          )}
        </section>
      )}
    </>
  );
}
