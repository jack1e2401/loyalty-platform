import { useState } from "react";
import {
  ArrowLeft,
  ArrowUpRight,
  CalendarBlank,
  CheckCircle,
  Coins,
  Gift,
  UsersThree,
} from "@phosphor-icons/react";
import { Link, useParams } from "react-router-dom";
import { createChallengesClient } from "../../../api/challenges-client";
import type { MerchantChallengeDto } from "../../../api/challenges-types";
import { useResource } from "../../../api/useResource";
import { Button, Card, ErrorState, LoadingState, PageHeader, StatusText } from "../../../components/ui";
import { useToken } from "../merchant-page-support";
import { challengeGrantStatusLabel, challengeStatusLabel, challengeTypeLabel } from "./challenge-labels";
import { MerchantChallengeStatusAction } from "./MerchantChallengeStatusAction";
import { ChallengeParticipantsPanel } from "./ChallengeParticipantsPanel";
import { dateTime, formatPts, Metric } from "./ChallengeDetailComponents";
const shortDate = (value: string) =>
  new Date(value).toLocaleDateString("vi-VN", { day: "numeric", month: "short", year: "numeric" });

const api = createChallengesClient();
function goalText(challenge: MerchantChallengeDto) {
  const target = formatPts(challenge.targetValue);
  if (challenge.type === "ORDER_COUNT") return `${target} đơn hàng`;
  if (challenge.type === "DAILY_CHECKIN") return `${target} ngày điểm danh`;
  return `${target} ₫ chi tiêu`;
}

