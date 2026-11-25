import { AUTHOR, REPOSITORY } from "../credits";
import { LOGO_PATHS } from "../logo";
import { cn } from "../ui/class-names";
import { Icon } from "../ui/icon";

const STARS = import.meta.env.GITHUB_STARS;

const STAR_COUNT = new Intl.NumberFormat("en", { notation: "compact" });

const CREDIT_LINK =
  "text-muted hover:text-ink inline-block py-1 text-xs/4 transition-colors duration-150";

export function SiteHeader() {
  return (
    <header className="px-6 pt-6 @2xl:px-8 @2xl:pt-8">
      <a
        className="text-ink inline-flex items-baseline gap-[0.28em] font-serif text-base"
        href="/"
      >
        <svg
          aria-hidden="true"
          className="text-brand size-[0.8em] fill-current"
          viewBox="0 0 64 64"
        >
          {LOGO_PATHS.map((d) => (
            <path d={d} key={d} />
          ))}
        </svg>
        Retouche
      </a>
    </header>
  );
}

export function SiteCredits() {
  return (
    <div className="absolute top-6 right-6 whitespace-nowrap @2xl:top-8 @2xl:right-8">
      <a
        className={CREDIT_LINK}
        href={AUTHOR.href}
        rel="noopener noreferrer"
        target="_blank"
      >
        by {AUTHOR.name}
      </a>
      {STARS !== null && (
        <a
          aria-label={`Retouche on GitHub, ${STARS} stars`}
          className={cn(CREDIT_LINK, "ml-3 tabular-nums")}
          href={`https://github.com/${REPOSITORY}`}
          rel="noopener noreferrer"
          target="_blank"
        >
          <Icon className="mr-1.5 inline size-3.5 align-[-2px]" name="github" />
          {STAR_COUNT.format(STARS)}
        </a>
      )}
    </div>
  );
}
