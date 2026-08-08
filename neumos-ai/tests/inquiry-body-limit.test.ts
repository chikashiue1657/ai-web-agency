import { describe, expect, it } from "vitest";
import { readBodyWithLimit, BodyTooLargeError } from "@/lib/inquiry-body-limit";

function makeStream(chunkCount: number, chunkBytes: number, onCancel: () => void) {
  let pulls = 0;
  return {
    stream: new ReadableStream<Uint8Array>({
      pull(controller) {
        pulls += 1;
        if (pulls > chunkCount) {
          controller.close();
          return;
        }
        controller.enqueue(new Uint8Array(chunkBytes));
      },
      cancel() {
        onCancel();
      },
    }),
    pullCount: () => pulls,
  };
}

describe("readBodyWithLimit", () => {
  it("returns the concatenated body when under the limit", async () => {
    const encoder = new TextEncoder();
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(encoder.encode("hello "));
        controller.enqueue(encoder.encode("world"));
        controller.close();
      },
    });
    await expect(readBodyWithLimit(stream, 20_000)).resolves.toBe("hello world");
  });

  it("returns an empty string when body is null", async () => {
    await expect(readBodyWithLimit(null, 20_000)).resolves.toBe("");
  });

  it("aborts before exhausting the stream once the limit is exceeded", async () => {
    let cancelled = false;
    const { stream, pullCount } = makeStream(3, 10_000, () => {
      cancelled = true;
    });

    await expect(readBodyWithLimit(stream, 20_000)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelled).toBe(true);
    // 3 chunks x 10KB crosses the 20KB limit on the 3rd chunk (30KB total).
    // A 4th pull would signal the reader tried to drain the rest of the stream
    // instead of cancelling early.
    expect(pullCount()).toBeLessThan(4);
  });

  it("does not throw when the body lands exactly on the limit", async () => {
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(new Uint8Array(20_000));
        controller.close();
      },
    });
    await expect(readBodyWithLimit(stream, 20_000)).resolves.toHaveLength(20_000);
  });
});
