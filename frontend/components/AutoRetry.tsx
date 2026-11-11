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

// Wait before each retry, counted from the end of the previous one. On a
// cold start every load gives up after 5 seconds while Render wakes (30-50
// seconds), and a failed retry takes those 5 seconds too, so the retries
// land about 8, 23, 48, and 83 seconds after the visit: the first catches a
// backend that was only briefly slow, the later ones a full wake.
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
