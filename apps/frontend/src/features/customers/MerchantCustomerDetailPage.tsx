import { useState } from "react";
import { ArrowClockwise, ArrowLeft } from "@phosphor-icons/react";
import { Alert, Button, Descriptions, Flex, Skeleton, Tag } from "antd";
import { Link, useParams } from "react-router-dom";
import { createAnalyticsClient } from "../../api/analytics-client";
import { useAuthSession } from "../../api/auth-session";
import { useResource } from "../../api/useResource";
import { CmsCard, CmsPageHeader, CmsStatCard, CmsStatusTag } from "../merchant/cms";
import { MemberLoyaltyPolicyDialog } from "../member/MemberLoyaltyPolicyDialog";
import { money } from "../../lib/utils";
import { CustomerHistorySections } from "./CustomerHistorySections";

const analyticsApi = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function MerchantCustomerDetailPage() {
  const { memberId } = useParams();
  const { accessToken } = useAuthSession();
  const [paging, setPaging] = useState({
    orders: { page: 1, limit: 20 },
    pointLedger: { page: 1, limit: 20 },
    vouchers: { page: 1, limit: 20 },
  });
  const resource = useResource(
    () => analyticsApi.getMerchantCustomerDetail(memberId ?? "", accessToken!, paging),
    [memberId, accessToken, paging],
  );

  const customer = resource.data?.customer;
  const currentTier = customer?.wallet.policy?.tiers?.find((t) => t.level === customer.wallet.tier);
  const currentTierLabel = !customer
    ? ""
    : customer.wallet.tier === "UNRANKED"
      ? "Chưa xếp hạng"
      : currentTier?.name ?? customer.wallet.tier;
  const currentTierColor = currentTier?.color && /^#[0-9A-Fa-f]{6}$/.test(currentTier.color)
    ? currentTier.color
    : null;
  return (
    <section className="grid min-w-0 gap-5">
      <div>
        <Link to="/merchant/customers">
          <Button icon={<ArrowLeft size={15} />}>Danh sách khách hàng</Button>
        </Link>
      </div>

      {resource.loading && !customer ? (
        <CmsCard>
          <Skeleton active paragraph={{ rows: 6 }} />
        </CmsCard>
      ) : resource.error && !customer ? (
        <Alert
          role="alert"
          type="error"
          showIcon
          title="Không tải được chi tiết khách hàng"
          description={resource.error}
          action={
            <Button size="small" onClick={resource.reload}>
              Thử lại
            </Button>
          }
        />
      ) : (
        customer && (
          <>
            <CmsPageHeader
              title={customer.member.name || customer.member.email}
              description={`Thành viên #${customer.member.id} · Tham gia ${new Date(customer.member.joinedAt).toLocaleDateString("vi-VN")}`}
              action={
                <Flex gap={8} wrap>
                  <Button icon={<ArrowClockwise size={15} />} loading={resource.loading} onClick={resource.reload}>
                    Làm mới
                  </Button>
                  <MemberLoyaltyPolicyDialog policy={customer.wallet.policy} />
                </Flex>
              }
            />

            <CmsCard title="Hồ sơ khách hàng">
              <Descriptions column={{ xs: 1, sm: 2, lg: 4 }} size="small">
                <Descriptions.Item label="Email">
                  <span className="break-all">{customer.member.email}</span>
                </Descriptions.Item>
                <Descriptions.Item label="Điện thoại">
                  {customer.member.phone || "Chưa cập nhật"}
                </Descriptions.Item>
                <Descriptions.Item label="Ngày sinh">
                  {customer.member.birthDate || "Chưa cập nhật"}
                </Descriptions.Item>
                <Descriptions.Item label="Địa chỉ">
                  {customer.member.address || "Chưa cập nhật"}
                </Descriptions.Item>
              </Descriptions>
            </CmsCard>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <CmsStatCard
                label="Tổng đơn hàng"
                value={customer.stats.totalOrders}
                description={`${customer.stats.paidOrderCount} đã trả · ${customer.stats.refundPendingOrderCount} chờ hoàn · ${customer.stats.refundedOrderCount} đã hoàn`}
              />
              <CmsStatCard
                label="Chi tiêu đơn đủ điều kiện"
                value={money(Number(customer.stats.netSpendVnd))}
                description={
                  customer.stats.refundPendingOrderCount > 0
                    ? `Chờ hoàn: ${money(Number(customer.stats.refundPendingSpendVnd))}`
                    : "Tính trên đơn PAID + REFUND_PENDING"
                }
              />
              <CmsStatCard
                label="Giá trị đơn trung bình"
                value={money(Number(customer.stats.averageOrderValueVnd))}
              />
              <CmsStatCard
                label="Mua gần nhất"
                value={
                  customer.stats.lastPurchaseAt
                    ? new Date(customer.stats.lastPurchaseAt).toLocaleDateString("vi-VN")
                    : "Chưa mua"
                }
              />
            </div>

            <CmsCard title="Ví điểm Loyalty">
              <Descriptions column={{ xs: 1, sm: 2, lg: 5 }} size="small">
                <Descriptions.Item label="Hạng hiện tại">
                  {currentTierColor ? (
                    <Tag
                      className="m-0 font-semibold"
                      style={{
                        borderColor: currentTierColor,
                        color: "#20392a",
                        backgroundColor: `${currentTierColor}22`,
                      }}
                    >
                      <span
                        aria-hidden="true"
                        className="mr-1.5 inline-block size-2 rounded-full align-middle"
                        style={{ backgroundColor: currentTierColor }}
                      />
                      {currentTierLabel}
                    </Tag>
                  ) : (
                    <CmsStatusTag
                      label={currentTierLabel}
                      tone={customer.wallet.tier === "UNRANKED" ? "neutral" : "info"}
                    />
                  )}
                </Descriptions.Item>
                <Descriptions.Item label="Điểm khả dụng">
                  <strong className="tabular-nums">{customer.wallet.availablePoints.toLocaleString("vi-VN")}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Phần lẻ tích lũy">
                  <strong className="tabular-nums">{customer.wallet.fractionalCarry}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Tổng điểm tích lũy">
                  <strong className="tabular-nums">{customer.wallet.netLifetimeEarned}</strong>
                </Descriptions.Item>
                <Descriptions.Item label="Nợ điểm">
                  <strong className="tabular-nums text-[#a4473a]">{customer.wallet.pointDebt}</strong>
                </Descriptions.Item>
              </Descriptions>
            </CmsCard>

            <CustomerHistorySections
              customer={customer}
              onPageChange={(key, page, limit) =>
                setPaging((current) => ({ ...current, [key]: { page, limit } }))}
            />
          </>
        )
      )}
    </section>
  );
}
