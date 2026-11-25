import { Link, NavLink, Navigate, Outlet, useLocation, useNavigate, useParams } from "react-router-dom";
import { useEffect, useMemo, type CSSProperties } from "react";
import {
  House,
  ShoppingCart,
  SquaresFour,
  Storefront,
  UserCircle,
  Wallet,
  Trophy,
} from "@phosphor-icons/react";
import * as Dialog from "@radix-ui/react-dialog";
import { useAuthSession } from "../../../api/auth-session";
import { createStorefrontClient, resolveStorefrontAssetUrl } from "../../../api/storefront-client";
import { useResource } from "../../../api/useResource";
import { Button, ErrorState, LoadingState } from "../../../components/ui";
import { useEnsureMembership } from "../../customers/useEnsureMembership";
import { useMemberCart } from "../../member/useMemberCart";
import {
  useStorefrontShell,
  type StorefrontShellContext,
  type StorefrontShellData,
} from "../shared/storefront-context";
import { Breadcrumbs } from "../../../components/ui/Breadcrumbs";
import { storefrontAccent } from "../shared/storefront-theme";
import "../shared/storefront-theme.css";

const storefrontApi = createStorefrontClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function StorefrontShellLayout() {
  const { slug = "" } = useParams();
  const { user } = useAuthSession();

  useEnsureMembership({ slug, enabled: true });

  const resource = useResource<StorefrontShellData>(async () => {
    const pub = await storefrontApi.getPublicStorefront(slug);
    return {
      merchant: pub.merchant,
      config: pub.config,
      featuredProducts: pub.featuredProducts,
      categories: pub.categories,
      upcomingEvents: pub.upcomingEvents,
    };
  }, [slug]);

  if (resource.loading && !resource.data) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-8 sm:px-7">
        <LoadingState cards={3} />
      </main>
    );
  }

  if (resource.error || !resource.data) {
    return (
      <main className="mx-auto max-w-4xl px-4 py-12 sm:px-7">
        <ErrorState
          message={
            resource.error === "MERCHANT_NOT_FOUND"
              ? "Không tìm thấy cửa hàng hoặc cửa hàng đã tạm ngưng."
              : (resource.error ?? "Không tải được trang cửa hàng.")
          }
          retry={resource.reload}
        />
      </main>
    );
  }

  const data = resource.data;
  const storageKey =
    user?.role === "MEMBER"
      ? `loyalty.member.cart.${user.id}.${data.merchant.id}`
      : `loyalty.guest.cart.${data.merchant.id}`;

  return <StorefrontChrome key={storageKey} storageKey={storageKey} data={data} />;
}

