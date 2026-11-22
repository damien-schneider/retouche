import { describe, expect, it, onTestFinished, vi } from "vitest";

import {
  elementStack,
  fakeFiber,
  serverStack,
  site,
} from "../fiber/fake-fibers";
import {
  appOwnerOf,
  type CodeSite,
  componentSite,
  creationFrame,
  creationSite,
} from "./element-source";

function SettingsForm() {
  return null;
}
function Button() {
  return null;
}
function Slot() {
  return null;
}
function Page() {
  return null;
}
function SelectTrigger() {
  return null;
}
function LibrarySelectTrigger() {
  return null;
}
function ButtonBase() {
  return null;
}

function lineOf(codeSite: CodeSite) {
  return codeSite.kind === "found"
    ? `${codeSite.request.fileName}:${codeSite.request.line}`
    : codeSite.kind;
}

describe("locating the code behind an override", () => {
  it("finds where the component is used and where it draws its element", async () => {
    const button = document.createElement("button");
    const form = fakeFiber({
      createdAt: site("/repo/src/app.tsx", 4),
      type: SettingsForm,
    });
    const buttonComponent = fakeFiber({
      createdAt: site("/repo/src/settings-form.tsx", 17),
      owner: form,
      parent: form,
      type: Button,
    });
    fakeFiber({
      createdAt: site("/repo/src/ui/button.tsx", 9),
      node: button,
      owner: buttonComponent,
      parent: buttonComponent,
      type: "button",
    });

    expect(lineOf(await creationSite(buttonComponent))).toBe(
      "/repo/src/settings-form.tsx:17"
    );
    expect(
      lineOf(await componentSite({ component: buttonComponent, node: button }))
    ).toBe("/repo/src/ui/button.tsx:9");
  });
});

describe("elements created outside the app's client code", () => {
  it("passes over a library element to the component's own JSX", async () => {
    const button = document.createElement("button");
    const buttonComponent = fakeFiber({
      createdAt: site("/repo/src/page.tsx", 3),
      type: Button,
    });
    const slot = fakeFiber({
      createdAt: site("/repo/src/ui/button.tsx", 21),
      owner: buttonComponent,
      parent: buttonComponent,
      type: Slot,
    });
    fakeFiber({
      createdAt: site("/repo/node_modules/@radix-ui/slot/dist/index.js", 40),
      node: button,
      owner: slot,
      parent: slot,
      type: "button",
    });

    expect(
      lineOf(await componentSite({ component: buttonComponent, node: button }))
    ).toBe("/repo/src/ui/button.tsx:21");
  });

  it("follows a library hook back to the component that calls it", async () => {
    const button = document.createElement("button");
    const buttonComponent = fakeFiber({
      createdAt: site("/repo/src/page.tsx", 3),
      type: Button,
    });
    fakeFiber({
      createdWith: elementStack(
        "exports.jsx (/repo/node_modules/react/cjs/react-jsx-runtime.development.js:120:12)",
        "useRender (/repo/node_modules/@base-ui/react/use-render.js:40:10)",
        "Button (/repo/src/ui/button.tsx:24:10)",
        "Object.react_stack_bottom_frame (/repo/node_modules/react-dom/cjs/react-dom-client.development.js:25000:20)"
      ),
      node: button,
      owner: buttonComponent,
      parent: buttonComponent,
      type: "button",
    });

    expect(
      lineOf(await componentSite({ component: buttonComponent, node: button }))
    ).toBe("/repo/src/ui/button.tsx:24");
  });
});

