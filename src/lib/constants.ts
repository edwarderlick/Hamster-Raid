export const CHAIN_ID = 11155111;
export const CHAIN_NAME = "Sepolia";

export const CORE_ADDRESS = "0xfd6c166d4b8e2962e65746a13e5a0797cd4de0c4" as const;
export const COLLECTION_ADDRESS = "0xc4c7982657f00509548f3a3a41db7fa439a6856b" as const;
export const TOKEN_ADDRESS = "0xd78a3956cf63164d1fa1c622ad3c66623162fa1e" as const;

export const GENESIS_TIMESTAMP = 1793735400;
export const ROUND_DURATION_SEC = 600;
export const ROUNDS_PER_WEEK = 7 * 24 * 6; // 1008 ten-minute rounds

export const WEEKLY_BOSS_HP = 500;
export const NAP_HEAL = 3;
export const ENRAGE_PER_NAP = 1;
export const ENRAGE_BONUS_BPS = 400; // +4% outgoing damage per enrage stack, capped
export const MAX_ENRAGE = 8;

export const BASE_WEIGHT = 100;
export const LEVEL_WEIGHT = 5;
export const MAX_LEVEL = 10;

export const JOG_MAX_WORK = 50;

export const API_BASE = "https://api.squeekchain.com/v1";
export const STATUS_POLL_MS = 12_000;

export const CORE_ABI = [
  "event RoundRecorded(uint64 indexed roundId, uint32 work, uint64 cumulativeWork, uint256 cumulativeBlockUnits, uint32 workPerThousandBlocks, bytes32 dataHash)",
  "event BatchSettled(bytes32 digest, address reporter, uint64 settledThroughRound, uint64 nonce, uint64 previousSettledThroughRound, uint32 activeRoundCount, uint64 cumulativeWork, uint256 cumulativeBlockUnits)",
  "function state() view returns (uint64 cumulativeWork, uint256 cumulativeBlockUnits, uint64 blockHeight, uint256 blockProgress, uint32 workPerThousandBlocks, uint64 settledThroughRound, uint64 authorizationNonce, bool paused)",
] as const;

export const NFT_ABI = [
  "function balanceOf(address owner) view returns (uint256)",
  "function tokenOfOwnerByIndex(address owner, uint256 index) view returns (uint256)",
  "function ownerOf(uint256 tokenId) view returns (address)",
] as const;

export function weekIndexFromRound(round: number): number {
  return Math.floor(Math.max(0, round) / ROUNDS_PER_WEEK);
}

export function roundStartUnix(round: number): number {
  return GENESIS_TIMESTAMP + round * ROUND_DURATION_SEC;
}

export function classifyWork(work: number): "nap" | "jog" | "zoomies" {
  if (work <= 0) return "nap";
  if (work <= JOG_MAX_WORK) return "jog";
  return "zoomies";
}
