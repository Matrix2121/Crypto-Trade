const { createProxyMiddleware } = require("http-proxy-middleware");

module.exports = function setupProxy(app) {
  app.use(
    ["/api", "/ws"],
    createProxyMiddleware({
      target: "http://localhost:8080",
      changeOrigin: true,
      ws: true,
    })
  );
};
