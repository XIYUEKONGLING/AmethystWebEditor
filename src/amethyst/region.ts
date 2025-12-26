import { TagIO } from './nbt';
import { TagCompound } from './tags';
import { decompressWithAlgorithm, compress } from './compression';

export class RegionReader {
    private view: DataView;
    private uint8: Uint8Array;

    constructor(buffer: ArrayBuffer | Uint8Array) {
        if (buffer instanceof Uint8Array) {
            this.uint8 = buffer;
        } else {
            this.uint8 = new Uint8Array(buffer);
        }
        this.view = new DataView(this.uint8.buffer, this.uint8.byteOffset, this.uint8.byteLength);
    }

    /**
     * Returns the full binary data of the region file.
     */
    public getData(): Uint8Array {
        return this.uint8;
    }

    public hasChunk(x: number, z: number): boolean {
        return this.getOffsetInfo(x, z) !== 0;
    }

    public async readChunk(x: number, z: number): Promise<TagCompound | null> {
        if (!this.hasChunk(x, z)) return null;

        const { sectorOffset } = this.getLocation(x, z);
        if (sectorOffset < 2) return null;

        const fileOffset = sectorOffset * 4096;
        if (fileOffset >= this.view.byteLength) return null;

        const length = this.view.getInt32(fileOffset, false); // Big Endian
        const compressionType = this.view.getUint8(fileOffset + 4);
        const dataLength = length - 1;

        if (dataLength <= 0 || fileOffset + 5 + dataLength > this.view.byteLength) return null;

        const rawData = this.uint8.subarray(fileOffset + 5, fileOffset + 5 + dataLength);

        try {
            let cleanData: Uint8Array;
            switch (compressionType) {
                case 1: cleanData = await decompressWithAlgorithm(rawData, 'gzip'); break;
                case 2: cleanData = await decompressWithAlgorithm(rawData, 'deflate'); break;
                case 3: cleanData = rawData; break;
                default: return null;
            }
            return TagIO.read(cleanData);
        } catch (e) {
            console.error(e);
            return null;
        }
    }

    /**
     * Updates a chunk in the region file.
     * If the new chunk fits in the old sector, it overwrites it.
     * If it's larger, it appends it to the end of the file to ensure safety.
     */
    public async writeChunk(x: number, z: number, tag: TagCompound): Promise<void> {
        // 1. Convert NBT to bytes
        const nbtData = TagIO.write(tag);

        // 2. Compress (MCA standard uses ZLib/Deflate, ID 2)
        const compressedData = await compress(nbtData, 'deflate');

        // 3. Prepare payload: Length (4) + Type (1) + Data
        // Total length of data (including type byte)
        const dataLength = compressedData.length + 1;
        const totalPayloadSize = 4 + dataLength; // Header + Data

        // 4. Calculate sectors needed (1 sector = 4096 bytes)
        const sectorsNeeded = Math.ceil(totalPayloadSize / 4096);

        // 5. Get current location info
        const { sectorOffset: oldOffset, sectorCount: oldSectors } = this.getLocation(x, z);

        // Logic: Where do we write?
        let writeOffset = 0;

        if (oldOffset >= 2 && sectorsNeeded <= oldSectors) {
            // Case A: Fits in existing space. Overwrite in place.
            writeOffset = oldOffset * 4096;
            // console.log(`Chunk [${x},${z}] updated in place at sector ${oldOffset}.`);
        } else {
            // Case B: Does not fit or is new. Append to end.
            // Note: We are not handling fragmentation (freeing old sectors) for simplicity here.

            // Find end of current file.
            // We need to ensure we align to 4096 bytes.
            const currentFileSize = this.uint8.length;
            const endSector = Math.ceil(currentFileSize / 4096);
            writeOffset = endSector * 4096;

            // Update internal buffer size if needed
            const newFileSize = writeOffset + (sectorsNeeded * 4096);
            if (newFileSize > this.uint8.length) {
                this.expandBuffer(newFileSize);
            }

            // Update Location Table (Header)
            this.setLocation(x, z, endSector, sectorsNeeded);
            // console.log(`Chunk [${x},${z}] moved/appended to sector ${endSector}.`);
        }

        // 6. Write Data
        // Write Length (Big Endian) -> Length is compressed size + 1 (for type byte)
        this.view.setInt32(writeOffset, dataLength, false);

        // Write Compression Type (2 = ZLib)
        this.view.setUint8(writeOffset + 4, 2);

        // Write Compressed Data
        this.uint8.set(compressedData, writeOffset + 5);

        // Update Timestamp Table (bytes 4096-8191)
        // Offset = 4096 + index * 4
        const index = (x & 31) + (z & 31) * 32;
        const timestamp = Math.floor(Date.now() / 1000);
        this.view.setInt32(4096 + (index * 4), timestamp, false);
    }

    public getPresentChunks(): { x: number, z: number }[] {
        const chunks: { x: number, z: number }[] = [];
        for (let z = 0; z < 32; z++) {
            for (let x = 0; x < 32; x++) {
                if (this.hasChunk(x, z)) chunks.push({ x, z });
            }
        }
        return chunks;
    }

    private getOffsetInfo(x: number, z: number): number {
        const index = (x & 31) + (z & 31) * 32;
        const offset = index * 4;
        return this.view.getInt32(offset, false);
    }

    private getLocation(x: number, z: number): { sectorOffset: number, sectorCount: number } {
        const info = this.getOffsetInfo(x, z);
        return { sectorOffset: (info >>> 8), sectorCount: info & 0xFF };
    }

    private setLocation(x: number, z: number, sectorOffset: number, sectorCount: number): void {
        const index = (x & 31) + (z & 31) * 32;
        const offset = index * 4;

        if (sectorOffset > 0xFFFFFF) throw new Error("File too large (sector offset overflow)");
        if (sectorCount > 0xFF) throw new Error("Chunk too large (sector count overflow)");

        const info = (sectorOffset << 8) | (sectorCount & 0xFF);
        this.view.setInt32(offset, info, false);
    }

    private expandBuffer(newSize: number) {
        const newBuffer = new Uint8Array(newSize);
        newBuffer.set(this.uint8);
        this.uint8 = newBuffer;
        this.view = new DataView(this.uint8.buffer);
    }
}
