<!DOCTYPE html>
<html lang="zh-CN">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>🔗 OTT 智能短链接生成器</title>
<style>
  body {
    font-family: system-ui, sans-serif;
    background: radial-gradient(circle at top, #0a0f1c, #02040a);
    color: #eaf0ff;
    text-align: center;
    padding: 2em;
  }
  h1 { color: #00e0ff; margin-bottom: 1em; }
  input {
    width: 80%; max-width: 320px; padding: 10px; border-radius: 8px;
    border: none; margin: 10px 0 20px; font-size: 1em;
  }
  .btn-versions {
    display: grid; grid-template-columns: repeat(auto-fit, minmax(110px, 1fr));
    gap: 0.8em; justify-content: center; margin: 1.5em auto; max-width: 480px;
  }
  button.version-btn {
    background: #00e0ff; border: none; color: #000; font-weight: bold;
    padding: 14px; border-radius: 12px; cursor: pointer; font-size: 1em;
    transition: all 0.2s ease;
  }
  button.version-btn.selected { background: #00b0cc; transform: scale(1.12); }
  button.version-btn:hover { background: #00b0cc; }
  .btn-main {
    background: #0ff; color: #000; border: none; border-radius: 8px;
    padding: 10px 16px; cursor: pointer; margin: 8px; font-weight: bold;
    font-size: 1em;
  }
  pre {
    background: #000a1a; color: #00ffff; padding: 12px; border-radius: 8px;
    margin-top: 12px; word-wrap: break-word; white-space: pre-wrap;
  }
</style>
</head>
<body>
  <h1>🔗 OTT 智能短链接生成器</h1>
  <label>UID（用户代号）</label><br/>
  <input id="uid" type="text" placeholder="例如：user123" />

  <h3>请选择下载版本：</h3>
  <div class="btn-versions" id="versionContainer"></div>

  <button id="generate" class="btn-main">⚙️ 生成短链接</button>
  <button id="copyBtn" class="btn-main hidden">📋 复制短链接</button>

  <pre id="output">👉 输入 UID，选择版本，然后点击“生成短链接”</pre>

<script>
const workerURL = "https://cn.shortlink-931.workers.dev/";
const baseDownload = "https://pwapp.genapp.workers.dev/";
const secret = "mySuperSecretKey";
let selectedVersion = null;

// === 动态生成10个按钮 ===
const container = document.getElementById("versionContainer");
for (let i = 1; i <= 10; i++) {
  const btn = document.createElement("button");
  btn.className = "version-btn";
  btn.textContent = `版本 ${i}`;
  btn.dataset.version = i;
  btn.onclick = () => {
    document.querySelectorAll(".version-btn").forEach(b => b.classList.remove("selected"));
    btn.classList.add("selected");
    selectedVersion = i;
    document.getElementById("output").textContent = `✅ 已选择版本 ${i}`;
  };
  container.appendChild(btn);
}

// === 计算签名函数（与 Worker 一致） ===
async function sign(text, key) {
  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(key),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );
  const sigBuffer = await crypto.subtle.sign("HMAC", cryptoKey, new TextEncoder().encode(text));
  return Array.from(new Uint8Array(sigBuffer)).map(b => b.toString(16).padStart(2, "0")).join("");
}

// === 主逻辑 ===
document.getElementById("generate").addEventListener("click", async () => {
  const uid = document.getElementById("uid").value.trim();
  const output = document.getElementById("output");
  const copyBtn = document.getElementById("copyBtn");
  if (!uid) return alert("请输入 UID");
  if (!selectedVersion) return alert("请选择一个版本");

  output.textContent = "⏳ 正在生成短链接，请稍候...";

  try {
    const sig = await sign(`${uid}:${selectedVersion}`, secret);
    const longURL = `${baseDownload}?uid=${encodeURIComponent(uid)}&zone=${selectedVersion}&sig=${sig}`;

    const res = await fetch(workerURL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ longURL, uid, version: selectedVersion })
    });

    const data = await res.json();
    if (data.error) throw new Error(data.error);

    output.innerHTML = `✅ 短链接生成成功：<br><a href="${data.shortURL}" target="_blank">${data.shortURL}</a><br><br>📄 ${data.title}`;
    copyBtn.classList.remove("hidden");
    copyBtn.onclick = () => {
      navigator.clipboard.writeText(data.shortURL);
      copyBtn.textContent = "✅ 已复制";
      setTimeout(() => (copyBtn.textContent = "📋 复制短链接"), 2000);
    };
  } catch (err) {
    output.textContent = `❌ 生成失败：${err.message}`;
  }
});
</script>
</body>
</html>
