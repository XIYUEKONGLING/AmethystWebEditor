export class ByteReader {
    private view: DataView;
    private offset: number = 0;
    private uint8: Uint8Array;

    constructor(buffer: ArrayBuffer | Uint8Array) {
        if ((buffer as any) instanceof Uint8Array) {
            this.uint8 = buffer as Uint8Array;
        } else {
            this.uint8 = new Uint8Array(buffer);
        }

        this.view = new DataView(this.uint8.buffer, this.uint8.byteOffset, this.uint8.byteLength);
    }

    public get position(): number { return this.offset; }

    public readByte(): number {
        this.checkBounds(1);
        return this.view.getInt8(this.offset++);
    }

    public readUByte(): number {
        this.checkBounds(1);
        return this.view.getUint8(this.offset++);
    }

    public readShort(): number {
        this.checkBounds(2);
        const v = this.view.getInt16(this.offset, false);
        this.offset += 2;
        return v;
    }

    public readUShort(): number {
        this.checkBounds(2);
        const v = this.view.getUint16(this.offset, false);
        this.offset += 2;
        return v;
    }

    public readInt(): number {
        this.checkBounds(4);
        const v = this.view.getInt32(this.offset, false);
        this.offset += 4;
        return v;
    }

    public readLong(): bigint {
        this.checkBounds(8);
        const v = this.view.getBigInt64(this.offset, false);
        this.offset += 8;
        return v;
    }

    public readFloat(): number {
        this.checkBounds(4);
        const v = this.view.getFloat32(this.offset, false);
        this.offset += 4;
        return v;
    }

    public readDouble(): number {
        this.checkBounds(8);
        const v = this.view.getFloat64(this.offset, false);
        this.offset += 8;
        return v;
    }

    public readBytes(length: number): Uint8Array {
        this.checkBounds(length);
        const res = this.uint8.subarray(this.offset, this.offset + length);
        this.offset += length;
        return new Uint8Array(res); // Return copy
    }

    private checkBounds(len: number) {
        if (this.offset + len > this.view.byteLength) throw new Error("EndOfStream");
    }
}

export class ByteWriter {
    private buffer: Uint8Array;
    private view: DataView;
    private offset: number = 0;

    constructor(initialCapacity: number = 1024) {
        this.buffer = new Uint8Array(initialCapacity);
        this.view = new DataView(this.buffer.buffer);
    }

    private ensureCapacity(add: number) {
        if (this.offset + add > this.buffer.length) {
            const newSize = Math.max(this.buffer.length * 2, this.offset + add);
            const newBuffer = new Uint8Array(newSize);
            newBuffer.set(this.buffer);
            this.buffer = newBuffer;
            this.view = new DataView(this.buffer.buffer);
        }
    }

    public writeByte(val: number) {
        this.ensureCapacity(1);
        this.view.setInt8(this.offset++, val);
    }

    public writeUByte(val: number) {
        this.ensureCapacity(1);
        this.view.setUint8(this.offset++, val);
    }

    public writeShort(val: number) {
        this.ensureCapacity(2);
        this.view.setInt16(this.offset, val, false);
        this.offset += 2;
    }

    public writeUShort(val: number) {
        this.ensureCapacity(2);
        this.view.setUint16(this.offset, val, false);
        this.offset += 2;
    }

    public writeInt(val: number) {
        this.ensureCapacity(4);
        this.view.setInt32(this.offset, val, false);
        this.offset += 4;
    }

    public writeLong(val: bigint) {
        this.ensureCapacity(8);
        this.view.setBigInt64(this.offset, val, false);
        this.offset += 8;
    }

    public writeFloat(val: number) {
        this.ensureCapacity(4);
        this.view.setFloat32(this.offset, val, false);
        this.offset += 4;
    }

    public writeDouble(val: number) {
        this.ensureCapacity(8);
        this.view.setFloat64(this.offset, val, false);
        this.offset += 8;
    }

    public writeBytes(data: Uint8Array | ArrayLike<number>) {
        this.ensureCapacity(data.length);
        this.buffer.set(data, this.offset);
        this.offset += data.length;
    }

    public toUint8Array(): Uint8Array {
        return this.buffer.subarray(0, this.offset);
    }
}
