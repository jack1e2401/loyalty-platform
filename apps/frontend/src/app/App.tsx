import { Link, Navigate, Route, Routes, useSearchParams } from "react-router-dom";
import { AuthSessionProvider, useAuthSession } from "../api/auth-session";
import { Button } from "../components/ui";
import { LoginPage, RegisterPage } from "../features/auth/AuthPages";
import { RequireRole } from "../features/auth/RequireRole";
import { EditorialArtPanel } from "../components/EditorialArtPanel";
import { BackendConsoleLayout } from "../layouts/BackendConsoleLayout";
import {
  MerchantLoyalty,
  MerchantOrders,
  MerchantOverview,
  MerchantProducts,
  MerchantStore,
  MerchantVouchers,
} from "../features/merchant/BackendMerchantPages";
import { MerchantCategoriesPage } from "../features/merchant/MerchantCategoriesPage";
import { MerchantSettingsPage } from "../features/merchant/MerchantSettingsPage";
import { MerchantInventoryPage } from "../features/merchant/MerchantInventoryPage";
import { MerchantProductEditorPage } from "../features/catalog/merchant/products/MerchantProductEditorPage";
import { MerchantCustomersPage } from "../features/customers/MerchantCustomersPage";
import { MerchantCustomerDetailPage } from "../features/customers/MerchantCustomerDetailPage";
import { MerchantAnalyticsPage } from "../features/analytics/MerchantAnalyticsPage";
import {
  MemberCart,
  MemberCheckout,
  MemberOrderResult,
  MemberOrders,
  MemberProduct,
  MemberRewards,
  MemberStorefront,
  MemberVouchers,
  MemberWallet,
} from "../features/member/BackendMemberPages";
import { MemberLanding } from "../features/member/MemberLanding";
import { MerchantStorefrontEditor } from "../features/storefront/MerchantStorefrontEditor";
import { PublicStorefrontPage } from "../features/storefront/PublicStorefrontPage";
import { StorefrontAuthGate, StorefrontShellLayout } from "../features/storefront/StorefrontShellLayout";
import { StorefrontProductsPage } from "../features/storefront/StorefrontProductsPage";
import { StorefrontProfilePage } from "../features/storefront/StorefrontProfilePage";
import { LegacyMemberRedirect } from "../features/storefront/LegacyMemberRedirect";
import { PublicProductDetail } from "../features/member/PublicProductDetail";
import { MerchantEventsPage } from "../features/events/MerchantEventsPage";
import { PublicEventsPage } from "../features/events/PublicEventsPage";
import { PublicEventDetailPage } from "../features/events/PublicEventDetailPage";
import { ChallengesPage } from "../features/challenges/ChallengesPage";
import { ChallengeDetailPage } from "../features/challenges/ChallengeDetailPage";
import { MerchantChallengesPage } from "../features/merchant/challenges/MerchantChallengesPage";
import { MerchantChallengeDetailPage } from "../features/merchant/challenges/MerchantChallengeDetailPage";
import { MerchantChallengeEditorPage } from "../features/merchant/challenges/MerchantChallengeEditorPage";
import { MerchantRefundRequestsPage } from "../features/merchant/refunds/MerchantRefundRequestsPage";
import { RewardsHubLayout } from "../features/storefront/RewardsHubLayout";

export function App() {
  return (
    <AuthSessionProvider>
      <BackendRoutes />
    </AuthSessionProvider>
  );
}

