import fs from "fs";
import JSON5 from "json5";
import hre from "hardhat";
import { BaseModuleParameters, VaultAsset } from "./types";
import { getAddress, GetContractReturnType } from "viem";
import { ContractTypesMap } from "hardhat/types";

export const readJson5 = (filePath: string) => {
  const json5Content = fs.readFileSync(filePath, "utf8");
  return JSON5.parse(json5Content);
};

export const readDeploymentParameters = (chainId: number): BaseModuleParameters => {
  const filePath = `./ignition/config/chain-${chainId}/parameters.json5`;
  const json5Content = fs.readFileSync(filePath, "utf8");
  const parameters = JSON5.parse(json5Content);

  return { ...parameters, ...parameters["$global"] };
};

export const replaceModuleAddresses = async (
  parameters: BaseModuleParameters,
  paramsMapping: Record<string, string>
) => {
  const replaceRecursively = (obj: Record<string, any>) => {
    for (const key in obj) {
      if (typeof obj[key] === "object" && obj[key] !== null) {
        replaceRecursively(obj[key]);
      } else if (typeof obj[key] === "string" && key in paramsMapping) {
        obj[key] = paramsMapping[key];
      }
    }
  };

  replaceRecursively(parameters);
  return parameters as BaseModuleParameters;
};

export const getVaultAssets = (parameters: BaseModuleParameters, protocolModuleName: string): VaultAsset[] => {
  const vaults = parameters[protocolModuleName];
  const result: VaultAsset[] = [];

  // Get unique token names by looking at keys that end with '.address'
  const tokenNames = [
    ...new Set(
      Object.keys(vaults)
        .filter((key) => key.endsWith(".address"))
        .map((key) => key.replace(".address", ""))
    ),
  ];

  // Create VaultAsset objects for each token
  for (const name of tokenNames) {
    const address = vaults[`${name}.address`];
    const balanceSlot = vaults[`${name}.balanceSlot`];

    if (address && typeof balanceSlot === "number") {
      result.push({
        name,
        address: getAddress(address),
        balanceSlot,
      });
    }
  }

  return result;
};

export const typeCastContract = <T extends keyof ContractTypesMap>(
  _: T, // typescript hack for suggestion of T
  contract: ContractTypesMap[keyof ContractTypesMap]
): ContractTypesMap[T] => {
  return contract as ContractTypesMap[T];
};
