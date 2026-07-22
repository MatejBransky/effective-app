import { createFileRoute } from "@tanstack/react-router";

export interface MeResponse {
  readonly subject: string;
}

export const Route = createFileRoute("/_authenticated/")({
  loader: async ({ context }) => {
    const response = await fetch(`${import.meta.env.VITE_SERVER_URL}/me`, {
      headers: { Authorization: `Bearer ${context.auth.user?.access_token}` },
    });
    if (!response.ok) {
      throw new Error(`GET /me failed: ${response.status}`);
    }
    return (await response.json()) as MeResponse;
  },
  component: HomePage,
});

function HomePage() {
  const { subject } = Route.useLoaderData();
  const { auth } = Route.useRouteContext();
  return (
    <div>
      <p>Logged in as: {subject}</p>
      <button type="button" onClick={() => auth.logout()}>
        Log out
      </button>
    </div>
  );
}
