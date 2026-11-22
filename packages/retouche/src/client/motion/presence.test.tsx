import "../../instrument";
import {
  cleanup,
  fireEvent,
  render,
  waitFor,
  within,
} from "@testing-library/react";
import { afterEach, beforeAll, describe, expect, it } from "vitest";

import { openButton, overlay, Page } from "../testing/layer-page";

const PRICING = /Pricing/;

function holdExits(): () => void {
  const { promise: finished, resolve } = Promise.withResolvers<null>();
  Object.defineProperty(HTMLElement.prototype, "getAnimations", {
    configurable: true,
    value: () => [{ finished }],
  });
  return () => {
    resolve(null);
  };
}

beforeAll(() => {
  Element.prototype.scrollIntoView = () => {};
});

afterEach(() => {
  cleanup();
  Reflect.deleteProperty(HTMLElement.prototype, "getAnimations");
  localStorage.clear();
  sessionStorage.clear();
});

describe("an override fixed while its row is listed", () => {
  it("keeps the row on screen, out of reach, until its exit has played", async () => {
    const finishExits = holdExits();
    const { rerender } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: PRICING });

    rerender(<Page />);

    await waitFor(() => {
      expect(within(panel).queryByRole("button", { name: PRICING })).toBeNull();
    });
    expect(within(panel).getByText(PRICING)).toBeTruthy();
    finishExits();
    await waitFor(() => {
      expect(within(panel).queryByText(PRICING)).toBeNull();
    });
  });

  it("leaves nothing behind when the panel was closed", async () => {
    holdExits();
    const { rerender } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    await waitFor(() => {
      expect(within(panel).getByText(PRICING)).toBeTruthy();
    });

    rerender(<Page />);

    await waitFor(() => {
      expect(within(panel).queryByText(PRICING)).toBeNull();
    });
  });

  it("takes the row out at once when there is no exit to play", async () => {
    const { rerender } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    await within(panel).findByRole("button", { name: PRICING });

    rerender(<Page />);

    await waitFor(() => {
      expect(within(panel).queryByText(PRICING)).toBeNull();
    });
  });
});

describe("a lens whose last override is fixed", () => {
  it("stays on screen, out of reach, until its exit has played", async () => {
    const finishExits = holdExits();
    const { rerender } = render(<Page headline="text-lg" />);
    const panel = await waitFor(overlay);
    fireEvent.click(openButton(panel));
    const lenses = await within(panel).findByRole("list", { name: /filter/i });
    await within(lenses).findByRole("button", { name: /size/i });

    rerender(<Page />);

    await waitFor(() => {
      expect(
        within(lenses).queryByRole("button", { name: /size/i })
      ).toBeNull();
    });
    expect(within(lenses).getByText(/size/i)).toBeTruthy();
    finishExits();
    await waitFor(() => {
      expect(within(lenses).queryByText(/size/i)).toBeNull();
    });
  });
});
