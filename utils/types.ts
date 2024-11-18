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

export type BaseModuleParameters = {
  governance: Address;
  strategist: Address;
  timelock: Address;
  devfund: Address;
  treasury: Address;
  wrappedNative: Address;
  usdc: Address;
  usdcDecimals: number;
  usdcBalanceSlot: number;
} & Record<string, any>;
