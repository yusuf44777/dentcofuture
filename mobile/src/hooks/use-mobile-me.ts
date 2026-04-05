import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchMobileMe } from "../lib/mobile-api";
import { useAuthSessionStore } from "../store/auth-session";

export function useMobileMe() {
  const session = useAuthSessionStore((state) => state.session);
  const me = useAuthSessionStore((state) => state.me);
  const setMe = useAuthSessionStore((state) => state.setMe);

  const query = useQuery({
    queryKey: ["mobile-me", session?.accessToken],
    queryFn: fetchMobileMe,
    enabled: Boolean(session?.accessToken),
    staleTime: 25_000,
    retry: 1
  });

  useEffect(() => {
    if (query.data) {
      setMe(query.data);
    }
  }, [query.data, setMe]);

  return {
    me: query.data ?? me,
    query
  };
}
