import { useEffect, useState } from "react";
import type { DocumentData, DocumentReference, Query } from "firebase/firestore";
import { onSnapshot } from "firebase/firestore";

export function useDocument<T>(source: DocumentReference<DocumentData> | null) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(Boolean(source));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setData(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    return onSnapshot(
      source,
      (snapshot) => {
        setData(snapshot.exists() ? ({ id: snapshot.id, ...snapshot.data() } as T) : null);
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );
  }, [source]);

  return { data, loading, error };
}

export function useCollection<T>(source: Query<DocumentData> | null) {
  const [data, setData] = useState<T[]>([]);
  const [loading, setLoading] = useState(Boolean(source));
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!source) {
      setData([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    return onSnapshot(
      source,
      (snapshot) => {
        setData(snapshot.docs.map((item) => ({ id: item.id, ...item.data() }) as T));
        setLoading(false);
        setError(null);
      },
      (snapshotError) => {
        setError(snapshotError.message);
        setLoading(false);
      }
    );
  }, [source]);

  return { data, loading, error };
}
