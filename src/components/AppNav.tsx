import Link from "next/link";
import { NavAuth } from "@/components/NavAuth";
import { isFacebookAuthEnabled } from "@/lib/authProviders";

export function AppNav() {
  const facebookEnabled = isFacebookAuthEnabled();

  return (
    <nav className="app-nav" aria-label="Primary">
      <Link href="/" className="app-nav-brand">
        Chat
      </Link>
      <div className="app-nav-right">
        <div className="app-nav-links">
          <Link href="/profiles" className="app-nav-link">
            Profiles
          </Link>
        </div>
        <NavAuth facebookEnabled={facebookEnabled} />
      </div>
    </nav>
  );
}
