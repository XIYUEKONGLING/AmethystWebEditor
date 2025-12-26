import { TagIO } from './index';
import { TagCompound } from './tags';
import { decompressWithAlgorithm } from './compression';

export class RegionReader {
    private view: DataView;
    private uint8: Uint8Array;

    constructor(buffer: ArrayBuffer | Uint8Array) {
        if ((buffer as any) instanceof Uint8Array) {
            this.uint8 = buffer as Uint8Array;
        } else {
            this.uint8 = new Uint8Array(buffer);
        }

        this.view = new DataView(this.uint8.buffer, this.uint8.byteOffset, this.uint8.byteLength);
    }

    /**
     * Checks if a chunk exists at the given local coordinates (0-31).
     */
    public hasChunk(x: number, z: number): boolean {
        return this.getOffsetInfo(x, z) !== 0;
    }

    /**
     * Reads a chunk NBT at the given local coordinates (0-31).
     * @param x Local X (0-31)
     * @param z Local Z (0-31)
     */
    public async readChunk(x: number, z: number): Promise<TagCompound | null> {
        if (!this.hasChunk(x, z)) return null;

        const { sectorOffset } = this.getLocation(x, z);

        // Validation: Sector offset must be >= 2 (0 and 1 are file headers)
        if (sectorOffset < 2) return null;

        // MCA Sector size is 4096 bytes
        const fileOffset = sectorOffset * 4096;

        if (fileOffset >= this.view.byteLength) {
            console.warn(`Chunk offset ${fileOffset} is out of bounds.`);
            return null;
        }

        // === Chunk Header Format ===
        // 4 bytes: Length (Big Endian). Includes the compression byte.
        // 1 byte:  Compression Type (1=GZip, 2=ZLib, 3=None)

        const length = this.view.getInt32(fileOffset, false); // Big Endian
        const compressionType = this.view.getUint8(fileOffset + 4);

        // Actual data length is length - 1 (the compression byte)
        const dataLength = length - 1;

        if (dataLength <= 0 || fileOffset + 5 + dataLength > this.view.byteLength) {
            console.warn(`Invalid chunk data length at ${x},${z}.`);
            return null;
        }

        // Extract the raw compressed data (Skip length + compression byte = 5 bytes)
        const rawData = this.uint8.subarray(fileOffset + 5, fileOffset + 5 + dataLength);

        try {
            let cleanData: Uint8Array;

            switch (compressionType) {
                case 1: // GZip (Common in MCR, rare in MCA)
                    cleanData = await decompressWithAlgorithm(rawData, 'gzip');
                    break;
                case 2: // ZLib (Standard for MCA)
                    // Web API 'deflate' handles ZLib (RFC 1950)
                    cleanData = await decompressWithAlgorithm(rawData, 'deflate');
                    break;
                case 3: // Uncompressed
                    cleanData = rawData;
                    break;
                default:
                    console.error(`Unknown chunk compression type: ${compressionType}`);
                    return null;
            }

            return TagIO.read(cleanData);
        } catch (e) {
            console.error(`Failed to parse chunk ${x},${z} (Type: ${compressionType}):`, e);
            return null;
        }
    }

    /**
     * Returns a list of all present chunks in this region file.
     * Returns array of { x, z } objects.
     */
    public getPresentChunks(): { x: number, z: number }[] {
        const chunks: { x: number, z: number }[] = [];
        for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
                if (this.hasChunk(x, z)) {
                    chunks.push({ x, z });
                }
            }
        }
        return chunks;
    }

    // --- Helpers ---

    private getOffsetInfo(x: number, z: number): number {
        // Location table is the first 4096 bytes.
        // Each entry is 4 bytes.
        // Index = (x & 31) + (z & 31) * 32
        const index = (x & 31) + (z & 31) * 32;
        const offset = index * 4;
        return this.view.getInt32(offset, false);
    }

    private getLocation(x: number, z: number): { sectorOffset: number, sectorCount: number } {
        const info = this.getOffsetInfo(x, z);
        // Format: 3 bytes offset (big endian), 1 byte sector count
        // offset << 8 | count

        const sectorOffset = (info >>> 8);
        const sectorCount = info & 0xFF;

        return { sectorOffset, sectorCount };
    }
}
