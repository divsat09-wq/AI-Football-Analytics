import { useEffect, useState } from "react";
import { api, json } from "./api";
import FilmReview from "./FilmReview";
import Stats from "./Stats";
const tabs = [
  ["overview", "Overview"],
  ["film", "Film Review"],
  ["formations", "Formations"],
  ["plays", "Play Library"],
  ["tendencies", "Tendencies"],
  ["players", "Player Stats"],
];
const emptyGame = {
  title: "",
  home: "Team White",
  away: "Opponent",
  home_color: "#ffffff",
  away_color: "#f5cc38",
};
export default function App() {
  const [games, setGames] = useState([]),
    [game, setGame] = useState(null),
    [tab, setTab] = useState("overview");
  const [team, setTeam] = useState("all"),
    [stats, setStats] = useState(null),
    [error, setError] = useState("");
  const [busy, setBusy] = useState(""),
    [editing, setEditing] = useState(false),
    [draft, setDraft] = useState(emptyGame);
  const [dirty, setDirty] = useState(false);
  async function list() {
    setGames(await api("/api/games"));
  }
  useEffect(() => {
    list().catch((e) => setError(e.message));
  }, []);
  useEffect(() => {
    if (!game) {
      setStats(null);
      return;
    }
    let active = true;
    api(`/api/games/${game.id}/stats?team=${team}`)
      .then((s) => {
        if (active) setStats(s);
      })
      .catch((e) => {
        if (active) setError(e.message);
      });
    return () => {
      active = false;
    };
  }, [game, team]);
  function allowLeave() {
    return !dirty || window.confirm("Discard unsaved clip changes?");
  }
  async function select(id) {
    if (!allowLeave()) return;
    setBusy("Opening game…");
    setError("");
    try {
      setGame(await api(`/api/games/${id}`));
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function saveGame(e) {
    e.preventDefault();
    setBusy("Saving game…");
    setError("");
    try {
      const saved = await api(
        editing === "edit" ? `/api/games/${game.id}` : "/api/games",
        json(editing === "edit" ? "PUT" : "POST", draft),
      );
      await list();
      setGame(await api(`/api/games/${saved.id}`));
      setEditing(false);
      setDirty(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  async function upload(files) {
    if (!files.length || !game || !allowLeave()) return;
    setError("");
    setDirty(false);
    const sorted = [...files].sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true }),
    );
    const failures = [];
    try {
      for (let i = 0; i < sorted.length; i++) {
        setBusy(
          `Uploading and converting ${i + 1}/${sorted.length}: ${sorted[i].name}`,
        );
        const form = new FormData();
        form.append("file", sorted[i]);
        try {
          await api(`/api/games/${game.id}/clips`, {
            method: "POST",
            body: form,
          });
        } catch (e) {
          failures.push(`${sorted[i].name}: ${e.message}`);
        }
      }
      setGame(await api(`/api/games/${game.id}`));
      setTab("film");
      if (failures.length) setError(failures.join("\n"));
    } catch (e) {
      setError(e.message);
    } finally {
      setBusy("");
    }
  }
  function replaceClip(clip) {
    setGame((g) => ({
      ...g,
      clips: g.clips.map((c) => (c.id === clip.id ? clip : c)),
    }));
  }
  return (
    <div className="shell">
      <aside>
        <div className="brand">
          <span className="eyebrow">THE FILM ROOM</span>
          <h1>
            GRIDIRON<span> /</span>
          </h1>
          <small>CHART · REVIEW · IMPROVE</small>
        </div>
        <div className="side-game">
          <span className="eyebrow">CURRENT GAME</span>
          <p>{game?.title || "Your next game starts here"}</p>
          <span className="pill">MANUAL CHARTING</span>
          {game && (
            <p>
              <span
                className="team-swatch"
                style={{ background: game.home_color }}
              />
              {game.home}
              <br />
              <span
                className="team-swatch"
                style={{ background: game.away_color }}
              />
              {game.away}
            </p>
          )}
        </div>
        <nav>
          {tabs.map(([id, label], i) => (
            <button
              className={tab === id ? "active" : ""}
              key={id}
              onClick={() => {
                if (tab === id || allowLeave()) {
                  setTab(id);
                  setDirty(false);
                }
              }}
            >
              <span>0{i + 1}</span>
              {label}
            </button>
          ))}
        </nav>
        <footer>
          <span className="dot" /> Local workspace
          <p>Your film. Your observations.</p>
        </footer>
      </aside>
      <main>
        <header className="toolbar">
          <label>
            Game
            <select
              aria-label="Select game"
              value={game?.id || ""}
              disabled={!!busy}
              onChange={(e) => select(e.target.value)}
            >
              <option value="" disabled>
                Select a game
              </option>
              {games.map((g) => (
                <option key={g.id} value={g.id}>
                  {g.title}
                </option>
              ))}
            </select>
          </label>
          <button
            disabled={!!busy}
            onClick={() => {
              if (allowLeave()) {
                setDraft(emptyGame);
                setEditing("new");
              }
            }}
          >
            + New game
          </button>
          {game && (
            <>
              <button
                disabled={!!busy}
                onClick={() => {
                  setDraft(game);
                  setEditing("edit");
                }}
              >
                Edit teams
              </button>
              <label>
                View offense
                <select value={team} onChange={(e) => setTeam(e.target.value)}>
                  <option value="all">Both teams</option>
                  <option value="home">{game.home}</option>
                  <option value="away">{game.away}</option>
                </select>
              </label>
              <label className="button primary">
                + Upload clips
                <input
                  aria-label="Upload clips"
                  type="file"
                  multiple
                  accept="video/*,.mkv,.avi"
                  disabled={!!busy}
                  onChange={(e) => {
                    upload(e.target.files);
                    e.target.value = "";
                  }}
                />
              </label>
            </>
          )}
        </header>
        {error && (
          <div className="banner error" role="alert">
            {error}
            <button onClick={() => setError("")}>Dismiss</button>
          </div>
        )}
        {busy && (
          <div className="banner" role="status">
            {busy}
          </div>
        )}
        {editing && (
          <form className="panel game-form" onSubmit={saveGame}>
            <h2>
              {editing === "edit" ? "Edit game & teams" : "Create a game"}
            </h2>
            <div className="form-grid">
              {[
                ["title", "Game title"],
                ["home", "Home / team one"],
                ["away", "Away / team two"],
              ].map(([key, label]) => (
                <label key={key}>
                  {label}
                  <input
                    required
                    maxLength={key === "title" ? 120 : 80}
                    value={draft[key]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key]: e.target.value })
                    }
                  />
                </label>
              ))}
              {["home", "away"].map((key) => (
                <label key={key}>
                  {key === "home" ? "Home" : "Away"} jersey color
                  <input
                    type="color"
                    value={draft[key + "_color"]}
                    onChange={(e) =>
                      setDraft({ ...draft, [key + "_color"]: e.target.value })
                    }
                  />
                </label>
              ))}
            </div>
            <div className="actions">
              <button className="primary" disabled={!!busy}>
                Save game
              </button>
              <button type="button" onClick={() => setEditing(false)}>
                Cancel
              </button>
            </div>
          </form>
        )}
        <div className="content">
          <div className="page-heading">
            <div>
              <span className="eyebrow">
                WORKSPACE / {tabs.find((t) => t[0] === tab)[1].toUpperCase()}
              </span>
              <h2>{tabs.find((t) => t[0] === tab)[1]}</h2>
              <p>
                {tab === "film"
                  ? "Watch the play. Record what happened. Build the bigger picture."
                  : "Real observations, organized into a clearer game plan."}
              </p>
            </div>
            {game && (
              <div className="export">
                <a href={`/api/games/${game.id}/export?format=csv`}>
                  Export CSV ↗
                </a>
                <a href={`/api/games/${game.id}/export`}>Export JSON ↗</a>
              </div>
            )}
          </div>
          {!game ? (
            <section className="panel empty">
              <span className="field-icon">22</span>
              <h2>Start with the film.</h2>
              <p>
                Create a game, name both teams, then upload your consecutive
                clips.
              </p>
              <button
                className="primary"
                onClick={() => {
                  setDraft(emptyGame);
                  setEditing("new");
                }}
              >
                Create your first game
              </button>
              <p>
                No API key. No automatic football analysis. You control the
                data.
              </p>
            </section>
          ) : tab === "film" ? (
            <FilmReview
              key={game.id}
              game={game}
              onClip={replaceClip}
              onDirty={setDirty}
              disabled={!!busy}
            />
          ) : (
            <Stats
              tab={tab}
              stats={stats}
              game={game}
              team={team}
              onFilm={() => setTab("film")}
            />
          )}
        </div>
      </main>
    </div>
  );
}
