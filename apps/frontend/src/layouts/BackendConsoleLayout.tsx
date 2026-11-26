import { useEffect, useLayoutEffect, useState } from "react";
import { Link, NavLink, Outlet, useLocation, useNavigate } from "react-router-dom";
import {
  ArrowSquareOut,
  CaretDown,
  ChartBar,
  Gauge,
  List,
  Megaphone,
  Package,
  SignOut,
  Storefront,
  UsersThree,
  X,
} from "@phosphor-icons/react";
import { useAuthSession } from "../api/auth-session";
import { createCommerceClient } from "../api/commerce-http";
import { useResource } from "../api/useResource";
import { ErrorState, LoadingState } from "../components/ui";
import { cn } from "../lib/utils";
import { Breadcrumb, type BreadcrumbProps } from "antd";
import { MerchantCmsProvider } from "../features/merchant/cms";
import { HikariLogo } from "../components/brand/HikariLogo";

const commerce = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

const merchantGroups = [
  {
    label: "Vận hành",
    icon: Gauge,
    links: [
      ["/merchant", "Tổng quan"],
      ["/merchant/orders", "Đơn hàng"],
      ["/merchant/refund-requests", "Hoàn tiền"],
    ],
  },
  {
    label: "Sản phẩm",
    icon: Package,
    links: [
      ["/merchant/products", "Sản phẩm"],
      ["/merchant/categories", "Danh mục"],
    ],
  },
  {
    label: "Cửa hàng",
    icon: Storefront,
    links: [
      ["/merchant/store", "Thông tin cửa hàng"],
      ["/merchant/storefront", "Giao diện cửa hàng"],
    ],
  },
  {
    label: "Khách hàng",
    icon: UsersThree,
    links: [["/merchant/customers", "Danh sách khách hàng"]],
  },
  {
    label: "Loyalty",
    icon: UsersThree,
    links: [
      ["/merchant/loyalty/config", "Điểm thưởng"],
      ["/merchant/vouchers", "Voucher"],
    ],
  },
  {
    label: "Marketing",
    icon: Megaphone,
    links: [
      ["/merchant/events", "Sự kiện"],
      ["/merchant/challenges", "Nhiệm vụ"],
    ],
  },
  {
    label: "Báo cáo",
    icon: ChartBar,
    links: [["/merchant/analytics", "Phân tích"]],
  },
];