export function MerchantChallengeDetailPage() {
  const { challengeId = "" } = useParams();
  const id = Number(challengeId);
  const token = useToken();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(20);
  const resource = useResource(() => api.getMerchantChallenge(id, token, page, limit), [id, token, page, limit]);

  if (!Number.isSafeInteger(id) || id <= 0)
    return (
      <ErrorState message="Mã nhiệm vụ không hợp lệ." retry={() => location.assign("/merchant/challenges")} />
    );
  if (resource.loading) return <LoadingState cards={3} />;
  if (resource.error || !resource.data)
    return <ErrorState message={resource.error ?? "Không tìm thấy nhiệm vụ."} retry={resource.reload} />;

  const { challenge, participants, recentGrants } = resource.data;
  const totalBudget = Number(challenge.budgetTotal);
  const usedBudget = Number(challenge.budgetSpent);
  const usedPercent =
    totalBudget > 0 && Number.isFinite(usedBudget / totalBudget)
      ? Math.min(100, Math.max(0, (usedBudget / totalBudget) * 100))
      : 0;
  const statusTone =
    challenge.effectiveStatus === "ACTIVE"
      ? "green"
      : challenge.effectiveStatus === "PAUSED"
        ? "amber"
        : "neutral";

  return (
    <section className="mx-auto max-w-6xl space-y-6 pb-8">
      <Link
        to="/merchant/challenges"
        className="inline-flex items-center gap-2 text-sm font-semibold text-[#49654e] hover:text-[#20392a]"
      >
        <ArrowLeft size={17} /> Danh sách nhiệm vụ
      </Link>
      <PageHeader
        title={challenge.title}
        description={challenge.description || "Theo dõi hiệu quả, thành viên và ngân sách của chiến dịch."}
        action={
          <div className="flex flex-wrap items-center gap-2">
            <MerchantChallengeStatusAction challenge={challenge} token={token} onSuccess={resource.reload} />
            <Button asChild variant="outline">
              <Link to={`/merchant/challenges/${id}/edit`}>
                Chỉnh sửa nhiệm vụ <ArrowUpRight size={17} />
              </Link>
            </Button>
          </div>
        }
      />

      <Card className="overflow-hidden p-5 sm:p-7">
        <div className="flex flex-wrap items-center gap-2">
          <StatusText tone={statusTone}>{challengeStatusLabel(challenge.effectiveStatus)}</StatusText>
          <span className="rounded-full bg-[#eff4ec] px-3 py-1 text-xs font-bold text-[#49654e]">
            {challengeTypeLabel(challenge.type)}
          </span>
          {challenge.isFeatured && (
            <span className="rounded-full bg-[#fff4dc] px-3 py-1 text-xs font-bold text-[#8c642b]">
              Nổi bật trên cửa hàng
            </span>
          )}
        </div>
        <h2 className="mt-5 text-xs font-bold uppercase tracking-[.1em] text-[#77867a]">
          Cấu hình chiến dịch
        </h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <Metric icon={CheckCircle} label="Mục tiêu" value={goalText(challenge)} />
          <Metric
            icon={CalendarBlank}
            label="Thời gian"
            value={`${shortDate(challenge.startsAt)} – ${shortDate(challenge.endsAt)}`}
          />
          <Metric
            icon={Gift}
            label="Điểm thưởng cuối"
            value={`${formatPts(challenge.rewardPoints)} điểm`}
            detail="Trao khi hoàn thành toàn bộ mục tiêu."
          />
          <Metric
            icon={Coins}
            label="Ngân sách còn lại"
            value={`${formatPts(challenge.budgetRemaining)} điểm`}
            detail={`Tổng ngân sách ${formatPts(challenge.budgetTotal)} điểm`}
          />
          <Metric
            icon={UsersThree}
            label="Suất thưởng"
            value={
              challenge.maxRewardRecipients == null
                ? "Không giới hạn"
                : `${(challenge.rewardSlotsRemaining ?? 0).toLocaleString("vi-VN")} còn lại`
            }
            detail={
              challenge.maxRewardRecipients == null
                ? undefined
                : `Tối đa ${challenge.maxRewardRecipients.toLocaleString("vi-VN")} hội viên`
            }
          />
        </div>
        <div className="mt-5 rounded-2xl border border-[#e8ede5] p-4 sm:px-5">
          <div className="flex flex-wrap items-center justify-between gap-2 text-sm">
            <p className="font-bold text-[#425748]">Ngân sách đã sử dụng</p>
            <p className="tabular-nums text-[#637269]">
              {formatPts(challenge.budgetSpent)} / {formatPts(challenge.budgetTotal)} điểm
            </p>
          </div>
          <div
            className="mt-3 h-2 overflow-hidden rounded-full bg-[#e8eee5]"
            role="progressbar"
            aria-label="Tỷ lệ ngân sách đã sử dụng"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(usedPercent)}
          >
            <div
              className="h-full rounded-full bg-[#5b8962] transition-[width] duration-500"
              style={{ width: `${usedPercent}%` }}
            />
          </div>
        </div>
      </Card>

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        <Metric
          icon={UsersThree}
          label="Đang tham gia"
          value={challenge.inProgressCount.toLocaleString("vi-VN")}
        />
        <Metric
          icon={CheckCircle}
          label="Đã hoàn thành"
          value={challenge.completedCount.toLocaleString("vi-VN")}
        />
        <Metric
          icon={Gift}
          label="Chờ ngân sách"
          value={challenge.waitingBudgetCount.toLocaleString("vi-VN")}
          detail="Mục tiêu xong, đang chờ cấp thưởng."
        />
        <Metric
          icon={Coins}
          label="Điểm thưởng ròng đã cấp"
          value={`${formatPts(challenge.budgetSpent)} điểm`}
        />
      </div>

      <ChallengeParticipantsPanel
        challenge={challenge}
        participants={participants.items}
        totalItems={participants.pagination.totalItems}
        page={participants.pagination.page}
        limit={participants.pagination.limit}
        onPageChange={(nextPage, nextLimit) => { setPage(nextPage); setLimit(nextLimit); }}
      />

      <Card className="p-5 sm:p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-[#edf4e9] text-[#315e3d]">
            <Coins size={20} />
          </span>
          <div>
            <h2 className="text-lg font-extrabold text-[#20392a]">Lịch sử điểm thưởng</h2>
            <p className="mt-1 text-sm muted">Gồm điểm đã phát và các khoản được thu hồi.</p>
          </div>
        </div>
        {recentGrants.length ? (
          <ul className="mt-4 divide-y divide-[#edf1ea]">
            {recentGrants.map((grant) => (
              <li
                key={grant.id}
                className="flex flex-col gap-2 py-4 first:pt-1 sm:flex-row sm:items-center sm:justify-between"
              >
                <div className="min-w-0">
                  <p className="break-all text-sm font-bold text-[#31483a]">{grant.memberEmail}</p>
                  <p className="mt-1 text-xs text-[#77867a]">
                    Lần {grant.cycle} · {dateTime(grant.grantedAt)}
                    {grant.reversedAt ? ` · Thu hồi ${dateTime(grant.reversedAt)}` : ""}
                  </p>
                </div>
                <div className="flex items-center justify-between gap-3 sm:justify-end">
                  <StatusText tone={grant.status === "GRANTED" ? "green" : "neutral"}>
                    {challengeGrantStatusLabel(grant.status)}
                  </StatusText>
                  <span
                    className={`text-sm font-extrabold tabular-nums ${grant.status === "REVERSED" ? "text-[#718075]" : "text-[#315e3d]"}`}
                  >
                    {grant.status === "REVERSED" ? "−" : "+"}
                    {formatPts(grant.pointsGranted)} điểm
                  </span>
                </div>
              </li>
            ))}
          </ul>
        ) : (
          <p className="mt-4 rounded-2xl bg-[#f8faf6] p-4 text-sm muted">Chưa có giao dịch điểm thưởng.</p>
        )}
      </Card>
    </section>
  );
}
