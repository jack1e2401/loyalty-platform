import type { ChallengeParticipantDto, MerchantChallengeDto } from "../../../api/challenges-types";
import { MerchantPagination } from "../cms/MerchantPagination";
import { Card, StatusText } from "../../../components/ui";
import { challengeRewardStateLabel } from "./challenge-labels";
import { dateTime, participantProgress, ParticipantCard, rewardTone } from "./ChallengeDetailComponents";

type Props = {
  challenge: MerchantChallengeDto;
  participants: ChallengeParticipantDto[];
  totalItems: number;
  page: number;
  limit: number;
  onPageChange: (page: number, limit: number) => void;
};

export function ChallengeParticipantsPanel({
  challenge,
  participants,
  totalItems,
  page,
  limit,
  onPageChange,
}: Props) {
  return (
    <Card className="overflow-hidden p-0">
      <div className="flex flex-wrap items-end justify-between gap-3 border-b border-[#edf1ea] p-5 sm:px-6">
        <div>
          <h2 className="text-lg font-extrabold text-[#20392a]">Thành viên tham gia</h2>
          <p className="mt-1 text-sm muted">Tiến độ và trạng thái thưởng được cập nhật từ chiến dịch.</p>
        </div>
        <span className="text-xs font-semibold text-[#708074]">
          {totalItems.toLocaleString("vi-VN")} thành viên
        </span>
      </div>

      <div className="hidden md:block">
        <table className="w-full table-fixed text-left text-sm">
          <thead className="bg-[#edf3ee] text-xs uppercase tracking-[.06em] text-[#344b3b]">
            <tr>
              <th className="w-[38%] px-5 py-3 font-bold">Thành viên</th>
              <th className="w-[24%] px-3 py-3 font-bold">Tiến độ</th>
              <th className="w-[20%] px-3 py-3 font-bold">Trạng thái thưởng</th>
              <th className="w-[18%] px-3 py-3 font-bold">Hoàn thành</th>
            </tr>
          </thead>
          <tbody>
            {participants.map((participant) => (
              <tr key={participant.progressId} className="border-t border-[#edf1ea]">
                <td className="break-all px-5 py-4 font-semibold text-[#31483a]">
                  {participant.memberEmail}
                </td>
                <td className="px-3 py-4 tabular-nums">{participantProgress(challenge, participant)}</td>
                <td className="px-3 py-4">
                  <StatusText tone={rewardTone(participant.rewardState)}>
                    {challengeRewardStateLabel(participant.rewardState)}
                  </StatusText>
                </td>
                <td className="px-3 py-4 text-xs text-[#77867a]">
                  {participant.completedAt ? dateTime(participant.completedAt) : "Đang tham gia"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <ul className="space-y-3 p-4 md:hidden">
        {participants.map((participant) => (
          <ParticipantCard key={participant.progressId} challenge={challenge} participant={participant} />
        ))}
      </ul>

      <MerchantPagination page={page} limit={limit} totalItems={totalItems} onChange={onPageChange} />
    </Card>
  );
}
