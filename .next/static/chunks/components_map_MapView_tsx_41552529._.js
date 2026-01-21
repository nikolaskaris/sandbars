(globalThis.TURBOPACK || (globalThis.TURBOPACK = [])).push([typeof document === "object" ? document.currentScript : undefined,
"[project]/components/map/MapView.tsx [app-client] (ecmascript, next/dynamic entry, async loader)", ((__turbopack_context__) => {

__turbopack_context__.v((parentImport) => {
    return Promise.all([
  "static/chunks/node_modules_mapbox-gl_dist_mapbox-gl_fe1438d5.js",
  "static/chunks/_75b51e5b._.js",
  {
    "path": "static/chunks/node_modules_mapbox-gl_dist_mapbox-gl_9438b0bd.css",
    "included": [
      "[project]/node_modules/mapbox-gl/dist/mapbox-gl.css [app-client] (css)"
    ]
  },
  "static/chunks/components_map_MapView_tsx_3ef8c88c._.js"
].map((chunk) => __turbopack_context__.l(chunk))).then(() => {
        return parentImport("[project]/components/map/MapView.tsx [app-client] (ecmascript, next/dynamic entry)");
    });
});
}),
]);