import { type RouteConfig, index, route } from "@react-router/dev/routes";

export default [
  index("routes/home.tsx"),
  route("webhooks", "routes/webhooks.tsx"),
  route("metrics", "routes/metrics.tsx"),
] satisfies RouteConfig;
