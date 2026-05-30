const { getDefaultConfig } = require('expo/metro-config');
const { withNativeWind } = require('nativewind/metro');
const path = require('path');

const projectRoot = __dirname;
const workspaceRoot = path.resolve(projectRoot, '../..');

const config = getDefaultConfig(projectRoot);

config.watchFolders = [...(config.watchFolders || []), workspaceRoot];

config.resolver.nodeModulesPaths = [
  path.resolve(projectRoot, 'node_modules'),
  path.resolve(workspaceRoot, 'node_modules'),
];

// The hoisted pnpm layout (node-linker=hoisted) lets transitive deps such as
// use-sync-external-store (pulled by jotai / react-query) nest their own react copy,
// so Metro would bundle two React instances and every hook call hits a null dispatcher.
// Force the whole react family to resolve to a single copy.
const reactRoot = path.dirname(require.resolve('react/package.json', { paths: [projectRoot] }));
const reactDomRoot = path.dirname(require.resolve('react-dom/package.json', { paths: [projectRoot] }));
const forcedRoots = { react: reactRoot, 'react-dom': reactDomRoot };

config.resolver.resolveRequest = (context, moduleName, platform) => {
  for (const name of Object.keys(forcedRoots)) {
    if (moduleName === name || moduleName.startsWith(name + '/')) {
      return context.resolveRequest(context, forcedRoots[name] + moduleName.slice(name.length), platform);
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = withNativeWind(config, { input: './src/global.css' });
