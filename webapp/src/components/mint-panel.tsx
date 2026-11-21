"use client";

import { useEffect, useMemo, useState } from "react";
import {
  useAccount,
  useChainId,
  useConnect,
  useDisconnect,
  usePublicClient,
  useReadContract,
  useSendTransactionSync,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from "wagmi";
import { encodeFunctionData, formatEther, type Hash } from "viem";
import { contractAddress, isContractConfigured, nftAbi } from "@/lib/contract";
import { monadTestnet } from "@/lib/wagmi";

const ZERO_ADDRESS = "0x0000000000000000000000000000000000000000" as const;

export function MintPanel() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { connectors, connect, isPending: isConnecting } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChain } = useSwitchChain();
  const publicClient = usePublicClient({ chainId: monadTestnet.id });

  const syncMint = useSendTransactionSync();
  const { writeContractAsync } = useWriteContract();

  const [quantity, setQuantity] = useState(1);
  const [gasLimit, setGasLimit] = useState<bigint | null>(null);
  const [gasPrice, setGasPrice] = useState<bigint | null>(null);
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [txHash, setTxHash] = useState<Hash | null>(null);
  const [txMode, setTxMode] = useState<"sync" | "standard" | null>(null);
  const [txError, setTxError] = useState<string | null>(null);
  const [isSending, setIsSending] = useState(false);

  const enabled = isContractConfigured && isConnected && chainId === monadTestnet.id;

  const { data: price } = useReadContract({
    address: contractAddress,
    abi: nftAbi,
    functionName: "mintPrice",
    chainId: monadTestnet.id,
    query: { enabled: isContractConfigured },
  });
  const { data: walletLimit } = useReadContract({
    address: contractAddress,
    abi: nftAbi,
    functionName: "maxPerWallet",
    chainId: monadTestnet.id,
    query: { enabled: isContractConfigured },
  });
  const { data: totalMinted } = useReadContract({
    address: contractAddress,
    abi: nftAbi,
    functionName: "totalMinted",
    chainId: monadTestnet.id,
    query: { enabled: isContractConfigured },
  });
  const { data: maxSupply } = useReadContract({
    address: contractAddress,
    abi: nftAbi,
    functionName: "MAX_SUPPLY",
    chainId: monadTestnet.id,
    query: { enabled: isContractConfigured },
  });
  const { data: saleActive } = useReadContract({
    address: contractAddress,
    abi: nftAbi,
    functionName: "saleActive",
    chainId: monadTestnet.id,
    query: { enabled: isContractConfigured },
  });
  const { data: owned } = useReadContract({
    address: contractAddress,
    abi: nftAbi,
    functionName: "balanceOf",
    args: [address ?? ZERO_ADDRESS],
    chainId: monadTestnet.id,
    query: { enabled: isContractConfigured && Boolean(address) },
  });

  const totalPrice = useMemo(() => (price ?? 0n) * BigInt(quantity), [price, quantity]);
  const remainingForWallet = Math.max(0, Number(walletLimit ?? 5n) - Number(owned ?? 0n));
  const maxQuantity = Math.max(
    1,
    Math.min(remainingForWallet || 5, Number(maxSupply ?? 10000n) - Number(totalMinted ?? 0n))
  );

  // Monad bills on gas_limit, not gas_used. Estimate tightly, add at most 10%.
  useEffect(() => {
    let cancelled = false;
    setGasLimit(null);
    setGasPrice(null);
    setEstimateError(null);
    if (!enabled || !publicClient || price === undefined || !address) return;

    (async () => {
      try {
        const estimate = await publicClient.estimateContractGas({
          address: contractAddress,
          abi: nftAbi,
          functionName: "mint",
          args: [BigInt(quantity)],
          account: address,
          value: totalPrice,
        });
        const buffered = estimate + estimate / 10n;
        const currentGasPrice = await publicClient.getGasPrice();
        if (!cancelled) {
          setGasLimit(buffered);
          setGasPrice(currentGasPrice);
        }
      } catch (error) {
        if (!cancelled) {
          setEstimateError(error instanceof Error ? error.message : "Gas estimation failed");
        }
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled, publicClient, address, quantity, totalPrice, price]);

  // Fallback path only: wait for a receipt when the wallet cannot do sync sends.
  const { data: receipt, isLoading: isConfirming } = useWaitForTransactionReceipt({
    hash: txMode === "standard" ? (txHash ?? undefined) : undefined,
    chainId: monadTestnet.id,
  });

  const maxCost = gasLimit !== null && gasPrice !== null ? gasLimit * gasPrice : null;

  async function handleMint() {
    if (!gasLimit || !address) return;
    const calldata = encodeFunctionData({
      abi: nftAbi,
      functionName: "mint",
      args: [BigInt(quantity)],
    });
    setIsSending(true);
    setTxError(null);
    setTxHash(null);
    setTxMode(null);

    const shared = {
      to: contractAddress,
      data: calldata,
      value: totalPrice,
      gas: gasLimit,
      chainId: monadTestnet.id,
      account: address,
    } as const;

    try {
      // Monad's eth_sendRawTransactionSync gives the receipt in one call where supported.
      const syncReceipt = await syncMint.mutateAsync(shared);
      setTxHash(syncReceipt.transactionHash);
      setTxMode("sync");
    } catch {
      try {
        const hash = await writeContractAsync({
          address: contractAddress,
          abi: nftAbi,
          functionName: "mint",
          args: [BigInt(quantity)],
          value: totalPrice,
          gas: gasLimit,
          chainId: monadTestnet.id,
        });
        setTxHash(hash);
        setTxMode("standard");
      } catch (error) {
        setTxError(error instanceof Error ? error.message : "Transaction failed");
      }
    } finally {
      setIsSending(false);
    }
  }

  return (
    <div className="w-full max-w-xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="mb-6 flex items-center justify-between gap-4">
        <div>
          <h2 className="text-xl font-semibold">Mint an NFT</h2>
          <p className="text-sm text-slate-500">Monad testnet · ERC-721 · OpenZeppelin</p>
        </div>
        {isConnected ? (
          <button
            className="rounded-lg border border-slate-300 px-3 py-2 text-sm hover:bg-slate-50"
            onClick={() => disconnect()}
          >
            {address?.slice(0, 6)}…{address?.slice(-4)}
          </button>
        ) : (
          <button
            className="rounded-lg bg-slate-900 px-3 py-2 text-sm font-medium text-white disabled:opacity-50"
            disabled={isConnecting || connectors.length === 0}
            onClick={() => connect({ connector: connectors[0] })}
          >
            Connect wallet
          </button>
        )}
      </div>

      {!isContractConfigured && (
        <p className="mb-4 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          Set <code>NEXT_PUBLIC_NFT_CONTRACT_ADDRESS</code> in <code>webapp/.env.local</code> after deployment.
          The UI is read-only until then.
        </p>
      )}

      {isConnected && chainId !== monadTestnet.id && (
        <button
          className="mb-4 w-full rounded-lg bg-indigo-600 px-4 py-2 text-sm font-medium text-white"
          onClick={() => switchChain({ chainId: monadTestnet.id })}
        >
          Switch to Monad testnet
        </button>
      )}

      <dl className="mb-6 grid grid-cols-2 gap-3 text-sm">
        <Stat label="Price / NFT" value={price !== undefined ? `${formatEther(price)} MON` : "—"} />
        <Stat
          label="Minted"
          value={totalMinted !== undefined ? `${totalMinted} / ${maxSupply ?? 10000n}` : "—"}
        />
        <Stat label="Your NFTs" value={owned !== undefined ? String(owned) : "—"} />
        <Stat label="Sale" value={saleActive === undefined ? "—" : saleActive ? "Live" : "Paused"} />
      </dl>

      <div className="mb-4">
        <label className="mb-2 block text-sm font-medium" htmlFor="quantity">
          Quantity (max {maxQuantity} per wallet)
        </label>
        <input
          id="quantity"
          type="number"
          min={1}
          max={maxQuantity}
          value={quantity}
          onChange={(event) =>
            setQuantity(Math.max(1, Math.min(maxQuantity, Number(event.target.value) || 1)))
          }
          className="w-full rounded-lg border border-slate-300 px-3 py-2"
        />
      </div>

      <div className="mb-4 rounded-lg bg-slate-50 p-3 text-xs text-slate-600">
        <p>Gas limit (charged on limit): {gasLimit !== null ? gasLimit.toString() : "estimating…"}</p>
        <p>Max gas cost: {maxCost !== null ? `${formatEther(maxCost)} MON` : "—"}</p>
        {estimateError && <p className="mt-1 text-red-600">Estimate failed: {estimateError}</p>}
      </div>

      <button
        className="w-full rounded-lg bg-indigo-600 px-4 py-3 font-medium text-white disabled:cursor-not-allowed disabled:opacity-50"
        disabled={
          !enabled || !saleActive || !gasLimit || isSending || isConfirming || quantity > maxQuantity
        }
        onClick={handleMint}
      >
        {isSending
          ? "Confirm in wallet…"
          : isConfirming
            ? "Confirming…"
            : `Mint ${quantity} for ${formatEther(totalPrice)} MON`}
      </button>

      {(txError || txHash) && (
        <div className="mt-4 break-all text-sm">
          {txError && <p className="text-red-600">{txError}</p>}
          {txHash && (
            <p className="text-emerald-700">
              {txMode === "sync" ? "Confirmed via sync RPC" : "Submitted"} · tx {txHash}
              {receipt && ` · status ${receipt.status}`}
            </p>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg bg-slate-50 p-3">
      <dt className="text-xs text-slate-500">{label}</dt>
      <dd className="mt-1 font-medium">{value}</dd>
    </div>
  );
}
