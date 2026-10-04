/*
 * What the modules share: the configuration start() was given, and the
 * state more than one module reads and changes.
 */
export const config = {};

export const runtime = {
  spec: null,
  latestAnswer: null,
  latestBudget: null,
  latestRequestId: null,
  /* Run the journey: every step not yet done, in order, the way a reader
   would do it, open, fill, Execute, and wait for the page to see the step
   done before the next. A step with a body sends a fresh one each run, so
   running it twice is not refused as a duplicate. The first step that is not done
   stops the run where it is, its answer on screen. */
  autopilot: null,
};
