// winston logger, local file logging, both console and file    log level: all
// log file name + date + time(hour): restaurant-api-<logLevel>.log
const winston = require("winston");
const path = require("path");
const fs = require("fs");

const { format } = require("winston");

const logDir = path.join(__dirname, "logs");
const logLevel = process.env.LOG_LEVEL || "info";
const logFileName = new Date().toISOString().split("T")[0];

if (!fs.existsSync(logDir)) {
  fs.mkdirSync(logDir);
}

const logger = winston.createLogger({
  level: logLevel,
  format: format.combine(format.timestamp(), format.json()),
  transports: [
    new winston.transports.Console(),
    new winston.transports.File({
      filename: path.join(logDir, logFileName),
      level: logLevel,
      format: format.combine(format.timestamp(), format.json()),
    }),
  ],
});

module.exports = logger;
