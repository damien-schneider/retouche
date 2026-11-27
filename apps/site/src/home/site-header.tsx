import { AUTHOR, REPOSITORY } from "../credits";
import { cn } from "../ui/class-names";
import { Icon } from "../ui/icon";
import { SiteLogo } from "./logo/site-logo";

const STARS = import.meta.env.GITHUB_STARS;

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

export function SiteCredits() {
  return (
    <div className="absolute top-6 right-6 flex flex-col items-end whitespace-nowrap @2xl:right-8">
      {STARS !== null && (
        <a
          aria-label={`Retouche on GitHub, ${STARS} ${STARS === 1 ? "star" : "stars"}`}
          className={cn(CREDIT_LINK, "tabular-nums")}
          href={`https://github.com/${REPOSITORY}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon className="mr-1.5 inline size-3.5 align-[-2px]" name="github" />
          {STAR_COUNT.format(STARS)}
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
