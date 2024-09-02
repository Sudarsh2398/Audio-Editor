const path = require("path");

module.exports = function override(config) {
  config.resolve.fallback = {
    ...config.resolve.fallback,
    os: require.resolve("os-browserify/browser"),
    assert: require.resolve("assert/")
  };
  return config;
};