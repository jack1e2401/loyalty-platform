import { ArrowUpRight } from "@phosphor-icons/react";
import { Alert, Button, Flex, Skeleton } from "antd";
import { Link } from "react-router-dom";
import { createCommerceClient } from "../../api/commerce-http";
import type { StoreProfileResponse } from "../../api/storefront-types";
import { useResource } from "../../api/useResource";
import { money, number } from "../../lib/utils";
import { CmsCard, CmsStatusTag } from "./cms";
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
    <div className="grid items-start gap-6 xl:grid-cols-[minmax(0,55fr)_minmax(0,45fr)]">
      <MerchantStoreProfileForm key={merchant.id} data={data} token={token} />
      <div className="grid min-w-0 gap-6">
        <section className="space-y-4 rounded-xl border border-[#284c35] bg-[#284c35] p-5 text-white shadow-[0_1px_3px_rgba(32,57,42,0.08)] sm:p-6">
          <Flex align="center" justify="space-between" gap={8} wrap>
            <h2 className="m-0 text-lg font-extrabold text-white">Trạng thái hoạt động & kênh bán</h2>
            <CmsStatusTag
              label={merchant.isActive ? "Hoạt động" : "Không hoạt động"}
              tone={merchant.isActive ? "success" : "warning"}
            />
          </Flex>
          <dl className="m-0 grid grid-cols-3 gap-2">
            {metrics.map(([label, value]) => (
              <div key={label} className="rounded-xl bg-white/10 p-2.5">
                <dt className="text-xs text-white/85">{label}</dt>
                <dd className="mt-1 text-lg font-bold tabular-nums">{number(value)}</dd>
              </div>
            ))}
          </dl>
          <Link to={`/s/${merchant.slug}`} target="_blank" rel="noopener" className="inline-block">
            <Button size="small" icon={<ArrowUpRight size={14} />} iconPlacement="end">
              Mở cửa hàng
            </Button>
          </Link>
        </section>
        <MerchantLoyaltySummary token={token} />
      </div>
    </div>
  );
}

function MerchantLoyaltySummary({ token }: { token: string }) {
  const loyalty = useResource(() => api.getLoyaltyConfig(token).then(({ config }) => config), [token]);
  const config = loyalty.data;

  return (
    <CmsCard title="Chương trình loyalty">
      {loyalty.loading ? (
        <Skeleton active paragraph={{ rows: 4 }} />
      ) : loyalty.error ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          title="Không tải được cấu hình loyalty."
          action={
            <Button size="small" onClick={loyalty.reload}>
              Thử lại
            </Button>
          }
        />
      ) : config ? (
        <>
          <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-[#eef4e9] p-4">
            <div>
              <p className="m-0 text-xs font-semibold text-[#53685a]">Tỷ lệ quy đổi</p>
              <p className="m-0 mt-1 text-sm font-extrabold text-[#294833]">
                {money(config.vndPerPoint)} = 1 điểm
              </p>
            </div>
            <CmsStatusTag
              label={config.isActive ? "Đang tích điểm" : "Tạm dừng"}
              tone={config.isActive ? "success" : "warning"}
            />
          </div>
          <ul className="mt-3 divide-y divide-[#e9ede6] p-0" aria-label="Các hạng thành viên">
            {config.tiers.map((tier) => (
              <li
                key={tier.level}
                className="grid grid-cols-[1fr_auto_auto] items-center gap-3 py-2.5 text-sm"
              >
                <span className="font-bold text-[#20392a]">{tier.name ?? tierName[tier.level] ?? tier.level}</span>
                <span className="text-[#53685a] tabular-nums">
                  {config.qualificationMode === "SPEND"
                    ? `${number(Number(tier.minSpendVnd ?? 0))} ₫`
                    : `${number(tier.minLifetimePoints ?? 0)} điểm`}
                </span>
                <span className="min-w-9 text-right font-bold text-[#406d47] tabular-nums">
                  {number(Number(tier.multiplier))}×
                </span>
              </li>
            ))}
          </ul>
        </>
      ) : null}
      <div className="mt-4">
        <Link to="/merchant/loyalty/config">
          <Button size="small" icon={<ArrowUpRight size={14} />} iconPlacement="end">
            Chỉnh cấu hình loyalty
          </Button>
        </Link>
      </div>
    </CmsCard>
  );
}
