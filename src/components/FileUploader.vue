<script setup lang="ts">
import { ref } from 'vue';
import { useI18n } from '../locales';

const emit = defineEmits(['file-loaded']);
const { t } = useI18n();

const fileInput = ref<HTMLInputElement | null>(null);

const handleDrop = (e: DragEvent) => {
  e.preventDefault();
  const file = e.dataTransfer?.files[0];
  if (file) emit('file-loaded', file);
};

const handleSelect = (e: Event) => {
  const input = e.target as HTMLInputElement;
  if (input.files?.[0]) emit('file-loaded', input.files[0]);
};

const triggerSelect = () => {
  fileInput.value?.click();
};
</script>

<template>
  <div
      class="flex flex-col items-center justify-center p-12 border-2 border-dashed border-white/20 rounded-xl hover:bg-white/5 hover:border-purple-500/50 transition-all cursor-pointer"
      @dragover.prevent
      @drop="handleDrop"
      @click="triggerSelect"
  >
    <i class="fas fa-cube text-6xl text-white/20 mb-4"></i>
    <p class="text-xl font-medium text-white/80">{{ t('dragDrop') }}</p>
    <p class="text-sm text-white/40 mt-2">{{ t('orSelect') }}</p>

    <input
        ref="fileInput"
        type="file"
        class="hidden"
        @change="handleSelect"
    />
  </div>
</template>
