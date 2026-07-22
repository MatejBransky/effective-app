import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  const { auth } = Route.useRouteContext();
  return (
    <button type="button" onClick={() => auth.login()}>
      Log in with Keycloak
    </button>
  );
}
