import { useState } from "react";
import { ArrowLeft } from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { createAnalyticsClient } from "../../api/analytics-client";
import { useAuthSession } from "../../api/auth-session";
import { useResource } from "../../api/useResource";
import { Button, Card, ErrorState, LoadingState, PageHeader, StatCard } from "../../components/ui";
import { MemberLoyaltyPolicyDialog } from "../member/MemberLoyaltyPolicyDialog";
import { money } from "../../lib/utils";
import { CustomerHistorySections } from "./CustomerHistorySections";

const analyticsApi = createAnalyticsClient(import.meta.env.VITE_API_BASE_URL ?? "http://localhost:3000");

export function MerchantCustomerDetailPage() {
  const { memberId } = useParams();
  const { accessToken } = useAuthSession();
  const resource = useResource(
    () => analyticsApi.getMerchantCustomerDetail(memberId ?? "", accessToken!),
    [memberId, accessToken],
  );

  const customer = resource.data?.customer;
  const [tagsDraft, setTagsDraft] = useState<string | null>(null);
  const [tagsBusy, setTagsBusy] = useState(false);
  const [tagsError, setTagsError] = useState("");
  const [tagsNotice, setTagsNotice] = useState("");

  async function saveTags() {
    if (!customer || !accessToken || tagsBusy) return;
    setTagsBusy(true);
    setTagsError("");
    setTagsNotice("");
    try {
      await analyticsApi.updateMerchantCustomerTags(
        customer.member.id,
        (tagsDraft ?? customer.tags.join(","))
          .split(",")
          .map((tag) => tag.trim())
          .filter(Boolean),
        accessToken,
      );
      setTagsDraft(null);
      setTagsNotice("Đã lưu nhãn khách hàng.");
      resource.reload();
    } catch (error) {
      setTagsError(error instanceof Error ? error.message : "Không thể lưu nhãn.");
    } finally {
      setTagsBusy(false);
    }
  }

  return (
    <div className="space-y-6">
      <Button asChild variant="outline" size="sm">
        <Link to="/merchant/customers">
          <ArrowLeft size={16} aria-hidden="true" /> Danh sách khách hàng
        </Link>
      </Button>

      {resource.loading ? (
        <LoadingState cards={3} />
      ) : resource.error ? (
        <ErrorState message={resource.error} retry={resource.reload} />
      ) : (
        customer && (
          <>
            <PageHeader
              title={customer.member.name || customer.member.email}
              description={`Thành viên #${customer.member.id} · Tham gia ${new Date(customer.member.joinedAt).toLocaleDateString("vi-VN")}`}
              action={<MemberLoyaltyPolicyDialog policy={customer.wallet.policy} />}
            />

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-[#20392a]">Hồ sơ khách hàng</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <div>
                  <dt className="text-xs font-bold muted">Email</dt>
                  <dd className="mt-1 break-all text-sm">{customer.member.email}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Điện thoại</dt>
                  <dd className="mt-1 text-sm">{customer.member.phone || "Chưa cập nhật"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Ngày sinh</dt>
                  <dd className="mt-1 text-sm">{customer.member.birthDate || "Chưa cập nhật"}</dd>
                </div>
                <div className="sm:col-span-2 lg:col-span-4">
                  <dt className="text-xs font-bold muted">Địa chỉ</dt>
                  <dd className="mt-1 text-sm">{customer.member.address || "Chưa cập nhật"}</dd>
                </div>
              </dl>
              <div className="mt-5 max-w-xl space-y-2">
                <label htmlFor="customer-tags" className="text-xs font-bold muted">
                  Nhãn riêng của cửa hàng (phân tách bằng dấu phẩy)
                </label>
                <div className="flex flex-wrap gap-2">
                  <input
                    id="customer-tags"
                    className="min-h-10 min-w-0 flex-1 rounded-lg border border-slate-300 px-3 text-sm"
                    value={tagsDraft ?? (customer.tags ?? []).join(", ")}
                    onChange={(event) => setTagsDraft(event.target.value)}
                  />
                  <Button type="button" disabled={tagsBusy} onClick={() => void saveTags()}>
                    {tagsBusy ? "Đang lưu" : "Lưu nhãn"}
                  </Button>
                </div>
                {tagsError && (
                  <p role="alert" className="text-sm text-[#a4473a]">
                    {tagsError}
                  </p>
                )}
                {tagsNotice && (
                  <p role="status" className="text-sm text-[#357044]">
                    {tagsNotice}
                  </p>
                )}
              </div>
            </Card>

            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
              <StatCard
                label="Tổng đơn hàng"
                value={customer.stats.totalOrders}
                note={`${customer.stats.paidOrderCount} đã trả · ${customer.stats.refundPendingOrderCount} chờ hoàn · ${customer.stats.refundedOrderCount} đã hoàn`}
              />
              <StatCard
                label="Chi tiêu đơn đủ điều kiện"
                value={money(Number(customer.stats.netSpendVnd))}
                note={
                  customer.stats.refundPendingOrderCount > 0
                    ? `Chờ hoàn: ${money(Number(customer.stats.refundPendingSpendVnd))}`
                    : "Tính trên đơn PAID + REFUND_PENDING"
                }
              />
              <StatCard
                label="Giá trị đơn trung bình"
                value={money(Number(customer.stats.averageOrderValueVnd))}
              />
              <StatCard
                label="Mua gần nhất"
                value={
                  customer.stats.lastPurchaseAt
                    ? new Date(customer.stats.lastPurchaseAt).toLocaleDateString("vi-VN")
                    : "Chưa mua"
                }
              />
            </div>

            <Card className="p-5 sm:p-6">
              <h2 className="text-lg font-extrabold text-[#20392a]">Ví điểm Loyalty</h2>
              <dl className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
                <div>
                  <dt className="text-xs font-bold muted">Hạng hiện tại</dt>
                  <dd className="mt-1 text-lg font-extrabold">
                    {customer.wallet.tier === "UNRANKED" ? "Chưa xếp hạng" : customer.wallet.tier}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Điểm khả dụng</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums">
                    {customer.wallet.availablePoints.toLocaleString("vi-VN")}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Phần lẻ tích lũy</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums">
                    {customer.wallet.fractionalCarry}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Tổng điểm tích lũy</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums">
                    {customer.wallet.netLifetimeEarned}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-bold muted">Nợ điểm</dt>
                  <dd className="mt-1 text-lg font-extrabold tabular-nums text-[#a4473a]">
                    {customer.wallet.pointDebt}
                  </dd>
                </div>
              </dl>
            </Card>

            <CustomerHistorySections customer={customer} />
          </>
        )
      )}
    </div>
  );
}
