"use client";

import { useState } from "react";
import { bytesToHex, isAddress, parseEventLogs, zeroAddress, type Hex } from "viem";
import { connectEvidenceWallet, evidenceAbi, evidenceAddress, evidenceClient, getHandover } from "@/lib/evidence-chain";
import { monadTestnet } from "@/lib/monad-chain";

export function EvidenceTestnet({ digest, verified }: { digest: Hex; verified: boolean }) {
  const [recipient, setRecipient] = useState("");
  const [id, setId] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [transaction, setTransaction] = useState<Hex | null>(null);
  const [record, setRecord] = useState<Awaited<ReturnType<typeof getHandover>> | null>(null);
  const validId = /^0x[0-9a-f]{64}$/i.test(id);
  const mismatch = record !== null && record.digest !== digest;
  const ready = record !== null && !record.accepted && !mismatch;

  async function run(action: "open" | "read" | "accept") {
    const address = evidenceAddress;
    if (!address || busy) return;
    const handoverId = id as Hex;
    setBusy(true);
    setMessage("");
    setTransaction(null);
    try {
      if (action === "read") {
        const result = await getHandover(handoverId);
        setRecord(result.sender === zeroAddress ? null : result);
        setMessage(result.sender === zeroAddress ? "这个交接编号尚未登记。" : "已读取链上交接记录。");
        return;
      }

      const { wallet, account } = await connectEvidenceWallet();
      const call = { address, abi: evidenceAbi, account } as const;
      if (action === "open") {
        if (!isAddress(recipient)) throw new Error("请输入有效的博物馆钱包地址。");
        const salt = bytesToHex(crypto.getRandomValues(new Uint8Array(32)));
        const request = { ...call, functionName: "openHandover", args: [digest, recipient, salt] } as const;
        const gas = await evidenceClient.estimateContractGas(request);
        const hash = await wallet.writeContract({ ...request, gas: gas + gas / 12n });
        setTransaction(hash);
        setMessage("登记交易已提交，正在等待确认…");
        const receipt = await evidenceClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("登记交易执行失败。");
        const [opened] = parseEventLogs({ abi: evidenceAbi, logs: receipt.logs.filter(log => log.address.toLowerCase() === address.toLowerCase()), eventName: "Opened" });
        if (!opened) throw new Error("未在已确认交易中找到交接编号。");
        setId(opened.args.id);
        setRecord(await getHandover(opened.args.id));
        setMessage("登记已确认。把交接编号交给收件人。");
      } else {
        if (!verified || !validId) throw new Error("请先完成当前资料核验。");
        const current = await getHandover(handoverId);
        if (current.accepted) throw new Error("这笔交接已经签收。");
        if (current.digest !== digest) throw new Error("当前档案版本与链上摘要不一致。");
        if (current.recipient.toLowerCase() !== account.toLowerCase()) throw new Error("请切换到登记时指定的接收钱包。");
        const request = { ...call, functionName: "acceptHandover", args: [handoverId, digest] } as const;
        const gas = await evidenceClient.estimateContractGas(request);
        const hash = await wallet.writeContract({ ...request, gas: gas + gas / 12n });
        setTransaction(hash);
        setMessage("签收交易已提交，正在等待确认…");
        const receipt = await evidenceClient.waitForTransactionReceipt({ hash });
        if (receipt.status !== "success") throw new Error("签收交易执行失败。");
        setRecord(await getHandover(handoverId));
        setMessage("博物馆已在 Monad 测试网上签收这一版。");
      }
    } catch (error) {
      setMessage(error instanceof Error ? error.message.split("\n")[0] : "交易失败。");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="testnet-controls">
      <label>博物馆钱包<input value={recipient} onChange={event => setRecipient(event.target.value.trim())} placeholder="0x…" disabled={busy} /></label>
      <button className="action secondary" disabled={busy || !isAddress(recipient)} onClick={() => void run("open")}>用发掘方钱包登记</button>
      <label>交接编号<input value={id} onChange={event => { setId(event.target.value.trim()); setRecord(null); }} placeholder="0x…" disabled={busy} /></label>
      <button className="action secondary" disabled={busy || !validId} onClick={() => void run("read")}>查询链上登记</button>
      {record && <p>{mismatch ? "链上版本不一致" : record.accepted ? "链上已签收" : "链上登记已确认，待签收"}</p>}
      <button className="action secondary" disabled={busy || !verified || !ready} onClick={() => void run("accept")}>用博物馆钱包签收</button>
      <p aria-live="polite">{message}</p>
      {transaction && <a href={`${monadTestnet.blockExplorers.default.url}/tx/${transaction}`} target="_blank" rel="noreferrer">查看测试网交易</a>}
    </div>
  );
}
