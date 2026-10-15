import { useAtomSet, useAtomValue } from "@effect/atom-react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { DateTime, Effect, Option } from "effect";
import { useState } from "react";
import { computeUnlocks, formatWallTime, programDateOf } from "@repo/entities";
import { localeAtom } from "../lib/coaching/atoms.ts";
import * as api from "../lib/coaching/api.ts";
import { applyLocale } from "../lib/coaching/locale.ts";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/_authenticated/coaching/settings")({
  beforeLoad: async () => {
    const me = await api.getMe().catch(() => null);

    if (!me || me.role !== "client") throw redirect({ to: "/coach" });

    return { me };
  },
  component: SettingsPage,
});

const TIME_ZONES = ["Europe/Prague", "Europe/London", "UTC", "America/New_York", "Asia/Tokyo"];

const pad2 = (n: number): string => String(n).padStart(2, "0");

/** Client-side preview of derived recharge times (server stays authoritative). */
const previewRecharges = (
  focusHour: number,
  focusMinute: number,
  timeZone: string,
): { readonly r1: string; readonly r2: string } | null => {
  try {
    const now = Effect.runSync(DateTime.now);
    const today = Option.getOrUndefined(programDateOf(now, timeZone));

    if (!today) return null;

    const unlocks = Option.getOrUndefined(
      computeUnlocks({ focusHour, focusMinute, timeZone }, today),
    );

    if (!unlocks) return null;

    const time = (utc: DateTime.Utc): string | undefined =>
      Option.getOrUndefined(formatWallTime(utc, timeZone));

    const r1 = time(unlocks.recharge1);
    const r2 = time(unlocks.recharge2);

    return r1 && r2 ? { r1, r2 } : null;
  } catch {
    return null;
  }
};

const urlBase64ToUint8Array = (base64: string): Uint8Array<ArrayBuffer> => {
  const padding = "=".repeat((4 - (base64.length % 4)) % 4);
  const raw = window.atob(base64.replace(/-/g, "+").replace(/_/g, "/") + padding);

  return new Uint8Array([...raw].map((char) => char.charCodeAt(0)));
};

function SettingsPage() {
  const { me } = Route.useRouteContext();
  useAtomValue(localeAtom);
  const setLocaleState = useAtomSet(localeAtom);

  return (
    <>
      <nav>
        <Link to="/coaching">{m.nav_day()}</Link> ·{" "}
        <Link to="/coaching/settings">{m.nav_settings()}</Link>
      </nav>
      <h2>{m.settings_title()}</h2>
      <SettingsForm
        key={me.profile?.userId ?? "new"}
        initial={me.profile}
        onSaved={(locale) => {
          setLocaleState(locale);
          applyLocale(locale);
        }}
      />
      <PushSettings />
    </>
  );
}

