import {
  act,
  cleanup,
  fireEvent,
  render,
  screen,
} from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import messages from "@/messages/en.json";
import BackgroundVideo from "./BackgroundVideo";
import KnowledgeOrbit from "./KnowledgeOrbit";

vi.mock("next/image", () => ({
  default: ({
    priority,
    fill,
    ...props
  }: {
    priority?: boolean;
    fill?: boolean;
  }) => {
    void priority;
    void fill;
    // eslint-disable-next-line @next/next/no-img-element, jsx-a11y/alt-text
    return <img {...props} />;
  },
}));
vi.mock("@/components/common/BrandLogo", () => ({
  default: () => <span>Continuum AI</span>,
}));
vi.mock("@/icons", () => ({
  DocsIcon: () => <span />,
  CheckCircleIcon: () => <span />,
  LockIcon: () => <span />,
}));

let intersection: IntersectionObserverCallback;
let preferenceChange: () => void;
let reducedMotion: boolean;
let hidden: boolean;

function visible(isIntersecting = true) {
  act(() =>
    intersection(
      [{ isIntersecting } as IntersectionObserverEntry],
      {} as IntersectionObserver,
    ),
  );
}

function renderMedia(component: React.ReactNode) {
  return render(
    <NextIntlClientProvider locale="en" messages={messages}>
      {component}
    </NextIntlClientProvider>,
  );
}

beforeEach(() => {
  reducedMotion = false;
  hidden = false;
  vi.stubGlobal(
    "IntersectionObserver",
    class {
      constructor(callback: IntersectionObserverCallback) {
        intersection = callback;
      }
      observe() {}
      disconnect() {}
    },
  );
  vi.stubGlobal(
    "matchMedia",
    vi.fn(() => ({
      get matches() {
        return reducedMotion;
      },
      addEventListener: (_event: string, listener: () => void) => {
        preferenceChange = listener;
      },
      removeEventListener: vi.fn(),
    })),
  );
  vi.spyOn(document, "hidden", "get").mockImplementation(() => hidden);
  vi.spyOn(HTMLMediaElement.prototype, "play").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("play"));
    return Promise.resolve();
  });
  vi.spyOn(HTMLMediaElement.prototype, "pause").mockImplementation(function (
    this: HTMLMediaElement,
  ) {
    this.dispatchEvent(new Event("pause"));
  });
  vi.spyOn(HTMLMediaElement.prototype, "load").mockImplementation(() => {});
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe("Landing media playback", () => {
  it("loads a local muted looping video only when it enters view, without video controls", () => {
    const { container } = renderMedia(<BackgroundVideo scene="hero" />);
    const video = container.querySelector("video")!;
    expect(video).toHaveAttribute("preload", "none");
    expect(video).toHaveAttribute("playsinline");
    expect(video).not.toHaveAttribute("controls");
    expect(video.muted).toBe(true);
    expect(video.loop).toBe(true);
    expect(video.querySelector("source")).toHaveAttribute(
      "src",
      "/videos/landing/team-collaboration.mp4",
    );
    expect(video.play).not.toHaveBeenCalled();
    visible();
    expect(video.play).toHaveBeenCalledOnce();
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("pauses offscreen and resumes when the video returns to view", () => {
    const { container } = renderMedia(<BackgroundVideo scene="handover" />);
    const video = container.querySelector("video")!;
    visible();
    expect(video.play).toHaveBeenCalledOnce();
    vi.mocked(video.pause).mockClear();
    visible(false);
    expect(video.pause).toHaveBeenCalled();
    visible();
    expect(video.play).toHaveBeenCalledTimes(2);
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });

  it("keeps a static poster under reduced motion", () => {
    reducedMotion = true;
    const { container } = renderMedia(<BackgroundVideo scene="hero" />);
    visible();
    expect(container.querySelector("video")!.play).not.toHaveBeenCalled();
    expect(container.querySelector("video")).toHaveAttribute(
      "poster",
      "/videos/landing/team-collaboration-poster.jpg",
    );
  });

  it("pauses when the tab is hidden and when reduced motion is enabled", () => {
    const { container } = renderMedia(<BackgroundVideo scene="hero" />);
    const video = container.querySelector("video")!;
    visible();
    vi.mocked(video.pause).mockClear();
    hidden = true;
    fireEvent(document, new Event("visibilitychange"));
    expect(video.pause).toHaveBeenCalled();
    hidden = false;
    fireEvent(document, new Event("visibilitychange"));
    expect(video.play).toHaveBeenCalledTimes(2);
    vi.mocked(video.pause).mockClear();
    reducedMotion = true;
    act(() => preferenceChange());
    expect(video.pause).toHaveBeenCalled();
  });

  it("keeps the poster and offers retry when the media source fails", () => {
    const { container } = renderMedia(<BackgroundVideo scene="hero" />);
    visible();
    fireEvent.error(container.querySelector("source")!);
    expect(container.querySelector("video")).toHaveAttribute("hidden");
    expect(screen.getByRole("status")).toHaveTextContent(
      "Showing a still image instead",
    );
    fireEvent.click(screen.getByRole("button", { name: "Retry video" }));
    expect(container.querySelector("video")).not.toHaveAttribute("hidden");
    expect(container.querySelector("video")!.load).toHaveBeenCalledOnce();
    expect(screen.queryByRole("status")).not.toBeInTheDocument();
  });

  it("retains the poster without controls when the browser refuses autoplay", async () => {
    vi.mocked(HTMLMediaElement.prototype.play).mockRejectedValue(
      new Error("Autoplay denied"),
    );
    const { container } = renderMedia(<BackgroundVideo scene="hero" />);
    visible();
    await act(async () => {});
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    expect(container.querySelector("video")).not.toHaveAttribute("hidden");
    expect(container.querySelector("video")).toHaveAttribute("poster");
  });
});

describe("Animated knowledge orbit", () => {
  it("animates automatically without controls and pauses offscreen", () => {
    const { container } = renderMedia(<KnowledgeOrbit />);
    visible();
    expect(container.querySelector("[data-playing]")).toHaveAttribute(
      "data-playing",
      "true",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
    visible(false);
    expect(container.querySelector("[data-playing]")).toHaveAttribute(
      "data-playing",
      "false",
    );
  });

  it("starts with a static illustration for reduced motion", () => {
    reducedMotion = true;
    const { container } = renderMedia(<KnowledgeOrbit />);
    visible();
    expect(container.querySelector("[data-playing]")).toHaveAttribute(
      "data-playing",
      "false",
    );
    expect(screen.queryByRole("button")).not.toBeInTheDocument();
  });
});
