import type { Dispatch, SetStateAction } from "react";
import type { LoyaltyConfigInput } from "../../../api/commerce-types";
import { LoyaltyResetSettings } from "./LoyaltyResetSettings";
import { LoyaltyTiersEditor } from "./LoyaltyTiersEditor";

type Props = {
  configSection: "program" | "tiers" | "reset";
  form: LoyaltyConfigInput;
  setDraft: Dispatch<SetStateAction<LoyaltyConfigInput | null>>;
  expandedTiers: Record<string, boolean>;
  setExpandedTiers: Dispatch<SetStateAction<Record<string, boolean>>>;
  showOptional: Record<string, boolean>;
  setShowOptional: Dispatch<SetStateAction<Record<string, boolean>>>;
  resetBusy: boolean;
  canEditPolicy: boolean;
  onRequestReset: () => void;
};

export function LoyaltyTierSettings(props: Props) {
  return (
    <>
      <LoyaltyTiersEditor {...props} />
      <LoyaltyResetSettings {...props} />
    </>
  );
}
