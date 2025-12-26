import { reactive, computed } from 'vue';

const messages = {
    en: {
        title: "Amethyst NBT Editor",
        dragDrop: "Drag & Drop NBT/Region files here",
        orSelect: "or click to select",
        processing: "Processing...",
        error: "Error",
        download: "Download",
        save: "Save",
        root: "Root",
        search: "Search tags...",
        types: {
            1: "Byte",
            2: "Short",
            3: "Int",
            4: "Long",
            5: "Float",
            6: "Double",
            7: "Byte Array",
            8: "String",
            9: "List",
            10: "Compound",
            11: "Int Array",
            12: "Long Array"
        },
        actions: {
            add: "Add Tag",
            delete: "Delete",
            edit: "Edit",
            expand: "Expand All",
            collapse: "Collapse All"
        },
        region: {
            chunkCount: "Chunks Found",
            selectChunk: "Select a chunk to edit"
        }
    },
    zh: {
        title: "Amethyst NBT 编辑器",
        dragDrop: "拖入 NBT 或 Region 文件",
        orSelect: "或点击选择",
        processing: "处理中...",
        error: "错误",
        download: "下载文件",
        save: "保存",
        root: "根节点",
        search: "搜索标签...",
        types: {
            1: "字节 (Byte)",
            2: "短整型 (Short)",
            3: "整型 (Int)",
            4: "长整型 (Long)",
            5: "浮点型 (Float)",
            6: "双精度 (Double)",
            7: "字节数组 (Byte Array)",
            8: "字符串 (String)",
            9: "列表 (List)",
            10: "复合标签 (Compound)",
            11: "整型数组 (Int Array)",
            12: "长整型数组 (Long Array)"
        },
        actions: {
            add: "添加标签",
            delete: "删除",
            edit: "编辑",
            expand: "展开所有",
            collapse: "折叠所有"
        },
        region: {
            chunkCount: "个区块",
            selectChunk: "点击区块进行编辑"
        }
    }
};

const state = reactive({
    locale: 'zh' as keyof typeof messages
});

export const useI18n = () => {
    const t = (path: string): string => {
        const keys = path.split('.');
        let current: any = messages[state.locale];
        for (const key of keys) {
            if (current[key] === undefined) return path;
            current = current[key];
        }
        return current;
    };

    const setLocale = (lang: 'en' | 'zh') => {
        state.locale = lang;
    };

    return { t, setLocale, locale: computed(() => state.locale) };
};
