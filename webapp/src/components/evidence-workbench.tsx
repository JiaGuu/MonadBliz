"use client";

import { type ChangeEvent, useEffect, useState } from "react";
import dynamic from "next/dynamic";
import archive from "@/lib/evidence-manifest.json";
import { evidenceAddress } from "@/lib/evidence-chain";
import { EvidenceTestnet } from "./evidence-testnet";

const ModelViewer = dynamic(() => import("./evidence-model"), { ssr: false, loading: () => <div className="model-empty">正在启动三维查看器…</div> });
const assetPath = (path: string) => `${process.env.NEXT_PUBLIC_BASE_PATH || ""}${path}`;
const photos = [4950, 4954, 4958, 4962, 4966, 4970, 4974, 4978, 4982, 4986, 4990, 4996];
const photoPath = (number: number) => assetPath(`/evidence/view-${number}.jpg`);
type FileStatus = "match" | "changed" | "unavailable";
type Mode = "photo" | "model";

async function digest(data: ArrayBuffer) {
  const buffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(buffer), byte => byte.toString(16).padStart(2, "0")).join("");
}

export function EvidenceWorkbench() {
  const [activePhoto, setActivePhoto] = useState(1);
  const [mode, setMode] = useState<Mode>("model");
  const [replacement, setReplacement] = useState<File | string | null>(null);
  const [receivedModel, setReceivedModel] = useState(false);
  const [results, setResults] = useState<FileStatus[] | null>(null);
  const [manifestError, setManifestError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [receipt, setReceipt] = useState<Date | null>(null);
  const [clipboard, setClipboard] = useState(false);
  const [preview, setPreview] = useState<string | null>(null);
  const version = `V${archive.version}`;
  const archivedModel = archive.files.find(entry => /\.(usdz|glb)$/i.test(entry.path));
  const model = preview ?? (receivedModel ? assetPath("/evidence/mug-received.glb") : (archivedModel ? assetPath(archivedModel.path) : undefined));
  const testnet = evidenceAddress !== null;
  useEffect(() => () => {
    if (preview) URL.revokeObjectURL(preview);
  }, [preview]);
  const passed = results?.every(result => result === "match") ?? false;
  const matched = results?.filter(result => result === "match").length ?? 0;
  const blocked = manifestError || (results !== null && !passed);
  const status = receipt ? "已模拟签收" : busy ? "正在核验…" : passed ? "核验通过" : blocked ? "暂缓签收" : "等待核验";

  function replacePhoto(file: File | string | null) {
    setReplacement(file);
    setResults(null);
    setManifestError(false);
    setReceipt(null);
  }

  function toggleReceivedModel() {
    setReceivedModel(value => !value);
    setPreview(null);
    setMode("model");
    setResults(null);
    setManifestError(false);
    setReceipt(null);
  }

  async function verify() {
    setBusy(true);
    setReceipt(null);
    setResults(null);
    setManifestError(false);
    try {
      const manifest = await fetch(assetPath("/evidence/manifest.json"));
      if (!manifest.ok || await digest(await manifest.arrayBuffer()) !== archive.digest) {
        setManifestError(true);
        return;
      }
      const checks = await Promise.all(archive.files.map(async (entry, index): Promise<FileStatus> => {
        try {
          let data: ArrayBuffer;
          if (index === 0 && replacement instanceof File) {
            data = await replacement.arrayBuffer();
          } else {
            const path = index === 0 && typeof replacement === "string"
              ? replacement
              : receivedModel && entry === archivedModel ? assetPath("/evidence/mug-received.glb") : assetPath(entry.path);
            const response = await fetch(path);
            if (!response.ok) return "unavailable";
            data = await response.arrayBuffer();
          }
          return await digest(data) === entry.sha256 ? "match" : "changed";
        } catch {
          return "unavailable";
        }
      }));
      setResults(checks);
    } catch {
      setManifestError(true);
    } finally {
      setBusy(false);
    }
  }

  function importPhoto(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) replacePhoto(file);
    event.target.value = "";
  }

  function importModel(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (file) setPreview(URL.createObjectURL(file));
    event.target.value = "";
  }

  async function copyDigest() {
    try {
      await navigator.clipboard.writeText(archive.digest);
      setClipboard(true);
    } catch {
      setClipboard(false);
    }
  }

  return (
    <>
      <header className="topbar">
        <div className="page-width topbar-inner">
          <a className="brand" href="#top"><span className="brand-icon" aria-hidden>◈</span><span>证链 <b>3D</b><small>EVIDENCE RELAY</small></span></a>
          <nav aria-label="页面导航"><a href="#top" className="nav-current">交接工作台</a><a href="#files">资料清单</a></nav>
          <div className="environment"><span /> {testnet ? "Monad Testnet" : "本地演示"}</div>
        </div>
      </header>
      <main className="page-width" id="top">
        <section className="heading">
          <div><p className="eyebrow">档案 <span>ER-001</span></p><h1>马克杯交接档案</h1><p>从实拍记录到接收核验，双方确认同一版资料。</p></div>
          <div className="heading-meta"><span>版本 {version}</span><span>拍摄样本 · 50 张</span></div>
        </section>
        <div className="workbench">
          <section className="panel visual" aria-label="样本查看">
            <div className="panel-head"><div><h2>实体记录</h2><p>实拍马克杯</p></div>
              <div className="tabs" aria-label="查看方式">
                <button aria-pressed={mode === "photo"} onClick={() => setMode("photo")}>原始影像</button>
                <button aria-pressed={mode === "model"} onClick={() => setMode("model")}>三维模型</button>
              </div>
            </div>
            <div className="viewport">
              {mode === "photo" ? <>
                {/* Static sample photographs are already resized for the web. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img className="main-photo" src={photoPath(photos[activePhoto])} alt={`马克杯实拍角度 ${activePhoto + 1}`} />
                <span className="frame-tag"><span /> 实拍影像</span><span className="frame-index">{String(activePhoto + 1).padStart(2, "0")} / {photos.length}</span>
              </> : model ? <>
                <ModelViewer key={model} source={model} format={!preview && model.endsWith(".glb") ? "glb" : "usdz"} />
                {!preview && <span className="frame-tag"><span /> {receivedModel ? "收到的模型 · 对照样本" : "展示模型 · 用户提供"}</span>}
              </> : <div className="model-empty"><strong>暂无可用三维模型</strong><p>可以导入已有的 USDZ，或切回实拍影像。</p></div>}
            </div>
            {mode === "photo" ? <>
              <div className="photo-strip" aria-label="选择照片角度">
                {photos.map((number, index) => <button key={number} className={activePhoto === index ? "selected" : ""} aria-pressed={activePhoto === index} aria-label={`角度 ${index + 1}`} onClick={() => setActivePhoto(index)}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={photoPath(number)} alt="" />
                </button>)}
              </div>
              <div className="viewer-foot"><span>选取 12 张环拍影像供浏览</span><button className="text-btn" onClick={() => setActivePhoto(2)}>查看杯身纹样</button></div>
            </> : <div className="viewer-foot"><span>{preview ? "导入模型仅供预览" : model ? "拖动旋转 · 滚动缩放" : "支持 USDZ 文件"}</span>{archivedModel && <a href={assetPath(archivedModel.path)} download>下载档案模型</a>}<button className="text-btn" onClick={() => { setActivePhoto(2); setMode("photo"); }}>对照杯身特写</button><label className="file-input">导入 USDZ<input type="file" accept=".usdz" onChange={importModel} /></label></div>}
          </section>
          <section className="panel receive" aria-labelledby="receive-title">
            <div className="panel-head"><div><h2 id="receive-title">交接核验</h2><p>模拟发掘团队 → 模拟博物馆</p></div><span className="status-dot" data-state={passed ? "ok" : blocked ? "bad" : "idle"} /></div>
            <div className="receive-body">
              <div className="receipt-banner" data-state={passed ? "ok" : blocked ? "bad" : "idle"} aria-live="polite">
                <span className="receipt-icon" aria-hidden>{passed ? "✓" : blocked ? "!" : "◎"}</span>
                <div><strong>{status}</strong><p>{receipt ? `档案 ${version} · ${receipt.toLocaleTimeString("zh-CN", { hour12: false })}` : manifestError ? `无法确认资料清单与 ${version} 基准一致` : results ? `${matched} / ${archive.files.length} 份文件一致` : `对照 ${version} 基准摘要检查交接资料`}</p></div>
              </div>
              <div className="steps">
                <div><span className="step done">✓</span><div><strong>档案已准备</strong><small>{version} 资料与基准摘要</small></div></div>
                <div><span className={passed ? "step done" : "step"}>{passed ? "✓" : "2"}</span><div><strong>接收方核验</strong><small>{results && !passed ? "检查下方标记的差异" : "逐件比对 SHA-256 摘要"}</small></div></div>
                <div><span className={receipt ? "step done" : "step"}>{receipt ? "✓" : "3"}</span><div><strong>确认签收</strong><small>签收记录对应本次资料版本</small></div></div>
              </div>
              <div className="receipt-actions">
                <button className="action primary" onClick={verify} disabled={busy}>{busy ? "正在核验…" : "核验当前资料"}</button>
                {!testnet && <button className="action secondary" onClick={() => setReceipt(new Date())} disabled={!passed || busy || receipt !== null}>模拟确认签收</button>}
              </div>
              {testnet && <EvidenceTestnet digest={`0x${archive.digest}`} verified={passed && !busy} />}
              <div className="simulation">
                <div><strong>切换接收样本</strong><p>{receivedModel ? "使用另一个杯子的模型" : replacement instanceof File ? replacement.name : replacement ? "已替换原位照片，等待核验" : "当前使用原始资料包"}</p></div>
                <div className="simulation-buttons">
                  <button className="text-btn" onClick={toggleReceivedModel} disabled={busy}>{receivedModel ? "恢复登记模型" : "模拟收到另一个杯子"}</button>
                  <button className="text-btn" onClick={() => replacePhoto(replacement ? null : photoPath(4970))} disabled={busy}>{replacement ? "恢复原包" : "模拟替换照片"}</button>
                  <label className="file-input">选取文件<input type="file" accept="image/*,.heic" onChange={importPhoto} disabled={busy} /></label>
                </div>
              </div>
            </div>
          </section>
        </div>
        <section className="panel files" id="files" aria-labelledby="files-title">
          <div className="panel-head"><div><h2 id="files-title">资料清单</h2><p>ER-001 / {version} · {archive.files.length} 份基准文件</p></div><button className="text-btn copy" onClick={copyDigest}>{clipboard ? "已复制" : "复制清单摘要"}</button></div>
          <div className="file-table">
            {archive.files.map((entry, index) => <div key={entry.path} className="file-row"><span className="file-glyph" aria-hidden>{entry.path.endsWith(".jpg") ? "▧" : entry === archivedModel ? "◈" : "≡"}</span><div><a href={assetPath(entry.path)} target="_blank" rel="noreferrer"><strong>{entry.label}</strong></a><small>{entry.name}</small></div><code title={entry.sha256}>{entry.sha256.slice(0, 12)}…</code><span className="file-status" data-state={results?.[index]}>{results?.[index] === "match" ? "一致" : results?.[index] === "changed" ? "不一致" : results?.[index] === "unavailable" ? "读取失败" : "待核验"}</span></div>)}
          </div>
        </section>
        <footer className="footer"><span>证链 3D · Evidence Relay</span><span>{testnet ? "Monad Testnet · 摘要和签收上链" : "本地演示 · 核验与签收未写入 Monad"}</span></footer>
      </main>
    </>
  );
}
