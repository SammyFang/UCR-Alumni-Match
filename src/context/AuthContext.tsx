import { createContext, useContext, useEffect, useMemo, useState } from "react";
import type { User } from "firebase/auth";
import { onAuthStateChanged } from "firebase/auth";
import { doc, onSnapshot, serverTimestamp, updateDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import type { AppUser } from "../types";

interface AuthState {
  firebaseUser: User | null;
  appUser: AppUser | null;
  loading: boolean;
}

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [appUser, setAppUser] = useState<AppUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [profileLoading, setProfileLoading] = useState(false);

  useEffect(() => {
    return onAuthStateChanged(auth, (user) => {
      setFirebaseUser(user);
      setAuthLoading(false);
      if (!user) setAppUser(null);
    });
  }, []);

  useEffect(() => {
    if (!firebaseUser) {
      setProfileLoading(false);
      return;
    }

    setProfileLoading(true);
    const userRef = doc(db, "users", firebaseUser.uid);
    let touchedLogin = false;

    return onSnapshot(
      userRef,
      (snapshot) => {
        setAppUser(snapshot.exists() ? (snapshot.data() as AppUser) : null);
        setProfileLoading(false);
        if (snapshot.exists() && !touchedLogin) {
          touchedLogin = true;
          void updateDoc(userRef, {
            lastLoginAt: serverTimestamp(),
            updatedAt: serverTimestamp(),
          }).catch(() => undefined);
        }
      },
      () => {
        setAppUser(null);
        setProfileLoading(false);
      }
    );
  }, [firebaseUser]);

  const value = useMemo(
    () => ({
      firebaseUser,
      appUser,
      loading: authLoading || profileLoading,
    }),
    [appUser, authLoading, firebaseUser, profileLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside AuthProvider");
  return context;
}
