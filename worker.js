export default {
  async fetch(request, env, ctx) {
    if (request.method === "OPTIONS") {
      return new Response("", { headers: corsHeaders() });
    }
    if (request.method !== "POST") {
      return new Response(JSON.stringify({ error: "Method Not Allowed" }), {
        status: 405,
        headers: corsHeaders()
      });
    }

    try {
      let body = {};
      try { body = await request.json(); } catch(e) { throw new Error("Invalid JSON body"); }
      const { uid, version, longURL: providedLongURL, redirect } = body;

      if (!uid) throw new Error("Missing uid");
      if (!version && !providedLongURL) throw new Error("Missing version or longURL");

      // ====== 版本映射（请替换为你的真实下载地址） ======
      const versionMap = {
        "1": "https://example.com/download/v1.apk",
        "2": "https://example.com/download/v2.apk",
        "3": "https://example.com/download/v3.apk",
        "4": "https://example.com/download/v4.apk",
        "5": "https://example.com/download/v5.apk",
        "6": "https://example.com/download/v6.apk",
        "7": "https://example.com/download/v7.apk",
        "8": "https://example.com/download/v8.apk",
        "9": "https://example.com/download/v9.apk",
        "10":"https://example.com/download/v10.apk"
      };

      const longURL = providedLongURL || versionMap[String(version)];
      if (!longURL) throw new Error(`No download link for version: ${version}`);

      // Short.io config
      const SHORTIO_DOMAIN = env.SHORTIO_DOMAIN || "appwt.short.gy";
      const SHORTIO_SECRET_KEY = env.SHORTIO_SECRET_KEY || "sk_XivcX9OAHYNBX5oq";

      // detect app type
      const ua = request.headers.get("User-Agent") || "";
      const appType = detectApp(ua);

      // title
      let title = "📦 OTT 下载链接";
      if (appType) title += ` · ${appType}`;
      if (version) title += ` v${version}`;
      const malaysiaNow = new Date(Date.now() + 8 * 60 * 60 * 1000);
      const dateMY = malaysiaNow.toISOString().slice(0,10);
      title += ` (${uid} · ${dateMY})`;

      // create short link with short.io
      let shortData = null;
      for (let i=0;i<5;i++){
        const path = "v" + (version || "auto") + "_" + Math.floor(10000 + Math.random()*90000);
        const resp = await fetch("https://api.short.io/links", {
          method: "POST",
          headers: {
            Authorization: SHORTIO_SECRET_KEY,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            domain: SHORTIO_DOMAIN,
            originalURL: longURL,
            path,
            title
          })
        });
        const j = await resp.json();
        if (resp.ok && j.shortURL) { shortData = j; break; }
        if (j.error && j.error.includes("already exists")) continue;
        else throw new Error(j.error || "Short.io API error");
      }
      if (!shortData) throw new Error("Unable to create short link");

      if (redirect === true || redirect === "1") {
        return Response.redirect(shortData.shortURL, 302);
      }

      return new Response(JSON.stringify({
        success: true,
        shortURL: shortData.shortURL,
        title,
        appType,
        version,
        longURL,
        path: shortData.path || null,
        createdAt: new Date().toISOString()
      }), { status: 200, headers: corsHeaders() });

    } catch(err) {
      return new Response(JSON.stringify({ error: err.message }), {
        status: 400, headers: corsHeaders()
      });
    }
  }
};

function corsHeaders(){
  return {
    "Access-Control-Allow-Origin":"*",
    "Access-Control-Allow-Methods":"POST, OPTIONS",
    "Access-Control-Allow-Headers":"Content-Type, Authorization",
    "Access-Control-Allow-Credentials":"true",
    "Content-Type":"application/json"
  };
}

function detectApp(ua){
  const u = ua.toLowerCase();
  if (u.includes("ott player")) return "OTT Player 🟢";
  if (u.includes("ott tv")) return "OTT TV 🔵";
  if (u.includes("ott navigator")) return "OTT Navigator 🟣";
  if (u.includes("smart tv")) return "Smart TV";
  if (u.includes("android")) return "Android 📱";
  return "Unknown Device";
}
