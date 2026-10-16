import { describe, expect, test } from "bun:test";

import { hashSecret } from "./secret-hash.server";

describe("hash de segredo", () => {
  test("estável, em hex e sem o segredo dentro", () => {
    const secret = `nlc_${"a".repeat(43)}`;

    expect(hashSecret(secret)).toBe(hashSecret(secret));
    expect(hashSecret(secret)).toMatch(/^[0-9a-f]{64}$/);
    expect(hashSecret(secret)).not.toContain(secret);
  });
});
