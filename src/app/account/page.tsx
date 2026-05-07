import { AccountCreateForm } from "@/components/AccountCreateForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

export default async function AccountPage() {
  let accounts: Awaited<ReturnType<typeof prisma.appAccount.findMany>> = [];
  let loadError: string | null = null;

  try {
    accounts = await prisma.appAccount.findMany({
      orderBy: { createdAt: "desc" },
    });
  } catch {
    loadError =
      "Could not load accounts. Set DATABASE_URL, run the SQL migration (see README), and ensure Postgres is running (e.g. docker-compose up -d).";
  }

  return (
    <div className="account-page">
      <header className="account-header">
        <h1 className="account-page-title">Account</h1>
        <p className="account-page-subtitle">
          Create display records (name, handle, bio) and persist them in Postgres.
        </p>
      </header>

      <div className="account-layout">
        <AccountCreateForm />

        <section className="account-card" aria-labelledby="list-heading">
          <h2 id="list-heading" className="account-card-title">
            Saved accounts
          </h2>
          {loadError ? (
            <p className="account-list-empty" role="alert">
              {loadError}
            </p>
          ) : accounts.length === 0 ? (
            <p className="account-list-empty">No accounts yet. Create one on the left.</p>
          ) : (
            <ul className="account-list">
              {accounts.map((a) => (
                <li key={a.id} className="account-list-item">
                  <div className="account-list-main">
                    <span className="account-list-name">{a.displayName}</span>
                    <span className="account-list-handle">@{a.handle}</span>
                  </div>
                  {a.bio ? <p className="account-list-bio">{a.bio}</p> : null}
                  <time className="account-list-meta" dateTime={a.createdAt.toISOString()}>
                    Added {a.createdAt.toLocaleString()}
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
