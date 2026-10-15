import { useAtomRefresh, useAtomValue } from "@effect/atom-react";
import { Link, createFileRoute, redirect } from "@tanstack/react-router";
import { AsyncResult } from "effect/reactivity";
import { useEffect } from "react";
import { coachClientsAtom, localeAtom } from "../lib/coaching/atoms.ts";
import * as api from "../lib/coaching/api.ts";
import { m } from "../paraglide/messages.js";

export const Route = createFileRoute("/_authenticated/coach/")({
  beforeLoad: async () => {
    const me = await api.getMe().catch(() => null);

    if (!me || (me.role !== "coach" && me.role !== "admin")) throw redirect({ to: "/coaching" });

    return { me };
  },
  component: CoachDashboardPage,
});

function CoachDashboardPage() {
  const clientsState = useAtomValue(coachClientsAtom);
  const refresh = useAtomRefresh(coachClientsAtom);
  useAtomValue(localeAtom);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return (
    <>
      <nav>
        <Link to="/coach">{m.nav_coach()}</Link>
      </nav>
      <h2>{m.coach_title()}</h2>
      {AsyncResult.builder(clientsState)
        .onInitial(() => <p>Loading…</p>)
        .onFailure((cause) => <p role="alert">Failed to load: {String(cause)}</p>)
        .onSuccess((clients) =>
          clients.length === 0 ? (
            <p>{m.coach_noClients()}</p>
          ) : (
            <table>
              <thead>
                <tr>
                  <th>{m.coach_client()}</th>
                  <th>{m.coach_date()}</th>
                  <th>{m.slot_focus()}</th>
                  <th>{m.slot_recharge1()}</th>
                  <th>{m.slot_recharge2()}</th>
                </tr>
              </thead>
              <tbody>
                {clients.map((client) => (
                  <tr key={client.userId}>
                    <td>
                      <Link
                        to="/coach/$userId"
                        params={{ userId: client.userId }}
                        search={{ date: client.programDate }}
                      >
                        {client.firstName} {client.lastName}
                      </Link>
                    </td>
                    <td>{client.programDate}</td>
                    <td>{client.focus}</td>
                    <td>{client.recharge1}</td>
                    <td>{client.recharge2}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ),
        )
        .render()}
    </>
  );
}