export function BackendConsoleLayout() {
  const [menuOpen, setMenuOpen] = useState(false);
  const [loyaltyConfigDirty, setLoyaltyConfigDirty] = useState(false);
  const { user, logout } = useAuthSession();
  const navigate = useNavigate();
  const location = useLocation();

  useEffect(() => {
    const updateDirty = (event: Event) => setLoyaltyConfigDirty(Boolean((event as CustomEvent<boolean>).detail));
    window.addEventListener("loyalty-config-dirty", updateDirty);
    return () => window.removeEventListener("loyalty-config-dirty", updateDirty);
  }, []);

  const [expandedGroups, setExpandedGroups] = useState<Record<string, boolean>>(() =>
    Object.fromEntries(
      merchantGroups.map((group) => [
        group.label,
        group.links.some(
          ([to]) =>
            location.pathname === to ||
            (to !== "/merchant" && location.pathname.startsWith(`${to}/`)),
        ) ||
          (group.label === "Loyalty" && location.pathname.startsWith("/merchant/loyalty/")) ||
          (group.label === "Marketing" &&
            (location.pathname.startsWith("/merchant/challenges") ||
              location.pathname.startsWith("/merchant/events"))),
      ]),
    ),
  );

  const [pointsExpanded, setPointsExpanded] = useState(() =>
    location.pathname.startsWith("/merchant/loyalty/"),
  );

  useEffect(() => {
    const active = merchantGroups.find(
      (group) =>
        group.links.some(
          ([to]) =>
            location.pathname === to ||
            (to !== "/merchant" && location.pathname.startsWith(`${to}/`)),
        ) ||
        (group.label === "Loyalty" && location.pathname.startsWith("/merchant/loyalty/")) ||
        (group.label === "Marketing" &&
          (location.pathname.startsWith("/merchant/challenges") ||
            location.pathname.startsWith("/merchant/events"))),
    );
    if (active) setExpandedGroups((current) => ({ ...current, [active.label]: true }));
  }, [location.pathname]);

  useLayoutEffect(() => {
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  }, [location.pathname]);

  const routeLabels = merchantGroups.flatMap((group) => group.links);
  const loyaltyQuery = new URLSearchParams(location.search);
  const loyaltyMode = loyaltyQuery.get("mode");
  const loyaltyVersion = loyaltyQuery.get("version");
  const challengePageTitle =
    location.pathname === "/merchant/challenges/new"
      ? "Tạo nhiệm vụ"
      : /^\/merchant\/challenges\/\d+\/edit\/?$/.test(location.pathname)
        ? "Chỉnh sửa nhiệm vụ"
        : /^\/merchant\/challenges\/\d+\/?$/.test(location.pathname)
          ? "Chi tiết nhiệm vụ"
          : undefined;
  const loyaltyEditorTitle =
    location.pathname === "/merchant/loyalty/config"
      ? loyaltyMode === "new"
        ? "Tạo chính sách mới"
        : loyaltyMode === "edit"
          ? `Chỉnh sửa chính sách hiện tại${/^\d+$/.test(loyaltyVersion ?? "") ? ` · v${loyaltyVersion}` : ""}`
          : undefined
      : undefined;
  const pageTitle =
    loyaltyEditorTitle ??
    (location.pathname.split("/").filter(Boolean).length > 1
      ? (location.pathname.startsWith("/merchant/inventory/") ? "Tồn kho" : undefined) ??
        challengePageTitle ??
        routeLabels.find(
          ([to]) =>
            to !== "/merchant" &&
            (location.pathname === to || location.pathname.startsWith(`${to}/`)),
        )?.[1] ??
        "Cửa hàng"
      : "Tổng quan");
  const breadcrumbs = merchantBreadcrumbItems(location.pathname, location.search, pageTitle);

  return (
    <MerchantCmsProvider enabled>
      <div className="min-h-dvh bg-[#f0f2f5] lg:pl-64">
        {menuOpen && (
          <button
            aria-label="Đóng menu"
            className="fixed inset-0 z-40 bg-black/50 backdrop-blur-xs lg:hidden"
            onClick={() => setMenuOpen(false)}
          />
        )}
        <aside
          className={cn(
            "fixed inset-y-0 left-0 z-50 flex w-64 flex-col bg-[#11231a] text-white shadow-2xl transition-transform duration-200 lg:translate-x-0 lg:shadow-none",
            menuOpen ? "translate-x-0" : "-translate-x-full",
          )}
        >
          {/* Top Brand Logo */}
          <div className="flex h-16 shrink-0 items-center justify-between border-b border-white/[0.08] px-5">
            <Link to="/merchant" className="transition hover:opacity-90">
              <HikariLogo theme="dark" size={32} />
            </Link>
            <button
              aria-label="Đóng menu"
              className="grid size-8 place-items-center rounded-lg text-white/70 transition hover:bg-white/10 hover:text-white lg:hidden"
              onClick={() => setMenuOpen(false)}
            >
              <X size={18} />
            </button>
          </div>

          {/* Navigation Groups */}
          <nav
            aria-label="Điều hướng chính"
            className="merchant-sidebar-scroll flex-1 space-y-1 overflow-y-auto px-3 py-3"
          >
            {merchantGroups.map((group, index) => {
              const GroupIcon = group.icon;
              const groupId = `merchant-nav-group-${index}`;
              const isExpanded = expandedGroups[group.label] ?? false;

              return (
                <section key={group.label} className="space-y-0.5">
                  <button
                    type="button"
                    aria-expanded={isExpanded}
                    aria-controls={groupId}
                    onClick={() =>
                      setExpandedGroups((current) => ({
                        ...current,
                        [group.label]: !current[group.label],
                      }))
                    }
                    className="flex h-10 w-full items-center justify-between rounded-lg px-3 text-left text-[13.5px] font-medium text-white/75 transition duration-150 hover:bg-white/[0.06] hover:text-white focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#c7ec9f]"
                  >
                    <span className="flex min-w-0 items-center gap-3">
                      <GroupIcon size={18} weight="regular" className="shrink-0 text-white/70" />
                      <span className="truncate">{group.label}</span>
                    </span>
                    <CaretDown
                      size={14}
                      aria-hidden="true"
                      className={cn(
                        "shrink-0 text-white/40 transition-transform duration-200",
                        isExpanded && "rotate-180",
                      )}
                    />
                  </button>

                  <div id={groupId} hidden={!isExpanded} className="ml-3.5 space-y-0.5 border-l border-white/10 py-1 pl-3">
                    {group.links.map(([to, label]) => (
                      <div key={to}>
                        {to === "/merchant/loyalty/config" ? (
                          <button
                            type="button"
                            aria-expanded={pointsExpanded}
                            onClick={() => setPointsExpanded((expanded) => !expanded)}
                            className="flex h-8.5 w-full items-center justify-between rounded-md px-2.5 text-[12.5px] font-normal text-white/70 transition hover:bg-white/[0.06] hover:text-white"
                          >
                            <span className="flex items-center gap-2">
                              <span className="size-1.5 rounded-full bg-white/35" />
                              {label}
                            </span>
                            <CaretDown
                              size={12}
                              className={cn("transition-transform", pointsExpanded && "rotate-180")}
                            />
                          </button>
                        ) : (
                          <NavLink
                            to={to}
                            end={to === "/merchant"}
                            onClick={() => setMenuOpen(false)}
                            onClickCapture={(event) => {
                              if (loyaltyConfigDirty && to !== location.pathname) {
                                event.preventDefault();
                                event.stopPropagation();
                                window.alert("Vui lòng lưu cấu hình trước khi rời trang.");
                              }
                            }}
                            className={({ isActive }) =>
                              cn(
                                "group flex h-8.5 items-center gap-2 rounded-md px-2.5 text-[12.5px] font-normal text-white/65 transition duration-150 hover:bg-white/[0.06] hover:text-white",
                                isActive &&
                                  "bg-white/[0.12] text-white font-medium shadow-2xs",
                              )
                            }
                          >
                            {({ isActive }) => (
                              <>
                                <span
                                  className={cn(
                                    "size-1.5 shrink-0 rounded-full bg-white/25 transition",
                                    isActive && "bg-[#c7ec9f]",
                                  )}
                                />
                                {label}
                              </>
                            )}
                          </NavLink>
                        )}
                        {to === "/merchant/loyalty/config" && pointsExpanded && (
                          <div className="ml-2.5 space-y-0.5 border-l border-white/10 py-0.5 pl-2">
                            {[
                              ["/merchant/loyalty/history", "Chính sách điểm"],
                              ["/merchant/loyalty/transactions", "Lịch sử điểm"],
                              ["/merchant/loyalty/members", "Điểm của thành viên"],
                            ].map(([childTo, childLabel]) => (
                              <NavLink
                                key={childTo}
                                to={childTo}
                                end
                                onClickCapture={(event) => {
                                  if (loyaltyConfigDirty && childTo !== location.pathname) {
                                    event.preventDefault();
                                    event.stopPropagation();
                                    window.alert("Vui lòng lưu cấu hình trước khi rời trang.");
                                  }
                                }}
                                className={({ isActive }) =>
                                  cn(
                                    "block h-7.5 rounded-md px-2 py-1 text-[12px] font-normal text-white/60 transition hover:bg-white/[0.06] hover:text-white",
                                    isActive && "bg-white/[0.12] text-white font-medium",
                                  )
                                }
                              >
                                {childLabel}
                              </NavLink>
                            ))}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </section>
              );
            })}
          </nav>

          {/* User Profile & Sign out at Bottom */}
          <div className="shrink-0 border-t border-white/[0.08] p-3">
            <div className="flex items-center justify-between rounded-lg bg-white/[0.04] p-2">
              <div className="flex min-w-0 items-center gap-2.5">
                <span className="grid size-7 shrink-0 place-items-center rounded-full bg-[#315b3b] text-xs font-bold text-[#d8f5bb]">
                  {(user?.email?.[0] ?? "M").toUpperCase()}
                </span>
                <span className="truncate text-xs text-white/80">{user?.email ?? "Tài khoản"}</span>
              </div>
              <button
                type="button"
                aria-label="Đăng xuất"
                title="Đăng xuất"
                className="grid size-7 place-items-center rounded-md text-white/50 transition hover:bg-white/10 hover:text-white"
                onClick={() => {
                  logout();
                  navigate("/login", { replace: true });
                }}
              >
                <SignOut size={16} />
              </button>
            </div>
          </div>
        </aside>

        {/* Top Header */}
        <header className="sticky top-0 z-30 flex h-14 items-center justify-between border-b border-[#e9ede6] bg-white px-5 sm:px-7">
          <div className="flex items-center gap-3">
            <button
              aria-label="Mở menu"
              className="grid size-9 place-items-center rounded-lg text-[#294833] transition hover:bg-[#eaf0e8] lg:hidden"
              onClick={() => setMenuOpen(true)}
            >
              <List size={22} />
            </button>
            <div className="min-w-0">
              <Breadcrumb aria-label="Breadcrumb" className="text-[11px]" items={breadcrumbs} />
              <p className="font-semibold text-[15px] leading-tight text-[#11231a]">{pageTitle}</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <span className="hidden items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-medium text-emerald-700 sm:inline-flex">
              <span className="size-1.5 rounded-full bg-emerald-500" />
              Hoạt động
            </span>
            <Link
              to="/s/hikari-coffee"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 px-3 py-1.5 text-xs font-medium text-gray-700 transition hover:bg-gray-50"
            >
              <span>Xem gian hàng</span>
              <ArrowSquareOut size={13} />
            </Link>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="mx-auto max-w-[1400px] p-5 sm:p-6 lg:p-8">
          <MerchantAccess />
        </main>
      </div>
    </MerchantCmsProvider>
  );
}

function MerchantAccess() {
  const { accessToken } = useAuthSession();
  const resource = useResource(() => commerce.getOwnMerchant(accessToken!), [accessToken]);
  if (resource.loading) return <LoadingState cards={2} />;
  if (resource.error) return <ErrorState message={resource.error} retry={resource.reload} />;
  if (!resource.data?.merchant.isActive)
    return <ErrorState message="Cửa hàng chưa hoạt động." retry={resource.reload} />;
  return <Outlet />;
}

function merchantBreadcrumbItems(
  pathname: string,
  search: string,
  pageTitle: string,
): BreadcrumbProps["items"] {
  if (pathname === "/merchant") return [{ title: "Tổng quan" }];

  let parent: { path: string; label: string } | null = null;
  let current = pageTitle;
  const query = new URLSearchParams(search);
  const orderId = Number(query.get("orderId"));
  const voucherId = Number(query.get("voucherId"));
  const requestId = Number(query.get("requestId"));

  if (pathname === "/merchant/loyalty/config" && (query.get("mode") === "new" || query.get("mode") === "edit")) {
    parent = { path: "/merchant/loyalty/history", label: "Chính sách điểm" };
    const version = query.get("version");
    current = query.get("mode") === "new"
      ? "Tạo chính sách mới"
      : `Chỉnh sửa chính sách hiện tại${version && /^\d+$/.test(version) ? ` · v${version}` : ""}`;
  } else if (Number.isSafeInteger(orderId) && orderId > 0) {
    parent = { path: "/merchant/orders", label: "Đơn hàng" };
    current = `Đơn #${orderId}`;
  } else if (Number.isSafeInteger(voucherId) && voucherId > 0) {
    parent = { path: "/merchant/orders", label: "Đơn hàng" };
    current = `Quà đổi thưởng #${voucherId}`;
  } else if (Number.isSafeInteger(requestId) && requestId > 0) {
    parent = { path: "/merchant/refund-requests", label: "Hoàn tiền" };
    current = `Yêu cầu #${requestId}`;
  } else if (/^\/merchant\/inventory\/(product|reward|voucher)\/\d+\/?$/.test(pathname)) {
    parent = pathname.includes("/inventory/voucher/") ? { path: "/merchant/vouchers", label: "Voucher" } : { path: "/merchant/products", label: "Sản phẩm" };
    current = pathname.includes("/inventory/voucher/") ? "Lượt phát hành" : "Tồn kho";
  } else if (/^\/merchant\/challenges\/(new|\d+(\/edit)?)\/?$/.test(pathname)) {
    parent = { path: "/merchant/challenges", label: "Nhiệm vụ" };
  } else if (/^\/merchant\/products\/(new|\d+\/edit)\/?$/.test(pathname)) {
    parent = { path: "/merchant/products", label: "Sản phẩm" };
    current = pathname.endsWith("/new") ? "Thêm sản phẩm" : "Chỉnh sửa sản phẩm";
  } else if (/^\/merchant\/customers\/[^/]+\/?$/.test(pathname)) {
    parent = { path: "/merchant/customers", label: "Khách hàng" };
    current = "Chi tiết khách hàng";
  }

  return [
    { title: <Link to="/merchant">Tổng quan</Link> },
    ...(parent ? [{ title: <Link to={parent.path}>{parent.label}</Link> }] : []),
    { title: current },
  ];
}
