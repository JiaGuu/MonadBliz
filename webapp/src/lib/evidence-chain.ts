import { createPublicClient, createWalletClient, custom, getAddress, http, isAddress, parseAbi, type EIP1193Provider, type Hex } from "viem";
import { monadTestnet } from "./monad-chain";

export const evidenceAbi = parseAbi([
  "struct Handover { address sender; address recipient; bytes32 digest; bool accepted; }",
  "function openHandover(bytes32 digest, address recipient, bytes32 salt) returns (bytes32 id)",
  "function getHandover(bytes32 id) view returns (Handover)",
  "function acceptHandover(bytes32 id, bytes32 digest)",
  "event Opened(bytes32 indexed id, address indexed sender, address indexed recipient, bytes32 digest)",
]);

const address = process.env.NEXT_PUBLIC_EVIDENCE_CONTRACT_ADDRESS;
export const evidenceAddress = address && isAddress(address) ? getAddress(address) : null;
export const evidenceClient = createPublicClient({
  chain: monadTestnet,
  transport: http(process.env.NEXT_PUBLIC_EVIDENCE_RPC_URL),
});

export async function connectEvidenceWallet() {
  const provider = (window as Window & { ethereum?: EIP1193Provider }).ethereum;
  if (!provider) throw new Error("请在装有浏览器钱包的 Chrome 中打开工作台。");
  const wallet = createWalletClient({ chain: monadTestnet, transport: custom(provider) });
  if (await wallet.getChainId() !== monadTestnet.id) {
    try {
      await wallet.switchChain({ id: monadTestnet.id });
    } catch (error) {
      if (!(error instanceof Error) || !/4902|unrecognized|unknown|not added/i.test(error.message)) throw error;
      await wallet.addChain({ chain: monadTestnet });
      if (await wallet.getChainId() !== monadTestnet.id) await wallet.switchChain({ id: monadTestnet.id });
    }
  }
  const [account] = await wallet.requestAddresses();
  if (!account) throw new Error("钱包没有提供账户。");
  return { wallet, account };
}

export async function getHandover(id: Hex) {
  if (!evidenceAddress) throw new Error("请配置存证合约地址。");
  return evidenceClient.readContract({ address: evidenceAddress, abi: evidenceAbi, functionName: "getHandover", args: [id] });
}
