const { getDefaultConfig } = require("expo/metro-config");
const { withNativeWind } = require("nativewind/metro");
const path = require("path");

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, "../..");

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, "node_modules"),
  path.resolve(workspaceRoot, "node_modules"),
];

// The hoisted pnpm layout (node-linker=hoisted) lets transitive deps such as
// use-sync-external-store (pulled by jotai / react-query) nest their own react copy,
// so Metro would bundle two React instances and every hook call hits a null dispatcher.
// Force the whole react family to resolve to a single copy.
const reactRoot = path.dirname(require.resolve("react/package.json", { paths: [projectRoot] }));
const reactDomRoot = path.dirname(
  require.resolve("react-dom/package.json", { paths: [projectRoot] }),
);
const forcedRoots = { react: reactRoot, "react-dom": reactDomRoot };

// @tanstack/react-query (and query-core) ship BOTH a top-level
// "react-native": "src/index.ts" field AND an "exports" map (build/modern/*) that
// has no react-native condition. With Metro package-exports enabled (Expo SDK 54
// default) different import sites can resolve the same package through two entry
// points, instantiating its React-context module twice — so QueryClientProvider
// populates one context object while useQuery reads the other, throwing
// "No QueryClient set". Pin each package to one concrete file so the context
// module is evaluated exactly once.
// Resolve via package.json (the build path isn't in the "exports" map, so Node's
// require.resolve can't target it directly) and join the compiled modern entry.
const pkgEntry = (pkg) =>
  path.join(
    path.dirname(require.resolve(pkg + "/package.json", { paths: [projectRoot] })),
    "build/modern/index.js",
  );
const forcedFiles = {
  "@tanstack/react-query": pkgEntry("@tanstack/react-query"),
  "@tanstack/query-core": pkgEntry("@tanstack/query-core"),
};

config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (forcedFiles[moduleName]) {
    return { type: "sourceFile", filePath: forcedFiles[moduleName] };
  }
  for (const name of Object.keys(forcedRoots)) {
    if (moduleName === name || moduleName.startsWith(name + "/")) {
      return context.resolveRequest(
        context,
        forcedRoots[name] + moduleName.slice(name.length),
        platform,
      );
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: "./src/global.css" });
