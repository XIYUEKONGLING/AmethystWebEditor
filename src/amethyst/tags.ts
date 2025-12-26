import { ByteReader, ByteWriter } from './io';
import { TagType } from './types';

export abstract class Tag {
    public name: string | null = null;
    public abstract get type(): TagType;

    public abstract writePayload(stream: ByteWriter): void;
    public abstract readPayload(stream: ByteReader): void;

    public write(stream: ByteWriter, writeId: boolean = true, writeName: boolean = true): void {
        if (writeId) {
            stream.writeByte(this.type);
        }

        if (writeName) {
            if (this.name === null) throw new Error("Tag name cannot be null when writing name.");

            const nameBytes = new TextEncoder().encode(this.name);
            stream.writeUShort(nameBytes.length);
            stream.writeBytes(nameBytes);
        }

        this.writePayload(stream);
    }

    public static create(type: number): Tag {
        switch (type) {
            case TagType.End: return new TagEnd();
            case TagType.Byte: return new TagByte();
            case TagType.Short: return new TagShort();
            case TagType.Int: return new TagInt();
            case TagType.Long: return new TagLong();
            case TagType.Float: return new TagFloat();
            case TagType.Double: return new TagDouble();
            case TagType.ByteArray: return new TagByteArray();
            case TagType.String: return new TagString();
            case TagType.List: return new TagList();
            case TagType.Compound: return new TagCompound();
            case TagType.IntArray: return new TagIntArray();
            case TagType.LongArray: return new TagLongArray();
            default: throw new Error(`Unknown NBT Tag Type ID: ${type}`);
        }
    }
}

export class TagEnd extends Tag {
    get type() { return TagType.End; }
    writePayload(_: ByteWriter): void {}
    readPayload(_: ByteReader): void {}
}

export class TagByte extends Tag {
    public value: number;

    constructor(value: number = 0) {
        super();
        this.value = value;
    }

    get type() { return TagType.Byte; }
    writePayload(s: ByteWriter): void { s.writeByte(this.value); }
    readPayload(s: ByteReader): void { this.value = s.readByte(); }
}

export class TagShort extends Tag {
    public value: number;

    constructor(value: number = 0) {
        super();
        this.value = value;
    }

    get type() { return TagType.Short; }
    writePayload(s: ByteWriter): void { s.writeShort(this.value); }
    readPayload(s: ByteReader): void { this.value = s.readShort(); }
}

export class TagInt extends Tag {
    public value: number;

    constructor(value: number = 0) {
        super();
        this.value = value;
    }

    get type() { return TagType.Int; }
    writePayload(s: ByteWriter): void { s.writeInt(this.value); }
    readPayload(s: ByteReader): void { this.value = s.readInt(); }
}

export class TagLong extends Tag {
    public value: bigint;

    constructor(value: bigint = 0n) {
        super();
        this.value = value;
    }

    get type() { return TagType.Long; }
    writePayload(s: ByteWriter): void { s.writeLong(this.value); }
    readPayload(s: ByteReader): void { this.value = s.readLong(); }
}

export class TagFloat extends Tag {
    public value: number;

    constructor(value: number = 0) {
        super();
        this.value = value;
    }

    get type() { return TagType.Float; }
    writePayload(s: ByteWriter): void { s.writeFloat(this.value); }
    readPayload(s: ByteReader): void { this.value = s.readFloat(); }
}

export class TagDouble extends Tag {
    public value: number;

    constructor(value: number = 0) {
        super();
        this.value = value;
    }

    get type() { return TagType.Double; }
    writePayload(s: ByteWriter): void { s.writeDouble(this.value); }
    readPayload(s: ByteReader): void { this.value = s.readDouble(); }
}

export class TagByteArray extends Tag {
    public value: Int8Array;

    constructor(value?: Int8Array) {
        super();
        this.value = value ?? new Int8Array(0);
    }

    get type() { return TagType.ByteArray; }

    writePayload(s: ByteWriter): void {
        s.writeInt(this.value.length);
        s.writeBytes(new Uint8Array(this.value.buffer, this.value.byteOffset, this.value.byteLength));
    }

    readPayload(s: ByteReader): void {
        const len = s.readInt();
        const bytes = s.readBytes(len);
        this.value = new Int8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    }
}

