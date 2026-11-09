const ALLOWED_ORIGINS = new Set([
  "https://fault-line-fix.com",
  "https://www.fault-line-fix.com",
  "http://localhost:5173",
  "http://127.0.0.1:4173",
]);

const SYSTEM_PROMPT = `You are LineFix AI, an industrial maintenance diagnostic assistant for technicians beside production equipment.

Safety is the highest priority. Never recommend bypassing guards, interlocks, lockout/tagout, or other safety controls. Never claim equipment is safe. Require the technician to follow the site's procedures and manufacturer documentation. If energized diagnostics may be required, state that only qualified personnel using the site's energized-work procedure and proper PPE may perform them.

When a photo is supplied, distinguish visible facts from possible causes and ask for closer images when text or fault codes are unreadable.\n\nIf the information is insufficient to diagnose safely or confidently, do not guess. Ask 2 to 4 targeted clarification questions after the Safety First section and before troubleshooting steps.

Use these exact headings in this order:
1. SAFETY FIRST
2. MOST LIKELY CAUSES
3. FAST CHECKS
4. STEP-BY-STEP RESOLUTION
5. VERIFICATION

Keep the response concise and plant-floor scannable. Prefer numbered actions and short bullets. Put de-energized visual checks before tests requiring tools. Separate facts from assumptions. Include stop conditions when a check could reveal an unsafe state. End by asking whether the issue was resolved and requesting the most useful readings, fault codes, or observations if it was not.`;

function corsHeaders(req: Request) {
  const origin = req.headers.get("origin") ?? "";
  return {
    "Access-Control-Allow-Origin": ALLOWED_ORIGINS.has(origin) ? origin : "https://fault-line-fix.com",
    "Access-Control-Allow-Headers": "authorization, apikey, content-type, x-client-info",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Expose-Headers": "x-session-id",
    "Vary": "Origin",
  };
}

