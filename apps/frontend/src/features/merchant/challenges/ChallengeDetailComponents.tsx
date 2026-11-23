import { Gift } from "@phosphor-icons/react";
import type {
  ChallengeParticipantDto,
  ChallengeRewardState,
  MerchantChallengeDto,
} from "../../../api/challenges-types";
import { StatusText } from "../../../components/ui";
import { challengeRewardStateLabel } from "./challenge-labels";
export const formatPts = (value: string) =>
  Number(value).toLocaleString("vi-VN", { maximumFractionDigits: 4 });
export const dateTime = (value: string) =>
  new Date(value).toLocaleString("vi-VN", { dateStyle: "medium", timeStyle: "short" });

export function participantProgress(challenge: MerchantChallengeDto, participant: ChallengeParticipantDto) {
  const unit = challenge.type === "ORDER_COUNT" ? "đơn" : challenge.type === "DAILY_CHECKIN" ? "ngày" : "₫";
  return `${formatPts(participant.currentValue)} / ${formatPts(participant.targetValue)} ${unit}`;
}

export function rewardTone(state: ChallengeRewardState) {
  if (state === "REWARDED") return "green" as const;
  if (state === "WAITING_BUDGET") return "amber" as const;
  return "neutral" as const;
}

export function Metric({
  icon: Icon,
  label,
  value,
  detail,
}: {
  icon: typeof Gift;
  label: string;
  value: string;
  detail?: string;
}) {
  return (
    <div className="min-w-0 rounded-2xl bg-[#f7f9f5] p-4">
      <p className="flex items-center gap-2 text-xs font-bold uppercase tracking-[.07em] text-[#77867a]">
        <Icon size={16} />
        {label}
      </p>
      <p className="mt-2 break-words text-base font-extrabold leading-snug text-[#294733] sm:text-lg">
        {value}
      </p>
      {detail && <p className="mt-1 text-xs leading-5 muted">{detail}</p>}
    </div>
  );
}

export function ParticipantCard({
  challenge,
  participant,
}: {
  challenge: MerchantChallengeDto;
  participant: ChallengeParticipantDto;
}) {
  return (
    <li className="rounded-2xl border border-[#e8ede5] bg-white p-4">
      <div className="flex min-w-0 items-start justify-between gap-3">
        <p className="min-w-0 break-all text-sm font-bold text-[#294733]">{participant.memberEmail}</p>
        <StatusText tone={rewardTone(participant.rewardState)}>
          {challengeRewardStateLabel(participant.rewardState)}
        </StatusText>
      </div>
      <div className="mt-4 flex items-end justify-between gap-3">
        <div>
          <p className="text-xs font-semibold text-[#77867a]">Tiến độ</p>
          <p className="mt-1 text-sm font-extrabold tabular-nums text-[#294733]">
            {participantProgress(challenge, participant)}
          </p>
        </div>
        <p className="text-right text-xs text-[#77867a]">
          {participant.completedAt ? dateTime(participant.completedAt) : "Đang tham gia"}
        </p>
      </div>
    </li>
  );
}
