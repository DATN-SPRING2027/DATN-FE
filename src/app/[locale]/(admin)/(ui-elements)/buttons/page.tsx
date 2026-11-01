import ComponentCard from "@/components/common/ComponentCard";
import PageBreadcrumb from "@/components/common/PageBreadCrumb";
import Button from "@/components/ui/button/Button";
import CopyButton from "@/components/ui/button/CopyButton";
import { ArrowRightIcon, BoxIcon, TrashBinIcon } from "@/icons";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Buttons | Continuum AI",
  description:
    "Interactive Animate UI spring & ripple button system for Continuum AI",
};

export default function Buttons() {
  return (
    <div>
      <PageBreadcrumb pageTitle="Buttons" />
      <div className="space-y-5 sm:space-y-6">
        {/* Primary Button */}
        <ComponentCard title="Primary Button">
          <div className="flex flex-wrap items-center gap-5">
            <Button size="sm" variant="primary">
              Button Text
            </Button>
            <Button size="md" variant="primary">
              Button Text
            </Button>
            <Button size="sm" variant="primary" isLoading>
              Saving...
            </Button>
            <Button size="sm" variant="primary" disabled>
              Disabled
            </Button>
          </div>
        </ComponentCard>

        {/* Primary Button with Start Icon */}
        <ComponentCard title="Primary Button with Leading Icon">
          <div className="flex flex-wrap items-center gap-5">
            <Button size="sm" variant="primary" startIcon={<BoxIcon />}>
              Button Text
            </Button>
            <Button size="md" variant="primary" startIcon={<BoxIcon />}>
              Button Text
            </Button>
          </div>
        </ComponentCard>

        {/* Primary Button with Trailing Icon */}
        <ComponentCard title="Primary Button with Trailing Icon">
          <div className="flex flex-wrap items-center gap-5">
            <Button size="sm" variant="primary" endIcon={<ArrowRightIcon />}>
              Continue
            </Button>
            <Button size="md" variant="primary" endIcon={<ArrowRightIcon />}>
              Continue
            </Button>
          </div>
        </ComponentCard>

        {/* Outline Button */}
        <ComponentCard title="Secondary Button">
          <div className="flex flex-wrap items-center gap-5">
            <Button size="sm" variant="outline">
              Button Text
            </Button>
            <Button size="md" variant="outline">
              Button Text
            </Button>
          </div>
        </ComponentCard>

        {/* Outline Button with Start Icon */}
        <ComponentCard title="Outline Button with Leading Icon">
          <div className="flex flex-wrap items-center gap-5">
            <Button size="sm" variant="outline" startIcon={<BoxIcon />}>
              Button Text
            </Button>
            <Button size="md" variant="outline" startIcon={<BoxIcon />}>
              Button Text
            </Button>
          </div>
        </ComponentCard>

        {/* Outline Button with Trailing Icon */}
        <ComponentCard title="Outline Button with Trailing Icon">
          <div className="flex flex-wrap items-center gap-5">
            <Button size="sm" variant="outline" endIcon={<ArrowRightIcon />}>
              Button Text
            </Button>
            <Button size="md" variant="outline" endIcon={<ArrowRightIcon />}>
              Button Text
            </Button>
          </div>
        </ComponentCard>

        {/* Ghost, Danger & CopyButton States */}
        <ComponentCard title="Ghost, Destructive & Copy Buttons">
          <div className="flex flex-wrap items-center gap-4">
            <Button size="sm" variant="ghost">
              Ghost Action
            </Button>
            <Button
              size="sm"
              variant="danger"
              startIcon={<TrashBinIcon className="size-4" />}
            >
              Delete Item
            </Button>
            <CopyButton
              content="https://continuum.ai/workspace/invite"
              variant="outline"
              size="md"
              copiedLabel="Copied!"
            >
              Copy Invite Link
            </CopyButton>
            <CopyButton
              content="CONTINUUM-API-KEY-DEMO"
              variant="subtle"
              size="md"
            />
          </div>
        </ComponentCard>
      </div>
    </div>
  );
}
