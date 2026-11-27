import { FEEDBACK_STYLES } from "./feedback/feedback-styles";
import { FIGURE_STYLES } from "./feedback/figure/figure-styles";
import { FOLLOW_STYLES } from "./follow/follow-styles";
import { PAGE_STYLES } from "./page/page-styles";
import { HISTORY_STYLES } from "./view/history/history-styles";
import { LIVE_STYLES } from "./view/live/live-styles";
import { VIEW_STYLES } from "./view/view-styles";

export const VOICE_STYLES = `
${LIVE_STYLES}
${VIEW_STYLES}
${FEEDBACK_STYLES}
${FIGURE_STYLES}
${FOLLOW_STYLES}
${PAGE_STYLES}
${HISTORY_STYLES}
@media (prefers-reduced-motion: reduce) {
  .dt-voice-meter i { scale: none; opacity: calc(.3 + var(--level, 0) * var(--reach, 1) * .7); }
  .dt-voice-shimmer { background: none; color: inherit; }
  [data-phase="recording"] .dt-voice-rec { animation: none; }
}
`;
