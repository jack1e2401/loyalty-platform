import { Link, useOutletContext } from "react-router-dom";
import { Sparkle, Ticket, Wallet } from "@phosphor-icons/react";
import { useApi } from "../../../api/client";
import { useResource } from "../../../api/useResource";
import { Button, Card, EmptyState, ErrorState, LoadingState, PageHeader } from "../../../components/ui";
import { number, shortDate } from "../../../lib/utils";
import type { MemberOutlet } from "../../../layouts/MemberLayout";
import { MemberMascot } from "../MemberMascot";

export function MemberWallet() {
  const { merchant } = useOutletContext<MemberOutlet>();
  const api = useApi();
  const wallet = useResource(() => api.getWallet(merchant.id), [merchant.id]);
  const config = useResource(() => api.getLoyaltyConfig(merchant.id), [merchant.id]);
  if (wallet.loading || config.loading) return <LoadingState cards={2} />;
  if (wallet.error || config.error)
    return (
      <ErrorState
        message={wallet.error ?? config.error ?? "Lỗi tải ví"}
        retry={() => {
          wallet.reload();
          config.reload();
        }}
      />
    );
  if (!wallet.data || !config.data) return null;
  const levels = config.data.tiers;
  const next = levels.find((t) => t.threshold > wallet.data!.lifetimeEarnedPoints);
  const currentThreshold =
    levels.filter((t) => t.threshold <= wallet.data!.lifetimeEarnedPoints).at(-1)?.threshold ?? 0;
  const progress =
    wallet.data.tier === "Unranked"
      ? 0
      : next
        ? Math.min(
            100,
            ((wallet.data.lifetimeEarnedPoints - currentThreshold) /
              Math.max(1, next.threshold - currentThreshold)) *
              100,
          )
        : 100;
  return (
    <>
      <PageHeader title={`Ví điểm · ${merchant.name}`} />
      <div className="grid gap-5 lg:grid-cols-[1.05fr_.95fr]">
        <Card className="relative overflow-hidden bg-[#2f583a] p-6 text-white sm:p-8">
          <div className="absolute -right-8 -top-12 h-56 w-56 rounded-full bg-[#537950]/35 blur-3xl" />
          <div className="relative flex items-start justify-between">
            <div>
              <p className="text-xs font-semibold text-white/65">ĐIỂM CÓ THỂ SỬ DỤNG</p>
              <p className="mt-3 text-5xl font-extrabold tracking-[-.07em]">
                {number(wallet.data.availablePoints)}
                <span className="ml-2 text-lg font-bold tracking-normal text-[#c5e89b]">điểm</span>
              </p>
            </div>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-white/10 text-[#d8eeae]">
              <Wallet size={24} weight="light" />
            </span>
          </div>
          <div className="relative mt-8 flex items-center justify-between border-t border-white/15 pt-5">
            <div>
              <p className="text-[10px] font-semibold text-white/65">Hạng tại {merchant.name}</p>
              <p className="mt-1 text-xl font-extrabold">{wallet.data.tier}</p>
            </div>
            <div className="text-right">
              <p className="text-[10px] font-semibold text-white/65">Tổng điểm đã tích</p>
              <p className="mt-1 text-lg font-bold">{number(wallet.data.lifetimeEarnedPoints)}</p>
            </div>
          </div>
        </Card>
        <Card className="member-gradient relative overflow-hidden p-6 sm:p-8">
          <div className="relative z-1 max-w-[65%]">
            <h2 className="serif text-3xl leading-tight text-[#2e5037]">
              {wallet.data.tier === "Unranked"
                ? "Đơn đã thanh toán đầu tiên sẽ xác lập hạng theo tổng điểm tích lũy."
                : next
                  ? `Còn ${number(Math.max(0, next.threshold - wallet.data.lifetimeEarnedPoints))} điểm tới ${next.tier}.`
                  : "Bạn đã đạt hạng cao nhất."}
            </h2>
            <p className="mt-3 text-xs leading-6 text-[#647a68]">
              Điểm đã tiêu không làm giảm hạng. Hạng dựa trên tổng điểm từng kiếm được.
            </p>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-white/75">
              <div
                className="h-full rounded-full bg-[#5b8d56] transition-all duration-700"
                style={{ width: `${progress}%` }}
              />
            </div>
            <p className="mt-2 text-[10px] font-bold text-[#6e856f]">
              {number(wallet.data.lifetimeEarnedPoints)} / {next ? number(next.threshold) : "MAX"} lifetime
              points
            </p>
          </div>
          <div className="absolute -bottom-3 -right-3 h-44 w-44">
            <MemberMascot mood="hello" />
          </div>
        </Card>
      </div>
      <Card className="mt-6 overflow-hidden">
        <div className="flex items-center justify-between border-b border-[#edf1ea] p-5 sm:p-6">
          <div>
            <h2 className="font-extrabold">Lịch sử điểm</h2>
            <p className="mt-1 text-xs muted">{merchant.name}</p>
          </div>
        </div>
        {wallet.data.transactions.length ? (
          <div className="divide-y divide-[#edf1ea]">
            {wallet.data.transactions.map((t) => (
              <div key={t.id} className="flex items-center gap-3 px-5 py-4 sm:px-6">
                <span
                  className={`grid h-10 w-10 place-items-center rounded-xl ${t.amount > 0 ? "bg-[#e8f1e2] text-[#548057]" : "bg-[#f8ebe5] text-[#a46d59]"}`}
                >
                  {t.amount > 0 ? <Sparkle size={18} /> : <Ticket size={18} />}
                </span>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold">{t.reason}</p>
                  <p className="mt-1 text-[11px] muted">
                    {shortDate(t.date)} · {t.reference}
                  </p>
                </div>
                <p className={`text-sm font-extrabold ${t.amount > 0 ? "text-[#4d7a50]" : "text-[#a46d59]"}`}>
                  {t.amount > 0 ? "+" : ""}
                  {number(t.amount)}
                </p>
              </div>
            ))}
          </div>
        ) : (
          <div className="p-5">
            <EmptyState
              title="Chưa có giao dịch"
              description="Đơn đầu tiên được thanh toán thành công sẽ bắt đầu hành trình tích điểm."
              action={
                <Button asChild>
                  <Link to={`/member/${merchant.id}`}>Khám phá gian hàng</Link>
                </Button>
              }
            />
          </div>
        )}
      </Card>
    </>
  );
}
