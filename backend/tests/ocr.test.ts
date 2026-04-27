process.env.NODE_ENV = "test";

import { testClient } from "hono/testing";
import { describe, it, expect, beforeAll } from "bun:test";
import { client } from "../db";
import { seed } from "../db/seed";
import app from "../server";

const testApp = testClient(app);

let token: string;

beforeAll(async () => {
  try {
    client.exec("DELETE FROM exchange_rates");
    client.exec("DELETE FROM transactions");
    client.exec("DELETE FROM categories");
    client.exec("DELETE FROM settings");
    client.exec("DELETE FROM users");
    client.exec("DELETE FROM currencies");
  } catch (e) {
    // Tables might already be empty
  }

  await seed();

  const res = await testApp.auth.login.$post({
    json: { username: "admin", password: "admin" },
  });
  const body = await res.json();
  token = body.token;
});

function makeAuthHeaders() {
  return { Authorization: `Bearer ${token}` };
}

describe("OCR Upload", () => {
  it("rejects upload without file", async () => {
    const formData = new FormData();
    const res = await app.fetch(
      new Request("http://localhost/api/ocr", {
        method: "POST",
        headers: makeAuthHeaders(),
        body: formData,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("No receipt file");
  });

  it("rejects invalid MIME type", async () => {
    const formData = new FormData();
    formData.append("image", new File(["not a receipt"], "evil.txt", { type: "text/plain" }));

    const res = await app.fetch(
      new Request("http://localhost/api/ocr", {
        method: "POST",
        headers: makeAuthHeaders(),
        body: formData,
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Unsupported file type");
  });

  it("rejects oversized file", async () => {
    const formData = new FormData();
    formData.append("image", new File(["x".repeat(11 * 1024 * 1024)], "huge.jpg", { type: "image/jpeg" }));

    const res = await app.fetch(
      new Request("http://localhost/api/ocr", {
        method: "POST",
        headers: makeAuthHeaders(),
        body: formData,
      })
    );
    expect(res.status).toBe(413);
    const body = await res.json();
    expect(body.error).toContain("File too large");
  });

  it("accepts a valid PDF and returns schema-compliant response", async () => {
    const pdfBytes = new Uint8Array([
      0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a,
    ]);
    const formData = new FormData();
    formData.append("image", new File([pdfBytes], "receipt.pdf", { type: "application/pdf" }));

    const res = await app.fetch(
      new Request("http://localhost/api/ocr", {
        method: "POST",
        headers: makeAuthHeaders(),
        body: formData,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("suggestion");
    expect(body).toHaveProperty("tempId");
    expect(body).toHaveProperty("tempExt");
    expect(body.tempExt).toBe("pdf");
  });

  it("accepts a valid JPEG and returns schema-compliant response", async () => {
    const jpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    const formData = new FormData();
    formData.append("image", new File([jpegBytes], "receipt.jpg", { type: "image/jpeg" }));

    const res = await app.fetch(
      new Request("http://localhost/api/ocr", {
        method: "POST",
        headers: makeAuthHeaders(),
        body: formData,
      })
    );
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toHaveProperty("suggestion");
    expect(body).toHaveProperty("tempId");
    expect(body).toHaveProperty("tempExt");
    expect(body.tempExt).toBe("jpg");
  });
});

describe("OCR URL", () => {
  async function startMockServer(response: Response): Promise<{ stop: () => void; url: string }> {
    const server = Bun.serve({
      port: 0,
      fetch() {
        return response;
      },
    });
    return {
      stop: () => server.stop(true),
      url: `http://localhost:${server.port}/mock-receipt`,
    };
  }

  it("rejects missing URL", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/ocr/url", {
        method: "POST",
        headers: { ...makeAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({}),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("URL is required");
  });

  it("rejects invalid URL", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/ocr/url", {
        method: "POST",
        headers: { ...makeAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ url: "not-a-url" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Invalid URL");
  });

  it("rejects non-HTTP URL schemes", async () => {
    const res = await app.fetch(
      new Request("http://localhost/api/ocr/url", {
        method: "POST",
        headers: { ...makeAuthHeaders(), "Content-Type": "application/json" },
        body: JSON.stringify({ url: "ftp://example.com/receipt.pdf" }),
      })
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain("Only HTTP and HTTPS");
  });

  it("falls back to text extraction for non-image/PDF URLs", async () => {
    const { url, stop } = await startMockServer(
      new Response("not a receipt", { headers: { "content-type": "text/plain" } })
    );
    try {
      const res = await app.fetch(
        new Request("http://localhost/api/ocr/url", {
          method: "POST",
          headers: { ...makeAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("suggestion");
      expect(body).toHaveProperty("tempId");
      expect(body).toHaveProperty("tempExt");
      expect(body.tempExt).toBe("url");
    } finally {
      stop();
    }
  });

  it("rejects oversized response", async () => {
    const bigArray = new Uint8Array(11 * 1024 * 1024).fill(0xff);
    const { url, stop } = await startMockServer(
      new Response(bigArray, { headers: { "content-type": "image/jpeg", "content-length": String(bigArray.length) } })
    );
    try {
      const res = await app.fetch(
        new Request("http://localhost/api/ocr/url", {
          method: "POST",
          headers: { ...makeAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
      );
      expect(res.status).toBe(413);
      const body = await res.json();
      expect(body.error).toContain("File too large");
    } finally {
      stop();
    }
  });

  it("accepts a valid image URL and returns schema-compliant response", async () => {
    const { url, stop } = await startMockServer(
      new Response(
        new Uint8Array([
          0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
          0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
        ]),
        { headers: { "content-type": "image/jpeg" } }
      )
    );
    try {
      const res = await app.fetch(
        new Request("http://localhost/api/ocr/url", {
          method: "POST",
          headers: { ...makeAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("suggestion");
      expect(body).toHaveProperty("tempId");
      expect(body).toHaveProperty("tempExt");
      expect(body.tempExt).toBe("jpg");
    } finally {
      stop();
    }
  });

  it("accepts a valid PDF URL and returns schema-compliant response", async () => {
    const { url, stop } = await startMockServer(
      new Response(
        new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]),
        { headers: { "content-type": "application/pdf" } }
      )
    );
    try {
      const res = await app.fetch(
        new Request("http://localhost/api/ocr/url", {
          method: "POST",
          headers: { ...makeAuthHeaders(), "Content-Type": "application/json" },
          body: JSON.stringify({ url }),
        })
      );
      expect(res.status).toBe(200);
      const body = await res.json();
      expect(body).toHaveProperty("suggestion");
      expect(body).toHaveProperty("tempId");
      expect(body).toHaveProperty("tempExt");
      expect(body.tempExt).toBe("pdf");
    } finally {
      stop();
    }
  });
});

describe("Receipt Serving", () => {
  it("returns a stored PDF receipt with Content-Disposition: attachment", async () => {
    const fs = await import("node:fs");
    const receiptsDir = "data/receipts";
    fs.mkdirSync(receiptsDir, { recursive: true });

    const pdfBytes = new Uint8Array([0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x34, 0x0a]);
    fs.writeFileSync("data/receipts/99999.pdf", pdfBytes);

    const res = await app.fetch(
      new Request("http://localhost/transactions/99999/receipt", {
        headers: makeAuthHeaders(),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("application/pdf");
    expect(res.headers.get("content-disposition")).toContain("attachment");
    expect(res.headers.get("content-disposition")).toContain("receipt-99999.pdf");

    fs.unlinkSync("data/receipts/99999.pdf");
  });

  it("serves an image receipt inline without Content-Disposition", async () => {
    const fs = await import("node:fs");
    const receiptsDir = "data/receipts";
    fs.mkdirSync(receiptsDir, { recursive: true });

    const jpegBytes = new Uint8Array([
      0xff, 0xd8, 0xff, 0xe0, 0x00, 0x10, 0x4a, 0x46, 0x49, 0x46, 0x00, 0x01,
      0x01, 0x00, 0x00, 0x01, 0x00, 0x01, 0x00, 0x00, 0xff, 0xd9,
    ]);
    fs.writeFileSync("data/receipts/99998.jpg", jpegBytes);

    const res = await app.fetch(
      new Request("http://localhost/transactions/99998/receipt", {
        headers: makeAuthHeaders(),
      })
    );

    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toBe("image/jpeg");
    expect(res.headers.get("content-disposition")).toBeNull();

    fs.unlinkSync("data/receipts/99998.jpg");
  });
});
