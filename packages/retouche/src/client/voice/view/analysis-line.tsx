import { useEffect, useState } from "react";

import type { VoiceAgent } from "../../../protocol";
import { AlertIcon, RetryIcon } from "../../shell/icons";
import { pendingPassages } from "../feedback/review-items";
import type { Voice } from "../voice";
import { AgentChoice } from "./settings/agent-choice";
import { RETRY_NAME } from "./voice-problem";

export const RERUN_NAME = "Re-run";
export const WRITE_NAME = "Write feedback";

const NOW_EVERY_MS = 30_000;
const AGO = new Intl.RelativeTimeFormat(undefined, { numeric: "auto" });
const AGO_STEPS: { size: number; unit: Intl.RelativeTimeFormatUnit }[] = [
  { size: 60, unit: "second" },
  { size: 60, unit: "minute" },
  { size: 24, unit: "hour" },
  { size: Number.POSITIVE_INFINITY, unit: "day" },
];

function timeAgo(at: number, now: number): string {
  let amount = Math.min(0, Math.round((at - now) / 1000));
  for (const { size, unit } of AGO_STEPS) {
    if (Math.abs(amount) < size) {
      return AGO.format(unit === "second" ? 0 : amount, unit);
    }
    amount = Math.round(amount / size);
  }
  return "";
}

function useNow(): number {
  const [now, setNow] = useState(Date.now);
  useEffect(() => {
    const timer = window.setInterval(() => {
      setNow(Date.now());
    }, NOW_EVERY_MS);
    return () => {
      window.clearInterval(timer);
    };
  }, []);
  return now;
}

function OtherAgents({ agent, voice }: { agent: VoiceAgent; voice: Voice }) {
  const others = (voice.agents ?? []).filter(
    ({ id, state }) => id !== agent.id && state !== "signed-out"
  );
  return others.map((other) => (
    <button
      className="dt-voice-link"
      key={other.id}
      onClick={() => {
        voice.actions.setPreferences({ agent: other.id });
        voice.actions.analyze();
      }}
      type="button"
    >
      Use {other.name}
    </button>
  ));
}

function FailedLine({
  failure,
  voice,
}: {
  failure: { agent: VoiceAgent; error: string };
  voice: Voice;
}) {
  return (
    <div className="dt-voice-analysis" data-state="failed">
      <p className="dt-error">
        <AlertIcon />
        <span>{failure.error}</span>
      </p>
      <button className="dt-btn" onClick={voice.actions.analyze} type="button">
        <RetryIcon />
        {RETRY_NAME}
      </button>
      <OtherAgents agent={failure.agent} voice={voice} />
    </div>
  );
}

function DoneLine({
  agent,
  at,
  voice,
}: {
  agent: VoiceAgent;
  at: number;
  voice: Voice;
}) {
  const now = useNow();
  return (
    <div className="dt-voice-analysis" data-state="done">
      <p>
        {agent.name} ·{" "}
        <time dateTime={new Date(at).toISOString()}>{timeAgo(at, now)}</time>
      </p>
      <button
        className="dt-voice-link"
        onClick={voice.actions.analyze}
        type="button"
      >
        {RERUN_NAME}
      </button>
      {voice.phase === "idle" && <OtherAgents agent={agent} voice={voice} />}
    </div>
  );
}

function failureOf(voice: Voice): { agent: VoiceAgent; error: string } | null {
  const { analysis, session } = voice;
  if (analysis.kind === "failed") {
    return analysis;
  }
  const run = session?.analysis;
  if (!run || run.agent === null || run.error === null) {
    return null;
  }
  return { agent: run.agent, error: run.error };
}

function WritingLine({ agent }: { agent: VoiceAgent }) {
  return (
    <p className="dt-voice-analysis" data-state="running">
      <span className="dt-voice-shimmer">
        {agent.name} is writing feedback…
      </span>
    </p>
  );
}

export function AnalysisLine({
  isAgentChoiceShown,
  voice,
}: {
  isAgentChoiceShown: boolean;
  voice: Voice;
}) {
  const { agents, analysis, phase, preferences, session } = voice;
  if (agents === null) {
    return null;
  }
  if (agents.length === 0) {
    return isAgentChoiceShown ? null : (
      <AgentChoice agents={agents} isExplained voice={voice} />
    );
  }
  if (session === null) {
    return null;
  }
  if (analysis.kind === "running") {
    return <WritingLine agent={analysis.agent} />;
  }
  const failure = failureOf(voice);
  if (failure) {
    return <FailedLine failure={failure} voice={voice} />;
  }
  const hasPending = pendingPassages(session).length > 0;
  if (phase !== "idle" && hasPending && !preferences.isLive) {
    return <p className="dt-voice-note">Feedback is written when you stop.</p>;
  }
  const { agent, at } = session.analysis;
  if (at !== null && agent !== null) {
    return <DoneLine agent={agent} at={at} voice={voice} />;
  }
  if (hasPending && phase === "idle") {
    return (
      <button
        className="dt-btn"
        data-variant="primary"
        onClick={voice.actions.analyze}
        type="button"
      >
        {WRITE_NAME}
      </button>
    );
  }
  return null;
}
