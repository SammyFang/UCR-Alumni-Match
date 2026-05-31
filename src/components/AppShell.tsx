import { signOut } from "firebase/auth";
import type { ReactNode } from "react";
import { auth } from "../lib/firebase";
import { navigate } from "../lib/router";
import type { AppUser } from "../types";
import { Button } from "./ui";

const SUPER_ADMIN_EMAIL = "yfang097@ucr.edu";

const navByRole = {
  student: [
    ["/student/dashboard", "Dashboard"],
    ["/student/profile", "Profile"],
    ["/student/alumni", "Alumni"],
    ["/student/bookings", "Bookings"],
    ["/student/etiquette", "Etiquette"],
  ],
  alumni: [
    ["/alumni/dashboard", "Dashboard"],
    ["/alumni/profile", "Profile"],
    ["/alumni/availability", "Availability"],
    ["/alumni/bookings", "Bookings"],
  ],
  admin: [
    ["/admin/dashboard", "Dashboard"],
    ["/admin/users", "Users"],
    ["/admin/bookings", "Bookings"],
    ["/admin/flagged", "Flagged"],
  ],
} as const;

export function AppShell({ user, path, children }: { user: AppUser; path: string; children: ReactNode }) {
  const nav =
    user.role === "admin" && user.email.toLowerCase() === SUPER_ADMIN_EMAIL
      ? [...navByRole.admin, ["/admin/invites", "Invites"] as const]
      : navByRole[user.role];

  return (
    <div className="app">
      <header className="topbar">
        <button className="brand" onClick={() => navigate(`/${user.role}/dashboard`)}>
          ALU Career Match
        </button>
        <nav className="nav">
          {nav.map(([href, label]) => (
            <button key={href} className={path === href ? "active" : ""} onClick={() => navigate(href)}>
              {label}
            </button>
          ))}
        </nav>
        <div className="account">
          <span>{user.name}</span>
          <Button variant="ghost" onClick={() => void signOut(auth)}>
            Sign out
          </Button>
        </div>
      </header>
      <main className="page">{children}</main>
    </div>
  );
}
