import type { AppAccount, AppProfile } from "@prisma/client";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { AccountCreateForm } from "@/components/AccountCreateForm";
import { ProfileCreateForm } from "@/components/ProfileCreateForm";
import { prisma } from "@/lib/prisma";

export const dynamic = "force-dynamic";

type AccountWithProfiles = AppAccount & { profiles: AppProfile[] };

export default async function AccountPage() {
  const session = await auth();
  if (!session?.user?.id) {
    redirect("/login?callbackUrl=/account");
  }

  const userId = session.user.id;

  let accounts: AccountWithProfiles[] = [];
  let loadError: string | null = null;

  try {
    accounts = await prisma.appAccount.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      include: {
        profiles: { orderBy: { createdAt: "desc" } },
      },
    });
  } catch {
    loadError =
      "Could not load accounts. Set DATABASE_URL, run the SQL migration (see README), and ensure Postgres is running (e.g. docker-compose up -d).";
  }

  const hasAccount = accounts.length > 0;

  const accountOptions = accounts.map((a) => ({
    id: a.id,
    displayName: a.displayName,
    handle: a.handle,
  }));

  return (
    <div className="account-page">
      <header className="account-header">
        <h1 className="account-page-title">Account</h1>
        <p className="account-page-subtitle">
          You can have one account per sign-in. Add multiple profiles (display name, handle, optional bio) under it.
        </p>
      </header>

      <div className="account-layout account-layout-forms">
        <AccountCreateForm hasAccount={hasAccount} />
        <ProfileCreateForm accounts={accountOptions} />
      </div>

      <section className="account-card account-wide-card" aria-labelledby="list-heading">
        <h2 id="list-heading" className="account-card-title">
          Your account &amp; profiles
        </h2>
        {loadError ? (
          <p className="account-list-empty" role="alert">
            {loadError}
          </p>
        ) : !hasAccount ? (
          <p className="account-list-empty">No account yet. Create yours above.</p>
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
                  Account created {a.createdAt.toLocaleString()}
                </time>
                {a.profiles.length === 0 ? (
                  <p className="account-profile-empty">No profiles yet. Add one in “New profile”.</p>
                ) : (
                  <ul className="account-profile-list">
                    {a.profiles.map((p) => (
                      <li key={p.id} className="account-profile-item">
                        <div className="account-profile-main">
                          <span className="account-profile-name">{p.displayName}</span>
                          <span className="account-profile-handle">@{p.handle}</span>
                        </div>
                        {p.bio ? <p className="account-profile-bio">{p.bio}</p> : null}
                        <time className="account-profile-meta" dateTime={p.createdAt.toISOString()}>
                          Profile added {p.createdAt.toLocaleString()}
                        </time>
                      </li>
                    ))}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