function StorefrontChrome({ storageKey, data }: { storageKey: string; data: StorefrontShellData }) {
  const location = useLocation();
  const cart = useMemberCart(storageKey, data.merchant.id);
  const accent = storefrontAccent(data.config.branding.primaryColor);
  const themedStorefront = useMemo(() => ({
    ...data,
    config: { ...data.config, branding: { ...data.config.branding, primaryColor: accent } },
  }), [data, accent]);
  useEffect(() => {
    const root = document.documentElement;
    const previousAccent = root.style.getPropertyValue("--storefront-accent");
    const previousActive = root.getAttribute("data-storefront-active");
    root.style.setProperty("--storefront-accent", accent);
    root.setAttribute("data-storefront-active", "");
    return () => {
      if (previousAccent) root.style.setProperty("--storefront-accent", previousAccent);
      else root.style.removeProperty("--storefront-accent");
      if (previousActive === null) root.removeAttribute("data-storefront-active");
      else root.setAttribute("data-storefront-active", previousActive);
    };
  }, [accent]);
  const basePath = `/s/${data.merchant.slug}`;
  const logoSrc = resolveStorefrontAssetUrl(data.config.branding.logoUrl);
  const cartCount = cart.quantity;

  const navTabs = [
    { to: basePath, label: "Trang chủ", icon: House, end: true },
    { to: `${basePath}/products`, label: "Sản phẩm", icon: SquaresFour },
    { to: `${basePath}/challenges`, label: "Săn thưởng", icon: Trophy, rewards: true },
    { to: `${basePath}/wallet`, label: "Ví điểm", icon: Wallet },
    { to: `${basePath}/profile`, label: "Cá nhân", icon: UserCircle },
  ];

  const contextValue: StorefrontShellContext = {
    merchantId: data.merchant.id,
    basePath,
    slug: data.merchant.slug,
    accent,
    storefront: themedStorefront,
    cart,
  };

  return (
    <div className="storefront-theme min-h-dvh bg-[#fcfcf8] pb-20 lg:pb-8" style={{ "--storefront-accent": accent } as CSSProperties}>

      <header className="sticky top-0 z-20 border-b border-[#e5ece3] bg-[#fcfcf8]/95 backdrop-blur">
        <div className="mx-auto flex h-14 max-w-6xl items-center justify-between gap-3 px-3 sm:px-6">
          <Link
            to={basePath}
            className="flex min-w-0 items-center gap-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
          >
            {logoSrc ? (
              <img
                src={logoSrc}
                alt={data.merchant.name}
                className="h-8 w-8 shrink-0 rounded-xl object-cover ring-1 ring-black/5"
              />
            ) : (
              <span
                className="grid h-8 w-8 shrink-0 place-items-center rounded-xl text-white"
                style={{ backgroundColor: accent }}
              >
                <Storefront aria-hidden="true" size={18} />
              </span>
            )}
            <span className="truncate text-sm font-extrabold tracking-tight text-[#20392a] sm:text-base">
              {data.merchant.name}
            </span>
          </Link>

          <nav aria-label="Điều hướng cửa hàng" className="hidden items-center gap-1 lg:flex">
            {navTabs.map(({ to, label, end, rewards }) => (
              <NavLink
                key={to}
                to={to}
                end={end}
                className={({ isActive }) => {
                  const active = rewards
                    ? /^\/s\/[^/]+\/(challenges|vouchers|rewards)(\/|$)/.test(location.pathname)
                    : isActive || (to.endsWith("/profile") && location.pathname.includes("/orders"));
                  return `rounded-full px-3.5 py-1.5 text-xs font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] ${
                    active ? "bg-[#e8f1e2] text-[#24452f]" : "text-[#637468] hover:bg-[#eff5eb]"
                  }`;
                }}
                style={() =>
                  (
                    rewards
                      ? /^\/s\/[^/]+\/(challenges|vouchers|rewards)(\/|$)/.test(location.pathname)
                      : location.pathname === to ||
                        location.pathname.startsWith(`${to}/`) ||
                        (to.endsWith("/profile") && location.pathname.includes("/orders"))
                  )
                    ? { color: accent }
                    : undefined
                }
              >
                {label}
              </NavLink>
            ))}
          </nav>

          <Link
            to={`${basePath}/cart`}
            aria-label={cartCount > 0 ? `Giỏ hàng, ${cartCount} sản phẩm` : "Giỏ hàng"}
            className="relative inline-flex shrink-0 items-center gap-1.5 rounded-full bg-[#edf4e9] px-3 py-1.5 text-xs font-bold text-[#24452f] transition hover:bg-[#e1ecd9] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d]"
            style={{ color: accent }}
          >
            <ShoppingCart aria-hidden="true" size={17} />
            <span className="hidden sm:inline">Giỏ hàng</span>
            {cartCount > 0 && (
              <span
                className="inline-flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-extrabold leading-none text-white tabular-nums"
                style={{ backgroundColor: accent }}
              >
                {cartCount}
              </span>
            )}
          </Link>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-3 py-4 sm:px-6 sm:py-7">
        <div className="mb-4">
          <Breadcrumbs basePath={basePath} merchantName={data.merchant.name} />
        </div>
        <Outlet context={contextValue} />
      </main>

      <nav
        aria-label="Điều hướng Mini App"
        className="fixed inset-x-0 bottom-0 z-30 flex border-t border-[#e5ece3] bg-[#fcfcf8]/95 px-1 pb-[max(env(safe-area-inset-bottom),6px)] pt-1.5 backdrop-blur lg:hidden"
      >
        {navTabs.map(({ to, label, icon: Icon, end, rewards }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => {
              const active = rewards
                ? /^\/s\/[^/]+\/(challenges|vouchers|rewards)(\/|$)/.test(location.pathname)
                : isActive || (to.endsWith("/profile") && location.pathname.includes("/orders"));
              return `flex min-h-[46px] min-w-0 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg py-1 text-[10px] font-bold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#335e3d] ${
                active ? "bg-[#e8f1e2] text-[#24452f]" : "text-[#6f7f74]"
              }`;
            }}
            style={() =>
              (
                rewards
                  ? /^\/s\/[^/]+\/(challenges|vouchers|rewards)(\/|$)/.test(location.pathname)
                  : location.pathname === to ||
                    location.pathname.startsWith(`${to}/`) ||
                    (to.endsWith("/profile") && location.pathname.includes("/orders"))
              )
                ? { color: accent }
                : undefined
            }
          >
            {({ isActive }) => {
              const active = rewards
                ? /^\/s\/[^/]+\/(challenges|vouchers|rewards)(\/|$)/.test(location.pathname)
                : isActive || (to.endsWith("/profile") && location.pathname.includes("/orders"));
              return (
                <>
                  <Icon aria-hidden="true" size={20} weight={active ? "fill" : "regular"} />
                  <span className="max-w-full truncate px-0.5 text-center leading-tight">{label}</span>
                </>
              );
            }}
          </NavLink>
        ))}
      </nav>
    </div>
  );
}

export function StorefrontAuthGate() {
  const { user, logout } = useAuthSession();
  const location = useLocation();
  const navigate = useNavigate();
  const shell = useStorefrontShell();
  const returnTo = encodeURIComponent(`${location.pathname}${location.search}`);
  const basePath = shell?.basePath ?? "/";

  if (!user) {
    return <Navigate to={`/login?returnTo=${returnTo}`} replace />;
  }
  if (user.role !== "MEMBER") {
    return (
      <Dialog.Root open onOpenChange={(open) => { if (!open) navigate(basePath, { replace: true }); }}>
        <Dialog.Portal>
          <Dialog.Overlay className="fixed inset-0 z-40 bg-black/40" />
          <Dialog.Content className="fixed left-1/2 top-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-2xl bg-white p-6 shadow-xl">
            <Dialog.Title className="text-xl font-bold">Đăng nhập tài khoản Member</Dialog.Title>
            <Dialog.Description className="mt-2 text-sm text-[#53685a]">
              Bạn đang đăng nhập bằng tài khoản Merchant. Đăng nhập bằng tài khoản Member để sử dụng chức năng này.
            </Dialog.Description>
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <Button variant="outline" onClick={() => navigate(basePath, { replace: true })}>Tiếp tục xem cửa hàng</Button>
              <Button onClick={() => { logout(); navigate(`/login?returnTo=${returnTo}`, { replace: true }); }}>Đăng nhập bằng tài khoản Member</Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    );
  }

  return <Outlet context={shell} />;
}
