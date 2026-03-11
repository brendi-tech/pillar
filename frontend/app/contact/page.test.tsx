import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ContactPage from "./page";

describe("ContactPage", () => {
  it("renders the contact page with query client context", () => {
    render(<ContactPage />);

    expect(
      screen.getByRole("heading", {
        name: /bring your product questions straight to us/i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /send message/i })
    ).toBeInTheDocument();
  });
});
