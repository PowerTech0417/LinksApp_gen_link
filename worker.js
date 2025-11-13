export default {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);

    // === 📥 下载中转 ===
    if (url.pathname.startsWith("/dl/")) {
      const zone = parseInt(url.pathname.split("/dl/")[1]);
      return handleDownload(zone);
    }

    // === ✅ 处理 CORS ===
    if (request.method === "OPTIONS") {
      return new Response("", { headers: corsHeaders() });
    }

    if (request.method !== "POST") {
      return new Response("Method Not Allowed", {
        status: 405,
        headers: corsHeaders(),
      });
    }

    try {
      // === 📦 读取请求体 ===
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

      // === 🧱 防重复（最多尝试 5 次）===
      let shortData = null;
      let attempt = 0;

      for (attempt = 1; attempt <= 5; attempt++) {
        const id = Math.floor(1 + Math.random() * 10); // 随机选 zone
        const hiddenRedirect = `https://${url.hostname}/dl/${id}`;

        const response = await fetch("https://api.short.io/links", {
          method: "POST",
          headers: {
            Authorization: SHORTIO_SECRET_KEY,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            domain: SHORTIO_DOMAIN,
            originalURL: hiddenRedirect,
            path: "v" + id + "-" + Math.floor(1000 + Math.random() * 90000),
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
        if (attempt === 5)
          throw new Error(data.error || "短链接生成失败，请稍后重试。");
      }

      if (!shortData) throw new Error("生成短链接失败（超过最大重试次数）");

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
  },
};

// === 🔒 下载隐藏逻辑 ===
async function handleDownload(zone) {
  try {
    const jsonURL =
      "https://raw.githubusercontent.com/PowerTech0417/LinksApp_worker/refs/heads/main/downloads.json";

    const res = await fetch(jsonURL);
    const data = await res.json();

    if (!data.downloads || !Array.isArray(data.downloads)) {
      throw new Error("JSON 格式错误：缺少 downloads 数组");
    }

    const app = data.downloads.find((x) => x.zone === zone);
    if (!app) {
      return new Response("Not Found", { status: 404 });
    }

    // 下载源
    const fileRes = await fetch(app.url);

    const headers = new Headers(fileRes.headers);
    headers.set(
      "Content-Disposition",
      `attachment; filename="${app.name || "App"}.apk"`
    );
    headers.set("Cache-Control", "no-store");

    return new Response(fileRes.body, { status: 200, headers });
  } catch (err) {
    return new Response("Download error: " + err.message, { status: 500 });
  }
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
