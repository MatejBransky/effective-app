import { createFileRoute } from "@tanstack/react-router";

export const Route = createFileRoute("/_authenticated/about")({
  component: AboutPage,
});

function AboutPage() {
  return (
    <>
      <h1>About</h1>
      <p>
        This app runs entirely local-first: reads and writes go straight to an in-browser SQLite
        database, and PowerSync syncs it with the server in the background - see the status bar
        above, which stays mounted here unchanged from the home page.
      </p>
    </>
  );
}
