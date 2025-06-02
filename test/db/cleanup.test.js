import { jest } from "@jest/globals";
import { deleteExpiredMessages } from "../../jobs/cleanup.js";

describe("Cleanup Job", () => {
  let mockClient;
  let mockPool;
  let mockFastify;

  beforeEach(() => {
    mockClient = {
      query: jest.fn(),
      release: jest.fn(),
    };
    mockPool = { connect: jest.fn().mockResolvedValue(mockClient) };
    mockFastify = {
      pg: { pool: mockPool },
      log: { info: jest.fn(), error: jest.fn() },
    };
  });

  test("deletes expired messages", async () => {
    // Simulate lock, timeout, one batch, then zero batch, unlock
    mockClient.query
      .mockResolvedValueOnce({ rows: [{ acquired: true }] })
      .mockResolvedValueOnce({})
      .mockResolvedValueOnce({ rows: [{ count: 42 }] })
      .mockResolvedValueOnce({ rows: [{ count: 0 }] })
      .mockResolvedValueOnce({ rows: [{ pg_advisory_unlock: true }] });

    const result = await deleteExpiredMessages(mockFastify);
    expect(result.success).toBe(true);
    expect(result.deletedCount).toBe(42);
    expect(mockClient.release).toHaveBeenCalled();
  });
});
