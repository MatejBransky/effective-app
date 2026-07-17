import { beforeEach, describe, expect, it, vi } from "vitest";

const getAccessTokenMock = vi.fn<() => Promise<string | null>>();
vi.mock("../auth.ts", () => ({ getAccessToken: getAccessTokenMock }));

const { Connector } = await import("./connector.ts");

const fakeTransaction = (crud: ReadonlyArray<Record<string, unknown>>) => ({
  crud,
  complete: vi.fn().mockResolvedValue(undefined),
});

/** Typed `any` on purpose - this only implements the one method `Connector.uploadData`
 * actually calls (`getNextCrudTransaction`), not the full `AbstractPowerSyncDatabase`
 * surface, so it can't structurally satisfy that type. */
const fakeDatabase = (transaction: ReturnType<typeof fakeTransaction> | null): any => ({
  getNextCrudTransaction: vi.fn().mockResolvedValue(transaction),
});

beforeEach(() => {
  getAccessTokenMock.mockReset();
  vi.unstubAllGlobals();
});

describe("Connector.fetchCredentials", () => {
  it("returns the current access token and the PowerSync endpoint", async () => {
    getAccessTokenMock.mockResolvedValue("fresh-token");
    const connector = new Connector();

    const credentials = await connector.fetchCredentials();

    expect(credentials.token).toBe("fresh-token");
    expect(credentials.endpoint).toBe(import.meta.env["VITE_POWERSYNC_URL"]);
  });

  it("throws when there is no authenticated session, so PowerSync retries", async () => {
    getAccessTokenMock.mockResolvedValue(null);
    const connector = new Connector();

    await expect(connector.fetchCredentials()).rejects.toThrow();
  });
});

describe("Connector.uploadData", () => {
  it("does nothing when there is no pending transaction", async () => {
    getAccessTokenMock.mockResolvedValue("token");
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const connector = new Connector();

    await connector.uploadData(fakeDatabase(null));

    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("still calls transaction.complete() when the server reports per-op errors (2xx contract)", async () => {
    getAccessTokenMock.mockResolvedValue("token");
    const transaction = fakeTransaction([
      { id: "1", op: "PUT", table: "hosts", opData: { name: "Test" } },
    ]);
    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ errors: [{ id: "1", reason: "validation failed" }] }),
      }),
    );
    const connector = new Connector();

    await connector.uploadData(fakeDatabase(transaction));

    expect(transaction.complete).toHaveBeenCalledOnce();
  });

  it("throws without completing the transaction on a non-2xx response", async () => {
    getAccessTokenMock.mockResolvedValue("token");
    const transaction = fakeTransaction([
      { id: "1", op: "PUT", table: "hosts", opData: { name: "Test" } },
    ]);
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    const connector = new Connector();

    await expect(connector.uploadData(fakeDatabase(transaction))).rejects.toThrow();
    expect(transaction.complete).not.toHaveBeenCalled();
  });

  it("throws without calling fetch when there is no authenticated session", async () => {
    getAccessTokenMock.mockResolvedValue(null);
    const transaction = fakeTransaction([
      { id: "1", op: "PUT", table: "hosts", opData: { name: "Test" } },
    ]);
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    const connector = new Connector();

    await expect(connector.uploadData(fakeDatabase(transaction))).rejects.toThrow();
    expect(fetchMock).not.toHaveBeenCalled();
  });
});
