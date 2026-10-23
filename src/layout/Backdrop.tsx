import { useSidebar } from "@/context/SidebarContext";

const Backdrop: React.FC = () => {
  const { isMobileOpen, toggleMobileSidebar } = useSidebar();

  if (!isMobileOpen) return null;

  return (
    <div
      className="fixed inset-x-0 top-14 bottom-0 z-30 bg-gray-900/50 xl:hidden"
      onClick={toggleMobileSidebar}
    />
  );
};

export default Backdrop;