function json(req: Request, body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders(req), "Content-Type": "application/json" },
  });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders(req) });
  if (req.method !== "POST") return json(req, { error: "Method not allowed" }, 405);

  const origin = req.headers.get("origin");
  if (origin && !ALLOWED_ORIGINS.has(origin)) {
    return json(req, { error: "Origin not allowed" }, 403);
  }

  const authHeader = req.headers.get("authorization") ?? "";
  if (!authHeader.startsWith("Bearer ")) {
    return json(req, { error: "Authentication required" }, 401);
  }

  let body: { issue?: unknown; equipmentId?: unknown; imageDataUrl?: unknown };
  try {
    body = await req.json();
  } catch {
    return json(req, { error: "Invalid JSON body" }, 400);
  }

  const imageDataUrl = typeof body.imageDataUrl === "string" ? body.imageDataUrl : undefined;
  if (imageDataUrl && (imageDataUrl.length > 5_600_000 || !/^data:image\/(jpeg|png|webp);base64,[A-Za-z0-9+/]+={0,2}$/.test(imageDataUrl))) {
    return json(req, { error: "Invalid image format or size" }, 400);
  }
  const issue = typeof body.issue === "string" ? body.issue.trim() : "";
  const equipmentId = typeof body.equipmentId === "string" ? body.equipmentId.trim() : "Unspecified equipment";
  const reportedIssue = issue || "Describe what is visibly observable in this equipment photo and ask for symptoms or readings before diagnosing.";
  if ((!issue && !imageDataUrl) || issue.length > 10000) {
    return json(req, { error: "Issue is required and must be 10,000 characters or fewer" }, 400);
  }
  if (!equipmentId || equipmentId.length > 160) {
    return json(req, { error: "Equipment identifier must be 160 characters or fewer" }, 400);
  }

  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const openaiKey = Deno.env.get("OPENAI_API_KEY");
  const keyMapRaw = Deno.env.get("SUPABASE_PUBLISHABLE_KEYS");
  if (!supabaseUrl || !openaiKey || !keyMapRaw) {
    return json(req, { error: "Server configuration is incomplete" }, 500);
  }

  let publishableKey = "";
  try {
    publishableKey = JSON.parse(keyMapRaw).default ?? "";
  } catch {
    return json(req, { error: "Server configuration is invalid" }, 500);
  }

  const apiHeaders = {
    apikey: publishableKey,
    Authorization: authHeader,
    "Content-Type": "application/json",
  };

  const userRes = await fetch(`${supabaseUrl}/auth/v1/user`, { headers: apiHeaders });
  if (!userRes.ok) return json(req, { error: "Invalid or expired session" }, 401);
  const user = await userRes.json();
  if (!user?.id) return json(req, { error: "Invalid user session" }, 401);

  const profileRes = await fetch(
    `${supabaseUrl}/rest/v1/profiles?id=eq.${encodeURIComponent(user.id)}&select=organization_id&limit=1`,
    { headers: apiHeaders },
  );
  if (!profileRes.ok) return json(req, { error: "Unable to load technician profile" }, 500);
  const profiles = await profileRes.json();
  const organizationId = profiles?.[0]?.organization_id;
  if (!organizationId) return json(req, { error: "Technician profile is incomplete" }, 409);

  const sessionRes = await fetch(`${supabaseUrl}/rest/v1/diagnostic_sessions?select=id`, {
    method: "POST",
    headers: { ...apiHeaders, Prefer: "return=representation" },
    body: JSON.stringify({
      organization_id: organizationId,
      user_id: user.id,
      equipment_id: equipmentId,
      issue: imageDataUrl ? "[Photo attached] " + reportedIssue : reportedIssue,
      response: "",
    }),
  });
  if (!sessionRes.ok) return json(req, { error: "Unable to create diagnostic session" }, 500);
  const sessions = await sessionRes.json();
  const sessionId = sessions?.[0]?.id;
  if (!sessionId) return json(req, { error: "Unable to create diagnostic session" }, 500);

  const openaiRes = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${openaiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "gpt-4o-mini",
      instructions: SYSTEM_PROMPT,
      input: [{
        role: "user",
        content: [
          { type: "input_text", text: `Equipment: ${equipmentId}\nReported issue: ${reportedIssue}` },
          ...(imageDataUrl ? [{ type: "input_image", image_url: imageDataUrl, detail: "auto" }] : []),
        ],
      }],
      max_output_tokens: 1400,
      temperature: 0.2,
      stream: true,
      store: false,
    }),
  });

  if (!openaiRes.ok || !openaiRes.body) {
    const upstream = await openaiRes.text().catch(() => "");
    console.error("OpenAI request failed", openaiRes.status, upstream.slice(0, 300));
    return json(req, { error: "Diagnostic service is temporarily unavailable" }, 502);
  }

  const upstreamReader = openaiRes.body.getReader();
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let fullText = "";
  let lineBuffer = "";

  const stream = new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          const { value, done } = await upstreamReader.read();
          if (done) break;
          lineBuffer += decoder.decode(value, { stream: true });
          const lines = lineBuffer.split("\n");
          lineBuffer = lines.pop() ?? "";

          for (const line of lines) {
            if (!line.startsWith("data:")) continue;
            const payload = line.slice(5).trim();
            if (!payload || payload === "[DONE]") continue;
            try {
              const event = JSON.parse(payload);
              if (event.type === "response.output_text.delta" && typeof event.delta === "string") {
                fullText += event.delta;
                controller.enqueue(encoder.encode(event.delta));
              }
            } catch {
              // Ignore malformed upstream frames without exposing provider details.
            }
          }
        }
      } catch (error) {
        console.error("Diagnostic stream failed", error);
        controller.error(error);
        return;
      } finally {
        if (fullText) {
          await fetch(
            `${supabaseUrl}/rest/v1/diagnostic_sessions?id=eq.${encodeURIComponent(sessionId)}`,
            {
              method: "PATCH",
              headers: { ...apiHeaders, Prefer: "return=minimal" },
              body: JSON.stringify({ response: fullText }),
            },
          ).catch((error) => console.error("Session persistence failed", error));
        }
      }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      ...corsHeaders(req),
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "no-store",
      "x-session-id": sessionId,
    },
  });
});