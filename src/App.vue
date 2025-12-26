<script setup lang="ts">
import { ref, shallowRef } from 'vue';
import { TagIO, TagCompound, RegionReader } from './amethyst';
import { downloadBlob } from './utils/downloader';
import { useI18n } from './locales';

import FileUploader from './components/FileUploader.vue';
import NbtNode from './components/NbtNode.vue';
import ChunkGrid from './components/ChunkGrid.vue';

const { t, setLocale, locale } = useI18n();

// Application State
const currentFile = ref<File | null>(null);
const isLoading = ref(false);
const errorMsg = ref<string | null>(null);

// NBT Data State
const rootTag = shallowRef<TagCompound | null>(null);

// MCA Data State
const isRegion = ref(false);
const regionReader = shallowRef<RegionReader | null>(null);
const presentChunks = ref<{ x: number, z: number }[]>([]);
const currentChunkCoord = ref<{ x: number, z: number } | null>(null);

// --- File Handling ---

async function onFileLoaded(file: File) {
  resetState();
  currentFile.value = file;
  isLoading.value = true;

  try {
    const buffer = await file.arrayBuffer();

    if (file.name.endsWith('.mca') || file.name.endsWith('.mcr')) {
      // Handle Region File
      isRegion.value = true;
      const reader = new RegionReader(buffer);
      regionReader.value = reader;
      presentChunks.value = reader.getPresentChunks();
    } else {
      // Handle Standard NBT
      isRegion.value = false;
      // TagIO.readAsync handles Gzip/Zlib detection
      const tag = await TagIO.readAsync(buffer);
      rootTag.value = tag;
    }
  } catch (e) {
    console.error(e);
    errorMsg.value = `Failed to parse file: ${e}`;
  } finally {
    isLoading.value = false;
  }
}

function resetState() {
  currentFile.value = null;
  rootTag.value = null;
  regionReader.value = null;
  presentChunks.value = [];
  currentChunkCoord.value = null;
  errorMsg.value = null;
  isRegion.value = false;
}

/**
 * Removes the current file and returns to the upload screen.
 */
function removeFile() {
  if (confirm("Are you sure you want to close this file? Unsaved changes will be lost.")) {
    resetState();
  }
}

// --- Chunk Handling ---

async function loadChunk(x: number, z: number) {
  if (!regionReader.value) return;
  isLoading.value = true;
  try {
    const chunk = await regionReader.value.readChunk(x, z);
    if (chunk) {
      rootTag.value = chunk;
      currentChunkCoord.value = { x, z };
    } else {
      errorMsg.value = `Chunk [${x},${z}] is corrupt or empty.`;
    }
  } catch (e) {
    errorMsg.value = String(e);
  } finally {
    isLoading.value = false;
  }
}

/**
 * Closes the currently open chunk editor and returns to the grid view.
 */
function closeChunk() {
  rootTag.value = null;
  currentChunkCoord.value = null;
}

// --- Saving ---

async function handleSave() {
  if (!rootTag.value) return;
  isLoading.value = true;

  try {
    if (isRegion.value && regionReader.value && currentChunkCoord.value) {
      // === Region File Saving Strategy ===
      // 1. Update the chunk inside the RegionReader's buffer
      await regionReader.value.writeChunk(
          currentChunkCoord.value.x,
          currentChunkCoord.value.z,
          rootTag.value
      );

      // 2. Download the ENTIRE region file
      const fullData = regionReader.value.getData();
      const filename = currentFile.value ? currentFile.value.name : "region.mca";
      downloadBlob(fullData, filename);

    } else {
      // === Standard NBT Saving ===
      // Compress if original was compressed? 
      // For simplicity in this web editor, we often save uncompressed or standard GZip.
      // Let's assume level.dat needs GZip.
      let data = TagIO.write(rootTag.value);

      // If it's a level.dat, we usually want to GZip it. 
      // TagIO.write returns uncompressed bytes.
      // For generic NBT usage, downloading raw is safer unless we add a "Compress" toggle.
      // However, most games expect level.dat to be GZipped.
      if (currentFile.value?.name === 'level.dat') {
        // Import compress dynamically or use from amethyst/compression if exported
        const { compress } = await import('./amethyst/compression');
        data = await compress(data, 'gzip');
      }

      downloadBlob(data, currentFile.value?.name || "data.nbt");
    }
  } catch (e) {
    alert("Save failed: " + e);
    console.error(e);
  } finally {
    isLoading.value = false;
  }
}

// --- Search Filter Logic (Simplistic) ---
const searchQuery = ref("");
</script>

