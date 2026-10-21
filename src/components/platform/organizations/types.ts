import type { FormEvent } from "react";
import type {
  PlatformOrganization,
  PlatformPage,
} from "@/lib/queries/platform/usePlatformConsole";
export type PlatformOrganizationsViewProps = {
  // Queries
  organizations: {
    data?: PlatformPage<PlatformOrganization>;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
  setOrganizationPage: (page: number) => void;

  // Permissions
  canReadOrganizations: boolean;
  canManageOrganizations: boolean;
  canCreateOrganization: boolean;
  canLookupUsers: boolean;

  // Selection & Details
  selectedOrganizationId: string;
  routeOrganizationId: string;
  hasValidRouteOrganizationId: boolean;

  // Create form state & mutations
  organizationName: string;
  setOrganizationName: (name: string) => void;
  organizationSlug: string;
  setOrganizationSlug: (slug: string) => void;
  organizationPlan: "FREE" | "ENTERPRISE";
  setOrganizationPlan: (plan: "FREE" | "ENTERPRISE") => void;
  lookupEmail: string;
  setLookupEmail: (email: string) => void;
  selectedUser: { id: string; email: string; fullName: string } | null;
  setSelectedUser: (
    user: { id: string; email: string; fullName: string } | null,
  ) => void;
  runLookup: () => Promise<boolean>;
  runCreateOrganization: (
    event: FormEvent<HTMLFormElement>,
  ) => Promise<boolean>;
  createOrganizationPending: boolean;
  lookupPending: boolean;

  // Detail view & Metadata edit
  organization: {
    data?: PlatformOrganization;
    isPending: boolean;
    isError: boolean;
    isFetching: boolean;
    refetch: () => Promise<unknown>;
  };
  changeOrganizationMetadata: {
    mutateAsync: (input: {
      organizationId: string;
      name?: string;
      slug?: string;
      expectedUpdatedAt: string;
      reasonCode: "SECURITY_INCIDENT" | "ACCESS_REVIEW";
    }) => Promise<unknown>;
    isPending: boolean;
  };
  // Modals & Messages
  setOperationMessage: (msg: string) => void;
  isCreateModalOpen: boolean;
  setIsCreateModalOpen: (open: boolean) => void;
};
