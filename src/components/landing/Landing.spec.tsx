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
import KnowledgeEcosystemGraph from "./KnowledgeEcosystemGraph";
import HeadingEmphasis, { SectionHeading } from "./HeadingEmphasis";

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
  CheckLineIcon: () => <span data-testid="check-line-icon" />,
  CloseIcon: () => <span data-testid="close-icon" />,
  DocsIcon: () => <span data-testid="docs-icon" />,
  ShootingStarIcon: () => <span data-testid="star-icon" />,
  TaskIcon: () => <span data-testid="task-icon" />,
  TimeIcon: () => <span data-testid="time-icon" />,
  FileIcon: () => <span data-testid="file-icon" />,
  InfoIcon: () => <span data-testid="info-icon" />,
  LockIcon: () => <span data-testid="lock-icon" />,
  UserIcon: () => <span data-testid="user-icon" />,
  ChevronDownIcon: () => <span data-testid="chevron-down-icon" />,
}));

describe("Continuum AI — Living Knowledge Experience", () => {
  describe("HeadingEmphasis & SectionHeading", () => {
    it("renders gradient, blue, underline, and contrast variants", () => {
      render(
        <div>
          <HeadingEmphasis variant="gradient">Tri thức phải ở lại</HeadingEmphasis>
          <HeadingEmphasis variant="blue">Xác minh con người</HeadingEmphasis>
          <HeadingEmphasis variant="underline">Bằng chứng thực thi</HeadingEmphasis>
          <HeadingEmphasis variant="contrast">Chuyển giao</HeadingEmphasis>
        </div>
      );
      expect(screen.getByText("Tri thức phải ở lại")).toBeInTheDocument();
      expect(screen.getByText("Xác minh con người")).toBeInTheDocument();
      expect(screen.getByText("Bằng chứng thực thi")).toBeInTheDocument();
      expect(screen.getByText("Chuyển giao")).toBeInTheDocument();
    });

    it("renders SectionHeading with badge, regular text and emphasized phrase", () => {
      render(
        <SectionHeading
          badge="Quy trình thử nghiệm"
          regularText="Khi nhân sự rời dự án,"
          emphasizedText="tri thức phải ở lại."
          emphasisVariant="blue"
          description="Mô tả kiểm tra cho SectionHeading"
        />
      );
      expect(screen.getByText("Quy trình thử nghiệm")).toBeInTheDocument();
      expect(screen.getByText("Khi nhân sự rời dự án,")).toBeInTheDocument();
      expect(screen.getByText("tri thức phải ở lại.")).toBeInTheDocument();
      expect(screen.getByText("Mô tả kiểm tra cho SectionHeading")).toBeInTheDocument();
    });
  });

  describe("LandingNavbar", () => {
    it("renders navigation links and call to actions", () => {
      render(<LandingNavbar />);
      expect(screen.getByText("Giải pháp")).toBeInTheDocument();
      expect(screen.getByText("Tính năng")).toBeInTheDocument();
      expect(screen.getByText("Cách hoạt động")).toBeInTheDocument();
      expect(screen.getByText("Đăng nhập")).toBeInTheDocument();
      expect(screen.getAllByText("Trải nghiệm bản demo").length).toBeGreaterThan(0);
    });

    it("toggles mobile menu on button click", () => {
      render(<LandingNavbar />);
      const toggleBtn = screen.getByRole("button", { name: /toggle navigation menu/i });
      fireEvent.click(toggleBtn);
      expect(screen.getAllByText("Giải pháp").length).toBe(2);
    });
  });

  describe("LandingHero", () => {
    it("renders value prop headline, principles and CTA buttons", () => {
      render(<LandingHero />);
      expect(screen.getByText("Nhân sự có thể rời dự án.")).toBeInTheDocument();
      expect(screen.getByText("Tri thức phải ở lại.")).toBeInTheDocument();
      expect(
        screen.getByText(/Lưu vết quyết định kỹ thuật, liên kết bằng chứng và bàn giao trọn vẹn/i)
      ).toBeInTheDocument();
      expect(screen.getAllByText("Trải nghiệm bản demo").length).toBeGreaterThan(0);
      expect(screen.getByText("Khám phá cách hoạt động")).toBeInTheDocument();
      expect(screen.getByText("Ghi nhận trong quá trình làm việc")).toBeInTheDocument();
      expect(screen.getByText("Tri thức có nguồn và kiểm chứng")).toBeInTheDocument();
      expect(screen.getByText("Con người giữ quyền xác nhận")).toBeInTheDocument();
    });
  });

  describe("KnowledgeEcosystemGraph (Hero Knowledge Trace)", () => {
    it("renders Continuum Knowledge Trace with interactive decision journey", () => {
      render(<KnowledgeEcosystemGraph />);
      expect(screen.getByText("CONTINUUM KNOWLEDGE TRACE")).toBeInTheDocument();
      expect(
        screen.getByText("Tại sao nhóm quyết định chọn Redis Pub/Sub?")
      ).toBeInTheDocument();
      expect(screen.getAllByText("Work Note WN-104").length).toBeGreaterThan(0);
      expect(screen.getByText("Ghi nhận")).toBeInTheDocument();
      expect(screen.getByText("Bằng chứng")).toBeInTheDocument();
      expect(screen.getByText("Thẩm định")).toBeInTheDocument();
      expect(screen.getByText("Tiếp nối")).toBeInTheDocument();

      // Click on stage 2: Bằng chứng
      fireEvent.click(screen.getByText("Bằng chứng"));
      expect(
        screen.getByText("Liên kết PR #88 và Báo cáo kiểm thử tải")
      ).toBeInTheDocument();
      expect(screen.getByText(/PR #88: feat\(iam\) redis-pubsub/i)).toBeInTheDocument();

      // Click on stage 3: Thẩm định
      fireEvent.click(screen.getByText("Thẩm định"));
      expect(
        screen.getByText("Tech Lead đối chiếu hạ tầng & phê duyệt chính thức")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Trần Thị B \(Tech Lead \/ System Architect\)/i)
      ).toBeInTheDocument();
    });
  });

  describe("LandingProblemSolution", () => {
    it("renders visual before/after comparison with Slack fragments vs Continuum stream", () => {
      render(<LandingProblemSolution />);
      expect(screen.getByText("Khi nhân sự thay đổi,")).toBeInTheDocument();
      expect(screen.getByText("tri thức không được phép biến mất.")).toBeInTheDocument();
      expect(
        screen.getByText("Cách làm cũ: Rời rạc & Thất thoát")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Tiếp nối có bằng chứng & kiểm chứng")
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Slack #backend • 3 tuần trước/i)
      ).toBeInTheDocument();
      expect(
        screen.getByText(/Work Note WN-104 \(Nguyễn Văn A\)/i)
      ).toBeInTheDocument();
    });
  });

  describe("LandingFeatures", () => {
    it("renders Bento Grid with unified IAM and Caching project story", () => {
      render(<LandingFeatures />);
      expect(
        screen.getByText("Ghi nhận tri thức ngay khi công việc diễn ra")
      ).toBeInTheDocument();
      expect(screen.getByText("AI đề xuất. Con người xác minh.")).toBeInTheDocument();
      expect(
        screen.getByText("Câu trả lời có thể kiểm chứng nguồn")
      ).toBeInTheDocument();
      expect(screen.getByText("Bàn giao không mất ngữ cảnh")).toBeInTheDocument();
      expect(
        screen.getByText("Tri thức không còn là những mảnh rời rạc")
      ).toBeInTheDocument();
      expect(
        screen.getByText("Kiến trúc Redis Pub/Sub & Token Revocation")
      ).toBeInTheDocument();
    });
  });

  describe("LandingHowItWorks", () => {
    it("renders 4 sequential stages with unified story and core principle", () => {
      render(<LandingHowItWorks />);
      expect(screen.getByText("Ghi nhận")).toBeInTheDocument();
      expect(screen.getByText("Đề xuất")).toBeInTheDocument();
      expect(screen.getByText("Kiểm chứng")).toBeInTheDocument();
      expect(screen.getByText("Bàn giao")).toBeInTheDocument();
      expect(
        screen.getByText(/AI hỗ trợ tổng hợp và đề xuất; Tech Lead trực tiếp rà soát bằng chứng/i)
      ).toBeInTheDocument();
    });
  });

  describe("LandingDemoSection", () => {
    it("allows switching between interactive demo tabs and shows verification workflow", () => {
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
      expect(screen.getByText("Tri thức hôm nay.")).toBeInTheDocument();
      expect(
        screen.getByText("Sức mạnh cho người kế nhiệm ngày mai.")
      ).toBeInTheDocument();
      expect(screen.getByText(/Mọi quyền được bảo lưu/i)).toBeInTheDocument();
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
