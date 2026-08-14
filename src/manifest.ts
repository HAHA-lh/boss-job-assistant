import { defineManifest } from "@crxjs/vite-plugin";

export default defineManifest({
  manifest_version: 3,
  name: "求职匹配助手",
  short_name: "岗位助手",
  version: "0.1.5",
  description: "在本地解析简历、匹配当前可见岗位并生成可核验的招呼语草稿。",
  minimum_chrome_version: "114",
  permissions: [
    "sidePanel",
    "storage",
    "alarms",
    "notifications",
    "activeTab",
    "scripting",
    "clipboardWrite"
  ],
  optional_host_permissions: ["https://www.zhipin.com/*"],
  background: {
    service_worker: "src/background.ts",
    type: "module"
  },
  action: {
    default_title: "打开求职匹配助手"
  },
  side_panel: {
    default_path: "sidepanel.html"
  }
});
