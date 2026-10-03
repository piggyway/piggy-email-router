interface Env {
  FORWARD_TO: string;
  MAIL_BUCKET: R2Bucket;
  BACKEND: Fetcher;
  MAIL_INGEST_TOKEN: string;
}

const INGEST_URL = "https://backend/api/v1/webhooks/mail/ingest";

async function sha256Hex(input: ArrayBuffer | string): Promise<string> {
  const bytes = typeof input === "string" ? new TextEncoder().encode(input) : input;
  const digest = await crypto.subtle.digest("SHA-256", bytes);
  return Array.from(new Uint8Array(digest), (b) => b.toString(16).padStart(2, "0")).join("");
}

async function archive(message: ForwardableEmailMessage, env: Env): Promise<string | null> {
  let key: string | undefined;
  try {
    const raw = await new Response(message.raw).arrayBuffer();
    const messageId = message.headers.get("message-id")?.trim();
    key = `inbound/${await sha256Hex(messageId || raw)}.eml`;
    if (await env.MAIL_BUCKET.head(key)) {
      console.info(JSON.stringify({ msg: "MAIL_R2_KEY_EXISTS", key }));
      return key;
    }
    await env.MAIL_BUCKET.put(key, raw, {
      httpMetadata: { contentType: "message/rfc822" },
      customMetadata: {
        envelope_from: message.from,
        envelope_to: message.to,
        received_at: new Date().toISOString(),
      },
    });
    return key;
  } catch (error) {
    console.error(
      JSON.stringify({ code: "MAIL_R2_WRITE_FAILED", key: key ?? null, error: String(error) })
    );
    return null;
  }
}

async function notifyBackend(key: string, env: Env): Promise<void> {
  try {
    const res = await env.BACKEND.fetch(INGEST_URL, {
      method: "POST",
      headers: {
        "content-type": "application/json",
        "x-mail-ingest-token": env.MAIL_INGEST_TOKEN,
      },
      body: JSON.stringify({ key }),
    });
    if (!res.ok) {
      console.error(
        JSON.stringify({
          code: "MAIL_INGEST_NOTIFY_FAILED",
          key,
          status: res.status,
          body: (await res.text().catch(() => "")).slice(0, 200),
        })
      );
    }
  } catch (error) {
    console.error(
      JSON.stringify({ code: "MAIL_INGEST_NOTIFY_FAILED", key, status: null, error: String(error) })
    );
  }
}

export default {
  async email(message, env, ctx) {
    const recipients = env.FORWARD_TO.split(",")
      .map((address) => address.trim())
      .filter((address) => address.length > 0);

    if (recipients.length === 0) {
      throw new Error("FORWARD_TO contains no recipient addresses");
    }

    await Promise.all(recipients.map((to) => message.forward(to)));

    const key = await archive(message, env);
    if (key) {
      ctx.waitUntil(notifyBackend(key, env));
    }
  },
} satisfies ExportedHandler<Env>;
