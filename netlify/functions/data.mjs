import { getDatabase } from "@netlify/database";

const db = getDatabase();
const categories = new Set(["Travel", "Meal", "Hotel", "Entertainment", "Other"]);
const currencies = new Set(["HKD", "RMB"]);

function json(body, status = 200) {
  return Response.json(body, {
    status,
    headers: {
      "Cache-Control": "no-store",
      "X-Content-Type-Options": "nosniff"
    }
  });
}

function text(value, max = 200) {
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function number(value, nullable = true) {
  if (value === "" || value === null || value === undefined) return nullable ? null : 0;
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || parsed < 0 || parsed > 100000000) throw new Error("Invalid amount");
  return Math.round(parsed * 100) / 100;
}

function date(value) {
  return /^\d{4}-\d{2}-\d{2}$/.test(value || "") ? value : "";
}

function id(value) {
  const cleaned = text(value, 80);
  if (!/^[A-Za-z0-9_-]+$/.test(cleaned)) throw new Error("Invalid record ID");
  return cleaned;
}

function unique(items) {
  return [...new Set(items)];
}

function cleanState(input) {
  if (!input || typeof input !== "object") throw new Error("Invalid data format");
  if (!Array.isArray(input.participants) || !Array.isArray(input.expenses) ||
      !Array.isArray(input.itinerary) || !Array.isArray(input.flights) || !Array.isArray(input.tasks)) {
    throw new Error("Missing data collection");
  }

  const participants = unique(input.participants.map((p) => text(p, 60)).filter(Boolean)).slice(0, 50);
  if (!participants.length) throw new Error("At least one participant is required");
  const participantSet = new Set(participants);
  const settings = {
    title: text(input.settings?.title, 100) || "Shanghai Trip Control",
    subtitle: text(input.settings?.subtitle, 160),
    fxRmbToHkd: number(input.settings?.fxRmbToHkd, false)
  };
  if (settings.fxRmbToHkd <= 0) throw new Error("Exchange rate must be greater than zero");

  const expenses = input.expenses.slice(0, 2000).map((item) => {
    const contributors = unique((Array.isArray(item.contributors) ? item.contributors : [])
      .map((p) => text(p, 60)).filter((p) => participantSet.has(p)));
    const splitMode = item.splitMode === "custom" ? "custom" : "equal";
    const customShares = {};
    if (splitMode === "custom") {
      for (const person of contributors) customShares[person] = number(item.customShares?.[person], false);
    }
    return {
      id: id(item.id),
      date: date(item.date),
      time: text(item.time, 50),
      type: categories.has(item.type) ? item.type : "Other",
      event: text(item.event, 500),
      location: text(item.location, 300),
      planned: number(item.planned),
      actual: number(item.actual),
      currency: currencies.has(item.currency) ? item.currency : "RMB",
      paidBy: participantSet.has(item.paidBy) ? item.paidBy : "",
      contributors,
      splitMode,
      customShares,
      notes: text(item.notes, 1000)
    };
  });

  const itinerary = input.itinerary.slice(0, 2000).map((item) => ({
    id: id(item.id), date: date(item.date), time: text(item.time, 50), event: text(item.event, 500),
    details: text(item.details, 500), remarks: text(item.remarks, 500)
  }));
  const flights = input.flights.slice(0, 500).map((item) => ({
    id: id(item.id), date: date(item.date), route: text(item.route, 300), departure: text(item.departure, 80),
    arrival: text(item.arrival, 80), comment: text(item.comment, 300)
  }));
  const tasks = input.tasks.slice(0, 1000).map((item) => ({
    id: id(item.id), text: text(item.text, 500), due: date(item.due), done: Boolean(item.done)
  }));

  return { settings, participants, expenses, itinerary, flights, tasks };
}

export default async (req) => {
  try {
    if (req.method === "GET") {
      const rows = await db.sql`SELECT data, revision, updated_at FROM trip_app_state WHERE id = 1`;
      const row = rows[0];
      return json({ data: row.data, revision: Number(row.revision), updatedAt: row.updated_at });
    }

    if (req.method === "PUT") {
      const length = Number(req.headers.get("content-length") || 0);
      if (length > 1500000) return json({ error: "Request is too large" }, 413);
      const body = await req.json();
      const expectedRevision = Number(body.expectedRevision);
      if (!Number.isInteger(expectedRevision) || expectedRevision < 1) {
        return json({ error: "Missing or invalid revision" }, 400);
      }
      const data = cleanState(body.data);
      const rows = await db.sql`
        UPDATE trip_app_state
        SET data = ${JSON.stringify(data)}::jsonb, revision = revision + 1, updated_at = NOW()
        WHERE id = 1 AND revision = ${expectedRevision}
        RETURNING data, revision, updated_at
      `;
      if (!rows.length) {
        const current = await db.sql`SELECT data, revision, updated_at FROM trip_app_state WHERE id = 1`;
        return json({
          error: "Another person saved changes first. The latest shared data has been loaded.",
          data: current[0].data,
          revision: Number(current[0].revision),
          updatedAt: current[0].updated_at
        }, 409);
      }
      return json({ data: rows[0].data, revision: Number(rows[0].revision), updatedAt: rows[0].updated_at });
    }
    return json({ error: "Method not allowed" }, 405);
  } catch (error) {
    console.error(error);
    return json({ error: error.message || "Database operation failed" }, 500);
  }
};

export const config = { path: "/api/data" };
