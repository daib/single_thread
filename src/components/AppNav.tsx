import Link from "next/link";
import { NavAuth } from "@/components/NavAuth";

export function AppNav() {
  return (
    <nav className="app-nav" aria-label="Primary">
      <Link href="/" className="app-nav-brand">
        Chat
      </Link>
      <div className="app-nav-right">
        <NavAuth />
      </div>
    </nav>
  );
}
