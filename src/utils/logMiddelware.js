const logger = require("./logger");

/**
 * Interceptor function used to monkey patch the res.send until it is invoked
 * at which point it intercepts the invokation, executes is logic such as res.contentBody = content
 * then restores the original send function and invokes that to finalize the req/res chain.
 *
 * @param res Original Response Object
 * @param send Original UNMODIFIED res.send function
 * @return A patched res.send which takes the send content, binds it to contentBody on
 * the res and then calls the original res.send after restoring it
 */
const resDotSendInterceptor = (res, send) => (content) => {
    res.contentBody = content;
    res.send = send;
    res.send(content);
};

/**
 * Middleware which takes an initial configuration and returns a middleware which will call the
 * given logger with the request and response content.
 *
 * @return Middleware to perform the logging
 */
const requestLoggerMiddleware = () => ( async(req, res, next) => {
    logger.info(`Request <<< : ${req.method} ${req.url} : ${req.hostname}`);
    res.send = resDotSendInterceptor(res, res.send);
    res.on("finish", () => {
        logger.info(`Response >>> : ${res.contentBody}\n`);
    });
    next();
});

module.exports = { requestLoggerMiddleware };