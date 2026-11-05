"use client";

import { useRouter } from "next/navigation";
import {
  createContext,
  use,
  useEffect,
  useRef,
  useState,
  useSyncExternalStore,
  useTransition,
  type ReactNode,
} from "react";

// Wait before each retry. On a cold start the backend is usually awake by
// the time a page renders (the project list has no timeout, so the page
// waited for it), so the first retry comes soon; the rest cover a backend
// that is slower or really down, about a minute in all.
const RETRY_DELAYS_MS = [3_000, 10_000, 20_000, 30_000];

// Without a provider there are no retries, so messages ask for a reload.
const GaveUpContext = createContext(true);

// True once every retry has failed: the time to ask the visitor to act.
// Until then, messages say the page is trying again on its own.
export function useRetriesGaveUp() {
  return use(GaveUpContext);
}

function subscribeToVisibility(onChange: () => void) {
  document.addEventListener("visibilitychange", onChange);
  return () => document.removeEventListener("visibilitychange", onChange);
}

// Wraps a page whose loads can fail (`active`: something fell back or is
// missing) and retries with router.refresh(), which renders the page again
// on the server and merges the result in place: no reload, so typed form
// input and the scroll position stay. A successful retry makes the server
// render `active` false and the failure messages disappear. Messages inside
// read useRetriesGaveUp() to know when to ask for a reload.
//
// Paused while the tab is hidden, so a page left in the background keeps
// its retries; on return it retries at once, since the backend has likely
// woken up meanwhile.
export function AutoRetry({ active, children }: { active: boolean; children: ReactNode }) {
  const router = useRouter();
  const [attempts, setAttempts] = useState(0);
  // Pending from the start of a refresh until its result is on screen.
  const [refreshing, startTransition] = useTransition();
  const visible = useSyncExternalStore(
    subscribeToVisibility,
    () => document.visibilityState === "visible",
    () => true,
  );
  const missedWhileHidden = useRef(false);
  const outOfRetries = attempts >= RETRY_DELAYS_MS.length;

  useEffect(() => {
    if (!active || refreshing || outOfRetries) return;
    if (!visible) {
      missedWhileHidden.current = true;
      return;
    }
    const delay = missedWhileHidden.current ? 0 : RETRY_DELAYS_MS[attempts];
    missedWhileHidden.current = false;
    const timer = setTimeout(() => {
      startTransition(() => {
        setAttempts(attempts + 1);
        router.refresh();
      });
    }, delay);
    return () => clearTimeout(timer);
  }, [active, attempts, outOfRetries, refreshing, router, visible]);

  return <GaveUpContext value={outOfRetries && !refreshing}>{children}</GaveUpContext>;
}
