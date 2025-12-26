export const CompressionType = {
    None: 0,
    GZip: 1,
    ZLib: 2,
    Raw: 3
} as const;

export type CompressionType = typeof CompressionType[keyof typeof CompressionType];

/**
 * Detects the compression type of buffer based on magic numbers.
 */
export function detectCompression(data: Uint8Array): CompressionType {
    if (data.length < 2) return CompressionType.None;

    const b0 = data[0]!;
    const b1 = data[1]!;

    if (b0 === 0x1F && b1 === 0x8B) return CompressionType.GZip;

    if ((b0 & 0x0F) === 8) {
        const windowSize = (b0 >> 4) + 8;
        if (windowSize <= 7) {
            const check = (b0 * 256 + b1) % 31;
            if (check === 0) return CompressionType.ZLib;
        }
    }
    return CompressionType.None;
}

export async function decompress(data: Uint8Array): Promise<Uint8Array> {
    const type = detectCompression(data);
    if (type === CompressionType.None) return data;
    const format = type === CompressionType.GZip ? 'gzip' : 'deflate';
    return decompressWithAlgorithm(data, format);
}

export async function decompressWithAlgorithm(data: Uint8Array, format: CompressionFormat): Promise<Uint8Array> {
    try {
        const ds = new DecompressionStream(format);
        const blob = new Blob([data as any]);
        const stream = blob.stream().pipeThrough(ds);
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
    } catch (e) {
        throw new Error(`Failed to decompress using '${format}': ${e}`);
    }
}

/**
 * Compresses data using the specified algorithm (defaults to deflate/zlib for MCA).
 */
export async function compress(data: Uint8Array, format: CompressionFormat = 'deflate'): Promise<Uint8Array> {
    try {
        const cs = new CompressionStream(format);
        const blob = new Blob([data as any]);
        const stream = blob.stream().pipeThrough(cs);
        const buffer = await new Response(stream).arrayBuffer();
        return new Uint8Array(buffer);
    } catch (e) {
        throw new Error(`Failed to compress using '${format}': ${e}`);
    }
}
