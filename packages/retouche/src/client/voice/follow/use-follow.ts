import { useEffect, useState } from "react";

import { ENDPOINTS } from "../../../protocol";
import {
  type VoiceFollow,
  voiceFollowSchema,
} from "../../../voice/follow-cards";
import { callDevRoute } from "../../route/dev-route";
import type { Voice } from "../voice";

const POLL_EVERY_MS = 2000;
const FOLLOWING_MS = 120_000;

export interface FollowView {
  cards: VoiceFollow["cards"];
  isFollowing: boolean;
}

interface FollowAnswer {
  cards: FollowView["cards"];
  isSeen: boolean;
  session: string;
}

const UNFOLLOWED: FollowView = { cards: {}, isFollowing: false };

export function useFollow(voice: Voice): FollowView {
  const [answer, setAnswer] = useState<FollowAnswer | null>(null);
  const isOffered = voice.follow !== null;
  const session = voice.session?.id ?? "";

  useEffect(() => {
    if (!isOffered) {
      return;
    }
    const aborter = new AbortController();
    const poll = async () => {
      const follow = await callDevRoute({
        endpoint: ENDPOINTS.voiceFollow,
        schema: voiceFollowSchema,
        search: new URLSearchParams(session === "" ? {} : { session }),
        signal: aborter.signal,
      }).catch(() => null);
      if (follow === null || aborter.signal.aborted) {
        return;
      }
      const { cards, seenAt } = follow;
      const isSeen = seenAt !== null && Date.now() - seenAt < FOLLOWING_MS;
      setAnswer({ cards, isSeen, session });
    };
    void poll();
    const timer = window.setInterval(() => {
      void poll();
    }, POLL_EVERY_MS);
    return () => {
      aborter.abort();
      window.clearInterval(timer);
    };
  }, [isOffered, session]);

  if (!isOffered || answer === null) {
    return UNFOLLOWED;
  }
  const cards = answer.session === session ? answer.cards : {};
  const isWorking = Object.values(cards).some(
    ({ state }) => state === "working"
  );
  return { cards, isFollowing: answer.isSeen || isWorking };
}
