import { useEffect } from "react";
import { AppShell } from "./components/AppShell";
import { Notice } from "./components/ui";
import { useAuth } from "./context/AuthContext";
import { navigate, usePathname } from "./lib/router";
import {
  AdminBookingsPage,
  AdminDashboard,
  AdminFlaggedPage,
  AdminInvitesPage,
  AdminUsersPage,
} from "./pages/AdminPages";
import { AdminAcceptInvitePage } from "./pages/AdminInvitePage";
import {
  AlumniAvailabilityPage,
  AlumniBookingsPage,
  AlumniDashboard,
  AlumniProfilePage,
} from "./pages/AlumniPages";
import { LoginPage, RoleSelectionPage } from "./pages/AuthPages";
import {
  StudentAlumniPage,
  StudentBookingsPage,
  StudentDashboard,
  StudentEtiquettePage,
  StudentProfilePage,
} from "./pages/StudentPages";

const defaultRoute = {
  student: "/student/dashboard",
  alumni: "/alumni/dashboard",
  admin: "/admin/dashboard",
} as const;

export default function App() {
  const path = usePathname();
  const { firebaseUser, appUser, loading } = useAuth();
  const isInvitePath = path === "/admin/accept-invite";
  const hasPendingInvite = Boolean(window.localStorage.getItem("pendingAdminInvite"));

  useEffect(() => {
    if (!loading && appUser && hasPendingInvite && (path === "/login" || path === "/role-selection")) {
      navigate("/admin/accept-invite");
      return;
    }
    if (!loading && appUser && (path === "/" || path === "/login" || path === "/role-selection")) {
      navigate(defaultRoute[appUser.role]);
    }
    if (!loading && firebaseUser && !appUser && path !== "/role-selection" && !isInvitePath) {
      navigate(hasPendingInvite ? "/admin/accept-invite" : "/role-selection");
    }
    if (!loading && !firebaseUser && path !== "/login" && !isInvitePath) {
      navigate("/login");
    }
  }, [appUser, firebaseUser, hasPendingInvite, isInvitePath, loading, path]);

  if (loading) return <div className="loading">Loading...</div>;
  if (isInvitePath) return <AdminAcceptInvitePage firebaseUser={firebaseUser} appUser={appUser} />;
  if (!firebaseUser) return <LoginPage />;
  if (!appUser) return <RoleSelectionPage />;

  return (
    <AppShell user={appUser} path={path}>
      <Route path={path} uid={appUser.uid} role={appUser.role} displayName={appUser.name} email={appUser.email} />
    </AppShell>
  );
}

function Route({
  path,
  uid,
  role,
  displayName,
  email,
}: {
  path: string;
  uid: string;
  role: "student" | "alumni" | "admin";
  displayName: string;
  email: string;
}) {
  if (role === "student") {
    if (path === "/student/profile") return <StudentProfilePage uid={uid} displayName={displayName} />;
    if (path === "/student/alumni") return <StudentAlumniPage uid={uid} />;
    if (path === "/student/bookings") return <StudentBookingsPage uid={uid} />;
    if (path === "/student/etiquette") return <StudentEtiquettePage uid={uid} />;
    return <StudentDashboard uid={uid} />;
  }

  if (role === "alumni") {
    if (path === "/alumni/profile") return <AlumniProfilePage uid={uid} displayName={displayName} />;
    if (path === "/alumni/availability") return <AlumniAvailabilityPage uid={uid} />;
    if (path === "/alumni/bookings") return <AlumniBookingsPage uid={uid} />;
    return <AlumniDashboard uid={uid} />;
  }

  if (role === "admin") {
    if (path === "/admin/users") return <AdminUsersPage />;
    if (path === "/admin/bookings") return <AdminBookingsPage />;
    if (path === "/admin/flagged") return <AdminFlaggedPage />;
    if (path === "/admin/invites") return <AdminInvitesPage currentEmail={email} />;
    return <AdminDashboard />;
  }

  return <Notice type="error">Role is not supported.</Notice>;
}
