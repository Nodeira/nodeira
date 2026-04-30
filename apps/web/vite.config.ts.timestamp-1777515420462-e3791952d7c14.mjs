// vite.config.ts
import { defineConfig } from "file:///home/deran/code/nodeira/node_modules/.pnpm/vite@6.4.2_@types+node@22.19.17_jiti@2.6.1_sugarss@5.0.1_postcss@8.5.12__terser@5.46.2_tsx@4.21.0/node_modules/vite/dist/node/index.js";
import react from "file:///home/deran/code/nodeira/node_modules/.pnpm/@vitejs+plugin-react@4.7.0_vite@6.4.2_@types+node@22.19.17_jiti@2.6.1_sugarss@5.0.1_pos_30d1029d6b008eb7b7bed62aee2c4e78/node_modules/@vitejs/plugin-react/dist/index.js";
import { TanStackRouterVite } from "file:///home/deran/code/nodeira/node_modules/.pnpm/@tanstack+router-plugin@1.167.29_@tanstack+react-router@1.168.26_react-dom@19.2.5_react_6626706c269f69e68053bef497183dff/node_modules/@tanstack/router-plugin/dist/esm/vite.js";
var vite_config_default = defineConfig({
  plugins: [
    // TanStackRouterVite MUST come before react() — it generates routeTree.gen.ts
    TanStackRouterVite({
      routesDirectory: "./src/routes",
      generatedRouteTree: "./src/routeTree.gen.ts"
    }),
    react()
  ],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:3001",
        changeOrigin: true,
        rewrite: (path) => path.replace(/^\/api/, "")
      },
      "/uploads": {
        target: "http://localhost:3001",
        changeOrigin: true
      },
      "/sync": {
        target: "ws://localhost:3001",
        ws: true
      }
    }
  }
});
export {
  vite_config_default as default
};
//# sourceMappingURL=data:application/json;base64,ewogICJ2ZXJzaW9uIjogMywKICAic291cmNlcyI6IFsidml0ZS5jb25maWcudHMiXSwKICAic291cmNlc0NvbnRlbnQiOiBbImNvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9kaXJuYW1lID0gXCIvaG9tZS9kZXJhbi9jb2RlL25vZGVpcmEvYXBwcy93ZWJcIjtjb25zdCBfX3ZpdGVfaW5qZWN0ZWRfb3JpZ2luYWxfZmlsZW5hbWUgPSBcIi9ob21lL2RlcmFuL2NvZGUvbm9kZWlyYS9hcHBzL3dlYi92aXRlLmNvbmZpZy50c1wiO2NvbnN0IF9fdml0ZV9pbmplY3RlZF9vcmlnaW5hbF9pbXBvcnRfbWV0YV91cmwgPSBcImZpbGU6Ly8vaG9tZS9kZXJhbi9jb2RlL25vZGVpcmEvYXBwcy93ZWIvdml0ZS5jb25maWcudHNcIjtpbXBvcnQgeyBkZWZpbmVDb25maWcgfSBmcm9tIFwidml0ZVwiO1xuaW1wb3J0IHJlYWN0IGZyb20gXCJAdml0ZWpzL3BsdWdpbi1yZWFjdFwiO1xuaW1wb3J0IHsgVGFuU3RhY2tSb3V0ZXJWaXRlIH0gZnJvbSBcIkB0YW5zdGFjay9yb3V0ZXItcGx1Z2luL3ZpdGVcIjtcblxuZXhwb3J0IGRlZmF1bHQgZGVmaW5lQ29uZmlnKHtcbiAgcGx1Z2luczogW1xuICAgIC8vIFRhblN0YWNrUm91dGVyVml0ZSBNVVNUIGNvbWUgYmVmb3JlIHJlYWN0KCkgXHUyMDE0IGl0IGdlbmVyYXRlcyByb3V0ZVRyZWUuZ2VuLnRzXG4gICAgVGFuU3RhY2tSb3V0ZXJWaXRlKHtcbiAgICAgIHJvdXRlc0RpcmVjdG9yeTogXCIuL3NyYy9yb3V0ZXNcIixcbiAgICAgIGdlbmVyYXRlZFJvdXRlVHJlZTogXCIuL3NyYy9yb3V0ZVRyZWUuZ2VuLnRzXCIsXG4gICAgfSksXG4gICAgcmVhY3QoKSxcbiAgXSxcbiAgc2VydmVyOiB7XG4gICAgcG9ydDogNTE3MyxcbiAgICBwcm94eToge1xuICAgICAgXCIvYXBpXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMVwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICAgIHJld3JpdGU6IChwYXRoKSA9PiBwYXRoLnJlcGxhY2UoL15cXC9hcGkvLCBcIlwiKSxcbiAgICAgIH0sXG4gICAgICBcIi91cGxvYWRzXCI6IHtcbiAgICAgICAgdGFyZ2V0OiBcImh0dHA6Ly9sb2NhbGhvc3Q6MzAwMVwiLFxuICAgICAgICBjaGFuZ2VPcmlnaW46IHRydWUsXG4gICAgICB9LFxuICAgICAgXCIvc3luY1wiOiB7XG4gICAgICAgIHRhcmdldDogXCJ3czovL2xvY2FsaG9zdDozMDAxXCIsXG4gICAgICAgIHdzOiB0cnVlLFxuICAgICAgfSxcbiAgICB9LFxuICB9LFxufSk7XG4iXSwKICAibWFwcGluZ3MiOiAiO0FBQXFSLFNBQVMsb0JBQW9CO0FBQ2xULE9BQU8sV0FBVztBQUNsQixTQUFTLDBCQUEwQjtBQUVuQyxJQUFPLHNCQUFRLGFBQWE7QUFBQSxFQUMxQixTQUFTO0FBQUE7QUFBQSxJQUVQLG1CQUFtQjtBQUFBLE1BQ2pCLGlCQUFpQjtBQUFBLE1BQ2pCLG9CQUFvQjtBQUFBLElBQ3RCLENBQUM7QUFBQSxJQUNELE1BQU07QUFBQSxFQUNSO0FBQUEsRUFDQSxRQUFRO0FBQUEsSUFDTixNQUFNO0FBQUEsSUFDTixPQUFPO0FBQUEsTUFDTCxRQUFRO0FBQUEsUUFDTixRQUFRO0FBQUEsUUFDUixjQUFjO0FBQUEsUUFDZCxTQUFTLENBQUMsU0FBUyxLQUFLLFFBQVEsVUFBVSxFQUFFO0FBQUEsTUFDOUM7QUFBQSxNQUNBLFlBQVk7QUFBQSxRQUNWLFFBQVE7QUFBQSxRQUNSLGNBQWM7QUFBQSxNQUNoQjtBQUFBLE1BQ0EsU0FBUztBQUFBLFFBQ1AsUUFBUTtBQUFBLFFBQ1IsSUFBSTtBQUFBLE1BQ047QUFBQSxJQUNGO0FBQUEsRUFDRjtBQUNGLENBQUM7IiwKICAibmFtZXMiOiBbXQp9Cg==