describe("a library the dev server prebundled", () => {
  it("follows its hook back to the component that calls it", async () => {
    const bundle =
      "http://localhost:5173/node_modules/.vite/deps/@base-ui_react.js?v=4f2a";
    const sourceMap = JSON.stringify({
      mappings: "AAAA",
      names: [],
      sources: ["../../@base-ui/react/esm/use-render.js"],
      version: 3,
    });
    const devServer = vi
      .spyOn(globalThis, "fetch")
      .mockImplementation(async (url) =>
        url === bundle
          ? new Response(
              `render();\n//# sourceMappingURL=data:application/json;base64,${btoa(sourceMap)}`
            )
          : new Response(null, { status: 404 })
      );
    onTestFinished(() => {
      devServer.mockRestore();
    });
    const button = document.createElement("button");
    const buttonComponent = fakeFiber({
      createdAt: site("/repo/src/page.tsx", 3),
      type: Button,
    });
    fakeFiber({
      createdWith: elementStack(
        "exports.jsx (http://localhost:5173/node_modules/.vite/deps/react_jsx-runtime.js?v=4f2a:1:1)",
        `useRender (${bundle}:1:5)`,
        "Button (http://localhost:5173/src/ui/button.tsx:24:10)",
        "Object.react_stack_bottom_frame (http://localhost:5173/node_modules/.vite/deps/react-dom_client.js?v=4f2a:9:9)"
      ),
      node: button,
      owner: buttonComponent,
      parent: buttonComponent,
      type: "button",
    });

    expect(
      lineOf(await componentSite({ component: buttonComponent, node: button }))
    ).toBe("http://localhost:5173/src/ui/button.tsx:24");
  });
});

describe("a design system installed as a package", () => {
  it("names the package when the component itself is written in a dependency", async () => {
    const button = document.createElement("button");
    const buttonComponent = fakeFiber({
      createdAt: site("/repo/src/page.tsx", 3),
      type: Button,
    });
    const primitive = fakeFiber({
      createdAt: site(
        "/repo/node_modules/.bun/@ctrl-ui+react@0.10.0/node_modules/@ctrl-ui/react/dist/ui/button.js",
        52
      ),
      owner: buttonComponent,
      parent: buttonComponent,
      type: Slot,
    });
    fakeFiber({
      createdAt: site("/repo/node_modules/@base-ui/react/use-render.js", 40),
      node: button,
      owner: primitive,
      parent: primitive,
      type: "button",
    });

    await expect(
      componentSite({ component: buttonComponent, node: button })
    ).resolves.toStrictEqual({
      kind: "dependency",
      packageName: "@ctrl-ui/react",
    });
  });
});

function designSystemSelect() {
  const trigger = document.createElement("button");
  const form = fakeFiber({
    createdAt: site("/repo/src/app.tsx", 4),
    type: SettingsForm,
  });
  const designSystem = fakeFiber({
    createdAt: site("/repo/src/settings-form.tsx", 54),
    owner: form,
    parent: form,
    type: SelectTrigger,
  });
  const part = fakeFiber({
    createdAt: site("/repo/src/ui/select.tsx", 139),
    owner: designSystem,
    parent: designSystem,
    type: LibrarySelectTrigger,
  });
  fakeFiber({
    createdAt: site("/repo/node_modules/@base-ui/react/select/trigger.js", 60),
    node: trigger,
    owner: part,
    parent: part,
    type: "button",
  });
  return { designSystem, trigger };
}

function libraryButtonOnPage() {
  const button = document.createElement("button");
  const page = fakeFiber({
    createdAt: site("/repo/src/app.tsx", 5),
    type: Page,
  });
  const toolbar = fakeFiber({
    createdAt: site("/repo/src/page.tsx", 8),
    node: document.createElement("div"),
    owner: page,
    parent: page,
    type: "div",
  });
  const libraryButton = fakeFiber({
    createdAt: site("/repo/src/page.tsx", 10),
    owner: page,
    parent: toolbar,
    type: Button,
  });
  const base = fakeFiber({
    createdAt: site("/repo/node_modules/@mui/material/Button/Button.js", 300),
    owner: libraryButton,
    parent: libraryButton,
    type: ButtonBase,
  });
  fakeFiber({
    createdAt: site("/repo/node_modules/@mui/material/ButtonBase.js", 200),
    node: button,
    owner: base,
    parent: base,
    type: "button",
  });
  return { button, libraryButton };
}

