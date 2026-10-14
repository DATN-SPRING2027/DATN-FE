import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import LandingNavbar from "./LandingNavbar";
import LandingHero from "./LandingHero";
import LandingProblemSolution from "./LandingProblemSolution";
import LandingFeatures from "./LandingFeatures";
import LandingHowItWorks from "./LandingHowItWorks";
import LandingDemoSection from "./LandingDemoSection";
import LandingCtaFooter from "./LandingCtaFooter";
import Landing3DCard from "./Landing3DCard";

// Mock next-intl and navigation
vi.mock("@/i18n/navigation", () => ({
  Link: ({ children, href, className }: { children: React.ReactNode; href: string; className?: string }) => (
    <a href={href} className={className}>
      {children}
    </a>
  ),
}));

// Mock SVG icons for vitest environment
vi.mock("@/icons", () => ({
  ArrowRightIcon: () => <span data-testid="arrow-right-icon" />,
  CheckCircleIcon: () => <span data-testid="check-circle-icon" />,
  DocsIcon: () => <span data-testid="docs-icon" />,
  ShootingStarIcon: () => <span data-testid="star-icon" />,
  TaskIcon: () => <span data-testid="task-icon" />,
  TimeIcon: () => <span data-testid="time-icon" />,
  FileIcon: () => <span data-testid="file-icon" />,
  InfoIcon: () => <span data-testid="info-icon" />,
  ChevronDownIcon: () => <span data-testid="chevron-down-icon" />,
}));

describe("Landing Page Components", () => {
  describe("LandingNavbar", () => {
    it("renders navigation links and call to actions", () => {
      render(<LandingNavbar />);
      expect(screen.getByText("Giải pháp")).toBeInTheDocument();
      expect(screen.getByText("Tính năng")).toBeInTheDocument();
      expect(screen.getByText("Cách hoạt động")).toBeInTheDocument();
      expect(screen.getByText("Đăng nhập")).toBeInTheDocument();
      expect(screen.getAllByText("Khám phá bản demo").length).toBeGreaterThan(0);
    });

    it("toggles mobile menu on button click", () => {
      render(<LandingNavbar />);
      const toggleBtn = screen.getByRole("button", { name: /toggle navigation menu/i });
      fireEvent.click(toggleBtn);
      // After clicking, mobile menu links are rendered
      expect(screen.getAllByText("Giải pháp").length).toBe(2);
    });
  });

  describe("LandingHero", () => {
    it("renders value prop headline and CTA buttons", () => {
      render(<LandingHero />);
      expect(
        screen.getByText("Đừng để tri thức dự án rời đi cùng một thành viên.")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Nền tảng duy trì tri thức cho đội ngũ phần mềm")
      ).toBeInTheDocument();
      expect(screen.getByText("Tìm hiểu cách hoạt động")).toBeInTheDocument();
      expect(screen.getByText("Đã xác minh")).toBeInTheDocument();
      expect(screen.getByText(/Nguồn trích dẫn/i)).toBeInTheDocument();
    });
  });

  describe("LandingProblemSolution", () => {
    it("renders problem heading and 3 benefits cards", () => {
      render(<LandingProblemSolution />);
      expect(
        screen.getByText("Khi một người rời dự án, kiến thức không nên rời theo.")
      ).toBeInTheDocument();
      expect(screen.getByText("Ghi lại khi công việc đang diễn ra")).toBeInTheDocument();
      expect(screen.getByText("Biết điều gì đã được kiểm chứng")).toBeInTheDocument();
      expect(screen.getByText("Bàn giao có trọng tâm")).toBeInTheDocument();
    });
  });

  describe("LandingFeatures", () => {
    it("renders 4 main feature cards", () => {
      render(<LandingFeatures />);
      expect(screen.getByText("Work Notes và tài liệu")).toBeInTheDocument();
      expect(screen.getByText("Tri thức có kiểm chứng")).toBeInTheDocument();
      expect(screen.getByText("Trợ lý hỏi đáp có trích dẫn")).toBeInTheDocument();
      expect(screen.getByText("Quy trình bàn giao")).toBeInTheDocument();
    });
  });

  describe("LandingHowItWorks", () => {
    it("renders 4 sequential steps and explicit AI vs Human note", () => {
      render(<LandingHowItWorks />);
      expect(screen.getByText("Ghi nhận")).toBeInTheDocument();
      expect(screen.getByText("Đề xuất")).toBeInTheDocument();
      expect(screen.getByText("Kiểm chứng")).toBeInTheDocument();
      expect(screen.getByText("Bàn giao")).toBeInTheDocument();
      expect(
        screen.getByText(/AI đóng vai trò tổng hợp và đưa ra đề xuất; con người/i)
      ).toBeInTheDocument();
    });
  });

  describe("LandingDemoSection", () => {
    it("allows switching between interactive demo tabs", () => {
      render(<LandingDemoSection />);
      expect(screen.getByText("1. Kho tri thức dự án")).toBeInTheDocument();
      expect(screen.getByText("2. Thẩm định & Xác nhận")).toBeInTheDocument();
      expect(screen.getByText("3. Hỏi đáp có trích dẫn")).toBeInTheDocument();

      // Click tab 2
      fireEvent.click(screen.getByText("2. Thẩm định & Xác nhận"));
      expect(
        screen.getByText("Khu vực thẩm định tri thức (Lead Verification Workflow)")
      ).toBeInTheDocument();

      // Click tab 3
      fireEvent.click(screen.getByText("3. Hỏi đáp có trích dẫn"));
      expect(
        screen.getByText("Trợ lý Continuum AI — Hỏi đáp có trích dẫn nguồn")
      ).toBeInTheDocument();
    });
  });

  describe("LandingCtaFooter", () => {
    it("renders final CTA and footer copyright", () => {
      render(<LandingCtaFooter />);
      expect(
        screen.getByText("Giúp người kế nhiệm bắt đầu với đầy đủ ngữ cảnh.")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Mọi quyền được bảo lưu/i)
      ).toBeInTheDocument();
    });
  });

  describe("Landing3DCard", () => {
    it("handles mouse enter, move, and leave interactions smoothly", () => {
      const { container } = render(
        <Landing3DCard>
          <div>3D Card Content</div>
        </Landing3DCard>
      );
      const card = container.firstChild as HTMLElement;
      fireEvent.mouseEnter(card);
      fireEvent.mouseMove(card, { clientX: 100, clientY: 100 });
      expect(card.style.transformStyle).toBe("preserve-3d");
      fireEvent.mouseLeave(card);
      expect(card.style.transform).toContain("rotateX(0deg)");
    });
  });
});
