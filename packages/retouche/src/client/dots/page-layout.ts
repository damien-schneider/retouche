const HEARTBEAT_MS = 500;

export function onPageLayoutChange(onChange: () => void): () => void {
  let frame = 0;
  const schedule = () => {
    frame ||= requestAnimationFrame(() => {
      frame = 0;
      onChange();
    });
  };
  const observer =
    typeof ResizeObserver === "undefined" ? null : new ResizeObserver(schedule);
  observer?.observe(document.documentElement);
  observer?.observe(document.body);
  const heartbeat = window.setInterval(schedule, HEARTBEAT_MS);
  window.addEventListener("scroll", schedule, { capture: true, passive: true });
  window.addEventListener("resize", schedule);

  return () => {
    cancelAnimationFrame(frame);
    observer?.disconnect();
    window.clearInterval(heartbeat);
    window.removeEventListener("scroll", schedule, true);
    window.removeEventListener("resize", schedule);
  };
}
