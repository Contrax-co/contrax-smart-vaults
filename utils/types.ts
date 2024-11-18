import { Address } from "viem";

export enum DexType {
  UNISWAP_V2 = 0,
  UNISWAP_V3 = 1,
  SUSHISWAP_V2 = 2,
  SUSHISWAP_V3 = 3,
  CAMELOT_V3 = 4,
}

export interface VaultAsset {
  address: Address;
  name: string;
  balanceSlot: number;
}
