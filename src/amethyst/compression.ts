export const CompressionType = {
    None: 0,
    GZip: 1,
    ZLib: 2,
    Raw: 3 // 3 means uncompressed in MCA standard
} as const;

export type CompressionType = typeof CompressionType[keyof typeof CompressionType];

/**
 * Detects the compression type of buffer based on magic numbers.
 */
export function detectCompression(data: Uint8Array): CompressionType {
    if (data.length < 2) return CompressionType.None;

    const b0 = data[0]!;
    const b1 = data[1]!;

    // GZip Magic Number: 0x1F 0x8B
    if (b0 === 0x1F && b1 === 0x8B) {
        return CompressionType.GZip;
    }

    // ZLib Header Check (RFC 1950)
    // CMF (Compression Method and flags) is usually 0x78 (Deflate, 32k window)
    // CMF = b0, FLG = b1
    // The check is: (CMF * 256 + FLG) % 31 must be 0
    if ((b0 & 0x0F) === 8) { // Method 8 is Deflate
        const windowSize = (b0 >> 4) + 8; // Window size log2
        if (windowSize <= 7) { // 32k window or smaller (standard is 7 -> 32k)
            const check = (b0 * 256 + b1) % 31;
            if (check === 0) {
                return CompressionType.ZLib;
            }
        }
    }

    return CompressionType.None;
}

/**
 * Decompresses the data automatically by detecting magic numbers.
 * Useful for level.dat.
 */
export async function decompress(data: Uint8Array): Promise<Uint8Array> {
    const type = detectCompression(data);

    if (type === CompressionType.None) {
        return data;
    }

    const format = type === CompressionType.GZip ? 'gzip' : 'deflate';
    return decompressWithAlgorithm(data, format);
}

/**
 * Decompresses data using a specific algorithm.
 * Useful for MCA chunks where the compression type is explicitly stated in the header.
 */
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
