import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import ContactPage from "./page";

describe("ContactPage", () => {
  it("renders the contact page with query client context", () => {
    render(<ContactPage />);

    expect(
      screen.getByRole("heading", {
        name: /contact\./i,
      })
    ).toBeInTheDocument();

    expect(
      screen.getByRole("button", { name: /send message/i })
    ).toBeInTheDocument();

    expect(screen.getByText(/san francisco/i)).toBeInTheDocument();
  });
});