export class TagString extends Tag {
    public value: string;

    constructor(value: string = "") {
        super();
        this.value = value;
    }

    get type() { return TagType.String; }

    writePayload(s: ByteWriter): void {
        const bytes = new TextEncoder().encode(this.value);
        s.writeUShort(bytes.length);
        s.writeBytes(bytes);
    }

    readPayload(s: ByteReader): void {
        const len = s.readUShort();
        const bytes = s.readBytes(len);
        this.value = new TextDecoder().decode(bytes);
    }
}

export class TagList extends Tag implements Iterable<Tag> {
    private tags: Tag[] = [];
    public listType: TagType = TagType.End;

    get type() { return TagType.List; }

    get length(): number { return this.tags.length; }

    add(tag: Tag): void {
        this.tags.push(tag);
    }

    get(index: number): Tag | undefined { return this.tags[index]; }

    [Symbol.iterator](): Iterator<Tag> { return this.tags[Symbol.iterator](); }

    writePayload(s: ByteWriter): void {
        if (this.tags.length > 0) {
            const firstTag = this.tags[0];
            if (!firstTag) throw new Error("Unexpected undefined tag");

            this.listType = firstTag.type;

            for (const t of this.tags) {
                if (t.type !== this.listType) {
                    throw new Error("All tags in a TAG_List must be of the same type.");
                }
            }
        }

        s.writeByte(this.listType);
        s.writeInt(this.tags.length);

        for (const tag of this.tags) {
            tag.writePayload(s);
        }
    }

    readPayload(s: ByteReader): void {
        const typeId = s.readByte();
        this.listType = typeId as TagType;
        const count = s.readInt();

        this.tags = [];
        if (count <= 0) return;

        for (let i = 0; i < count; i++) {
            const tag = Tag.create(this.listType);
            tag.readPayload(s);
            this.tags.push(tag);
        }
    }
}

export class TagCompound extends Tag {
    private tags: Map<string, Tag> = new Map();

    get type() { return TagType.Compound; }

    set(name: string, tag: Tag): void {
        tag.name = name;
        this.tags.set(name, tag);
    }

    get(name: string): Tag | undefined {
        return this.tags.get(name);
    }

    getInt(name: string): number {
        const t = this.get(name);
        return (t instanceof TagInt) ? t.value : 0;
    }

    getString(name: string): string {
        const t = this.get(name);
        return (t instanceof TagString) ? t.value : "";
    }

    writePayload(s: ByteWriter): void {
        for (const tag of this.tags.values()) {
            tag.write(s, true, true);
        }
        s.writeByte(TagType.End);
    }

    readPayload(s: ByteReader): void {
        this.tags.clear();
        while (true) {
            const typeId = s.readByte();
            if (typeId === TagType.End) break;

            const nameLen = s.readUShort();
            const nameBytes = s.readBytes(nameLen);
            const name = new TextDecoder().decode(nameBytes);

            const tag = Tag.create(typeId);
            tag.name = name;
            tag.readPayload(s);

            this.tags.set(name, tag);
        }
    }
}

export class TagIntArray extends Tag {
    public value: Int32Array;

    constructor(value?: Int32Array) {
        super();
        this.value = value ?? new Int32Array(0);
    }

    get type() { return TagType.IntArray; }

    writePayload(s: ByteWriter): void {
        s.writeInt(this.value.length);
        for (const i of this.value) {
            s.writeInt(i);
        }
    }

    readPayload(s: ByteReader): void {
        const len = s.readInt();
        this.value = new Int32Array(len);
        for (let i = 0; i < len; i++) {
            this.value[i] = s.readInt();
        }
    }
}

export class TagLongArray extends Tag {
    public value: BigInt64Array;

    constructor(value?: BigInt64Array) {
        super();
        this.value = value ?? new BigInt64Array(0);
    }

    get type() { return TagType.LongArray; }

    writePayload(s: ByteWriter): void {
        s.writeInt(this.value.length);
        for (const l of this.value) {
            s.writeLong(l);
        }
    }

    readPayload(s: ByteReader): void {
        const len = s.readInt();
        this.value = new BigInt64Array(len);
        for (let i = 0; i < len; i++) {
            this.value[i] = s.readLong();
        }
    }
}
