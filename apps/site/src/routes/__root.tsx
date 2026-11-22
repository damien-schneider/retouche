import { createRootRoute, HeadContent, Scripts } from "@tanstack/react-router";
import type { ReactNode } from "react";
import { Retouche } from "retouche";

import config from "../../retouche.config";
import { FAVICON } from "../logo";
import ogImage from "../og-image.png?url";

import styles from "../styles.css?url";

const INTER = "https://rsms.me/inter/inter.css";
const INTER_VARIABLE =
  "https://rsms.me/inter/font-files/InterVariable.woff2?v=4.1";
const TITLE = "Retouche — typography overrides, marked in place";
const DESCRIPTION =
  "A React dev overlay that marks every call site overriding your design system's typography, and every nested corner that doesn't fit, right where it renders.";
const SITE = import.meta.env.SITE_URL;

export const Route = createRootRoute({
  head: () => ({
    links: [
      { crossOrigin: "anonymous", href: "https://rsms.me/", rel: "preconnect" },
      {
        as: "font",
        crossOrigin: "anonymous",
        href: INTER_VARIABLE,
        rel: "preload",
        type: "font/woff2",
      },
      { href: INTER, rel: "stylesheet" },
      { href: styles, rel: "stylesheet" },
      { href: FAVICON, rel: "icon", type: "image/svg+xml" },
    ],
    meta: [
      { charSet: "utf-8" },
      { content: "width=device-width, initial-scale=1", name: "viewport" },
      { title: TITLE },
      { content: DESCRIPTION, name: "description" },
      { content: TITLE, property: "og:title" },
      { content: DESCRIPTION, property: "og:description" },
      { content: "website", property: "og:type" },
      { content: `${SITE}/`, property: "og:url" },
      { content: `${SITE}${ogImage}`, property: "og:image" },
      { content: "1200", property: "og:image:width" },
      { content: "630", property: "og:image:height" },
      {
        content:
          "The Retouche panel tracing a Heading's text-sm override to its call site and to the component",
        property: "og:image:alt",
      },
      { content: "summary_large_image", name: "twitter:card" },
      { content: "light dark", name: "color-scheme" },
    ],
  }),
  shellComponent: RootDocument,
});

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body>
        {children}
        <Retouche config={config} />
        <Scripts />
      </body>
    </html>
  );
}
