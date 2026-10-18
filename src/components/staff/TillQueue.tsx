"use client";

import { AlertTriangle, X } from "lucide-react";
import { useOffline } from "next/offline";
import { useEffect } from "react";
import { dismissProblem, expireQueue, flushQueue, useTillQueue } from "./till-queue";

/**
 * Sends the till's queued actions as soon as the connection is back (and
 * checks every few seconds meanwhile, dropping what's too old), and shows
 * anything that couldn't be sent so staff can put it right.
 */
export function TillQueue() {
  const offline = useOffline();
  const { waiting, problems } = useTillQueue();

  useEffect(() => {
    if (!offline) void flushQueue();
  }, [offline]);

  useEffect(() => {
    if (waiting.length === 0) return;
    const timer = setInterval(() => {
      expireQueue();
      if (navigator.onLine) void flushQueue();
    }, 5_000);
    return () => clearInterval(timer);
  }, [waiting.length]);

  if (problems.length === 0) return null;
  return (
    <div className="till-problems" role="alert">
      {problems.map((problem) => (
        <div key={problem.id} className="till-warn">
          <AlertTriangle aria-hidden />
          <span>{problem.text}</span>
          <button type="button" className="till-problem-close" aria-label="Dismiss" onClick={() => dismissProblem(problem.id)}>
            <X aria-hidden />
          </button>
        </div>
      ))}
    </div>
  );
}
