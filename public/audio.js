export function mouthFromLevel(rms, sensitivity = 1.5, strength = 1) {
  const level = Math.max(0, Math.min(1, (rms * sensitivity - 0.018) * 8));
  return {
    level,
    mouth: level * strength > 0.48 ? 2 : level * strength > 0.09 ? 1 : 0,
  };
}
// Hysteresis + dwell time suppress threshold chatter without increasing analyser work.
export function createMouthTracker() {
  let current = 0,
    candidate = 0,
    since = 0;
  return (result, now) => {
    const value = result.drive ?? result.level;
    let next =
      current === 2
        ? value < 0.39
          ? 1
          : 2
        : current === 1
          ? value > 0.53
            ? 2
            : value < 0.065
              ? 0
              : 1
          : value > 0.115
            ? 1
            : 0;
    if (result.mouth === 0 && result.level === 0) next = 0;
    if (next !== candidate) {
      candidate = next;
      since = now;
    }
    if (
      candidate !== current &&
      now - since >= (candidate > current ? 55 : 110)
    )
      current = candidate;
    return { ...result, mouth: current };
  };
}
