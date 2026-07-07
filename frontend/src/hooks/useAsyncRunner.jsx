import { useCallback, useState } from "react";

export default function useAsyncRunner() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const runAsync = useCallback(async (task) => {
    setLoading(true);
    setError(null);

    try {
      return await task();
    } catch (err) {
      setError(err?.message || "Erreur inconnue");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, runAsync, setError };
}
