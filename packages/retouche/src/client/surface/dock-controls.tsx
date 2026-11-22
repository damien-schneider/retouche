import { DotsIcon, PinIcon } from "../shell/icons";

export function DotsToggle({
  areShown,
  onToggle,
}: {
  areShown: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label="Override dots"
      aria-pressed={areShown}
      className="icon-btn"
      onClick={onToggle}
      title={areShown ? "Hide override dots" : "Show override dots"}
      type="button"
    >
      <DotsIcon />
    </button>
  );
}

export function PinToggle({
  isPinned,
  onToggle,
}: {
  isPinned: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      aria-label="Pin beside the page"
      aria-pressed={isPinned}
      className="icon-btn dt-pin"
      onClick={onToggle}
      title={isPinned ? "Float over the page" : "Pin beside the page"}
      type="button"
    >
      <PinIcon />
    </button>
  );
}