describe("the component a picked element belongs to", () => {
  it("names the design system component around a library part, where the app uses it", async () => {
    const { designSystem, trigger } = designSystemSelect();

    await expect(appOwnerOf(trigger)).resolves.toBe(designSystem);
    expect(lineOf(await creationSite(designSystem))).toBe(
      "/repo/src/settings-form.tsx:54"
    );
    expect(
      lineOf(await componentSite({ component: designSystem, node: trigger }))
    ).toBe("/repo/src/ui/select.tsx:139");
  });

  it("names the library component a page places, not the page around it", async () => {
    const { button, libraryButton } = libraryButtonOnPage();

    await expect(appOwnerOf(button)).resolves.toBe(libraryButton);
  });

  it("keeps the component that writes the element, even when a router renders it", async () => {
    const heading = document.createElement("h1");
    const route = fakeFiber({
      createdAt: site("/repo/node_modules/react-router/dist/index.js", 900),
      type: Page,
    });
    fakeFiber({
      createdAt: site("/repo/src/page.tsx", 6),
      node: heading,
      owner: route,
      parent: route,
      type: "h1",
    });

    await expect(appOwnerOf(heading)).resolves.toBe(route);
  });
});

describe("elements a Server Component renders", () => {
  it("hands a Server Component's frame to the dev route to map", async () => {
    const text = {
      debugStack: serverStack("app_page_tsx.js", 120, 9),
      name: "Text",
      owner: null,
    };

    await expect(creationSite(text)).resolves.toStrictEqual({
      kind: "found",
      request: {
        column: 8,
        fileName:
          "about://React/Server/file:///repo/.next/server/chunks/ssr/app_page_tsx.js",
        line: 120,
      },
    });
  });

  it("hands the frame of a Server Component Next prerendered from a route group to the dev route as well", async () => {
    const hero = {
      debugStack: elementStack(
        "fakeJSXCallSite (http://localhost:3000/_next/static/chunks/react-server-dom-turbopack.js:2001:21)",
        "Hero (about://React/Prerender/file:///repo/.next/dev/server/chunks/ssr/app_(features)_home_10vcn17._.js?3:1090:333)"
      ),
      name: "Text",
      owner: null,
    };

    await expect(creationSite(hero)).resolves.toStrictEqual({
      kind: "found",
      request: {
        column: 332,
        fileName:
          "about://React/Prerender/file:///repo/.next/dev/server/chunks/ssr/app_(features)_home_10vcn17._.js?3",
        line: 1090,
      },
    });
  });
});

describe("telling call sites apart", () => {
  it("gives every element written at one JSX site the same frame", () => {
    const planRow = "PlanList (http://localhost:5173/src/plans.tsx:12:9)";
    const jsx = "exports.jsxDEV (http://localhost:5173/deps/react.js:333:29)";
    const starter = fakeFiber({
      createdWith: elementStack(jsx, planRow, "Array.map (<anonymous>)"),
      type: Button,
    });
    const team = fakeFiber({
      createdWith: elementStack(jsx, planRow, "Array.map (<anonymous>)"),
      type: Button,
    });
    const footer = fakeFiber({
      createdWith: elementStack(
        jsx,
        "PlanList (http://localhost:5173/src/plans.tsx:30:7)"
      ),
      type: Button,
    });

    expect(creationFrame(starter)).not.toBeNull();
    expect(creationFrame(team)).toBe(creationFrame(starter));
    expect(creationFrame(footer)).not.toBe(creationFrame(starter));
  });

  it("reads no call site from the stack React shares once it stops recording owners", () => {
    const unrecorded = fakeFiber({
      createdWith: elementStack(
        "UnknownOwner (http://localhost:5173/deps/react.js:121:14)",
        "Object.react_stack_bottom_frame (http://localhost:5173/deps/react.js:315:16)"
      ),
      type: Button,
    });

    expect(creationFrame(unrecorded)).toBeNull();
  });
});