function SettingsForm(props: {
  readonly initial: {
    readonly firstName: string;
    readonly lastName: string;
    readonly bio: string | null;
    readonly focusHour: number;
    readonly focusMinute: number;
    readonly timeZone: string;
    readonly locale: "cs" | "en";
  } | null;
  readonly onSaved: (locale: "cs" | "en") => void;
}) {
  const [firstName, setFirstName] = useState(props.initial?.firstName ?? "");
  const [lastName, setLastName] = useState(props.initial?.lastName ?? "");
  const [bio, setBio] = useState(props.initial?.bio ?? "");

  const [focusTime, setFocusTime] = useState(
    `${pad2(props.initial?.focusHour ?? 6)}:${pad2(props.initial?.focusMinute ?? 0)}`,
  );

  const [timeZone, setTimeZone] = useState(props.initial?.timeZone ?? "Europe/Prague");
  const [locale, setLocale] = useState<"cs" | "en">(props.initial?.locale ?? "en");
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [focusHour, focusMinute] = focusTime.split(":").map(Number);

  const preview =
    focusHour !== undefined && focusMinute !== undefined
      ? previewRecharges(focusHour, focusMinute, timeZone)
      : null;

  const handleSave = (): void => {
    setSaving(true);
    setSaved(false);
    setError(null);
    void api
      .putSettings({
        firstName,
        lastName,
        bio: bio || null,
        focusHour: focusHour ?? 6,
        focusMinute: focusMinute ?? 0,
        timeZone,
        locale,
      })
      .then(() => {
        setSaved(true);
        props.onSaved(locale);
      })
      .catch((cause: unknown) =>
        setError(cause instanceof api.ApiError ? (api.apiErrorTag(cause) ?? "save") : "save"),
      )
      .finally(() => setSaving(false));
  };

  return (
    <form
      onSubmit={(event) => {
        event.preventDefault();
        handleSave();
      }}
    >
      <p>
        <label>
          {m.settings_firstName()}:{" "}
          <input value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
        </label>
      </p>
      <p>
        <label>
          {m.settings_lastName()}:{" "}
          <input value={lastName} onChange={(e) => setLastName(e.target.value)} required />
        </label>
      </p>
      <p>
        <label>
          {m.settings_bio()}: <input value={bio} onChange={(e) => setBio(e.target.value)} />
        </label>
      </p>
      <p>
        <label>
          {m.settings_focusTime()}:{" "}
          <input
            type="time"
            value={focusTime}
            onChange={(e) => setFocusTime(e.target.value)}
            required
          />
        </label>{" "}
        <label>
          <select value={timeZone} onChange={(e) => setTimeZone(e.target.value)}>
            {TIME_ZONES.map((zone) => (
              <option key={zone} value={zone}>
                {zone}
              </option>
            ))}
          </select>
        </label>
      </p>
      {preview && <p>{m.settings_preview({ r1: preview.r1, r2: preview.r2 })}</p>}
      <p>
        <label>
          {m.settings_locale()}:{" "}
          <select value={locale} onChange={(e) => setLocale(e.target.value === "cs" ? "cs" : "en")}>
            <option value="en">English</option>
            <option value="cs">Čeština</option>
          </select>
        </label>
      </p>
      <p>
        <button type="submit" disabled={saving}>
          {m.settings_save()}
        </button>{" "}
        {saved && <span>{m.settings_saved()}</span>}
      </p>
      {error && <p role="alert">{error}</p>}
    </form>
  );
}

function PushSettings() {
  const [status, setStatus] = useState<string>("unknown");
  const [working, setWorking] = useState(false);

  const subscribe = (): void => {
    setWorking(true);
    void (async () => {
      try {
        // Headless test browsers (see microsoft/playwright#23954) may never
        // resolve requestPermission or serviceWorker.ready - time out instead
        // of leaving the button disabled forever.
        const withTimeout = <T,>(promise: Promise<T>, label: string): Promise<T> =>
          Promise.race([
            promise,
            new Promise<never>((_, reject) =>
              window.setTimeout(() => reject(new Error(label)), 10_000),
            ),
          ]);

        const permission = await withTimeout(Notification.requestPermission(), "permission");

        if (permission !== "granted") {
          setStatus("denied");

          return;
        }

        const registration = await withTimeout(navigator.serviceWorker.ready, "worker");
        const key = import.meta.env["VITE_VAPID_PUBLIC_KEY"];

        if (!key) {
          setStatus("no-key");

          return;
        }

        const subscription = await withTimeout(
          registration.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(key),
          }),
          "subscribe",
        );

        const keys = subscription.toJSON().keys;

        if (!keys) {
          setStatus("no-keys");

          return;
        }

        await api.postPushSubscribe({
          endpoint: subscription.endpoint,
          p256dh: keys["p256dh"] ?? "",
          auth: keys["auth"] ?? "",
        });
        setStatus("on");
      } catch {
        setStatus("failed");
      } finally {
        setWorking(false);
      }
    })();
  };

  return (
    <p>
      <button type="button" onClick={subscribe} disabled={working}>
        {status === "on" ? m.day_notificationsOn() : m.day_notificationsOff()}
      </button>{" "}
      <span>({status})</span>
    </p>
  );
}
