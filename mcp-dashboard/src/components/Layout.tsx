import { NavLink, Outlet } from "react-router-dom";
import { Zap, Key, Clock, LogOut } from "lucide-react";
import ThemeToggle from "@/components/ThemeToggle";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/App";

const navItems = [
  { to: "/", label: "Actions", icon: Zap },
  { to: "/auth", label: "Credentials", icon: Key },
  { to: "/history", label: "History", icon: Clock },
];

export default function Layout() {
  const { logout } = useAuth();

  return (
    <div className="flex h-screen">
      <aside className="w-56 border-r bg-muted/40 p-4 flex flex-col gap-1">
        <div className="flex items-center justify-between mb-4 px-2">
          <h1 className="text-lg font-bold">MCP Dashboard</h1>
          <ThemeToggle />
        </div>
        {navItems.map(({ to, label, icon: Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              `flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
                isActive
                  ? "bg-primary text-primary-foreground"
                  : "hover:bg-accent hover:text-accent-foreground"
              }`
            }
            end={to === "/"}
          >
            <Icon className="h-4 w-4" />
            {label}
          </NavLink>
        ))}
        <div className="mt-auto">
          <Button variant="ghost" size="sm" className="w-full justify-start gap-2" onClick={logout}>
            <LogOut className="h-4 w-4" />
            Logout
          </Button>
        </div>
      </aside>
      <main className="flex-1 overflow-auto p-6">
        <Outlet />
      </main>
    </div>
  );
}
