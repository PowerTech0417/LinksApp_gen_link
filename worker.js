export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;

    // === ✅ CORS 处理 ===
    if (request.method === "OPTIONS") {
      return new Response("", { headers: corsHeaders() });
    }

    // === 🧩 下载中转接口 ===
    if (path.startsWith("/dl/")) {
      const code = path.split("/dl/")[1];
      return handleDownload(code, env);
    }

    // === 🔗 创建短链接 ===
    if (request.method === "POST") {
      try {
        const { longURL, uid, version, redirect } = await request.json();
        if (!longURL) throw new Error("Missing longURL");

        // === 🧩 Short.io 配置 ===
        const SHORTIO_DOMAIN = "appwt.short.gy";
        const SHORTIO_SECRET_KEY = env.SHORTIO_SECRET_KEY || "sk_XivcX9OAHYNBX5oq";

        // === 🧠 标题 ===
        let title = "📦";
        if (version) title += ` v${version}`;
        const malaysiaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
        const dateMY = malaysiaNow.toISOString().slice(0, 10);
        title += uid ? ` (${uid} · ${dateMY})` : ` (${dateMY})`;

        // === 🎯 生成随机短码，用于下载代理 ===
        const code = Math.random().toString(36).substring(2, 8);
        const maskedURL = `https://${url.host}/dl/${code}`; // ⛔ 替代真实链接

        // === 🧱 防重复（最多尝试 5 次）===
        let shortData = null;
        let attempt = 0;

        for (attempt = 1; attempt <= 5; attempt++) {
          const id = "id" + Math.floor(1000 + Math.random() * 90000);

          const response = await fetch("https://api.short.io/links", {
            method: "POST",
            headers: {
              Authorization: SHORTIO_SECRET_KEY,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              domain: SHORTIO_DOMAIN,
              originalURL: maskedURL, // ✅ 使用中转链接，而不是真实URL
              path: id,
              title,
            }),
          });

          const text = await response.text();
          let data;
          try {
            data = JSON.parse(text);
          } catch {
            throw new Error("Short.io 返回错误: " + text);
          }

          if (response.ok && data.shortURL) {
            shortData = data;
            break;
          }

          if (data.error && data.error.includes("already exists")) continue;
          if (attempt === 5) throw new Error(data.error || "短链接生成失败，请稍后重试。");
        }

        if (!shortData) throw new Error("生成短链接失败（超过最大重试次数）");

        // === 💾 保存真实下载映射到 KV ===
        await env.DOWNLOAD_MAP.put(code, JSON.stringify({
          url: longURL,
          uid,
          version,
          createdAt: Date.now(),
        }));

        // === 📺 redirect 模式 ===
        if (redirect === true || redirect === "1") {
          return Response.redirect(shortData.shortURL, 302);
        }

        // === 默认返回 JSON ===
        return new Response(
          JSON.stringify({
            shortURL: shortData.shortURL,
            title,
            attempts: attempt,
            id: shortData.idString || shortData.path,
            createdAt: new Date().toISOString(),
          }),
          { status: 200, headers: corsHeaders() }
        );
      } catch (err) {
        return new Response(JSON.stringify({ error: err.message }), {
          status: 500,
          headers: corsHeaders(),
        });
      }
    }

    // === 默认响应 ===
    return new Response("✅ Shortlink + Safe Download Worker Ready", {
      headers: { "Content-Type": "text/plain" },
    });
  },
};

// === 🕵️‍♂️ 下载中转（隐藏真实源） ===
async function handleDownload(code, env) {
  const data = await env.DOWNLOAD_MAP.get(code, "json");
  if (!data || !data.url) {
    return new Response("❌ 无效或已过期的下载链接", { status: 404 });
  }

  const res = await fetch(data.url, { redirect: "follow" });
  const headers = new Headers(res.headers);
  headers.set("Access-Control-Allow-Origin", "*");
  headers.set("Content-Disposition", "attachment");

  return new Response(res.body, {
    status: res.status,
    headers,
  });
}

// === 🌐 CORS 支持 ===
function corsHeaders() {
  return {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "Content-Type, Authorization",
    "Access-Control-Allow-Credentials": "true",
    "Content-Type": "application/json",
  };
}
