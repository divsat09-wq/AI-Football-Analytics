import { useEffect, useRef, useState } from "react";
import { api, json } from "./api";
export default function FilmReview({ game, onClip, onDirty, disabled }) {
  const [selected, setSelected] = useState(game.clips[0]?.id || ""),
    [dirty, setDirty] = useState(false);
  const clip = game.clips.find((c) => c.id === selected) || game.clips[0];
  const index = game.clips.findIndex((c) => c.id === clip?.id);
  const markDirty = (value) => {
    setDirty(value);
    onDirty(value);
  };
  function choose(id) {
    if (id === clip?.id) return;
    if (!dirty || window.confirm("Discard unsaved changes to this clip?")) {
      markDirty(false);
      setSelected(id);
    }
  }
  if (!clip)
    return (
      <section className="panel empty">
        <h3>No clips yet</h3>
        <p>
          Use Upload clips to select multiple videos. Files are added in natural
          filename order, so clip 2 comes before clip 10.
        </p>
      </section>
    );
  return (
    <div className="film-layout">
      <section className="panel clip-list">
        <div className="section-head">
          <h3>Game clips</h3>
          <span className="pill">{game.clips.length}</span>
        </div>
        {game.clips.map((c) => (
          <button
            key={c.id}
            disabled={disabled}
            className={c.id === clip.id ? "selected" : ""}
            onClick={() => choose(c.id)}
          >
            <span className="clip-index">
              {String(c.position).padStart(2, "0")}
            </span>
            <span>
              <strong>{c.name}</strong>
              <small>
                {c.annotation.reviewed
                  ? `${game[c.annotation.offense]} · ${c.annotation.play_name} · ${c.annotation.yards} yd`
                  : "Not charted"}
              </small>
            </span>
            <span className={c.annotation.reviewed ? "accent" : ""}>
              {c.annotation.reviewed ? "✓" : "○"}
            </span>
          </button>
        ))}
      </section>
      <div>
        <div className="section-head clip-heading">
          <h3>{clip.name}</h3>
          <div className="actions">
            <button
              disabled={disabled || index === 0}
              onClick={() => choose(game.clips[index - 1].id)}
            >
              ← Previous
            </button>
            <button
              disabled={disabled || index === game.clips.length - 1}
              onClick={() => choose(game.clips[index + 1].id)}
            >
              Next →
            </button>
          </div>
        </div>
        <Editor
          key={clip.id}
          clip={clip}
          game={game}
          onClip={onClip}
          markDirty={markDirty}
          disabled={disabled}
        />
      </div>
    </div>
  );
}
function Editor({ clip, game, onClip, markDirty, disabled }) {
  const [draft, setDraft] = useState(clip.annotation),
    [saved, setSaved] = useState(clip.annotation),
    [message, setMessage] = useState(""),
    [error, setError] = useState(""),
    [saving, setSaving] = useState(false);
  const [tracks, setTracks] = useState(null),
    [draw, setDraw] = useState(false),
    [roi, setRoi] = useState([]),
    [maximum, setMaximum] = useState(22),
    [confidence, setConfidence] = useState(0.4),
    [show, setShow] = useState(true);
  const [overlay, setOverlay] = useState([]),
    [starting, setStarting] = useState(false);
  const video = useRef(null);
  const dirty = JSON.stringify(draft) !== JSON.stringify(saved);
  const job = clip.tracking;
  useEffect(() => {
    markDirty(dirty);
  }, [dirty]);
  useEffect(() => {
    const handler = (e) => {
      if (dirty) {
        e.preventDefault();
        e.returnValue = "";
      }
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);
  useEffect(() => {
    if (!["queued", "running"].includes(job.status)) return;
    const timer = setInterval(
      () =>
        api(`/api/clips/${clip.id}`)
          .then(onClip)
          .catch((e) => setError(e.message)),
      1800,
    );
    return () => clearInterval(timer);
  }, [clip.id, job.status]);
  useEffect(() => {
    setTracks(null);
    let active = true;
    if (job.result_url)
      api(job.result_url)
        .then((data) => {
          if (active) setTracks(data);
        })
        .catch((e) => {
          if (active) setError(e.message);
        });
    return () => {
      active = false;
    };
  }, [job.result_url]);
  useEffect(() => {
    let request;
    const tick = () => {
      if (video.current && tracks?.frames?.length) {
        // Binary search handles seeking and arbitrary source frame rates.
        const t = video.current.currentTime;
        let lo = 0,
          hi = tracks.frames.length - 1;
        while (lo < hi) {
          const mid = Math.ceil((lo + hi) / 2);
          if (tracks.frames[mid].time <= t) lo = mid;
          else hi = mid - 1;
        }
        setOverlay(tracks.frames[lo].boxes);
      } else setOverlay([]);
      request = requestAnimationFrame(tick);
    };
    request = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(request);
  }, [tracks]);
  function update(key, value) {
    setDraft((d) => ({ ...d, [key]: value }));
    setMessage("");
  }
  async function save(reviewed) {
    setSaving(true);
    setError("");
    try {
      const c = await api(
        `/api/clips/${clip.id}/annotation`,
        json("PUT", { ...draft, reviewed }),
      );
      setDraft(c.annotation);
      setSaved(c.annotation);
      onClip(c);
      markDirty(false);
      setMessage(
        reviewed
          ? "Saved and included in statistics."
          : "Draft saved. Excluded from statistics.",
      );
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  }
  async function track() {
    setStarting(true);
    setError("");
    try {
      await api(
        `/api/clips/${clip.id}/tracking`,
        json("POST", {
          max_players: Number(maximum),
          confidence: Number(confidence),
          roi,
        }),
      );
      onClip(await api(`/api/clips/${clip.id}`));
      setDraw(false);
    } catch (e) {
      setError(e.message);
    } finally {
      setStarting(false);
    }
  }
  function field(label, key, opts = {}) {
    return (
      <label key={key}>
        {label}
        <input
          type={opts.type || "text"}
          value={draft[key] ?? ""}
          min={opts.min}
          max={opts.max}
          step={opts.step || "any"}
          maxLength={opts.jersey ? 2 : 100}
          inputMode={opts.jersey ? "numeric" : undefined}
          onChange={(e) => {
            const value = e.target.value;
            if (opts.jersey && !/^\d{0,2}$/.test(value)) return;
            update(
              key,
              opts.type === "number"
                ? value === ""
                  ? null
                  : Number(value)
                : value,
            );
          }}
        />
      </label>
    );
  }
  const busyTrack = starting || ["running", "queued"].includes(job.status);
  return (
    <>
      <div className="video-stage">
        <video
          ref={video}
          src={clip.video_url}
          controls
          playsInline
          preload="metadata"
          onError={() =>
            setError(
              "Video playback failed. Check the backend is running or re-export this clip as MP4.",
            )
          }
        />
        <svg
          className={`overlay ${draw ? "drawing" : ""}`}
          viewBox="0 0 1000 1000"
          preserveAspectRatio="none"
          onClick={(e) => {
            if (!draw || roi.length >= 12) return;
            const b = e.currentTarget.getBoundingClientRect();
            setRoi([
              ...roi,
              [(e.clientX - b.left) / b.width, (e.clientY - b.top) / b.height],
            ]);
          }}
        >
          {show &&
            !draw &&
            overlay.map(({ id, box: b }) => (
              <g key={id}>
                <rect
                  x={b[0] * 1000}
                  y={b[1] * 1000}
                  width={(b[2] - b[0]) * 1000}
                  height={(b[3] - b[1]) * 1000}
                />
                <text x={b[0] * 1000} y={Math.max(25, b[1] * 1000 - 8)}>
                  T{id}
                </text>
              </g>
            ))}
          {draw && (
            <>
              <polygon
                className="roi"
                points={roi
                  .map(([x, y]) => `${x * 1000},${y * 1000}`)
                  .join(" ")}
              />
              {roi.map(([x, y], i) => (
                <circle key={i} cx={x * 1000} cy={y * 1000} r="7" />
              ))}
            </>
          )}
        </svg>
      </div>
      <details className="panel tracking">
        <summary>
          Player tracking{" "}
          <span className="pill">OPTIONAL · {job.status.toUpperCase()}</span>
        </summary>
        <p className="muted">
          Visual IDs only, reset for every clip. Set the maximum to 2 for a
          two-player drill or 22 for a full play. Tracking never changes your
          football statistics.
        </p>
        <div className="form-grid">
          <label>
            Maximum IDs
            <input
              type="number"
              min="1"
              max="22"
              value={maximum}
              onChange={(e) => setMaximum(e.target.value)}
            />
          </label>
          <label>
            Detection confidence
            <input
              type="number"
              min="0.15"
              max="0.9"
              step="0.05"
              value={confidence}
              onChange={(e) => setConfidence(e.target.value)}
            />
          </label>
          <label className="check">
            <input
              type="checkbox"
              checked={show}
              onChange={(e) => setShow(e.target.checked)}
            />{" "}
            Show tracking boxes
          </label>
        </div>
        <p className="muted">
          Optional: mark the playing area on the first frame to reduce sideline
          detections. Click corners around the field in order (3–12 points).
          Officials inside the boundary can still be detected.
        </p>
        <div className="actions">
          <button
            disabled={busyTrack || disabled}
            onClick={() => {
              if (!draw) {
                video.current.pause();
                video.current.currentTime = 0;
              }
              setDraw(!draw);
            }}
          >
            {draw ? "Finish boundary" : "Draw field boundary"}
          </button>
          <button disabled={busyTrack} onClick={() => setRoi([])}>
            Clear boundary ({roi.length})
          </button>
          <button
            className="primary"
            disabled={busyTrack || disabled || draw}
            onClick={track}
          >
            {busyTrack ? "Tracking…" : "Run player tracking"}
          </button>
        </div>
        {draw && (
          <p className="accent">
            Click on the video picture to set boundary corners, then Finish
            boundary.
          </p>
        )}
        {busyTrack && (
          <>
            <progress max="1" value={job.progress || 0} />
            <p>
              {job.status === "queued"
                ? "Queued"
                : `${Math.round((job.progress || 0) * 100)}% processed`}{" "}
              — you can continue charting.
            </p>
          </>
        )}
        {job.status === "error" && <p className="error-text">{job.error}</p>}
        {job.status === "done" && (
          <>
            <p>
              {job.allocated_ids} IDs allocated · {job.peak_visible} peak
              visible · {job.suppressed_detections} unmatched detections
              suppressed.
            </p>
            <p className="muted">
              {job.note} A 22-ID limit does not prove that 22 distinct players
              were identified correctly.
            </p>
          </>
        )}
      </details>
      <form
        className="panel annotation"
        onSubmit={(e) => {
          e.preventDefault();
          save(true);
        }}
      >
        <div className="section-head">
          <h3>Chart this play</h3>
          <span className="pill">
            {dirty ? "UNSAVED" : saved.reviewed ? "CHARTED" : "DRAFT"}
          </span>
        </div>
        <fieldset disabled={saving || disabled}>
          <div className="form-grid">
            <label>
              Offense
              <select
                value={draft.offense}
                onChange={(e) => update("offense", e.target.value)}
              >
                <option value="home">{game.home}</option>
                <option value="away">{game.away}</option>
              </select>
            </label>
            <label>
              Defense
              <input
                readOnly
                value={draft.offense === "home" ? game.away : game.home}
              />
            </label>
            {field("Quarter / OT period", "quarter", {
              type: "number",
              min: 1,
              max: 10,
              step: 1,
            })}
            {field("Down (optional)", "down", {
              type: "number",
              min: 1,
              max: 4,
              step: 1,
            })}
            {field("Distance (optional)", "distance", {
              type: "number",
              min: 0,
              max: 100,
            })}
            <label>
              Play type
              <select
                value={draft.play_type}
                onChange={(e) =>
                  setDraft({
                    ...draft,
                    play_type: e.target.value,
                    pass_result: null,
                    manual_success: null,
                    passer: "",
                    receiver: "",
                    carrier: "",
                  })
                }
              >
                {[
                  ["run", "Run"],
                  ["pass", "Pass"],
                  ["punt", "Punt"],
                  ["kickoff", "Kickoff"],
                  ["field_goal", "Field goal"],
                  ["extra_point", "Extra point"],
                  ["other", "Other"],
                ].map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </label>
            {field("Formation", "formation")}
            {field("Play name / concept", "play_name")}
            {field("Yards gained / lost", "yards", {
              type: "number",
              min: -100,
              max: 100,
            })}
            {draft.play_type === "pass" ? (
              <>
                <label>
                  Pass result
                  <select
                    value={draft.pass_result || ""}
                    onChange={(e) =>
                      setDraft({
                        ...draft,
                        pass_result: e.target.value || null,
                        yards: e.target.value === "complete" ? draft.yards : 0,
                      })
                    }
                  >
                    <option value="">Select result</option>
                    <option value="complete">Complete</option>
                    <option value="incomplete">Incomplete</option>
                    <option value="interception">Intercepted</option>
                  </select>
                </label>
                {field("Passer #", "passer", { jersey: true })}
                {field("Receiver / intended receiver #", "receiver", {
                  jersey: true,
                })}
              </>
            ) : (
              field(
                draft.play_type === "run"
                  ? "Ball carrier #"
                  : "Acting player #",
                "carrier",
                { jersey: true },
              )
            )}
            <label>
              Fumble
              <select
                value={draft.fumble}
                onChange={(e) => update("fumble", e.target.value)}
              >
                <option value="none">No fumble</option>
                <option value="retained">Fumbled — offense recovered</option>
                <option value="lost">Fumbled — possession lost</option>
              </select>
            </label>
            {field("Defensive player involved # (optional)", "defender", {
              jersey: true,
            })}
            {draft.play_type !== "pass" && draft.fumble !== "lost" && (
              <label>
                Did this play work?
                <select
                  value={
                    draft.manual_success === null
                      ? ""
                      : String(draft.manual_success)
                  }
                  onChange={(e) =>
                    update(
                      "manual_success",
                      e.target.value === "" ? null : e.target.value === "true",
                    )
                  }
                >
                  <option value="">Select success</option>
                  <option value="true">Successful</option>
                  <option value="false">Unsuccessful</option>
                </select>
              </label>
            )}
            <label className="check">
              <input
                type="checkbox"
                checked={draft.touchdown}
                onChange={(e) => update("touchdown", e.target.checked)}
              />{" "}
              Offensive touchdown
            </label>
          </div>
          <label className="notes">
            Notes
            <textarea
              rows="3"
              maxLength="3000"
              value={draft.notes}
              onChange={(e) => update("notes", e.target.value)}
              placeholder="Penalties, return yards, recovery details, or anything to revisit…"
            />
          </label>
          <p className="muted">
            Complete pass = successful. Incomplete, interception, or lost fumble
            = unsuccessful. Enter 0 offensive yards for incomplete/intercepted
            passes; record return details in notes. For punts/kicks, yardage is
            kick distance and is excluded from offensive totals.
          </p>
          <div className="actions">
            <button type="submit" className="primary">
              {saving ? "Saving…" : "Save & mark charted"}
            </button>
            <button type="button" onClick={() => save(false)}>
              Save as draft
            </button>
          </div>
        </fieldset>
        {error && (
          <p className="error-text" role="alert">
            {error}
          </p>
        )}
        {message && (
          <p className="accent" role="status">
            {message}
          </p>
        )}
      </form>
    </>
  );
}
