import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// useHistory — wraps a state value with an undo/redo snapshot stack.
//
// Usage:
//   const { state, pushState, setStateOnly, undo, redo, canUndo, canRedo, reset } = useHistory(initialState);
//
// Two ways to update state:
//
//   pushState(newDesign)
//     Records the current state in history and sets newDesign as the new one.
//     Use for DISCRETE actions (add, delete, place, button click).
//
//   pushState(newDesign, fromSnapshot)
//     Pushes `fromSnapshot` onto the past stack (instead of the current live
//     state), then sets newDesign. Use at the END of a continuous interaction
//     (drag-end, slider mouseup, color-blur) to record a single clean step:
//       snapshot saved at interaction-start → final value at interaction-end.
//
//   setStateOnly(newDesign)
//     Replaces the live state WITHOUT touching past or future.
//     Use DURING a continuous interaction (drag, slide, color-drag) for
//     real-time visual feedback with zero undo history pollution.
// ---------------------------------------------------------------------------

export default function useHistory(initialState) {
  // The current design state
  const [state, setState] = useState(initialState);

  // Past states (for undo) — most recent is at the end
  const [past, setPast] = useState([]);

  // Future states (for redo) — most recent is at the end
  const [future, setFuture] = useState([]);

  // --------------------------------------------------
  // setStateOnly — update live state without recording history.
  // Used during continuous interactions (drag, slide, color pick).
  // --------------------------------------------------
  const setStateOnly = useCallback((newState) => {
    setState(newState);
  }, []);

  // --------------------------------------------------
  // pushState — record a history entry and set the new state.
  //
  // @param newState   — the state to move TO
  // @param fromState  — (optional) the state to record as the "before" snapshot.
  //                     If omitted, the current live state is used.
  //                     Supply this when using the two-phase commit pattern:
  //                     snapshot at drag-start, commit at drag-end.
  // --------------------------------------------------
  const pushState = useCallback((newState, fromState) => {
    if (fromState !== undefined) {
      // Two-phase commit: push the supplied snapshot, then set new state directly.
      // We don't use setState's functional form here because `fromState` is
      // already the exact "before" we want — no need to read live state.
      setPast((prevPast) => [...prevPast, fromState]);
      setFuture([]);
      setState(newState);
    } else {
      // Standard single-phase commit: push current live state, then set new state.
      setState((currentState) => {
        setPast((prevPast) => [...prevPast, currentState]);
        setFuture([]);
        return newState;
      });
    }
  }, []);

  // --------------------------------------------------
  // undo — pop the most recent past state and push
  // the current state onto the future stack.
  // --------------------------------------------------
  const undo = useCallback(() => {
    setPast((prevPast) => {
      if (prevPast.length === 0) return prevPast; // nothing to undo

      const previous = prevPast[prevPast.length - 1];
      const newPast = prevPast.slice(0, -1);

      setState((currentState) => {
        setFuture((prevFuture) => [...prevFuture, currentState]);
        return previous;
      });

      return newPast;
    });
  }, []);

  // --------------------------------------------------
  // redo — pop the most recent future state and push
  // the current state onto the past stack.
  // --------------------------------------------------
  const redo = useCallback(() => {
    setFuture((prevFuture) => {
      if (prevFuture.length === 0) return prevFuture; // nothing to redo

      const next = prevFuture[prevFuture.length - 1];
      const newFuture = prevFuture.slice(0, -1);

      setState((currentState) => {
        setPast((prevPast) => [...prevPast, currentState]);
        return next;
      });

      return newFuture;
    });
  }, []);

  // --------------------------------------------------
  // reset — clear everything and go back to a fresh
  // initial state (also clears all history).
  // --------------------------------------------------
  const reset = useCallback((freshState) => {
    setState(freshState);
    setPast([]);
    setFuture([]);
  }, []);

  return {
    state,
    pushState,
    setStateOnly,
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    reset,
  };
}
