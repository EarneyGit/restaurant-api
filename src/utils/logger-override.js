// logger-override.js
const logger = require("./logger");

// Prevent infinite loops by storing original console methods
const originalConsole = {
  log: console.log,
  info: console.info,
  warn: console.warn,
  error: console.error,
};

console.log = (...args) => {
  logger.info(args.map(String).join(" "));
};

console.info = (...args) => {
  logger.info(args.map(String).join(" "));
};

console.warn = (...args) => {
  logger.warn(args.map(String).join(" "));
};

console.error = (...args) => {
  logger.error(args.map(String).join(" "));
};

// Optional: export if you want to require this in main entry
module.exports = logger;
