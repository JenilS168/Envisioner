import { useState, useCallback } from 'react';

// ---------------------------------------------------------------------------
// useHistory — wraps a state value with an undo/redo snapshot stack.
//
// Usage:
//   const { state, pushState, undo, redo, canUndo, canRedo, reset } = useHistory(initialState);
//
// Every time you want to change the design, call pushState(newDesign).
// This pushes the *current* state onto the past stack and sets the new one.
// Calling undo/redo navigates back and forth through the history.
// ---------------------------------------------------------------------------

export default function useHistory(initialState) {
  // The current design state
  const [state, setState] = useState(initialState);

  // Past states (for undo) — most recent is at the end
  const [past, setPast] = useState([]);

  // Future states (for redo) — most recent is at the end
  const [future, setFuture] = useState([]);

  // --------------------------------------------------
  // pushState — record the current state in history
  // and replace it with `newState`.
  // This clears the redo stack (you branched off).
  // --------------------------------------------------
  const pushState = useCallback((newState) => {
    setState((currentState) => {
      setPast((prevPast) => [...prevPast, currentState]);
      setFuture([]); // new action clears redo
      return newState;
    });
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
    undo,
    redo,
    canUndo: past.length > 0,
    canRedo: future.length > 0,
    reset,
  };
}