<template>
  <div class="min-h-screen flex flex-col p-4 sm:p-8">

    <!-- Navbar -->
    <nav class="flex justify-between items-center mb-8 acrylic-panel p-4 rounded-xl">
      <div class="flex items-center gap-3">
        <div class="w-8 h-8 bg-purple-600 rounded flex items-center justify-center shadow-lg shadow-purple-500/30">
          <i class="fas fa-cubes text-white"></i>
        </div>
        <h1 class="text-xl font-bold tracking-tight text-white hidden sm:block">{{ t('title') }}</h1>
      </div>

      <div class="flex gap-4 items-center">
        <!-- Close File Button -->
        <button
            v-if="currentFile"
            @click="removeFile"
            class="px-3 py-1.5 text-sm bg-red-500/20 text-red-200 border border-red-500/30 rounded hover:bg-red-500/30 transition flex items-center gap-2"
            title="Close current file"
        >
          <i class="fas fa-times"></i>
          <span class="hidden sm:inline">Close File</span>
        </button>

        <button
            @click="setLocale(locale === 'en' ? 'zh' : 'en')"
            class="px-3 py-1 text-sm bg-white/10 rounded hover:bg-white/20 transition"
        >
          {{ locale === 'en' ? '中文' : 'English' }}
        </button>
      </div>
    </nav>

    <!-- Main Content Area -->
    <main class="flex-1 flex flex-col items-center justify-center w-full max-w-6xl mx-auto relative">

      <!-- Loading Spinner -->
      <div v-if="isLoading" class="absolute z-50 bg-black/50 inset-0 flex flex-col items-center justify-center rounded-xl backdrop-blur-sm">
        <i class="fas fa-circle-notch fa-spin text-4xl text-purple-400 mb-4"></i>
        <p class="text-white font-medium">{{ t('processing') }}</p>
      </div>

      <!-- Error Message -->
      <div v-if="errorMsg" class="w-full bg-red-500/20 border border-red-500/50 p-4 rounded-xl mb-6 text-center">
        <p class="text-red-200 font-bold">{{ t('error') }}</p>
        <p class="text-sm">{{ errorMsg }}</p>
        <button @click="resetState" class="mt-2 text-sm underline">Reset</button>
      </div>

      <!-- State 1: No File Loaded -->
      <div v-if="!currentFile && !isLoading" class="w-full max-w-2xl acrylic-panel p-8 rounded-2xl">
        <FileUploader @file-loaded="onFileLoaded" />
      </div>

      <!-- State 2: Region File View (Select Chunk) -->
      <div v-else-if="isRegion && !rootTag && !isLoading" class="w-full acrylic-panel p-6 rounded-2xl flex flex-col gap-4">
        <div class="flex justify-between items-center border-b border-white/10 pb-4">
          <div class="flex items-center gap-2">
            <i class="fas fa-map text-purple-400"></i>
            <span class="font-mono">{{ currentFile?.name }}</span>
          </div>
          <!-- Note: The main close button in nav handles file closing -->
        </div>

        <ChunkGrid :chunks="presentChunks" @select-chunk="loadChunk" />
      </div>

      <!-- State 3: Editor View (NBT Tree) -->
      <div v-else-if="rootTag && !isLoading" class="w-full acrylic-panel rounded-2xl flex flex-col h-[80vh]">

        <!-- Editor Header -->
        <div class="p-4 border-b border-white/10 flex items-center justify-between bg-black/20 rounded-t-2xl">
          <div class="flex items-center gap-3">
            <!-- Back Button: Only visible if editing a chunk in a region -->
            <button
                v-if="isRegion"
                @click="closeChunk"
                class="w-8 h-8 rounded-full bg-white/5 hover:bg-white/10 flex items-center justify-center transition"
                title="Back to Chunk Grid"
            >
              <i class="fas fa-arrow-left"></i>
            </button>

            <div class="flex flex-col">
               <span class="font-bold text-lg flex items-center gap-2">
                 <i :class="isRegion ? 'fas fa-puzzle-piece text-green-400' : 'fas fa-file-code text-blue-400'"></i>
                 {{ isRegion && currentChunkCoord ? `Chunk [${currentChunkCoord.x}, ${currentChunkCoord.z}]` : (rootTag.name || t('root')) }}
               </span>
              <span class="text-xs text-gray-400 font-mono" v-if="currentFile">{{ currentFile?.name }}</span>
            </div>
          </div>

          <div class="flex gap-2">
            <!-- Search Input -->
            <div class="relative hidden sm:block">
              <i class="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-gray-400 text-xs"></i>
              <input
                  v-model="searchQuery"
                  type="text"
                  :placeholder="t('search')"
                  class="acrylic-input pl-8 pr-3 py-1.5 rounded-lg text-sm w-48"
              >
            </div>

            <button
                @click="handleSave"
                class="flex items-center gap-2 px-4 py-1.5 bg-purple-600 hover:bg-purple-500 text-white rounded-lg shadow-lg shadow-purple-500/20 transition-all font-medium text-sm"
            >
              <i class="fas fa-save"></i>
              {{ t('save') }}
            </button>
          </div>
        </div>

        <!-- Tree Content -->
        <div class="flex-1 overflow-auto p-4 custom-scrollbar">
          <NbtNode
              :tag="rootTag"
              :name="rootTag.name || ''"
              :depth="0"
          />
        </div>
      </div>

    </main>

    <!-- Credits Footer -->
    <div class="credit-overlay">
      Photo by <a href="https://unsplash.com/@marcozzolo90?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank">Marco Grosso</a> on <a href="https://unsplash.com/photos/rocky-formation-under-a-starry-night-sky-zj_WL_5KUMY?utm_source=unsplash&utm_medium=referral&utm_content=creditCopyText" target="_blank">Unsplash</a>
    </div>

  </div>
</template>

<style>
/* Custom grid specific for Chunk map */
.grid-cols-32 {
  grid-template-columns: repeat(32, minmax(0, 1fr));
}
</style>
