import Link from "next/link";

export function AppNav() {
  return (
    <nav className="app-nav" aria-label="Primary">
      <Link href="/" className="app-nav-brand">
        Chat
      </Link>
      <div className="app-nav-links">
        <Link href="/profiles" className="app-nav-link">
          Profiles
        </Link>
      </div>
    </nav>
  );
}
