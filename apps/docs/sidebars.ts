import type { SidebarsConfig } from "@docusaurus/plugin-content-docs";

const sidebars: SidebarsConfig = {
  userSidebar: [
    "intro",
    "downloads",
    "getting-started",
    {
      type: "category",
      label: "Features",
      items: [
        "features/vaults",
        "features/folders",
        "features/notes",
        "features/image-upload",
        "features/canvas",
      ],
    },
  ],
  devSidebar: [
    "development/contributing",
    "development/deployment",
    {
      type: "category",
      label: "Architecture",
      items: ["architecture/overview", "architecture/sync"],
    },
    {
      type: "category",
      label: "API Reference",
      items: ["api/rest"],
    },
  ],
};

export default sidebars;