function BackendRoutes() {
  return (
    <Routes>
      <Route path="/" element={<Welcome />} />
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route element={<RequireRole role="MERCHANT" />}>
        <Route path="/merchant" element={<BackendConsoleLayout />}>
          <Route index element={<MerchantOverview />} />
          <Route path="store" element={<MerchantStore />} />
          <Route path="settings" element={<MerchantSettingsPage />} />
          <Route path="storefront" element={<MerchantStorefrontEditor />} />
          <Route path="products/new" element={<MerchantProductEditorPage />} />
          <Route path="products/:productId/edit" element={<MerchantProductEditorPage />} />
          <Route path="products" element={<MerchantProducts />} />
          <Route path="inventory/:kind/:id" element={<MerchantInventoryPage />} />
          <Route path="events" element={<MerchantEventsPage />} />
          <Route path="challenges" element={<MerchantChallengesPage />} />
          <Route path="challenges/new" element={<MerchantChallengeEditorPage />} />
          <Route path="challenges/:challengeId/edit" element={<MerchantChallengeEditorPage />} />
          <Route path="challenges/:challengeId" element={<MerchantChallengeDetailPage />} />
          <Route path="refund-requests" element={<MerchantRefundRequestsPage />} />
          <Route path="orders" element={<MerchantOrders />} />
          <Route path="loyalty">
            <Route index element={<LegacyMerchantLoyaltyRedirect />} />
            <Route path="config" element={<MerchantLoyalty />} />
            <Route path="transactions" element={<MerchantLoyalty />} />
            <Route path="history" element={<MerchantLoyalty />} />
            <Route path="members" element={<MerchantLoyalty />} />
          </Route>
          <Route path="categories" element={<MerchantCategoriesPage />} />
          <Route path="vouchers" element={<MerchantVouchers />} />
          <Route path="customers" element={<MerchantCustomersPage />} />
          <Route path="customers/:memberId" element={<MerchantCustomerDetailPage />} />
          <Route path="analytics" element={<MerchantAnalyticsPage />} />
          <Route path="rewards" element={<Navigate to="/merchant/orders?tab=rewards" replace />} />
        </Route>
      </Route>
      <Route path="/s/:slug" element={<StorefrontShellLayout />}>
        <Route index element={<PublicStorefrontPage />} />
        <Route path="products" element={<StorefrontProductsPage />} />
        <Route path="products/:productId" element={<PublicProductDetail />} />
        <Route path="events" element={<PublicEventsPage />} />
        <Route path="events/:eventSlug" element={<PublicEventDetailPage />} />
        <Route path="profile" element={<StorefrontProfilePage />} />
        <Route element={<RewardsHubLayout />}>
          <Route path="challenges" element={<ChallengesPage />} />
          <Route path="challenges/:challengeId" element={<ChallengeDetailPage />} />
          <Route path="vouchers" element={<MemberVouchers />} />
          <Route path="rewards" element={<MemberRewards />} />
        </Route>
        <Route element={<StorefrontAuthGate />}>
          <Route path="cart" element={<MemberCart />} />
          <Route path="checkout" element={<MemberCheckout />} />
          <Route path="wallet" element={<MemberWallet />} />
          <Route path="orders" element={<MemberOrders />} />
          <Route path="orders/:orderId" element={<MemberOrderResult />} />
          <Route path="profile" element={<StorefrontProfilePage />} />
        </Route>
      </Route>
      <Route element={<RequireRole role="MEMBER" />}>
        <Route path="/member" element={<MemberLanding />} />
        <Route path="/member/:merchantId" element={<LegacyMemberRedirect />}>
          <Route index element={<MemberStorefront />} />
          <Route path="product/:productId" element={<MemberProduct />} />
          <Route path="cart" element={<MemberCart />} />
          <Route path="checkout" element={<MemberCheckout />} />
          <Route path="wallet" element={<MemberWallet />} />
          <Route path="vouchers" element={<MemberVouchers />} />
          <Route path="rewards" element={<MemberRewards />} />
          <Route path="orders" element={<MemberOrders />} />
          <Route path="orders/:orderId" element={<MemberOrderResult />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
}

function LegacyMerchantLoyaltyRedirect() {
  const [searchParams] = useSearchParams();
  const tab = searchParams.get("tab");
  const route =
    tab === "ledger"
      ? "transactions"
      : tab === "history"
        ? "history"
        : tab === "members"
          ? "members"
          : "history";
  const queryParams = new URLSearchParams(searchParams);
  queryParams.delete("tab");
  const query = queryParams.size ? `?${queryParams.toString()}` : "";
  return <Navigate to={`/merchant/loyalty/${route}${query}`} replace />;
}

function Welcome() {
  const { user } = useAuthSession();
  if (user) return <Navigate to={user.role === "MERCHANT" ? "/merchant" : "/member"} replace />;
  return (
    <main className="min-h-dvh overflow-x-clip bg-[#f5f5ef] px-5 py-6 sm:px-9 sm:py-8">
      <div className="mx-auto max-w-7xl">
        <LandingHeader />
        <LandingBody>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="group rounded-full px-7">
              <Link to="/login">
                Đăng nhập{" "}
                <span aria-hidden="true" className="transition-transform group-hover:translate-x-1">
                  →
                </span>
              </Link>
            </Button>
            <Button asChild size="lg" variant="outline" className="rounded-full px-7">
              <Link to="/register">Tạo tài khoản</Link>
            </Button>
          </div>
        </LandingBody>
      </div>
    </main>
  );
}

function LandingHeader() {
  return (
    <header className="flex h-12 items-center justify-between">
      <Link
        to="/"
        className="flex items-center gap-2.5 text-xl font-extrabold tracking-[-.06em] text-[#24452f]"
      >
        <span className="grid h-10 w-10 place-items-center rounded-[15px] bg-[#335e3d] text-lg text-[#c9f097]">
          L
        </span>
        loyalty<span className="text-[#89b461]">.</span>
      </Link>
    </header>
  );
}

function LandingBody({ children }: { children: React.ReactNode }) {
  return (
    <section className="grid min-h-[calc(100dvh-6rem)] items-center gap-9 py-10 lg:grid-cols-[.92fr_1.08fr] lg:gap-16 lg:py-8">
      <div className="relative z-10 max-w-[36rem] lg:py-12">
        <h1 className="serif max-w-[11ch] text-[clamp(3.5rem,7.4vw,6.8rem)] leading-[.94] tracking-[-.06em] text-[#24452f]">
          Mua ở nơi bạn yêu.
          <span className="mt-2 block text-[#77975e]">Quay lại vì được nhớ.</span>
        </h1>
        <p className="mt-6 max-w-md text-base leading-7 text-[#65766a] sm:text-lg sm:leading-8">
          Tích điểm và nhận ưu đãi riêng tại từng cửa hàng thân quen.
        </p>
        <div className="mt-8">{children}</div>
      </div>
      <div className="relative mx-auto w-full max-w-[39rem] lg:mr-0">
        <div className="absolute -inset-4 -rotate-2 rounded-[2.4rem] bg-[#dfe8d5] sm:-inset-6 sm:rounded-[3rem]" />
        <EditorialArtPanel className="rounded-[2rem] shadow-[0_28px_70px_rgba(38,63,43,.18)] sm:rounded-[2.6rem]" />
      </div>
    </section>
  );
}
