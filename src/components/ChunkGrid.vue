<script setup lang="ts">
import { computed } from 'vue';
import { useI18n } from '../locales';

const props = defineProps<{
  chunks: { x: number, z: number }[];
}>();

const emit = defineEmits(['select-chunk']);
const { t } = useI18n();

// Create a 32x32 grid representation
const grid = computed(() => {
  const map = new Map<string, boolean>();
  props.chunks.forEach(c => map.set(`${c.x},${c.z}`, true));
  return map;
});
</script>

<template>
  <div class="flex flex-col items-center">
    <h3 class="text-white/80 mb-4">{{ chunks.length }} {{ t('region.chunkCount') }}</h3>
    <div class="grid grid-cols-32 gap-[1px] bg-white/5 p-1 rounded border border-white/10" style="width: fit-content;">
      <div
          v-for="z in 32"
          :key="`row-${z}`"
          class="contents"
      >
        <div
            v-for="x in 32"
            :key="`cell-${x}-${z}`"
            @click="grid.has(`${x-1},${z-1}`) ? emit('select-chunk', x-1, z-1) : null"
            class="w-3 h-3 sm:w-4 sm:h-4 text-[0px]"
            :class="grid.has(`${x-1},${z-1}`) ? 'bg-purple-500/60 hover:bg-purple-400 cursor-pointer' : 'bg-white/5'"
            :title="`Chunk [${x-1}, ${z-1}]`"
        ></div>
      </div>
    </div>
    <p class="text-xs text-white/40 mt-2">{{ t('region.selectChunk') }}</p>
  </div>
</template>
