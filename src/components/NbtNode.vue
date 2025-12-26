<script setup lang="ts">
import { ref, computed, watch } from 'vue';
import {
  Tag, TagType, TagCompound, TagList,
  TagByte, TagShort, TagInt, TagLong, TagFloat, TagDouble, TagString, TagByteArray, TagIntArray, TagLongArray
} from '../amethyst';
import { useI18n } from '../locales';

const props = defineProps<{
  tag: Tag;
  name?: string | number;
  depth?: number;
  parentType?: TagType;
  searchQuery?: string;
}>();

const emit = defineEmits(['delete', 'rename']);
const { t } = useI18n();
const isExpanded = ref(false);

const depthVal = props.depth ?? 0;
const indent = computed(() => `${depthVal * 1.5}rem`);

const isContainer = computed(() =>
    props.tag.type === TagType.Compound || props.tag.type === TagType.List
);

const isArray = computed(() =>
    props.tag.type === TagType.ByteArray ||
    props.tag.type === TagType.IntArray ||
    props.tag.type === TagType.LongArray
);

const isSelfMatch = computed(() => {
  if (!props.searchQuery) return false;
  const q = props.searchQuery.toLowerCase();

  if (props.name !== undefined && String(props.name).toLowerCase().includes(q)) {
    return true;
  }

  if (!isContainer.value && !isArray.value) {
    const val = String((props.tag as any).value).toLowerCase();
    if (val.includes(q)) return true;
  }

  return false;
});

function checkDeepMatch(tag: Tag, query: string): boolean {
  const q = query.toLowerCase();

  if (tag instanceof TagCompound) {
    for (const [key, subTag] of (tag as any).tags.entries()) {
      if (key.toLowerCase().includes(q)) return true;
      if (checkDeepMatch(subTag, q)) return true;
    }
  } else if (tag instanceof TagList) {
    for (const subTag of (tag as any).tags) {
      if (checkDeepMatch(subTag, q)) return true;
    }
  } else if (tag instanceof TagString) {
    return tag.value.toLowerCase().includes(q);
  } else if (tag instanceof TagByteArray || tag instanceof TagIntArray || tag instanceof TagLongArray) {
    return false;
  } else {
    return String((tag as any).value).toLowerCase().includes(q);
  }

  return false;
}

watch(() => props.searchQuery, (newQuery) => {
  if (!newQuery) {
    return;
  }

  if (isContainer.value) {
    if (!isExpanded.value) {
      if (checkDeepMatch(props.tag, newQuery)) {
        isExpanded.value = true;
      }
    }
  }
}, { immediate: true });

const typeIcon = computed(() => {
  switch (props.tag.type) {
    case TagType.Compound: return 'fas fa-box text-yellow-400';
    case TagType.List: return 'fas fa-list-ul text-green-400';
    case TagType.String: return 'fas fa-font text-gray-300';
    default: return 'fas fa-code text-blue-400';
  }
});

const children = computed<[string | number, Tag][]>(() => {
  if (props.tag instanceof TagCompound) {
    return Array.from((props.tag as any).tags.entries());
  } else if (props.tag instanceof TagList) {
    return Array.from((props.tag as any).tags.entries());
  }
  return [];
});

const primitiveValue = computed({
  get: () => {
    if (props.tag instanceof TagByte || props.tag instanceof TagShort ||
        props.tag instanceof TagInt || props.tag instanceof TagFloat ||
        props.tag instanceof TagDouble || props.tag instanceof TagString) {
      return (props.tag as any).value;
    }
    if (props.tag instanceof TagLong) {
      return (props.tag as any).value.toString();
    }
    return null;
  },
  set: (val: any) => {
    if (props.tag instanceof TagLong) {
      try { (props.tag as any).value = BigInt(val); } catch {}
    } else if (props.tag instanceof TagString) {
      (props.tag as any).value = val;
    } else {
      (props.tag as any).value = Number(val);
    }
  }
});

function toggle() {
  if (isContainer.value) isExpanded.value = !isExpanded.value;
}

function handleDelete() {
  emit('delete', props.name);
}
</script>

<template>
  <div class="nbt-node text-sm font-mono my-1">
    <!-- Header Row -->
    <div
        class="flex items-center gap-2 p-1 rounded transition-colors group border border-transparent"
        :class="{ 
        'hover:bg-white/5': !isSelfMatch,
        'bg-yellow-500/30 border-yellow-500/50': isSelfMatch 
      }"
        :style="{ paddingLeft: indent }"
    >
      <!-- Expander Arrow -->
      <button
          v-if="isContainer"
          @click.stop="toggle"
          class="w-4 h-4 flex items-center justify-center text-white/50 hover:text-white"
      >
        <i :class="isExpanded ? 'fas fa-caret-down' : 'fas fa-caret-right'"></i>
      </button>
      <span v-else class="w-4"></span>

      <!-- Icon -->
      <i :class="typeIcon" class="text-xs w-4 text-center opacity-80"></i>

      <!-- Name / Key -->
      <span
          class="font-bold mr-1"
          :class="isSelfMatch ? 'text-white' : 'text-purple-300'"
          v-if="name !== undefined && name !== null"
      >
        {{ name }}:
      </span>

      <!-- Value Display / Edit -->
      <div v-if="!isContainer && !isArray" class="flex-1">
        <input
            v-model="primitiveValue"
            class="bg-transparent border-b w-full outline-none px-1"
            :class="isSelfMatch ? 'border-yellow-500 text-white' : 'border-white/10 focus:border-purple-500 text-green-300'"
        />
      </div>

      <!-- Array Info -->
      <span v-else-if="isArray" class="text-gray-400 italic">
        [{{ (tag as any).value.length }} elements]
      </span>

      <!-- Type Hint -->
      <span class="text-xs text-gray-600 ml-2 select-none group-hover:opacity-100 opacity-0 transition-opacity">
        {{ t(`types.${tag.type}`) }}
      </span>

      <!-- Actions -->
      <button @click="handleDelete" class="ml-auto text-red-400 opacity-0 group-hover:opacity-100 px-2">
        <i class="fas fa-trash"></i>
      </button>
    </div>

    <!-- Children Recursion -->
    <div v-if="isContainer && isExpanded" class="border-l border-white/5 ml-4">
      <NbtNode
          v-for="[key, child] in children"
          :key="key"
          :name="key"
          :tag="child as Tag"
          :depth="depthVal + 1"
          :search-query="searchQuery"
          @delete="(k) => {
          if (tag instanceof TagCompound) (tag as any).tags.delete(k);
          else if (tag instanceof TagList) (tag as any).tags.splice(k, 1);
        }"
      />
    </div>
  </div>
</template>
