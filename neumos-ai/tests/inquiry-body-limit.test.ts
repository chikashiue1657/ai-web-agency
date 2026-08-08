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

  it("still throws BodyTooLargeError even when reader.cancel() itself rejects", async () => {
    let cancelAttempted = false;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        controller.enqueue(new Uint8Array(25_000));
      },
      cancel() {
        cancelAttempted = true;
        throw new Error("cancel failed unexpectedly");
      },
    });

    await expect(readBodyWithLimit(stream, 20_000)).rejects.toBeInstanceOf(BodyTooLargeError);
    expect(cancelAttempted).toBe(true);
  });

  it("correctly decodes a multi-byte UTF-8 character split across a chunk boundary", async () => {
    // "あ" (U+3042) is E3 81 82 in UTF-8. Split the 3 bytes across two chunks
    // to make sure decoding happens once on the concatenated buffer, not
    // per-chunk (which would corrupt characters split at a chunk boundary).
    const encoded = new TextEncoder().encode("hello あ world");
    const splitAt = encoded.indexOf(0x81); // middle byte of "あ"'s 3-byte sequence
    const first = encoded.slice(0, splitAt);
    const second = encoded.slice(splitAt);

    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        controller.enqueue(first);
        controller.enqueue(second);
        controller.close();
      },
    });

    await expect(readBodyWithLimit(stream, 20_000)).resolves.toBe("hello あ world");
  });
});
