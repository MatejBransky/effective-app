import {
  ClientSettingsPayload,
  CoachClientRow,
  CoachingMe,
  DayView,
  ProgressReport,
  PushSubscriptionPayload,
  SlotView,
} from "@repo/entities";
import { Option, Schema } from "effect";
import { getAccessToken } from "../auth";

const BASE = import.meta.env["VITE_SERVER_URL"];

if (!BASE) {
  throw new Error("VITE_SERVER_URL must be set - see .env.example");
}

export class ApiError extends Error {
  constructor(
    readonly status: number,
    readonly body: string,
  ) {
    super(`coaching API ${status}: ${body.slice(0, 160)}`);
  }
}

/** HttpApi failure bodies encode the failure as `{ _tag, ... }` - this is that tag shape. */
const ApiErrorTagPayload = Schema.Struct({ _tag: Schema.String });

/** HttpApi encodes failures as `{ _tag, ... }` - surfaces the tag for UI copy. */
export const apiErrorTag = (error: ApiError): string | null => {
  let parsed: unknown;

  try {
    parsed = JSON.parse(error.body);
  } catch {
    // non-JSON body (e.g. a proxy error page) - no tag to surface
    return null;
  }

  return Option.getOrNull(Schema.decodeUnknownOption(ApiErrorTagPayload)(parsed))?._tag ?? null;
};

async function request<S extends Schema.ConstraintDecoder<unknown>>(
  path: string,
  schema: S,
  init?: RequestInit,
): Promise<S["Type"]> {
  const token = await getAccessToken();

  if (!token) throw new ApiError(401, '{"_tag":"InvalidToken"}');

  const response = await fetch(`${BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
      ...init?.headers,
    },
  });

  if (!response.ok) throw new ApiError(response.status, await response.text());
  const text = await response.text();
  const json: unknown = text ? JSON.parse(text) : null;

  return Schema.decodeUnknownPromise(schema)(json);
}

const OkResponse = Schema.Struct({ ok: Schema.Literal(true) });

export const getMe = (): Promise<CoachingMe> => request("/coaching/me", CoachingMe);

export const putSettings = (payload: ClientSettingsPayload): Promise<CoachingMe> =>
  request("/coaching/settings", CoachingMe, { method: "PUT", body: JSON.stringify(payload) });

export const getToday = (): Promise<DayView> => request("/coaching/today", DayView);

export const getDay = (date: string): Promise<DayView> =>
  request(`/coaching/day?date=${encodeURIComponent(date)}`, DayView);

export const postProgress = (report: ProgressReport): Promise<{ ok: true }> =>
  request("/coaching/progress", OkResponse, { method: "POST", body: JSON.stringify(report) });

export const postSubmit = (programDate: string, slot: string): Promise<SlotView> =>
  request("/coaching/submit", SlotView, {
    method: "POST",
    body: JSON.stringify({ programDate, slot }),
  });

export const getCoachClients = (): Promise<ReadonlyArray<CoachClientRow>> =>
  request("/coaching/coach/clients", Schema.Array(CoachClientRow));

export const getCoachClientDay = (userId: string, date: string): Promise<DayView> =>
  request(
    `/coaching/coach/clients/${encodeURIComponent(userId)}/day?date=${encodeURIComponent(date)}`,
    DayView,
  );

export const postPushSubscribe = (payload: PushSubscriptionPayload): Promise<{ ok: true }> =>
  request("/coaching/push/subscriptions", OkResponse, {
    method: "POST",
    body: JSON.stringify(payload),
  });

export const postPushCheckDue = (): Promise<{ sent: number }> =>
  request("/coaching/push/check-due", Schema.Struct({ sent: Schema.Number }), { method: "POST" });

/**
 * `<audio>` cannot send an Authorization header, so audio is fetched with the
 * bearer token and played from an object URL. Callers must
 * `URL.revokeObjectURL` on unmount.
 */
export const fetchAudioObjectUrl = async (audioKey: string, date: string): Promise<string> => {
  const token = await getAccessToken();

  if (!token) throw new ApiError(401, '{"_tag":"InvalidToken"}');

  const response = await fetch(
    `${BASE}/coaching/audio/${encodeURIComponent(audioKey)}?date=${encodeURIComponent(date)}`,
    { headers: { Authorization: `Bearer ${token}` } },
  );

  if (!response.ok) throw new ApiError(response.status, await response.text());

  return URL.createObjectURL(await response.blob());
};
