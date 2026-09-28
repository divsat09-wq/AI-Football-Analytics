export async function api(path, options = {}) {
  let response;
  try {
    response = await fetch(path, options);
  } catch {
    throw new Error(
      "Cannot reach the backend. Start it on port 8000, then retry.",
    );
  }
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    const detail = Array.isArray(data.detail)
      ? data.detail.map((e) => e.msg).join(" · ")
      : data.detail;
    throw new Error(
      detail ||
        `Request failed (${response.status}). Check the backend terminal.`,
    );
  }
  return response.json();
}
export function json(method, body) {
  return {
    method,
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  };
}
export const percent = (value) => (value == null ? "—" : `${value}%`);
