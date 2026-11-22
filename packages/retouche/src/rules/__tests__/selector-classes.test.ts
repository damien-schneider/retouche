import { describe, expect, it } from "vitest";

import { subjectClasses } from "../selector-classes";

describe("the classes a selector styles", () => {
  it("reads only the element the rule lands on", () => {
    expect(subjectClasses(".card > .title.is-large")).toStrictEqual([
      "title",
      "is-large",
    ]);
    expect(subjectClasses(".dark .title, h2.subtitle")).toStrictEqual([
      "title",
      "subtitle",
    ]);
  });

  it("unescapes the class names CSS modules and Tailwind write", () => {
    expect(subjectClasses(".md\\:text-xl")).toStrictEqual(["md:text-xl"]);
    expect(subjectClasses(".\\32 xl\\:uppercase")).toStrictEqual([
      "2xl:uppercase",
    ]);
  });

  it("counts states but not generated content", () => {
    expect(subjectClasses(".link:hover")).toStrictEqual(["link"]);
    expect(subjectClasses(".quote::before, .note:after")).toStrictEqual([]);
  });

  it("skips classes that only appear inside a condition", () => {
    expect(subjectClasses(".title:not(.muted)")).toStrictEqual(["title"]);
    expect(subjectClasses("& .title")).toStrictEqual(["title"]);
  });
});
