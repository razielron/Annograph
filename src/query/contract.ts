/** Contract lookup for a node. */

import type { Contract } from "../ir/types.js";
import { GraphIndex } from "./graph.js";

export interface ContractView {
  id: string;
  displayName: string;
  contract: Contract | undefined;
}

export function contractFor(index: GraphIndex, id: string): ContractView | undefined {
  const node = index.node(id);
  if (!node) return undefined;
  return {
    id: node.id,
    displayName: node.displayName,
    contract: node.contract,
  };
}
