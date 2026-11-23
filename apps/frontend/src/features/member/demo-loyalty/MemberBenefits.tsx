import { useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import { Gift, Ticket, Wallet } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import type { VoucherDefinition } from "../../../api/types";
import {
  Button,
  BusyLabel,
  Card,
  EmptyState,
  ErrorState,
  LoadingState,
  PageHeader,
  StatusText,
} from "../../../components/ui";
import { money, number } from "../../../lib/utils";
import type { MemberOutlet } from "../../../layouts/MemberLayout";

function Benefits({ kind }: { kind: "DISCOUNT" | "REWARD" }) {
  const { merchant } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const wallet = useResource(() => api.getWallet(merchant.id), [merchant.id]);
  const definitions = useResource(() => api.listVoucherDefinitions(merchant.id), [merchant.id]);
  const owned = useResource(() => api.listMemberVouchers(merchant.id), [merchant.id]);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  async function redeem(definition: VoucherDefinition) {
    if (busy) return;
    setBusy(definition.id);
    setError("");
    setSuccess("");
    try {
      const result = await api.redeemVoucher(definition.id, merchant.id);
      wallet.setData(result.wallet);
      owned.setData((prev) => (prev ? [result.voucher, ...prev] : [result.voucher]));
      setSuccess(
        `${result.voucher.title} đã được cấp. Số dư mới: ${number(result.wallet.availablePoints)} điểm.`,
      );
    } catch (reason) {
      setError(reason instanceof Error ? reason.message : "Không thể đổi ưu đãi");
      wallet.reload();
    } finally {
      setBusy(null);
    }
  }
  const list = definitions.data?.filter((v) => v.kind === kind && v.active) ?? [];
  const title = kind === "DISCOUNT" ? "Đổi voucher" : "Đổi quà";
  if (wallet.loading || definitions.loading || owned.loading) return <LoadingState />;
  if (wallet.error || definitions.error || owned.error)
    return (
      <ErrorState
        message={wallet.error ?? definitions.error ?? owned.error ?? "Lỗi tải ưu đãi"}
        retry={() => {
          wallet.reload();
          definitions.reload();
          owned.reload();
        }}
      />
    );
  return (
    <>
      <PageHeader
        title={title}
        description={
          kind === "DISCOUNT"
            ? "Dùng điểm để nhận voucher giảm giá cho đơn tại cửa hàng này."
            : "Đổi điểm để sở hữu quyền nhận quà. Merchant sẽ xác nhận khi trao quà."
        }
        action={
          <Link
            to={`/member/${merchant.id}/wallet`}
            className="flex items-center gap-2 rounded-full bg-[#e8f1e2] px-4 py-2.5 text-xs font-bold accent"
          >
            <Wallet size={16} />
            {number(wallet.data?.availablePoints ?? 0)} điểm
          </Link>
        }
      />
      {error && (
        <p role="alert" className="mb-4 rounded-xl bg-[#fae7e3] p-4 text-sm text-[#a4473a]">
          {error}
        </p>
      )}
      {success && (
        <p role="status" className="mb-4 rounded-xl bg-[#e8f1e2] p-4 text-sm text-[#376743]">
          {success}
        </p>
      )}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
        {list.map((v) => (
          <Card key={v.id} className="card-hover flex flex-col overflow-hidden">
            <div className="member-gradient p-6">
              <div className="flex items-center justify-between">
                <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/70 text-[#66865c]">
                  {kind === "DISCOUNT" ? (
                    <Ticket size={24} weight="light" />
                  ) : (
                    <Gift size={24} weight="light" />
                  )}
                </span>
                <StatusText tone={wallet.data!.availablePoints >= v.pointsCost ? "green" : "neutral"}>
                  {number(v.pointsCost)} điểm
                </StatusText>
              </div>
              <h2 className="serif mt-5 text-2xl text-[#2e5037]">{v.title}</h2>
              <p className="mt-2 min-h-10 text-xs leading-5 text-[#66786a]">{v.description}</p>
            </div>
            <div className="flex flex-1 items-center justify-between gap-3 p-5">
              <div>
                {v.kind === "DISCOUNT" && <p className="text-xs muted">Giảm tới</p>}
                <p className="text-lg font-extrabold accent">
                  {v.discountAmount ? money(v.discountAmount) : "Quyền nhận quà"}
                </p>
              </div>
              <Button
                disabled={wallet.data!.availablePoints < v.pointsCost || busy === v.id || !!busy}
                onClick={() => redeem(v)}
              >
                {busy === v.id ? <BusyLabel>Đang đổi</BusyLabel> : "Đổi ngay"}
              </Button>
            </div>
          </Card>
        ))}
      </div>
      {!list.length && <EmptyState title="Chưa có ưu đãi" description="Merchant chưa tạo ưu đãi loại này." />}
      <section className="mt-9">
        <h2 className="mb-4 text-lg font-extrabold">Voucher của bạn</h2>
        {owned.data?.filter((v) => v.kind === kind).length ? (
          <div className="grid gap-3 sm:grid-cols-2">
            {owned.data
              .filter((v) => v.kind === kind)
              .map((v) => (
                <Card key={v.id} className="flex items-center gap-4 p-5">
                  <span className="grid h-11 w-11 place-items-center rounded-xl bg-[#edf4e9] accent">
                    {kind === "DISCOUNT" ? <Ticket size={20} /> : <Gift size={20} />}
                  </span>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-bold">{v.title}</p>
                    <p className="mt-1 text-xs muted">Mã {v.id}</p>
                  </div>
                  <StatusText
                    tone={
                      v.status === "AVAILABLE"
                        ? "green"
                        : v.status === "FULFILLED"
                          ? "green"
                          : v.status === "USED"
                            ? "neutral"
                            : "amber"
                    }
                  >
                    {v.status === "AVAILABLE"
                      ? "Sẵn sàng"
                      : v.status === "USED"
                        ? "Đã sử dụng"
                        : v.status === "FULFILLED"
                          ? "Đã nhận quà"
                          : "Chờ trao quà"}
                  </StatusText>
                </Card>
              ))}
          </div>
        ) : (
          <p className="rounded-2xl bg-[#f2f5ef] p-5 text-sm muted">
            Bạn chưa có voucher nào tại {merchant.name}.
          </p>
        )}
      </section>
    </>
  );
}
export const MemberVouchers = () => <Benefits kind="DISCOUNT" />;
export const MemberRewards = () => <Benefits kind="REWARD" />;
