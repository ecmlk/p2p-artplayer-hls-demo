var __defProp = Object.defineProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
class RequestError extends Error {
  /**
   * Constructs a new RequestError.
   * @param type - The specific error type.
   * @param message - Optional message describing the error.
   */
  constructor(type, message) {
    super(message);
    /** Error timestamp. */
    __publicField(this, "timestamp");
    this.type = type;
    this.timestamp = performance.now();
  }
}
class CoreRequestError extends Error {
  /**
   * Constructs a new CoreRequestError.
   * @param type - The type of the error, either 'failed' or 'aborted'.
   */
  constructor(type) {
    super();
    this.type = type;
  }
}
class HttpRequestExecutor {
  constructor(request, httpConfig, eventTarget) {
    __publicField(this, "requestControls");
    __publicField(this, "abortController", new AbortController());
    __publicField(this, "expectedBytesLength");
    __publicField(this, "requestByteRange");
    __publicField(this, "onChunkDownloaded");
    this.request = request;
    this.httpConfig = httpConfig;
    this.onChunkDownloaded = eventTarget.getEventDispatcher("onChunkDownloaded");
    const { byteRange } = this.request.segment;
    if (byteRange) this.requestByteRange = { ...byteRange };
    if (request.loadedBytes !== 0) {
      this.requestByteRange = this.requestByteRange ?? { start: 0 };
      this.requestByteRange.start = this.requestByteRange.start + request.loadedBytes;
    }
    if (this.request.totalBytes) {
      this.expectedBytesLength = this.request.totalBytes - this.request.loadedBytes;
    }
    this.requestControls = this.request.start(
      { downloadSource: "http" },
      {
        abort: () => this.abortController.abort("abort"),
        notReceivingBytesTimeoutMs: this.httpConfig.httpNotReceivingBytesTimeoutMs
      }
    );
    void this.fetch();
  }
  async fetch() {
    var _a, _b;
    const { segment } = this.request;
    try {
      let request = await ((_b = (_a = this.httpConfig).httpRequestSetup) == null ? void 0 : _b.call(
        _a,
        segment.url,
        segment.byteRange,
        this.abortController.signal,
        this.requestByteRange
      ));
      if (!request) {
        const headers = new Headers(
          this.requestByteRange ? {
            Range: `bytes=${this.requestByteRange.start}-${this.requestByteRange.end ?? ""}`
          } : void 0
        );
        request = new Request(segment.url, {
          headers,
          signal: this.abortController.signal
        });
      }
      if (this.abortController.signal.aborted) {
        throw new DOMException(
          "Request aborted before request fetch",
          "AbortError"
        );
      }
      const response = await window.fetch(request);
      this.handleResponseHeaders(response);
      if (!response.body) return;
      const { requestControls } = this;
      requestControls.firstBytesReceived();
      const reader = response.body.getReader();
      for await (const chunk of readStream(reader)) {
        this.requestControls.addLoadedChunk(chunk);
        this.onChunkDownloaded(chunk.byteLength, "http");
      }
      requestControls.completeOnSuccess();
    } catch (error) {
      this.handleError(error);
    }
  }
  handleResponseHeaders(response) {
    if (!response.ok) {
      if (response.status === 406) {
        this.request.clearLoadedBytes();
        throw new RequestError(
          "http-bytes-mismatch",
          response.statusText
        );
      } else {
        throw new RequestError("http-error", response.statusText);
      }
    }
    const { requestByteRange } = this;
    if (requestByteRange) {
      if (response.status === 200) {
        if (this.request.segment.byteRange) {
          throw new RequestError("http-unexpected-status-code");
        } else {
          this.request.clearLoadedBytes();
        }
      } else {
        if (response.status !== 206) {
          throw new RequestError(
            "http-unexpected-status-code",
            response.statusText
          );
        }
        const contentLengthHeader = response.headers.get("Content-Length");
        if (contentLengthHeader && this.expectedBytesLength !== void 0 && this.expectedBytesLength !== +contentLengthHeader) {
          this.request.clearLoadedBytes();
          throw new RequestError("http-bytes-mismatch", response.statusText);
        }
        const contentRangeHeader = response.headers.get("Content-Range");
        const contentRange = contentRangeHeader ? parseContentRangeHeader(contentRangeHeader) : void 0;
        if (contentRange) {
          const { from, to, total } = contentRange;
          if (total !== void 0 && this.request.totalBytes !== total || from !== void 0 && requestByteRange.start !== from || to !== void 0 && requestByteRange.end !== void 0 && requestByteRange.end !== to) {
            this.request.clearLoadedBytes();
            throw new RequestError("http-bytes-mismatch", response.statusText);
          }
        }
      }
    }
    if (response.status === 200 && this.request.totalBytes === void 0) {
      const contentLengthHeader = response.headers.get("Content-Length");
      if (contentLengthHeader) this.request.setTotalBytes(+contentLengthHeader);
    }
  }
  handleError(error) {
    if (error instanceof Error) {
      if (error.name !== "abort") return;
      const httpLoaderError = error instanceof RequestError ? error : new RequestError("http-error", error.message);
      this.requestControls.abortOnError(httpLoaderError);
    }
  }
}
async function* readStream(reader) {
  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    yield value;
  }
}
function parseContentRangeHeader(headerValue) {
  const match = headerValue.trim().match(/^bytes (?:(?:(\d+)|)-(?:(\d+)|)|\*)\/(?:(\d+)|\*)$/);
  if (!match) return;
  const [, from, to, total] = match;
  return {
    from: from ? parseInt(from) : void 0,
    to: to ? parseInt(to) : void 0,
    total: total ? parseInt(total) : void 0
  };
}
function getDefaultExportFromCjs$1(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var browser$2 = { exports: {} };
var process = browser$2.exports = {};
var cachedSetTimeout;
var cachedClearTimeout;
function defaultSetTimout() {
  throw new Error("setTimeout has not been defined");
}
function defaultClearTimeout() {
  throw new Error("clearTimeout has not been defined");
}
(function() {
  try {
    if (typeof setTimeout === "function") {
      cachedSetTimeout = setTimeout;
    } else {
      cachedSetTimeout = defaultSetTimout;
    }
  } catch (e) {
    cachedSetTimeout = defaultSetTimout;
  }
  try {
    if (typeof clearTimeout === "function") {
      cachedClearTimeout = clearTimeout;
    } else {
      cachedClearTimeout = defaultClearTimeout;
    }
  } catch (e) {
    cachedClearTimeout = defaultClearTimeout;
  }
})();
function runTimeout(fun) {
  if (cachedSetTimeout === setTimeout) {
    return setTimeout(fun, 0);
  }
  if ((cachedSetTimeout === defaultSetTimout || !cachedSetTimeout) && setTimeout) {
    cachedSetTimeout = setTimeout;
    return setTimeout(fun, 0);
  }
  try {
    return cachedSetTimeout(fun, 0);
  } catch (e) {
    try {
      return cachedSetTimeout.call(null, fun, 0);
    } catch (e2) {
      return cachedSetTimeout.call(this, fun, 0);
    }
  }
}
function runClearTimeout(marker) {
  if (cachedClearTimeout === clearTimeout) {
    return clearTimeout(marker);
  }
  if ((cachedClearTimeout === defaultClearTimeout || !cachedClearTimeout) && clearTimeout) {
    cachedClearTimeout = clearTimeout;
    return clearTimeout(marker);
  }
  try {
    return cachedClearTimeout(marker);
  } catch (e) {
    try {
      return cachedClearTimeout.call(null, marker);
    } catch (e2) {
      return cachedClearTimeout.call(this, marker);
    }
  }
}
var queue = [];
var draining = false;
var currentQueue;
var queueIndex = -1;
function cleanUpNextTick() {
  if (!draining || !currentQueue) {
    return;
  }
  draining = false;
  if (currentQueue.length) {
    queue = currentQueue.concat(queue);
  } else {
    queueIndex = -1;
  }
  if (queue.length) {
    drainQueue();
  }
}
function drainQueue() {
  if (draining) {
    return;
  }
  var timeout = runTimeout(cleanUpNextTick);
  draining = true;
  var len = queue.length;
  while (len) {
    currentQueue = queue;
    queue = [];
    while (++queueIndex < len) {
      if (currentQueue) {
        currentQueue[queueIndex].run();
      }
    }
    queueIndex = -1;
    len = queue.length;
  }
  currentQueue = null;
  draining = false;
  runClearTimeout(timeout);
}
process.nextTick = function(fun) {
  var args = new Array(arguments.length - 1);
  if (arguments.length > 1) {
    for (var i = 1; i < arguments.length; i++) {
      args[i - 1] = arguments[i];
    }
  }
  queue.push(new Item(fun, args));
  if (queue.length === 1 && !draining) {
    runTimeout(drainQueue);
  }
};
function Item(fun, array) {
  this.fun = fun;
  this.array = array;
}
Item.prototype.run = function() {
  this.fun.apply(null, this.array);
};
process.title = "browser";
process.browser = true;
process.env = {};
process.argv = [];
process.version = "";
process.versions = {};
function noop$2() {
}
process.on = noop$2;
process.addListener = noop$2;
process.once = noop$2;
process.off = noop$2;
process.removeListener = noop$2;
process.removeAllListeners = noop$2;
process.emit = noop$2;
process.prependListener = noop$2;
process.prependOnceListener = noop$2;
process.listeners = function(name) {
  return [];
};
process.binding = function(name) {
  throw new Error("process.binding is not supported");
};
process.cwd = function() {
  return "/";
};
process.chdir = function(dir) {
  throw new Error("process.chdir is not supported");
};
process.umask = function() {
  return 0;
};
var browserExports$2 = browser$2.exports;
const process$1 = /* @__PURE__ */ getDefaultExportFromCjs$1(browserExports$2);
var commonjsGlobal = typeof globalThis !== "undefined" ? globalThis : typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : typeof self !== "undefined" ? self : {};
function getDefaultExportFromCjs(x) {
  return x && x.__esModule && Object.prototype.hasOwnProperty.call(x, "default") ? x["default"] : x;
}
var browser$1 = { exports: {} };
var ms;
var hasRequiredMs;
function requireMs() {
  if (hasRequiredMs) return ms;
  hasRequiredMs = 1;
  var s = 1e3;
  var m = s * 60;
  var h = m * 60;
  var d = h * 24;
  var w = d * 7;
  var y = d * 365.25;
  ms = function(val, options) {
    options = options || {};
    var type = typeof val;
    if (type === "string" && val.length > 0) {
      return parse(val);
    } else if (type === "number" && isFinite(val)) {
      return options.long ? fmtLong(val) : fmtShort(val);
    }
    throw new Error(
      "val is not a non-empty string or a valid number. val=" + JSON.stringify(val)
    );
  };
  function parse(str) {
    str = String(str);
    if (str.length > 100) {
      return;
    }
    var match = /^(-?(?:\d+)?\.?\d+) *(milliseconds?|msecs?|ms|seconds?|secs?|s|minutes?|mins?|m|hours?|hrs?|h|days?|d|weeks?|w|years?|yrs?|y)?$/i.exec(
      str
    );
    if (!match) {
      return;
    }
    var n = parseFloat(match[1]);
    var type = (match[2] || "ms").toLowerCase();
    switch (type) {
      case "years":
      case "year":
      case "yrs":
      case "yr":
      case "y":
        return n * y;
      case "weeks":
      case "week":
      case "w":
        return n * w;
      case "days":
      case "day":
      case "d":
        return n * d;
      case "hours":
      case "hour":
      case "hrs":
      case "hr":
      case "h":
        return n * h;
      case "minutes":
      case "minute":
      case "mins":
      case "min":
      case "m":
        return n * m;
      case "seconds":
      case "second":
      case "secs":
      case "sec":
      case "s":
        return n * s;
      case "milliseconds":
      case "millisecond":
      case "msecs":
      case "msec":
      case "ms":
        return n;
      default:
        return void 0;
    }
  }
  function fmtShort(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
      return Math.round(ms2 / d) + "d";
    }
    if (msAbs >= h) {
      return Math.round(ms2 / h) + "h";
    }
    if (msAbs >= m) {
      return Math.round(ms2 / m) + "m";
    }
    if (msAbs >= s) {
      return Math.round(ms2 / s) + "s";
    }
    return ms2 + "ms";
  }
  function fmtLong(ms2) {
    var msAbs = Math.abs(ms2);
    if (msAbs >= d) {
      return plural(ms2, msAbs, d, "day");
    }
    if (msAbs >= h) {
      return plural(ms2, msAbs, h, "hour");
    }
    if (msAbs >= m) {
      return plural(ms2, msAbs, m, "minute");
    }
    if (msAbs >= s) {
      return plural(ms2, msAbs, s, "second");
    }
    return ms2 + " ms";
  }
  function plural(ms2, msAbs, n, name) {
    var isPlural = msAbs >= n * 1.5;
    return Math.round(ms2 / n) + " " + name + (isPlural ? "s" : "");
  }
  return ms;
}
function setup(env) {
  createDebug.debug = createDebug;
  createDebug.default = createDebug;
  createDebug.coerce = coerce;
  createDebug.disable = disable;
  createDebug.enable = enable;
  createDebug.enabled = enabled;
  createDebug.humanize = requireMs();
  createDebug.destroy = destroy;
  Object.keys(env).forEach((key) => {
    createDebug[key] = env[key];
  });
  createDebug.names = [];
  createDebug.skips = [];
  createDebug.formatters = {};
  function selectColor(namespace) {
    let hash = 0;
    for (let i = 0; i < namespace.length; i++) {
      hash = (hash << 5) - hash + namespace.charCodeAt(i);
      hash |= 0;
    }
    return createDebug.colors[Math.abs(hash) % createDebug.colors.length];
  }
  createDebug.selectColor = selectColor;
  function createDebug(namespace) {
    let prevTime;
    let enableOverride = null;
    let namespacesCache;
    let enabledCache;
    function debug2(...args) {
      if (!debug2.enabled) {
        return;
      }
      const self2 = debug2;
      const curr = Number(/* @__PURE__ */ new Date());
      const ms2 = curr - (prevTime || curr);
      self2.diff = ms2;
      self2.prev = prevTime;
      self2.curr = curr;
      prevTime = curr;
      args[0] = createDebug.coerce(args[0]);
      if (typeof args[0] !== "string") {
        args.unshift("%O");
      }
      let index = 0;
      args[0] = args[0].replace(/%([a-zA-Z%])/g, (match, format) => {
        if (match === "%%") {
          return "%";
        }
        index++;
        const formatter = createDebug.formatters[format];
        if (typeof formatter === "function") {
          const val = args[index];
          match = formatter.call(self2, val);
          args.splice(index, 1);
          index--;
        }
        return match;
      });
      createDebug.formatArgs.call(self2, args);
      const logFn = self2.log || createDebug.log;
      logFn.apply(self2, args);
    }
    debug2.namespace = namespace;
    debug2.useColors = createDebug.useColors();
    debug2.color = createDebug.selectColor(namespace);
    debug2.extend = extend;
    debug2.destroy = createDebug.destroy;
    Object.defineProperty(debug2, "enabled", {
      enumerable: true,
      configurable: false,
      get: () => {
        if (enableOverride !== null) {
          return enableOverride;
        }
        if (namespacesCache !== createDebug.namespaces) {
          namespacesCache = createDebug.namespaces;
          enabledCache = createDebug.enabled(namespace);
        }
        return enabledCache;
      },
      set: (v) => {
        enableOverride = v;
      }
    });
    if (typeof createDebug.init === "function") {
      createDebug.init(debug2);
    }
    return debug2;
  }
  function extend(namespace, delimiter) {
    const newDebug = createDebug(this.namespace + (typeof delimiter === "undefined" ? ":" : delimiter) + namespace);
    newDebug.log = this.log;
    return newDebug;
  }
  function enable(namespaces) {
    createDebug.save(namespaces);
    createDebug.namespaces = namespaces;
    createDebug.names = [];
    createDebug.skips = [];
    let i;
    const split = (typeof namespaces === "string" ? namespaces : "").split(/[\s,]+/);
    const len = split.length;
    for (i = 0; i < len; i++) {
      if (!split[i]) {
        continue;
      }
      namespaces = split[i].replace(/\*/g, ".*?");
      if (namespaces[0] === "-") {
        createDebug.skips.push(new RegExp("^" + namespaces.slice(1) + "$"));
      } else {
        createDebug.names.push(new RegExp("^" + namespaces + "$"));
      }
    }
  }
  function disable() {
    const namespaces = [
      ...createDebug.names.map(toNamespace),
      ...createDebug.skips.map(toNamespace).map((namespace) => "-" + namespace)
    ].join(",");
    createDebug.enable("");
    return namespaces;
  }
  function enabled(name) {
    if (name[name.length - 1] === "*") {
      return true;
    }
    let i;
    let len;
    for (i = 0, len = createDebug.skips.length; i < len; i++) {
      if (createDebug.skips[i].test(name)) {
        return false;
      }
    }
    for (i = 0, len = createDebug.names.length; i < len; i++) {
      if (createDebug.names[i].test(name)) {
        return true;
      }
    }
    return false;
  }
  function toNamespace(regexp) {
    return regexp.toString().substring(2, regexp.toString().length - 2).replace(/\.\*\?$/, "*");
  }
  function coerce(val) {
    if (val instanceof Error) {
      return val.stack || val.message;
    }
    return val;
  }
  function destroy() {
    console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
  }
  createDebug.enable(createDebug.load());
  return createDebug;
}
var common$2 = setup;
(function(module, exports2) {
  exports2.formatArgs = formatArgs;
  exports2.save = save;
  exports2.load = load;
  exports2.useColors = useColors;
  exports2.storage = localstorage();
  exports2.destroy = /* @__PURE__ */ (() => {
    let warned = false;
    return () => {
      if (!warned) {
        warned = true;
        console.warn("Instance method `debug.destroy()` is deprecated and no longer does anything. It will be removed in the next major version of `debug`.");
      }
    };
  })();
  exports2.colors = [
    "#0000CC",
    "#0000FF",
    "#0033CC",
    "#0033FF",
    "#0066CC",
    "#0066FF",
    "#0099CC",
    "#0099FF",
    "#00CC00",
    "#00CC33",
    "#00CC66",
    "#00CC99",
    "#00CCCC",
    "#00CCFF",
    "#3300CC",
    "#3300FF",
    "#3333CC",
    "#3333FF",
    "#3366CC",
    "#3366FF",
    "#3399CC",
    "#3399FF",
    "#33CC00",
    "#33CC33",
    "#33CC66",
    "#33CC99",
    "#33CCCC",
    "#33CCFF",
    "#6600CC",
    "#6600FF",
    "#6633CC",
    "#6633FF",
    "#66CC00",
    "#66CC33",
    "#9900CC",
    "#9900FF",
    "#9933CC",
    "#9933FF",
    "#99CC00",
    "#99CC33",
    "#CC0000",
    "#CC0033",
    "#CC0066",
    "#CC0099",
    "#CC00CC",
    "#CC00FF",
    "#CC3300",
    "#CC3333",
    "#CC3366",
    "#CC3399",
    "#CC33CC",
    "#CC33FF",
    "#CC6600",
    "#CC6633",
    "#CC9900",
    "#CC9933",
    "#CCCC00",
    "#CCCC33",
    "#FF0000",
    "#FF0033",
    "#FF0066",
    "#FF0099",
    "#FF00CC",
    "#FF00FF",
    "#FF3300",
    "#FF3333",
    "#FF3366",
    "#FF3399",
    "#FF33CC",
    "#FF33FF",
    "#FF6600",
    "#FF6633",
    "#FF9900",
    "#FF9933",
    "#FFCC00",
    "#FFCC33"
  ];
  function useColors() {
    if (typeof window !== "undefined" && window.process && (window.process.type === "renderer" || window.process.__nwjs)) {
      return true;
    }
    if (typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/(edge|trident)\/(\d+)/)) {
      return false;
    }
    return typeof document !== "undefined" && document.documentElement && document.documentElement.style && document.documentElement.style.WebkitAppearance || // Is firebug? http://stackoverflow.com/a/398120/376773
    typeof window !== "undefined" && window.console && (window.console.firebug || window.console.exception && window.console.table) || // Is firefox >= v31?
    // https://developer.mozilla.org/en-US/docs/Tools/Web_Console#Styling_messages
    typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/firefox\/(\d+)/) && parseInt(RegExp.$1, 10) >= 31 || // Double check webkit in userAgent just in case we are in a worker
    typeof navigator !== "undefined" && navigator.userAgent && navigator.userAgent.toLowerCase().match(/applewebkit\/(\d+)/);
  }
  function formatArgs(args) {
    args[0] = (this.useColors ? "%c" : "") + this.namespace + (this.useColors ? " %c" : " ") + args[0] + (this.useColors ? "%c " : " ") + "+" + module.exports.humanize(this.diff);
    if (!this.useColors) {
      return;
    }
    const c = "color: " + this.color;
    args.splice(1, 0, c, "color: inherit");
    let index = 0;
    let lastC = 0;
    args[0].replace(/%[a-zA-Z%]/g, (match) => {
      if (match === "%%") {
        return;
      }
      index++;
      if (match === "%c") {
        lastC = index;
      }
    });
    args.splice(lastC, 0, c);
  }
  exports2.log = console.debug || console.log || (() => {
  });
  function save(namespaces) {
    try {
      if (namespaces) {
        exports2.storage.setItem("debug", namespaces);
      } else {
        exports2.storage.removeItem("debug");
      }
    } catch (error) {
    }
  }
  function load() {
    let r;
    try {
      r = exports2.storage.getItem("debug");
    } catch (error) {
    }
    if (!r && typeof process$1 !== "undefined" && "env" in process$1) {
      r = process$1.env.DEBUG;
    }
    return r;
  }
  function localstorage() {
    try {
      return localStorage;
    } catch (error) {
    }
  }
  module.exports = common$2(exports2);
  const { formatters } = module.exports;
  formatters.j = function(v) {
    try {
      return JSON.stringify(v);
    } catch (error) {
      return "[UnexpectedJSONParseError]: " + error.message;
    }
  };
})(browser$1, browser$1.exports);
var browserExports$1 = browser$1.exports;
const debug$3 = /* @__PURE__ */ getDefaultExportFromCjs(browserExports$1);
var events = { exports: {} };
var R = typeof Reflect === "object" ? Reflect : null;
var ReflectApply = R && typeof R.apply === "function" ? R.apply : function ReflectApply2(target, receiver, args) {
  return Function.prototype.apply.call(target, receiver, args);
};
var ReflectOwnKeys;
if (R && typeof R.ownKeys === "function") {
  ReflectOwnKeys = R.ownKeys;
} else if (Object.getOwnPropertySymbols) {
  ReflectOwnKeys = function ReflectOwnKeys2(target) {
    return Object.getOwnPropertyNames(target).concat(Object.getOwnPropertySymbols(target));
  };
} else {
  ReflectOwnKeys = function ReflectOwnKeys2(target) {
    return Object.getOwnPropertyNames(target);
  };
}
function ProcessEmitWarning(warning) {
  if (console && console.warn) console.warn(warning);
}
var NumberIsNaN = Number.isNaN || function NumberIsNaN2(value) {
  return value !== value;
};
function EventEmitter$1() {
  EventEmitter$1.init.call(this);
}
events.exports = EventEmitter$1;
events.exports.once = once$3;
EventEmitter$1.EventEmitter = EventEmitter$1;
EventEmitter$1.prototype._events = void 0;
EventEmitter$1.prototype._eventsCount = 0;
EventEmitter$1.prototype._maxListeners = void 0;
var defaultMaxListeners = 10;
function checkListener(listener) {
  if (typeof listener !== "function") {
    throw new TypeError('The "listener" argument must be of type Function. Received type ' + typeof listener);
  }
}
Object.defineProperty(EventEmitter$1, "defaultMaxListeners", {
  enumerable: true,
  get: function() {
    return defaultMaxListeners;
  },
  set: function(arg) {
    if (typeof arg !== "number" || arg < 0 || NumberIsNaN(arg)) {
      throw new RangeError('The value of "defaultMaxListeners" is out of range. It must be a non-negative number. Received ' + arg + ".");
    }
    defaultMaxListeners = arg;
  }
});
EventEmitter$1.init = function() {
  if (this._events === void 0 || this._events === Object.getPrototypeOf(this)._events) {
    this._events = /* @__PURE__ */ Object.create(null);
    this._eventsCount = 0;
  }
  this._maxListeners = this._maxListeners || void 0;
};
EventEmitter$1.prototype.setMaxListeners = function setMaxListeners(n) {
  if (typeof n !== "number" || n < 0 || NumberIsNaN(n)) {
    throw new RangeError('The value of "n" is out of range. It must be a non-negative number. Received ' + n + ".");
  }
  this._maxListeners = n;
  return this;
};
function _getMaxListeners(that) {
  if (that._maxListeners === void 0)
    return EventEmitter$1.defaultMaxListeners;
  return that._maxListeners;
}
EventEmitter$1.prototype.getMaxListeners = function getMaxListeners() {
  return _getMaxListeners(this);
};
EventEmitter$1.prototype.emit = function emit(type) {
  var args = [];
  for (var i = 1; i < arguments.length; i++) args.push(arguments[i]);
  var doError = type === "error";
  var events2 = this._events;
  if (events2 !== void 0)
    doError = doError && events2.error === void 0;
  else if (!doError)
    return false;
  if (doError) {
    var er;
    if (args.length > 0)
      er = args[0];
    if (er instanceof Error) {
      throw er;
    }
    var err = new Error("Unhandled error." + (er ? " (" + er.message + ")" : ""));
    err.context = er;
    throw err;
  }
  var handler = events2[type];
  if (handler === void 0)
    return false;
  if (typeof handler === "function") {
    ReflectApply(handler, this, args);
  } else {
    var len = handler.length;
    var listeners2 = arrayClone(handler, len);
    for (var i = 0; i < len; ++i)
      ReflectApply(listeners2[i], this, args);
  }
  return true;
};
function _addListener(target, type, listener, prepend) {
  var m;
  var events2;
  var existing;
  checkListener(listener);
  events2 = target._events;
  if (events2 === void 0) {
    events2 = target._events = /* @__PURE__ */ Object.create(null);
    target._eventsCount = 0;
  } else {
    if (events2.newListener !== void 0) {
      target.emit(
        "newListener",
        type,
        listener.listener ? listener.listener : listener
      );
      events2 = target._events;
    }
    existing = events2[type];
  }
  if (existing === void 0) {
    existing = events2[type] = listener;
    ++target._eventsCount;
  } else {
    if (typeof existing === "function") {
      existing = events2[type] = prepend ? [listener, existing] : [existing, listener];
    } else if (prepend) {
      existing.unshift(listener);
    } else {
      existing.push(listener);
    }
    m = _getMaxListeners(target);
    if (m > 0 && existing.length > m && !existing.warned) {
      existing.warned = true;
      var w = new Error("Possible EventEmitter memory leak detected. " + existing.length + " " + String(type) + " listeners added. Use emitter.setMaxListeners() to increase limit");
      w.name = "MaxListenersExceededWarning";
      w.emitter = target;
      w.type = type;
      w.count = existing.length;
      ProcessEmitWarning(w);
    }
  }
  return target;
}
EventEmitter$1.prototype.addListener = function addListener(type, listener) {
  return _addListener(this, type, listener, false);
};
EventEmitter$1.prototype.on = EventEmitter$1.prototype.addListener;
EventEmitter$1.prototype.prependListener = function prependListener(type, listener) {
  return _addListener(this, type, listener, true);
};
function onceWrapper() {
  if (!this.fired) {
    this.target.removeListener(this.type, this.wrapFn);
    this.fired = true;
    if (arguments.length === 0)
      return this.listener.call(this.target);
    return this.listener.apply(this.target, arguments);
  }
}
function _onceWrap(target, type, listener) {
  var state = { fired: false, wrapFn: void 0, target, type, listener };
  var wrapped = onceWrapper.bind(state);
  wrapped.listener = listener;
  state.wrapFn = wrapped;
  return wrapped;
}
EventEmitter$1.prototype.once = function once(type, listener) {
  checkListener(listener);
  this.on(type, _onceWrap(this, type, listener));
  return this;
};
EventEmitter$1.prototype.prependOnceListener = function prependOnceListener(type, listener) {
  checkListener(listener);
  this.prependListener(type, _onceWrap(this, type, listener));
  return this;
};
EventEmitter$1.prototype.removeListener = function removeListener(type, listener) {
  var list, events2, position, i, originalListener;
  checkListener(listener);
  events2 = this._events;
  if (events2 === void 0)
    return this;
  list = events2[type];
  if (list === void 0)
    return this;
  if (list === listener || list.listener === listener) {
    if (--this._eventsCount === 0)
      this._events = /* @__PURE__ */ Object.create(null);
    else {
      delete events2[type];
      if (events2.removeListener)
        this.emit("removeListener", type, list.listener || listener);
    }
  } else if (typeof list !== "function") {
    position = -1;
    for (i = list.length - 1; i >= 0; i--) {
      if (list[i] === listener || list[i].listener === listener) {
        originalListener = list[i].listener;
        position = i;
        break;
      }
    }
    if (position < 0)
      return this;
    if (position === 0)
      list.shift();
    else {
      spliceOne(list, position);
    }
    if (list.length === 1)
      events2[type] = list[0];
    if (events2.removeListener !== void 0)
      this.emit("removeListener", type, originalListener || listener);
  }
  return this;
};
EventEmitter$1.prototype.off = EventEmitter$1.prototype.removeListener;
EventEmitter$1.prototype.removeAllListeners = function removeAllListeners(type) {
  var listeners2, events2, i;
  events2 = this._events;
  if (events2 === void 0)
    return this;
  if (events2.removeListener === void 0) {
    if (arguments.length === 0) {
      this._events = /* @__PURE__ */ Object.create(null);
      this._eventsCount = 0;
    } else if (events2[type] !== void 0) {
      if (--this._eventsCount === 0)
        this._events = /* @__PURE__ */ Object.create(null);
      else
        delete events2[type];
    }
    return this;
  }
  if (arguments.length === 0) {
    var keys = Object.keys(events2);
    var key;
    for (i = 0; i < keys.length; ++i) {
      key = keys[i];
      if (key === "removeListener") continue;
      this.removeAllListeners(key);
    }
    this.removeAllListeners("removeListener");
    this._events = /* @__PURE__ */ Object.create(null);
    this._eventsCount = 0;
    return this;
  }
  listeners2 = events2[type];
  if (typeof listeners2 === "function") {
    this.removeListener(type, listeners2);
  } else if (listeners2 !== void 0) {
    for (i = listeners2.length - 1; i >= 0; i--) {
      this.removeListener(type, listeners2[i]);
    }
  }
  return this;
};
function _listeners(target, type, unwrap) {
  var events2 = target._events;
  if (events2 === void 0)
    return [];
  var evlistener = events2[type];
  if (evlistener === void 0)
    return [];
  if (typeof evlistener === "function")
    return unwrap ? [evlistener.listener || evlistener] : [evlistener];
  return unwrap ? unwrapListeners(evlistener) : arrayClone(evlistener, evlistener.length);
}
EventEmitter$1.prototype.listeners = function listeners(type) {
  return _listeners(this, type, true);
};
EventEmitter$1.prototype.rawListeners = function rawListeners(type) {
  return _listeners(this, type, false);
};
EventEmitter$1.listenerCount = function(emitter, type) {
  if (typeof emitter.listenerCount === "function") {
    return emitter.listenerCount(type);
  } else {
    return listenerCount.call(emitter, type);
  }
};
EventEmitter$1.prototype.listenerCount = listenerCount;
function listenerCount(type) {
  var events2 = this._events;
  if (events2 !== void 0) {
    var evlistener = events2[type];
    if (typeof evlistener === "function") {
      return 1;
    } else if (evlistener !== void 0) {
      return evlistener.length;
    }
  }
  return 0;
}
EventEmitter$1.prototype.eventNames = function eventNames() {
  return this._eventsCount > 0 ? ReflectOwnKeys(this._events) : [];
};
function arrayClone(arr, n) {
  var copy = new Array(n);
  for (var i = 0; i < n; ++i)
    copy[i] = arr[i];
  return copy;
}
function spliceOne(list, index) {
  for (; index + 1 < list.length; index++)
    list[index] = list[index + 1];
  list.pop();
}
function unwrapListeners(arr) {
  var ret = new Array(arr.length);
  for (var i = 0; i < ret.length; ++i) {
    ret[i] = arr[i].listener || arr[i];
  }
  return ret;
}
function once$3(emitter, name) {
  return new Promise(function(resolve, reject) {
    function errorListener(err) {
      emitter.removeListener(name, resolver);
      reject(err);
    }
    function resolver() {
      if (typeof emitter.removeListener === "function") {
        emitter.removeListener("error", errorListener);
      }
      resolve([].slice.call(arguments));
    }
    eventTargetAgnosticAddListener(emitter, name, resolver, { once: true });
    if (name !== "error") {
      addErrorHandlerIfEventEmitter(emitter, errorListener, { once: true });
    }
  });
}
function addErrorHandlerIfEventEmitter(emitter, handler, flags) {
  if (typeof emitter.on === "function") {
    eventTargetAgnosticAddListener(emitter, "error", handler, flags);
  }
}
function eventTargetAgnosticAddListener(emitter, name, listener, flags) {
  if (typeof emitter.on === "function") {
    if (flags.once) {
      emitter.once(name, listener);
    } else {
      emitter.on(name, listener);
    }
  } else if (typeof emitter.addEventListener === "function") {
    emitter.addEventListener(name, function wrapListener(arg) {
      if (flags.once) {
        emitter.removeEventListener(name, wrapListener);
      }
      listener(arg);
    });
  } else {
    throw new TypeError('The "emitter" argument must be of type EventEmitter. Received type ' + typeof emitter);
  }
}
var eventsExports = events.exports;
const EventEmitter$2 = /* @__PURE__ */ getDefaultExportFromCjs(eventsExports);
var once$2 = { exports: {} };
var wrappy_1 = wrappy$1;
function wrappy$1(fn, cb) {
  if (fn && cb) return wrappy$1(fn)(cb);
  if (typeof fn !== "function")
    throw new TypeError("need wrapper function");
  Object.keys(fn).forEach(function(k) {
    wrapper[k] = fn[k];
  });
  return wrapper;
  function wrapper() {
    var args = new Array(arguments.length);
    for (var i = 0; i < args.length; i++) {
      args[i] = arguments[i];
    }
    var ret = fn.apply(this, args);
    var cb2 = args[args.length - 1];
    if (typeof ret === "function" && ret !== cb2) {
      Object.keys(cb2).forEach(function(k) {
        ret[k] = cb2[k];
      });
    }
    return ret;
  }
}
var wrappy = wrappy_1;
once$2.exports = wrappy(once2);
once$2.exports.strict = wrappy(onceStrict);
once2.proto = once2(function() {
  Object.defineProperty(Function.prototype, "once", {
    value: function() {
      return once2(this);
    },
    configurable: true
  });
  Object.defineProperty(Function.prototype, "onceStrict", {
    value: function() {
      return onceStrict(this);
    },
    configurable: true
  });
});
function once2(fn) {
  var f = function() {
    if (f.called) return f.value;
    f.called = true;
    return f.value = fn.apply(this, arguments);
  };
  f.called = false;
  return f;
}
function onceStrict(fn) {
  var f = function() {
    if (f.called)
      throw new Error(f.onceError);
    f.called = true;
    return f.value = fn.apply(this, arguments);
  };
  var name = fn.name || "Function wrapped with `once`";
  f.onceError = name + " shouldn't be called more than once";
  f.called = false;
  return f;
}
var onceExports = once$2.exports;
const once$1 = /* @__PURE__ */ getDefaultExportFromCjs(onceExports);
/*! queue-microtask. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
let promise;
var queueMicrotask_1$1 = typeof queueMicrotask === "function" ? queueMicrotask.bind(typeof window !== "undefined" ? window : commonjsGlobal) : (cb) => (promise || (promise = Promise.resolve())).then(cb).catch((err) => setTimeout(() => {
  throw err;
}, 0));
const queueMicrotask$2 = /* @__PURE__ */ getDefaultExportFromCjs(queueMicrotask_1$1);
/*! run-parallel. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
var runParallel_1 = runParallel;
const queueMicrotask$1 = queueMicrotask_1$1;
function runParallel(tasks, cb) {
  let results, pending, keys;
  let isSync = true;
  if (Array.isArray(tasks)) {
    results = [];
    pending = tasks.length;
  } else {
    keys = Object.keys(tasks);
    results = {};
    pending = keys.length;
  }
  function done(err) {
    function end() {
      if (cb) cb(err, results);
      cb = null;
    }
    if (isSync) queueMicrotask$1(end);
    else end();
  }
  function each(i, err, result) {
    results[i] = result;
    if (--pending === 0 || err) {
      done(err);
    }
  }
  if (!pending) {
    done(null);
  } else if (keys) {
    keys.forEach(function(key) {
      tasks[key](function(err, result) {
        each(key, err, result);
      });
    });
  } else {
    tasks.forEach(function(task, i) {
      task(function(err, result) {
        each(i, err, result);
      });
    });
  }
  isSync = false;
}
const parallel = /* @__PURE__ */ getDefaultExportFromCjs(runParallel_1);
const scope$1 = typeof window !== "undefined" ? window : self;
const RTCPeerConnection = scope$1.RTCPeerConnection || scope$1.mozRTCPeerConnection || scope$1.webkitRTCPeerConnection;
const RTCSessionDescription = scope$1.RTCSessionDescription || scope$1.mozRTCSessionDescription || scope$1.webkitRTCSessionDescription;
const RTCIceCandidate = scope$1.RTCIceCandidate || scope$1.mozRTCIceCandidate || scope$1.webkitRTCIceCandidate;
var queueMicrotask_1 = typeof queueMicrotask === "function" ? queueMicrotask : (fn) => Promise.resolve().then(fn);
var fixedSize = class FixedFIFO {
  constructor(hwm) {
    if (!(hwm > 0) || (hwm - 1 & hwm) !== 0) throw new Error("Max size for a FixedFIFO should be a power of two");
    this.buffer = new Array(hwm);
    this.mask = hwm - 1;
    this.top = 0;
    this.btm = 0;
    this.next = null;
  }
  clear() {
    this.top = this.btm = 0;
    this.next = null;
    this.buffer.fill(void 0);
  }
  push(data) {
    if (this.buffer[this.top] !== void 0) return false;
    this.buffer[this.top] = data;
    this.top = this.top + 1 & this.mask;
    return true;
  }
  shift() {
    const last = this.buffer[this.btm];
    if (last === void 0) return void 0;
    this.buffer[this.btm] = void 0;
    this.btm = this.btm + 1 & this.mask;
    return last;
  }
  peek() {
    return this.buffer[this.btm];
  }
  isEmpty() {
    return this.buffer[this.btm] === void 0;
  }
};
const FixedFIFO2 = fixedSize;
var fastFifo = class FastFIFO {
  constructor(hwm) {
    this.hwm = hwm || 16;
    this.head = new FixedFIFO2(this.hwm);
    this.tail = this.head;
    this.length = 0;
  }
  clear() {
    this.head = this.tail;
    this.head.clear();
    this.length = 0;
  }
  push(val) {
    this.length++;
    if (!this.head.push(val)) {
      const prev = this.head;
      this.head = prev.next = new FixedFIFO2(2 * this.head.buffer.length);
      this.head.push(val);
    }
  }
  shift() {
    if (this.length !== 0) this.length--;
    const val = this.tail.shift();
    if (val === void 0 && this.tail.next) {
      const next = this.tail.next;
      this.tail.next = null;
      this.tail = next;
      return this.tail.shift();
    }
    return val;
  }
  peek() {
    const val = this.tail.peek();
    if (val === void 0 && this.tail.next) return this.tail.next.peek();
    return val;
  }
  isEmpty() {
    return this.length === 0;
  }
};
var browser = { exports: {} };
function byteLength$4(string) {
  return string.length;
}
function toString$4(buffer) {
  const len = buffer.byteLength;
  let result = "";
  for (let i = 0; i < len; i++) {
    result += String.fromCharCode(buffer[i]);
  }
  return result;
}
function write$4(buffer, string, offset = 0, length = byteLength$4(string)) {
  const len = Math.min(length, buffer.byteLength - offset);
  for (let i = 0; i < len; i++) {
    buffer[offset + i] = string.charCodeAt(i);
  }
  return len;
}
var ascii = {
  byteLength: byteLength$4,
  toString: toString$4,
  write: write$4
};
const alphabet$1 = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
const codes = new Uint8Array(256);
for (let i = 0; i < alphabet$1.length; i++) {
  codes[alphabet$1.charCodeAt(i)] = i;
}
codes[
  /* - */
  45
] = 62;
codes[
  /* _ */
  95
] = 63;
function byteLength$3(string) {
  let len = string.length;
  if (string.charCodeAt(len - 1) === 61) len--;
  if (len > 1 && string.charCodeAt(len - 1) === 61) len--;
  return len * 3 >>> 2;
}
function toString$3(buffer) {
  const len = buffer.byteLength;
  let result = "";
  for (let i = 0; i < len; i += 3) {
    result += alphabet$1[buffer[i] >> 2] + alphabet$1[(buffer[i] & 3) << 4 | buffer[i + 1] >> 4] + alphabet$1[(buffer[i + 1] & 15) << 2 | buffer[i + 2] >> 6] + alphabet$1[buffer[i + 2] & 63];
  }
  if (len % 3 === 2) {
    result = result.substring(0, result.length - 1) + "=";
  } else if (len % 3 === 1) {
    result = result.substring(0, result.length - 2) + "==";
  }
  return result;
}
function write$3(buffer, string, offset = 0, length = byteLength$3(string)) {
  const len = Math.min(length, buffer.byteLength - offset);
  for (let i = 0, j = 0; j < len; i += 4) {
    const a = codes[string.charCodeAt(i)];
    const b = codes[string.charCodeAt(i + 1)];
    const c = codes[string.charCodeAt(i + 2)];
    const d = codes[string.charCodeAt(i + 3)];
    buffer[j++] = a << 2 | b >> 4;
    buffer[j++] = (b & 15) << 4 | c >> 2;
    buffer[j++] = (c & 3) << 6 | d & 63;
  }
  return len;
}
var base64 = {
  byteLength: byteLength$3,
  toString: toString$3,
  write: write$3
};
function byteLength$2(string) {
  return string.length >>> 1;
}
function toString$2(buffer) {
  const len = buffer.byteLength;
  buffer = new DataView(buffer.buffer, buffer.byteOffset, len);
  let result = "";
  let i = 0;
  for (let n = len - len % 4; i < n; i += 4) {
    result += buffer.getUint32(i).toString(16).padStart(8, "0");
  }
  for (; i < len; i++) {
    result += buffer.getUint8(i).toString(16).padStart(2, "0");
  }
  return result;
}
function write$2(buffer, string, offset = 0, length = byteLength$2(string)) {
  const len = Math.min(length, buffer.byteLength - offset);
  for (let i = 0; i < len; i++) {
    const a = hexValue(string.charCodeAt(i * 2));
    const b = hexValue(string.charCodeAt(i * 2 + 1));
    if (a === void 0 || b === void 0) {
      return buffer.subarray(0, i);
    }
    buffer[offset + i] = a << 4 | b;
  }
  return len;
}
var hex = {
  byteLength: byteLength$2,
  toString: toString$2,
  write: write$2
};
function hexValue(char) {
  if (char >= 48 && char <= 57) return char - 48;
  if (char >= 65 && char <= 70) return char - 65 + 10;
  if (char >= 97 && char <= 102) return char - 97 + 10;
}
function byteLength$1(string) {
  let length = 0;
  for (let i = 0, n = string.length; i < n; i++) {
    const code = string.charCodeAt(i);
    if (code >= 55296 && code <= 56319 && i + 1 < n) {
      const code2 = string.charCodeAt(i + 1);
      if (code2 >= 56320 && code2 <= 57343) {
        length += 4;
        i++;
        continue;
      }
    }
    if (code <= 127) length += 1;
    else if (code <= 2047) length += 2;
    else length += 3;
  }
  return length;
}
let toString$1;
if (typeof TextDecoder !== "undefined") {
  const decoder2 = new TextDecoder();
  toString$1 = function toString2(buffer) {
    return decoder2.decode(buffer);
  };
} else {
  toString$1 = function toString2(buffer) {
    const len = buffer.byteLength;
    let output = "";
    let i = 0;
    while (i < len) {
      let byte = buffer[i];
      if (byte <= 127) {
        output += String.fromCharCode(byte);
        i++;
        continue;
      }
      let bytesNeeded = 0;
      let codePoint = 0;
      if (byte <= 223) {
        bytesNeeded = 1;
        codePoint = byte & 31;
      } else if (byte <= 239) {
        bytesNeeded = 2;
        codePoint = byte & 15;
      } else if (byte <= 244) {
        bytesNeeded = 3;
        codePoint = byte & 7;
      }
      if (len - i - bytesNeeded > 0) {
        let k = 0;
        while (k < bytesNeeded) {
          byte = buffer[i + k + 1];
          codePoint = codePoint << 6 | byte & 63;
          k += 1;
        }
      } else {
        codePoint = 65533;
        bytesNeeded = len - i;
      }
      output += String.fromCodePoint(codePoint);
      i += bytesNeeded + 1;
    }
    return output;
  };
}
let write$1;
if (typeof TextEncoder !== "undefined") {
  const encoder2 = new TextEncoder();
  write$1 = function write2(buffer, string, offset = 0, length = byteLength$1(string)) {
    const len = Math.min(length, buffer.byteLength - offset);
    encoder2.encodeInto(string, buffer.subarray(offset, offset + len));
    return len;
  };
} else {
  write$1 = function write2(buffer, string, offset = 0, length = byteLength$1(string)) {
    const len = Math.min(length, buffer.byteLength - offset);
    buffer = buffer.subarray(offset, offset + len);
    let i = 0;
    let j = 0;
    while (i < string.length) {
      const code = string.codePointAt(i);
      if (code <= 127) {
        buffer[j++] = code;
        i++;
        continue;
      }
      let count = 0;
      let bits = 0;
      if (code <= 2047) {
        count = 6;
        bits = 192;
      } else if (code <= 65535) {
        count = 12;
        bits = 224;
      } else if (code <= 2097151) {
        count = 18;
        bits = 240;
      }
      buffer[j++] = bits | code >> count;
      count -= 6;
      while (count >= 0) {
        buffer[j++] = 128 | code >> count & 63;
        count -= 6;
      }
      i += code >= 65536 ? 2 : 1;
    }
    return len;
  };
}
var utf8 = {
  byteLength: byteLength$1,
  toString: toString$1,
  write: write$1
};
function byteLength(string) {
  return string.length * 2;
}
function toString(buffer) {
  const len = buffer.byteLength;
  let result = "";
  for (let i = 0; i < len - 1; i += 2) {
    result += String.fromCharCode(buffer[i] + buffer[i + 1] * 256);
  }
  return result;
}
function write(buffer, string, offset = 0, length = byteLength(string)) {
  const len = Math.min(length, buffer.byteLength - offset);
  let units = len;
  for (let i = 0; i < string.length; ++i) {
    if ((units -= 2) < 0) break;
    const c = string.charCodeAt(i);
    const hi = c >> 8;
    const lo = c % 256;
    buffer[offset + i * 2] = lo;
    buffer[offset + i * 2 + 1] = hi;
  }
  return len;
}
var utf16le = {
  byteLength,
  toString,
  write
};
(function(module, exports2) {
  const ascii$1 = ascii;
  const base64$1 = base64;
  const hex$1 = hex;
  const utf8$1 = utf8;
  const utf16le$1 = utf16le;
  const LE = new Uint8Array(Uint16Array.of(255).buffer)[0] === 255;
  function codecFor(encoding) {
    switch (encoding) {
      case "ascii":
        return ascii$1;
      case "base64":
        return base64$1;
      case "hex":
        return hex$1;
      case "utf8":
      case "utf-8":
      case void 0:
        return utf8$1;
      case "ucs2":
      case "ucs-2":
      case "utf16le":
      case "utf-16le":
        return utf16le$1;
      default:
        throw new Error(`Unknown encoding: ${encoding}`);
    }
  }
  function isBuffer(value) {
    return value instanceof Uint8Array;
  }
  function isEncoding(encoding) {
    try {
      codecFor(encoding);
      return true;
    } catch {
      return false;
    }
  }
  function alloc(size, fill2, encoding) {
    const buffer = new Uint8Array(size);
    if (fill2 !== void 0) exports2.fill(buffer, fill2, 0, buffer.byteLength, encoding);
    return buffer;
  }
  function allocUnsafe(size) {
    return new Uint8Array(size);
  }
  function allocUnsafeSlow(size) {
    return new Uint8Array(size);
  }
  function byteLength2(string, encoding) {
    return codecFor(encoding).byteLength(string);
  }
  function compare(a, b) {
    if (a === b) return 0;
    const len = Math.min(a.byteLength, b.byteLength);
    a = new DataView(a.buffer, a.byteOffset, a.byteLength);
    b = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 0;
    for (let n = len - len % 4; i < n; i += 4) {
      const x = a.getUint32(i, LE);
      const y = b.getUint32(i, LE);
      if (x !== y) break;
    }
    for (; i < len; i++) {
      const x = a.getUint8(i);
      const y = b.getUint8(i);
      if (x < y) return -1;
      if (x > y) return 1;
    }
    return a.byteLength > b.byteLength ? 1 : a.byteLength < b.byteLength ? -1 : 0;
  }
  function concat(buffers, totalLength) {
    if (totalLength === void 0) {
      totalLength = buffers.reduce((len, buffer) => len + buffer.byteLength, 0);
    }
    const result = new Uint8Array(totalLength);
    let offset = 0;
    for (const buffer of buffers) {
      if (offset + buffer.byteLength > result.byteLength) {
        const sub = buffer.subarray(0, result.byteLength - offset);
        result.set(sub, offset);
        return result;
      }
      result.set(buffer, offset);
      offset += buffer.byteLength;
    }
    return result;
  }
  function copy(source, target, targetStart = 0, start = 0, end = source.byteLength) {
    if (end > 0 && end < start) return 0;
    if (end === start) return 0;
    if (source.byteLength === 0 || target.byteLength === 0) return 0;
    if (targetStart < 0) throw new RangeError("targetStart is out of range");
    if (start < 0 || start >= source.byteLength) throw new RangeError("sourceStart is out of range");
    if (end < 0) throw new RangeError("sourceEnd is out of range");
    if (targetStart >= target.byteLength) targetStart = target.byteLength;
    if (end > source.byteLength) end = source.byteLength;
    if (target.byteLength - targetStart < end - start) {
      end = target.length - targetStart + start;
    }
    const len = end - start;
    if (source === target) {
      target.copyWithin(targetStart, start, end);
    } else {
      target.set(source.subarray(start, end), targetStart);
    }
    return len;
  }
  function equals(a, b) {
    if (a === b) return true;
    if (a.byteLength !== b.byteLength) return false;
    const len = a.byteLength;
    a = new DataView(a.buffer, a.byteOffset, a.byteLength);
    b = new DataView(b.buffer, b.byteOffset, b.byteLength);
    let i = 0;
    for (let n = len - len % 4; i < n; i += 4) {
      if (a.getUint32(i, LE) !== b.getUint32(i, LE)) return false;
    }
    for (; i < len; i++) {
      if (a.getUint8(i) !== b.getUint8(i)) return false;
    }
    return true;
  }
  function fill(buffer, value, offset, end, encoding) {
    if (typeof value === "string") {
      if (typeof offset === "string") {
        encoding = offset;
        offset = 0;
        end = buffer.byteLength;
      } else if (typeof end === "string") {
        encoding = end;
        end = buffer.byteLength;
      }
    } else if (typeof value === "number") {
      value = value & 255;
    } else if (typeof value === "boolean") {
      value = +value;
    }
    if (offset < 0 || buffer.byteLength < offset || buffer.byteLength < end) {
      throw new RangeError("Out of range index");
    }
    if (offset === void 0) offset = 0;
    if (end === void 0) end = buffer.byteLength;
    if (end <= offset) return buffer;
    if (!value) value = 0;
    if (typeof value === "number") {
      for (let i = offset; i < end; ++i) {
        buffer[i] = value;
      }
    } else {
      value = isBuffer(value) ? value : from(value, encoding);
      const len = value.byteLength;
      for (let i = 0; i < end - offset; ++i) {
        buffer[i + offset] = value[i % len];
      }
    }
    return buffer;
  }
  function from(value, encodingOrOffset, length) {
    if (typeof value === "string") return fromString(value, encodingOrOffset);
    if (Array.isArray(value)) return fromArray(value);
    if (ArrayBuffer.isView(value)) return fromBuffer(value);
    return fromArrayBuffer(value, encodingOrOffset, length);
  }
  function fromString(string, encoding) {
    const codec = codecFor(encoding);
    const buffer = new Uint8Array(codec.byteLength(string));
    codec.write(buffer, string, 0, buffer.byteLength);
    return buffer;
  }
  function fromArray(array) {
    const buffer = new Uint8Array(array.length);
    buffer.set(array);
    return buffer;
  }
  function fromBuffer(buffer) {
    const copy2 = new Uint8Array(buffer.byteLength);
    copy2.set(buffer);
    return copy2;
  }
  function fromArrayBuffer(arrayBuffer, byteOffset, length) {
    return new Uint8Array(arrayBuffer, byteOffset, length);
  }
  function includes(buffer, value, byteOffset, encoding) {
    return indexOf(buffer, value, byteOffset, encoding) !== -1;
  }
  function bidirectionalIndexOf(buffer, value, byteOffset, encoding, first) {
    if (buffer.byteLength === 0) return -1;
    if (typeof byteOffset === "string") {
      encoding = byteOffset;
      byteOffset = 0;
    } else if (byteOffset === void 0) {
      byteOffset = first ? 0 : buffer.length - 1;
    } else if (byteOffset < 0) {
      byteOffset += buffer.byteLength;
    }
    if (byteOffset >= buffer.byteLength) {
      if (first) return -1;
      else byteOffset = buffer.byteLength - 1;
    } else if (byteOffset < 0) {
      if (first) byteOffset = 0;
      else return -1;
    }
    if (typeof value === "string") {
      value = from(value, encoding);
    } else if (typeof value === "number") {
      value = value & 255;
      if (first) {
        return buffer.indexOf(value, byteOffset);
      } else {
        return buffer.lastIndexOf(value, byteOffset);
      }
    }
    if (value.byteLength === 0) return -1;
    if (first) {
      let foundIndex = -1;
      for (let i = byteOffset; i < buffer.byteLength; i++) {
        if (buffer[i] === value[foundIndex === -1 ? 0 : i - foundIndex]) {
          if (foundIndex === -1) foundIndex = i;
          if (i - foundIndex + 1 === value.byteLength) return foundIndex;
        } else {
          if (foundIndex !== -1) i -= i - foundIndex;
          foundIndex = -1;
        }
      }
    } else {
      if (byteOffset + value.byteLength > buffer.byteLength) {
        byteOffset = buffer.byteLength - value.byteLength;
      }
      for (let i = byteOffset; i >= 0; i--) {
        let found = true;
        for (let j = 0; j < value.byteLength; j++) {
          if (buffer[i + j] !== value[j]) {
            found = false;
            break;
          }
        }
        if (found) return i;
      }
    }
    return -1;
  }
  function indexOf(buffer, value, byteOffset, encoding) {
    return bidirectionalIndexOf(
      buffer,
      value,
      byteOffset,
      encoding,
      true
      /* first */
    );
  }
  function lastIndexOf(buffer, value, byteOffset, encoding) {
    return bidirectionalIndexOf(
      buffer,
      value,
      byteOffset,
      encoding,
      false
      /* last */
    );
  }
  function swap(buffer, n, m) {
    const i = buffer[n];
    buffer[n] = buffer[m];
    buffer[m] = i;
  }
  function swap16(buffer) {
    const len = buffer.byteLength;
    if (len % 2 !== 0) throw new RangeError("Buffer size must be a multiple of 16-bits");
    for (let i = 0; i < len; i += 2) swap(buffer, i, i + 1);
    return buffer;
  }
  function swap32(buffer) {
    const len = buffer.byteLength;
    if (len % 4 !== 0) throw new RangeError("Buffer size must be a multiple of 32-bits");
    for (let i = 0; i < len; i += 4) {
      swap(buffer, i, i + 3);
      swap(buffer, i + 1, i + 2);
    }
    return buffer;
  }
  function swap64(buffer) {
    const len = buffer.byteLength;
    if (len % 8 !== 0) throw new RangeError("Buffer size must be a multiple of 64-bits");
    for (let i = 0; i < len; i += 8) {
      swap(buffer, i, i + 7);
      swap(buffer, i + 1, i + 6);
      swap(buffer, i + 2, i + 5);
      swap(buffer, i + 3, i + 4);
    }
    return buffer;
  }
  function toBuffer(buffer) {
    return buffer;
  }
  function toString2(buffer, encoding, start = 0, end = buffer.byteLength) {
    const len = buffer.byteLength;
    if (start >= len) return "";
    if (end <= start) return "";
    if (start < 0) start = 0;
    if (end > len) end = len;
    if (start !== 0 || end < len) buffer = buffer.subarray(start, end);
    return codecFor(encoding).toString(buffer);
  }
  function write2(buffer, string, offset, length, encoding) {
    if (offset === void 0) {
      encoding = "utf8";
    } else if (length === void 0 && typeof offset === "string") {
      encoding = offset;
      offset = void 0;
    } else if (encoding === void 0 && typeof length === "string") {
      encoding = length;
      length = void 0;
    }
    return codecFor(encoding).write(buffer, string, offset, length);
  }
  function writeDoubleLE(buffer, value, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    view.setFloat64(offset, value, true);
    return offset + 8;
  }
  function writeFloatLE(buffer, value, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    view.setFloat32(offset, value, true);
    return offset + 4;
  }
  function writeUInt32LE(buffer, value, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    view.setUint32(offset, value, true);
    return offset + 4;
  }
  function writeInt32LE(buffer, value, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    view.setInt32(offset, value, true);
    return offset + 4;
  }
  function readDoubleLE(buffer, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return view.getFloat64(offset, true);
  }
  function readFloatLE(buffer, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return view.getFloat32(offset, true);
  }
  function readUInt32LE(buffer, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return view.getUint32(offset, true);
  }
  function readInt32LE(buffer, offset) {
    if (offset === void 0) offset = 0;
    const view = new DataView(buffer.buffer, buffer.byteOffset, buffer.byteLength);
    return view.getInt32(offset, true);
  }
  module.exports = exports2 = {
    isBuffer,
    isEncoding,
    alloc,
    allocUnsafe,
    allocUnsafeSlow,
    byteLength: byteLength2,
    compare,
    concat,
    copy,
    equals,
    fill,
    from,
    includes,
    indexOf,
    lastIndexOf,
    swap16,
    swap32,
    swap64,
    toBuffer,
    toString: toString2,
    write: write2,
    writeDoubleLE,
    writeFloatLE,
    writeUInt32LE,
    writeInt32LE,
    readDoubleLE,
    readFloatLE,
    readUInt32LE,
    readInt32LE
  };
})(browser, browser.exports);
var browserExports = browser.exports;
const b4a$1 = browserExports;
var passThroughDecoder = class PassThroughDecoder {
  constructor(encoding) {
    this.encoding = encoding;
  }
  decode(tail) {
    return b4a$1.toString(tail, this.encoding);
  }
  flush() {
    return "";
  }
};
const b4a = browserExports;
var utf8Decoder = class UTF8Decoder {
  constructor() {
    this.codePoint = 0;
    this.bytesSeen = 0;
    this.bytesNeeded = 0;
    this.lowerBoundary = 128;
    this.upperBoundary = 191;
  }
  decode(data) {
    if (this.bytesNeeded === 0) {
      let isBoundary = true;
      for (let i = Math.max(0, data.byteLength - 4), n = data.byteLength; i < n && isBoundary; i++) {
        isBoundary = data[i] <= 127;
      }
      if (isBoundary) return b4a.toString(data, "utf8");
    }
    let result = "";
    for (let i = 0, n = data.byteLength; i < n; i++) {
      const byte = data[i];
      if (this.bytesNeeded === 0) {
        if (byte <= 127) {
          result += String.fromCharCode(byte);
        } else if (byte >= 194 && byte <= 223) {
          this.bytesNeeded = 1;
          this.codePoint = byte & 31;
        } else if (byte >= 224 && byte <= 239) {
          if (byte === 224) this.lowerBoundary = 160;
          else if (byte === 237) this.upperBoundary = 159;
          this.bytesNeeded = 2;
          this.codePoint = byte & 15;
        } else if (byte >= 240 && byte <= 244) {
          if (byte === 240) this.lowerBoundary = 144;
          if (byte === 244) this.upperBoundary = 143;
          this.bytesNeeded = 3;
          this.codePoint = byte & 7;
        } else {
          result += "�";
        }
        continue;
      }
      if (byte < this.lowerBoundary || byte > this.upperBoundary) {
        this.codePoint = 0;
        this.bytesNeeded = 0;
        this.bytesSeen = 0;
        this.lowerBoundary = 128;
        this.upperBoundary = 191;
        result += "�";
        continue;
      }
      this.lowerBoundary = 128;
      this.upperBoundary = 191;
      this.codePoint = this.codePoint << 6 | byte & 63;
      this.bytesSeen++;
      if (this.bytesSeen !== this.bytesNeeded) continue;
      result += String.fromCodePoint(this.codePoint);
      this.codePoint = 0;
      this.bytesNeeded = 0;
      this.bytesSeen = 0;
    }
    return result;
  }
  flush() {
    const result = this.bytesNeeded > 0 ? "�" : "";
    this.codePoint = 0;
    this.bytesNeeded = 0;
    this.bytesSeen = 0;
    this.lowerBoundary = 128;
    this.upperBoundary = 191;
    return result;
  }
};
const PassThroughDecoder2 = passThroughDecoder;
const UTF8Decoder2 = utf8Decoder;
var textDecoder = class TextDecoder2 {
  constructor(encoding = "utf8") {
    this.encoding = normalizeEncoding(encoding);
    switch (this.encoding) {
      case "utf8":
        this.decoder = new UTF8Decoder2();
        break;
      case "utf16le":
      case "base64":
        throw new Error("Unsupported encoding: " + this.encoding);
      default:
        this.decoder = new PassThroughDecoder2(this.encoding);
    }
  }
  push(data) {
    if (typeof data === "string") return data;
    return this.decoder.decode(data);
  }
  // For Node.js compatibility
  write(data) {
    return this.push(data);
  }
  end(data) {
    let result = "";
    if (data) result = this.push(data);
    result += this.decoder.flush();
    return result;
  }
};
function normalizeEncoding(encoding) {
  encoding = encoding.toLowerCase();
  switch (encoding) {
    case "utf8":
    case "utf-8":
      return "utf8";
    case "ucs2":
    case "ucs-2":
    case "utf16le":
    case "utf-16le":
      return "utf16le";
    case "latin1":
    case "binary":
      return "latin1";
    case "base64":
    case "ascii":
    case "hex":
      return encoding;
    default:
      throw new Error("Unknown encoding: " + encoding);
  }
}
const { EventEmitter } = eventsExports;
const STREAM_DESTROYED = new Error("Stream was destroyed");
const PREMATURE_CLOSE = new Error("Premature close");
const queueTick = queueMicrotask_1;
const FIFO = fastFifo;
const TextDecoder$1 = textDecoder;
const MAX = (1 << 29) - 1;
const OPENING = 1;
const PREDESTROYING = 2;
const DESTROYING = 4;
const DESTROYED = 8;
const NOT_OPENING = MAX ^ OPENING;
const NOT_PREDESTROYING = MAX ^ PREDESTROYING;
const READ_ACTIVE = 1 << 4;
const READ_UPDATING = 2 << 4;
const READ_PRIMARY = 4 << 4;
const READ_QUEUED = 8 << 4;
const READ_RESUMED = 16 << 4;
const READ_PIPE_DRAINED = 32 << 4;
const READ_ENDING = 64 << 4;
const READ_EMIT_DATA = 128 << 4;
const READ_EMIT_READABLE = 256 << 4;
const READ_EMITTED_READABLE = 512 << 4;
const READ_DONE = 1024 << 4;
const READ_NEXT_TICK = 2048 << 4;
const READ_NEEDS_PUSH = 4096 << 4;
const READ_READ_AHEAD = 8192 << 4;
const READ_FLOWING = READ_RESUMED | READ_PIPE_DRAINED;
const READ_ACTIVE_AND_NEEDS_PUSH = READ_ACTIVE | READ_NEEDS_PUSH;
const READ_PRIMARY_AND_ACTIVE = READ_PRIMARY | READ_ACTIVE;
const READ_EMIT_READABLE_AND_QUEUED = READ_EMIT_READABLE | READ_QUEUED;
const READ_RESUMED_READ_AHEAD = READ_RESUMED | READ_READ_AHEAD;
const READ_NOT_ACTIVE = MAX ^ READ_ACTIVE;
const READ_NON_PRIMARY = MAX ^ READ_PRIMARY;
const READ_NON_PRIMARY_AND_PUSHED = MAX ^ (READ_PRIMARY | READ_NEEDS_PUSH);
const READ_PUSHED = MAX ^ READ_NEEDS_PUSH;
const READ_PAUSED = MAX ^ READ_RESUMED;
const READ_NOT_QUEUED = MAX ^ (READ_QUEUED | READ_EMITTED_READABLE);
const READ_NOT_ENDING = MAX ^ READ_ENDING;
const READ_PIPE_NOT_DRAINED = MAX ^ READ_FLOWING;
const READ_NOT_NEXT_TICK = MAX ^ READ_NEXT_TICK;
const READ_NOT_UPDATING = MAX ^ READ_UPDATING;
const READ_NO_READ_AHEAD = MAX ^ READ_READ_AHEAD;
const READ_PAUSED_NO_READ_AHEAD = MAX ^ READ_RESUMED_READ_AHEAD;
const WRITE_ACTIVE = 1 << 18;
const WRITE_UPDATING = 2 << 18;
const WRITE_PRIMARY = 4 << 18;
const WRITE_QUEUED = 8 << 18;
const WRITE_UNDRAINED = 16 << 18;
const WRITE_DONE = 32 << 18;
const WRITE_EMIT_DRAIN = 64 << 18;
const WRITE_NEXT_TICK = 128 << 18;
const WRITE_WRITING = 256 << 18;
const WRITE_FINISHING = 512 << 18;
const WRITE_CORKED = 1024 << 18;
const WRITE_NOT_ACTIVE = MAX ^ (WRITE_ACTIVE | WRITE_WRITING);
const WRITE_NON_PRIMARY = MAX ^ WRITE_PRIMARY;
const WRITE_NOT_FINISHING = MAX ^ WRITE_FINISHING;
const WRITE_DRAINED = MAX ^ WRITE_UNDRAINED;
const WRITE_NOT_QUEUED = MAX ^ WRITE_QUEUED;
const WRITE_NOT_NEXT_TICK = MAX ^ WRITE_NEXT_TICK;
const WRITE_NOT_UPDATING = MAX ^ WRITE_UPDATING;
const WRITE_NOT_CORKED = MAX ^ WRITE_CORKED;
const ACTIVE = READ_ACTIVE | WRITE_ACTIVE;
const NOT_ACTIVE = MAX ^ ACTIVE;
const DONE = READ_DONE | WRITE_DONE;
const DESTROY_STATUS = DESTROYING | DESTROYED | PREDESTROYING;
const OPEN_STATUS = DESTROY_STATUS | OPENING;
const AUTO_DESTROY = DESTROY_STATUS | DONE;
const NON_PRIMARY = WRITE_NON_PRIMARY & READ_NON_PRIMARY;
const ACTIVE_OR_TICKING = WRITE_NEXT_TICK | READ_NEXT_TICK;
const TICKING = ACTIVE_OR_TICKING & NOT_ACTIVE;
const IS_OPENING = OPEN_STATUS | TICKING;
const READ_PRIMARY_STATUS = OPEN_STATUS | READ_ENDING | READ_DONE;
const READ_STATUS = OPEN_STATUS | READ_DONE | READ_QUEUED;
const READ_ENDING_STATUS = OPEN_STATUS | READ_ENDING | READ_QUEUED;
const READ_READABLE_STATUS = OPEN_STATUS | READ_EMIT_READABLE | READ_QUEUED | READ_EMITTED_READABLE;
const SHOULD_NOT_READ = OPEN_STATUS | READ_ACTIVE | READ_ENDING | READ_DONE | READ_NEEDS_PUSH | READ_READ_AHEAD;
const READ_BACKPRESSURE_STATUS = DESTROY_STATUS | READ_ENDING | READ_DONE;
const READ_UPDATE_SYNC_STATUS = READ_UPDATING | OPEN_STATUS | READ_NEXT_TICK | READ_PRIMARY;
const WRITE_PRIMARY_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_DONE;
const WRITE_QUEUED_AND_UNDRAINED = WRITE_QUEUED | WRITE_UNDRAINED;
const WRITE_QUEUED_AND_ACTIVE = WRITE_QUEUED | WRITE_ACTIVE;
const WRITE_DRAIN_STATUS = WRITE_QUEUED | WRITE_UNDRAINED | OPEN_STATUS | WRITE_ACTIVE;
const WRITE_STATUS = OPEN_STATUS | WRITE_ACTIVE | WRITE_QUEUED | WRITE_CORKED;
const WRITE_PRIMARY_AND_ACTIVE = WRITE_PRIMARY | WRITE_ACTIVE;
const WRITE_ACTIVE_AND_WRITING = WRITE_ACTIVE | WRITE_WRITING;
const WRITE_FINISHING_STATUS = OPEN_STATUS | WRITE_FINISHING | WRITE_QUEUED_AND_ACTIVE | WRITE_DONE;
const WRITE_BACKPRESSURE_STATUS = WRITE_UNDRAINED | DESTROY_STATUS | WRITE_FINISHING | WRITE_DONE;
const WRITE_UPDATE_SYNC_STATUS = WRITE_UPDATING | OPEN_STATUS | WRITE_NEXT_TICK | WRITE_PRIMARY;
const asyncIterator = Symbol.asyncIterator || Symbol("asyncIterator");
class WritableState {
  constructor(stream, { highWaterMark = 16384, map = null, mapWritable, byteLength: byteLength2, byteLengthWritable } = {}) {
    this.stream = stream;
    this.queue = new FIFO();
    this.highWaterMark = highWaterMark;
    this.buffered = 0;
    this.error = null;
    this.pipeline = null;
    this.drains = null;
    this.byteLength = byteLengthWritable || byteLength2 || defaultByteLength;
    this.map = mapWritable || map;
    this.afterWrite = afterWrite.bind(this);
    this.afterUpdateNextTick = updateWriteNT.bind(this);
  }
  get ended() {
    return (this.stream._duplexState & WRITE_DONE) !== 0;
  }
  push(data) {
    if (this.map !== null) data = this.map(data);
    this.buffered += this.byteLength(data);
    this.queue.push(data);
    if (this.buffered < this.highWaterMark) {
      this.stream._duplexState |= WRITE_QUEUED;
      return true;
    }
    this.stream._duplexState |= WRITE_QUEUED_AND_UNDRAINED;
    return false;
  }
  shift() {
    const data = this.queue.shift();
    this.buffered -= this.byteLength(data);
    if (this.buffered === 0) this.stream._duplexState &= WRITE_NOT_QUEUED;
    return data;
  }
  end(data) {
    if (typeof data === "function") this.stream.once("finish", data);
    else if (data !== void 0 && data !== null) this.push(data);
    this.stream._duplexState = (this.stream._duplexState | WRITE_FINISHING) & WRITE_NON_PRIMARY;
  }
  autoBatch(data, cb) {
    const buffer = [];
    const stream = this.stream;
    buffer.push(data);
    while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED_AND_ACTIVE) {
      buffer.push(stream._writableState.shift());
    }
    if ((stream._duplexState & OPEN_STATUS) !== 0) return cb(null);
    stream._writev(buffer, cb);
  }
  update() {
    const stream = this.stream;
    stream._duplexState |= WRITE_UPDATING;
    do {
      while ((stream._duplexState & WRITE_STATUS) === WRITE_QUEUED) {
        const data = this.shift();
        stream._duplexState |= WRITE_ACTIVE_AND_WRITING;
        stream._write(data, this.afterWrite);
      }
      if ((stream._duplexState & WRITE_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
    } while (this.continueUpdate() === true);
    stream._duplexState &= WRITE_NOT_UPDATING;
  }
  updateNonPrimary() {
    const stream = this.stream;
    if ((stream._duplexState & WRITE_FINISHING_STATUS) === WRITE_FINISHING) {
      stream._duplexState = (stream._duplexState | WRITE_ACTIVE) & WRITE_NOT_FINISHING;
      stream._final(afterFinal.bind(this));
      return;
    }
    if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
      if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
        stream._duplexState |= ACTIVE;
        stream._destroy(afterDestroy.bind(this));
      }
      return;
    }
    if ((stream._duplexState & IS_OPENING) === OPENING) {
      stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
      stream._open(afterOpen.bind(this));
    }
  }
  continueUpdate() {
    if ((this.stream._duplexState & WRITE_NEXT_TICK) === 0) return false;
    this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
    return true;
  }
  updateCallback() {
    if ((this.stream._duplexState & WRITE_UPDATE_SYNC_STATUS) === WRITE_PRIMARY) this.update();
    else this.updateNextTick();
  }
  updateNextTick() {
    if ((this.stream._duplexState & WRITE_NEXT_TICK) !== 0) return;
    this.stream._duplexState |= WRITE_NEXT_TICK;
    if ((this.stream._duplexState & WRITE_UPDATING) === 0) queueTick(this.afterUpdateNextTick);
  }
}
class ReadableState {
  constructor(stream, { highWaterMark = 16384, map = null, mapReadable, byteLength: byteLength2, byteLengthReadable } = {}) {
    this.stream = stream;
    this.queue = new FIFO();
    this.highWaterMark = highWaterMark === 0 ? 1 : highWaterMark;
    this.buffered = 0;
    this.readAhead = highWaterMark > 0;
    this.error = null;
    this.pipeline = null;
    this.byteLength = byteLengthReadable || byteLength2 || defaultByteLength;
    this.map = mapReadable || map;
    this.pipeTo = null;
    this.afterRead = afterRead.bind(this);
    this.afterUpdateNextTick = updateReadNT.bind(this);
  }
  get ended() {
    return (this.stream._duplexState & READ_DONE) !== 0;
  }
  pipe(pipeTo, cb) {
    if (this.pipeTo !== null) throw new Error("Can only pipe to one destination");
    if (typeof cb !== "function") cb = null;
    this.stream._duplexState |= READ_PIPE_DRAINED;
    this.pipeTo = pipeTo;
    this.pipeline = new Pipeline(this.stream, pipeTo, cb);
    if (cb) this.stream.on("error", noop$1);
    if (isStreamx(pipeTo)) {
      pipeTo._writableState.pipeline = this.pipeline;
      if (cb) pipeTo.on("error", noop$1);
      pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
    } else {
      const onerror = this.pipeline.done.bind(this.pipeline, pipeTo);
      const onclose = this.pipeline.done.bind(this.pipeline, pipeTo, null);
      pipeTo.on("error", onerror);
      pipeTo.on("close", onclose);
      pipeTo.on("finish", this.pipeline.finished.bind(this.pipeline));
    }
    pipeTo.on("drain", afterDrain.bind(this));
    this.stream.emit("piping", pipeTo);
    pipeTo.emit("pipe", this.stream);
  }
  push(data) {
    const stream = this.stream;
    if (data === null) {
      this.highWaterMark = 0;
      stream._duplexState = (stream._duplexState | READ_ENDING) & READ_NON_PRIMARY_AND_PUSHED;
      return false;
    }
    if (this.map !== null) {
      data = this.map(data);
      if (data === null) return this.buffered < this.highWaterMark;
    }
    this.buffered += this.byteLength(data);
    this.queue.push(data);
    stream._duplexState = (stream._duplexState | READ_QUEUED) & READ_PUSHED;
    return this.buffered < this.highWaterMark;
  }
  shift() {
    const data = this.queue.shift();
    this.buffered -= this.byteLength(data);
    if (this.buffered === 0) this.stream._duplexState &= READ_NOT_QUEUED;
    return data;
  }
  unshift(data) {
    const pending = [this.map !== null ? this.map(data) : data];
    while (this.buffered > 0) pending.push(this.shift());
    for (let i = 0; i < pending.length - 1; i++) {
      const data2 = pending[i];
      this.buffered += this.byteLength(data2);
      this.queue.push(data2);
    }
    this.push(pending[pending.length - 1]);
  }
  read() {
    const stream = this.stream;
    if ((stream._duplexState & READ_STATUS) === READ_QUEUED) {
      const data = this.shift();
      if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream._duplexState &= READ_PIPE_NOT_DRAINED;
      if ((stream._duplexState & READ_EMIT_DATA) !== 0) stream.emit("data", data);
      return data;
    }
    if (this.readAhead === false) {
      stream._duplexState |= READ_READ_AHEAD;
      this.updateNextTick();
    }
    return null;
  }
  drain() {
    const stream = this.stream;
    while ((stream._duplexState & READ_STATUS) === READ_QUEUED && (stream._duplexState & READ_FLOWING) !== 0) {
      const data = this.shift();
      if (this.pipeTo !== null && this.pipeTo.write(data) === false) stream._duplexState &= READ_PIPE_NOT_DRAINED;
      if ((stream._duplexState & READ_EMIT_DATA) !== 0) stream.emit("data", data);
    }
  }
  update() {
    const stream = this.stream;
    stream._duplexState |= READ_UPDATING;
    do {
      this.drain();
      while (this.buffered < this.highWaterMark && (stream._duplexState & SHOULD_NOT_READ) === READ_READ_AHEAD) {
        stream._duplexState |= READ_ACTIVE_AND_NEEDS_PUSH;
        stream._read(this.afterRead);
        this.drain();
      }
      if ((stream._duplexState & READ_READABLE_STATUS) === READ_EMIT_READABLE_AND_QUEUED) {
        stream._duplexState |= READ_EMITTED_READABLE;
        stream.emit("readable");
      }
      if ((stream._duplexState & READ_PRIMARY_AND_ACTIVE) === 0) this.updateNonPrimary();
    } while (this.continueUpdate() === true);
    stream._duplexState &= READ_NOT_UPDATING;
  }
  updateNonPrimary() {
    const stream = this.stream;
    if ((stream._duplexState & READ_ENDING_STATUS) === READ_ENDING) {
      stream._duplexState = (stream._duplexState | READ_DONE) & READ_NOT_ENDING;
      stream.emit("end");
      if ((stream._duplexState & AUTO_DESTROY) === DONE) stream._duplexState |= DESTROYING;
      if (this.pipeTo !== null) this.pipeTo.end();
    }
    if ((stream._duplexState & DESTROY_STATUS) === DESTROYING) {
      if ((stream._duplexState & ACTIVE_OR_TICKING) === 0) {
        stream._duplexState |= ACTIVE;
        stream._destroy(afterDestroy.bind(this));
      }
      return;
    }
    if ((stream._duplexState & IS_OPENING) === OPENING) {
      stream._duplexState = (stream._duplexState | ACTIVE) & NOT_OPENING;
      stream._open(afterOpen.bind(this));
    }
  }
  continueUpdate() {
    if ((this.stream._duplexState & READ_NEXT_TICK) === 0) return false;
    this.stream._duplexState &= READ_NOT_NEXT_TICK;
    return true;
  }
  updateCallback() {
    if ((this.stream._duplexState & READ_UPDATE_SYNC_STATUS) === READ_PRIMARY) this.update();
    else this.updateNextTick();
  }
  updateNextTick() {
    if ((this.stream._duplexState & READ_NEXT_TICK) !== 0) return;
    this.stream._duplexState |= READ_NEXT_TICK;
    if ((this.stream._duplexState & READ_UPDATING) === 0) queueTick(this.afterUpdateNextTick);
  }
}
class TransformState {
  constructor(stream) {
    this.data = null;
    this.afterTransform = afterTransform.bind(stream);
    this.afterFinal = null;
  }
}
class Pipeline {
  constructor(src, dst, cb) {
    this.from = src;
    this.to = dst;
    this.afterPipe = cb;
    this.error = null;
    this.pipeToFinished = false;
  }
  finished() {
    this.pipeToFinished = true;
  }
  done(stream, err) {
    if (err) this.error = err;
    if (stream === this.to) {
      this.to = null;
      if (this.from !== null) {
        if ((this.from._duplexState & READ_DONE) === 0 || !this.pipeToFinished) {
          this.from.destroy(this.error || new Error("Writable stream closed prematurely"));
        }
        return;
      }
    }
    if (stream === this.from) {
      this.from = null;
      if (this.to !== null) {
        if ((stream._duplexState & READ_DONE) === 0) {
          this.to.destroy(this.error || new Error("Readable stream closed before ending"));
        }
        return;
      }
    }
    if (this.afterPipe !== null) this.afterPipe(this.error);
    this.to = this.from = this.afterPipe = null;
  }
}
function afterDrain() {
  this.stream._duplexState |= READ_PIPE_DRAINED;
  this.updateCallback();
}
function afterFinal(err) {
  const stream = this.stream;
  if (err) stream.destroy(err);
  if ((stream._duplexState & DESTROY_STATUS) === 0) {
    stream._duplexState |= WRITE_DONE;
    stream.emit("finish");
  }
  if ((stream._duplexState & AUTO_DESTROY) === DONE) {
    stream._duplexState |= DESTROYING;
  }
  stream._duplexState &= WRITE_NOT_ACTIVE;
  if ((stream._duplexState & WRITE_UPDATING) === 0) this.update();
  else this.updateNextTick();
}
function afterDestroy(err) {
  const stream = this.stream;
  if (!err && this.error !== STREAM_DESTROYED) err = this.error;
  if (err) stream.emit("error", err);
  stream._duplexState |= DESTROYED;
  stream.emit("close");
  const rs = stream._readableState;
  const ws = stream._writableState;
  if (rs !== null && rs.pipeline !== null) rs.pipeline.done(stream, err);
  if (ws !== null) {
    while (ws.drains !== null && ws.drains.length > 0) ws.drains.shift().resolve(false);
    if (ws.pipeline !== null) ws.pipeline.done(stream, err);
  }
}
function afterWrite(err) {
  const stream = this.stream;
  if (err) stream.destroy(err);
  stream._duplexState &= WRITE_NOT_ACTIVE;
  if (this.drains !== null) tickDrains(this.drains);
  if ((stream._duplexState & WRITE_DRAIN_STATUS) === WRITE_UNDRAINED) {
    stream._duplexState &= WRITE_DRAINED;
    if ((stream._duplexState & WRITE_EMIT_DRAIN) === WRITE_EMIT_DRAIN) {
      stream.emit("drain");
    }
  }
  this.updateCallback();
}
function afterRead(err) {
  if (err) this.stream.destroy(err);
  this.stream._duplexState &= READ_NOT_ACTIVE;
  if (this.readAhead === false && (this.stream._duplexState & READ_RESUMED) === 0) this.stream._duplexState &= READ_NO_READ_AHEAD;
  this.updateCallback();
}
function updateReadNT() {
  if ((this.stream._duplexState & READ_UPDATING) === 0) {
    this.stream._duplexState &= READ_NOT_NEXT_TICK;
    this.update();
  }
}
function updateWriteNT() {
  if ((this.stream._duplexState & WRITE_UPDATING) === 0) {
    this.stream._duplexState &= WRITE_NOT_NEXT_TICK;
    this.update();
  }
}
function tickDrains(drains) {
  for (let i = 0; i < drains.length; i++) {
    if (--drains[i].writes === 0) {
      drains.shift().resolve(true);
      i--;
    }
  }
}
function afterOpen(err) {
  const stream = this.stream;
  if (err) stream.destroy(err);
  if ((stream._duplexState & DESTROYING) === 0) {
    if ((stream._duplexState & READ_PRIMARY_STATUS) === 0) stream._duplexState |= READ_PRIMARY;
    if ((stream._duplexState & WRITE_PRIMARY_STATUS) === 0) stream._duplexState |= WRITE_PRIMARY;
    stream.emit("open");
  }
  stream._duplexState &= NOT_ACTIVE;
  if (stream._writableState !== null) {
    stream._writableState.updateCallback();
  }
  if (stream._readableState !== null) {
    stream._readableState.updateCallback();
  }
}
function afterTransform(err, data) {
  if (data !== void 0 && data !== null) this.push(data);
  this._writableState.afterWrite(err);
}
function newListener(name) {
  if (this._readableState !== null) {
    if (name === "data") {
      this._duplexState |= READ_EMIT_DATA | READ_RESUMED_READ_AHEAD;
      this._readableState.updateNextTick();
    }
    if (name === "readable") {
      this._duplexState |= READ_EMIT_READABLE;
      this._readableState.updateNextTick();
    }
  }
  if (this._writableState !== null) {
    if (name === "drain") {
      this._duplexState |= WRITE_EMIT_DRAIN;
      this._writableState.updateNextTick();
    }
  }
}
class Stream extends EventEmitter {
  constructor(opts) {
    super();
    this._duplexState = 0;
    this._readableState = null;
    this._writableState = null;
    if (opts) {
      if (opts.open) this._open = opts.open;
      if (opts.destroy) this._destroy = opts.destroy;
      if (opts.predestroy) this._predestroy = opts.predestroy;
      if (opts.signal) {
        opts.signal.addEventListener("abort", abort.bind(this));
      }
    }
    this.on("newListener", newListener);
  }
  _open(cb) {
    cb(null);
  }
  _destroy(cb) {
    cb(null);
  }
  _predestroy() {
  }
  get readable() {
    return this._readableState !== null ? true : void 0;
  }
  get writable() {
    return this._writableState !== null ? true : void 0;
  }
  get destroyed() {
    return (this._duplexState & DESTROYED) !== 0;
  }
  get destroying() {
    return (this._duplexState & DESTROY_STATUS) !== 0;
  }
  destroy(err) {
    if ((this._duplexState & DESTROY_STATUS) === 0) {
      if (!err) err = STREAM_DESTROYED;
      this._duplexState = (this._duplexState | DESTROYING) & NON_PRIMARY;
      if (this._readableState !== null) {
        this._readableState.highWaterMark = 0;
        this._readableState.error = err;
      }
      if (this._writableState !== null) {
        this._writableState.highWaterMark = 0;
        this._writableState.error = err;
      }
      this._duplexState |= PREDESTROYING;
      this._predestroy();
      this._duplexState &= NOT_PREDESTROYING;
      if (this._readableState !== null) this._readableState.updateNextTick();
      if (this._writableState !== null) this._writableState.updateNextTick();
    }
  }
}
class Readable extends Stream {
  constructor(opts) {
    super(opts);
    this._duplexState |= OPENING | WRITE_DONE | READ_READ_AHEAD;
    this._readableState = new ReadableState(this, opts);
    if (opts) {
      if (this._readableState.readAhead === false) this._duplexState &= READ_NO_READ_AHEAD;
      if (opts.read) this._read = opts.read;
      if (opts.eagerOpen) this._readableState.updateNextTick();
      if (opts.encoding) this.setEncoding(opts.encoding);
    }
  }
  setEncoding(encoding) {
    const dec = new TextDecoder$1(encoding);
    const map = this._readableState.map || echo;
    this._readableState.map = mapOrSkip;
    return this;
    function mapOrSkip(data) {
      const next = dec.push(data);
      return next === "" ? null : map(next);
    }
  }
  _read(cb) {
    cb(null);
  }
  pipe(dest, cb) {
    this._readableState.updateNextTick();
    this._readableState.pipe(dest, cb);
    return dest;
  }
  read() {
    this._readableState.updateNextTick();
    return this._readableState.read();
  }
  push(data) {
    this._readableState.updateNextTick();
    return this._readableState.push(data);
  }
  unshift(data) {
    this._readableState.updateNextTick();
    return this._readableState.unshift(data);
  }
  resume() {
    this._duplexState |= READ_RESUMED_READ_AHEAD;
    this._readableState.updateNextTick();
    return this;
  }
  pause() {
    this._duplexState &= this._readableState.readAhead === false ? READ_PAUSED_NO_READ_AHEAD : READ_PAUSED;
    return this;
  }
  static _fromAsyncIterator(ite, opts) {
    let destroy;
    const rs = new Readable({
      ...opts,
      read(cb) {
        ite.next().then(push).then(cb.bind(null, null)).catch(cb);
      },
      predestroy() {
        destroy = ite.return();
      },
      destroy(cb) {
        if (!destroy) return cb(null);
        destroy.then(cb.bind(null, null)).catch(cb);
      }
    });
    return rs;
    function push(data) {
      if (data.done) rs.push(null);
      else rs.push(data.value);
    }
  }
  static from(data, opts) {
    if (isReadStreamx(data)) return data;
    if (data[asyncIterator]) return this._fromAsyncIterator(data[asyncIterator](), opts);
    if (!Array.isArray(data)) data = data === void 0 ? [] : [data];
    let i = 0;
    return new Readable({
      ...opts,
      read(cb) {
        this.push(i === data.length ? null : data[i++]);
        cb(null);
      }
    });
  }
  static isBackpressured(rs) {
    return (rs._duplexState & READ_BACKPRESSURE_STATUS) !== 0 || rs._readableState.buffered >= rs._readableState.highWaterMark;
  }
  static isPaused(rs) {
    return (rs._duplexState & READ_RESUMED) === 0;
  }
  [asyncIterator]() {
    const stream = this;
    let error = null;
    let promiseResolve = null;
    let promiseReject = null;
    this.on("error", (err) => {
      error = err;
    });
    this.on("readable", onreadable);
    this.on("close", onclose);
    return {
      [asyncIterator]() {
        return this;
      },
      next() {
        return new Promise(function(resolve, reject) {
          promiseResolve = resolve;
          promiseReject = reject;
          const data = stream.read();
          if (data !== null) ondata(data);
          else if ((stream._duplexState & DESTROYED) !== 0) ondata(null);
        });
      },
      return() {
        return destroy(null);
      },
      throw(err) {
        return destroy(err);
      }
    };
    function onreadable() {
      if (promiseResolve !== null) ondata(stream.read());
    }
    function onclose() {
      if (promiseResolve !== null) ondata(null);
    }
    function ondata(data) {
      if (promiseReject === null) return;
      if (error) promiseReject(error);
      else if (data === null && (stream._duplexState & READ_DONE) === 0) promiseReject(STREAM_DESTROYED);
      else promiseResolve({ value: data, done: data === null });
      promiseReject = promiseResolve = null;
    }
    function destroy(err) {
      stream.destroy(err);
      return new Promise((resolve, reject) => {
        if (stream._duplexState & DESTROYED) return resolve({ value: void 0, done: true });
        stream.once("close", function() {
          if (err) reject(err);
          else resolve({ value: void 0, done: true });
        });
      });
    }
  }
}
class Writable extends Stream {
  constructor(opts) {
    super(opts);
    this._duplexState |= OPENING | READ_DONE;
    this._writableState = new WritableState(this, opts);
    if (opts) {
      if (opts.writev) this._writev = opts.writev;
      if (opts.write) this._write = opts.write;
      if (opts.final) this._final = opts.final;
      if (opts.eagerOpen) this._writableState.updateNextTick();
    }
  }
  cork() {
    this._duplexState |= WRITE_CORKED;
  }
  uncork() {
    this._duplexState &= WRITE_NOT_CORKED;
    this._writableState.updateNextTick();
  }
  _writev(batch, cb) {
    cb(null);
  }
  _write(data, cb) {
    this._writableState.autoBatch(data, cb);
  }
  _final(cb) {
    cb(null);
  }
  static isBackpressured(ws) {
    return (ws._duplexState & WRITE_BACKPRESSURE_STATUS) !== 0;
  }
  static drained(ws) {
    if (ws.destroyed) return Promise.resolve(false);
    const state = ws._writableState;
    const pending = isWritev(ws) ? Math.min(1, state.queue.length) : state.queue.length;
    const writes = pending + (ws._duplexState & WRITE_WRITING ? 1 : 0);
    if (writes === 0) return Promise.resolve(true);
    if (state.drains === null) state.drains = [];
    return new Promise((resolve) => {
      state.drains.push({ writes, resolve });
    });
  }
  write(data) {
    this._writableState.updateNextTick();
    return this._writableState.push(data);
  }
  end(data) {
    this._writableState.updateNextTick();
    this._writableState.end(data);
    return this;
  }
}
class Duplex extends Readable {
  // and Writable
  constructor(opts) {
    super(opts);
    this._duplexState = OPENING | this._duplexState & READ_READ_AHEAD;
    this._writableState = new WritableState(this, opts);
    if (opts) {
      if (opts.writev) this._writev = opts.writev;
      if (opts.write) this._write = opts.write;
      if (opts.final) this._final = opts.final;
    }
  }
  cork() {
    this._duplexState |= WRITE_CORKED;
  }
  uncork() {
    this._duplexState &= WRITE_NOT_CORKED;
    this._writableState.updateNextTick();
  }
  _writev(batch, cb) {
    cb(null);
  }
  _write(data, cb) {
    this._writableState.autoBatch(data, cb);
  }
  _final(cb) {
    cb(null);
  }
  write(data) {
    this._writableState.updateNextTick();
    return this._writableState.push(data);
  }
  end(data) {
    this._writableState.updateNextTick();
    this._writableState.end(data);
    return this;
  }
}
class Transform extends Duplex {
  constructor(opts) {
    super(opts);
    this._transformState = new TransformState(this);
    if (opts) {
      if (opts.transform) this._transform = opts.transform;
      if (opts.flush) this._flush = opts.flush;
    }
  }
  _write(data, cb) {
    if (this._readableState.buffered >= this._readableState.highWaterMark) {
      this._transformState.data = data;
    } else {
      this._transform(data, this._transformState.afterTransform);
    }
  }
  _read(cb) {
    if (this._transformState.data !== null) {
      const data = this._transformState.data;
      this._transformState.data = null;
      cb(null);
      this._transform(data, this._transformState.afterTransform);
    } else {
      cb(null);
    }
  }
  destroy(err) {
    super.destroy(err);
    if (this._transformState.data !== null) {
      this._transformState.data = null;
      this._transformState.afterTransform();
    }
  }
  _transform(data, cb) {
    cb(null, data);
  }
  _flush(cb) {
    cb(null);
  }
  _final(cb) {
    this._transformState.afterFinal = cb;
    this._flush(transformAfterFlush.bind(this));
  }
}
class PassThrough extends Transform {
}
function transformAfterFlush(err, data) {
  const cb = this._transformState.afterFinal;
  if (err) return cb(err);
  if (data !== null && data !== void 0) this.push(data);
  this.push(null);
  cb(null);
}
function pipelinePromise(...streams) {
  return new Promise((resolve, reject) => {
    return pipeline(...streams, (err) => {
      if (err) return reject(err);
      resolve();
    });
  });
}
function pipeline(stream, ...streams) {
  const all = Array.isArray(stream) ? [...stream, ...streams] : [stream, ...streams];
  const done = all.length && typeof all[all.length - 1] === "function" ? all.pop() : null;
  if (all.length < 2) throw new Error("Pipeline requires at least 2 streams");
  let src = all[0];
  let dest = null;
  let error = null;
  for (let i = 1; i < all.length; i++) {
    dest = all[i];
    if (isStreamx(src)) {
      src.pipe(dest, onerror);
    } else {
      errorHandle(src, true, i > 1, onerror);
      src.pipe(dest);
    }
    src = dest;
  }
  if (done) {
    let fin = false;
    const autoDestroy = isStreamx(dest) || !!(dest._writableState && dest._writableState.autoDestroy);
    dest.on("error", (err) => {
      if (error === null) error = err;
    });
    dest.on("finish", () => {
      fin = true;
      if (!autoDestroy) done(error);
    });
    if (autoDestroy) {
      dest.on("close", () => done(error || (fin ? null : PREMATURE_CLOSE)));
    }
  }
  return dest;
  function errorHandle(s, rd, wr, onerror2) {
    s.on("error", onerror2);
    s.on("close", onclose);
    function onclose() {
      if (s._readableState && !s._readableState.ended) return onerror2(PREMATURE_CLOSE);
      if (wr && s._writableState && !s._writableState.ended) return onerror2(PREMATURE_CLOSE);
    }
  }
  function onerror(err) {
    if (!err || error) return;
    error = err;
    for (const s of all) {
      s.destroy(err);
    }
  }
}
function echo(s) {
  return s;
}
function isStream(stream) {
  return !!stream._readableState || !!stream._writableState;
}
function isStreamx(stream) {
  return typeof stream._duplexState === "number" && isStream(stream);
}
function getStreamError(stream) {
  const err = stream._readableState && stream._readableState.error || stream._writableState && stream._writableState.error;
  return err === STREAM_DESTROYED ? null : err;
}
function isReadStreamx(stream) {
  return isStreamx(stream) && stream.readable;
}
function isTypedArray(data) {
  return typeof data === "object" && data !== null && typeof data.byteLength === "number";
}
function defaultByteLength(data) {
  return isTypedArray(data) ? data.byteLength : 1024;
}
function noop$1() {
}
function abort() {
  this.destroy(new Error("Stream aborted."));
}
function isWritev(s) {
  return s._writev !== Writable.prototype._writev && s._writev !== Duplex.prototype._writev;
}
var streamx = {
  pipeline,
  pipelinePromise,
  isStream,
  isStreamx,
  getStreamError,
  Stream,
  Writable,
  Readable,
  Duplex,
  Transform,
  // Export PassThrough for compatibility with Node.js core's stream module
  PassThrough
};
function assign(obj, props) {
  for (const key in props) {
    Object.defineProperty(obj, key, {
      value: props[key],
      enumerable: true,
      configurable: true
    });
  }
  return obj;
}
function createError(err, code, props) {
  if (!err || typeof err === "string") {
    throw new TypeError("Please pass an Error to err-code");
  }
  if (!props) {
    props = {};
  }
  if (typeof code === "object") {
    props = code;
    code = "";
  }
  if (code) {
    props.code = code;
  }
  try {
    return assign(err, props);
  } catch (_) {
    props.message = err.message;
    props.stack = err.stack;
    const ErrClass = function() {
    };
    ErrClass.prototype = Object.create(Object.getPrototypeOf(err));
    const output = assign(new ErrClass(), props);
    return output;
  }
}
var errCode = createError;
const errCode$1 = /* @__PURE__ */ getDefaultExportFromCjs(errCode);
/* Common package for dealing with hex/string/uint8 conversions (and sha1 hashing)
*
* @author   Jimmy Wärting <jimmy@warting.se> (https://jimmy.warting.se/opensource)
* @license  MIT
*/
const alphabet = "0123456789abcdef";
const encodeLookup = [];
const decodeLookup = [];
for (let i = 0; i < 256; i++) {
  encodeLookup[i] = alphabet[i >> 4 & 15] + alphabet[i & 15];
  if (i < 16) {
    if (i < 10) {
      decodeLookup[48 + i] = i;
    } else {
      decodeLookup[97 - 10 + i] = i;
    }
  }
}
const arr2hex = (data) => {
  const length = data.length;
  let string = "";
  let i = 0;
  while (i < length) {
    string += encodeLookup[data[i++]];
  }
  return string;
};
const hex2arr = (str) => {
  const sizeof = str.length >> 1;
  const length = sizeof << 1;
  const array = new Uint8Array(sizeof);
  let n = 0;
  let i = 0;
  while (i < length) {
    array[n++] = decodeLookup[str.charCodeAt(i++)] << 4 | decodeLookup[str.charCodeAt(i++)];
  }
  return array;
};
var chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
var lookup = typeof Uint8Array === "undefined" ? [] : new Uint8Array(256);
for (var i = 0; i < chars.length; i++) {
  lookup[chars.charCodeAt(i)] = i;
}
const decoder = new TextDecoder();
const arr2text = (data, enc) => {
  return decoder.decode(data);
};
const encoder = new TextEncoder();
const text2arr = (str) => encoder.encode(str);
const bin2hex = (str) => {
  let res = "";
  let c;
  let i = 0;
  const len = str.length;
  while (i < len) {
    c = str.charCodeAt(i++);
    res += alphabet[c >> 4] + alphabet[c & 15];
  }
  return res;
};
const MAX_ARGUMENTS_LENGTH = 65536;
const hex2bin = (hex2) => {
  const points = hex2arr(hex2);
  if (points.length <= MAX_ARGUMENTS_LENGTH) return String.fromCharCode(...points);
  let res = "";
  let i = 0;
  while (i < points.length) {
    res += String.fromCharCode(...points.subarray(i, i += MAX_ARGUMENTS_LENGTH));
  }
  return res;
};
const scope = typeof window !== "undefined" ? window : self;
const crypto = scope.crypto || scope.msCrypto || {};
crypto.subtle || crypto.webkitSubtle;
const randomBytes = (size) => {
  const view = new Uint8Array(size);
  return crypto.getRandomValues(view);
};
/*! simple-peer. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
const Debug = debug$3("simple-peer");
const MAX_BUFFERED_AMOUNT$1 = 64 * 1024;
const ICECOMPLETE_TIMEOUT = 5 * 1e3;
const CHANNEL_CLOSING_TIMEOUT = 5 * 1e3;
function filterTrickle(sdp) {
  return sdp.replace(/a=ice-options:trickle\s\n/g, "");
}
function warn(message) {
  console.warn(message);
}
let Peer$1 = class Peer extends streamx.Duplex {
  constructor(opts) {
    opts = Object.assign({
      allowHalfOpen: false
    }, opts);
    super(opts);
    /** @type {RTCPeerConnection} */
    __publicField(this, "_pc");
    this.__objectMode = !!opts.objectMode;
    this._id = arr2hex(randomBytes(4)).slice(0, 7);
    this._debug("new peer %o", opts);
    this.channelName = opts.initiator ? opts.channelName || arr2hex(randomBytes(20)) : null;
    this.initiator = opts.initiator || false;
    this.channelConfig = opts.channelConfig || Peer.channelConfig;
    this.channelNegotiated = this.channelConfig.negotiated;
    this.config = Object.assign({}, Peer.config, opts.config);
    this.offerOptions = opts.offerOptions || {};
    this.answerOptions = opts.answerOptions || {};
    this.sdpTransform = opts.sdpTransform || ((sdp) => sdp);
    this.trickle = opts.trickle !== void 0 ? opts.trickle : true;
    this.allowHalfTrickle = opts.allowHalfTrickle !== void 0 ? opts.allowHalfTrickle : false;
    this.iceCompleteTimeout = opts.iceCompleteTimeout || ICECOMPLETE_TIMEOUT;
    this._destroying = false;
    this._connected = false;
    this.remoteAddress = void 0;
    this.remoteFamily = void 0;
    this.remotePort = void 0;
    this.localAddress = void 0;
    this.localFamily = void 0;
    this.localPort = void 0;
    if (!RTCPeerConnection) {
      if (typeof window === "undefined") {
        throw errCode$1(new Error("No WebRTC support: Specify `opts.wrtc` option in this environment"), "ERR_WEBRTC_SUPPORT");
      } else {
        throw errCode$1(new Error("No WebRTC support: Not a supported browser"), "ERR_WEBRTC_SUPPORT");
      }
    }
    this._pcReady = false;
    this._channelReady = false;
    this._iceComplete = false;
    this._iceCompleteTimer = null;
    this._channel = null;
    this._pendingCandidates = [];
    this._isNegotiating = false;
    this._firstNegotiation = true;
    this._batchedNegotiation = false;
    this._queuedNegotiation = false;
    this._sendersAwaitingStable = [];
    this._closingInterval = null;
    this._remoteTracks = [];
    this._remoteStreams = [];
    this._chunk = null;
    this._cb = null;
    this._interval = null;
    try {
      this._pc = new RTCPeerConnection(this.config);
    } catch (err) {
      this.__destroy(errCode$1(err, "ERR_PC_CONSTRUCTOR"));
      return;
    }
    this._isReactNativeWebrtc = typeof this._pc._peerConnectionId === "number";
    this._pc.oniceconnectionstatechange = () => {
      this._onIceStateChange();
    };
    this._pc.onicegatheringstatechange = () => {
      this._onIceStateChange();
    };
    this._pc.onconnectionstatechange = () => {
      this._onConnectionStateChange();
    };
    this._pc.onsignalingstatechange = () => {
      this._onSignalingStateChange();
    };
    this._pc.onicecandidate = (event) => {
      this._onIceCandidate(event);
    };
    if (typeof this._pc.peerIdentity === "object") {
      this._pc.peerIdentity.catch((err) => {
        this.__destroy(errCode$1(err, "ERR_PC_PEER_IDENTITY"));
      });
    }
    if (this.initiator || this.channelNegotiated) {
      this._setupData({
        channel: this._pc.createDataChannel(this.channelName, this.channelConfig)
      });
    } else {
      this._pc.ondatachannel = (event) => {
        this._setupData(event);
      };
    }
    this._debug("initial negotiation");
    this._needsNegotiation();
    this._onFinishBound = () => {
      this._onFinish();
    };
    this.once("finish", this._onFinishBound);
  }
  get bufferSize() {
    return this._channel && this._channel.bufferedAmount || 0;
  }
  // HACK: it's possible channel.readyState is "closing" before peer.destroy() fires
  // https://bugs.chromium.org/p/chromium/issues/detail?id=882743
  get connected() {
    return this._connected && this._channel.readyState === "open";
  }
  address() {
    return { port: this.localPort, family: this.localFamily, address: this.localAddress };
  }
  signal(data) {
    if (this._destroying) return;
    if (this.destroyed) throw errCode$1(new Error("cannot signal after peer is destroyed"), "ERR_DESTROYED");
    if (typeof data === "string") {
      try {
        data = JSON.parse(data);
      } catch (err) {
        data = {};
      }
    }
    this._debug("signal()");
    if (data.renegotiate && this.initiator) {
      this._debug("got request to renegotiate");
      this._needsNegotiation();
    }
    if (data.transceiverRequest && this.initiator) {
      this._debug("got request for transceiver");
      this.addTransceiver(data.transceiverRequest.kind, data.transceiverRequest.init);
    }
    if (data.candidate) {
      if (this._pc.remoteDescription && this._pc.remoteDescription.type) {
        this._addIceCandidate(data.candidate);
      } else {
        this._pendingCandidates.push(data.candidate);
      }
    }
    if (data.sdp) {
      this._pc.setRemoteDescription(new RTCSessionDescription(data)).then(() => {
        if (this.destroyed) return;
        this._pendingCandidates.forEach((candidate) => {
          this._addIceCandidate(candidate);
        });
        this._pendingCandidates = [];
        if (this._pc.remoteDescription.type === "offer") this._createAnswer();
      }).catch((err) => {
        this.__destroy(errCode$1(err, "ERR_SET_REMOTE_DESCRIPTION"));
      });
    }
    if (!data.sdp && !data.candidate && !data.renegotiate && !data.transceiverRequest) {
      this.__destroy(errCode$1(new Error("signal() called with invalid signal data"), "ERR_SIGNALING"));
    }
  }
  _addIceCandidate(candidate) {
    const iceCandidateObj = new RTCIceCandidate(candidate);
    this._pc.addIceCandidate(iceCandidateObj).catch((err) => {
      if (!iceCandidateObj.address || iceCandidateObj.address.endsWith(".local")) {
        warn("Ignoring unsupported ICE candidate.");
      } else {
        this.__destroy(errCode$1(err, "ERR_ADD_ICE_CANDIDATE"));
      }
    });
  }
  /**
   * Send text/binary data to the remote peer.
   * @param {ArrayBufferView|ArrayBuffer|Uint8Array|string|Blob} chunk
   */
  send(chunk) {
    if (this._destroying) return;
    if (this.destroyed) throw errCode$1(new Error("cannot send after peer is destroyed"), "ERR_DESTROYED");
    this._channel.send(chunk);
  }
  _needsNegotiation() {
    this._debug("_needsNegotiation");
    if (this._batchedNegotiation) return;
    this._batchedNegotiation = true;
    queueMicrotask(() => {
      this._batchedNegotiation = false;
      if (this.initiator || !this._firstNegotiation) {
        this._debug("starting batched negotiation");
        this.negotiate();
      } else {
        this._debug("non-initiator initial negotiation request discarded");
      }
      this._firstNegotiation = false;
    });
  }
  negotiate() {
    if (this._destroying) return;
    if (this.destroyed) throw errCode$1(new Error("cannot negotiate after peer is destroyed"), "ERR_DESTROYED");
    if (this.initiator) {
      if (this._isNegotiating) {
        this._queuedNegotiation = true;
        this._debug("already negotiating, queueing");
      } else {
        this._debug("start negotiation");
        setTimeout(() => {
          this._createOffer();
        }, 0);
      }
    } else {
      if (this._isNegotiating) {
        this._queuedNegotiation = true;
        this._debug("already negotiating, queueing");
      } else {
        this._debug("requesting negotiation from initiator");
        this.emit("signal", {
          // request initiator to renegotiate
          type: "renegotiate",
          renegotiate: true
        });
      }
    }
    this._isNegotiating = true;
  }
  _final(cb) {
    if (!this._readableState.ended) this.push(null);
    cb(null);
  }
  __destroy(err) {
    this.end();
    this._destroy(() => {
    }, err);
  }
  _destroy(cb, err) {
    if (this.destroyed || this._destroying) return;
    this._destroying = true;
    this._debug("destroying (error: %s)", err && (err.message || err));
    setTimeout(() => {
      this._connected = false;
      this._pcReady = false;
      this._channelReady = false;
      this._remoteTracks = null;
      this._remoteStreams = null;
      this._senderMap = null;
      clearInterval(this._closingInterval);
      this._closingInterval = null;
      clearInterval(this._interval);
      this._interval = null;
      this._chunk = null;
      this._cb = null;
      if (this._onFinishBound) this.removeListener("finish", this._onFinishBound);
      this._onFinishBound = null;
      if (this._channel) {
        try {
          this._channel.close();
        } catch (err2) {
        }
        this._channel.onmessage = null;
        this._channel.onopen = null;
        this._channel.onclose = null;
        this._channel.onerror = null;
      }
      if (this._pc) {
        try {
          this._pc.close();
        } catch (err2) {
        }
        this._pc.oniceconnectionstatechange = null;
        this._pc.onicegatheringstatechange = null;
        this._pc.onsignalingstatechange = null;
        this._pc.onicecandidate = null;
        this._pc.ontrack = null;
        this._pc.ondatachannel = null;
      }
      this._pc = null;
      this._channel = null;
      if (err) this.emit("error", err);
      cb();
    }, 0);
  }
  _setupData(event) {
    if (!event.channel) {
      return this.__destroy(errCode$1(new Error("Data channel event is missing `channel` property"), "ERR_DATA_CHANNEL"));
    }
    this._channel = event.channel;
    this._channel.binaryType = "arraybuffer";
    if (typeof this._channel.bufferedAmountLowThreshold === "number") {
      this._channel.bufferedAmountLowThreshold = MAX_BUFFERED_AMOUNT$1;
    }
    this.channelName = this._channel.label;
    this._channel.onmessage = (event2) => {
      this._onChannelMessage(event2);
    };
    this._channel.onbufferedamountlow = () => {
      this._onChannelBufferedAmountLow();
    };
    this._channel.onopen = () => {
      this._onChannelOpen();
    };
    this._channel.onclose = () => {
      this._onChannelClose();
    };
    this._channel.onerror = (event2) => {
      const err = event2.error instanceof Error ? event2.error : new Error(`Datachannel error: ${event2.message} ${event2.filename}:${event2.lineno}:${event2.colno}`);
      this.__destroy(errCode$1(err, "ERR_DATA_CHANNEL"));
    };
    let isClosing = false;
    this._closingInterval = setInterval(() => {
      if (this._channel && this._channel.readyState === "closing") {
        if (isClosing) this._onChannelClose();
        isClosing = true;
      } else {
        isClosing = false;
      }
    }, CHANNEL_CLOSING_TIMEOUT);
  }
  _write(chunk, cb) {
    if (this.destroyed) return cb(errCode$1(new Error("cannot write after peer is destroyed"), "ERR_DATA_CHANNEL"));
    if (this._connected) {
      try {
        this.send(chunk);
      } catch (err) {
        return this.__destroy(errCode$1(err, "ERR_DATA_CHANNEL"));
      }
      if (this._channel.bufferedAmount > MAX_BUFFERED_AMOUNT$1) {
        this._debug("start backpressure: bufferedAmount %d", this._channel.bufferedAmount);
        this._cb = cb;
      } else {
        cb(null);
      }
    } else {
      this._debug("write before connect");
      this._chunk = chunk;
      this._cb = cb;
    }
  }
  // When stream finishes writing, close socket. Half open connections are not
  // supported.
  _onFinish() {
    if (this.destroyed) return;
    const destroySoon = () => {
      setTimeout(() => this.__destroy(), 1e3);
    };
    if (this._connected) {
      destroySoon();
    } else {
      this.once("connect", destroySoon);
    }
  }
  _startIceCompleteTimeout() {
    if (this.destroyed) return;
    if (this._iceCompleteTimer) return;
    this._debug("started iceComplete timeout");
    this._iceCompleteTimer = setTimeout(() => {
      if (!this._iceComplete) {
        this._iceComplete = true;
        this._debug("iceComplete timeout completed");
        this.emit("iceTimeout");
        this.emit("_iceComplete");
      }
    }, this.iceCompleteTimeout);
  }
  _createOffer() {
    if (this.destroyed) return;
    this._pc.createOffer(this.offerOptions).then((offer) => {
      if (this.destroyed) return;
      if (!this.trickle && !this.allowHalfTrickle) offer.sdp = filterTrickle(offer.sdp);
      offer.sdp = this.sdpTransform(offer.sdp);
      const sendOffer = () => {
        if (this.destroyed) return;
        const signal = this._pc.localDescription || offer;
        this._debug("signal");
        this.emit("signal", {
          type: signal.type,
          sdp: signal.sdp
        });
      };
      const onSuccess = () => {
        this._debug("createOffer success");
        if (this.destroyed) return;
        if (this.trickle || this._iceComplete) sendOffer();
        else this.once("_iceComplete", sendOffer);
      };
      const onError = (err) => {
        this.__destroy(errCode$1(err, "ERR_SET_LOCAL_DESCRIPTION"));
      };
      this._pc.setLocalDescription(offer).then(onSuccess).catch(onError);
    }).catch((err) => {
      this.__destroy(errCode$1(err, "ERR_CREATE_OFFER"));
    });
  }
  _createAnswer() {
    if (this.destroyed) return;
    this._pc.createAnswer(this.answerOptions).then((answer) => {
      if (this.destroyed) return;
      if (!this.trickle && !this.allowHalfTrickle) answer.sdp = filterTrickle(answer.sdp);
      answer.sdp = this.sdpTransform(answer.sdp);
      const sendAnswer = () => {
        var _a;
        if (this.destroyed) return;
        const signal = this._pc.localDescription || answer;
        this._debug("signal");
        this.emit("signal", {
          type: signal.type,
          sdp: signal.sdp
        });
        if (!this.initiator) (_a = this._requestMissingTransceivers) == null ? void 0 : _a.call(this);
      };
      const onSuccess = () => {
        if (this.destroyed) return;
        if (this.trickle || this._iceComplete) sendAnswer();
        else this.once("_iceComplete", sendAnswer);
      };
      const onError = (err) => {
        this.__destroy(errCode$1(err, "ERR_SET_LOCAL_DESCRIPTION"));
      };
      this._pc.setLocalDescription(answer).then(onSuccess).catch(onError);
    }).catch((err) => {
      this.__destroy(errCode$1(err, "ERR_CREATE_ANSWER"));
    });
  }
  _onConnectionStateChange() {
    if (this.destroyed || this._destroying) return;
    if (this._pc.connectionState === "failed") {
      this.__destroy(errCode$1(new Error("Connection failed."), "ERR_CONNECTION_FAILURE"));
    }
  }
  _onIceStateChange() {
    if (this.destroyed) return;
    const iceConnectionState = this._pc.iceConnectionState;
    const iceGatheringState = this._pc.iceGatheringState;
    this._debug(
      "iceStateChange (connection: %s) (gathering: %s)",
      iceConnectionState,
      iceGatheringState
    );
    this.emit("iceStateChange", iceConnectionState, iceGatheringState);
    if (iceConnectionState === "connected" || iceConnectionState === "completed") {
      this._pcReady = true;
      this._maybeReady();
    }
    if (iceConnectionState === "failed") {
      this.__destroy(errCode$1(new Error("Ice connection failed."), "ERR_ICE_CONNECTION_FAILURE"));
    }
    if (iceConnectionState === "closed") {
      this.__destroy(errCode$1(new Error("Ice connection closed."), "ERR_ICE_CONNECTION_CLOSED"));
    }
  }
  getStats(cb) {
    const flattenValues = (report) => {
      if (Object.prototype.toString.call(report.values) === "[object Array]") {
        report.values.forEach((value) => {
          Object.assign(report, value);
        });
      }
      return report;
    };
    if (this._pc.getStats.length === 0 || this._isReactNativeWebrtc) {
      this._pc.getStats().then((res) => {
        const reports = [];
        res.forEach((report) => {
          reports.push(flattenValues(report));
        });
        cb(null, reports);
      }, (err) => cb(err));
    } else if (this._pc.getStats.length > 0) {
      this._pc.getStats((res) => {
        if (this.destroyed) return;
        const reports = [];
        res.result().forEach((result) => {
          const report = {};
          result.names().forEach((name) => {
            report[name] = result.stat(name);
          });
          report.id = result.id;
          report.type = result.type;
          report.timestamp = result.timestamp;
          reports.push(flattenValues(report));
        });
        cb(null, reports);
      }, (err) => cb(err));
    } else {
      cb(null, []);
    }
  }
  _maybeReady() {
    this._debug("maybeReady pc %s channel %s", this._pcReady, this._channelReady);
    if (this._connected || this._connecting || !this._pcReady || !this._channelReady) return;
    this._connecting = true;
    const findCandidatePair = () => {
      if (this.destroyed || this._destroying) return;
      this.getStats((err, items) => {
        if (this.destroyed || this._destroying) return;
        if (err) items = [];
        const remoteCandidates = {};
        const localCandidates = {};
        const candidatePairs = {};
        let foundSelectedCandidatePair = false;
        items.forEach((item) => {
          if (item.type === "remotecandidate" || item.type === "remote-candidate") {
            remoteCandidates[item.id] = item;
          }
          if (item.type === "localcandidate" || item.type === "local-candidate") {
            localCandidates[item.id] = item;
          }
          if (item.type === "candidatepair" || item.type === "candidate-pair") {
            candidatePairs[item.id] = item;
          }
        });
        const setSelectedCandidatePair = (selectedCandidatePair) => {
          foundSelectedCandidatePair = true;
          let local = localCandidates[selectedCandidatePair.localCandidateId];
          if (local && (local.ip || local.address)) {
            this.localAddress = local.ip || local.address;
            this.localPort = Number(local.port);
          } else if (local && local.ipAddress) {
            this.localAddress = local.ipAddress;
            this.localPort = Number(local.portNumber);
          } else if (typeof selectedCandidatePair.googLocalAddress === "string") {
            local = selectedCandidatePair.googLocalAddress.split(":");
            this.localAddress = local[0];
            this.localPort = Number(local[1]);
          }
          if (this.localAddress) {
            this.localFamily = this.localAddress.includes(":") ? "IPv6" : "IPv4";
          }
          let remote = remoteCandidates[selectedCandidatePair.remoteCandidateId];
          if (remote && (remote.ip || remote.address)) {
            this.remoteAddress = remote.ip || remote.address;
            this.remotePort = Number(remote.port);
          } else if (remote && remote.ipAddress) {
            this.remoteAddress = remote.ipAddress;
            this.remotePort = Number(remote.portNumber);
          } else if (typeof selectedCandidatePair.googRemoteAddress === "string") {
            remote = selectedCandidatePair.googRemoteAddress.split(":");
            this.remoteAddress = remote[0];
            this.remotePort = Number(remote[1]);
          }
          if (this.remoteAddress) {
            this.remoteFamily = this.remoteAddress.includes(":") ? "IPv6" : "IPv4";
          }
          this._debug(
            "connect local: %s:%s remote: %s:%s",
            this.localAddress,
            this.localPort,
            this.remoteAddress,
            this.remotePort
          );
        };
        items.forEach((item) => {
          if (item.type === "transport" && item.selectedCandidatePairId) {
            setSelectedCandidatePair(candidatePairs[item.selectedCandidatePairId]);
          }
          if (item.type === "googCandidatePair" && item.googActiveConnection === "true" || (item.type === "candidatepair" || item.type === "candidate-pair") && item.selected) {
            setSelectedCandidatePair(item);
          }
        });
        if (!foundSelectedCandidatePair && (!Object.keys(candidatePairs).length || Object.keys(localCandidates).length)) {
          setTimeout(findCandidatePair, 100);
          return;
        } else {
          this._connecting = false;
          this._connected = true;
        }
        if (this._chunk) {
          try {
            this.send(this._chunk);
          } catch (err2) {
            return this.__destroy(errCode$1(err2, "ERR_DATA_CHANNEL"));
          }
          this._chunk = null;
          this._debug('sent chunk from "write before connect"');
          const cb = this._cb;
          this._cb = null;
          cb(null);
        }
        if (typeof this._channel.bufferedAmountLowThreshold !== "number") {
          this._interval = setInterval(() => this._onInterval(), 150);
          if (this._interval.unref) this._interval.unref();
        }
        this._debug("connect");
        this.emit("connect");
      });
    };
    findCandidatePair();
  }
  _onInterval() {
    if (!this._cb || !this._channel || this._channel.bufferedAmount > MAX_BUFFERED_AMOUNT$1) {
      return;
    }
    this._onChannelBufferedAmountLow();
  }
  _onSignalingStateChange() {
    if (this.destroyed) return;
    if (this._pc.signalingState === "stable") {
      this._isNegotiating = false;
      this._debug("flushing sender queue", this._sendersAwaitingStable);
      this._sendersAwaitingStable.forEach((sender) => {
        this._pc.removeTrack(sender);
        this._queuedNegotiation = true;
      });
      this._sendersAwaitingStable = [];
      if (this._queuedNegotiation) {
        this._debug("flushing negotiation queue");
        this._queuedNegotiation = false;
        this._needsNegotiation();
      } else {
        this._debug("negotiated");
        this.emit("negotiated");
      }
    }
    this._debug("signalingStateChange %s", this._pc.signalingState);
    this.emit("signalingStateChange", this._pc.signalingState);
  }
  _onIceCandidate(event) {
    if (this.destroyed) return;
    if (event.candidate && this.trickle) {
      this.emit("signal", {
        type: "candidate",
        candidate: {
          candidate: event.candidate.candidate,
          sdpMLineIndex: event.candidate.sdpMLineIndex,
          sdpMid: event.candidate.sdpMid
        }
      });
    } else if (!event.candidate && !this._iceComplete) {
      this._iceComplete = true;
      this.emit("_iceComplete");
    }
    if (event.candidate) {
      this._startIceCompleteTimeout();
    }
  }
  _onChannelMessage(event) {
    if (this.destroyed) return;
    let data = event.data;
    if (data instanceof ArrayBuffer) {
      data = new Uint8Array(data);
    } else if (this.__objectMode === false) {
      data = text2arr(data);
    }
    this.push(data);
  }
  _onChannelBufferedAmountLow() {
    if (this.destroyed || !this._cb) return;
    this._debug("ending backpressure: bufferedAmount %d", this._channel.bufferedAmount);
    const cb = this._cb;
    this._cb = null;
    cb(null);
  }
  _onChannelOpen() {
    if (this._connected || this.destroyed) return;
    this._debug("on channel open");
    this._channelReady = true;
    this._maybeReady();
  }
  _onChannelClose() {
    if (this.destroyed) return;
    this._debug("on channel close");
    this.__destroy();
  }
  _debug() {
    const args = [].slice.call(arguments);
    args[0] = "[" + this._id + "] " + args[0];
    Debug.apply(null, args);
  }
};
Peer$1.WEBRTC_SUPPORT = !!RTCPeerConnection;
Peer$1.config = {
  iceServers: [
    {
      urls: [
        "stun:stun.l.google.com:19302",
        "stun:global.stun.twilio.com:3478"
      ]
    }
  ],
  sdpSemantics: "unified-plan"
};
Peer$1.channelConfig = {};
const UDPTracker = {};
const common$1 = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  default: UDPTracker
}, Symbol.toStringTag, { value: "Module" }));
const DEFAULT_ANNOUNCE_PEERS = 50;
const MAX_ANNOUNCE_PEERS = 82;
const parseUrl = (str) => {
  const url = new URL(str.replace(/^udp:/, "http:"));
  if (str.match(/^udp:/)) {
    Object.defineProperties(url, {
      href: { value: url.href.replace(/^http/, "udp") },
      protocol: { value: url.protocol.replace(/^http/, "udp") },
      origin: { value: url.origin.replace(/^http/, "udp") }
    });
  }
  return url;
};
const common = {
  DEFAULT_ANNOUNCE_PEERS,
  MAX_ANNOUNCE_PEERS,
  parseUrl,
  ...common$1
};
/*! simple-websocket. MIT License. Feross Aboukhadijeh <https://feross.org/opensource> */
const debug$2 = debug$3("simple-websocket");
const _WebSocket = typeof UDPTracker !== "function" ? WebSocket : UDPTracker;
const MAX_BUFFERED_AMOUNT = 64 * 1024;
class Socket extends streamx.Duplex {
  constructor(opts = {}) {
    if (typeof opts === "string") {
      opts = { url: opts };
    }
    opts = Object.assign({
      allowHalfOpen: false
    }, opts);
    super(opts);
    this.__objectMode = !!opts.objectMode;
    if (opts.objectMode != null) delete opts.objectMode;
    if (opts.url == null && opts.socket == null) {
      throw new Error("Missing required `url` or `socket` option");
    }
    if (opts.url != null && opts.socket != null) {
      throw new Error("Must specify either `url` or `socket` option, not both");
    }
    this._id = arr2hex(randomBytes(4)).slice(0, 7);
    this._debug("new websocket: %o", opts);
    this.connected = false;
    this._chunk = null;
    this._cb = null;
    this._interval = null;
    if (opts.socket) {
      this.url = opts.socket.url;
      this._ws = opts.socket;
      this.connected = opts.socket.readyState === _WebSocket.OPEN;
    } else {
      this.url = opts.url;
      try {
        if (typeof UDPTracker === "function") {
          this._ws = new _WebSocket(opts.url, {
            ...opts,
            encoding: void 0
            // encoding option breaks ws internals
          });
        } else {
          this._ws = new _WebSocket(opts.url);
        }
      } catch (err) {
        queueMicrotask$2(() => this.destroy(err));
        return;
      }
    }
    this._ws.binaryType = "arraybuffer";
    if (opts.socket && this.connected) {
      queueMicrotask$2(() => this._handleOpen());
    } else {
      this._ws.onopen = () => this._handleOpen();
    }
    this._ws.onmessage = (event) => this._handleMessage(event);
    this._ws.onclose = () => this._handleClose();
    this._ws.onerror = (err) => this._handleError(err);
    this._handleFinishBound = () => this._handleFinish();
    this.once("finish", this._handleFinishBound);
  }
  /**
   * Send text/binary data to the WebSocket server.
   * @param {TypedArrayView|ArrayBuffer|Uint8Array|string|Blob|Object} chunk
   */
  send(chunk) {
    this._ws.send(chunk);
  }
  _final(cb) {
    if (!this._readableState.ended) this.push(null);
    cb(null);
  }
  _destroy(cb) {
    if (this.destroyed) return;
    if (!this._writableState.ended) this.end();
    this.connected = false;
    clearInterval(this._interval);
    this._interval = null;
    this._chunk = null;
    this._cb = null;
    if (this._handleFinishBound) {
      this.removeListener("finish", this._handleFinishBound);
    }
    this._handleFinishBound = null;
    if (this._ws) {
      const ws = this._ws;
      const onClose = () => {
        ws.onclose = null;
      };
      if (ws.readyState === _WebSocket.CLOSED) {
        onClose();
      } else {
        try {
          ws.onclose = onClose;
          ws.close();
        } catch (err) {
          onClose();
        }
      }
      ws.onopen = null;
      ws.onmessage = null;
      ws.onerror = () => {
      };
    }
    this._ws = null;
    cb();
  }
  _write(chunk, cb) {
    if (this.destroyed) return cb(new Error("cannot write after socket is destroyed"));
    if (this.connected) {
      try {
        this.send(chunk);
      } catch (err) {
        return this.destroy(err);
      }
      if (typeof UDPTracker !== "function" && this._ws.bufferedAmount > MAX_BUFFERED_AMOUNT) {
        this._debug("start backpressure: bufferedAmount %d", this._ws.bufferedAmount);
        this._cb = cb;
      } else {
        cb(null);
      }
    } else {
      this._debug("write before connect");
      this._chunk = chunk;
      this._cb = cb;
    }
  }
  _handleOpen() {
    if (this.connected || this.destroyed) return;
    this.connected = true;
    if (this._chunk) {
      try {
        this.send(this._chunk);
      } catch (err) {
        return this.destroy(err);
      }
      this._chunk = null;
      this._debug('sent chunk from "write before connect"');
      const cb = this._cb;
      this._cb = null;
      cb(null);
    }
    if (typeof UDPTracker !== "function") {
      this._interval = setInterval(() => this._onInterval(), 150);
      if (this._interval.unref) this._interval.unref();
    }
    this._debug("connect");
    this.emit("connect");
  }
  _handleMessage(event) {
    if (this.destroyed) return;
    let data = event.data;
    if (data instanceof ArrayBuffer) data = new Uint8Array(data);
    if (this.__objectMode === false) data = text2arr(data);
    this.push(data);
  }
  _handleClose() {
    if (this.destroyed) return;
    this._debug("on close");
    this.destroy();
  }
  _handleError(_) {
    this.destroy(new Error(`Error connecting to ${this.url}`));
  }
  // When stream finishes writing, close socket. Half open connections are not
  // supported.
  _handleFinish() {
    if (this.destroyed) return;
    const destroySoon = () => {
      setTimeout(() => this.destroy(), 1e3);
    };
    if (this.connected) {
      destroySoon();
    } else {
      this.once("connect", destroySoon);
    }
  }
  _onInterval() {
    if (!this._cb || !this._ws || this._ws.bufferedAmount > MAX_BUFFERED_AMOUNT) {
      return;
    }
    this._debug("ending backpressure: bufferedAmount %d", this._ws.bufferedAmount);
    const cb = this._cb;
    this._cb = null;
    cb(null);
  }
  _debug() {
    const args = [].slice.call(arguments);
    args[0] = "[" + this._id + "] " + args[0];
    debug$2.apply(null, args);
  }
}
Socket.WEBSOCKET_SUPPORT = !!_WebSocket;
class Tracker extends EventEmitter$2 {
  constructor(client, announceUrl) {
    super();
    this.client = client;
    this.announceUrl = announceUrl;
    this.interval = null;
    this.destroyed = false;
  }
  setInterval(intervalMs) {
    if (intervalMs == null) intervalMs = this.DEFAULT_ANNOUNCE_INTERVAL;
    clearInterval(this.interval);
    if (intervalMs) {
      this.interval = setInterval(() => {
        this.announce(this.client._defaultAnnounceOpts());
      }, intervalMs);
      if (this.interval.unref) this.interval.unref();
    }
  }
}
const debug$1 = debug$3("bittorrent-tracker:websocket-tracker");
const socketPool = {};
const RECONNECT_MINIMUM = 10 * 1e3;
const RECONNECT_MAXIMUM = 60 * 60 * 1e3;
const RECONNECT_VARIANCE = 5 * 60 * 1e3;
const OFFER_TIMEOUT = 50 * 1e3;
class WebSocketTracker extends Tracker {
  constructor(client, announceUrl) {
    super(client, announceUrl);
    debug$1("new websocket tracker %s", announceUrl);
    this.peers = {};
    this.socket = null;
    this.reconnecting = false;
    this.retries = 0;
    this.reconnectTimer = null;
    this.expectingResponse = false;
    this._openSocket();
  }
  announce(opts) {
    if (this.destroyed || this.reconnecting) return;
    if (!this.socket.connected) {
      this.socket.once("connect", () => {
        this.announce(opts);
      });
      return;
    }
    const params = Object.assign({}, opts, {
      action: "announce",
      info_hash: this.client._infoHashBinary,
      peer_id: this.client._peerIdBinary
    });
    if (this._trackerId) params.trackerid = this._trackerId;
    if (opts.event === "stopped" || opts.event === "completed") {
      this._send(params);
    } else {
      const numwant = Math.min(opts.numwant, 5);
      this._generateOffers(numwant, (offers) => {
        params.numwant = numwant;
        params.offers = offers;
        this._send(params);
      });
    }
  }
  scrape(opts) {
    if (this.destroyed || this.reconnecting) return;
    if (!this.socket.connected) {
      this.socket.once("connect", () => {
        this.scrape(opts);
      });
      return;
    }
    const infoHashes = Array.isArray(opts.infoHash) && opts.infoHash.length > 0 ? opts.infoHash.map((infoHash) => hex2bin(infoHash)) : opts.infoHash && hex2bin(opts.infoHash) || this.client._infoHashBinary;
    const params = {
      action: "scrape",
      info_hash: infoHashes
    };
    this._send(params);
  }
  destroy(cb = noop) {
    if (this.destroyed) return cb(null);
    this.destroyed = true;
    clearInterval(this.interval);
    clearTimeout(this.reconnectTimer);
    for (const peerId in this.peers) {
      const peer = this.peers[peerId];
      clearTimeout(peer.trackerTimeout);
      peer.destroy();
    }
    this.peers = null;
    if (this.socket) {
      this.socket.removeListener("connect", this._onSocketConnectBound);
      this.socket.removeListener("data", this._onSocketDataBound);
      this.socket.removeListener("close", this._onSocketCloseBound);
      this.socket.removeListener("error", this._onSocketErrorBound);
      this.socket = null;
    }
    this._onSocketConnectBound = null;
    this._onSocketErrorBound = null;
    this._onSocketDataBound = null;
    this._onSocketCloseBound = null;
    if (socketPool[this.announceUrl]) {
      socketPool[this.announceUrl].consumers -= 1;
    }
    if (socketPool[this.announceUrl].consumers > 0) return cb();
    let socket = socketPool[this.announceUrl];
    delete socketPool[this.announceUrl];
    socket.on("error", noop);
    socket.once("close", cb);
    let timeout;
    if (!this.expectingResponse) return destroyCleanup();
    timeout = setTimeout(destroyCleanup, common.DESTROY_TIMEOUT);
    socket.once("data", destroyCleanup);
    function destroyCleanup() {
      if (timeout) {
        clearTimeout(timeout);
        timeout = null;
      }
      socket.removeListener("data", destroyCleanup);
      socket.destroy();
      socket = null;
    }
  }
  _openSocket() {
    this.destroyed = false;
    if (!this.peers) this.peers = {};
    this._onSocketConnectBound = () => {
      this._onSocketConnect();
    };
    this._onSocketErrorBound = (err) => {
      this._onSocketError(err);
    };
    this._onSocketDataBound = (data) => {
      this._onSocketData(data);
    };
    this._onSocketCloseBound = () => {
      this._onSocketClose();
    };
    this.socket = socketPool[this.announceUrl];
    if (this.socket) {
      socketPool[this.announceUrl].consumers += 1;
      if (this.socket.connected) {
        this._onSocketConnectBound();
      }
    } else {
      const parsedUrl = new URL(this.announceUrl);
      let agent;
      if (this.client._proxyOpts) {
        agent = parsedUrl.protocol === "wss:" ? this.client._proxyOpts.httpsAgent : this.client._proxyOpts.httpAgent;
        if (!agent && this.client._proxyOpts.socksProxy) {
          agent = this.client._proxyOpts.socksProxy;
        }
      }
      this.socket = socketPool[this.announceUrl] = new Socket({ url: this.announceUrl, agent });
      this.socket.consumers = 1;
      this.socket.once("connect", this._onSocketConnectBound);
    }
    this.socket.on("data", this._onSocketDataBound);
    this.socket.once("close", this._onSocketCloseBound);
    this.socket.once("error", this._onSocketErrorBound);
  }
  _onSocketConnect() {
    if (this.destroyed) return;
    if (this.reconnecting) {
      this.reconnecting = false;
      this.retries = 0;
      this.announce(this.client._defaultAnnounceOpts());
    }
  }
  _onSocketData(data) {
    if (this.destroyed) return;
    this.expectingResponse = false;
    try {
      data = JSON.parse(arr2text(data));
    } catch (err) {
      this.client.emit("warning", new Error("Invalid tracker response"));
      return;
    }
    if (data.action === "announce") {
      this._onAnnounceResponse(data);
    } else if (data.action === "scrape") {
      this._onScrapeResponse(data);
    } else {
      this._onSocketError(new Error(`invalid action in WS response: ${data.action}`));
    }
  }
  _onAnnounceResponse(data) {
    if (data.info_hash !== this.client._infoHashBinary) {
      debug$1(
        "ignoring websocket data from %s for %s (looking for %s: reused socket)",
        this.announceUrl,
        bin2hex(data.info_hash),
        this.client.infoHash
      );
      return;
    }
    if (data.peer_id && data.peer_id === this.client._peerIdBinary) {
      return;
    }
    debug$1(
      "received %s from %s for %s",
      JSON.stringify(data),
      this.announceUrl,
      this.client.infoHash
    );
    const failure = data["failure reason"];
    if (failure) return this.client.emit("warning", new Error(failure));
    const warning = data["warning message"];
    if (warning) this.client.emit("warning", new Error(warning));
    const interval = data.interval || data["min interval"];
    if (interval) this.setInterval(interval * 1e3);
    const trackerId = data["tracker id"];
    if (trackerId) {
      this._trackerId = trackerId;
    }
    if (data.complete != null) {
      const response = Object.assign({}, data, {
        announce: this.announceUrl,
        infoHash: bin2hex(data.info_hash)
      });
      this.client.emit("update", response);
    }
    let peer;
    if (data.offer && data.peer_id) {
      debug$1("creating peer (from remote offer)");
      peer = this._createPeer();
      peer.id = bin2hex(data.peer_id);
      peer.once("signal", (answer) => {
        const params = {
          action: "announce",
          info_hash: this.client._infoHashBinary,
          peer_id: this.client._peerIdBinary,
          to_peer_id: data.peer_id,
          answer,
          offer_id: data.offer_id
        };
        if (this._trackerId) params.trackerid = this._trackerId;
        this._send(params);
      });
      this.client.emit("peer", peer);
      peer.signal(data.offer);
    }
    if (data.answer && data.peer_id) {
      const offerId = bin2hex(data.offer_id);
      peer = this.peers[offerId];
      if (peer) {
        peer.id = bin2hex(data.peer_id);
        this.client.emit("peer", peer);
        peer.signal(data.answer);
        clearTimeout(peer.trackerTimeout);
        peer.trackerTimeout = null;
        delete this.peers[offerId];
      } else {
        debug$1(`got unexpected answer: ${JSON.stringify(data.answer)}`);
      }
    }
  }
  _onScrapeResponse(data) {
    data = data.files || {};
    const keys = Object.keys(data);
    if (keys.length === 0) {
      this.client.emit("warning", new Error("invalid scrape response"));
      return;
    }
    keys.forEach((infoHash) => {
      const response = Object.assign(data[infoHash], {
        announce: this.announceUrl,
        infoHash: bin2hex(infoHash)
      });
      this.client.emit("scrape", response);
    });
  }
  _onSocketClose() {
    if (this.destroyed) return;
    this.destroy();
    this._startReconnectTimer();
  }
  _onSocketError(err) {
    if (this.destroyed) return;
    this.destroy();
    this.client.emit("warning", err);
    this._startReconnectTimer();
  }
  _startReconnectTimer() {
    const ms2 = Math.floor(Math.random() * RECONNECT_VARIANCE) + Math.min(Math.pow(2, this.retries) * RECONNECT_MINIMUM, RECONNECT_MAXIMUM);
    this.reconnecting = true;
    clearTimeout(this.reconnectTimer);
    this.reconnectTimer = setTimeout(() => {
      this.retries++;
      this._openSocket();
    }, ms2);
    if (this.reconnectTimer.unref) this.reconnectTimer.unref();
    debug$1("reconnecting socket in %s ms", ms2);
  }
  _send(params) {
    if (this.destroyed) return;
    this.expectingResponse = true;
    const message = JSON.stringify(params);
    debug$1("send %s", message);
    this.socket.send(message);
  }
  _generateOffers(numwant, cb) {
    const self2 = this;
    const offers = [];
    debug$1("generating %s offers", numwant);
    for (let i = 0; i < numwant; ++i) {
      generateOffer();
    }
    checkDone();
    function generateOffer() {
      const offerId = arr2hex(randomBytes(20));
      debug$1("creating peer (from _generateOffers)");
      const peer = self2.peers[offerId] = self2._createPeer({ initiator: true });
      peer.once("signal", (offer) => {
        offers.push({
          offer,
          offer_id: hex2bin(offerId)
        });
        checkDone();
      });
      peer.trackerTimeout = setTimeout(() => {
        debug$1("tracker timeout: destroying peer");
        peer.trackerTimeout = null;
        delete self2.peers[offerId];
        peer.destroy();
      }, OFFER_TIMEOUT);
      if (peer.trackerTimeout.unref) peer.trackerTimeout.unref();
    }
    function checkDone() {
      if (offers.length === numwant) {
        debug$1("generated %s offers", numwant);
        cb(offers);
      }
    }
  }
  _createPeer(opts) {
    const self2 = this;
    opts = Object.assign({
      trickle: false,
      config: self2.client._rtcConfig,
      wrtc: self2.client._wrtc
    }, opts);
    const peer = new Peer$1(opts);
    peer.once("error", onError);
    peer.once("connect", onConnect);
    return peer;
    function onError(err) {
      self2.client.emit("warning", new Error(`Connection error: ${err.message}`));
      peer.destroy();
    }
    function onConnect() {
      peer.removeListener("error", onError);
      peer.removeListener("connect", onConnect);
    }
  }
}
WebSocketTracker.prototype.DEFAULT_ANNOUNCE_INTERVAL = 30 * 1e3;
WebSocketTracker._socketPool = socketPool;
function noop() {
}
const debug = debug$3("bittorrent-tracker:client");
class Client extends EventEmitter$2 {
  constructor(opts = {}) {
    super();
    if (!opts.peerId) throw new Error("Option `peerId` is required");
    if (!opts.infoHash) throw new Error("Option `infoHash` is required");
    if (!opts.announce) throw new Error("Option `announce` is required");
    if (!process$1.browser && !opts.port) throw new Error("Option `port` is required");
    this.peerId = typeof opts.peerId === "string" ? opts.peerId : arr2hex(opts.peerId);
    this._peerIdBuffer = hex2arr(this.peerId);
    this._peerIdBinary = hex2bin(this.peerId);
    this.infoHash = typeof opts.infoHash === "string" ? opts.infoHash.toLowerCase() : arr2hex(opts.infoHash);
    this._infoHashBuffer = hex2arr(this.infoHash);
    this._infoHashBinary = hex2bin(this.infoHash);
    debug("new client %s", this.infoHash);
    this.destroyed = false;
    this._port = opts.port;
    this._getAnnounceOpts = opts.getAnnounceOpts;
    this._rtcConfig = opts.rtcConfig;
    this._userAgent = opts.userAgent;
    this._proxyOpts = opts.proxyOpts;
    this._wrtc = typeof opts.wrtc === "function" ? opts.wrtc() : opts.wrtc;
    let announce = typeof opts.announce === "string" ? [opts.announce] : opts.announce == null ? [] : opts.announce;
    announce = announce.map((announceUrl) => {
      if (ArrayBuffer.isView(announceUrl)) announceUrl = arr2text(announceUrl);
      if (announceUrl[announceUrl.length - 1] === "/") {
        announceUrl = announceUrl.substring(0, announceUrl.length - 1);
      }
      return announceUrl;
    });
    announce = Array.from(new Set(announce));
    const webrtcSupport = this._wrtc !== false && (!!this._wrtc || Peer$1.WEBRTC_SUPPORT);
    const nextTickWarn = (err) => {
      queueMicrotask$2(() => {
        this.emit("warning", err);
      });
    };
    this._trackers = announce.map((announceUrl) => {
      let parsedUrl;
      try {
        parsedUrl = common.parseUrl(announceUrl);
      } catch (err) {
        nextTickWarn(new Error(`Invalid tracker URL: ${announceUrl}`));
        return null;
      }
      const port = parsedUrl.port;
      if (port < 0 || port > 65535) {
        nextTickWarn(new Error(`Invalid tracker port: ${announceUrl}`));
        return null;
      }
      const protocol = parsedUrl.protocol;
      if ((protocol === "http:" || protocol === "https:") && typeof UDPTracker === "function") {
        return new UDPTracker(this, announceUrl);
      } else if (protocol === "udp:" && typeof UDPTracker === "function") {
        return new UDPTracker(this, announceUrl);
      } else if ((protocol === "ws:" || protocol === "wss:") && webrtcSupport) {
        if (protocol === "ws:" && typeof window !== "undefined" && window.location.protocol === "https:") {
          nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`));
          return null;
        }
        return new WebSocketTracker(this, announceUrl);
      } else {
        nextTickWarn(new Error(`Unsupported tracker protocol: ${announceUrl}`));
        return null;
      }
    }).filter(Boolean);
  }
  /**
   * Send a `start` announce to the trackers.
   * @param {Object} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  start(opts) {
    opts = this._defaultAnnounceOpts(opts);
    opts.event = "started";
    debug("send `start` %o", opts);
    this._announce(opts);
    this._trackers.forEach((tracker) => {
      tracker.setInterval();
    });
  }
  /**
   * Send a `stop` announce to the trackers.
   * @param {Object} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.numwant
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  stop(opts) {
    opts = this._defaultAnnounceOpts(opts);
    opts.event = "stopped";
    debug("send `stop` %o", opts);
    this._announce(opts);
  }
  /**
   * Send a `complete` announce to the trackers.
   * @param {Object} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.numwant
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  complete(opts) {
    if (!opts) opts = {};
    opts = this._defaultAnnounceOpts(opts);
    opts.event = "completed";
    debug("send `complete` %o", opts);
    this._announce(opts);
  }
  /**
   * Send a `update` announce to the trackers.
   * @param {Object} opts
   * @param {number=} opts.uploaded
   * @param {number=} opts.downloaded
   * @param {number=} opts.numwant
   * @param {number=} opts.left (if not set, calculated automatically)
   */
  update(opts) {
    opts = this._defaultAnnounceOpts(opts);
    if (opts.event) delete opts.event;
    debug("send `update` %o", opts);
    this._announce(opts);
  }
  _announce(opts) {
    this._trackers.forEach((tracker) => {
      tracker.announce(opts);
    });
  }
  /**
   * Send a scrape request to the trackers.
   * @param {Object} opts
   */
  scrape(opts) {
    debug("send `scrape`");
    if (!opts) opts = {};
    this._trackers.forEach((tracker) => {
      tracker.scrape(opts);
    });
  }
  setInterval(intervalMs) {
    debug("setInterval %d", intervalMs);
    this._trackers.forEach((tracker) => {
      tracker.setInterval(intervalMs);
    });
  }
  destroy(cb) {
    if (this.destroyed) return;
    this.destroyed = true;
    debug("destroy");
    const tasks = this._trackers.map((tracker) => (cb2) => {
      tracker.destroy(cb2);
    });
    parallel(tasks, cb);
    this._trackers = [];
    this._getAnnounceOpts = null;
  }
  _defaultAnnounceOpts(opts = {}) {
    if (opts.numwant == null) opts.numwant = common.DEFAULT_ANNOUNCE_PEERS;
    if (opts.uploaded == null) opts.uploaded = 0;
    if (opts.downloaded == null) opts.downloaded = 0;
    if (this._getAnnounceOpts) opts = Object.assign({}, opts, this._getAnnounceOpts());
    return opts;
  }
}
Client.scrape = (opts, cb) => {
  cb = once$1(cb);
  if (!opts.infoHash) throw new Error("Option `infoHash` is required");
  if (!opts.announce) throw new Error("Option `announce` is required");
  const clientOpts = Object.assign({}, opts, {
    infoHash: Array.isArray(opts.infoHash) ? opts.infoHash[0] : opts.infoHash,
    peerId: text2arr("01234567890123456789"),
    // dummy value
    port: 6881
    // dummy value
  });
  const client = new Client(clientOpts);
  client.once("error", cb);
  client.once("warning", cb);
  let len = Array.isArray(opts.infoHash) ? opts.infoHash.length : 1;
  const results = {};
  client.on("scrape", (data) => {
    len -= 1;
    results[data.infoHash] = data;
    if (len === 0) {
      client.destroy();
      const keys = Object.keys(results);
      if (keys.length === 1) {
        cb(null, results[keys[0]]);
      } else {
        cb(null, results);
      }
    }
  });
  client.scrape({ infoHash: opts.infoHash });
  return client;
};
var md5$1 = { exports: {} };
function FF(a, b, c, d, m, s, k) {
  var n = a + (b & c | ~b & d) + (m >>> 0) + k;
  return (n << s | n >>> 32 - s) + b;
}
function GG(a, b, c, d, m, s, k) {
  var n = a + (b & d | c & ~d) + (m >>> 0) + k;
  return (n << s | n >>> 32 - s) + b;
}
function HH(a, b, c, d, m, s, k) {
  var n = a + (b ^ c ^ d) + (m >>> 0) + k;
  return (n << s | n >>> 32 - s) + b;
}
function II(a, b, c, d, m, s, k) {
  var n = a + (c ^ (b | ~d)) + (m >>> 0) + k;
  return (n << s | n >>> 32 - s) + b;
}
function byteToHex(byte) {
  return (256 + (byte & 255)).toString(16).substr(-2);
}
function bs(byte) {
  return String.fromCharCode(byte & 255);
}
function wordToBytes(word) {
  return bs(word) + bs(word >>> 8) + bs(word >>> 16) + bs(word >>> 24);
}
var utf8toBytes = function(utf82) {
  return unescape(encodeURIComponent(utf82));
};
function bytesToWords(bytes) {
  var bytes_count = bytes.length, bits_count = bytes_count << 3, words = new Uint32Array(bytes_count + 72 >>> 6 << 4);
  for (var i = 0, n = bytes.length; i < n; ++i)
    words[i >>> 2] |= bytes.charCodeAt(i) << ((i & 3) << 3);
  words[bytes_count >> 2] |= 128 << (bits_count & 31);
  words[words.length - 2] = bits_count;
  return words;
}
var exports = md5$1.exports = function md5(utf82) {
  return utf8toMD5(utf82).toHex();
};
var bytesToMD5 = exports.fromBytes = function(bytes) {
  var words = bytesToWords(bytes), a = 1732584193, b = 4023233417, c = 2562383102, d = 271733878, S11 = 7, S12 = 12, S13 = 17, S14 = 22, S21 = 5, S22 = 9, S23 = 14, S24 = 20, S31 = 4, S32 = 11, S33 = 16, S34 = 23, S41 = 6, S42 = 10, S43 = 15, S44 = 21;
  for (var i = 0, ws = words.length; i < ws; i += 16) {
    var AA = a, BB = b, CC = c, DD = d;
    a = FF(a, b, c, d, words[i + 0], S11, 3614090360);
    d = FF(d, a, b, c, words[i + 1], S12, 3905402710);
    c = FF(c, d, a, b, words[i + 2], S13, 606105819);
    b = FF(b, c, d, a, words[i + 3], S14, 3250441966);
    a = FF(a, b, c, d, words[i + 4], S11, 4118548399);
    d = FF(d, a, b, c, words[i + 5], S12, 1200080426);
    c = FF(c, d, a, b, words[i + 6], S13, 2821735955);
    b = FF(b, c, d, a, words[i + 7], S14, 4249261313);
    a = FF(a, b, c, d, words[i + 8], S11, 1770035416);
    d = FF(d, a, b, c, words[i + 9], S12, 2336552879);
    c = FF(c, d, a, b, words[i + 10], S13, 4294925233);
    b = FF(b, c, d, a, words[i + 11], S14, 2304563134);
    a = FF(a, b, c, d, words[i + 12], S11, 1804603682);
    d = FF(d, a, b, c, words[i + 13], S12, 4254626195);
    c = FF(c, d, a, b, words[i + 14], S13, 2792965006);
    b = FF(b, c, d, a, words[i + 15], S14, 1236535329);
    a = GG(a, b, c, d, words[i + 1], S21, 4129170786);
    d = GG(d, a, b, c, words[i + 6], S22, 3225465664);
    c = GG(c, d, a, b, words[i + 11], S23, 643717713);
    b = GG(b, c, d, a, words[i + 0], S24, 3921069994);
    a = GG(a, b, c, d, words[i + 5], S21, 3593408605);
    d = GG(d, a, b, c, words[i + 10], S22, 38016083);
    c = GG(c, d, a, b, words[i + 15], S23, 3634488961);
    b = GG(b, c, d, a, words[i + 4], S24, 3889429448);
    a = GG(a, b, c, d, words[i + 9], S21, 568446438);
    d = GG(d, a, b, c, words[i + 14], S22, 3275163606);
    c = GG(c, d, a, b, words[i + 3], S23, 4107603335);
    b = GG(b, c, d, a, words[i + 8], S24, 1163531501);
    a = GG(a, b, c, d, words[i + 13], S21, 2850285829);
    d = GG(d, a, b, c, words[i + 2], S22, 4243563512);
    c = GG(c, d, a, b, words[i + 7], S23, 1735328473);
    b = GG(b, c, d, a, words[i + 12], S24, 2368359562);
    a = HH(a, b, c, d, words[i + 5], S31, 4294588738);
    d = HH(d, a, b, c, words[i + 8], S32, 2272392833);
    c = HH(c, d, a, b, words[i + 11], S33, 1839030562);
    b = HH(b, c, d, a, words[i + 14], S34, 4259657740);
    a = HH(a, b, c, d, words[i + 1], S31, 2763975236);
    d = HH(d, a, b, c, words[i + 4], S32, 1272893353);
    c = HH(c, d, a, b, words[i + 7], S33, 4139469664);
    b = HH(b, c, d, a, words[i + 10], S34, 3200236656);
    a = HH(a, b, c, d, words[i + 13], S31, 681279174);
    d = HH(d, a, b, c, words[i + 0], S32, 3936430074);
    c = HH(c, d, a, b, words[i + 3], S33, 3572445317);
    b = HH(b, c, d, a, words[i + 6], S34, 76029189);
    a = HH(a, b, c, d, words[i + 9], S31, 3654602809);
    d = HH(d, a, b, c, words[i + 12], S32, 3873151461);
    c = HH(c, d, a, b, words[i + 15], S33, 530742520);
    b = HH(b, c, d, a, words[i + 2], S34, 3299628645);
    a = II(a, b, c, d, words[i + 0], S41, 4096336452);
    d = II(d, a, b, c, words[i + 7], S42, 1126891415);
    c = II(c, d, a, b, words[i + 14], S43, 2878612391);
    b = II(b, c, d, a, words[i + 5], S44, 4237533241);
    a = II(a, b, c, d, words[i + 12], S41, 1700485571);
    d = II(d, a, b, c, words[i + 3], S42, 2399980690);
    c = II(c, d, a, b, words[i + 10], S43, 4293915773);
    b = II(b, c, d, a, words[i + 1], S44, 2240044497);
    a = II(a, b, c, d, words[i + 8], S41, 1873313359);
    d = II(d, a, b, c, words[i + 15], S42, 4264355552);
    c = II(c, d, a, b, words[i + 6], S43, 2734768916);
    b = II(b, c, d, a, words[i + 13], S44, 1309151649);
    a = II(a, b, c, d, words[i + 4], S41, 4149444226);
    d = II(d, a, b, c, words[i + 11], S42, 3174756917);
    c = II(c, d, a, b, words[i + 2], S43, 718787259);
    b = II(b, c, d, a, words[i + 9], S44, 3951481745);
    a = a + AA >>> 0;
    b = b + BB >>> 0;
    c = c + CC >>> 0;
    d = d + DD >>> 0;
  }
  var hash_bytes = new String(wordToBytes(a) + wordToBytes(b) + wordToBytes(c) + wordToBytes(d));
  hash_bytes.toHex = function() {
    var hex2 = "";
    for (var i2 = 0, n = hash_bytes.length; i2 < n; ++i2)
      hex2 += byteToHex(hash_bytes.charCodeAt(i2));
    return hex2;
  };
  return hash_bytes;
};
var utf8toMD5 = exports.fromUtf8 = function(utf82) {
  return bytesToMD5(utf8toBytes(utf82));
};
var b64 = "./0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz";
function to64(u, n) {
  for (var s = ""; --n >= 0; u >>>= 6)
    s += b64.charAt(u & 63);
  return s;
}
var MAX_KEY_LENGTH = 64, b64_map = [0, 6, 12, 1, 7, 13, 2, 8, 14, 3, 9, 15, 4, 10, 5, 11];
var gen_salt = exports.salt = function(n) {
  var s = "";
  if (!n)
    n = 8;
  do {
    s += b64.charAt(64 * Math.random() >>> 0);
  } while (--n);
  return s;
};
exports.crypt = function(key, setting) {
  if (key.length > MAX_KEY_LENGTH)
    throw Error("too long key");
  if (!setting)
    setting = "$1$" + gen_salt();
  key = utf8toBytes(key);
  var salt = utf8toBytes(setting.replace(/^\$1\$([^$]+)(?:\$.*)?$/, "$1")), md = bytesToMD5(key + salt + key), s = key + "$1$" + salt;
  for (var kl = key.length; kl > 16; kl -= 16)
    s += md;
  s += md.slice(0, kl);
  for (var kl = key.length; kl; kl >>= 1)
    s += kl & 1 ? "\0" : key.charAt(0);
  md = bytesToMD5(s);
  for (var i = 0; i < 1e3; ++i)
    md = bytesToMD5((i & 1 ? key : md) + (i % 3 ? salt : "") + (i % 7 ? key : "") + (i & 1 ? md : key));
  var h = "$1$" + salt + "$";
  for (var i = 0; i < 15; i += 3)
    h += to64(
      md.charCodeAt(b64_map[i + 0]) << 16 | md.charCodeAt(b64_map[i + 1]) << 8 | md.charCodeAt(b64_map[i + 2]),
      4
    );
  return h + to64(md.charCodeAt(b64_map[15]), 2);
};
var md5Exports = md5$1.exports;
const md52 = /* @__PURE__ */ getDefaultExportFromCjs(md5Exports);
const PACKAGE_VERSION = "1.0.4";
const TRACKER_CLIENT_VERSION_PREFIX = `-PM${formatVersion(PACKAGE_VERSION)}-`;
const HASH_SYMBOLS = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
const PEER_ID_LENGTH = 20;
function getStreamHash(streamId) {
  const binary15BytesHashString = md52.fromUtf8(streamId).slice(1);
  const base64Hash20CharsString = btoa(binary15BytesHashString);
  return base64Hash20CharsString;
}
function generatePeerId(trackerClientVersionPrefix) {
  const trackerClientId = [trackerClientVersionPrefix];
  const randomCharsCount = PEER_ID_LENGTH - trackerClientVersionPrefix.length;
  for (let i = 0; i < randomCharsCount; i++) {
    trackerClientId.push(
      HASH_SYMBOLS[Math.floor(Math.random() * HASH_SYMBOLS.length)]
    );
  }
  return trackerClientId.join("");
}
function formatVersion(versionString) {
  const splittedVersion = versionString.split(".");
  return `${splittedVersion[0].padStart(2, "0")}${splittedVersion[1].padStart(2, "0")}`;
}
function getStreamString(stream) {
  return `${stream.type}-${stream.index}`;
}
function getSegmentString(segment) {
  const { externalId } = segment;
  return `(${getStreamString(segment.stream)} | ${externalId})`;
}
function getControlledPromise() {
  let resolve;
  let reject;
  const promise2 = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return {
    promise: promise2,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    resolve,
    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
    reject
  };
}
function joinChunks(chunks, totalBytes) {
  if (totalBytes === void 0) {
    totalBytes = chunks.reduce((sum, chunk) => sum + chunk.byteLength, 0);
  }
  const buffer = new Uint8Array(totalBytes);
  let offset = 0;
  for (const chunk of chunks) {
    buffer.set(chunk, offset);
    offset += chunk.byteLength;
  }
  return buffer;
}
function getRandomItem(items) {
  return items[Math.floor(Math.random() * items.length)];
}
function utf8ToUintArray(utf8String) {
  const encoder2 = new TextEncoder();
  const bytes = new Uint8Array(utf8String.length);
  encoder2.encodeInto(utf8String, bytes);
  return bytes;
}
function hexToUtf8(hexString) {
  const bytes = new Uint8Array(hexString.length / 2);
  for (let i = 0; i < hexString.length; i += 2) {
    bytes[i / 2] = parseInt(hexString.slice(i, i + 2), 16);
  }
  const decoder2 = new TextDecoder();
  return decoder2.decode(bytes);
}
function* arrayBackwards(arr) {
  for (let i = arr.length - 1; i >= 0; i--) {
    yield arr[i];
  }
}
function isObject(item) {
  return !!item && typeof item === "object" && !Array.isArray(item);
}
function isArray(item) {
  return Array.isArray(item);
}
function filterUndefinedProps(obj) {
  function filter(obj2) {
    if (isObject(obj2)) {
      const result = {};
      Object.keys(obj2).forEach((key) => {
        if (obj2[key] !== void 0) {
          const value = filter(obj2[key]);
          if (value !== void 0) {
            result[key] = value;
          }
        }
      });
      return result;
    } else {
      return obj2;
    }
  }
  return filter(obj);
}
function deepCopy(item) {
  if (isArray(item)) {
    return item.map((element) => deepCopy(element));
  } else if (isObject(item)) {
    const copy = {};
    for (const key of Object.keys(item)) {
      copy[key] = deepCopy(item[key]);
    }
    return copy;
  } else {
    return item;
  }
}
function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}
function overrideConfig(target, updates, defaults = {}) {
  if (typeof target !== "object" || target === null || typeof updates !== "object" || updates === null) {
    return target;
  }
  Object.keys(updates).forEach((key) => {
    if (key === "__proto__" || key === "constructor" || key === "prototype") {
      throw new Error(`Attempt to modify restricted property '${String(key)}'`);
    }
    const updateValue = updates[key];
    const defaultValue = defaults[key];
    if (key in target) {
      if (updateValue === void 0) {
        target[key] = defaultValue === void 0 ? void 0 : defaultValue;
      } else {
        target[key] = updateValue;
      }
    }
  });
  return target;
}
function mergeAndFilterConfig(options) {
  const { defaultConfig, baseConfig = {}, specificStreamConfig = {} } = options;
  const mergedConfig = deepCopy({
    ...defaultConfig,
    ...baseConfig,
    ...specificStreamConfig
  });
  const keysOfT = Object.keys(defaultConfig);
  const filteredConfig = {};
  keysOfT.forEach((key) => {
    if (key in mergedConfig) {
      filteredConfig[key] = mergedConfig[key];
    }
  });
  return filteredConfig;
}
var PeerCommandType$1 = /* @__PURE__ */ ((PeerCommandType2) => {
  PeerCommandType2[PeerCommandType2["SegmentsAnnouncement"] = 0] = "SegmentsAnnouncement";
  PeerCommandType2[PeerCommandType2["SegmentRequest"] = 1] = "SegmentRequest";
  PeerCommandType2[PeerCommandType2["SegmentData"] = 2] = "SegmentData";
  PeerCommandType2[PeerCommandType2["SegmentDataSendingCompleted"] = 3] = "SegmentDataSendingCompleted";
  PeerCommandType2[PeerCommandType2["SegmentAbsent"] = 4] = "SegmentAbsent";
  PeerCommandType2[PeerCommandType2["CancelSegmentRequest"] = 5] = "CancelSegmentRequest";
  return PeerCommandType2;
})(PeerCommandType$1 || {});
var SerializedItem = /* @__PURE__ */ ((SerializedItem2) => {
  SerializedItem2[SerializedItem2["Min"] = -1] = "Min";
  SerializedItem2[SerializedItem2["Int"] = 0] = "Int";
  SerializedItem2[SerializedItem2["SimilarIntArray"] = 1] = "SimilarIntArray";
  SerializedItem2[SerializedItem2["String"] = 2] = "String";
  SerializedItem2[SerializedItem2["Max"] = 3] = "Max";
  return SerializedItem2;
})(SerializedItem || {});
function abs(num) {
  return num < 0 ? -num : num;
}
function getRequiredBytesForInt(num) {
  const binaryString = num.toString(2);
  const necessaryBits = num < 0 ? binaryString.length : binaryString.length + 1;
  return Math.ceil(necessaryBits / 8);
}
function intToBytes(num) {
  const isNegative = num < 0;
  const bytesAmountNumber = getRequiredBytesForInt(num);
  const bytes = new Uint8Array(bytesAmountNumber);
  const bytesAmount = BigInt(bytesAmountNumber);
  num = abs(num);
  for (let i = 0; i < bytesAmountNumber; i++) {
    const shift = 8n * (bytesAmount - 1n - BigInt(i));
    const byte = num >> shift & 0xffn;
    bytes[i] = Number(byte);
  }
  if (isNegative) bytes[0] = bytes[0] | 128;
  return bytes;
}
function bytesToInt(bytes) {
  const byteLength2 = BigInt(bytes.length);
  const getNumberPart = (byte, i) => {
    const shift = 8n * (byteLength2 - 1n - BigInt(i));
    return BigInt(byte) << shift;
  };
  let number = getNumberPart(bytes[0] & 127, 0);
  for (let i = 1; i < byteLength2; i++) {
    number = getNumberPart(bytes[i], i) | number;
  }
  if ((bytes[0] & 128) >> 7 !== 0) number = -number;
  return number;
}
function serializeInt(num) {
  const numBytes = intToBytes(num);
  const numberMetadata = 0 << 4 | numBytes.length;
  return new Uint8Array([numberMetadata, ...numBytes]);
}
function deserializeInt(bytes) {
  const metadata = bytes[0];
  const code = metadata >> 4;
  if (code !== 0) {
    throw new Error(
      "Trying to deserialize integer with invalid serialized item code"
    );
  }
  const numberBytesLength = metadata & 15;
  const start = 1;
  const end = start + numberBytesLength;
  return {
    number: bytesToInt(bytes.slice(start, end)),
    byteLength: numberBytesLength + 1
  };
}
function serializeSimilarIntArray(numbers) {
  const commonPartNumbersMap = /* @__PURE__ */ new Map();
  for (const number of numbers) {
    const common2 = number & ~0xffn;
    const diffByte = number & 0xffn;
    const bytes = commonPartNumbersMap.get(common2) ?? new ResizableUint8Array();
    if (!bytes.length) commonPartNumbersMap.set(common2, bytes);
    bytes.push(Number(diffByte));
  }
  const result = new ResizableUint8Array();
  result.push([1 << 4, commonPartNumbersMap.size]);
  for (const [commonPart, binaryArray] of commonPartNumbersMap) {
    const { length } = binaryArray.getBytesChunks();
    const commonPartWithLength = commonPart | BigInt(length) & 0xffn;
    binaryArray.unshift(serializeInt(commonPartWithLength));
    result.push(binaryArray.getBuffer());
  }
  return result.getBuffer();
}
function deserializeSimilarIntArray(bytes) {
  const [codeByte, commonPartArraysAmount] = bytes;
  const code = codeByte >> 4;
  if (code !== 1) {
    throw new Error(
      "Trying to deserialize similar int array with invalid serialized item code"
    );
  }
  let offset = 2;
  const originalIntArr = [];
  for (let i = 0; i < commonPartArraysAmount; i++) {
    const { number: commonPartWithLength, byteLength: byteLength2 } = deserializeInt(
      bytes.slice(offset)
    );
    offset += byteLength2;
    const arrayLength = commonPartWithLength & 0xffn;
    const commonPart = commonPartWithLength & ~0xffn;
    for (let j = 0; j < arrayLength; j++) {
      const diffPart = BigInt(bytes[offset]);
      originalIntArr.push(commonPart | diffPart);
      offset++;
    }
  }
  return { numbers: originalIntArr, byteLength: offset };
}
function serializeString(string) {
  const { length } = string;
  const bytes = new ResizableUint8Array();
  bytes.push([
    2 << 4 | length >> 8 & 15,
    length & 255
  ]);
  bytes.push(new TextEncoder().encode(string));
  return bytes.getBuffer();
}
function deserializeString(bytes) {
  const [codeByte, lengthByte] = bytes;
  const code = codeByte >> 4;
  if (code !== 2) {
    throw new Error(
      "Trying to deserialize bytes (sting) with invalid serialized item code."
    );
  }
  const length = (codeByte & 15) << 8 | lengthByte;
  const stringBytes = bytes.slice(2, length + 2);
  const string = new TextDecoder("utf8").decode(stringBytes);
  return { string, byteLength: length + 2 };
}
class ResizableUint8Array {
  constructor() {
    __publicField(this, "bytes", []);
    __publicField(this, "_length", 0);
  }
  push(bytes) {
    this.addBytes(bytes, "end");
  }
  unshift(bytes) {
    this.addBytes(bytes, "start");
  }
  addBytes(bytes, position) {
    let bytesToAdd;
    if (bytes instanceof Uint8Array) {
      bytesToAdd = bytes;
    } else if (Array.isArray(bytes)) {
      bytesToAdd = new Uint8Array(bytes);
    } else {
      bytesToAdd = new Uint8Array([bytes]);
    }
    this._length += bytesToAdd.length;
    this.bytes[position === "start" ? "unshift" : "push"](bytesToAdd);
  }
  getBytesChunks() {
    return this.bytes;
  }
  getBuffer() {
    return joinChunks(this.bytes, this._length);
  }
  get length() {
    return this._length;
  }
}
const FRAME_PART_LENGTH = 4;
const commandFrameStart = stringToUtf8CodesBuffer("cstr", FRAME_PART_LENGTH);
const commandFrameEnd = stringToUtf8CodesBuffer("cend", FRAME_PART_LENGTH);
const commandDivFrameStart = stringToUtf8CodesBuffer("dstr", FRAME_PART_LENGTH);
const commandDivFrameEnd = stringToUtf8CodesBuffer("dend", FRAME_PART_LENGTH);
const startFrames = [commandFrameStart, commandDivFrameStart];
const endFrames = [commandFrameEnd, commandDivFrameEnd];
const commandFramesLength = commandFrameStart.length + commandFrameEnd.length;
function isCommandChunk(buffer) {
  const length = commandFrameStart.length;
  const bufferEndingToCompare = buffer.slice(-length);
  return startFrames.some(
    (frame) => areBuffersEqual(buffer, frame, FRAME_PART_LENGTH)
  ) && endFrames.some(
    (frame) => areBuffersEqual(bufferEndingToCompare, frame, FRAME_PART_LENGTH)
  );
}
function isFirstCommandChunk(buffer) {
  return areBuffersEqual(buffer, commandFrameStart, FRAME_PART_LENGTH);
}
function isLastCommandChunk(buffer) {
  return areBuffersEqual(
    buffer.slice(-FRAME_PART_LENGTH),
    commandFrameEnd,
    FRAME_PART_LENGTH
  );
}
class BinaryCommandJoiningError extends Error {
  constructor(type) {
    super();
    this.type = type;
  }
}
class BinaryCommandChunksJoiner {
  constructor(onComplete) {
    __publicField(this, "chunks", new ResizableUint8Array());
    __publicField(this, "status", "joining");
    this.onComplete = onComplete;
  }
  addCommandChunk(chunk) {
    if (this.status === "completed") return;
    const isFirstChunk = isFirstCommandChunk(chunk);
    if (!this.chunks.length && !isFirstChunk) {
      throw new BinaryCommandJoiningError("no-first-chunk");
    }
    if (this.chunks.length && isFirstChunk) {
      throw new BinaryCommandJoiningError("incomplete-joining");
    }
    this.chunks.push(this.unframeCommandChunk(chunk));
    if (!isLastCommandChunk(chunk)) return;
    this.status = "completed";
    this.onComplete(this.chunks.getBuffer());
  }
  unframeCommandChunk(chunk) {
    return chunk.slice(FRAME_PART_LENGTH, chunk.length - FRAME_PART_LENGTH);
  }
}
class BinaryCommandCreator {
  constructor(commandType, maxChunkLength) {
    __publicField(this, "bytes", new ResizableUint8Array());
    __publicField(this, "resultBuffers", []);
    __publicField(this, "status", "creating");
    this.maxChunkLength = maxChunkLength;
    this.bytes.push(commandType);
  }
  addInteger(name, value) {
    this.bytes.push(name.charCodeAt(0));
    const bytes = serializeInt(BigInt(value));
    this.bytes.push(bytes);
  }
  addSimilarIntArr(name, arr) {
    this.bytes.push(name.charCodeAt(0));
    const bytes = serializeSimilarIntArray(
      arr.map((num) => BigInt(num))
    );
    this.bytes.push(bytes);
  }
  addString(name, string) {
    this.bytes.push(name.charCodeAt(0));
    const bytes = serializeString(string);
    this.bytes.push(bytes);
  }
  complete() {
    if (!this.bytes.length) throw new Error("Buffer is empty");
    if (this.status === "completed") return;
    this.status = "completed";
    const unframedBuffer = this.bytes.getBuffer();
    if (unframedBuffer.length + commandFramesLength <= this.maxChunkLength) {
      this.resultBuffers.push(
        frameBuffer(unframedBuffer, commandFrameStart, commandFrameEnd)
      );
      return;
    }
    let chunksCount = Math.ceil(unframedBuffer.length / this.maxChunkLength);
    if (Math.ceil(unframedBuffer.length / chunksCount) + commandFramesLength > this.maxChunkLength) {
      chunksCount++;
    }
    for (const [i, chunk] of splitBufferToEqualChunks(
      unframedBuffer,
      chunksCount
    )) {
      if (i === 0) {
        this.resultBuffers.push(
          frameBuffer(chunk, commandFrameStart, commandDivFrameEnd)
        );
      } else if (i === chunksCount - 1) {
        this.resultBuffers.push(
          frameBuffer(chunk, commandDivFrameStart, commandFrameEnd)
        );
      } else {
        this.resultBuffers.push(
          frameBuffer(chunk, commandDivFrameStart, commandDivFrameEnd)
        );
      }
    }
  }
  getResultBuffers() {
    if (this.status === "creating" || !this.resultBuffers.length) {
      throw new Error("Command is not complete.");
    }
    return this.resultBuffers;
  }
}
function deserializeCommand(bytes) {
  const [commandCode] = bytes;
  const deserializedCommand = {
    c: commandCode
  };
  let offset = 1;
  while (offset < bytes.length) {
    const name = String.fromCharCode(bytes[offset]);
    offset++;
    const dataType = getDataTypeFromByte(bytes[offset]);
    switch (dataType) {
      case SerializedItem.Int:
        {
          const { number, byteLength: byteLength2 } = deserializeInt(
            bytes.slice(offset)
          );
          deserializedCommand[name] = Number(number);
          offset += byteLength2;
        }
        break;
      case SerializedItem.SimilarIntArray:
        {
          const { numbers, byteLength: byteLength2 } = deserializeSimilarIntArray(bytes.slice(offset));
          deserializedCommand[name] = numbers.map((n) => Number(n));
          offset += byteLength2;
        }
        break;
      case SerializedItem.String:
        {
          const { string, byteLength: byteLength2 } = deserializeString(
            bytes.slice(offset)
          );
          deserializedCommand[name] = string;
          offset += byteLength2;
        }
        break;
    }
  }
  return deserializedCommand;
}
function getDataTypeFromByte(byte) {
  const typeCode = byte >> 4;
  if (typeCode <= SerializedItem.Min || typeCode >= SerializedItem.Max) {
    throw new Error("Not existing type");
  }
  return typeCode;
}
function stringToUtf8CodesBuffer(string, length) {
  if (string.length !== length) {
    throw new Error("Wrong string length");
  }
  const buffer = new Uint8Array(length);
  for (let i = 0; i < string.length; i++) buffer[i] = string.charCodeAt(i);
  return buffer;
}
function* splitBufferToEqualChunks(buffer, chunksCount) {
  const chunkLength = Math.ceil(buffer.length / chunksCount);
  for (let i = 0; i < chunksCount; i++) {
    yield [i, buffer.slice(i * chunkLength, (i + 1) * chunkLength)];
  }
}
function frameBuffer(buffer, frameStart, frameEnd) {
  const result = new Uint8Array(
    buffer.length + frameStart.length + frameEnd.length
  );
  result.set(frameStart);
  result.set(buffer, frameStart.length);
  result.set(frameEnd, frameStart.length + buffer.length);
  return result;
}
function areBuffersEqual(buffer1, buffer2, length) {
  for (let i = 0; i < length; i++) {
    if (buffer1[i] !== buffer2[i]) return false;
  }
  return true;
}
function serializeSegmentAnnouncementCommand(command, maxChunkSize) {
  const { c: commandCode, p: loadingByHttp, l: loaded } = command;
  const creator = new BinaryCommandCreator(commandCode, maxChunkSize);
  if (loaded == null ? void 0 : loaded.length) creator.addSimilarIntArr("l", loaded);
  if (loadingByHttp == null ? void 0 : loadingByHttp.length) {
    creator.addSimilarIntArr("p", loadingByHttp);
  }
  creator.complete();
  return creator.getResultBuffers();
}
function serializePeerSegmentCommand(command, maxChunkSize) {
  const creator = new BinaryCommandCreator(command.c, maxChunkSize);
  creator.addInteger("i", command.i);
  creator.addInteger("r", command.r);
  creator.complete();
  return creator.getResultBuffers();
}
function serializePeerSendSegmentCommand(command, maxChunkSize) {
  const creator = new BinaryCommandCreator(command.c, maxChunkSize);
  creator.addInteger("i", command.i);
  creator.addInteger("s", command.s);
  creator.addInteger("r", command.r);
  creator.complete();
  return creator.getResultBuffers();
}
function serializePeerSegmentRequestCommand(command, maxChunkSize) {
  const creator = new BinaryCommandCreator(command.c, maxChunkSize);
  creator.addInteger("i", command.i);
  creator.addInteger("r", command.r);
  if (command.b) creator.addInteger("b", command.b);
  creator.complete();
  return creator.getResultBuffers();
}
function serializePeerCommand(command, maxChunkSize) {
  switch (command.c) {
    case PeerCommandType$1.CancelSegmentRequest:
    case PeerCommandType$1.SegmentAbsent:
    case PeerCommandType$1.SegmentDataSendingCompleted:
      return serializePeerSegmentCommand(command, maxChunkSize);
    case PeerCommandType$1.SegmentRequest:
      return serializePeerSegmentRequestCommand(command, maxChunkSize);
    case PeerCommandType$1.SegmentsAnnouncement:
      return serializeSegmentAnnouncementCommand(command, maxChunkSize);
    case PeerCommandType$1.SegmentData:
      return serializePeerSendSegmentCommand(command, maxChunkSize);
  }
}
const Command = /* @__PURE__ */ Object.freeze(/* @__PURE__ */ Object.defineProperty({
  __proto__: null,
  BinaryCommandChunksJoiner,
  BinaryCommandJoiningError,
  PeerCommandType: PeerCommandType$1,
  deserializeCommand,
  isCommandChunk,
  serializePeerCommand
}, Symbol.toStringTag, { value: "Module" }));
class PeerProtocol {
  constructor(connection, peerConfig, eventHandlers, eventTarget) {
    __publicField(this, "commandChunks");
    __publicField(this, "uploadingContext");
    __publicField(this, "onChunkDownloaded");
    __publicField(this, "onChunkUploaded");
    __publicField(this, "onDataReceived", (data) => {
      if (isCommandChunk(data)) {
        this.receivingCommandBytes(data);
      } else {
        this.eventHandlers.onSegmentChunkReceived(data);
        this.onChunkDownloaded(data.byteLength, "p2p", this.connection.idUtf8);
      }
    });
    this.connection = connection;
    this.peerConfig = peerConfig;
    this.eventHandlers = eventHandlers;
    this.onChunkDownloaded = eventTarget.getEventDispatcher("onChunkDownloaded");
    this.onChunkUploaded = eventTarget.getEventDispatcher("onChunkUploaded");
    connection.on("data", this.onDataReceived);
  }
  sendCommand(command) {
    const binaryCommandBuffers = serializePeerCommand(
      command,
      this.peerConfig.webRtcMaxMessageSize
    );
    for (const buffer of binaryCommandBuffers) {
      this.connection.write(buffer);
    }
  }
  stopUploadingSegmentData() {
    var _a;
    (_a = this.uploadingContext) == null ? void 0 : _a.stopUploading();
    this.uploadingContext = void 0;
  }
  getUploadingRequestId() {
    var _a;
    return (_a = this.uploadingContext) == null ? void 0 : _a.requestId;
  }
  async splitSegmentDataToChunksAndUploadAsync(data, requestId) {
    if (this.uploadingContext) {
      throw new Error(`Some segment data is already uploading.`);
    }
    const chunks = getBufferChunks(data, this.peerConfig.webRtcMaxMessageSize);
    const { promise: promise2, resolve, reject } = getControlledPromise();
    let isUploadingSegmentData = false;
    const uploadingContext = {
      stopUploading: () => {
        isUploadingSegmentData = false;
      },
      requestId
    };
    this.uploadingContext = uploadingContext;
    const sendChunk = () => {
      if (!isUploadingSegmentData) {
        reject();
        return;
      }
      while (true) {
        const chunk = chunks.next().value;
        if (!chunk) {
          resolve();
          break;
        }
        const drained = this.connection.write(chunk);
        this.onChunkUploaded(chunk.byteLength, this.connection.idUtf8);
        if (!drained) break;
      }
    };
    try {
      this.connection.on("drain", sendChunk);
      isUploadingSegmentData = true;
      sendChunk();
      await promise2;
    } finally {
      this.connection.off("drain", sendChunk);
      if (this.uploadingContext === uploadingContext) {
        this.uploadingContext = void 0;
      }
    }
  }
  receivingCommandBytes(buffer) {
    if (!this.commandChunks) {
      this.commandChunks = new BinaryCommandChunksJoiner(
        (commandBuffer) => {
          this.commandChunks = void 0;
          const command = deserializeCommand(commandBuffer);
          this.eventHandlers.onCommandReceived(command);
        }
      );
    }
    try {
      this.commandChunks.addCommandChunk(buffer);
    } catch (err) {
      if (!(err instanceof BinaryCommandJoiningError)) return;
      this.commandChunks = void 0;
    }
  }
}
function* getBufferChunks(data, maxChunkSize) {
  let bytesLeft = data.byteLength;
  while (bytesLeft > 0) {
    const bytesToSend = bytesLeft >= maxChunkSize ? maxChunkSize : bytesLeft;
    const from = data.byteLength - bytesLeft;
    const buffer = data.slice(from, from + bytesToSend);
    bytesLeft -= bytesToSend;
    yield buffer;
  }
}
const { PeerCommandType } = Command;
class Peer2 {
  constructor(connection, eventHandlers, peerConfig, streamType, eventTarget) {
    __publicField(this, "id");
    __publicField(this, "peerProtocol");
    __publicField(this, "downloadingContext");
    __publicField(this, "loadedSegments", /* @__PURE__ */ new Set());
    __publicField(this, "httpLoadingSegments", /* @__PURE__ */ new Set());
    __publicField(this, "downloadingErrors", []);
    __publicField(this, "logger", debug$3("p2pml-core:peer"));
    __publicField(this, "onPeerClosed");
    __publicField(this, "onCommandReceived", async (command) => {
      var _a, _b, _c, _d;
      switch (command.c) {
        case PeerCommandType.SegmentsAnnouncement:
          this.loadedSegments = new Set(command.l);
          this.httpLoadingSegments = new Set(command.p);
          this.eventHandlers.onSegmentsAnnouncement();
          break;
        case PeerCommandType.SegmentRequest:
          this.peerProtocol.stopUploadingSegmentData();
          this.eventHandlers.onSegmentRequested(
            this,
            command.i,
            command.r,
            command.b
          );
          break;
        case PeerCommandType.SegmentData:
          {
            if (!this.downloadingContext) break;
            if (this.downloadingContext.isSegmentDataCommandReceived) break;
            const { request, controls, requestId } = this.downloadingContext;
            if (request.segment.externalId !== command.i || requestId !== command.r) {
              break;
            }
            this.downloadingContext.isSegmentDataCommandReceived = true;
            controls.firstBytesReceived();
            if (request.totalBytes === void 0) {
              request.setTotalBytes(command.s);
            } else if (request.totalBytes - request.loadedBytes !== command.s) {
              request.clearLoadedBytes();
              this.sendCancelSegmentRequestCommand(request.segment, requestId);
              this.cancelSegmentDownloading(
                "peer-response-bytes-length-mismatch"
              );
              this.destroy();
            }
          }
          break;
        case PeerCommandType.SegmentDataSendingCompleted: {
          const downloadingContext = this.downloadingContext;
          if (!(downloadingContext == null ? void 0 : downloadingContext.isSegmentDataCommandReceived)) return;
          const { request, controls } = downloadingContext;
          const isWrongSegment = downloadingContext.request.segment.externalId !== command.i || downloadingContext.requestId !== command.r;
          if (isWrongSegment) {
            request.clearLoadedBytes();
            this.cancelSegmentDownloading("peer-protocol-violation");
            this.destroy();
            return;
          }
          const isWrongBytes = request.loadedBytes !== request.totalBytes;
          if (isWrongBytes) {
            request.clearLoadedBytes();
            this.cancelSegmentDownloading("peer-response-bytes-length-mismatch");
            this.destroy();
            return;
          }
          const isValid = await ((_b = (_a = this.peerConfig).validateP2PSegment) == null ? void 0 : _b.call(
            _a,
            request.segment.url,
            request.segment.byteRange
          )) ?? true;
          if (this.downloadingContext !== downloadingContext) return;
          if (!isValid) {
            request.clearLoadedBytes();
            this.cancelSegmentDownloading("p2p-segment-validation-failed");
            this.destroy();
            return;
          }
          this.downloadingErrors = [];
          controls.completeOnSuccess();
          this.downloadingContext = void 0;
          break;
        }
        case PeerCommandType.SegmentAbsent:
          if (((_c = this.downloadingContext) == null ? void 0 : _c.request.segment.externalId) === command.i && ((_d = this.downloadingContext) == null ? void 0 : _d.requestId) === command.r) {
            this.cancelSegmentDownloading("peer-segment-absent");
            this.loadedSegments.delete(command.i);
          }
          break;
        case PeerCommandType.CancelSegmentRequest:
          const uploadingRequestId = this.peerProtocol.getUploadingRequestId();
          if (uploadingRequestId !== command.r) break;
          this.peerProtocol.stopUploadingSegmentData();
          break;
      }
    });
    __publicField(this, "onSegmentChunkReceived", (chunk) => {
      var _a;
      if (!((_a = this.downloadingContext) == null ? void 0 : _a.isSegmentDataCommandReceived)) return;
      const { request, controls } = this.downloadingContext;
      const isOverflow = request.totalBytes !== void 0 && request.loadedBytes + chunk.byteLength > request.totalBytes;
      if (isOverflow) {
        request.clearLoadedBytes();
        this.cancelSegmentDownloading("peer-response-bytes-length-mismatch");
        this.destroy();
        return;
      }
      controls.addLoadedChunk(chunk);
    });
    __publicField(this, "onPeerConnectionClosed", () => {
      this.destroy();
    });
    __publicField(this, "onConnectionError", (error) => {
      this.logger(`peer connection error ${this.id} %O`, error);
      this.eventTarget.getEventDispatcher("onPeerError")({
        peerId: this.id,
        streamType: this.streamType,
        error
      });
      const code = error.code;
      if (code === "ERR_DATA_CHANNEL") {
        this.destroy();
      } else if (code === "ERR_CONNECTION_FAILURE") {
        this.destroy();
      }
    });
    __publicField(this, "destroy", () => {
      this.cancelSegmentDownloading("peer-closed");
      this.connection.destroy();
      this.eventHandlers.onPeerClosed(this);
      this.onPeerClosed({
        peerId: this.id,
        streamType: this.streamType
      });
      this.logger(`peer closed ${this.id}`);
    });
    this.connection = connection;
    this.eventHandlers = eventHandlers;
    this.peerConfig = peerConfig;
    this.streamType = streamType;
    this.eventTarget = eventTarget;
    this.onPeerClosed = eventTarget.getEventDispatcher("onPeerClose");
    this.id = Peer2.getPeerIdFromConnection(connection);
    this.peerProtocol = new PeerProtocol(
      connection,
      peerConfig,
      {
        onSegmentChunkReceived: this.onSegmentChunkReceived,
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onCommandReceived: this.onCommandReceived
      },
      eventTarget
    );
    eventTarget.getEventDispatcher("onPeerConnect")({
      peerId: this.id,
      streamType
    });
    connection.on("error", this.onConnectionError);
    connection.on("close", this.onPeerConnectionClosed);
    connection.on("end", this.onPeerConnectionClosed);
    connection.on("finish", this.onPeerConnectionClosed);
  }
  get downloadingSegment() {
    var _a;
    return (_a = this.downloadingContext) == null ? void 0 : _a.request.segment;
  }
  getSegmentStatus(segment) {
    const { externalId } = segment;
    if (this.loadedSegments.has(externalId)) return "loaded";
    if (this.httpLoadingSegments.has(externalId)) return "http-loading";
  }
  downloadSegment(segmentRequest) {
    if (this.downloadingContext) {
      throw new Error("Some segment already is downloading");
    }
    this.downloadingContext = {
      request: segmentRequest,
      requestId: Math.floor(Math.random() * 1e3),
      isSegmentDataCommandReceived: false,
      controls: segmentRequest.start(
        { downloadSource: "p2p", peerId: this.id },
        {
          notReceivingBytesTimeoutMs: this.peerConfig.p2pNotReceivingBytesTimeoutMs,
          abort: (error) => {
            if (!this.downloadingContext) return;
            const { request, requestId } = this.downloadingContext;
            this.sendCancelSegmentRequestCommand(request.segment, requestId);
            this.downloadingErrors.push(error);
            this.downloadingContext = void 0;
            const timeoutErrors = this.downloadingErrors.filter(
              (error2) => error2.type === "bytes-receiving-timeout"
            );
            if (timeoutErrors.length >= this.peerConfig.p2pErrorRetries) {
              this.destroy();
            }
          }
        }
      )
    };
    const command = {
      c: PeerCommandType.SegmentRequest,
      r: this.downloadingContext.requestId,
      i: segmentRequest.segment.externalId
    };
    if (segmentRequest.loadedBytes) command.b = segmentRequest.loadedBytes;
    this.peerProtocol.sendCommand(command);
  }
  async uploadSegmentData(segment, requestId, data) {
    const { externalId } = segment;
    this.logger(`send segment ${segment.externalId} to ${this.id}`);
    const command = {
      c: PeerCommandType.SegmentData,
      i: externalId,
      r: requestId,
      s: data.byteLength
    };
    this.peerProtocol.sendCommand(command);
    try {
      await this.peerProtocol.splitSegmentDataToChunksAndUploadAsync(
        data,
        requestId
      );
      this.sendSegmentDataSendingCompletedCommand(segment, requestId);
      this.logger(`segment ${externalId} has been sent to ${this.id}`);
    } catch (err) {
      this.logger(`cancel segment uploading ${externalId}`);
    }
  }
  cancelSegmentDownloading(type) {
    if (!this.downloadingContext) return;
    const { request, controls } = this.downloadingContext;
    const { segment } = request;
    this.logger(`cancel segment request ${segment.externalId} (${type})`);
    const error = new RequestError(type);
    controls.abortOnError(error);
    this.downloadingContext = void 0;
    this.downloadingErrors.push(error);
  }
  sendSegmentsAnnouncementCommand(loadedSegmentsIds, httpLoadingSegmentsIds) {
    const command = {
      c: PeerCommandType.SegmentsAnnouncement,
      p: httpLoadingSegmentsIds,
      l: loadedSegmentsIds
    };
    this.peerProtocol.sendCommand(command);
  }
  sendSegmentAbsentCommand(segmentExternalId, requestId) {
    this.peerProtocol.sendCommand({
      c: PeerCommandType.SegmentAbsent,
      i: segmentExternalId,
      r: requestId
    });
  }
  sendCancelSegmentRequestCommand(segment, requestId) {
    this.peerProtocol.sendCommand({
      c: PeerCommandType.CancelSegmentRequest,
      i: segment.externalId,
      r: requestId
    });
  }
  sendSegmentDataSendingCompletedCommand(segment, requestId) {
    this.peerProtocol.sendCommand({
      c: PeerCommandType.SegmentDataSendingCompleted,
      r: requestId,
      i: segment.externalId
    });
  }
  static getPeerIdFromConnection(connection) {
    return hexToUtf8(connection.id);
  }
}
function isSafariBrowser() {
  return /^((?!chrome|android).)*safari/i.test(navigator.userAgent);
}
class P2PTrackerClient {
  constructor(streamSwarmId, stream, eventHandlers, config, eventTarget) {
    __publicField(this, "streamShortId");
    __publicField(this, "client");
    __publicField(this, "_peers", /* @__PURE__ */ new Map());
    __publicField(this, "logger", debug$3("p2pml-core:p2p-tracker-client"));
    __publicField(this, "onReceivePeerConnection", (peerConnection) => {
      const itemId = Peer2.getPeerIdFromConnection(peerConnection);
      let peerItem = this._peers.get(itemId);
      if (peerItem == null ? void 0 : peerItem.peer) {
        peerConnection.destroy();
        return;
      } else if (!peerItem) {
        peerItem = { potentialConnections: /* @__PURE__ */ new Set() };
        peerConnection.idUtf8 = itemId;
        peerItem.potentialConnections.add(peerConnection);
        this._peers.set(itemId, peerItem);
      }
      peerConnection.on("connect", () => {
        if (!peerItem || peerItem.peer) return;
        for (const connection of peerItem.potentialConnections) {
          if (connection !== peerConnection) connection.destroy();
        }
        peerItem.potentialConnections.clear();
        peerItem.peer = new Peer2(
          peerConnection,
          {
            onPeerClosed: this.onPeerClosed,
            onSegmentRequested: this.eventHandlers.onSegmentRequested,
            onSegmentsAnnouncement: this.eventHandlers.onSegmentsAnnouncement
          },
          this.config,
          this.stream.type,
          this.eventTarget
        );
        this.logger(
          `connected with peer: ${peerItem.peer.id} ${this.streamShortId}`
        );
        this.eventHandlers.onPeerConnected(peerItem.peer);
      });
    });
    __publicField(this, "onTrackerClientWarning", (warning) => {
      this.logger(`tracker warning (${this.streamShortId}: ${warning})`);
      this.eventTarget.getEventDispatcher("onTrackerWarning")({
        streamType: this.stream.type,
        warning
      });
    });
    __publicField(this, "onTrackerClientError", (error) => {
      this.logger(`tracker error (${this.streamShortId}: ${error})`);
      this.eventTarget.getEventDispatcher("onTrackerError")({
        streamType: this.stream.type,
        error
      });
    });
    __publicField(this, "onPeerClosed", (peer) => {
      this.logger(`peer closed: ${peer.id}`);
      this._peers.delete(peer.id);
    });
    this.stream = stream;
    this.eventHandlers = eventHandlers;
    this.config = config;
    this.eventTarget = eventTarget;
    const streamHash = getStreamHash(streamSwarmId);
    this.streamShortId = getStreamString(stream);
    const peerId = generatePeerId(config.trackerClientVersionPrefix);
    this.client = new Client({
      infoHash: utf8ToUintArray(streamHash),
      peerId: utf8ToUintArray(peerId),
      announce: isSafariBrowser() ? config.announceTrackers.slice(0, 1) : config.announceTrackers,
      rtcConfig: this.config.rtcConfig
    });
    this.client.on("peer", this.onReceivePeerConnection);
    this.client.on("warning", this.onTrackerClientWarning);
    this.client.on("error", this.onTrackerClientError);
    this.logger(
      `create new client; 
stream: ${this.streamShortId}; hash: ${streamHash}
peerId: ${peerId}`
    );
  }
  start() {
    this.client.start();
  }
  destroy() {
    this.client.destroy();
    for (const { peer, potentialConnections } of this._peers.values()) {
      peer == null ? void 0 : peer.destroy();
      for (const connection of potentialConnections) {
        connection.destroy();
      }
    }
    this._peers.clear();
    this.logger(`destroy client; stream: ${this.streamShortId}`);
  }
  *peers() {
    for (const peerItem of this._peers.values()) {
      if (peerItem == null ? void 0 : peerItem.peer) yield peerItem.peer;
    }
  }
}
const PEER_PROTOCOL_VERSION = "v2";
function getStreamSwarmId(swarmId, stream) {
  return `${PEER_PROTOCOL_VERSION}-${swarmId}-${getStreamId(stream)}`;
}
function getSegmentFromStreamsMap(streams, segmentRuntimeId) {
  for (const stream of streams.values()) {
    const segment = stream.segments.get(segmentRuntimeId);
    if (segment) return segment;
  }
}
function getSegmentFromStreamByExternalId(stream, segmentExternalId) {
  for (const segment of stream.segments.values()) {
    if (segment.externalId === segmentExternalId) return segment;
  }
}
function getStreamId(stream) {
  return `${stream.type}-${stream.index}`;
}
function getSegmentAvgDuration(stream) {
  const { segments } = stream;
  let sumDuration = 0;
  const size = segments.size;
  for (const segment of segments.values()) {
    const duration = segment.endTime - segment.startTime;
    sumDuration += duration;
  }
  return sumDuration / size;
}
function isSegmentActualInPlayback(segment, playback, timeWindowsConfig) {
  const {
    isHighDemand = false,
    isHttpDownloadable = false,
    isP2PDownloadable = false
  } = getSegmentPlaybackStatuses(segment, playback, timeWindowsConfig);
  return isHighDemand || isHttpDownloadable || isP2PDownloadable;
}
function getSegmentPlaybackStatuses(segment, playback, timeWindowsConfig, currentP2PLoader) {
  const {
    highDemandTimeWindow,
    httpDownloadTimeWindow,
    p2pDownloadTimeWindow
  } = timeWindowsConfig;
  return {
    isHighDemand: isSegmentInTimeWindow(
      segment,
      playback,
      highDemandTimeWindow
    ),
    isHttpDownloadable: isSegmentInTimeWindow(
      segment,
      playback,
      httpDownloadTimeWindow
    ),
    isP2PDownloadable: isSegmentInTimeWindow(segment, playback, p2pDownloadTimeWindow) && (!currentP2PLoader || currentP2PLoader.isSegmentLoadingOrLoadedBySomeone(segment))
  };
}
function isSegmentInTimeWindow(segment, playback, timeWindowLength) {
  const { startTime, endTime } = segment;
  const { position, rate } = playback;
  const rightMargin = position + timeWindowLength * rate;
  return !(rightMargin < startTime || position > endTime);
}
class P2PLoader {
  constructor(streamManifestUrl, stream, requests, segmentStorage, config, eventTarget, onSegmentAnnouncement) {
    __publicField(this, "trackerClient");
    __publicField(this, "isAnnounceMicrotaskCreated", false);
    __publicField(this, "onPeerConnected", (peer) => {
      const { httpLoading, loaded } = this.getSegmentsAnnouncement();
      peer.sendSegmentsAnnouncementCommand(loaded, httpLoading);
    });
    __publicField(this, "broadcastAnnouncement", () => {
      if (this.isAnnounceMicrotaskCreated) return;
      this.isAnnounceMicrotaskCreated = true;
      queueMicrotask(() => {
        const { httpLoading, loaded } = this.getSegmentsAnnouncement();
        for (const peer of this.trackerClient.peers()) {
          peer.sendSegmentsAnnouncementCommand(loaded, httpLoading);
        }
        this.isAnnounceMicrotaskCreated = false;
      });
    });
    __publicField(this, "onSegmentRequested", async (peer, segmentExternalId, requestId, byteFrom) => {
      const segment = getSegmentFromStreamByExternalId(
        this.stream,
        segmentExternalId
      );
      if (!segment) return;
      const segmentData = await this.segmentStorage.getSegmentData(segment);
      if (!segmentData) {
        peer.sendSegmentAbsentCommand(segmentExternalId, requestId);
        return;
      }
      await peer.uploadSegmentData(
        segment,
        requestId,
        byteFrom !== void 0 ? segmentData.slice(byteFrom) : segmentData
      );
    });
    this.streamManifestUrl = streamManifestUrl;
    this.stream = stream;
    this.requests = requests;
    this.segmentStorage = segmentStorage;
    this.config = config;
    this.eventTarget = eventTarget;
    this.onSegmentAnnouncement = onSegmentAnnouncement;
    const swarmId = this.config.swarmId ?? this.streamManifestUrl;
    const streamSwarmId = getStreamSwarmId(swarmId, this.stream);
    this.trackerClient = new P2PTrackerClient(
      streamSwarmId,
      this.stream,
      {
        onPeerConnected: this.onPeerConnected,
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        onSegmentRequested: this.onSegmentRequested,
        onSegmentsAnnouncement: this.onSegmentAnnouncement
      },
      this.config,
      this.eventTarget
    );
    this.segmentStorage.subscribeOnUpdate(
      this.stream,
      this.broadcastAnnouncement
    );
    this.trackerClient.start();
  }
  downloadSegment(segment) {
    const peersWithSegment = [];
    for (const peer2 of this.trackerClient.peers()) {
      if (!peer2.downloadingSegment && peer2.getSegmentStatus(segment) === "loaded") {
        peersWithSegment.push(peer2);
      }
    }
    const peer = getRandomItem(peersWithSegment);
    if (!peer) return;
    const request = this.requests.getOrCreateRequest(segment);
    peer.downloadSegment(request);
  }
  isSegmentLoadingOrLoadedBySomeone(segment) {
    for (const peer of this.trackerClient.peers()) {
      if (peer.getSegmentStatus(segment)) return true;
    }
    return false;
  }
  isSegmentLoadedBySomeone(segment) {
    for (const peer of this.trackerClient.peers()) {
      if (peer.getSegmentStatus(segment) === "loaded") return true;
    }
    return false;
  }
  get connectedPeerCount() {
    let count = 0;
    for (const peer of this.trackerClient.peers()) count++;
    return count;
  }
  getSegmentsAnnouncement() {
    const loaded = this.segmentStorage.getStoredSegmentExternalIdsOfStream(this.stream);
    const httpLoading = [];
    for (const request of this.requests.httpRequests()) {
      const segment = this.stream.segments.get(request.segment.runtimeId);
      if (!segment) continue;
      httpLoading.push(segment.externalId);
    }
    return { loaded, httpLoading };
  }
  destroy() {
    this.segmentStorage.unsubscribeFromUpdate(
      this.stream,
      this.broadcastAnnouncement
    );
    this.trackerClient.destroy();
  }
}
class P2PLoadersContainer {
  constructor(streamManifestUrl, stream, requests, segmentStorage, config, eventTarget, onSegmentAnnouncement) {
    __publicField(this, "loaders", /* @__PURE__ */ new Map());
    __publicField(this, "_currentLoaderItem");
    __publicField(this, "logger", debug$3("p2pml-core:p2p-loaders-container"));
    this.streamManifestUrl = streamManifestUrl;
    this.requests = requests;
    this.segmentStorage = segmentStorage;
    this.config = config;
    this.eventTarget = eventTarget;
    this.onSegmentAnnouncement = onSegmentAnnouncement;
    this.changeCurrentLoader(stream);
  }
  createLoader(stream) {
    if (this.loaders.has(stream.runtimeId)) {
      throw new Error("Loader for this stream already exists");
    }
    const loader = new P2PLoader(
      this.streamManifestUrl,
      stream,
      this.requests,
      this.segmentStorage,
      this.config,
      this.eventTarget,
      () => {
        if (this._currentLoaderItem.loader === loader) {
          this.onSegmentAnnouncement();
        }
      }
    );
    const loggerInfo = getStreamString(stream);
    this.logger(`created new loader: ${loggerInfo}`);
    return {
      loader,
      stream,
      loggerInfo: getStreamString(stream)
    };
  }
  changeCurrentLoader(stream) {
    const loaderItem = this.loaders.get(stream.runtimeId);
    if (this._currentLoaderItem) {
      const ids = this.segmentStorage.getStoredSegmentExternalIdsOfStream(
        this._currentLoaderItem.stream
      );
      if (!ids.length) this.destroyAndRemoveLoader(this._currentLoaderItem);
      else this.setLoaderDestroyTimeout(this._currentLoaderItem);
    }
    if (loaderItem) {
      this._currentLoaderItem = loaderItem;
      clearTimeout(loaderItem.destroyTimeoutId);
      loaderItem.destroyTimeoutId = void 0;
    } else {
      const loader = this.createLoader(stream);
      this.loaders.set(stream.runtimeId, loader);
      this._currentLoaderItem = loader;
    }
    this.logger(
      `change current p2p loader: ${getStreamString(stream)}`
    );
  }
  setLoaderDestroyTimeout(item) {
    item.destroyTimeoutId = window.setTimeout(
      () => this.destroyAndRemoveLoader(item),
      this.config.p2pInactiveLoaderDestroyTimeoutMs
    );
  }
  destroyAndRemoveLoader(item) {
    item.loader.destroy();
    this.loaders.delete(item.stream.runtimeId);
    this.logger(`destroy p2p loader: `, item.loggerInfo);
  }
  get currentLoader() {
    return this._currentLoaderItem.loader;
  }
  destroy() {
    for (const { loader, destroyTimeoutId } of this.loaders.values()) {
      loader.destroy();
      clearTimeout(destroyTimeoutId);
    }
    this.loaders.clear();
  }
}
let Request$1 = class Request2 {
  constructor(segment, requestProcessQueueCallback, bandwidthCalculators, playback, playbackConfig, eventTarget) {
    __publicField(this, "currentAttempt");
    __publicField(this, "_failedAttempts", new FailedRequestAttempts());
    __publicField(this, "finalData");
    __publicField(this, "bytes", []);
    __publicField(this, "_loadedBytes", 0);
    __publicField(this, "_totalBytes");
    __publicField(this, "_status", "not-started");
    __publicField(this, "progress");
    __publicField(this, "notReceivingBytesTimeout");
    __publicField(this, "_abortRequestCallback");
    __publicField(this, "_logger");
    __publicField(this, "_isHandledByProcessQueue", false);
    __publicField(this, "onSegmentError");
    __publicField(this, "onSegmentAbort");
    __publicField(this, "onSegmentStart");
    __publicField(this, "onSegmentLoaded");
    __publicField(this, "abortOnTimeout", () => {
      var _a;
      this.throwErrorIfNotLoadingStatus();
      if (!this.currentAttempt) return;
      this.setStatus("failed");
      const error = new RequestError("bytes-receiving-timeout");
      (_a = this._abortRequestCallback) == null ? void 0 : _a.call(this, error);
      this.logger(
        `${this.downloadSource} ${this.segment.externalId} failed ${error.type}`
      );
      this._failedAttempts.add({
        ...this.currentAttempt,
        error
      });
      this.onSegmentError({
        segment: this.segment,
        error,
        downloadSource: this.currentAttempt.downloadSource,
        peerId: this.currentAttempt.downloadSource === "p2p" ? this.currentAttempt.peerId : void 0,
        streamType: this.segment.stream.type
      });
      this.notReceivingBytesTimeout.clear();
      this.manageBandwidthCalculatorsState("stop");
      this.requestProcessQueueCallback();
    });
    __publicField(this, "abortOnError", (error) => {
      this.throwErrorIfNotLoadingStatus();
      if (!this.currentAttempt) return;
      this.setStatus("failed");
      this.logger(
        `${this.downloadSource} ${this.segment.externalId} failed ${error.type}`
      );
      this._failedAttempts.add({
        ...this.currentAttempt,
        error
      });
      this.onSegmentError({
        segment: this.segment,
        error,
        downloadSource: this.currentAttempt.downloadSource,
        peerId: this.currentAttempt.downloadSource === "p2p" ? this.currentAttempt.peerId : void 0,
        streamType: this.segment.stream.type
      });
      this.notReceivingBytesTimeout.clear();
      this.manageBandwidthCalculatorsState("stop");
      this.requestProcessQueueCallback();
    });
    __publicField(this, "completeOnSuccess", () => {
      this.throwErrorIfNotLoadingStatus();
      if (!this.currentAttempt) return;
      this.manageBandwidthCalculatorsState("stop");
      this.notReceivingBytesTimeout.clear();
      this.finalData = joinChunks(this.bytes);
      this.setStatus("succeed");
      this._totalBytes = this._loadedBytes;
      this.onSegmentLoaded({
        segmentUrl: this.segment.url,
        bytesLength: this.finalData.byteLength,
        downloadSource: this.currentAttempt.downloadSource,
        peerId: this.currentAttempt.downloadSource === "p2p" ? this.currentAttempt.peerId : void 0,
        streamType: this.segment.stream.type
      });
      this.logger(
        `${this.currentAttempt.downloadSource} ${this.segment.externalId} succeed`
      );
      this.requestProcessQueueCallback();
    });
    __publicField(this, "addLoadedChunk", (chunk) => {
      this.throwErrorIfNotLoadingStatus();
      if (!this.currentAttempt || !this.progress) return;
      this.notReceivingBytesTimeout.restart();
      const byteLength2 = chunk.byteLength;
      const { all: allBC, http: httpBC } = this.bandwidthCalculators;
      allBC.addBytes(byteLength2);
      if (this.currentAttempt.downloadSource === "http") {
        httpBC.addBytes(byteLength2);
      }
      this.bytes.push(chunk);
      this.progress.lastLoadedChunkTimestamp = performance.now();
      this.progress.loadedBytes += byteLength2;
      this._loadedBytes += byteLength2;
    });
    __publicField(this, "firstBytesReceived", () => {
      this.throwErrorIfNotLoadingStatus();
      this.notReceivingBytesTimeout.restart();
    });
    this.segment = segment;
    this.requestProcessQueueCallback = requestProcessQueueCallback;
    this.bandwidthCalculators = bandwidthCalculators;
    this.playback = playback;
    this.playbackConfig = playbackConfig;
    this.onSegmentError = eventTarget.getEventDispatcher("onSegmentError");
    this.onSegmentAbort = eventTarget.getEventDispatcher("onSegmentAbort");
    this.onSegmentStart = eventTarget.getEventDispatcher("onSegmentStart");
    this.onSegmentLoaded = eventTarget.getEventDispatcher("onSegmentLoaded");
    const { byteRange } = this.segment;
    if (byteRange) {
      const { end, start } = byteRange;
      this._totalBytes = end - start + 1;
    }
    this.notReceivingBytesTimeout = new Timeout(this.abortOnTimeout);
    const { type } = this.segment.stream;
    this._logger = debug$3(`p2pml-core:request-${type}`);
  }
  clearLoadedBytes() {
    this._loadedBytes = 0;
    this.bytes = [];
    this._totalBytes = void 0;
  }
  get status() {
    return this._status;
  }
  setStatus(status) {
    this._status = status;
    this._isHandledByProcessQueue = false;
  }
  get downloadSource() {
    var _a;
    return (_a = this.currentAttempt) == null ? void 0 : _a.downloadSource;
  }
  get loadedBytes() {
    return this._loadedBytes;
  }
  get totalBytes() {
    return this._totalBytes;
  }
  get data() {
    if (this.status !== "succeed") return;
    if (!this.finalData) this.finalData = joinChunks(this.bytes);
    return this.finalData;
  }
  get failedAttempts() {
    return this._failedAttempts;
  }
  get isHandledByProcessQueue() {
    return this._isHandledByProcessQueue;
  }
  markHandledByProcessQueue() {
    this._isHandledByProcessQueue = true;
  }
  setTotalBytes(value) {
    if (this._totalBytes !== void 0) {
      throw new Error("Request total bytes value is already set");
    }
    this._totalBytes = value;
  }
  start(requestData, controls) {
    if (this._status === "succeed") {
      throw new Error(
        `Request ${this.segment.externalId} has been already succeed.`
      );
    }
    if (this._status === "loading") {
      throw new Error(
        `Request ${this.segment.externalId} has been already started.`
      );
    }
    this.setStatus("loading");
    this.currentAttempt = { ...requestData };
    this.progress = {
      startFromByte: this._loadedBytes,
      loadedBytes: 0,
      startTimestamp: performance.now()
    };
    this.manageBandwidthCalculatorsState("start");
    const { notReceivingBytesTimeoutMs, abort: abort2 } = controls;
    this._abortRequestCallback = abort2;
    if (notReceivingBytesTimeoutMs !== void 0) {
      this.notReceivingBytesTimeout.start(notReceivingBytesTimeoutMs);
    }
    this.logger(
      `${requestData.downloadSource} ${this.segment.externalId} started`
    );
    this.onSegmentStart({
      segment: this.segment,
      downloadSource: requestData.downloadSource,
      peerId: requestData.downloadSource === "p2p" ? requestData.peerId : void 0
    });
    return {
      firstBytesReceived: this.firstBytesReceived,
      addLoadedChunk: this.addLoadedChunk,
      completeOnSuccess: this.completeOnSuccess,
      abortOnError: this.abortOnError
    };
  }
  abortFromProcessQueue() {
    var _a, _b, _c, _d;
    this.throwErrorIfNotLoadingStatus();
    this.setStatus("aborted");
    this.logger(
      `${(_a = this.currentAttempt) == null ? void 0 : _a.downloadSource} ${this.segment.externalId} aborted`
    );
    (_b = this._abortRequestCallback) == null ? void 0 : _b.call(this, new RequestError("abort"));
    this.onSegmentAbort({
      segment: this.segment,
      downloadSource: (_c = this.currentAttempt) == null ? void 0 : _c.downloadSource,
      peerId: ((_d = this.currentAttempt) == null ? void 0 : _d.downloadSource) === "p2p" ? this.currentAttempt.peerId : void 0,
      streamType: this.segment.stream.type
    });
    this._abortRequestCallback = void 0;
    this.manageBandwidthCalculatorsState("stop");
    this.notReceivingBytesTimeout.clear();
  }
  throwErrorIfNotLoadingStatus() {
    if (this._status !== "loading") {
      throw new Error(`Request has been already ${this.status}.`);
    }
  }
  logger(message) {
    var _a;
    this._logger.color = ((_a = this.currentAttempt) == null ? void 0 : _a.downloadSource) === "http" ? "green" : "red";
    this._logger(message);
    this._logger.color = "";
  }
  manageBandwidthCalculatorsState(state) {
    var _a;
    const { all, http } = this.bandwidthCalculators;
    const method = state === "start" ? "startLoading" : "stopLoading";
    if (((_a = this.currentAttempt) == null ? void 0 : _a.downloadSource) === "http") http[method]();
    all[method]();
  }
};
class FailedRequestAttempts {
  constructor() {
    __publicField(this, "attempts", []);
  }
  add(attempt) {
    this.attempts.push(attempt);
  }
  get httpAttemptsCount() {
    return this.attempts.reduce(
      (sum, attempt) => attempt.downloadSource === "http" ? sum + 1 : sum,
      0
    );
  }
  get lastAttempt() {
    return this.attempts[this.attempts.length - 1];
  }
  clear() {
    this.attempts = [];
  }
}
class Timeout {
  constructor(action) {
    __publicField(this, "timeoutId");
    __publicField(this, "ms");
    this.action = action;
  }
  start(ms2) {
    if (this.timeoutId) {
      throw new Error("Timeout is already started.");
    }
    this.ms = ms2;
    this.timeoutId = window.setTimeout(this.action, this.ms);
  }
  restart(ms2) {
    if (this.timeoutId) clearTimeout(this.timeoutId);
    if (ms2) this.ms = ms2;
    if (!this.ms) return;
    this.timeoutId = window.setTimeout(this.action, this.ms);
  }
  clear() {
    clearTimeout(this.timeoutId);
    this.timeoutId = void 0;
  }
}
class RequestsContainer {
  constructor(requestProcessQueueCallback, bandwidthCalculators, playback, config, eventTarget) {
    __publicField(this, "requests", /* @__PURE__ */ new Map());
    this.requestProcessQueueCallback = requestProcessQueueCallback;
    this.bandwidthCalculators = bandwidthCalculators;
    this.playback = playback;
    this.config = config;
    this.eventTarget = eventTarget;
  }
  get executingHttpCount() {
    let count = 0;
    for (const request of this.httpRequests()) {
      if (request.status === "loading") count++;
    }
    return count;
  }
  get executingP2PCount() {
    let count = 0;
    for (const request of this.p2pRequests()) {
      if (request.status === "loading") count++;
    }
    return count;
  }
  get(segment) {
    return this.requests.get(segment);
  }
  getOrCreateRequest(segment) {
    let request = this.requests.get(segment);
    if (!request) {
      request = new Request$1(
        segment,
        this.requestProcessQueueCallback,
        this.bandwidthCalculators,
        this.playback,
        this.config,
        this.eventTarget
      );
      this.requests.set(segment, request);
    }
    return request;
  }
  remove(request) {
    this.requests.delete(request.segment);
  }
  items() {
    return this.requests.values();
  }
  *httpRequests() {
    for (const request of this.requests.values()) {
      if (request.downloadSource === "http") yield request;
    }
  }
  *p2pRequests() {
    for (const request of this.requests.values()) {
      if (request.downloadSource === "p2p") yield request;
    }
  }
  destroy() {
    for (const request of this.requests.values()) {
      if (request.status !== "loading") continue;
      request.abortFromProcessQueue();
    }
    this.requests.clear();
  }
}
class EngineRequest {
  constructor(segment, engineCallbacks) {
    __publicField(this, "_status", "pending");
    __publicField(this, "_shouldBeStartedImmediately", false);
    this.segment = segment;
    this.engineCallbacks = engineCallbacks;
  }
  get status() {
    return this._status;
  }
  get shouldBeStartedImmediately() {
    return this._shouldBeStartedImmediately;
  }
  resolve(data, bandwidth) {
    if (this._status !== "pending") return;
    this._status = "succeed";
    this.engineCallbacks.onSuccess({ data, bandwidth });
  }
  reject() {
    if (this._status !== "pending") return;
    this._status = "failed";
    this.engineCallbacks.onError(new CoreRequestError("failed"));
  }
  abort() {
    if (this._status !== "pending") return;
    this._status = "aborted";
    this.engineCallbacks.onError(new CoreRequestError("aborted"));
  }
  markAsShouldBeStartedImmediately() {
    this._shouldBeStartedImmediately = true;
  }
}
function* generateQueue(lastRequestedSegment, playback, playbackConfig, currentP2PLoader) {
  const { runtimeId, stream } = lastRequestedSegment;
  const requestedSegment = stream.segments.get(runtimeId);
  if (!requestedSegment) return;
  const queueSegments = stream.segments.values();
  let first;
  do {
    const next = queueSegments.next();
    if (next.done) return;
    first = next.value;
  } while (first !== requestedSegment);
  const firstStatuses = getSegmentPlaybackStatuses(
    first,
    playback,
    playbackConfig,
    currentP2PLoader
  );
  if (isNotActualStatuses(firstStatuses)) {
    const next = queueSegments.next();
    if (next.done) return;
    const second = next.value;
    const secondStatuses = getSegmentPlaybackStatuses(
      second,
      playback,
      playbackConfig,
      currentP2PLoader
    );
    if (isNotActualStatuses(secondStatuses)) return;
    firstStatuses.isHighDemand = true;
    yield { segment: first, statuses: firstStatuses };
    yield { segment: second, statuses: secondStatuses };
  } else {
    yield { segment: first, statuses: firstStatuses };
  }
  for (const segment of queueSegments) {
    const statuses = getSegmentPlaybackStatuses(
      segment,
      playback,
      playbackConfig,
      currentP2PLoader
    );
    if (isNotActualStatuses(statuses)) break;
    yield { segment, statuses };
  }
}
function isNotActualStatuses(statuses) {
  const {
    isHighDemand = false,
    isHttpDownloadable = false,
    isP2PDownloadable = false
  } = statuses;
  return !isHighDemand && !isHttpDownloadable && !isP2PDownloadable;
}
const FAILED_ATTEMPTS_CLEAR_INTERVAL = 6e4;
const PEER_UPDATE_LATENCY = 1e3;
class HybridLoader {
  constructor(streamManifestUrl, lastRequestedSegment, streamDetails, config, bandwidthCalculators, segmentStorage, eventTarget) {
    __publicField(this, "requests");
    __publicField(this, "engineRequest");
    __publicField(this, "p2pLoaders");
    __publicField(this, "playback");
    __publicField(this, "segmentAvgDuration");
    __publicField(this, "logger");
    __publicField(this, "storageCleanUpIntervalId");
    __publicField(this, "levelChangedTimestamp");
    __publicField(this, "lastQueueProcessingTimeStamp");
    __publicField(this, "randomHttpDownloadInterval");
    __publicField(this, "isProcessQueueMicrotaskCreated", false);
    __publicField(this, "requestProcessQueueMicrotask", (force = true) => {
      const now = performance.now();
      if (!force && this.lastQueueProcessingTimeStamp !== void 0 && now - this.lastQueueProcessingTimeStamp <= 1e3 || this.isProcessQueueMicrotaskCreated) {
        return;
      }
      this.isProcessQueueMicrotaskCreated = true;
      queueMicrotask(() => {
        try {
          this.processQueue();
          this.lastQueueProcessingTimeStamp = now;
        } finally {
          this.isProcessQueueMicrotaskCreated = false;
        }
      });
    });
    this.streamManifestUrl = streamManifestUrl;
    this.lastRequestedSegment = lastRequestedSegment;
    this.streamDetails = streamDetails;
    this.config = config;
    this.bandwidthCalculators = bandwidthCalculators;
    this.segmentStorage = segmentStorage;
    this.eventTarget = eventTarget;
    const activeStream = this.lastRequestedSegment.stream;
    this.playback = { position: this.lastRequestedSegment.startTime, rate: 1 };
    this.segmentAvgDuration = getSegmentAvgDuration(activeStream);
    this.requests = new RequestsContainer(
      this.requestProcessQueueMicrotask,
      this.bandwidthCalculators,
      this.playback,
      this.config,
      this.eventTarget
    );
    if (!this.segmentStorage.isInitialized) {
      throw new Error("Segment storage is not initialized.");
    }
    this.segmentStorage.addIsSegmentLockedPredicate((segment) => {
      if (segment.stream !== activeStream) return false;
      return isSegmentActualInPlayback(
        segment,
        this.playback,
        this.config
      );
    });
    this.p2pLoaders = new P2PLoadersContainer(
      this.streamManifestUrl,
      this.lastRequestedSegment.stream,
      this.requests,
      this.segmentStorage,
      this.config,
      this.eventTarget,
      this.requestProcessQueueMicrotask
    );
    this.logger = debug$3(`p2pml-core:hybrid-loader-${activeStream.type}`);
    this.logger.color = "coral";
    this.setIntervalLoading();
  }
  setIntervalLoading() {
    const peersCount = this.p2pLoaders.currentLoader.connectedPeerCount;
    const randomTimeout = Math.random() * PEER_UPDATE_LATENCY * peersCount + PEER_UPDATE_LATENCY;
    this.randomHttpDownloadInterval = window.setTimeout(() => {
      this.loadRandomThroughHttp();
      this.setIntervalLoading();
    }, randomTimeout);
  }
  // api method for engines
  async loadSegment(segment, callbacks) {
    this.logger(`requests: ${getSegmentString(segment)}`);
    const { stream } = segment;
    if (stream !== this.lastRequestedSegment.stream) {
      this.logger(`stream changed to ${getStreamString(stream)}`);
      this.p2pLoaders.changeCurrentLoader(stream);
    }
    this.lastRequestedSegment = segment;
    const engineRequest = new EngineRequest(segment, callbacks);
    if (this.segmentStorage.hasSegment(segment)) {
      const data = await this.segmentStorage.getSegmentData(segment);
      if (data) {
        const { queueDownloadRatio } = this.generateQueue();
        engineRequest.resolve(data, this.getBandwidth(queueDownloadRatio));
      }
    } else {
      this.engineRequest = engineRequest;
    }
    this.requestProcessQueueMicrotask();
  }
  processRequests(queueSegmentIds, queueDownloadRatio) {
    var _a;
    const { stream } = this.lastRequestedSegment;
    const { httpErrorRetries } = this.config;
    const now = performance.now();
    for (const request of this.requests.items()) {
      const {
        downloadSource: type,
        status,
        segment,
        isHandledByProcessQueue
      } = request;
      const engineRequest = ((_a = this.engineRequest) == null ? void 0 : _a.segment) === segment ? this.engineRequest : void 0;
      switch (status) {
        case "loading":
          if (!queueSegmentIds.has(segment.runtimeId) && !engineRequest) {
            request.abortFromProcessQueue();
            this.requests.remove(request);
          }
          break;
        case "succeed":
          if (!request.data || !type) break;
          if (type === "http") {
            this.p2pLoaders.currentLoader.broadcastAnnouncement();
          }
          if (engineRequest) {
            engineRequest.resolve(
              request.data,
              this.getBandwidth(queueDownloadRatio)
            );
            this.engineRequest = void 0;
          }
          this.requests.remove(request);
          void this.segmentStorage.storeSegment(
            request.segment,
            request.data,
            this.streamDetails.isLive
          );
          break;
        case "failed":
          if (type === "http" && !isHandledByProcessQueue) {
            this.p2pLoaders.currentLoader.broadcastAnnouncement();
          }
          if (!engineRequest && !stream.segments.has(request.segment.runtimeId)) {
            this.requests.remove(request);
          }
          if (request.failedAttempts.httpAttemptsCount >= httpErrorRetries && engineRequest) {
            this.engineRequest = void 0;
            engineRequest.reject();
          }
          break;
        case "not-started":
          this.requests.remove(request);
          break;
        case "aborted":
          this.requests.remove(request);
          break;
      }
      request.markHandledByProcessQueue();
      const { lastAttempt } = request.failedAttempts;
      if (lastAttempt && now - lastAttempt.error.timestamp > FAILED_ATTEMPTS_CLEAR_INTERVAL) {
        request.failedAttempts.clear();
      }
    }
  }
  processQueue() {
    var _a;
    const { queue: queue2, queueSegmentIds, queueDownloadRatio } = this.generateQueue();
    this.processRequests(queueSegmentIds, queueDownloadRatio);
    const {
      simultaneousHttpDownloads,
      simultaneousP2PDownloads,
      httpErrorRetries
    } = this.config;
    if (((_a = this.engineRequest) == null ? void 0 : _a.shouldBeStartedImmediately) && this.engineRequest.status === "pending" && this.requests.executingHttpCount < simultaneousHttpDownloads) {
      const { segment } = this.engineRequest;
      const request = this.requests.get(segment);
      if (!request || request.status === "not-started" || request.status === "failed" && request.failedAttempts.httpAttemptsCount < this.config.httpErrorRetries) {
        this.loadThroughHttp(segment);
      }
    }
    for (const item of queue2) {
      const { statuses, segment } = item;
      const request = this.requests.get(segment);
      if (statuses.isHighDemand) {
        if ((request == null ? void 0 : request.downloadSource) === "http" && request.status === "loading") {
          continue;
        }
        if ((request == null ? void 0 : request.downloadSource) === "http" && request.status === "failed" && request.failedAttempts.httpAttemptsCount >= httpErrorRetries) {
          continue;
        }
        const isP2PLoadingRequest = (request == null ? void 0 : request.status) === "loading" && request.downloadSource === "p2p";
        if (this.requests.executingHttpCount < simultaneousHttpDownloads) {
          if (isP2PLoadingRequest) request.abortFromProcessQueue();
          this.loadThroughHttp(segment);
          continue;
        }
        if (this.abortLastHttpLoadingInQueueAfterItem(queue2, segment) && this.requests.executingHttpCount < simultaneousHttpDownloads) {
          if (isP2PLoadingRequest) request.abortFromProcessQueue();
          this.loadThroughHttp(segment);
          continue;
        }
        if (isP2PLoadingRequest) continue;
        if (this.requests.executingP2PCount < simultaneousP2PDownloads) {
          this.loadThroughP2P(segment);
          continue;
        }
        if (this.abortLastP2PLoadingInQueueAfterItem(queue2, segment) && this.requests.executingP2PCount < simultaneousP2PDownloads) {
          this.loadThroughP2P(segment);
          continue;
        }
      } else if (statuses.isP2PDownloadable) {
        if ((request == null ? void 0 : request.status) === "loading") continue;
        if (this.requests.executingP2PCount < simultaneousP2PDownloads) {
          this.loadThroughP2P(segment);
        } else if (this.p2pLoaders.currentLoader.isSegmentLoadedBySomeone(segment) && this.abortLastP2PLoadingInQueueAfterItem(queue2, segment) && this.requests.executingP2PCount < simultaneousP2PDownloads) {
          this.loadThroughP2P(segment);
        }
      }
    }
  }
  // api method for engines
  abortSegmentRequest(segmentRuntimeId) {
    var _a;
    if (((_a = this.engineRequest) == null ? void 0 : _a.segment.runtimeId) !== segmentRuntimeId) return;
    this.engineRequest.abort();
    this.logger(
      "abort: ",
      getSegmentString(this.engineRequest.segment)
    );
    this.engineRequest = void 0;
    this.requestProcessQueueMicrotask();
  }
  loadThroughHttp(segment) {
    const request = this.requests.getOrCreateRequest(segment);
    new HttpRequestExecutor(request, this.config, this.eventTarget);
    this.p2pLoaders.currentLoader.broadcastAnnouncement();
  }
  loadThroughP2P(segment) {
    this.p2pLoaders.currentLoader.downloadSegment(segment);
  }
  loadRandomThroughHttp() {
    const { simultaneousHttpDownloads, httpErrorRetries } = this.config;
    const p2pLoader = this.p2pLoaders.currentLoader;
    if (this.requests.executingHttpCount >= simultaneousHttpDownloads || !p2pLoader.connectedPeerCount) {
      return;
    }
    const segmentsToLoad = [];
    for (const { segment, statuses } of generateQueue(
      this.lastRequestedSegment,
      this.playback,
      this.config,
      this.p2pLoaders.currentLoader
    )) {
      if (!statuses.isHttpDownloadable || statuses.isP2PDownloadable || this.segmentStorage.hasSegment(segment)) {
        continue;
      }
      const request = this.requests.get(segment);
      if (request && (request.status === "loading" || request.status === "succeed" || (request.failedAttempts.httpAttemptsCount ?? 0) >= httpErrorRetries)) {
        continue;
      }
      segmentsToLoad.push(segment);
    }
    if (!segmentsToLoad.length) return;
    const availableHttpDownloads = simultaneousHttpDownloads - this.requests.executingHttpCount;
    if (availableHttpDownloads === 0) return;
    const peersCount = p2pLoader.connectedPeerCount + 1;
    const safeRandomSegmentsCount = Math.min(
      segmentsToLoad.length,
      simultaneousHttpDownloads * peersCount
    );
    const randomIndices = shuffleArray(
      Array.from({ length: safeRandomSegmentsCount }, (_, i) => i)
    );
    let probability = safeRandomSegmentsCount / peersCount;
    for (const randomIndex of randomIndices) {
      if (this.requests.executingHttpCount >= simultaneousHttpDownloads) {
        break;
      }
      if (probability >= 1 || Math.random() <= probability) {
        const segment = segmentsToLoad[randomIndex];
        this.loadThroughHttp(segment);
      }
      probability--;
      if (probability <= 0) break;
    }
  }
  abortLastHttpLoadingInQueueAfterItem(queue2, segment) {
    for (const { segment: itemSegment } of arrayBackwards(queue2)) {
      if (itemSegment === segment) break;
      const request = this.requests.get(itemSegment);
      if ((request == null ? void 0 : request.downloadSource) === "http" && request.status === "loading") {
        request.abortFromProcessQueue();
        return true;
      }
    }
    return false;
  }
  abortLastP2PLoadingInQueueAfterItem(queue2, segment) {
    for (const { segment: itemSegment } of arrayBackwards(queue2)) {
      if (itemSegment === segment) break;
      const request = this.requests.get(itemSegment);
      if ((request == null ? void 0 : request.downloadSource) === "p2p" && request.status === "loading") {
        request.abortFromProcessQueue();
        return true;
      }
    }
    return false;
  }
  generateQueue() {
    var _a;
    const queue2 = [];
    const queueSegmentIds = /* @__PURE__ */ new Set();
    let maxPossibleLength = 0;
    let alreadyLoadedCount = 0;
    for (const item of generateQueue(
      this.lastRequestedSegment,
      this.playback,
      this.config,
      this.p2pLoaders.currentLoader
    )) {
      maxPossibleLength++;
      const { segment } = item;
      if (this.segmentStorage.hasSegment(segment) || ((_a = this.requests.get(segment)) == null ? void 0 : _a.status) === "succeed") {
        alreadyLoadedCount++;
        continue;
      }
      queue2.push(item);
      queueSegmentIds.add(segment.runtimeId);
    }
    return {
      queue: queue2,
      queueSegmentIds,
      maxPossibleLength,
      alreadyLoadedCount,
      queueDownloadRatio: maxPossibleLength !== 0 ? alreadyLoadedCount / maxPossibleLength : 0
    };
  }
  getBandwidth(queueDownloadRatio) {
    const { http, all } = this.bandwidthCalculators;
    const { activeLevelBitrate } = this.streamDetails;
    if (this.streamDetails.activeLevelBitrate === 0) {
      return all.getBandwidthLoadingOnly(3);
    }
    const bandwidth = Math.max(
      all.getBandwidth(30, this.levelChangedTimestamp),
      all.getBandwidth(60, this.levelChangedTimestamp),
      all.getBandwidth(90, this.levelChangedTimestamp)
    );
    if (queueDownloadRatio >= 0.8 || bandwidth >= activeLevelBitrate * 0.9) {
      return Math.max(
        all.getBandwidthLoadingOnly(1),
        all.getBandwidthLoadingOnly(3),
        all.getBandwidthLoadingOnly(5)
      );
    }
    const httpRealBandwidth = Math.max(
      http.getBandwidthLoadingOnly(1),
      http.getBandwidthLoadingOnly(3),
      http.getBandwidthLoadingOnly(5)
    );
    return Math.max(bandwidth, httpRealBandwidth);
  }
  notifyLevelChanged() {
    this.levelChangedTimestamp = performance.now();
  }
  updatePlayback(position, rate) {
    var _a;
    const isRateChanged = this.playback.rate !== rate;
    const isPositionChanged = this.playback.position !== position;
    if (!isRateChanged && !isPositionChanged) return;
    const isPositionSignificantlyChanged = Math.abs(position - this.playback.position) / this.segmentAvgDuration > 0.5;
    if (isPositionChanged) this.playback.position = position;
    if (isRateChanged && rate !== 0) this.playback.rate = rate;
    if (isPositionSignificantlyChanged) {
      this.logger("position significantly changed");
      (_a = this.engineRequest) == null ? void 0 : _a.markAsShouldBeStartedImmediately();
    }
    void this.requestProcessQueueMicrotask(isPositionSignificantlyChanged);
  }
  updateStream(stream) {
    if (stream !== this.lastRequestedSegment.stream) return;
    this.logger(`update stream: ${getStreamString(stream)}`);
    this.requestProcessQueueMicrotask();
  }
  destroy() {
    var _a;
    clearInterval(this.storageCleanUpIntervalId);
    clearInterval(this.randomHttpDownloadInterval);
    this.storageCleanUpIntervalId = void 0;
    (_a = this.engineRequest) == null ? void 0 : _a.abort();
    this.requests.destroy();
    this.p2pLoaders.destroy();
  }
}
class BandwidthCalculator {
  constructor(clearThresholdMs = 2e4) {
    __publicField(this, "loadingsCount", 0);
    __publicField(this, "bytes", []);
    __publicField(this, "loadingOnlyTimestamps", []);
    __publicField(this, "timestamps", []);
    __publicField(this, "noLoadingsTime", 0);
    __publicField(this, "loadingsStoppedAt", 0);
    this.clearThresholdMs = clearThresholdMs;
  }
  addBytes(bytesLength, now = performance.now()) {
    this.bytes.push(bytesLength);
    this.loadingOnlyTimestamps.push(now - this.noLoadingsTime);
    this.timestamps.push(now);
  }
  startLoading(now = performance.now()) {
    this.clearStale();
    if (this.loadingsCount === 0 && this.loadingsStoppedAt !== 0) {
      this.noLoadingsTime += now - this.loadingsStoppedAt;
    }
    this.loadingsCount++;
  }
  stopLoading(now = performance.now()) {
    if (this.loadingsCount > 0) {
      this.loadingsCount--;
      if (this.loadingsCount === 0) this.loadingsStoppedAt = now;
    }
  }
  getBandwidthLoadingOnly(seconds, ignoreThresholdTimestamp = Number.NEGATIVE_INFINITY) {
    if (!this.loadingOnlyTimestamps.length) return 0;
    const milliseconds = seconds * 1e3;
    const lastItemTimestamp = this.loadingOnlyTimestamps[this.loadingOnlyTimestamps.length - 1];
    let lastCountedTimestamp = lastItemTimestamp;
    const threshold = lastItemTimestamp - milliseconds;
    let totalBytes = 0;
    for (let i = this.bytes.length - 1; i >= 0; i--) {
      const timestamp = this.loadingOnlyTimestamps[i];
      if (timestamp < threshold || this.timestamps[i] < ignoreThresholdTimestamp) {
        break;
      }
      lastCountedTimestamp = timestamp;
      totalBytes += this.bytes[i];
    }
    return totalBytes * 8e3 / (lastItemTimestamp - lastCountedTimestamp);
  }
  getBandwidth(seconds, ignoreThresholdTimestamp = Number.NEGATIVE_INFINITY, now = performance.now()) {
    if (!this.timestamps.length) return 0;
    const milliseconds = seconds * 1e3;
    const threshold = now - milliseconds;
    let lastCountedTimestamp = now;
    let totalBytes = 0;
    for (let i = this.bytes.length - 1; i >= 0; i--) {
      const timestamp = this.timestamps[i];
      if (timestamp < threshold || timestamp < ignoreThresholdTimestamp) break;
      lastCountedTimestamp = timestamp;
      totalBytes += this.bytes[i];
    }
    return totalBytes * 8e3 / (now - lastCountedTimestamp);
  }
  clearStale() {
    if (!this.loadingOnlyTimestamps.length) return;
    const threshold = this.loadingOnlyTimestamps[this.loadingOnlyTimestamps.length - 1] - this.clearThresholdMs;
    let samplesToRemove = 0;
    for (const timestamp of this.loadingOnlyTimestamps) {
      if (timestamp > threshold) break;
      samplesToRemove++;
    }
    this.bytes.splice(0, samplesToRemove);
    this.loadingOnlyTimestamps.splice(0, samplesToRemove);
    this.timestamps.splice(0, samplesToRemove);
  }
}
class EventTarget {
  constructor() {
    __publicField(this, "events", /* @__PURE__ */ new Map());
  }
  dispatchEvent(eventName, ...args) {
    const listeners2 = this.events.get(eventName);
    if (!listeners2) return;
    for (const listener of listeners2) {
      listener(...args);
    }
  }
  getEventDispatcher(eventName) {
    let listeners2 = this.events.get(eventName);
    if (!listeners2) {
      listeners2 = [];
      this.events.set(eventName, listeners2);
    }
    const definedListeners = listeners2;
    return (...args) => {
      for (const listener of definedListeners) {
        listener(...args);
      }
    };
  }
  addEventListener(eventName, listener) {
    const listeners2 = this.events.get(eventName);
    if (!listeners2) {
      this.events.set(eventName, [listener]);
    } else {
      listeners2.push(listener);
    }
  }
  removeEventListener(eventName, listener) {
    const listeners2 = this.events.get(eventName);
    if (listeners2) {
      const index = listeners2.indexOf(listener);
      if (index !== -1) {
        listeners2.splice(index, 1);
      }
    }
  }
}
function getStorageItemId(segment) {
  const streamId = getStreamId(segment.stream);
  return `${streamId}|${segment.externalId}`;
}
const DEFAULT_LIVE_CACHED_SEGMENT_EXPIRATION = 1200;
class SegmentsMemoryStorage {
  constructor(storageConfig) {
    __publicField(this, "cache", /* @__PURE__ */ new Map());
    __publicField(this, "_isInitialized", false);
    __publicField(this, "isSegmentLockedPredicates", []);
    __publicField(this, "logger");
    __publicField(this, "eventTarget", new EventTarget());
    this.storageConfig = storageConfig;
    this.logger = debug$3("p2pml-core:segment-memory-storage");
    this.logger.color = "RebeccaPurple";
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async initialize() {
    this._isInitialized = true;
    this.logger("initialized");
  }
  get isInitialized() {
    return this._isInitialized;
  }
  addIsSegmentLockedPredicate(predicate) {
    this.isSegmentLockedPredicates.push(predicate);
  }
  isSegmentLocked(segment) {
    return this.isSegmentLockedPredicates.some((p) => p(segment));
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async storeSegment(segment, data, isLiveStream) {
    const id = getStorageItemId(segment);
    this.cache.set(id, {
      segment,
      data,
      lastAccessed: performance.now()
    });
    this.logger(`add segment: ${id}`);
    this.dispatchStorageUpdatedEvent(segment.stream);
    void this.clear(isLiveStream);
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async getSegmentData(segment) {
    const itemId = getStorageItemId(segment);
    const cacheItem = this.cache.get(itemId);
    if (cacheItem === void 0) return void 0;
    cacheItem.lastAccessed = performance.now();
    return cacheItem.data;
  }
  hasSegment(segment) {
    const id = getStorageItemId(segment);
    return this.cache.has(id);
  }
  getStoredSegmentExternalIdsOfStream(stream) {
    const streamId = getStreamId(stream);
    const externalIds = [];
    for (const { segment } of this.cache.values()) {
      const itemStreamId = getStreamId(segment.stream);
      if (itemStreamId === streamId) externalIds.push(segment.externalId);
    }
    return externalIds;
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async clear(isLiveStream) {
    const cacheSegmentExpiration = (this.storageConfig.cachedSegmentExpiration ?? (isLiveStream ? DEFAULT_LIVE_CACHED_SEGMENT_EXPIRATION : 0)) * 1e3;
    if (cacheSegmentExpiration === 0) return false;
    const itemsToDelete = [];
    const remainingItems = [];
    const streamsOfChangedItems = /* @__PURE__ */ new Set();
    const now = performance.now();
    for (const entry of this.cache.entries()) {
      const [itemId, item] = entry;
      const { lastAccessed, segment } = item;
      if (now - lastAccessed > cacheSegmentExpiration) {
        if (!this.isSegmentLocked(segment)) {
          itemsToDelete.push(itemId);
          streamsOfChangedItems.add(segment.stream);
        }
      } else {
        remainingItems.push(entry);
      }
    }
    if (this.storageConfig.cachedSegmentsCount > 0) {
      let countOverhead = remainingItems.length - this.storageConfig.cachedSegmentsCount;
      if (countOverhead > 0) {
        remainingItems.sort(([, a], [, b]) => a.lastAccessed - b.lastAccessed);
        for (const [itemId, { segment }] of remainingItems) {
          if (!this.isSegmentLocked(segment)) {
            itemsToDelete.push(itemId);
            streamsOfChangedItems.add(segment.stream);
            countOverhead--;
            if (countOverhead === 0) break;
          }
        }
      }
    }
    if (itemsToDelete.length) {
      this.logger(`cleared ${itemsToDelete.length} segments`);
      itemsToDelete.forEach((id) => this.cache.delete(id));
      for (const stream of streamsOfChangedItems) {
        this.dispatchStorageUpdatedEvent(stream);
      }
    }
    return itemsToDelete.length > 0;
  }
  subscribeOnUpdate(stream, listener) {
    const streamId = getStreamId(stream);
    this.eventTarget.addEventListener(`onStorageUpdated-${streamId}`, listener);
  }
  unsubscribeFromUpdate(stream, listener) {
    const streamId = getStreamId(stream);
    this.eventTarget.removeEventListener(
      `onStorageUpdated-${streamId}`,
      listener
    );
  }
  dispatchStorageUpdatedEvent(stream) {
    this.eventTarget.dispatchEvent(
      `onStorageUpdated-${getStreamId(stream)}`,
      stream
    );
  }
  // eslint-disable-next-line @typescript-eslint/require-await
  async destroy() {
    this.cache.clear();
    this._isInitialized = false;
  }
}
const _Core = class _Core {
  /**
   * Constructs a new Core instance with optional initial configuration.
   *
   * @param config - Optional partial configuration to override default settings.
   *
   * @example
   * // Create a Core instance with custom configuration for HTTP and P2P downloads.
   * const core = new Core({
   *   simultaneousHttpDownloads: 5,
   *   simultaneousP2PDownloads: 5,
   *   httpErrorRetries: 5,
   *   p2pErrorRetries: 5
   * });
   *
   * @example
   * // Create a Core instance using the default configuration.
   * const core = new Core();
   */
  constructor(config) {
    __publicField(this, "eventTarget", new EventTarget());
    __publicField(this, "manifestResponseUrl");
    __publicField(this, "streams", /* @__PURE__ */ new Map());
    __publicField(this, "mainStreamConfig");
    __publicField(this, "secondaryStreamConfig");
    __publicField(this, "commonCoreConfig");
    __publicField(this, "bandwidthCalculators", {
      all: new BandwidthCalculator(),
      http: new BandwidthCalculator()
    });
    __publicField(this, "segmentStorage");
    __publicField(this, "mainStreamLoader");
    __publicField(this, "secondaryStreamLoader");
    __publicField(this, "streamDetails", {
      isLive: false,
      activeLevelBitrate: 0
    });
    const filteredConfig = filterUndefinedProps(config ?? {});
    this.commonCoreConfig = mergeAndFilterConfig({
      defaultConfig: _Core.DEFAULT_COMMON_CORE_CONFIG,
      baseConfig: filteredConfig
    });
    this.mainStreamConfig = mergeAndFilterConfig({
      defaultConfig: _Core.DEFAULT_STREAM_CONFIG,
      baseConfig: filteredConfig,
      specificStreamConfig: filteredConfig == null ? void 0 : filteredConfig.mainStream
    });
    this.secondaryStreamConfig = mergeAndFilterConfig({
      defaultConfig: _Core.DEFAULT_STREAM_CONFIG,
      baseConfig: filteredConfig,
      specificStreamConfig: filteredConfig == null ? void 0 : filteredConfig.secondaryStream
    });
  }
  /**
   * Retrieves the current configuration for the core instance, ensuring immutability.
   *
   * @returns A deep readonly version of the core configuration.
   */
  getConfig() {
    return {
      ...deepCopy(this.commonCoreConfig),
      mainStream: deepCopy(this.mainStreamConfig),
      secondaryStream: deepCopy(this.secondaryStreamConfig)
    };
  }
  /**
   * Applies a set of dynamic configuration updates to the core, merging with the existing configuration.
   *
   * @param dynamicConfig - A set of configuration changes to apply.
   *
   * @example
   * // Example of dynamically updating the download time windows and timeout settings.
   * const dynamicConfig = {
   *   httpDownloadTimeWindowMs: 60,  // Set HTTP download time window to 60 seconds
   *   p2pDownloadTimeWindowMs: 60,   // Set P2P download time window to 60 seconds
   *   httpNotReceivingBytesTimeoutMs: 1500,  // Set HTTP timeout to 1500 milliseconds
   *   p2pNotReceivingBytesTimeoutMs: 1500    // Set P2P timeout to 1500 milliseconds
   * };
   * core.applyDynamicConfig(dynamicConfig);
   */
  applyDynamicConfig(dynamicConfig) {
    const { mainStream, secondaryStream } = dynamicConfig;
    this.overrideAllConfigs(dynamicConfig, mainStream, secondaryStream);
    if (this.mainStreamConfig.isP2PDisabled) {
      this.destroyStreamLoader("main");
    }
    if (this.secondaryStreamConfig.isP2PDisabled) {
      this.destroyStreamLoader("secondary");
    }
  }
  /**
   * Adds an event listener for the specified event type on the core event target.
   *
   * @param eventName - The name of the event to listen for.
   * @param listener - The callback function to invoke when the event is fired.
   */
  addEventListener(eventName, listener) {
    this.eventTarget.addEventListener(eventName, listener);
  }
  /**
   * Removes an event listener for the specified event type on the core event target.
   *
   * @param eventName - The name of the event to listen for.
   * @param listener - The callback function to be removed.
   */
  removeEventListener(eventName, listener) {
    this.eventTarget.removeEventListener(eventName, listener);
  }
  /**
   * Sets the response URL for the manifest, stripping any query parameters.
   *
   * @param url - The full URL to the manifest response.
   */
  setManifestResponseUrl(url) {
    this.manifestResponseUrl = url.split("?")[0];
  }
  /**
   * Checks if a segment is already stored within the core.
   *
   * @param segmentRuntimeId - The runtime identifier of the segment to check.
   * @returns `true` if the segment is present, otherwise `false`.
   */
  hasSegment(segmentRuntimeId) {
    return !!getSegmentFromStreamsMap(
      this.streams,
      segmentRuntimeId
    );
  }
  /**
   * Retrieves a specific stream by its runtime identifier, if it exists.
   *
   * @param streamRuntimeId - The runtime identifier of the stream to retrieve.
   * @returns The stream with its segments, or `undefined` if not found.
   */
  getStream(streamRuntimeId) {
    return this.streams.get(streamRuntimeId);
  }
  /**
   * Ensures a stream exists in the map; adds it if it does not.
   *
   * @param stream - The stream to potentially add to the map.
   */
  addStreamIfNoneExists(stream) {
    if (this.streams.has(stream.runtimeId)) return;
    this.streams.set(stream.runtimeId, {
      ...stream,
      segments: /* @__PURE__ */ new Map()
    });
  }
  /**
   * Updates the segments associated with a specific stream.
   *
   * @param streamRuntimeId - The runtime identifier of the stream to update.
   * @param addSegments - Optional segments to add to the stream.
   * @param removeSegmentIds - Optional segment IDs to remove from the stream.
   */
  updateStream(streamRuntimeId, addSegments, removeSegmentIds) {
    var _a, _b;
    const stream = this.streams.get(streamRuntimeId);
    if (!stream) return;
    if (addSegments) {
      for (const segment of addSegments) {
        if (stream.segments.has(segment.runtimeId)) continue;
        stream.segments.set(segment.runtimeId, { ...segment, stream });
      }
    }
    if (removeSegmentIds) {
      for (const id of removeSegmentIds) {
        stream.segments.delete(id);
      }
    }
    (_a = this.mainStreamLoader) == null ? void 0 : _a.updateStream(stream);
    (_b = this.secondaryStreamLoader) == null ? void 0 : _b.updateStream(stream);
  }
  /**
   * Loads a segment given its runtime identifier and invokes the provided callbacks during the process.
   * Initializes segment storage if it has not been initialized yet.
   *
   * @param segmentRuntimeId - The runtime identifier of the segment to load.
   * @param callbacks - The callbacks to be invoked during segment loading.
   * @throws {Error} - Throws if the manifest response URL is not defined.
   */
  async loadSegment(segmentRuntimeId, callbacks) {
    if (!this.manifestResponseUrl) {
      throw new Error("Manifest response url is not defined");
    }
    if (!this.segmentStorage) {
      this.segmentStorage = new SegmentsMemoryStorage(this.commonCoreConfig);
      await this.segmentStorage.initialize();
    }
    const segment = this.identifySegment(segmentRuntimeId);
    const loader = this.getStreamHybridLoader(segment);
    void loader.loadSegment(segment, callbacks);
  }
  /**
   * Aborts the loading of a segment specified by its runtime identifier.
   *
   * @param segmentRuntimeId - The runtime identifier of the segment whose loading is to be aborted.
   */
  abortSegmentLoading(segmentRuntimeId) {
    var _a, _b;
    (_a = this.mainStreamLoader) == null ? void 0 : _a.abortSegmentRequest(segmentRuntimeId);
    (_b = this.secondaryStreamLoader) == null ? void 0 : _b.abortSegmentRequest(segmentRuntimeId);
  }
  /**
   * Updates the playback parameters while play head moves, specifically position and playback rate, for stream loaders.
   *
   * @param position - The new position in the stream, in seconds.
   * @param rate - The new playback rate.
   */
  updatePlayback(position, rate) {
    var _a, _b;
    (_a = this.mainStreamLoader) == null ? void 0 : _a.updatePlayback(position, rate);
    (_b = this.secondaryStreamLoader) == null ? void 0 : _b.updatePlayback(position, rate);
  }
  /**
   * Sets the active level bitrate, used for adjusting quality levels in adaptive streaming.
   * Notifies the stream loaders if a change occurs.
   *
   * @param bitrate - The new bitrate to set as active.
   */
  setActiveLevelBitrate(bitrate) {
    var _a, _b;
    if (bitrate !== this.streamDetails.activeLevelBitrate) {
      this.streamDetails.activeLevelBitrate = bitrate;
      (_a = this.mainStreamLoader) == null ? void 0 : _a.notifyLevelChanged();
      (_b = this.secondaryStreamLoader) == null ? void 0 : _b.notifyLevelChanged();
    }
  }
  /**
   * Updates the 'isLive' status of the stream.
   *
   * @param isLive - Boolean indicating whether the stream is live.
   */
  setIsLive(isLive) {
    this.streamDetails.isLive = isLive;
  }
  /**
   * Identify if a segment is loadable by the P2P core based on the segment's stream type and configuration.
   * @param segmentRuntimeId Segment runtime identifier to check.
   * @returns `true` if the segment is loadable by the P2P core, otherwise `false`.
   */
  isSegmentLoadable(segmentRuntimeId) {
    try {
      const segment = this.identifySegment(segmentRuntimeId);
      if (segment.stream.type === "main" && this.mainStreamConfig.isP2PDisabled) {
        return false;
      }
      if (segment.stream.type === "secondary" && this.secondaryStreamConfig.isP2PDisabled) {
        return false;
      }
      return true;
    } catch {
      return false;
    }
  }
  /**
   * Cleans up resources used by the Core instance, including destroying any active stream loaders
   * and clearing stored segments.
   */
  destroy() {
    var _a, _b, _c;
    this.streams.clear();
    (_a = this.mainStreamLoader) == null ? void 0 : _a.destroy();
    (_b = this.secondaryStreamLoader) == null ? void 0 : _b.destroy();
    void ((_c = this.segmentStorage) == null ? void 0 : _c.destroy());
    this.mainStreamLoader = void 0;
    this.secondaryStreamLoader = void 0;
    this.segmentStorage = void 0;
    this.manifestResponseUrl = void 0;
    this.streamDetails = { isLive: false, activeLevelBitrate: 0 };
  }
  identifySegment(segmentRuntimeId) {
    if (!this.manifestResponseUrl) {
      throw new Error("Manifest response url is undefined");
    }
    const segment = getSegmentFromStreamsMap(
      this.streams,
      segmentRuntimeId
    );
    if (!segment) {
      throw new Error(`Not found segment with id: ${segmentRuntimeId}`);
    }
    return segment;
  }
  overrideAllConfigs(dynamicConfig, mainStream, secondaryStream) {
    overrideConfig(this.commonCoreConfig, dynamicConfig);
    overrideConfig(this.mainStreamConfig, dynamicConfig);
    overrideConfig(this.secondaryStreamConfig, dynamicConfig);
    if (mainStream) {
      overrideConfig(this.mainStreamConfig, mainStream);
    }
    if (secondaryStream) {
      overrideConfig(this.secondaryStreamConfig, secondaryStream);
    }
  }
  destroyStreamLoader(streamType) {
    var _a, _b;
    if (streamType === "main") {
      (_a = this.mainStreamLoader) == null ? void 0 : _a.destroy();
      this.mainStreamLoader = void 0;
    } else {
      (_b = this.secondaryStreamLoader) == null ? void 0 : _b.destroy();
      this.secondaryStreamLoader = void 0;
    }
  }
  getStreamHybridLoader(segment) {
    if (segment.stream.type === "main") {
      this.mainStreamLoader ?? (this.mainStreamLoader = this.createNewHybridLoader(segment));
      return this.mainStreamLoader;
    } else {
      this.secondaryStreamLoader ?? (this.secondaryStreamLoader = this.createNewHybridLoader(segment));
      return this.secondaryStreamLoader;
    }
  }
  createNewHybridLoader(segment) {
    var _a;
    if (!this.manifestResponseUrl) {
      throw new Error("Manifest response url is not defined");
    }
    if (!((_a = this.segmentStorage) == null ? void 0 : _a.isInitialized)) {
      throw new Error("Segment storage is not initialized");
    }
    const streamConfig = segment.stream.type === "main" ? this.mainStreamConfig : this.secondaryStreamConfig;
    return new HybridLoader(
      this.manifestResponseUrl,
      segment,
      this.streamDetails,
      streamConfig,
      this.bandwidthCalculators,
      this.segmentStorage,
      this.eventTarget
    );
  }
};
/** Default configuration for common core settings. */
__publicField(_Core, "DEFAULT_COMMON_CORE_CONFIG", {
  cachedSegmentExpiration: void 0,
  cachedSegmentsCount: 0
});
/** Default configuration for stream settings. */
__publicField(_Core, "DEFAULT_STREAM_CONFIG", {
  isP2PDisabled: false,
  simultaneousHttpDownloads: 2,
  simultaneousP2PDownloads: 3,
  highDemandTimeWindow: 15,
  httpDownloadTimeWindow: 3e3,
  p2pDownloadTimeWindow: 6e3,
  webRtcMaxMessageSize: 64 * 1024 - 1,
  p2pNotReceivingBytesTimeoutMs: 2e3,
  p2pInactiveLoaderDestroyTimeoutMs: 30 * 1e3,
  httpNotReceivingBytesTimeoutMs: 3e3,
  httpErrorRetries: 3,
  p2pErrorRetries: 3,
  trackerClientVersionPrefix: TRACKER_CLIENT_VERSION_PREFIX,
  announceTrackers: [
    "wss://tracker.novage.com.ua",
    "wss://tracker.webtorrent.dev",
    "wss://tracker.openwebtorrent.com"
  ],
  rtcConfig: {
    iceServers: [
      { urls: "stun:stun.l.google.com:19302" },
      { urls: "stun:global.stun.twilio.com:3478" }
    ]
  },
  validateP2PSegment: void 0,
  httpRequestSetup: void 0,
  swarmId: void 0
});
let Core = _Core;
const debug$4 = browserExports$1.debug;
export {
  Core,
  CoreRequestError,
  RequestError,
  debug$4 as debug
};
//# sourceMappingURL=p2p-media-loader-core.es.js.map
