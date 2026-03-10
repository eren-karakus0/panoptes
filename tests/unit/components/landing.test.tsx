import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";

// Mock motion/react to avoid animation complexity in tests
vi.mock("motion/react", () => ({
  motion: new Proxy(
    {},
    {
      get: (_target: unknown, prop: string) => {
        const Component = React.forwardRef(
          (props: Record<string, unknown>, ref: React.Ref<HTMLElement>) => {
            // eslint-disable-next-line @typescript-eslint/no-unused-vars
            const { variants: _v, initial: _i, animate: _a, custom: _c, whileHover: _wh, whileTap: _wt, ...rest } = props;
            return React.createElement(prop, { ...rest, ref });
          }
        );
        Component.displayName = `motion.${prop}`;
        return Component;
      },
    }
  ),
  useInView: () => true,
  useMotionValue: (_initial: number) => ({
    set: vi.fn(),
    get: () => _initial,
    on: () => vi.fn(),
  }),
  useSpring: () => ({
    on: () => vi.fn(),
  }),
}));

// Mock next/image
vi.mock("next/image", () => ({
  default: (props: Record<string, unknown>) => {
    // eslint-disable-next-line @typescript-eslint/no-unused-vars
    const { fill: _f, priority: _p, ...rest } = props;
    // eslint-disable-next-line jsx-a11y/alt-text, @next/next/no-img-element
    return <img {...rest} />;
  },
}));

// Mock next/link
vi.mock("next/link", () => ({
  default: ({ children, href, ...rest }: { children: React.ReactNode; href: string }) => (
    <a href={href} {...rest}>
      {children}
    </a>
  ),
}));

describe("Hero", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("renders app name and tagline", async () => {
    const { Hero } = await import("@/components/landing/hero");
    render(<Hero />);
    expect(screen.getByText("Panoptes")).toBeDefined();
    expect(screen.getByText("Chain Intelligence, Unblinking.")).toBeDefined();
  });

  it("renders View Dashboard and GitHub links", async () => {
    const { Hero } = await import("@/components/landing/hero");
    render(<Hero />);
    const dashLink = screen.getByText("View Dashboard");
    expect(dashLink.closest("a")).toBeDefined();
    expect(dashLink.closest("a")?.getAttribute("href")).toBe("/dashboard");

    const ghLink = screen.getByText("GitHub");
    expect(ghLink.closest("a")?.getAttribute("target")).toBe("_blank");
    expect(ghLink.closest("a")?.getAttribute("rel")).toContain("noopener");
  });

  it("renders logo image", async () => {
    const { Hero } = await import("@/components/landing/hero");
    render(<Hero />);
    const logo = screen.getByAltText("Panoptes logo");
    expect(logo).toBeDefined();
    expect(logo.getAttribute("src")).toBe("/logo.svg");
  });
});

describe("Features", () => {
  it("renders section title and 6 feature cards", async () => {
    const { Features } = await import("@/components/landing/features");
    render(<Features />);
    expect(screen.getByText("Comprehensive Chain Intelligence")).toBeDefined();
    expect(screen.getByText("Validator Monitoring")).toBeDefined();
    expect(screen.getByText("Endpoint Health")).toBeDefined();
    expect(screen.getByText("Intelligence Layer")).toBeDefined();
    expect(screen.getByText("Smart Routing")).toBeDefined();
    expect(screen.getByText("Preflight Validation")).toBeDefined();
    expect(screen.getByText("Anomaly Detection")).toBeDefined();
  });
});

describe("HowItWorks", () => {
  it("renders 3 steps", async () => {
    const { HowItWorks } = await import("@/components/landing/how-it-works");
    render(<HowItWorks />);
    expect(screen.getByText("How It Works")).toBeDefined();
    expect(screen.getByText("Index")).toBeDefined();
    expect(screen.getByText("Analyze")).toBeDefined();
    expect(screen.getByText("Route")).toBeDefined();
  });
});

describe("ApiTeaser", () => {
  it("renders code snippet and CTA", async () => {
    const { ApiTeaser } = await import("@/components/landing/api-teaser");
    render(<ApiTeaser />);
    expect(screen.getByText("Developer-Friendly API")).toBeDefined();
    expect(screen.getByText("Explore Dashboard")).toBeDefined();
    expect(screen.getByText(/endpoints\/best/)).toBeDefined();
  });
});

describe("CallToAction", () => {
  it("renders CTA buttons and footer", async () => {
    const { CallToAction } = await import("@/components/landing/cta");
    render(<CallToAction />);
    expect(screen.getByText("Start Monitoring Now")).toBeDefined();
    expect(screen.getByText("Open Dashboard")).toBeDefined();
    expect(screen.getByText("Join Discord")).toBeDefined();
  });

  it("renders version badge with correct version", async () => {
    const { CallToAction } = await import("@/components/landing/cta");
    render(<CallToAction />);
    expect(screen.getByText("v0.4.0")).toBeDefined();
  });

  it("renders copyright and license", async () => {
    const { CallToAction } = await import("@/components/landing/cta");
    render(<CallToAction />);
    expect(screen.getByText("MIT License")).toBeDefined();
    const year = new Date().getFullYear();
    expect(screen.getByText(new RegExp(`© ${year} Panoptes`))).toBeDefined();
  });

  it("external links have security attributes", async () => {
    const { CallToAction } = await import("@/components/landing/cta");
    render(<CallToAction />);
    const discordLinks = screen.getAllByLabelText("Discord");
    for (const link of discordLinks) {
      expect(link.getAttribute("target")).toBe("_blank");
      expect(link.getAttribute("rel")).toContain("noopener");
    }
  });
});
