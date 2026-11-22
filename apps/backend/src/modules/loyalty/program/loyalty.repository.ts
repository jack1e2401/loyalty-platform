import { loyaltyConfigRepository } from "./loyalty.config.js";
import { getWallet } from "./loyalty.read.js";

/** Existing module boundary; each operation has a focused implementation. */
export const loyaltyRepository = {
  ...loyaltyConfigRepository,
  getWallet,
};
