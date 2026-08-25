import { useEffect, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { useAuth, isAdmin } from "../auth/AuthContext";
import { usePermissions } from "../api/permissions";
import { useTheme } from "../theme/ThemeContext";
import { useOrgSettings } from "../api/orgSettings";
import { GlobalSearch } from "./GlobalSearch";
import { NotificationBell } from "./NotificationBell";
import { SidebarQuickStats } from "./SidebarQuickStats";
import { SidebarRecentlyViewed } from "./SidebarRecentlyViewed";
import {
  DashboardIcon,
  SystemsIcon,
  ChartIcon,
  CalendarIcon,
  DocumentIcon,
  PlusCircleIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  LogoutIcon,
  UserIcon,
  ShieldIcon,
  SunIcon,
  MoonIcon,
} from "./Icons";

const ROLE_LABELS: Record<string, string> = {
  ADMIN: "Admin",
  COMPLIANCE_OFFICER: "Compliance Officer",
  SYSTEM_OWNER: "System Owner",
  APPROVER: "Approver",
  VIEWER: "Viewer",
};

const COLLAPSE_KEY = "sidebar-collapsed";

// Shown until an org uploads its own logo via Org Settings.
const DEFAULT_LOGO_ICON = "/governtrace-icon-square.png";

export function Sidebar() {
  const { user, logout } = useAuth();
  const { has } = usePermissions();
  const { theme, toggleTheme } = useTheme();
  const { data: orgSettings } = useOrgSettings();
  const navigate = useNavigate();
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(() => localStorage.getItem(COLLAPSE_KEY) === "true");
  const orgName = orgSettings?.orgName ?? "GovernTrace AI";
  const brandColor = orgSettings?.primaryColor ?? "#0f172a";

  useEffect(() => {
    localStorage.setItem(COLLAPSE_KEY, String(collapsed));
  }, [collapsed]);

  if (!user) return null;

  const isIntakePath = /\/systems\/(intake|[^/]+\/intake)$/.test(location.pathname);
  const isDashboard = location.pathname === "/";
  const isSystems = location.pathname.startsWith("/systems") && !isIntakePath;
  const isAnalytics = location.pathname.startsWith("/analytics");
  const isCalendar = location.pathname.startsWith("/calendar");
  const isPolicies = location.pathname.startsWith("/policies");
  const isAccount = location.pathname.startsWith("/account");
  const isAdminPath = location.pathname.startsWith("/admin");

  const mainItems = [
    { to: "/", label: "Dashboard", icon: DashboardIcon, active: isDashboard, show: true },
    { to: "/systems", label: "AI Use Cases Registry", icon: SystemsIcon, active: isSystems, show: true },
    { to: "/analytics", label: "Analytics", icon: ChartIcon, active: isAnalytics, show: true },
    { to: "/calendar", label: "Calendar", icon: CalendarIcon, active: isCalendar, show: true },
    { to: "/policies", label: "Policy Repository", icon: DocumentIcon, active: isPolicies, show: true },
    {
      to: "/systems/intake",
      label: "Register New Use Case",
      icon: PlusCircleIcon,
      active: isIntakePath,
      show: has("CREATE_SYSTEM"),
    },
  ];

  const adminItems = [{ to: "/admin", label: "Admin", icon: ShieldIcon, active: isAdminPath, show: isAdmin(user.role) }];

  function renderLink(item: { to: string; label: string; icon: typeof DashboardIcon; active: boolean }) {
    return (
      <Link
        key={item.to}
        to={item.to}
        title={collapsed ? item.label : undefined}
        style={item.active ? { backgroundColor: brandColor } : undefined}
        className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium ${
          item.active ? "text-white" : "text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800"
        } ${collapsed ? "justify-center px-0" : ""}`}
      >
        <item.icon className="h-5 w-5 shrink-0" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </Link>
    );
  }

  const themeToggleButton = (
    <button
      onClick={toggleTheme}
      title={theme === "dark" ? "Switch to light mode" : "Switch to dark mode"}
      aria-label="Toggle color theme"
      className={`flex shrink-0 items-center justify-center rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300 ${
        collapsed ? "h-9 w-full" : "h-9 w-9"
      }`}
    >
      {theme === "dark" ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );

  return (
    <aside
      className={`flex h-screen flex-col border-r border-slate-200 bg-white transition-all dark:border-slate-800 dark:bg-slate-900 ${
        collapsed ? "w-16" : "w-60"
      }`}
    >
      <div
        className={`flex items-center gap-2 border-b border-slate-200 px-3 py-4 dark:border-slate-800 ${collapsed ? "justify-center" : ""}`}
      >
        <img
          src={orgSettings?.logoUrl || DEFAULT_LOGO_ICON}
          alt={orgName}
          className="h-8 w-8 shrink-0 rounded-md object-cover"
        />
        {!collapsed && <span className="truncate text-sm font-semibold text-slate-900 dark:text-slate-100">{orgName}</span>}
      </div>

      {!collapsed && (
        <div className="border-b border-slate-200 px-3 py-3 dark:border-slate-800">
          <GlobalSearch />
        </div>
      )}

      {!collapsed && (
        <div className="border-b border-slate-200 dark:border-slate-800">
          <SidebarQuickStats />
        </div>
      )}

      <nav className="flex-1 space-y-1 overflow-y-auto px-2 py-4">
        {mainItems.filter((item) => item.show).map(renderLink)}

        {adminItems.some((item) => item.show) && (
          <>
            <div className={`mt-4 mb-1 ${collapsed ? "px-0" : "px-3"}`}>
              {!collapsed && (
                <span className="text-xs font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">
                  Administration
                </span>
              )}
              {collapsed && <div className="h-px bg-slate-200 dark:bg-slate-800" />}
            </div>
            {adminItems.filter((item) => item.show).map(renderLink)}
          </>
        )}

        {!collapsed && <SidebarRecentlyViewed />}
      </nav>

      <div className="border-t border-slate-200 px-2 py-3 dark:border-slate-800">
        {collapsed ? (
          <div className="mb-2 space-y-1">
            <button
              onClick={() => setCollapsed((c) => !c)}
              title="Expand"
              className="flex w-full items-center justify-center rounded-md px-0 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronRightIcon className="h-5 w-5" />
            </button>
            <NotificationBell collapsed={collapsed} />
            {themeToggleButton}
            <Link
              to="/account"
              title="Account"
              style={isAccount ? { backgroundColor: brandColor } : undefined}
              className={`flex h-9 w-full items-center justify-center rounded-md ${
                isAccount ? "text-white" : "text-slate-400 hover:bg-slate-100 hover:text-slate-600 dark:text-slate-500 dark:hover:bg-slate-800 dark:hover:text-slate-300"
              }`}
            >
              <UserIcon className="h-4 w-4" />
            </Link>
          </div>
        ) : (
          <div className="mb-2 flex items-center gap-1.5">
            <button
              onClick={() => setCollapsed((c) => !c)}
              title="Collapse"
              className="flex flex-1 items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-500 hover:bg-slate-100 dark:text-slate-400 dark:hover:bg-slate-800"
            >
              <ChevronLeftIcon className="h-5 w-5" />
              <span>Collapse</span>
            </button>
            <NotificationBell collapsed={collapsed} />
            {themeToggleButton}
          </div>
        )}

        {!collapsed && (
          <Link
            to="/account"
            title="Account settings"
            style={isAccount ? { backgroundColor: brandColor } : undefined}
            className={`mb-2 flex items-center gap-2 rounded-md px-3 py-2 ${
              isAccount ? "text-white" : "hover:bg-slate-100 dark:hover:bg-slate-800"
            }`}
          >
            <UserIcon className={`h-4 w-4 shrink-0 ${isAccount ? "text-white" : "text-slate-400 dark:text-slate-500"}`} />
            <div className="min-w-0">
              <div className={`truncate text-sm font-medium ${isAccount ? "text-white" : "text-slate-900 dark:text-slate-100"}`}>
                {user.name}
              </div>
              <div className={`text-xs ${isAccount ? "text-white/80" : "text-slate-500 dark:text-slate-400"}`}>
                {ROLE_LABELS[user.role]}
              </div>
            </div>
          </Link>
        )}

        <button
          onClick={async () => {
            await logout();
            navigate("/login");
          }}
          title={collapsed ? "Log Out" : undefined}
          className={`flex w-full items-center gap-3 rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100 dark:text-slate-300 dark:hover:bg-slate-800 ${
            collapsed ? "justify-center px-0" : ""
          }`}
        >
          <LogoutIcon className="h-5 w-5 shrink-0" />
          {!collapsed && <span>Log Out</span>}
        </button>
      </div>
    </aside>
  );
}
