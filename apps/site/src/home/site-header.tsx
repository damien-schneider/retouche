import { LOGO_PATHS } from "../logo";

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
