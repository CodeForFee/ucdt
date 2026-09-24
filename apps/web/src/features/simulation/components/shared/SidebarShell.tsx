import { useState, type ReactNode } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";

interface SidebarShellProps {
  title: string;
  icon: ReactNode;
  collapsedIcons?: ReactNode;
  children: ReactNode;
}

export function SidebarShell({ title, icon, collapsedIcons, children }: SidebarShellProps) {
  const [collapsed, setCollapsed] = useState(false);

  return (
    <div
      className={`absolute top-0 left-0 h-full z-20 flex flex-col bg-card/95 backdrop-blur-sm border-r border-border shadow-xl transition-all duration-300 ${collapsed ? "w-10" : "w-[340px]"}`}
    >
      <button
        onClick={() => setCollapsed((c) => !c)}
        className="absolute -right-3 top-4 z-30 h-6 w-6 rounded-full bg-card border border-border flex items-center justify-center shadow-md hover:bg-muted transition-colors"
      >
        {collapsed ? <ChevronRight className="h-3 w-3" /> : <ChevronLeft className="h-3 w-3" />}
      </button>

      {collapsed ? (
        <div className="flex flex-col items-center gap-4 pt-8 text-muted-foreground">{collapsedIcons}</div>
      ) : (
        <div className="flex flex-col h-full overflow-hidden">
          <div className="flex items-center gap-2 px-4 py-3 border-b border-border shrink-0">
            {icon}
            <span className="text-sm font-semibold">{title}</span>
          </div>
          {children}
        </div>
      )}
    </div>
  );
}
