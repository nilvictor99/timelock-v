import { useCallback, useEffect, useRef, useState } from "react";

export type AutosaveStatus = "idle" | "modified" | "saving" | "saved" | "error";

type AutosaveOptions<T extends object> = {
  values: T;
  ready: boolean;
  delay?: number;
  save: (key: keyof T, value: T[keyof T]) => Promise<boolean>;
  onRevert: (key: keyof T, value: T[keyof T]) => void;
};

function equal(left: unknown, right: unknown) {
  return JSON.stringify(left) === JSON.stringify(right);
}

/**
 * Keeps the last server-confirmed value in memory and persists individual fields
 * after a short pause. Secrets and form values never leave the component except
 * through the caller-provided save function.
 */
export function useAutosave<T extends object>({
  values,
  ready,
  delay = 750,
  save,
  onRevert,
}: AutosaveOptions<T>) {
  const valuesRef = useRef(values);
  const confirmedRef = useRef(values);
  const previousRef = useRef(values);
  const timersRef = useRef<Partial<Record<keyof T, ReturnType<typeof setTimeout>>>>({});
  const initializedRef = useRef(false);
  const [statuses, setStatuses] = useState<Partial<Record<keyof T, AutosaveStatus>>>({});

  useEffect(() => {
    valuesRef.current = values;
  }, [values]);

  const persist = useCallback(async (key: keyof T, value: T[keyof T]) => {
    setStatuses((current) => ({ ...current, [key]: "saving" }));
    const ok = await save(key, value);
    if (ok) {
      confirmedRef.current = { ...confirmedRef.current, [key]: value };
      setStatuses((current) => ({ ...current, [key]: "saved" }));
      window.setTimeout(() => {
        setStatuses((current) => current[key] === "saved" ? { ...current, [key]: "idle" } : current);
      }, 2000);
    } else {
      setStatuses((current) => ({ ...current, [key]: "error" }));
      onRevert(key, confirmedRef.current[key]);
    }
  }, [onRevert, save]);

  const flush = useCallback((key: keyof T) => {
    const timer = timersRef.current[key];
    if (timer) clearTimeout(timer);
    delete timersRef.current[key];
    const value = valuesRef.current[key];
    if (!equal(value, confirmedRef.current[key])) void persist(key, value);
  }, [persist]);

  useEffect(() => {
    if (!ready) {
      initializedRef.current = false;
      return;
    }
    if (!initializedRef.current) {
      initializedRef.current = true;
      previousRef.current = values;
      confirmedRef.current = values;
      setStatuses({});
      return;
    }
    (Object.keys(values) as Array<keyof T>).forEach((key) => {
      if (equal(values[key], previousRef.current[key])) return;
      if (equal(values[key], confirmedRef.current[key])) {
        setStatuses((current) => ({ ...current, [key]: "idle" }));
        return;
      }
      setStatuses((current) => ({ ...current, [key]: "modified" }));
      const timer = timersRef.current[key];
      if (timer) clearTimeout(timer);
      timersRef.current[key] = setTimeout(() => flush(key), delay);
    });
    previousRef.current = values;
  }, [delay, flush, ready, values]);

  const reset = useCallback((next: T) => {
    valuesRef.current = next;
    previousRef.current = next;
    confirmedRef.current = next;
    initializedRef.current = Boolean(ready);
    setStatuses({});
  }, [ready]);

  const revert = useCallback((key: keyof T) => {
    const timer = timersRef.current[key];
    if (timer) clearTimeout(timer);
    delete timersRef.current[key];
    const value = confirmedRef.current[key];
    onRevert(key, value);
    previousRef.current = { ...previousRef.current, [key]: value };
    setStatuses((current) => ({ ...current, [key]: "idle" }));
  }, [onRevert]);

  return {
    statuses,
    confirmedValues: confirmedRef.current,
    flush,
    reset,
    revert,
  };
}
