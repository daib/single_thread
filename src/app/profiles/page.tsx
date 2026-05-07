import { ProfileCreateForm } from "@/components/ProfileCreateForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function ProfilesPage() {
  let profiles: Awaited<ReturnType<typeof prisma.profile.findMany>> = [];
  let loadError: string | null = null;

  try {
    profiles = await prisma.profile.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    loadError =
      "Could not load profiles. Set DATABASE_URL, run the SQL migration (see README), and ensure Postgres is running (e.g. docker compose up -d).";
  }

  return (
    <div className="profiles-page">
      <header className="profiles-header">
        <h1 className="profiles-page-title">Profiles</h1>
        <p className="profiles-page-subtitle">
          Create people (or personas) and persist them in Postgres.
        </p>
      </header>

      <div className="profiles-layout">
        <ProfileCreateForm />

        <section className="profiles-card" aria-labelledby="list-heading">
          <h2 id="list-heading" className="profiles-card-title">
            Saved profiles
          </h2>
          {loadError ? (
            <p className="profiles-list-empty" role="alert">
              {loadError}
            </p>
          ) : profiles.length === 0 ? (
            <p className="profiles-list-empty">No profiles yet. Create one on the left.</p>
          ) : (
            <ul className="profiles-list">
              {profiles.map((p) => (
                <li key={p.id} className="profiles-list-item">
                  <div className="profiles-list-main">
                    <span className="profiles-list-name">{p.displayName}</span>
                    <span className="profiles-list-handle">@{p.handle}</span>
                  </div>
                  {p.bio ? <p className="profiles-list-bio">{p.bio}</p> : null}
                  <time className="profiles-list-meta" dateTime={p.createdAt.toISOString()}>
                    Added {p.createdAt.toLocaleString()}
                  </time>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </div>
  );
}
