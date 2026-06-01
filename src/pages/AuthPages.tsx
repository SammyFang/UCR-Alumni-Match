import { useState, type FormEvent } from "react";
import {
  createUserWithEmailAndPassword,
  GoogleAuthProvider,
  signInWithEmailAndPassword,
  signInWithPopup,
  updateProfile,
} from "firebase/auth";
import { auth } from "../lib/firebase";
import { errorMessage, isUcrEmail } from "../lib/validators";
import { createUserRole } from "../services/data";
import type { Role } from "../types";
import { Button, Card, Field, Form, Input, Notice } from "../components/ui";
import { useAuth } from "../context/AuthContext";

export function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (mode === "register") {
        const credential = await createUserWithEmailAndPassword(auth, email.trim(), password);
        if (name.trim()) {
          await updateProfile(credential.user, { displayName: name.trim() });
        }
      } else {
        await signInWithEmailAndPassword(auth, email.trim(), password);
      }
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    setLoading(true);
    setError("");
    try {
      const provider = new GoogleAuthProvider();
      provider.setCustomParameters({
        hd: "ucr.edu",
        prompt: "select_account",
      });
      await signInWithPopup(auth, provider);
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <Card title="ALU Career Match" className="authCard">
        <div className="segmented">
          <button className={mode === "login" ? "selected" : ""} onClick={() => setMode("login")}>
            Sign in
          </button>
          <button className={mode === "register" ? "selected" : ""} onClick={() => setMode("register")}>
            Create account
          </button>
        </div>
        {error && <Notice type="error">{error}</Notice>}
        <Form onSubmit={submit}>
          {mode === "register" && (
            <Field label="Name">
              <Input autoComplete="name" value={name} onChange={(event) => setName(event.target.value)} required />
            </Field>
          )}
          <Field label="Email">
            <Input type="email" autoComplete="email" value={email} onChange={(event) => setEmail(event.target.value)} required />
          </Field>
          <Field label="Password">
            <Input
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              minLength={6}
              required
            />
          </Field>
          <Button loading={loading} type="submit">
            {mode === "login" ? "Sign in" : "Create account"}
          </Button>
        </Form>
        <div className="divider">or</div>
        <Button variant="secondary" loading={loading} onClick={googleLogin}>
          Continue with Google
        </Button>
      </Card>
    </main>
  );
}

export function RoleSelectionPage() {
  const { firebaseUser } = useAuth();
  const [selectedRole, setSelectedRole] = useState<Role | null>(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function chooseRole(role: Role) {
    if (!firebaseUser?.email) return;
    if (role === "student" && !isUcrEmail(firebaseUser.email)) {
      setSelectedRole(null);
      setError(`Signed in as ${firebaseUser.email}. Students must use an @ucr.edu email. Alumni can continue with this account.`);
      return;
    }

    setSelectedRole(role);
    setLoading(true);
    setError("");

    try {
      await createUserRole({
        uid: firebaseUser.uid,
        role,
        name: firebaseUser.displayName || firebaseUser.email.split("@")[0],
        email: firebaseUser.email,
        photoURL: firebaseUser.photoURL,
      });
    } catch (err) {
      setError(errorMessage(err));
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="authPage">
      <Card title="Select role" className="roleCard">
        {error && <Notice type="error">{error}</Notice>}
        <div className="roleGrid">
          <RoleButton
            role="student"
            title="Student"
            description="Use @ucr.edu to prepare and book."
            loading={loading && selectedRole === "student"}
            onClick={chooseRole}
          />
          <RoleButton
            role="alumni"
            title="Alumni"
            description="Publish slots and meet students."
            loading={loading && selectedRole === "alumni"}
            onClick={chooseRole}
          />
          <RoleButton
            role="admin"
            title="Admin"
            description="Review users and bookings."
            loading={loading && selectedRole === "admin"}
            onClick={chooseRole}
          />
        </div>
        <p className="muted compact">Admin requires an invite record.</p>
      </Card>
    </main>
  );
}

function RoleButton({
  role,
  title,
  description,
  loading,
  onClick,
}: {
  role: Role;
  title: string;
  description: string;
  loading: boolean;
  onClick: (role: Role) => void;
}) {
  return (
    <button className="roleButton" disabled={loading} onClick={() => onClick(role)}>
      <strong>{loading ? "Saving..." : title}</strong>
      <span>{description}</span>
    </button>
  );
}
