import { useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { navigate } from "../lib/router";
import { errorMessage } from "../lib/validators";
import { acceptAdminInvite } from "../services/data";
import type { AppUser } from "../types";
import { Button, Card, Notice } from "../components/ui";

const STORAGE_KEY = "pendingAdminInvite";

function readInviteFromUrl() {
  const params = new URLSearchParams(window.location.search);
  const email = params.get("email") || "";
  const token = params.get("token") || "";
  return email && token ? { email, token } : null;
}

function readStoredInvite() {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as { email: string; token: string }) : null;
  } catch {
    return null;
  }
}

export function AdminAcceptInvitePage({
  firebaseUser,
  appUser,
}: {
  firebaseUser: User | null;
  appUser: AppUser | null;
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const invite = useMemo(() => readInviteFromUrl() || readStoredInvite(), []);

  useEffect(() => {
    const urlInvite = readInviteFromUrl();
    if (urlInvite) {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(urlInvite));
    }
  }, []);

  useEffect(() => {
    if (appUser?.role === "admin") {
      window.localStorage.removeItem(STORAGE_KEY);
    }
  }, [appUser?.role]);

  async function accept() {
    if (!invite) return;
    setLoading(true);
    setError("");

    try {
      await acceptAdminInvite(invite.email, invite.token);
      window.localStorage.removeItem(STORAGE_KEY);
      window.setTimeout(() => navigate("/admin/dashboard"), 500);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  const signedInEmail = firebaseUser?.email?.toLowerCase() || "";
  const inviteEmail = invite?.email.toLowerCase() || "";
  const mismatch = Boolean(firebaseUser && inviteEmail && signedInEmail !== inviteEmail);

  return (
    <main className="authPage">
      <Card title="Admin Invitation" className="authCard inviteAcceptCard">
        {!invite && <Notice type="error">Invite link is missing or invalid.</Notice>}
        {error && <Notice type="error">{error}</Notice>}
        {appUser?.role === "admin" && <Notice type="success">Admin access is active.</Notice>}
        {invite && !firebaseUser && (
          <>
            <div className="invitePanel">
              <strong>{invite.email}</strong>
              <span>Sign in with this email to accept access.</span>
            </div>
            <Button onClick={() => navigate("/login")}>Sign in to accept</Button>
          </>
        )}
        {invite && firebaseUser && mismatch && (
          <Notice type="warning">Sign out and use {invite.email} to accept this invite.</Notice>
        )}
        {invite && firebaseUser && !mismatch && appUser?.role !== "admin" && (
          <>
            <div className="invitePanel">
              <strong>{invite.email}</strong>
              <span>Join the admin workspace for ALU Career Match.</span>
            </div>
            <Button loading={loading} onClick={accept}>
              Accept admin access
            </Button>
          </>
        )}
        {appUser?.role === "admin" && (
          <Button onClick={() => navigate("/admin/dashboard")}>Open admin dashboard</Button>
        )}
      </Card>
    </main>
  );
}
