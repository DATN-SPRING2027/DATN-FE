import { useSidebar } from "@/context/SidebarContext";

const Backdrop: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      className="fixed inset-x-0 top-14 bottom-0 z-30 bg-gray-950/40 backdrop-blur-[3px] xl:hidden dark:bg-gray-950/60"
      onClick={toggleMobileSidebar}
    />
  );
};

export default Backdrop;
