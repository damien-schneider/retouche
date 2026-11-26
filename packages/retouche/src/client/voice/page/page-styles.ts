import { Z_INDEX } from "../../styles/tokens";

export const PAGE_STYLES = `
.dt-voice-page { position: fixed; top: 0; left: 0; z-index: ${Z_INDEX.pick}; width: 0; height: 0; contain: layout; pointer-events: none; }
`;
