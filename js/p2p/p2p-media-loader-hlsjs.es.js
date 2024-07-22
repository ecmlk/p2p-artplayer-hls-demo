var __defProp = Object.defineProperty;
var __typeError = (msg) => {
  throw TypeError(msg);
};
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var __accessCheck = (obj, member, msg) => member.has(obj) || __typeError("Cannot " + msg);
var __privateGet = (obj, member, getter) => (__accessCheck(obj, member, "read from private field"), getter ? getter.call(obj) : member.get(obj));
var __privateAdd = (obj, member, value) => member.has(obj) ? __typeError("Cannot add the same private member more than once") : member instanceof WeakSet ? member.add(obj) : member.set(obj, value);
var __privateSet = (obj, member, value, setter) => (__accessCheck(obj, member, "write to private field"), setter ? setter.call(obj, value) : member.set(obj, value), value);
var __privateMethod = (obj, member, method) => (__accessCheck(obj, member, "access private method"), method);
var _callbacks, _createDefaultLoader, _defaultLoader, _core, _response, _segmentId, _FragmentLoaderBase_instances, handleError_fn, abortInternal_fn, _defaultLoader2;
import { CoreRequestError, debug, Core } from "./p2p-media-loader-core.es.js";
function getSegmentRuntimeId(segmentRequestUrl, byteRange) {
  if (!byteRange) return segmentRequestUrl;
  return `${segmentRequestUrl}|${byteRange.start}-${byteRange.end}`;
}
function getByteRange(rangeStart, rangeEnd) {
  if (rangeStart !== void 0 && rangeEnd !== void 0 && rangeStart <= rangeEnd) {
    return { start: rangeStart, end: rangeEnd };
  }
}
const DEFAULT_DOWNLOAD_LATENCY = 10;
class FragmentLoaderBase {
  constructor(config, core) {
    __privateAdd(this, _FragmentLoaderBase_instances);
    __publicField(this, "context");
    __publicField(this, "config");
    __publicField(this, "stats");
    __privateAdd(this, _callbacks);
    __privateAdd(this, _createDefaultLoader);
    __privateAdd(this, _defaultLoader);
    __privateAdd(this, _core);
    __privateAdd(this, _response);
    __privateAdd(this, _segmentId);
    __privateSet(this, _core, core);
    __privateSet(this, _createDefaultLoader, () => new config.loader(config));
    this.stats = {
      aborted: false,
      chunkCount: 0,
      loading: { start: 0, first: 0, end: 0 },
      buffering: { start: 0, first: 0, end: 0 },
      parsing: { start: 0, end: 0 },
      // set total and loaded to 1 to prevent hls.js
      // on progress loading monitoring in AbrController
      total: 1,
      loaded: 1,
      bwEstimate: 0,
      retry: 0
    };
  }
  load(context, config, callbacks) {
    var _a;
    this.context = context;
    this.config = config;
    __privateSet(this, _callbacks, callbacks);
    const stats = this.stats;
    const { rangeStart: start, rangeEnd: end } = context;
    const byteRange = getByteRange(
      start,
      end !== void 0 ? end - 1 : void 0
    );
    __privateSet(this, _segmentId, getSegmentRuntimeId(context.url, byteRange));
    const isSegmentDownloadableByP2PCore = __privateGet(this, _core).isSegmentLoadable(
      __privateGet(this, _segmentId)
    );
    if (!__privateGet(this, _core).hasSegment(__privateGet(this, _segmentId)) || isSegmentDownloadableByP2PCore === false) {
      __privateSet(this, _defaultLoader, __privateGet(this, _createDefaultLoader).call(this));
      __privateGet(this, _defaultLoader).stats = this.stats;
      (_a = __privateGet(this, _defaultLoader)) == null ? void 0 : _a.load(context, config, callbacks);
      return;
    }
    const onSuccess = (response) => {
      __privateSet(this, _response, response);
      const loadedBytes = __privateGet(this, _response).data.byteLength;
      stats.loading = getLoadingStat(
        __privateGet(this, _response).bandwidth,
        loadedBytes,
        performance.now()
      );
      stats.total = stats.loaded = loadedBytes;
      if (callbacks.onProgress) {
        callbacks.onProgress(
          this.stats,
          context,
          __privateGet(this, _response).data,
          void 0
        );
      }
      callbacks.onSuccess(
        { data: __privateGet(this, _response).data, url: context.url },
        this.stats,
        context,
        void 0
      );
    };
    const onError = (error) => {
      if (error instanceof CoreRequestError && error.type === "aborted" && this.stats.aborted) {
        return;
      }
      __privateMethod(this, _FragmentLoaderBase_instances, handleError_fn).call(this, error);
    };
    void __privateGet(this, _core).loadSegment(__privateGet(this, _segmentId), { onSuccess, onError });
  }
  abort() {
    var _a, _b;
    if (__privateGet(this, _defaultLoader)) {
      __privateGet(this, _defaultLoader).abort();
    } else {
      __privateMethod(this, _FragmentLoaderBase_instances, abortInternal_fn).call(this);
      (_b = (_a = __privateGet(this, _callbacks)) == null ? void 0 : _a.onAbort) == null ? void 0 : _b.call(_a, this.stats, this.context, {});
    }
  }
  destroy() {
    if (__privateGet(this, _defaultLoader)) {
      __privateGet(this, _defaultLoader).destroy();
    } else {
      if (!this.stats.aborted) __privateMethod(this, _FragmentLoaderBase_instances, abortInternal_fn).call(this);
      __privateSet(this, _callbacks, null);
      this.config = null;
    }
  }
}
_callbacks = new WeakMap();
_createDefaultLoader = new WeakMap();
_defaultLoader = new WeakMap();
_core = new WeakMap();
_response = new WeakMap();
_segmentId = new WeakMap();
_FragmentLoaderBase_instances = new WeakSet();
handleError_fn = function(thrownError) {
  var _a;
  const error = { code: 0, text: "" };
  if (thrownError instanceof CoreRequestError && thrownError.type === "failed") {
    error.text = thrownError.message;
  } else if (thrownError instanceof Error) {
    error.text = thrownError.message;
  }
  (_a = __privateGet(this, _callbacks)) == null ? void 0 : _a.onError(error, this.context, null, this.stats);
};
abortInternal_fn = function() {
  if (!__privateGet(this, _response) && __privateGet(this, _segmentId)) {
    this.stats.aborted = true;
    __privateGet(this, _core).abortSegmentLoading(__privateGet(this, _segmentId));
  }
};
function getLoadingStat(targetBitrate, loadedBytes, loadingEndTime) {
  const timeForLoading = loadedBytes * 8e3 / targetBitrate;
  const first = loadingEndTime - timeForLoading;
  const start = first - DEFAULT_DOWNLOAD_LATENCY;
  return { start, first, end: loadingEndTime };
}
class PlaylistLoaderBase {
  constructor(config) {
    __privateAdd(this, _defaultLoader2);
    __publicField(this, "context");
    __publicField(this, "stats");
    __privateSet(this, _defaultLoader2, new config.loader(config));
    this.stats = __privateGet(this, _defaultLoader2).stats;
    this.context = __privateGet(this, _defaultLoader2).context;
  }
  load(context, config, callbacks) {
    __privateGet(this, _defaultLoader2).load(context, config, callbacks);
  }
  abort() {
    __privateGet(this, _defaultLoader2).abort();
  }
  destroy() {
    __privateGet(this, _defaultLoader2).destroy();
  }
}
_defaultLoader2 = new WeakMap();
class SegmentManager {
  constructor(core) {
    __publicField(this, "core");
    this.core = core;
  }
  processMainManifest(data) {
    const { levels, audioTracks } = data;
    for (const [index, level] of levels.entries()) {
      const { url } = level;
      this.core.addStreamIfNoneExists({
        runtimeId: Array.isArray(url) ? url[0] : url,
        type: "main",
        index
      });
    }
    for (const [index, track] of audioTracks.entries()) {
      const { url } = track;
      this.core.addStreamIfNoneExists({
        runtimeId: Array.isArray(url) ? url[0] : url,
        type: "secondary",
        index
      });
    }
  }
  updatePlaylist(data) {
    if (!data.details) return;
    const {
      details: { url, fragments, live }
    } = data;
    const playlist = this.core.getStream(url);
    if (!playlist) return;
    const segmentToRemoveIds = new Set(playlist.segments.keys());
    const newSegments = [];
    fragments.forEach((fragment, index) => {
      const {
        url: responseUrl,
        byteRange: fragByteRange,
        sn,
        start: startTime,
        end: endTime
      } = fragment;
      if (sn === "initSegment") return;
      const [start, end] = fragByteRange;
      const byteRange = getByteRange(
        start,
        end !== void 0 ? end - 1 : void 0
      );
      const runtimeId = getSegmentRuntimeId(responseUrl, byteRange);
      segmentToRemoveIds.delete(runtimeId);
      if (playlist.segments.has(runtimeId)) return;
      newSegments.push({
        runtimeId,
        url: responseUrl,
        externalId: live ? sn : index,
        byteRange,
        startTime,
        endTime
      });
    });
    if (!newSegments.length && !segmentToRemoveIds.size) return;
    this.core.updateStream(url, newSegments, segmentToRemoveIds.values());
  }
}
function injectMixin(HlsJsClass) {
  var _p2pEngine, _a;
  return _a = class extends HlsJsClass {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    constructor(...args) {
      var _a2;
      const config = args[0];
      const { p2p, ...hlsJsConfig } = config ?? {};
      const p2pEngine = new HlsJsP2PEngine(p2p);
      super({ ...hlsJsConfig, ...p2pEngine.getConfigForHlsJs() });
      __privateAdd(this, _p2pEngine);
      p2pEngine.bindHls(this);
      __privateSet(this, _p2pEngine, p2pEngine);
      (_a2 = p2p == null ? void 0 : p2p.onHlsJsCreated) == null ? void 0 : _a2.call(p2p, this);
    }
    get p2pEngine() {
      return __privateGet(this, _p2pEngine);
    }
  }, _p2pEngine = new WeakMap(), _a;
}
class HlsJsP2PEngine {
  /**
   * Constructs an instance of HlsJsP2PEngine.
   * @param config Optional configuration for P2P engine setup.
   */
  constructor(config) {
    __publicField(this, "core");
    __publicField(this, "segmentManager");
    __publicField(this, "hlsInstanceGetter");
    __publicField(this, "currentHlsInstance");
    __publicField(this, "debug", debug("p2pml-hlsjs:engine"));
    __publicField(this, "updateMediaElementEventHandlers", (type) => {
      var _a;
      const media = (_a = this.currentHlsInstance) == null ? void 0 : _a.media;
      if (!media) return;
      const method = type === "register" ? "addEventListener" : "removeEventListener";
      media[method]("timeupdate", this.handlePlaybackUpdate);
      media[method]("seeking", this.handlePlaybackUpdate);
      media[method]("ratechange", this.handlePlaybackUpdate);
    });
    __publicField(this, "handleManifestLoaded", (event, data) => {
      const networkDetails = data.networkDetails;
      if (networkDetails instanceof XMLHttpRequest) {
        this.core.setManifestResponseUrl(networkDetails.responseURL);
      } else if (networkDetails instanceof Response) {
        this.core.setManifestResponseUrl(networkDetails.url);
      }
      this.segmentManager.processMainManifest(data);
    });
    __publicField(this, "handleLevelSwitching", (event, data) => {
      if (data.bitrate) this.core.setActiveLevelBitrate(data.bitrate);
    });
    __publicField(this, "handleLevelUpdated", (event, data) => {
      if (this.currentHlsInstance && this.currentHlsInstance.config.liveSyncDurationCount !== data.details.fragments.length - 1 && data.details.live && data.details.fragments[0].type === "main" && !this.currentHlsInstance.userConfig.liveSyncDuration && !this.currentHlsInstance.userConfig.liveSyncDurationCount && data.details.fragments.length > 4) {
        this.debug(
          `set liveSyncDurationCount ${data.details.fragments.length - 1}`
        );
        this.currentHlsInstance.config.liveSyncDurationCount = data.details.fragments.length - 1;
      }
      this.core.setIsLive(data.details.live);
      this.segmentManager.updatePlaylist(data);
    });
    __publicField(this, "handleMediaAttached", () => {
      this.updateMediaElementEventHandlers("register");
    });
    __publicField(this, "handleMediaDetached", () => {
      this.updateMediaElementEventHandlers("unregister");
    });
    __publicField(this, "handlePlaybackUpdate", (event) => {
      const media = event.target;
      this.core.updatePlayback(media.currentTime, media.playbackRate);
    });
    __publicField(this, "destroyCore", () => this.core.destroy());
    /** Clean up and release all resources. Unregister all event handlers. */
    __publicField(this, "destroy", () => {
      this.destroyCore();
      this.updateHlsEventsHandlers("unregister");
      this.updateMediaElementEventHandlers("unregister");
      this.currentHlsInstance = void 0;
    });
    this.core = new Core(config == null ? void 0 : config.core);
    this.segmentManager = new SegmentManager(this.core);
  }
  /**
   * Enhances a given Hls.js class by injecting additional P2P (peer-to-peer) functionalities.
   *
   * @returns {HlsWithP2PInstance} - The enhanced Hls.js class with P2P functionalities.
   *
   * @example
   * const HlsWithP2P = HlsJsP2PEngine.injectMixin(Hls);
   *
   * const hls = new HlsWithP2P({
   *   // Hls.js configuration
   *   startLevel: 0, // Example of Hls.js config parameter
   *   p2p: {
   *     core: {
   *       // P2P core configuration
   *     },
   *     onHlsJsCreated(hls) {
   *       // Do something with the Hls.js instance
   *     },
   *   },
   * });
   */
  static injectMixin(hls) {
    return injectMixin(hls);
  }
  /**
   * Adds an event listener for the specified event.
   * @param eventName The name of the event to listen for.
   * @param listener The callback function to be invoked when the event is triggered.
   *
   * @example
   * // Listening for a segment being successfully loaded
   * p2pEngine.addEventListener('onSegmentLoaded', (details) => {
   *   console.log('Segment Loaded:', details);
   * });
   *
   * @example
   * // Handling segment load errors
   * p2pEngine.addEventListener('onSegmentError', (errorDetails) => {
   *   console.error('Error loading segment:', errorDetails);
   * });
   *
   * @example
   * // Tracking data downloaded from peers
   * p2pEngine.addEventListener('onChunkDownloaded', (bytesLength, downloadSource, peerId) => {
   *   console.log(`Downloaded ${bytesLength} bytes from ${downloadSource} ${peerId ? 'from peer ' + peerId : 'from server'}`);
   * });
   */
  addEventListener(eventName, listener) {
    this.core.addEventListener(eventName, listener);
  }
  /**
   * Removes an event listener for the specified event.
   * @param eventName The name of the event.
   * @param listener The callback function that was previously added.
   */
  removeEventListener(eventName, listener) {
    this.core.removeEventListener(eventName, listener);
  }
  /**
   * provides the Hls.js P2P specific configuration for Hls.js loaders.
   * @returns An object with fragment loader (fLoader) and playlist loader (pLoader).
   */
  getConfigForHlsJs() {
    return {
      fLoader: this.createFragmentLoaderClass(),
      pLoader: this.createPlaylistLoaderClass()
    };
  }
  /**
   * Returns the configuration of the HLS.js P2P engine.
   * @returns A readonly version of the HlsJsP2PEngineConfig.
   */
  getConfig() {
    return { core: this.core.getConfig() };
  }
  /**
   * Applies dynamic configuration updates to the P2P engine.
   * @param dynamicConfig Configuration changes to apply.
   *
   * @example
   * // Assuming `hlsP2PEngine` is an instance of HlsJsP2PEngine
   *
   * const newDynamicConfig = {
   *   core: {
   *     // Increase the number of cached segments to 1000
   *     cachedSegmentsCount: 1000,
   *     // 50 minutes of segments will be downloaded further through HTTP connections if P2P fails
   *     httpDownloadTimeWindow: 3000,
   *     // 100 minutes of segments will be downloaded further through P2P connections
   *     p2pDownloadTimeWindow: 6000,
   * };
   *
   * hlsP2PEngine.applyDynamicConfig(newDynamicConfig);
   */
  applyDynamicConfig(dynamicConfig) {
    if (dynamicConfig.core) this.core.applyDynamicConfig(dynamicConfig.core);
  }
  /**
   * Sets the HLS instance for handling media.
   * @param hls The HLS instance or a function that returns an HLS instance.
   */
  bindHls(hls) {
    this.hlsInstanceGetter = typeof hls === "function" ? hls : () => hls;
  }
  initHlsEvents() {
    var _a;
    const hlsInstance = (_a = this.hlsInstanceGetter) == null ? void 0 : _a.call(this);
    if (this.currentHlsInstance === hlsInstance) return;
    if (this.currentHlsInstance) this.destroy();
    this.currentHlsInstance = hlsInstance;
    this.updateHlsEventsHandlers("register");
    this.updateMediaElementEventHandlers("register");
  }
  updateHlsEventsHandlers(type) {
    const hls = this.currentHlsInstance;
    if (!hls) return;
    const method = type === "register" ? "on" : "off";
    hls[method](
      "hlsManifestLoaded",
      this.handleManifestLoaded
    );
    hls[method](
      "hlsLevelSwitching",
      this.handleLevelSwitching
    );
    hls[method](
      "hlsLevelUpdated",
      this.handleLevelUpdated
    );
    hls[method](
      "hlsAudioTrackLoaded",
      this.handleLevelUpdated
    );
    hls[method]("hlsDestroying", this.destroy);
    hls[method](
      "hlsMediaAttaching",
      this.destroyCore
    );
    hls[method](
      "hlsManifestLoading",
      this.destroyCore
    );
    hls[method](
      "hlsMediaDetached",
      this.handleMediaDetached
    );
    hls[method](
      "hlsMediaAttached",
      this.handleMediaAttached
    );
  }
  createFragmentLoaderClass() {
    const core = this.core;
    const engine = this;
    return class FragmentLoader extends FragmentLoaderBase {
      constructor(config) {
        super(config, core);
      }
      static getEngine() {
        return engine;
      }
    };
  }
  createPlaylistLoaderClass() {
    const engine = this;
    return class PlaylistLoader extends PlaylistLoaderBase {
      constructor(config) {
        super(config);
        engine.initHlsEvents();
      }
    };
  }
}
export {
  HlsJsP2PEngine
};
//# sourceMappingURL=p2p-media-loader-hlsjs.es.js.map
