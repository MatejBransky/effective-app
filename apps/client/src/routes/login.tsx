import { createFileRoute } from "@tanstack/react-router";
import { useEffect } from "react";
import { login } from "../lib/auth";

export const Route = createFileRoute("/login")({
  component: LoginPage,
});

function LoginPage() {
  useEffect(() => {
    void login();
  }, []);
  return <p>Redirecting to sign in…</p>;
}
