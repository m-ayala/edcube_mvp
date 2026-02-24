import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * useAutosave — debounced autosave hook.
 *
 * @param {Function}  performSave  async function that saves the current state
 * @param {Array}     deps         dependency array — save fires when these change
 * @param {number}    delay        debounce delay in ms (default 2000)
 * @param {boolean}   enabled      gate — autosave only runs when true
 * @returns {'idle'|'saving'|'saved'|'error'} saveStatus
 */
const useAutosave = ({ performSave, deps, delay = 2000, enabled }) => {
  const [saveStatus, setSaveStatus] = useState('idle');

  // Always point at the latest performSave (avoids stale closures)
  const performSaveRef = useRef(performSave);
  useEffect(() => { performSaveRef.current = performSave; });

  // Skip the initial mount hydration (transform + cache hydration in CourseWorkspace)
  const mountedRef = useRef(false);
  useEffect(() => {
    const id = setTimeout(() => { mountedRef.current = true; }, 1000);
    return () => clearTimeout(id);
  }, []);

  const timerRef = useRef(null);
  const isSavingRef = useRef(false);
  const dirtyRef = useRef(false);

  const doSave = useCallback(async () => {
    if (isSavingRef.current) {
      dirtyRef.current = true;
      return;
    }

    isSavingRef.current = true;
    dirtyRef.current = false;
    setSaveStatus('saving');

    try {
      await performSaveRef.current();
      setSaveStatus('saved');
    } catch (err) {
      console.error('Autosave failed:', err);
      setSaveStatus('error');
    } finally {
      isSavingRef.current = false;

      // If data changed while we were saving, save again
      if (dirtyRef.current) {
        dirtyRef.current = false;
        doSave();
      }
    }
  }, []);

  // Watch deps — debounce save
  useEffect(() => {
    if (!mountedRef.current || !enabled) return;

    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(doSave, delay);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, enabled]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return saveStatus;
};

export default useAutosave;
