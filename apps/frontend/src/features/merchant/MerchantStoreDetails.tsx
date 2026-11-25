import { ArrowUpRight } from "@phosphor-icons/react";
import { Link } from "react-router-dom";
import { createCommerceClient } from "../../api/commerce-http";
import type { StoreProfileResponse } from "../../api/storefront-types";
import { useResource } from "../../api/useResource";
import { Button, Card, Skeleton, StatusText } from "../../components/ui";
import { money, number } from "../../lib/utils";
import { MerchantStoreProfileForm } from "./MerchantStoreProfileForm";

const api = createCommerceClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");
const tierName: Record<string, string> = {
  BRONZE: "Bronze", SILVER: "Silver", GOLD: "Gold", PLATINUM: "Platinum",
};

export function MerchantStoreDetails({ data, token }: { data: StoreProfileResponse; token: string }) {
  const { merchant, counts } = data;
  const metrics = [
    ["Khách hàng thành viên", counts.members],
    ["Đơn hàng tháng này", counts.monthlyOrders],
    ["Sản phẩm đang bán", counts.activeProducts],
  ] as const;

  return (
    <div className="grid items-start gap-5 xl:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      <MerchantStoreProfileForm key={merchant.id} data={data} token={token} />
      <div className="grid min-w-0 gap-5">
        <Card className="space-y-4 border-[#284c35] bg-[#284c35] p-5 text-white sm:p-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-lg font-extrabold">Trạng thái hoạt động & kênh bán</h2>
            <span className="text-sm font-semibold text-[#d9edc8]">● {merchant.isActive ? "Hoạt động" : "Không hoạt động"}</span>
          </div>
          <dl className="grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/10 p-2.5">
                <dt className="text-xs text-white/85">{label}</dt>
                <dd className="mt-1 text-lg font-bold">{number(value)}</dd>
              </div>
            ))}
          </dl>
          <Button asChild size="sm" variant="outline">
            <Link to={`/s/${merchant.slug}`} target="_blank" rel="noopener">
              Mở cửa hàng <ArrowUpRight aria-hidden="true" size={14} />
            </Link>
          </Button>
        </Card>
        <MerchantLoyaltySummary token={token} />
      </div>
    </div>
  );
}

function MerchantLoyaltySummary({ token }: { token: string }) {
  const loyalty = useResource(() => api.getLoyaltyConfig(token).then(({ config }) => config), [token]);
  const config = loyalty.data;

  return (
    <Card role="region" aria-labelledby="store-loyalty-title" className="min-w-0 p-5 sm:p-6">
      <h2 id="store-loyalty-title" className="text-lg font-extrabold">
        Chương trình loyalty
      </h2>
      {loyalty.loading ? (
        <div role="status" className="mt-4">
          <span className="sr-only">Đang tải cấu hình loyalty</span>
          <Skeleton className="h-40 motion-reduce:animate-none" />
        </div>
      ) : loyalty.error ? (
        <div className="mt-4 space-y-3">
          <p role="alert" className="text-sm text-[#53685a]">
            Không tải được cấu hình loyalty.
          </p>
          <Button type="button" variant="outline" size="sm" onClick={loyalty.reload}>
            Thử lại
          </Button>
        </div>
      ) : config ? (
        <>
          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 rounded-2xl bg-[#eef4e9] p-4">
            <div>
              <p className="text-xs font-semibold text-[#53685a]">Tỷ lệ quy đổi</p>
              <p className="mt-1 text-sm font-extrabold text-[#294833]">
                {money(config.vndPerPoint)} = 1 điểm
              </p>
            </div>
            <StatusText tone={config.isActive ? "green" : "amber"}>
              {config.isActive ? "Đang tích điểm" : "Tạm dừng"}
            </StatusText>
          </div>
          <ul className="mt-3 divide-y divide-[#e9ede6]" aria-label="Các hạng thành viên">
            {config.tiers.map((tier) => (
              <li
                key={tier.level}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-sm"
              >
                <span className="font-bold">{tier.name ?? tierName[tier.level] ?? tier.level}</span>
                <span className="text-[#53685a]">{config.qualificationMode === "SPEND" ? `${number(Number(tier.minSpendVnd ?? 0))} ₫` : `${number(tier.minLifetimePoints ?? 0)} điểm`}</span>
                <span className="min-w-9 text-right font-bold text-[#406d47]">
                  {number(Number(tier.multiplier))}×
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <Button asChild size="sm" variant="outline" className="mt-4">
        <Link to="/merchant/loyalty/config">
          Chỉnh cấu hình loyalty <ArrowUpRight aria-hidden="true" size={14} />
        </Link>
      </Button>
    </Card>
  );
}
