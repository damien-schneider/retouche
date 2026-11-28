import { useEffect, useState } from "react";

import { AUTHOR, REPOSITORY } from "../credits";
import { cn } from "../ui/class-names";
import { Icon } from "../ui/icon";
import { fetchStars } from "./github-stars";
import { SiteLogo } from "./logo/site-logo";

const STAR_COUNT = new Intl.NumberFormat("en", { notation: "compact" });

const CREDIT_LINK =
  "text-muted hover:text-ink inline-block py-1 text-xs/4 transition-colors duration-150";

export function SiteHeader() {
  return (
    <header className="px-6 pt-6 @2xl:px-8">
      <SiteLogo />
    </header>
  );
}

function useStars(): number | null {
  const [stars, setStars] = useState(import.meta.env.GITHUB_STARS);
  useEffect(() => {
    const controller = new AbortController();
    const refresh = async () => {
      const fresh = await fetchStars(controller.signal);
      if (fresh !== null) {
        setStars(fresh);
      }
    };
    void refresh();
    return () => {
      controller.abort();
    };
  }, []);
  return stars;
}

export function SiteCredits() {
  const stars = useStars();
  return (
    <div className="absolute top-6 right-6 flex flex-col items-end whitespace-nowrap @2xl:right-8">
      {stars !== null && (
        <a
          aria-label={`Retouche on GitHub, ${stars} ${stars === 1 ? "star" : "stars"}`}
          className={cn(CREDIT_LINK, "tabular-nums")}
          href={`https://github.com/${REPOSITORY}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon className="mr-1.5 inline size-3.5 align-[-2px]" name="github" />
          {STAR_COUNT.format(stars)}
        </a>
      )}
      <a
        className={CREDIT_LINK}
        href={AUTHOR.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        by {AUTHOR.name}
      </a>
    </div>
  );
}
