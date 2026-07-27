// @bun
// packages/sdk/dist/gen/client/index.js
var jsonBodySerializer = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};
var extraPrefixesMap = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes = Object.entries(extraPrefixesMap);
var createSseClient = ({
  onRequest,
  onSseError,
  onSseEvent,
  responseTransformer,
  responseValidator,
  sseDefaultRetryDelay,
  sseMaxRetryAttempts,
  sseMaxRetryDelay,
  sseSleepFn,
  url,
  ...options
}) => {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3000;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted)
        break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== undefined) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const requestInit = {
          redirect: "follow",
          ...options,
          body: options.serializedBody,
          headers,
          signal
        };
        let request = new Request(url, requestInit);
        if (onRequest) {
          request = await onRequest(url, requestInit);
        }
        const _fetch = options.fetch ?? globalThis.fetch;
        const response = await _fetch(request);
        if (!response.ok)
          throw new Error(`SSE failed: ${response.status} ${response.statusText}`);
        if (!response.body)
          throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            reader.cancel();
          } catch {}
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += value;
            buffer = buffer.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
            const chunks = buffer.split(`

`);
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split(`
`);
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(line.replace(/^retry:\s*/, ""), 10);
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join(`
`);
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error) {
        onSseError?.(error);
        if (sseMaxRetryAttempts !== undefined && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(retryDelay * 2 ** (attempt - 1), sseMaxRetryDelay ?? 30000);
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
};
var separatorArrayExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var separatorArrayNoExplode = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var separatorObjectExplode = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var serializeArrayParam = ({
  allowReserved,
  explode,
  name,
  style,
  value
}) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var serializePrimitiveParam = ({
  allowReserved,
  name,
  value
}) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
var serializeObjectParam = ({
  allowReserved,
  explode,
  name,
  style,
  value,
  valueOnly
}) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [...values, key, allowReserved ? v : encodeURIComponent(v)];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode(style);
  const joinedValues = Object.entries(value).map(([key, v]) => serializePrimitiveParam({
    allowReserved,
    name: style === "deepObject" ? `${name}[${key}]` : key,
    value: v
  })).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var PATH_PARAM_RE = /\{[^{}]+\}/g;
var defaultPathSerializer = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(match, serializeArrayParam({ explode, name, style, value }));
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(match, serializeObjectParam({
          explode,
          name,
          style,
          value,
          valueOnly: true
        }));
        continue;
      }
      if (style === "matrix") {
        url = url.replace(match, `;${serializePrimitiveParam({
          name,
          value
        })}`);
        continue;
      }
      const replaceValue = encodeURIComponent(style === "label" ? `.${value}` : value);
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
var getUrl = ({
  baseUrl,
  path,
  query,
  querySerializer,
  url: _url
}) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer({ path, url });
  }
  let search = query ? querySerializer(query) : "";
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    url += `?${search}`;
  }
  return url;
};
function getValidRequestBody(options) {
  const hasBody = options.body !== undefined;
  const isSerializedBody = hasBody && options.bodySerializer;
  if (isSerializedBody) {
    if ("serializedBody" in options) {
      const hasSerializedBody = options.serializedBody !== undefined && options.serializedBody !== "";
      return hasSerializedBody ? options.serializedBody : null;
    }
    return options.body !== "" ? options.body : null;
  }
  if (hasBody) {
    return options.body;
  }
  return;
}
var getAuthToken = async (auth, callback) => {
  const token = typeof callback === "function" ? await callback(auth) : callback;
  if (!token) {
    return;
  }
  if (auth.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};
var createQuerySerializer = ({
  parameters = {},
  ...args
} = {}) => {
  const querySerializer = (queryParams) => {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === undefined || value === null) {
          continue;
        }
        const options = parameters[name] || args;
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...options.array
          });
          if (serializedArray)
            search.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...options.object
          });
          if (serializedObject)
            search.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam({
            allowReserved: options.allowReserved,
            name,
            value
          });
          if (serializedPrimitive)
            search.push(serializedPrimitive);
        }
      }
    }
    return search.join("&");
  };
  return querySerializer;
};
var getParseAs = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
var checkForExistence = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
var setAuthParams = async ({
  security,
  ...options
}) => {
  for (const auth of security) {
    if (checkForExistence(options, auth.name)) {
      continue;
    }
    const token = await getAuthToken(auth, options.auth);
    if (!token) {
      continue;
    }
    const name = auth.name ?? "Authorization";
    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
};
var buildUrl = (options) => getUrl({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer(options.querySerializer),
  url: options.url
});
var mergeConfigs = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders(a.headers, b.headers);
  return config;
};
var headersEntries = (headers) => {
  const entries = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
};
var mergeHeaders = (...headers) => {
  const mergedHeaders = new Headers;
  for (const header of headers) {
    if (!header) {
      continue;
    }
    const iterator = header instanceof Headers ? headersEntries(header) : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== undefined) {
        mergedHeaders.set(key, typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
  }
  return mergedHeaders;
};

class Interceptors {
  fns = [];
  clear() {
    this.fns = [];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = null;
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return Boolean(this.fns[index]);
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this.fns[id] ? id : -1;
    }
    return this.fns.indexOf(id);
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = fn;
      return id;
    }
    return false;
  }
  use(fn) {
    this.fns.push(fn);
    return this.fns.length - 1;
  }
}
var createInterceptors = () => ({
  error: new Interceptors,
  request: new Interceptors,
  response: new Interceptors
});
var defaultQuerySerializer = createQuerySerializer({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
var defaultHeaders = {
  "Content-Type": "application/json"
};
var createConfig = (override = {}) => ({
  ...jsonBodySerializer,
  headers: defaultHeaders,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer,
  ...override
});
var createClient = (config = {}) => {
  let _config = mergeConfigs(createConfig(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders(_config.headers, options.headers),
      serializedBody: undefined
    };
    if (opts.security) {
      await setAuthParams({
        ...opts,
        security: opts.security
      });
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body !== undefined && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.body === undefined || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const url = buildUrl(opts);
    return { opts, url };
  };
  const request = async (options) => {
    const { opts, url } = await beforeRequest(options);
    const requestInit = {
      redirect: "follow",
      ...opts,
      body: getValidRequestBody(opts)
    };
    let request2 = new Request(url, requestInit);
    for (const fn of interceptors.request.fns) {
      if (fn) {
        request2 = await fn(request2, opts);
      }
    }
    const _fetch = opts.fetch;
    let response;
    try {
      response = await _fetch(request2);
    } catch (error2) {
      let finalError2 = error2;
      for (const fn of interceptors.error.fns) {
        if (fn) {
          finalError2 = await fn(error2, undefined, request2, opts);
        }
      }
      finalError2 = finalError2 || {};
      if (opts.throwOnError) {
        throw finalError2;
      }
      return opts.responseStyle === "data" ? undefined : {
        error: finalError2,
        request: request2,
        response: undefined
      };
    }
    for (const fn of interceptors.response.fns) {
      if (fn) {
        response = await fn(response, request2, opts);
      }
    }
    const result = {
      request: request2,
      response
    };
    if (response.ok) {
      const parseAs = (opts.parseAs === "auto" ? getParseAs(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        let emptyData;
        switch (parseAs) {
          case "arrayBuffer":
          case "blob":
          case "text":
            emptyData = await response[parseAs]();
            break;
          case "formData":
            emptyData = new FormData;
            break;
          case "stream":
            emptyData = response.body;
            break;
          case "json":
          default:
            emptyData = {};
            break;
        }
        return opts.responseStyle === "data" ? emptyData : {
          data: emptyData,
          ...result
        };
      }
      let data;
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "text":
          data = await response[parseAs]();
          break;
        case "json": {
          const text = await response.text();
          data = text ? JSON.parse(text) : {};
          break;
        }
        case "stream":
          return opts.responseStyle === "data" ? response.body : {
            data: response.body,
            ...result
          };
      }
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }
        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }
      return opts.responseStyle === "data" ? data : {
        data,
        ...result
      };
    }
    const textError = await response.text();
    let jsonError;
    try {
      jsonError = JSON.parse(textError);
    } catch {}
    const error = jsonError ?? textError;
    let finalError = error;
    for (const fn of interceptors.error.fns) {
      if (fn) {
        finalError = await fn(error, response, request2, opts);
      }
    }
    finalError = finalError || {};
    if (opts.throwOnError) {
      throw finalError;
    }
    return opts.responseStyle === "data" ? undefined : {
      error: finalError,
      ...result
    };
  };
  const makeMethodFn = (method) => (options) => request({ ...options, method });
  const makeSseFn = (method) => async (options) => {
    const { opts, url } = await beforeRequest(options);
    return createSseClient({
      ...opts,
      body: opts.body,
      headers: opts.headers,
      method,
      onRequest: async (url2, init) => {
        let request2 = new Request(url2, init);
        for (const fn of interceptors.request.fns) {
          if (fn) {
            request2 = await fn(request2, opts);
          }
        }
        return request2;
      },
      serializedBody: getValidRequestBody(opts),
      url
    });
  };
  const _buildUrl = (options) => buildUrl({ ..._config, ...options });
  return {
    buildUrl: _buildUrl,
    connect: makeMethodFn("CONNECT"),
    delete: makeMethodFn("DELETE"),
    get: makeMethodFn("GET"),
    getConfig,
    head: makeMethodFn("HEAD"),
    interceptors,
    options: makeMethodFn("OPTIONS"),
    patch: makeMethodFn("PATCH"),
    post: makeMethodFn("POST"),
    put: makeMethodFn("PUT"),
    request,
    setConfig,
    sse: {
      connect: makeSseFn("CONNECT"),
      delete: makeSseFn("DELETE"),
      get: makeSseFn("GET"),
      head: makeSseFn("HEAD"),
      options: makeSseFn("OPTIONS"),
      patch: makeSseFn("PATCH"),
      post: makeSseFn("POST"),
      put: makeSseFn("PUT"),
      trace: makeSseFn("TRACE")
    },
    trace: makeMethodFn("TRACE")
  };
};

// packages/sdk/dist/gen/client.gen.js
var jsonBodySerializer2 = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};
var extraPrefixesMap2 = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes2 = Object.entries(extraPrefixesMap2);
var createSseClient2 = ({
  onRequest,
  onSseError,
  onSseEvent,
  responseTransformer,
  responseValidator,
  sseDefaultRetryDelay,
  sseMaxRetryAttempts,
  sseMaxRetryDelay,
  sseSleepFn,
  url,
  ...options
}) => {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3000;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted)
        break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== undefined) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const requestInit = {
          redirect: "follow",
          ...options,
          body: options.serializedBody,
          headers,
          signal
        };
        let request = new Request(url, requestInit);
        if (onRequest) {
          request = await onRequest(url, requestInit);
        }
        const _fetch = options.fetch ?? globalThis.fetch;
        const response = await _fetch(request);
        if (!response.ok)
          throw new Error(`SSE failed: ${response.status} ${response.statusText}`);
        if (!response.body)
          throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            reader.cancel();
          } catch {}
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += value;
            buffer = buffer.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
            const chunks = buffer.split(`

`);
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split(`
`);
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(line.replace(/^retry:\s*/, ""), 10);
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join(`
`);
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error) {
        onSseError?.(error);
        if (sseMaxRetryAttempts !== undefined && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(retryDelay * 2 ** (attempt - 1), sseMaxRetryDelay ?? 30000);
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
};
var separatorArrayExplode2 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var separatorArrayNoExplode2 = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var separatorObjectExplode2 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var serializeArrayParam2 = ({
  allowReserved,
  explode,
  name,
  style,
  value
}) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode2(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode2(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam2({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var serializePrimitiveParam2 = ({
  allowReserved,
  name,
  value
}) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
var serializeObjectParam2 = ({
  allowReserved,
  explode,
  name,
  style,
  value,
  valueOnly
}) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [...values, key, allowReserved ? v : encodeURIComponent(v)];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode2(style);
  const joinedValues = Object.entries(value).map(([key, v]) => serializePrimitiveParam2({
    allowReserved,
    name: style === "deepObject" ? `${name}[${key}]` : key,
    value: v
  })).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var PATH_PARAM_RE2 = /\{[^{}]+\}/g;
var defaultPathSerializer2 = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE2);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(match, serializeArrayParam2({ explode, name, style, value }));
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(match, serializeObjectParam2({
          explode,
          name,
          style,
          value,
          valueOnly: true
        }));
        continue;
      }
      if (style === "matrix") {
        url = url.replace(match, `;${serializePrimitiveParam2({
          name,
          value
        })}`);
        continue;
      }
      const replaceValue = encodeURIComponent(style === "label" ? `.${value}` : value);
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
var getUrl2 = ({
  baseUrl,
  path,
  query,
  querySerializer,
  url: _url
}) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer2({ path, url });
  }
  let search = query ? querySerializer(query) : "";
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    url += `?${search}`;
  }
  return url;
};
function getValidRequestBody2(options) {
  const hasBody = options.body !== undefined;
  const isSerializedBody = hasBody && options.bodySerializer;
  if (isSerializedBody) {
    if ("serializedBody" in options) {
      const hasSerializedBody = options.serializedBody !== undefined && options.serializedBody !== "";
      return hasSerializedBody ? options.serializedBody : null;
    }
    return options.body !== "" ? options.body : null;
  }
  if (hasBody) {
    return options.body;
  }
  return;
}
var getAuthToken2 = async (auth, callback) => {
  const token = typeof callback === "function" ? await callback(auth) : callback;
  if (!token) {
    return;
  }
  if (auth.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};
var createQuerySerializer2 = ({
  parameters = {},
  ...args
} = {}) => {
  const querySerializer = (queryParams) => {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === undefined || value === null) {
          continue;
        }
        const options = parameters[name] || args;
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam2({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...options.array
          });
          if (serializedArray)
            search.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam2({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...options.object
          });
          if (serializedObject)
            search.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam2({
            allowReserved: options.allowReserved,
            name,
            value
          });
          if (serializedPrimitive)
            search.push(serializedPrimitive);
        }
      }
    }
    return search.join("&");
  };
  return querySerializer;
};
var getParseAs2 = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
var checkForExistence2 = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
var setAuthParams2 = async ({
  security,
  ...options
}) => {
  for (const auth of security) {
    if (checkForExistence2(options, auth.name)) {
      continue;
    }
    const token = await getAuthToken2(auth, options.auth);
    if (!token) {
      continue;
    }
    const name = auth.name ?? "Authorization";
    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
};
var buildUrl2 = (options) => getUrl2({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer2(options.querySerializer),
  url: options.url
});
var mergeConfigs2 = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders2(a.headers, b.headers);
  return config;
};
var headersEntries2 = (headers) => {
  const entries = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
};
var mergeHeaders2 = (...headers) => {
  const mergedHeaders = new Headers;
  for (const header of headers) {
    if (!header) {
      continue;
    }
    const iterator = header instanceof Headers ? headersEntries2(header) : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== undefined) {
        mergedHeaders.set(key, typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
  }
  return mergedHeaders;
};

class Interceptors2 {
  fns = [];
  clear() {
    this.fns = [];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = null;
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return Boolean(this.fns[index]);
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this.fns[id] ? id : -1;
    }
    return this.fns.indexOf(id);
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = fn;
      return id;
    }
    return false;
  }
  use(fn) {
    this.fns.push(fn);
    return this.fns.length - 1;
  }
}
var createInterceptors2 = () => ({
  error: new Interceptors2,
  request: new Interceptors2,
  response: new Interceptors2
});
var defaultQuerySerializer2 = createQuerySerializer2({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
var defaultHeaders2 = {
  "Content-Type": "application/json"
};
var createConfig2 = (override = {}) => ({
  ...jsonBodySerializer2,
  headers: defaultHeaders2,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer2,
  ...override
});
var createClient2 = (config = {}) => {
  let _config = mergeConfigs2(createConfig2(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs2(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors2();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders2(_config.headers, options.headers),
      serializedBody: undefined
    };
    if (opts.security) {
      await setAuthParams2({
        ...opts,
        security: opts.security
      });
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body !== undefined && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.body === undefined || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const url = buildUrl2(opts);
    return { opts, url };
  };
  const request = async (options) => {
    const { opts, url } = await beforeRequest(options);
    const requestInit = {
      redirect: "follow",
      ...opts,
      body: getValidRequestBody2(opts)
    };
    let request2 = new Request(url, requestInit);
    for (const fn of interceptors.request.fns) {
      if (fn) {
        request2 = await fn(request2, opts);
      }
    }
    const _fetch = opts.fetch;
    let response;
    try {
      response = await _fetch(request2);
    } catch (error2) {
      let finalError2 = error2;
      for (const fn of interceptors.error.fns) {
        if (fn) {
          finalError2 = await fn(error2, undefined, request2, opts);
        }
      }
      finalError2 = finalError2 || {};
      if (opts.throwOnError) {
        throw finalError2;
      }
      return opts.responseStyle === "data" ? undefined : {
        error: finalError2,
        request: request2,
        response: undefined
      };
    }
    for (const fn of interceptors.response.fns) {
      if (fn) {
        response = await fn(response, request2, opts);
      }
    }
    const result = {
      request: request2,
      response
    };
    if (response.ok) {
      const parseAs = (opts.parseAs === "auto" ? getParseAs2(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        let emptyData;
        switch (parseAs) {
          case "arrayBuffer":
          case "blob":
          case "text":
            emptyData = await response[parseAs]();
            break;
          case "formData":
            emptyData = new FormData;
            break;
          case "stream":
            emptyData = response.body;
            break;
          case "json":
          default:
            emptyData = {};
            break;
        }
        return opts.responseStyle === "data" ? emptyData : {
          data: emptyData,
          ...result
        };
      }
      let data;
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "text":
          data = await response[parseAs]();
          break;
        case "json": {
          const text = await response.text();
          data = text ? JSON.parse(text) : {};
          break;
        }
        case "stream":
          return opts.responseStyle === "data" ? response.body : {
            data: response.body,
            ...result
          };
      }
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }
        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }
      return opts.responseStyle === "data" ? data : {
        data,
        ...result
      };
    }
    const textError = await response.text();
    let jsonError;
    try {
      jsonError = JSON.parse(textError);
    } catch {}
    const error = jsonError ?? textError;
    let finalError = error;
    for (const fn of interceptors.error.fns) {
      if (fn) {
        finalError = await fn(error, response, request2, opts);
      }
    }
    finalError = finalError || {};
    if (opts.throwOnError) {
      throw finalError;
    }
    return opts.responseStyle === "data" ? undefined : {
      error: finalError,
      ...result
    };
  };
  const makeMethodFn = (method) => (options) => request({ ...options, method });
  const makeSseFn = (method) => async (options) => {
    const { opts, url } = await beforeRequest(options);
    return createSseClient2({
      ...opts,
      body: opts.body,
      headers: opts.headers,
      method,
      onRequest: async (url2, init) => {
        let request2 = new Request(url2, init);
        for (const fn of interceptors.request.fns) {
          if (fn) {
            request2 = await fn(request2, opts);
          }
        }
        return request2;
      },
      serializedBody: getValidRequestBody2(opts),
      url
    });
  };
  const _buildUrl = (options) => buildUrl2({ ..._config, ...options });
  return {
    buildUrl: _buildUrl,
    connect: makeMethodFn("CONNECT"),
    delete: makeMethodFn("DELETE"),
    get: makeMethodFn("GET"),
    getConfig,
    head: makeMethodFn("HEAD"),
    interceptors,
    options: makeMethodFn("OPTIONS"),
    patch: makeMethodFn("PATCH"),
    post: makeMethodFn("POST"),
    put: makeMethodFn("PUT"),
    request,
    setConfig,
    sse: {
      connect: makeSseFn("CONNECT"),
      delete: makeSseFn("DELETE"),
      get: makeSseFn("GET"),
      head: makeSseFn("HEAD"),
      options: makeSseFn("OPTIONS"),
      patch: makeSseFn("PATCH"),
      post: makeSseFn("POST"),
      put: makeSseFn("PUT"),
      trace: makeSseFn("TRACE")
    },
    trace: makeMethodFn("TRACE")
  };
};
var client = createClient2(createConfig2());

// packages/sdk/dist/gen/sdk.gen.js
var jsonBodySerializer3 = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};
var extraPrefixesMap3 = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes3 = Object.entries(extraPrefixesMap3);
var createSseClient3 = ({
  onRequest,
  onSseError,
  onSseEvent,
  responseTransformer,
  responseValidator,
  sseDefaultRetryDelay,
  sseMaxRetryAttempts,
  sseMaxRetryDelay,
  sseSleepFn,
  url,
  ...options
}) => {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3000;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted)
        break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== undefined) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const requestInit = {
          redirect: "follow",
          ...options,
          body: options.serializedBody,
          headers,
          signal
        };
        let request = new Request(url, requestInit);
        if (onRequest) {
          request = await onRequest(url, requestInit);
        }
        const _fetch = options.fetch ?? globalThis.fetch;
        const response = await _fetch(request);
        if (!response.ok)
          throw new Error(`SSE failed: ${response.status} ${response.statusText}`);
        if (!response.body)
          throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            reader.cancel();
          } catch {}
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += value;
            buffer = buffer.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
            const chunks = buffer.split(`

`);
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split(`
`);
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(line.replace(/^retry:\s*/, ""), 10);
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join(`
`);
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error) {
        onSseError?.(error);
        if (sseMaxRetryAttempts !== undefined && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(retryDelay * 2 ** (attempt - 1), sseMaxRetryDelay ?? 30000);
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
};
var separatorArrayExplode3 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var separatorArrayNoExplode3 = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var separatorObjectExplode3 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var serializeArrayParam3 = ({
  allowReserved,
  explode,
  name,
  style,
  value
}) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode3(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode3(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam3({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var serializePrimitiveParam3 = ({
  allowReserved,
  name,
  value
}) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
var serializeObjectParam3 = ({
  allowReserved,
  explode,
  name,
  style,
  value,
  valueOnly
}) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [...values, key, allowReserved ? v : encodeURIComponent(v)];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode3(style);
  const joinedValues = Object.entries(value).map(([key, v]) => serializePrimitiveParam3({
    allowReserved,
    name: style === "deepObject" ? `${name}[${key}]` : key,
    value: v
  })).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var PATH_PARAM_RE3 = /\{[^{}]+\}/g;
var defaultPathSerializer3 = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE3);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(match, serializeArrayParam3({ explode, name, style, value }));
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(match, serializeObjectParam3({
          explode,
          name,
          style,
          value,
          valueOnly: true
        }));
        continue;
      }
      if (style === "matrix") {
        url = url.replace(match, `;${serializePrimitiveParam3({
          name,
          value
        })}`);
        continue;
      }
      const replaceValue = encodeURIComponent(style === "label" ? `.${value}` : value);
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
var getUrl3 = ({
  baseUrl,
  path,
  query,
  querySerializer,
  url: _url
}) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer3({ path, url });
  }
  let search = query ? querySerializer(query) : "";
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    url += `?${search}`;
  }
  return url;
};
function getValidRequestBody3(options) {
  const hasBody = options.body !== undefined;
  const isSerializedBody = hasBody && options.bodySerializer;
  if (isSerializedBody) {
    if ("serializedBody" in options) {
      const hasSerializedBody = options.serializedBody !== undefined && options.serializedBody !== "";
      return hasSerializedBody ? options.serializedBody : null;
    }
    return options.body !== "" ? options.body : null;
  }
  if (hasBody) {
    return options.body;
  }
  return;
}
var getAuthToken3 = async (auth, callback) => {
  const token = typeof callback === "function" ? await callback(auth) : callback;
  if (!token) {
    return;
  }
  if (auth.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};
var createQuerySerializer3 = ({
  parameters = {},
  ...args
} = {}) => {
  const querySerializer = (queryParams) => {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === undefined || value === null) {
          continue;
        }
        const options = parameters[name] || args;
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam3({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...options.array
          });
          if (serializedArray)
            search.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam3({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...options.object
          });
          if (serializedObject)
            search.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam3({
            allowReserved: options.allowReserved,
            name,
            value
          });
          if (serializedPrimitive)
            search.push(serializedPrimitive);
        }
      }
    }
    return search.join("&");
  };
  return querySerializer;
};
var getParseAs3 = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
var checkForExistence3 = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
var setAuthParams3 = async ({
  security,
  ...options
}) => {
  for (const auth of security) {
    if (checkForExistence3(options, auth.name)) {
      continue;
    }
    const token = await getAuthToken3(auth, options.auth);
    if (!token) {
      continue;
    }
    const name = auth.name ?? "Authorization";
    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
};
var buildUrl3 = (options) => getUrl3({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer3(options.querySerializer),
  url: options.url
});
var mergeConfigs3 = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders3(a.headers, b.headers);
  return config;
};
var headersEntries3 = (headers) => {
  const entries = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
};
var mergeHeaders3 = (...headers) => {
  const mergedHeaders = new Headers;
  for (const header of headers) {
    if (!header) {
      continue;
    }
    const iterator = header instanceof Headers ? headersEntries3(header) : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== undefined) {
        mergedHeaders.set(key, typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
  }
  return mergedHeaders;
};

class Interceptors3 {
  fns = [];
  clear() {
    this.fns = [];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = null;
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return Boolean(this.fns[index]);
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this.fns[id] ? id : -1;
    }
    return this.fns.indexOf(id);
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = fn;
      return id;
    }
    return false;
  }
  use(fn) {
    this.fns.push(fn);
    return this.fns.length - 1;
  }
}
var createInterceptors3 = () => ({
  error: new Interceptors3,
  request: new Interceptors3,
  response: new Interceptors3
});
var defaultQuerySerializer3 = createQuerySerializer3({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
var defaultHeaders3 = {
  "Content-Type": "application/json"
};
var createConfig3 = (override = {}) => ({
  ...jsonBodySerializer3,
  headers: defaultHeaders3,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer3,
  ...override
});
var createClient3 = (config = {}) => {
  let _config = mergeConfigs3(createConfig3(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs3(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors3();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders3(_config.headers, options.headers),
      serializedBody: undefined
    };
    if (opts.security) {
      await setAuthParams3({
        ...opts,
        security: opts.security
      });
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body !== undefined && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.body === undefined || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const url = buildUrl3(opts);
    return { opts, url };
  };
  const request = async (options) => {
    const { opts, url } = await beforeRequest(options);
    const requestInit = {
      redirect: "follow",
      ...opts,
      body: getValidRequestBody3(opts)
    };
    let request2 = new Request(url, requestInit);
    for (const fn of interceptors.request.fns) {
      if (fn) {
        request2 = await fn(request2, opts);
      }
    }
    const _fetch = opts.fetch;
    let response;
    try {
      response = await _fetch(request2);
    } catch (error2) {
      let finalError2 = error2;
      for (const fn of interceptors.error.fns) {
        if (fn) {
          finalError2 = await fn(error2, undefined, request2, opts);
        }
      }
      finalError2 = finalError2 || {};
      if (opts.throwOnError) {
        throw finalError2;
      }
      return opts.responseStyle === "data" ? undefined : {
        error: finalError2,
        request: request2,
        response: undefined
      };
    }
    for (const fn of interceptors.response.fns) {
      if (fn) {
        response = await fn(response, request2, opts);
      }
    }
    const result = {
      request: request2,
      response
    };
    if (response.ok) {
      const parseAs = (opts.parseAs === "auto" ? getParseAs3(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        let emptyData;
        switch (parseAs) {
          case "arrayBuffer":
          case "blob":
          case "text":
            emptyData = await response[parseAs]();
            break;
          case "formData":
            emptyData = new FormData;
            break;
          case "stream":
            emptyData = response.body;
            break;
          case "json":
          default:
            emptyData = {};
            break;
        }
        return opts.responseStyle === "data" ? emptyData : {
          data: emptyData,
          ...result
        };
      }
      let data;
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "text":
          data = await response[parseAs]();
          break;
        case "json": {
          const text = await response.text();
          data = text ? JSON.parse(text) : {};
          break;
        }
        case "stream":
          return opts.responseStyle === "data" ? response.body : {
            data: response.body,
            ...result
          };
      }
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }
        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }
      return opts.responseStyle === "data" ? data : {
        data,
        ...result
      };
    }
    const textError = await response.text();
    let jsonError;
    try {
      jsonError = JSON.parse(textError);
    } catch {}
    const error = jsonError ?? textError;
    let finalError = error;
    for (const fn of interceptors.error.fns) {
      if (fn) {
        finalError = await fn(error, response, request2, opts);
      }
    }
    finalError = finalError || {};
    if (opts.throwOnError) {
      throw finalError;
    }
    return opts.responseStyle === "data" ? undefined : {
      error: finalError,
      ...result
    };
  };
  const makeMethodFn = (method) => (options) => request({ ...options, method });
  const makeSseFn = (method) => async (options) => {
    const { opts, url } = await beforeRequest(options);
    return createSseClient3({
      ...opts,
      body: opts.body,
      headers: opts.headers,
      method,
      onRequest: async (url2, init) => {
        let request2 = new Request(url2, init);
        for (const fn of interceptors.request.fns) {
          if (fn) {
            request2 = await fn(request2, opts);
          }
        }
        return request2;
      },
      serializedBody: getValidRequestBody3(opts),
      url
    });
  };
  const _buildUrl = (options) => buildUrl3({ ..._config, ...options });
  return {
    buildUrl: _buildUrl,
    connect: makeMethodFn("CONNECT"),
    delete: makeMethodFn("DELETE"),
    get: makeMethodFn("GET"),
    getConfig,
    head: makeMethodFn("HEAD"),
    interceptors,
    options: makeMethodFn("OPTIONS"),
    patch: makeMethodFn("PATCH"),
    post: makeMethodFn("POST"),
    put: makeMethodFn("PUT"),
    request,
    setConfig,
    sse: {
      connect: makeSseFn("CONNECT"),
      delete: makeSseFn("DELETE"),
      get: makeSseFn("GET"),
      head: makeSseFn("HEAD"),
      options: makeSseFn("OPTIONS"),
      patch: makeSseFn("PATCH"),
      post: makeSseFn("POST"),
      put: makeSseFn("PUT"),
      trace: makeSseFn("TRACE")
    },
    trace: makeMethodFn("TRACE")
  };
};
var client2 = createClient3(createConfig3());
var sessionListGlobal = (options) => (options?.client ?? client2).get({ url: "/session/global", ...options });
var sessionList = (options) => (options?.client ?? client2).get({ url: "/session/list", ...options });
var sessionCreate = (options) => (options.client ?? client2).post({
  url: "/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAllStatus = (options) => (options?.client ?? client2).get({ url: "/session/status", ...options });
var sessionDelete = (options) => (options.client ?? client2).delete({ url: "/session/{sessionID}", ...options });
var sessionGet = (options) => (options.client ?? client2).get({ url: "/session/{sessionID}", ...options });
var sessionUpdate = (options) => (options.client ?? client2).patch({
  url: "/session/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionInitialize = (options) => (options.client ?? client2).post({
  url: "/session/{sessionID}/initialize",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionMessages = (options) => (options.client ?? client2).get({ url: "/session/{sessionID}/messages", ...options });
var sessionPrompt = (options) => (options.client ?? client2).post({
  url: "/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionCommand = (options) => (options.client ?? client2).post({
  url: "/session/{sessionID}/command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAbort = (options) => (options.client ?? client2).post({ url: "/session/{sessionID}/abort", ...options });
var sessionFork = (options) => (options.client ?? client2).post({ url: "/session/{sessionID}/fork", ...options });
var sessionShare = (options) => (options.client ?? client2).post({ url: "/session/{sessionID}/share", ...options });
var sessionDiff = (options) => (options.client ?? client2).get({ url: "/session/{sessionID}/diff", ...options });
var sessionSummarize = (options) => (options.client ?? client2).post({ url: "/session/{sessionID}/summarize", ...options });
var sessionRevert = (options) => (options.client ?? client2).post({
  url: "/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionUnrevert = (options) => (options.client ?? client2).post({ url: "/session/{sessionID}/unrevert", ...options });
var sessionChildren = (options) => (options.client ?? client2).get({ url: "/session/{sessionID}/children", ...options });
var sessionTodo = (options) => (options.client ?? client2).get({ url: "/session/{sessionID}/todo", ...options });
var sessionClear = (options) => (options.client ?? client2).post({ url: "/session/{sessionID}/clear", ...options });
var agentList = (options) => (options?.client ?? client2).get({ url: "/agent/list", ...options });
var agentCreate = (options) => (options.client ?? client2).post({
  url: "/agent/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var agentGet = (options) => (options.client ?? client2).get({ url: "/agent/{agentID}", ...options });
var agentUpdate = (options) => (options.client ?? client2).patch({
  url: "/agent/{agentID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var commandList = (options) => (options?.client ?? client2).get({ url: "/command/list", ...options });
var providerList = (options) => (options?.client ?? client2).get({ url: "/provider", ...options });
var providerAuth = (options) => (options?.client ?? client2).get({ url: "/provider/auth", ...options });
var providerOauthAuthorize = (options) => (options.client ?? client2).post({ url: "/provider/{providerID}/oauth/authorize", ...options });
var providerOauthVerify = (options) => (options.client ?? client2).post({
  url: "/provider/{providerID}/oauth/verify",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configGet = (options) => (options?.client ?? client2).get({ url: "/config", ...options });
var configUpdate = (options) => (options.client ?? client2).patch({
  url: "/config",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configProviders = (options) => (options?.client ?? client2).get({ url: "/config/providers", ...options });
var mcpStatus = (options) => (options?.client ?? client2).get({ url: "/mcp", ...options });
var mcpList = (options) => (options?.client ?? client2).get({ url: "/mcp/list", ...options });
var mcpAdd = (options) => (options.client ?? client2).post({
  url: "/mcp/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var mcpResources = (options) => (options?.client ?? client2).get({ url: "/mcp/resources", ...options });
var mcpRemove = (options) => (options.client ?? client2).delete({ url: "/mcp/{name}", ...options });
var cronStatus = (options) => (options?.client ?? client2).get({ url: "/cron/status", ...options });
var cronList = (options) => (options?.client ?? client2).get({ url: "/cron/jobs", ...options });
var cronCreate = (options) => (options.client ?? client2).post({
  url: "/cron/jobs",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronDelete = (options) => (options.client ?? client2).delete({ url: "/cron/jobs/{id}", ...options });
var cronGet = (options) => (options.client ?? client2).get({ url: "/cron/jobs/{id}", ...options });
var cronUpdate = (options) => (options.client ?? client2).put({
  url: "/cron/jobs/{id}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronPause = (options) => (options.client ?? client2).post({ url: "/cron/jobs/{id}/pause", ...options });
var cronResume = (options) => (options.client ?? client2).post({ url: "/cron/jobs/{id}/resume", ...options });
var cronRun = (options) => (options.client ?? client2).post({ url: "/cron/jobs/{id}/run", ...options });
var cronRuns = (options) => (options.client ?? client2).get({ url: "/cron/jobs/{id}/runs", ...options });
var cronAllRuns = (options) => (options?.client ?? client2).get({ url: "/cron/runs", ...options });
var cronGetRun = (options) => (options.client ?? client2).get({ url: "/cron/runs/{id}", ...options });
var cronWake = (options) => (options?.client ?? client2).post({ url: "/cron/wake", ...options });
var cronCleanupSession = (options) => (options.client ?? client2).delete({ url: "/cron/session/{sessionId}", ...options });
var permissionReply = (options) => (options.client ?? client2).post({
  url: "/permission/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var permissionList = (options) => (options?.client ?? client2).get({ url: "/permission", ...options });
var questionList = (options) => (options?.client ?? client2).get({ url: "/question", ...options });
var questionReply = (options) => (options.client ?? client2).post({
  url: "/question/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var questionReject = (options) => (options.client ?? client2).post({ url: "/question/{requestID}/reject", ...options });
var fileSearch = (options) => (options?.client ?? client2).get({ url: "/file/search", ...options });
var fileGlob = (options) => (options?.client ?? client2).get({ url: "/file/glob", ...options });
var fileSymbols = (options) => (options?.client ?? client2).get({ url: "/file/symbols", ...options });
var fileTree = (options) => (options?.client ?? client2).get({ url: "/file/tree", ...options });
var fileRead = (options) => (options?.client ?? client2).get({ url: "/file/read", ...options });
var fileInfo = (options) => (options?.client ?? client2).get({ url: "/file/info", ...options });
var assetUpload = (options) => (options?.client ?? client2).post({ url: "/assets/upload", ...options });
var assetList = (options) => (options?.client ?? client2).get({ url: "/assets", ...options });
var assetDelete = (options) => (options.client ?? client2).delete({ url: "/assets/{id}", ...options });
var assetGet = (options) => (options.client ?? client2).get({ url: "/assets/{id}", ...options });
var filesList = (options) => (options?.client ?? client2).get({ url: "/files", ...options });
var filesUpload = (options) => (options?.client ?? client2).post({ url: "/files", ...options });
var filesDelete = (options) => (options.client ?? client2).delete({ url: "/files/{id}", ...options });
var filesGet = (options) => (options.client ?? client2).get({ url: "/files/{id}", ...options });
var userGet = (options) => (options?.client ?? client2).get({ url: "/user", ...options });
var userRefresh = (options) => (options?.client ?? client2).post({ url: "/user/refresh", ...options });
var userOnboard = (options) => (options.client ?? client2).post({
  url: "/user/onboard",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var userClear = (options) => (options?.client ?? client2).post({ url: "/user/clear", ...options });
var ptyList = (options) => (options?.client ?? client2).get({ url: "/pty/list", ...options });
var ptyCreate = (options) => (options.client ?? client2).post({
  url: "/pty/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var ptyKill = (options) => (options.client ?? client2).delete({ url: "/pty/{ptyID}", ...options });
var ptyGet = (options) => (options.client ?? client2).get({ url: "/pty/{ptyID}", ...options });
var instanceSync = (options) => (options?.client ?? client2).get({ url: "/instance/sync", ...options });
var instanceDispose = (options) => (options?.client ?? client2).post({ url: "/instance/dispose", ...options });
var instanceWorkspace = (options) => (options?.client ?? client2).get({ url: "/instance/workspace", ...options });
var instanceVersion = (options) => (options?.client ?? client2).get({ url: "/instance/version", ...options });
var instanceHealth = (options) => (options?.client ?? client2).get({ url: "/instance/health", ...options });
var tuiAppendPrompt = (options) => (options.client ?? client2).post({
  url: "/instance/tui/append-prompt",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiOpenHelp = (options) => (options?.client ?? client2).post({ url: "/instance/tui/open-help", ...options });
var tuiOpenSessions = (options) => (options?.client ?? client2).post({ url: "/instance/tui/open-sessions", ...options });
var tuiOpenThemes = (options) => (options?.client ?? client2).post({ url: "/instance/tui/open-themes", ...options });
var tuiOpenModels = (options) => (options?.client ?? client2).post({ url: "/instance/tui/open-models", ...options });
var tuiSubmitPrompt = (options) => (options?.client ?? client2).post({ url: "/instance/tui/submit-prompt", ...options });
var tuiClearPrompt = (options) => (options?.client ?? client2).post({ url: "/instance/tui/clear-prompt", ...options });
var tuiExecuteCommand = (options) => (options.client ?? client2).post({
  url: "/instance/tui/execute-command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiShowToast = (options) => (options.client ?? client2).post({
  url: "/instance/tui/show-toast",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiPublish = (options) => (options.client ?? client2).post({
  url: "/instance/tui/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiSelectSession = (options) => (options.client ?? client2).post({
  url: "/instance/tui/select-session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiControlNext = (options) => (options?.client ?? client2).get({ url: "/instance/tui/control/next", ...options });
var tuiControlResponse = (options) => (options.client ?? client2).post({
  url: "/instance/tui/control/response",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var pathGet = (options) => (options?.client ?? client2).get({ url: "/path", ...options });
var vcsGet = (options) => (options?.client ?? client2).get({ url: "/vcs", ...options });
var vcsWorktreeRemove = (options) => (options.client ?? client2).delete({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vcsWorktreeCreate = (options) => (options.client ?? client2).post({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var lspStatus = (options) => (options?.client ?? client2).get({ url: "/lsp", ...options });
var formatterStatus = (options) => (options?.client ?? client2).get({ url: "/formatter", ...options });
var skillToolIds = (options) => (options?.client ?? client2).get({ url: "/skill/tool-ids", ...options });
var skillTools = (options) => (options?.client ?? client2).get({ url: "/skill/tools", ...options });
var appSkills = (options) => (options?.client ?? client2).get({ url: "/skill", ...options });
var skillAdd = (options) => (options.client ?? client2).post({
  url: "/skill/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEval = (options) => (options.client ?? client2).post({
  url: "/skill/{name}/eval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEvalsList = (options) => (options.client ?? client2).get({ url: "/skill/{name}/evals", ...options });
var skillEvalsGet = (options) => (options.client ?? client2).get({ url: "/skill/{name}/evals/{id}", ...options });
var skillRegistry = (options) => (options?.client ?? client2).get({ url: "/skill/registry", ...options });
var skillPublish = (options) => (options.client ?? client2).post({
  url: "/skill/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillInstall = (options) => (options.client ?? client2).post({
  url: "/skill/{id}/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var getV1MemorySearch = (options) => (options?.client ?? client2).get({ url: "/memory/search", ...options });
var putV1MemoryL2ByType = (options) => (options.client ?? client2).put({
  url: "/memory/l2/{type}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryL1BySessionId = (options) => (options.client ?? client2).put({
  url: "/memory/l1/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryByFilename = (options) => (options.client ?? client2).put({
  url: "/memory/{filename}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tokensCount = (options) => (options.client ?? client2).post({
  url: "/tokens/count",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineExecute = (options) => (options.client ?? client2).post({
  url: "/engine/execute",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineWatch = (options) => (options.client ?? client2).sse.get({ url: "/engine/watch/{runId}", ...options });
var engineReceipts = (options) => (options.client ?? client2).get({ url: "/engine/receipts/{runId}", ...options });
var engineSnapshot = (options) => (options.client ?? client2).get({ url: "/engine/snapshot/{runId}", ...options });
var engineRunGet = (options) => (options.client ?? client2).get({ url: "/engine/runs/{runId}", ...options });
var engineRunEvents = (options) => (options.client ?? client2).get({ url: "/engine/runs/{runId}/events", ...options });
var engineRunApproval = (options) => (options.client ?? client2).post({
  url: "/engine/runs/{runId}/approval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunCancel = (options) => (options.client ?? client2).post({
  url: "/engine/runs/{runId}/cancel",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunPause = (options) => (options.client ?? client2).post({
  url: "/engine/runs/{runId}/pause",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunResume = (options) => (options.client ?? client2).post({
  url: "/engine/runs/{runId}/resume",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineHealth = (options) => (options?.client ?? client2).get({ url: "/engine/health", ...options });
var sandboxGet = (options) => (options.client ?? client2).get({ url: "/sandbox/{sessionID}", ...options });
var sandboxEnable = (options) => (options.client ?? client2).post({
  url: "/sandbox/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxDisable = (options) => (options.client ?? client2).post({ url: "/sandbox/{sessionID}/disable", ...options });
var sandboxToggle = (options) => (options.client ?? client2).post({
  url: "/sandbox/{sessionID}/toggle",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxPolicy = (options) => (options.client ?? client2).patch({
  url: "/sandbox/{sessionID}/policy",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDestroy = (options) => (options.client ?? client2).delete({ url: "/vm-session/{sessionID}", ...options });
var vmSessionGet = (options) => (options.client ?? client2).get({ url: "/vm-session/{sessionID}", ...options });
var vmSessionEnable = (options) => (options.client ?? client2).post({
  url: "/vm-session/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDisable = (options) => (options.client ?? client2).post({ url: "/vm-session/{sessionID}/disable", ...options });
var vmSessionToggle = (options) => (options.client ?? client2).post({ url: "/vm-session/{sessionID}/toggle", ...options });
var postV1PluginInstall = (options) => (options.client ?? client2).post({
  url: "/plugin/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var postV1PluginRemove = (options) => (options.client ?? client2).post({
  url: "/plugin/remove",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var eventSubscribe = (options) => (options?.client ?? client2).sse.get({ url: "/event", ...options });
var arsContextaHealth = (options) => (options?.client ?? client2).get({ url: "/ars-contexta/health", ...options });
var arsContextaInsights = (options) => (options.client ?? client2).post({
  url: "/ars-contexta/insights",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEntities = (options) => (options.client ?? client2).post({
  url: "/ars-contexta/entities",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEnrich = (options) => (options.client ?? client2).post({
  url: "/ars-contexta/enrich",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaProviders = (options) => (options?.client ?? client2).get({ url: "/ars-contexta/providers", ...options });
var authRemove = (options) => (options.client ?? client2).delete({ url: "/auth/{providerID}", ...options });
var authSet = (options) => (options.client ?? client2).put({
  url: "/auth/{providerID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkStart = (options) => (options.client ?? client2).post({
  url: "/auth/terminal/clerk/start",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkPoll = (options) => (options.client ?? client2).get({ url: "/auth/terminal/clerk/poll/{sessionID}", ...options });
var terminalClerkClaim = (options) => (options.client ?? client2).post({ url: "/auth/terminal/clerk/claim/{sessionID}", ...options });
var terminalClerkCallback = (options) => (options.client ?? client2).post({ url: "/auth/terminal/clerk/callback/{sessionID}", ...options });
var projectListRoot = (options) => (options?.client ?? client2).get({ url: "/project", ...options });
var projectInit = (options) => (options.client ?? client2).post({
  url: "/project/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectList = (options) => (options?.client ?? client2).get({ url: "/project/list", ...options });
var projectSessionList = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/session", ...options });
var projectSessionCreate = (options) => (options.client ?? client2).post({
  url: "/project/{projectID}/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionDelete = (options) => (options.client ?? client2).delete({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionGet = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionInitialize = (options) => (options.client ?? client2).post({
  url: "/project/{projectID}/session/{sessionID}/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionAbort = (options) => (options.client ?? client2).post({ url: "/project/{projectID}/session/{sessionID}/abort", ...options });
var projectSessionUnshare = (options) => (options.client ?? client2).delete({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionShare = (options) => (options.client ?? client2).post({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionCompact = (options) => (options.client ?? client2).post({ url: "/project/{projectID}/session/{sessionID}/compact", ...options });
var projectSessionMessages = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/session/{sessionID}/message", ...options });
var projectSessionMessageCreate = (options) => (options.client ?? client2).post({
  url: "/project/{projectID}/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionMessageGet = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/session/{sessionID}/message/{messageID}", ...options });
var projectSessionRevert = (options) => (options.client ?? client2).post({
  url: "/project/{projectID}/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionUnrevert = (options) => (options.client ?? client2).post({ url: "/project/{projectID}/session/{sessionID}/unrevert", ...options });
var projectSessionPermissionReply = (options) => (options.client ?? client2).post({
  url: "/project/{projectID}/session/{sessionID}/permission/{permissionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionFileFind = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/session/{sessionID}/find/file", ...options });
var projectSessionFileStatus = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/session/{sessionID}/file/status", ...options });
var projectSessionFileRead = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/session/{sessionID}/file", ...options });
var projectAgentList = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/agent", ...options });
var projectFindFile = (options) => (options.client ?? client2).get({ url: "/project/{projectID}/find/file", ...options });
var projectGet = (options) => (options.client ?? client2).get({ url: "/project/{projectID}", ...options });
var projectUpdate = (options) => (options.client ?? client2).patch({
  url: "/project/{projectID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceGet = (options) => (options?.client ?? client2).get({ url: "/workspace", ...options });
var workspaceInit = (options) => (options.client ?? client2).post({
  url: "/workspace/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceImport = (options) => (options.client ?? client2).post({
  url: "/workspace/import",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceIdentityGet = (options) => (options?.client ?? client2).get({ url: "/workspace/identity", ...options });
var workspaceIdentityPut = (options) => (options.client ?? client2).put({
  url: "/workspace/identity",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceLayers = (options) => (options?.client ?? client2).get({ url: "/workspace/layers", ...options });
var workspaceMemoryGet = (options) => (options?.client ?? client2).get({ url: "/workspace/memory", ...options });
var workspaceMemoryPost = (options) => (options.client ?? client2).post({
  url: "/workspace/memory",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceActivate = (options) => (options.client ?? client2).post({
  url: "/workspace/activate",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceSkills = (options) => (options?.client ?? client2).get({ url: "/workspace/skills", ...options });
var globalHealth = (options) => (options?.client ?? client2).get({ url: "/global/health", ...options });
var globalEvent = (options) => (options?.client ?? client2).sse.get({ url: "/global/event", ...options });
var globalVersion = (options) => (options?.client ?? client2).get({ url: "/global/version", ...options });

// packages/sdk/dist/gen/allternit-client.ts
class HeyApiClient {
  client;
  constructor(args) {
    this.client = args?.client ?? client;
  }
}

class HeyApiRegistry {
  defaultKey = "default";
  instances = new Map;
  get(key) {
    const instance = this.instances.get(key ?? this.defaultKey);
    if (!instance) {
      throw new Error(`No SDK client found. Create one with "new AllternitClient()" to fix this error.`);
    }
    return instance;
  }
  set(value, key) {
    this.instances.set(key ?? this.defaultKey, value);
  }
}

class ArsContexta extends HeyApiClient {
  enrich(options) {
    return arsContextaEnrich({ ...options, client: this.client });
  }
  entities(options) {
    return arsContextaEntities({ ...options, client: this.client });
  }
  health(options) {
    return arsContextaHealth({ ...options, client: this.client });
  }
  insights(options) {
    return arsContextaInsights({ ...options, client: this.client });
  }
  providers(options) {
    return arsContextaProviders({ ...options, client: this.client });
  }
}

class CronCleanup extends HeyApiClient {
  session(options) {
    return cronCleanupSession({ ...options, client: this.client });
  }
}

class EngineRun extends HeyApiClient {
  approval(options) {
    return engineRunApproval({ ...options, client: this.client });
  }
  cancel(options) {
    return engineRunCancel({ ...options, client: this.client });
  }
  events(options) {
    return engineRunEvents({ ...options, client: this.client });
  }
  get(options) {
    return engineRunGet({ ...options, client: this.client });
  }
  pause(options) {
    return engineRunPause({ ...options, client: this.client });
  }
  resume(options) {
    return engineRunResume({ ...options, client: this.client });
  }
}

class ProjectAgent extends HeyApiClient {
  list(options) {
    return projectAgentList({ ...options, client: this.client });
  }
}

class ProjectFind extends HeyApiClient {
  file(options) {
    return projectFindFile({ ...options, client: this.client });
  }
}

class ProjectSession extends HeyApiClient {
  abort(options) {
    return projectSessionAbort({ ...options, client: this.client });
  }
  compact(options) {
    return projectSessionCompact({ ...options, client: this.client });
  }
  create(options) {
    return projectSessionCreate({ ...options, client: this.client });
  }
  delete(options) {
    return projectSessionDelete({ ...options, client: this.client });
  }
  get(options) {
    return projectSessionGet({ ...options, client: this.client });
  }
  initialize(options) {
    return projectSessionInitialize({ ...options, client: this.client });
  }
  list(options) {
    return projectSessionList({ ...options, client: this.client });
  }
  messages(options) {
    return projectSessionMessages({ ...options, client: this.client });
  }
  revert(options) {
    return projectSessionRevert({ ...options, client: this.client });
  }
  share(options) {
    return projectSessionShare({ ...options, client: this.client });
  }
  unrevert(options) {
    return projectSessionUnrevert({ ...options, client: this.client });
  }
  unshare(options) {
    return projectSessionUnshare({ ...options, client: this.client });
  }
}

class ProviderOauth extends HeyApiClient {
  authorize(options) {
    return providerOauthAuthorize({ ...options, client: this.client });
  }
  verify(options) {
    return providerOauthVerify({ ...options, client: this.client });
  }
  callback(options) {
    return this.verify({ ...options, client: this.client });
  }
}

class SkillEvals extends HeyApiClient {
  get(options) {
    return skillEvalsGet({ ...options, client: this.client });
  }
  list(options) {
    return skillEvalsList({ ...options, client: this.client });
  }
}

class SkillTool extends HeyApiClient {
  ids(options) {
    return skillToolIds({ ...options, client: this.client });
  }
}

class TerminalClerk extends HeyApiClient {
  callback(options) {
    return terminalClerkCallback({ ...options, client: this.client });
  }
  claim(options) {
    return terminalClerkClaim({ ...options, client: this.client });
  }
  poll(options) {
    return terminalClerkPoll({ ...options, client: this.client });
  }
  start(options) {
    return terminalClerkStart({ ...options, client: this.client });
  }
}

class TuiAppend extends HeyApiClient {
  prompt(options) {
    return tuiAppendPrompt({ ...options, client: this.client });
  }
}

class TuiClear extends HeyApiClient {
  prompt(options) {
    return tuiClearPrompt({ ...options, client: this.client });
  }
}

class TuiControl extends HeyApiClient {
  next(options) {
    return tuiControlNext({ ...options, client: this.client });
  }
  response(options) {
    return tuiControlResponse({ ...options, client: this.client });
  }
}

class TuiExecute extends HeyApiClient {
  command(options) {
    return tuiExecuteCommand({ ...options, client: this.client });
  }
}

class TuiOpen extends HeyApiClient {
  help(options) {
    return tuiOpenHelp({ ...options, client: this.client });
  }
  models(options) {
    return tuiOpenModels({ ...options, client: this.client });
  }
  sessions(options) {
    return tuiOpenSessions({ ...options, client: this.client });
  }
  themes(options) {
    return tuiOpenThemes({ ...options, client: this.client });
  }
}

class TuiSelect extends HeyApiClient {
  session(options) {
    return tuiSelectSession({ ...options, client: this.client });
  }
}

class TuiShow extends HeyApiClient {
  toast(options) {
    return tuiShowToast({ ...options, client: this.client });
  }
}

class TuiSubmit extends HeyApiClient {
  prompt(options) {
    return tuiSubmitPrompt({ ...options, client: this.client });
  }
}

class VcsWorktree extends HeyApiClient {
  create(options) {
    return vcsWorktreeCreate({ ...options, client: this.client });
  }
  remove(options) {
    return vcsWorktreeRemove({ ...options, client: this.client });
  }
}

class VmSession extends HeyApiClient {
  destroy(options) {
    return vmSessionDestroy({ ...options, client: this.client });
  }
  disable(options) {
    return vmSessionDisable({ ...options, client: this.client });
  }
  enable(options) {
    return vmSessionEnable({ ...options, client: this.client });
  }
  get(options) {
    return vmSessionGet({ ...options, client: this.client });
  }
  toggle(options) {
    return vmSessionToggle({ ...options, client: this.client });
  }
}

class WorkspaceIdentity extends HeyApiClient {
  get(options) {
    return workspaceIdentityGet({ ...options, client: this.client });
  }
  put(options) {
    return workspaceIdentityPut({ ...options, client: this.client });
  }
}

class WorkspaceMemory extends HeyApiClient {
  get(options) {
    return workspaceMemoryGet({ ...options, client: this.client });
  }
  post(options) {
    return workspaceMemoryPost({ ...options, client: this.client });
  }
}

class Agent extends HeyApiClient {
  create(options) {
    return agentCreate({ ...options, client: this.client });
  }
  get(options) {
    return agentGet({ ...options, client: this.client });
  }
  list(options) {
    return agentList({ ...options, client: this.client });
  }
  update(options) {
    return agentUpdate({ ...options, client: this.client });
  }
}

class App extends HeyApiClient {
  agents(options) {
    return agentList({ ...options, client: this.client });
  }
  skills(options) {
    return appSkills({ ...options, client: this.client });
  }
}

class Ars extends HeyApiClient {
  _contexta;
  get contexta() {
    return this._contexta ??= new ArsContexta({ client: this.client });
  }
}

class Asset extends HeyApiClient {
  delete(options) {
    return assetDelete({ ...options, client: this.client });
  }
  get(options) {
    return assetGet({ ...options, client: this.client });
  }
  list(options) {
    return assetList({ ...options, client: this.client });
  }
  upload(options) {
    return assetUpload({ ...options, client: this.client });
  }
}

class Auth extends HeyApiClient {
  remove(options) {
    return authRemove({ ...options, client: this.client });
  }
  set(options) {
    return authSet({ ...options, client: this.client });
  }
}

class Command extends HeyApiClient {
  list(options) {
    return commandList({ ...options, client: this.client });
  }
}

class Config extends HeyApiClient {
  get(options) {
    return configGet({ ...options, client: this.client });
  }
  providers(options) {
    return configProviders({ ...options, client: this.client });
  }
  update(options) {
    return configUpdate({ ...options, client: this.client });
  }
}

class Cron extends HeyApiClient {
  allruns(options) {
    return cronAllRuns({ ...options, client: this.client });
  }
  create(options) {
    return cronCreate({ ...options, client: this.client });
  }
  delete(options) {
    return cronDelete({ ...options, client: this.client });
  }
  get(options) {
    return cronGet({ ...options, client: this.client });
  }
  getrun(options) {
    return cronGetRun({ ...options, client: this.client });
  }
  list(options) {
    return cronList({ ...options, client: this.client });
  }
  pause(options) {
    return cronPause({ ...options, client: this.client });
  }
  resume(options) {
    return cronResume({ ...options, client: this.client });
  }
  run(options) {
    return cronRun({ ...options, client: this.client });
  }
  runs(options) {
    return cronRuns({ ...options, client: this.client });
  }
  status(options) {
    return cronStatus({ ...options, client: this.client });
  }
  update(options) {
    return cronUpdate({ ...options, client: this.client });
  }
  wake(options) {
    return cronWake({ ...options, client: this.client });
  }
  _cleanup;
  get cleanup() {
    return this._cleanup ??= new CronCleanup({ client: this.client });
  }
}

class Engine extends HeyApiClient {
  execute(options) {
    return engineExecute({ ...options, client: this.client });
  }
  health(options) {
    return engineHealth({ ...options, client: this.client });
  }
  receipts(options) {
    return engineReceipts({ ...options, client: this.client });
  }
  snapshot(options) {
    return engineSnapshot({ ...options, client: this.client });
  }
  watch(options) {
    return engineWatch({ ...options, client: this.client });
  }
  _run;
  get run() {
    return this._run ??= new EngineRun({ client: this.client });
  }
}

class Event extends HeyApiClient {
  async* stream(options) {
    const response = await this.subscribe(options);
    for await (const item of response.stream) {
      yield item;
    }
  }
  subscribe(options) {
    return eventSubscribe({ ...options, client: this.client });
  }
}

class File extends HeyApiClient {
  glob(options) {
    return fileGlob({ ...options, client: this.client });
  }
  info(options) {
    return fileInfo({ ...options, client: this.client });
  }
  read(options) {
    return fileRead({ ...options, client: this.client });
  }
  search(options) {
    return fileSearch({ ...options, client: this.client });
  }
  symbols(options) {
    return fileSymbols({ ...options, client: this.client });
  }
  tree(options) {
    return fileTree({ ...options, client: this.client });
  }
}

class Files extends HeyApiClient {
  delete(options) {
    return filesDelete({ ...options, client: this.client });
  }
  get(options) {
    return filesGet({ ...options, client: this.client });
  }
  list(options) {
    return filesList({ ...options, client: this.client });
  }
  upload(options) {
    return filesUpload({ ...options, client: this.client });
  }
}

class Formatter extends HeyApiClient {
  status(options) {
    return formatterStatus({ ...options, client: this.client });
  }
}

class Get extends HeyApiClient {
  v1memorysearch(options) {
    return getV1MemorySearch({ ...options, client: this.client });
  }
}

class Global extends HeyApiClient {
  async* stream(options) {
    const response = await this.event(options);
    for await (const item of response.stream) {
      yield item?.payload ?? item;
    }
  }
  event(options) {
    return globalEvent({ ...options, client: this.client });
  }
  health(options) {
    return globalHealth({ ...options, client: this.client });
  }
  version(options) {
    return globalVersion({ ...options, client: this.client });
  }
}

class Instance extends HeyApiClient {
  sync(options) {
    return this.client.get({
      url: "/instance/sync",
      ...options
    });
  }
  dispose(options) {
    return instanceDispose({ ...options, client: this.client });
  }
  health(options) {
    return instanceHealth({ ...options, client: this.client });
  }
  sync(options) {
    return instanceSync({ ...options, client: this.client });
  }
  version(options) {
    return instanceVersion({ ...options, client: this.client });
  }
  workspace(options) {
    return instanceWorkspace({ ...options, client: this.client });
  }
}

class Lsp extends HeyApiClient {
  status(options) {
    return lspStatus({ ...options, client: this.client });
  }
}

class Mcp extends HeyApiClient {
  add(options) {
    return mcpAdd({ ...options, client: this.client });
  }
  list(options) {
    return mcpList({ ...options, client: this.client });
  }
  remove(options) {
    return mcpRemove({ ...options, client: this.client });
  }
  resources(options) {
    return mcpResources({ ...options, client: this.client });
  }
  status(options) {
    return mcpStatus({ ...options, client: this.client });
  }
}

class Path extends HeyApiClient {
  get(options) {
    return pathGet({ ...options, client: this.client });
  }
}

class Permission extends HeyApiClient {
  list(options) {
    return permissionList({ ...options, client: this.client });
  }
  reply(options) {
    return permissionReply({ ...options, client: this.client });
  }
}

class Post extends HeyApiClient {
  v1plugininstall(options) {
    return postV1PluginInstall({ ...options, client: this.client });
  }
  v1pluginremove(options) {
    return postV1PluginRemove({ ...options, client: this.client });
  }
}

class Project extends HeyApiClient {
  get(options) {
    return projectGet({ ...options, client: this.client });
  }
  init(options) {
    return projectInit({ ...options, client: this.client });
  }
  list(options) {
    return projectList({ ...options, client: this.client });
  }
  listroot(options) {
    return projectListRoot({ ...options, client: this.client });
  }
  sessionfilefind(options) {
    return projectSessionFileFind({ ...options, client: this.client });
  }
  sessionfileread(options) {
    return projectSessionFileRead({ ...options, client: this.client });
  }
  sessionfilestatus(options) {
    return projectSessionFileStatus({ ...options, client: this.client });
  }
  sessionmessagecreate(options) {
    return projectSessionMessageCreate({ ...options, client: this.client });
  }
  sessionmessageget(options) {
    return projectSessionMessageGet({ ...options, client: this.client });
  }
  sessionpermissionreply(options) {
    return projectSessionPermissionReply({ ...options, client: this.client });
  }
  update(options) {
    return projectUpdate({ ...options, client: this.client });
  }
  _agent;
  get agent() {
    return this._agent ??= new ProjectAgent({ client: this.client });
  }
  _find;
  get find() {
    return this._find ??= new ProjectFind({ client: this.client });
  }
  _session;
  get session() {
    return this._session ??= new ProjectSession({ client: this.client });
  }
}

class Provider extends HeyApiClient {
  auth(options) {
    return providerAuth({ ...options, client: this.client });
  }
  list(options) {
    return providerList({ ...options, client: this.client });
  }
  _oauth;
  get oauth() {
    return this._oauth ??= new ProviderOauth({ client: this.client });
  }
}

class Pty extends HeyApiClient {
  create(options) {
    return ptyCreate({ ...options, client: this.client });
  }
  get(options) {
    return ptyGet({ ...options, client: this.client });
  }
  kill(options) {
    return ptyKill({ ...options, client: this.client });
  }
  list(options) {
    return ptyList({ ...options, client: this.client });
  }
}

class Put extends HeyApiClient {
  v1memorybyfilename(options) {
    return putV1MemoryByFilename({ ...options, client: this.client });
  }
  v1memoryl1bysessionid(options) {
    return putV1MemoryL1BySessionId({ ...options, client: this.client });
  }
  v1memoryl2bytype(options) {
    return putV1MemoryL2ByType({ ...options, client: this.client });
  }
}

class Question extends HeyApiClient {
  list(options) {
    return questionList({ ...options, client: this.client });
  }
  reject(options) {
    return questionReject({ ...options, client: this.client });
  }
  reply(options) {
    return questionReply({ ...options, client: this.client });
  }
}

class Sandbox extends HeyApiClient {
  disable(options) {
    return sandboxDisable({ ...options, client: this.client });
  }
  enable(options) {
    return sandboxEnable({ ...options, client: this.client });
  }
  get(options) {
    return sandboxGet({ ...options, client: this.client });
  }
  policy(options) {
    return sandboxPolicy({ ...options, client: this.client });
  }
  toggle(options) {
    return sandboxToggle({ ...options, client: this.client });
  }
}

class Session extends HeyApiClient {
  clear(options) {
    const { sessionID } = options?.path ?? {};
    return this.client.post({
      url: `/session/${sessionID}/clear`,
      ...options
    });
  }
  convertOptions(options) {
    if (!options)
      return options;
    if (options.path || !options.sessionID)
      return options;
    const { sessionID, ...rest } = options;
    return {
      path: { sessionID },
      body: rest
    };
  }
  abort(options) {
    return sessionAbort({ ...this.convertOptions(options), client: this.client });
  }
  allstatus(options) {
    return sessionAllStatus({ ...options, client: this.client });
  }
  children(options) {
    return sessionChildren({ ...this.convertOptions(options), client: this.client });
  }
  clear(options) {
    return sessionClear({ ...this.convertOptions(options), client: this.client });
  }
  command(options) {
    return sessionCommand({ ...this.convertOptions(options), client: this.client });
  }
  create(options) {
    return sessionCreate({ ...options, client: this.client });
  }
  delete(options) {
    return sessionDelete({ ...this.convertOptions(options), client: this.client });
  }
  diff(options) {
    return sessionDiff({ ...this.convertOptions(options), client: this.client });
  }
  fork(options) {
    return sessionFork({ ...this.convertOptions(options), client: this.client });
  }
  get(options) {
    return sessionGet({ ...this.convertOptions(options), client: this.client });
  }
  initialize(options) {
    return sessionInitialize({ ...this.convertOptions(options), client: this.client });
  }
  list(options) {
    return sessionList({ ...options, client: this.client });
  }
  listglobal(options) {
    return sessionListGlobal({ ...options, client: this.client });
  }
  messages(options) {
    return sessionMessages({ ...this.convertOptions(options), client: this.client });
  }
  prompt(options) {
    return sessionPrompt({ ...this.convertOptions(options), client: this.client });
  }
  revert(options) {
    return sessionRevert({ ...this.convertOptions(options), client: this.client });
  }
  share(options) {
    return sessionShare({ ...this.convertOptions(options), client: this.client });
  }
  summarize(options) {
    return sessionSummarize({ ...this.convertOptions(options), client: this.client });
  }
  todo(options) {
    return sessionTodo({ ...this.convertOptions(options), client: this.client });
  }
  unrevert(options) {
    return sessionUnrevert({ ...this.convertOptions(options), client: this.client });
  }
  update(options) {
    return sessionUpdate({ ...this.convertOptions(options), client: this.client });
  }
}

class Skill extends HeyApiClient {
  add(options) {
    return skillAdd({ ...options, client: this.client });
  }
  eval(options) {
    return skillEval({ ...options, client: this.client });
  }
  install(options) {
    return skillInstall({ ...options, client: this.client });
  }
  publish(options) {
    return skillPublish({ ...options, client: this.client });
  }
  registry(options) {
    return skillRegistry({ ...options, client: this.client });
  }
  tools(options) {
    return skillTools({ ...options, client: this.client });
  }
  _evals;
  get evals() {
    return this._evals ??= new SkillEvals({ client: this.client });
  }
  _tool;
  get tool() {
    return this._tool ??= new SkillTool({ client: this.client });
  }
}

class Terminal extends HeyApiClient {
  _clerk;
  get clerk() {
    return this._clerk ??= new TerminalClerk({ client: this.client });
  }
}

class Tokens extends HeyApiClient {
  count(options) {
    return tokensCount({ ...options, client: this.client });
  }
}

class Tui extends HeyApiClient {
  publish(options) {
    return tuiPublish({ ...options, client: this.client });
  }
  _append;
  get append() {
    return this._append ??= new TuiAppend({ client: this.client });
  }
  _clear;
  get clear() {
    return this._clear ??= new TuiClear({ client: this.client });
  }
  _control;
  get control() {
    return this._control ??= new TuiControl({ client: this.client });
  }
  _execute;
  get execute() {
    return this._execute ??= new TuiExecute({ client: this.client });
  }
  _open;
  get open() {
    return this._open ??= new TuiOpen({ client: this.client });
  }
  _select;
  get select() {
    return this._select ??= new TuiSelect({ client: this.client });
  }
  _show;
  get show() {
    return this._show ??= new TuiShow({ client: this.client });
  }
  _submit;
  get submit() {
    return this._submit ??= new TuiSubmit({ client: this.client });
  }
}

class User extends HeyApiClient {
  clear(options) {
    return userClear({ ...options, client: this.client });
  }
  get(options) {
    return userGet({ ...options, client: this.client });
  }
  onboard(options) {
    return userOnboard({ ...options, client: this.client });
  }
  refresh(options) {
    return userRefresh({ ...options, client: this.client });
  }
}

class Vcs extends HeyApiClient {
  get(options) {
    return vcsGet({ ...options, client: this.client });
  }
  _worktree;
  get worktree() {
    return this._worktree ??= new VcsWorktree({ client: this.client });
  }
}

class Vm extends HeyApiClient {
  _session;
  get session() {
    return this._session ??= new VmSession({ client: this.client });
  }
}

class Workspace extends HeyApiClient {
  activate(options) {
    return workspaceActivate({ ...options, client: this.client });
  }
  get(options) {
    return workspaceGet({ ...options, client: this.client });
  }
  import(options) {
    return workspaceImport({ ...options, client: this.client });
  }
  init(options) {
    return workspaceInit({ ...options, client: this.client });
  }
  layers(options) {
    return workspaceLayers({ ...options, client: this.client });
  }
  skills(options) {
    return workspaceSkills({ ...options, client: this.client });
  }
  _identity;
  get identity() {
    return this._identity ??= new WorkspaceIdentity({ client: this.client });
  }
  _memory;
  get memory() {
    return this._memory ??= new WorkspaceMemory({ client: this.client });
  }
}

class AllternitClient extends HeyApiClient {
  static __registry = new HeyApiRegistry;
  constructor(args) {
    super(args);
    AllternitClient.__registry.set(this, args?.key);
  }
  _agent;
  get agent() {
    return this._agent ??= new Agent({ client: this.client });
  }
  _app;
  get app() {
    return this._app ??= new App({ client: this.client });
  }
  _ars;
  get ars() {
    return this._ars ??= new Ars({ client: this.client });
  }
  _asset;
  get asset() {
    return this._asset ??= new Asset({ client: this.client });
  }
  _auth;
  get auth() {
    return this._auth ??= new Auth({ client: this.client });
  }
  _command;
  get command() {
    return this._command ??= new Command({ client: this.client });
  }
  _config;
  get config() {
    return this._config ??= new Config({ client: this.client });
  }
  _cron;
  get cron() {
    return this._cron ??= new Cron({ client: this.client });
  }
  _engine;
  get engine() {
    return this._engine ??= new Engine({ client: this.client });
  }
  _event;
  get event() {
    return this._event ??= new Event({ client: this.client });
  }
  _file;
  get file() {
    return this._file ??= new File({ client: this.client });
  }
  _files;
  get files() {
    return this._files ??= new Files({ client: this.client });
  }
  _formatter;
  get formatter() {
    return this._formatter ??= new Formatter({ client: this.client });
  }
  _get;
  get get() {
    return this._get ??= new Get({ client: this.client });
  }
  _global;
  get global() {
    return this._global ??= new Global({ client: this.client });
  }
  _instance;
  get instance() {
    return this._instance ??= new Instance({ client: this.client });
  }
  _lsp;
  get lsp() {
    return this._lsp ??= new Lsp({ client: this.client });
  }
  _mcp;
  get mcp() {
    return this._mcp ??= new Mcp({ client: this.client });
  }
  _path;
  get path() {
    return this._path ??= new Path({ client: this.client });
  }
  _permission;
  get permission() {
    return this._permission ??= new Permission({ client: this.client });
  }
  _post;
  get post() {
    return this._post ??= new Post({ client: this.client });
  }
  _project;
  get project() {
    return this._project ??= new Project({ client: this.client });
  }
  _provider;
  get provider() {
    return this._provider ??= new Provider({ client: this.client });
  }
  _pty;
  get pty() {
    return this._pty ??= new Pty({ client: this.client });
  }
  _put;
  get put() {
    return this._put ??= new Put({ client: this.client });
  }
  _question;
  get question() {
    return this._question ??= new Question({ client: this.client });
  }
  _sandbox;
  get sandbox() {
    return this._sandbox ??= new Sandbox({ client: this.client });
  }
  _session;
  get session() {
    return this._session ??= new Session({ client: this.client });
  }
  _skill;
  get skill() {
    return this._skill ??= new Skill({ client: this.client });
  }
  _terminal;
  get terminal() {
    return this._terminal ??= new Terminal({ client: this.client });
  }
  _tokens;
  get tokens() {
    return this._tokens ??= new Tokens({ client: this.client });
  }
  _tui;
  get tui() {
    return this._tui ??= new Tui({ client: this.client });
  }
  _user;
  get user() {
    return this._user ??= new User({ client: this.client });
  }
  _vcs;
  get vcs() {
    return this._vcs ??= new Vcs({ client: this.client });
  }
  _vm;
  get vm() {
    return this._vm ??= new Vm({ client: this.client });
  }
  _workspace;
  get workspace() {
    return this._workspace ??= new Workspace({ client: this.client });
  }
  events(options) {
    return this.event.stream(options);
  }
  globalEvents(options) {
    return this.global.stream(options);
  }
  async* on(type, options) {
    for await (const event of this.events(options)) {
      if (event.type === type) {
        yield event;
      }
    }
  }
}
function createAllternitClient(config) {
  if (!config?.fetch) {
    const customFetch = (req) => {
      req.timeout = false;
      return fetch(req);
    };
    config = { ...config, fetch: customFetch };
  }
  if (config?.directory) {
    const isNonASCII = /[^\x00-\x7F]/.test(config.directory);
    const encodedDirectory = isNonASCII ? encodeURIComponent(config.directory) : config.directory;
    config.headers = { ...config.headers, "x-opencode-directory": encodedDirectory };
  }
  const clientInstance = createClient(config);
  return new AllternitClient({ client: clientInstance });
}
// packages/sdk/dist/gen/core/bodySerializer.gen.ts
var jsonBodySerializer4 = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};
// packages/sdk/dist/gen/core/params.gen.ts
var extraPrefixesMap4 = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes4 = Object.entries(extraPrefixesMap4);
// packages/sdk/dist/gen/core/serverSentEvents.gen.ts
var createSseClient4 = ({
  onRequest,
  onSseError,
  onSseEvent,
  responseTransformer,
  responseValidator,
  sseDefaultRetryDelay,
  sseMaxRetryAttempts,
  sseMaxRetryDelay,
  sseSleepFn,
  url,
  ...options
}) => {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3000;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted)
        break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== undefined) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const requestInit = {
          redirect: "follow",
          ...options,
          body: options.serializedBody,
          headers,
          signal
        };
        let request = new Request(url, requestInit);
        if (onRequest) {
          request = await onRequest(url, requestInit);
        }
        const _fetch = options.fetch ?? globalThis.fetch;
        const response = await _fetch(request);
        if (!response.ok)
          throw new Error(`SSE failed: ${response.status} ${response.statusText}`);
        if (!response.body)
          throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            reader.cancel();
          } catch {}
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += value;
            buffer = buffer.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
            const chunks = buffer.split(`

`);
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split(`
`);
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(line.replace(/^retry:\s*/, ""), 10);
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join(`
`);
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error) {
        onSseError?.(error);
        if (sseMaxRetryAttempts !== undefined && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(retryDelay * 2 ** (attempt - 1), sseMaxRetryDelay ?? 30000);
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
};

// packages/sdk/dist/gen/core/pathSerializer.gen.ts
var separatorArrayExplode4 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var separatorArrayNoExplode4 = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var separatorObjectExplode4 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var serializeArrayParam4 = ({
  allowReserved,
  explode,
  name,
  style,
  value
}) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode4(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode4(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam4({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var serializePrimitiveParam4 = ({
  allowReserved,
  name,
  value
}) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
var serializeObjectParam4 = ({
  allowReserved,
  explode,
  name,
  style,
  value,
  valueOnly
}) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [...values, key, allowReserved ? v : encodeURIComponent(v)];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode4(style);
  const joinedValues = Object.entries(value).map(([key, v]) => serializePrimitiveParam4({
    allowReserved,
    name: style === "deepObject" ? `${name}[${key}]` : key,
    value: v
  })).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};

// packages/sdk/dist/gen/core/utils.gen.ts
var PATH_PARAM_RE4 = /\{[^{}]+\}/g;
var defaultPathSerializer4 = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE4);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(match, serializeArrayParam4({ explode, name, style, value }));
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(match, serializeObjectParam4({
          explode,
          name,
          style,
          value,
          valueOnly: true
        }));
        continue;
      }
      if (style === "matrix") {
        url = url.replace(match, `;${serializePrimitiveParam4({
          name,
          value
        })}`);
        continue;
      }
      const replaceValue = encodeURIComponent(style === "label" ? `.${value}` : value);
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
var getUrl4 = ({
  baseUrl,
  path,
  query,
  querySerializer,
  url: _url
}) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer4({ path, url });
  }
  let search = query ? querySerializer(query) : "";
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    url += `?${search}`;
  }
  return url;
};
function getValidRequestBody4(options) {
  const hasBody = options.body !== undefined;
  const isSerializedBody = hasBody && options.bodySerializer;
  if (isSerializedBody) {
    if ("serializedBody" in options) {
      const hasSerializedBody = options.serializedBody !== undefined && options.serializedBody !== "";
      return hasSerializedBody ? options.serializedBody : null;
    }
    return options.body !== "" ? options.body : null;
  }
  if (hasBody) {
    return options.body;
  }
  return;
}

// packages/sdk/dist/gen/core/auth.gen.ts
var getAuthToken4 = async (auth, callback) => {
  const token = typeof callback === "function" ? await callback(auth) : callback;
  if (!token) {
    return;
  }
  if (auth.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};

// packages/sdk/dist/gen/client/utils.gen.ts
var createQuerySerializer4 = ({
  parameters = {},
  ...args
} = {}) => {
  const querySerializer = (queryParams) => {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === undefined || value === null) {
          continue;
        }
        const options = parameters[name] || args;
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam4({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...options.array
          });
          if (serializedArray)
            search.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam4({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...options.object
          });
          if (serializedObject)
            search.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam4({
            allowReserved: options.allowReserved,
            name,
            value
          });
          if (serializedPrimitive)
            search.push(serializedPrimitive);
        }
      }
    }
    return search.join("&");
  };
  return querySerializer;
};
var getParseAs4 = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
var checkForExistence4 = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
var setAuthParams4 = async ({
  security,
  ...options
}) => {
  for (const auth of security) {
    if (checkForExistence4(options, auth.name)) {
      continue;
    }
    const token = await getAuthToken4(auth, options.auth);
    if (!token) {
      continue;
    }
    const name = auth.name ?? "Authorization";
    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
};
var buildUrl4 = (options) => getUrl4({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer4(options.querySerializer),
  url: options.url
});
var mergeConfigs4 = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders4(a.headers, b.headers);
  return config;
};
var headersEntries4 = (headers) => {
  const entries = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
};
var mergeHeaders4 = (...headers) => {
  const mergedHeaders = new Headers;
  for (const header of headers) {
    if (!header) {
      continue;
    }
    const iterator = header instanceof Headers ? headersEntries4(header) : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== undefined) {
        mergedHeaders.set(key, typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
  }
  return mergedHeaders;
};

class Interceptors4 {
  fns = [];
  clear() {
    this.fns = [];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = null;
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return Boolean(this.fns[index]);
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this.fns[id] ? id : -1;
    }
    return this.fns.indexOf(id);
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = fn;
      return id;
    }
    return false;
  }
  use(fn) {
    this.fns.push(fn);
    return this.fns.length - 1;
  }
}
var createInterceptors4 = () => ({
  error: new Interceptors4,
  request: new Interceptors4,
  response: new Interceptors4
});
var defaultQuerySerializer4 = createQuerySerializer4({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
var defaultHeaders4 = {
  "Content-Type": "application/json"
};
var createConfig4 = (override = {}) => ({
  ...jsonBodySerializer4,
  headers: defaultHeaders4,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer4,
  ...override
});

// packages/sdk/dist/gen/client/client.gen.ts
var createClient4 = (config = {}) => {
  let _config = mergeConfigs4(createConfig4(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs4(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors4();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders4(_config.headers, options.headers),
      serializedBody: undefined
    };
    if (opts.security) {
      await setAuthParams4({
        ...opts,
        security: opts.security
      });
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body !== undefined && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.body === undefined || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const url = buildUrl4(opts);
    return { opts, url };
  };
  const request = async (options) => {
    const { opts, url } = await beforeRequest(options);
    const requestInit = {
      redirect: "follow",
      ...opts,
      body: getValidRequestBody4(opts)
    };
    let request2 = new Request(url, requestInit);
    for (const fn of interceptors.request.fns) {
      if (fn) {
        request2 = await fn(request2, opts);
      }
    }
    const _fetch = opts.fetch;
    let response;
    try {
      response = await _fetch(request2);
    } catch (error2) {
      let finalError2 = error2;
      for (const fn of interceptors.error.fns) {
        if (fn) {
          finalError2 = await fn(error2, undefined, request2, opts);
        }
      }
      finalError2 = finalError2 || {};
      if (opts.throwOnError) {
        throw finalError2;
      }
      return opts.responseStyle === "data" ? undefined : {
        error: finalError2,
        request: request2,
        response: undefined
      };
    }
    for (const fn of interceptors.response.fns) {
      if (fn) {
        response = await fn(response, request2, opts);
      }
    }
    const result = {
      request: request2,
      response
    };
    if (response.ok) {
      const parseAs = (opts.parseAs === "auto" ? getParseAs4(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        let emptyData;
        switch (parseAs) {
          case "arrayBuffer":
          case "blob":
          case "text":
            emptyData = await response[parseAs]();
            break;
          case "formData":
            emptyData = new FormData;
            break;
          case "stream":
            emptyData = response.body;
            break;
          case "json":
          default:
            emptyData = {};
            break;
        }
        return opts.responseStyle === "data" ? emptyData : {
          data: emptyData,
          ...result
        };
      }
      let data;
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "text":
          data = await response[parseAs]();
          break;
        case "json": {
          const text = await response.text();
          data = text ? JSON.parse(text) : {};
          break;
        }
        case "stream":
          return opts.responseStyle === "data" ? response.body : {
            data: response.body,
            ...result
          };
      }
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }
        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }
      return opts.responseStyle === "data" ? data : {
        data,
        ...result
      };
    }
    const textError = await response.text();
    let jsonError;
    try {
      jsonError = JSON.parse(textError);
    } catch {}
    const error = jsonError ?? textError;
    let finalError = error;
    for (const fn of interceptors.error.fns) {
      if (fn) {
        finalError = await fn(error, response, request2, opts);
      }
    }
    finalError = finalError || {};
    if (opts.throwOnError) {
      throw finalError;
    }
    return opts.responseStyle === "data" ? undefined : {
      error: finalError,
      ...result
    };
  };
  const makeMethodFn = (method) => (options) => request({ ...options, method });
  const makeSseFn = (method) => async (options) => {
    const { opts, url } = await beforeRequest(options);
    return createSseClient4({
      ...opts,
      body: opts.body,
      headers: opts.headers,
      method,
      onRequest: async (url2, init) => {
        let request2 = new Request(url2, init);
        for (const fn of interceptors.request.fns) {
          if (fn) {
            request2 = await fn(request2, opts);
          }
        }
        return request2;
      },
      serializedBody: getValidRequestBody4(opts),
      url
    });
  };
  const _buildUrl = (options) => buildUrl4({ ..._config, ...options });
  return {
    buildUrl: _buildUrl,
    connect: makeMethodFn("CONNECT"),
    delete: makeMethodFn("DELETE"),
    get: makeMethodFn("GET"),
    getConfig,
    head: makeMethodFn("HEAD"),
    interceptors,
    options: makeMethodFn("OPTIONS"),
    patch: makeMethodFn("PATCH"),
    post: makeMethodFn("POST"),
    put: makeMethodFn("PUT"),
    request,
    setConfig,
    sse: {
      connect: makeSseFn("CONNECT"),
      delete: makeSseFn("DELETE"),
      get: makeSseFn("GET"),
      head: makeSseFn("HEAD"),
      options: makeSseFn("OPTIONS"),
      patch: makeSseFn("PATCH"),
      post: makeSseFn("POST"),
      put: makeSseFn("PUT"),
      trace: makeSseFn("TRACE")
    },
    trace: makeMethodFn("TRACE")
  };
};
// packages/sdk/dist/gen/client.gen.ts
var client3 = createClient4(createConfig4());

// packages/sdk/dist/gen/sdk.gen.ts
var sessionListGlobal2 = (options) => (options?.client ?? client3).get({ url: "/session/global", ...options });
var sessionList2 = (options) => (options?.client ?? client3).get({ url: "/session/list", ...options });
var sessionCreate2 = (options) => (options.client ?? client3).post({
  url: "/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAllStatus2 = (options) => (options?.client ?? client3).get({ url: "/session/status", ...options });
var sessionDelete2 = (options) => (options.client ?? client3).delete({ url: "/session/{sessionID}", ...options });
var sessionGet2 = (options) => (options.client ?? client3).get({ url: "/session/{sessionID}", ...options });
var sessionUpdate2 = (options) => (options.client ?? client3).patch({
  url: "/session/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionInitialize2 = (options) => (options.client ?? client3).post({
  url: "/session/{sessionID}/initialize",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionMessages2 = (options) => (options.client ?? client3).get({ url: "/session/{sessionID}/messages", ...options });
var sessionPrompt2 = (options) => (options.client ?? client3).post({
  url: "/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionCommand2 = (options) => (options.client ?? client3).post({
  url: "/session/{sessionID}/command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAbort2 = (options) => (options.client ?? client3).post({ url: "/session/{sessionID}/abort", ...options });
var sessionFork2 = (options) => (options.client ?? client3).post({ url: "/session/{sessionID}/fork", ...options });
var sessionShare2 = (options) => (options.client ?? client3).post({ url: "/session/{sessionID}/share", ...options });
var sessionDiff2 = (options) => (options.client ?? client3).get({ url: "/session/{sessionID}/diff", ...options });
var sessionSummarize2 = (options) => (options.client ?? client3).post({ url: "/session/{sessionID}/summarize", ...options });
var sessionRevert2 = (options) => (options.client ?? client3).post({
  url: "/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionUnrevert2 = (options) => (options.client ?? client3).post({ url: "/session/{sessionID}/unrevert", ...options });
var sessionChildren2 = (options) => (options.client ?? client3).get({ url: "/session/{sessionID}/children", ...options });
var sessionTodo2 = (options) => (options.client ?? client3).get({ url: "/session/{sessionID}/todo", ...options });
var sessionClear2 = (options) => (options.client ?? client3).post({ url: "/session/{sessionID}/clear", ...options });
var agentList2 = (options) => (options?.client ?? client3).get({ url: "/agent/list", ...options });
var agentCreate2 = (options) => (options.client ?? client3).post({
  url: "/agent/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var agentGet2 = (options) => (options.client ?? client3).get({ url: "/agent/{agentID}", ...options });
var agentUpdate2 = (options) => (options.client ?? client3).patch({
  url: "/agent/{agentID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var commandList2 = (options) => (options?.client ?? client3).get({ url: "/command/list", ...options });
var providerList2 = (options) => (options?.client ?? client3).get({ url: "/provider", ...options });
var providerAuth2 = (options) => (options?.client ?? client3).get({ url: "/provider/auth", ...options });
var providerOauthAuthorize2 = (options) => (options.client ?? client3).post({ url: "/provider/{providerID}/oauth/authorize", ...options });
var providerOauthVerify2 = (options) => (options.client ?? client3).post({
  url: "/provider/{providerID}/oauth/verify",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configGet2 = (options) => (options?.client ?? client3).get({ url: "/config", ...options });
var configUpdate2 = (options) => (options.client ?? client3).patch({
  url: "/config",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configProviders2 = (options) => (options?.client ?? client3).get({ url: "/config/providers", ...options });
var mcpStatus2 = (options) => (options?.client ?? client3).get({ url: "/mcp", ...options });
var mcpList2 = (options) => (options?.client ?? client3).get({ url: "/mcp/list", ...options });
var mcpAdd2 = (options) => (options.client ?? client3).post({
  url: "/mcp/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var mcpResources2 = (options) => (options?.client ?? client3).get({ url: "/mcp/resources", ...options });
var mcpRemove2 = (options) => (options.client ?? client3).delete({ url: "/mcp/{name}", ...options });
var cronStatus2 = (options) => (options?.client ?? client3).get({ url: "/cron/status", ...options });
var cronList2 = (options) => (options?.client ?? client3).get({ url: "/cron/jobs", ...options });
var cronCreate2 = (options) => (options.client ?? client3).post({
  url: "/cron/jobs",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronDelete2 = (options) => (options.client ?? client3).delete({ url: "/cron/jobs/{id}", ...options });
var cronGet2 = (options) => (options.client ?? client3).get({ url: "/cron/jobs/{id}", ...options });
var cronUpdate2 = (options) => (options.client ?? client3).put({
  url: "/cron/jobs/{id}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronPause2 = (options) => (options.client ?? client3).post({ url: "/cron/jobs/{id}/pause", ...options });
var cronResume2 = (options) => (options.client ?? client3).post({ url: "/cron/jobs/{id}/resume", ...options });
var cronRun2 = (options) => (options.client ?? client3).post({ url: "/cron/jobs/{id}/run", ...options });
var cronRuns2 = (options) => (options.client ?? client3).get({ url: "/cron/jobs/{id}/runs", ...options });
var cronAllRuns2 = (options) => (options?.client ?? client3).get({ url: "/cron/runs", ...options });
var cronGetRun2 = (options) => (options.client ?? client3).get({ url: "/cron/runs/{id}", ...options });
var cronWake2 = (options) => (options?.client ?? client3).post({ url: "/cron/wake", ...options });
var cronCleanupSession2 = (options) => (options.client ?? client3).delete({ url: "/cron/session/{sessionId}", ...options });
var permissionReply2 = (options) => (options.client ?? client3).post({
  url: "/permission/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var permissionList2 = (options) => (options?.client ?? client3).get({ url: "/permission", ...options });
var questionList2 = (options) => (options?.client ?? client3).get({ url: "/question", ...options });
var questionReply2 = (options) => (options.client ?? client3).post({
  url: "/question/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var questionReject2 = (options) => (options.client ?? client3).post({ url: "/question/{requestID}/reject", ...options });
var fileSearch2 = (options) => (options?.client ?? client3).get({ url: "/file/search", ...options });
var fileGlob2 = (options) => (options?.client ?? client3).get({ url: "/file/glob", ...options });
var fileSymbols2 = (options) => (options?.client ?? client3).get({ url: "/file/symbols", ...options });
var fileTree2 = (options) => (options?.client ?? client3).get({ url: "/file/tree", ...options });
var fileRead2 = (options) => (options?.client ?? client3).get({ url: "/file/read", ...options });
var fileInfo2 = (options) => (options?.client ?? client3).get({ url: "/file/info", ...options });
var assetUpload2 = (options) => (options?.client ?? client3).post({ url: "/assets/upload", ...options });
var assetList2 = (options) => (options?.client ?? client3).get({ url: "/assets", ...options });
var assetDelete2 = (options) => (options.client ?? client3).delete({ url: "/assets/{id}", ...options });
var assetGet2 = (options) => (options.client ?? client3).get({ url: "/assets/{id}", ...options });
var filesList2 = (options) => (options?.client ?? client3).get({ url: "/files", ...options });
var filesUpload2 = (options) => (options?.client ?? client3).post({ url: "/files", ...options });
var filesDelete2 = (options) => (options.client ?? client3).delete({ url: "/files/{id}", ...options });
var filesGet2 = (options) => (options.client ?? client3).get({ url: "/files/{id}", ...options });
var userGet2 = (options) => (options?.client ?? client3).get({ url: "/user", ...options });
var userRefresh2 = (options) => (options?.client ?? client3).post({ url: "/user/refresh", ...options });
var userOnboard2 = (options) => (options.client ?? client3).post({
  url: "/user/onboard",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var userClear2 = (options) => (options?.client ?? client3).post({ url: "/user/clear", ...options });
var ptyList2 = (options) => (options?.client ?? client3).get({ url: "/pty/list", ...options });
var ptyCreate2 = (options) => (options.client ?? client3).post({
  url: "/pty/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var ptyKill2 = (options) => (options.client ?? client3).delete({ url: "/pty/{ptyID}", ...options });
var ptyGet2 = (options) => (options.client ?? client3).get({ url: "/pty/{ptyID}", ...options });
var instanceSync2 = (options) => (options?.client ?? client3).get({ url: "/instance/sync", ...options });
var instanceDispose2 = (options) => (options?.client ?? client3).post({ url: "/instance/dispose", ...options });
var instanceWorkspace2 = (options) => (options?.client ?? client3).get({ url: "/instance/workspace", ...options });
var instanceVersion2 = (options) => (options?.client ?? client3).get({ url: "/instance/version", ...options });
var instanceHealth2 = (options) => (options?.client ?? client3).get({ url: "/instance/health", ...options });
var tuiAppendPrompt2 = (options) => (options.client ?? client3).post({
  url: "/instance/tui/append-prompt",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiOpenHelp2 = (options) => (options?.client ?? client3).post({ url: "/instance/tui/open-help", ...options });
var tuiOpenSessions2 = (options) => (options?.client ?? client3).post({ url: "/instance/tui/open-sessions", ...options });
var tuiOpenThemes2 = (options) => (options?.client ?? client3).post({ url: "/instance/tui/open-themes", ...options });
var tuiOpenModels2 = (options) => (options?.client ?? client3).post({ url: "/instance/tui/open-models", ...options });
var tuiSubmitPrompt2 = (options) => (options?.client ?? client3).post({ url: "/instance/tui/submit-prompt", ...options });
var tuiClearPrompt2 = (options) => (options?.client ?? client3).post({ url: "/instance/tui/clear-prompt", ...options });
var tuiExecuteCommand2 = (options) => (options.client ?? client3).post({
  url: "/instance/tui/execute-command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiShowToast2 = (options) => (options.client ?? client3).post({
  url: "/instance/tui/show-toast",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiPublish2 = (options) => (options.client ?? client3).post({
  url: "/instance/tui/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiSelectSession2 = (options) => (options.client ?? client3).post({
  url: "/instance/tui/select-session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiControlNext2 = (options) => (options?.client ?? client3).get({ url: "/instance/tui/control/next", ...options });
var tuiControlResponse2 = (options) => (options.client ?? client3).post({
  url: "/instance/tui/control/response",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var pathGet2 = (options) => (options?.client ?? client3).get({ url: "/path", ...options });
var vcsGet2 = (options) => (options?.client ?? client3).get({ url: "/vcs", ...options });
var vcsWorktreeRemove2 = (options) => (options.client ?? client3).delete({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vcsWorktreeCreate2 = (options) => (options.client ?? client3).post({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var lspStatus2 = (options) => (options?.client ?? client3).get({ url: "/lsp", ...options });
var formatterStatus2 = (options) => (options?.client ?? client3).get({ url: "/formatter", ...options });
var skillToolIds2 = (options) => (options?.client ?? client3).get({ url: "/skill/tool-ids", ...options });
var skillTools2 = (options) => (options?.client ?? client3).get({ url: "/skill/tools", ...options });
var appSkills2 = (options) => (options?.client ?? client3).get({ url: "/skill", ...options });
var skillAdd2 = (options) => (options.client ?? client3).post({
  url: "/skill/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEval2 = (options) => (options.client ?? client3).post({
  url: "/skill/{name}/eval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEvalsList2 = (options) => (options.client ?? client3).get({ url: "/skill/{name}/evals", ...options });
var skillEvalsGet2 = (options) => (options.client ?? client3).get({ url: "/skill/{name}/evals/{id}", ...options });
var skillRegistry2 = (options) => (options?.client ?? client3).get({ url: "/skill/registry", ...options });
var skillPublish2 = (options) => (options.client ?? client3).post({
  url: "/skill/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillInstall2 = (options) => (options.client ?? client3).post({
  url: "/skill/{id}/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var getV1MemorySearch2 = (options) => (options?.client ?? client3).get({ url: "/memory/search", ...options });
var putV1MemoryL2ByType2 = (options) => (options.client ?? client3).put({
  url: "/memory/l2/{type}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryL1BySessionId2 = (options) => (options.client ?? client3).put({
  url: "/memory/l1/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryByFilename2 = (options) => (options.client ?? client3).put({
  url: "/memory/{filename}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tokensCount2 = (options) => (options.client ?? client3).post({
  url: "/tokens/count",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineExecute2 = (options) => (options.client ?? client3).post({
  url: "/engine/execute",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineWatch2 = (options) => (options.client ?? client3).sse.get({ url: "/engine/watch/{runId}", ...options });
var engineReceipts2 = (options) => (options.client ?? client3).get({ url: "/engine/receipts/{runId}", ...options });
var engineSnapshot2 = (options) => (options.client ?? client3).get({ url: "/engine/snapshot/{runId}", ...options });
var engineRunGet2 = (options) => (options.client ?? client3).get({ url: "/engine/runs/{runId}", ...options });
var engineRunEvents2 = (options) => (options.client ?? client3).get({ url: "/engine/runs/{runId}/events", ...options });
var engineRunApproval2 = (options) => (options.client ?? client3).post({
  url: "/engine/runs/{runId}/approval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunCancel2 = (options) => (options.client ?? client3).post({
  url: "/engine/runs/{runId}/cancel",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunPause2 = (options) => (options.client ?? client3).post({
  url: "/engine/runs/{runId}/pause",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunResume2 = (options) => (options.client ?? client3).post({
  url: "/engine/runs/{runId}/resume",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineHealth2 = (options) => (options?.client ?? client3).get({ url: "/engine/health", ...options });
var sandboxGet2 = (options) => (options.client ?? client3).get({ url: "/sandbox/{sessionID}", ...options });
var sandboxEnable2 = (options) => (options.client ?? client3).post({
  url: "/sandbox/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxDisable2 = (options) => (options.client ?? client3).post({ url: "/sandbox/{sessionID}/disable", ...options });
var sandboxToggle2 = (options) => (options.client ?? client3).post({
  url: "/sandbox/{sessionID}/toggle",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxPolicy2 = (options) => (options.client ?? client3).patch({
  url: "/sandbox/{sessionID}/policy",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDestroy2 = (options) => (options.client ?? client3).delete({ url: "/vm-session/{sessionID}", ...options });
var vmSessionGet2 = (options) => (options.client ?? client3).get({ url: "/vm-session/{sessionID}", ...options });
var vmSessionEnable2 = (options) => (options.client ?? client3).post({
  url: "/vm-session/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDisable2 = (options) => (options.client ?? client3).post({ url: "/vm-session/{sessionID}/disable", ...options });
var vmSessionToggle2 = (options) => (options.client ?? client3).post({ url: "/vm-session/{sessionID}/toggle", ...options });
var postV1PluginInstall2 = (options) => (options.client ?? client3).post({
  url: "/plugin/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var postV1PluginRemove2 = (options) => (options.client ?? client3).post({
  url: "/plugin/remove",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var eventSubscribe2 = (options) => (options?.client ?? client3).sse.get({ url: "/event", ...options });
var arsContextaHealth2 = (options) => (options?.client ?? client3).get({ url: "/ars-contexta/health", ...options });
var arsContextaInsights2 = (options) => (options.client ?? client3).post({
  url: "/ars-contexta/insights",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEntities2 = (options) => (options.client ?? client3).post({
  url: "/ars-contexta/entities",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEnrich2 = (options) => (options.client ?? client3).post({
  url: "/ars-contexta/enrich",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaProviders2 = (options) => (options?.client ?? client3).get({ url: "/ars-contexta/providers", ...options });
var authRemove2 = (options) => (options.client ?? client3).delete({ url: "/auth/{providerID}", ...options });
var authSet2 = (options) => (options.client ?? client3).put({
  url: "/auth/{providerID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkStart2 = (options) => (options.client ?? client3).post({
  url: "/auth/terminal/clerk/start",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkPoll2 = (options) => (options.client ?? client3).get({ url: "/auth/terminal/clerk/poll/{sessionID}", ...options });
var terminalClerkClaim2 = (options) => (options.client ?? client3).post({ url: "/auth/terminal/clerk/claim/{sessionID}", ...options });
var terminalClerkCallback2 = (options) => (options.client ?? client3).post({ url: "/auth/terminal/clerk/callback/{sessionID}", ...options });
var projectListRoot2 = (options) => (options?.client ?? client3).get({ url: "/project", ...options });
var projectInit2 = (options) => (options.client ?? client3).post({
  url: "/project/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectList2 = (options) => (options?.client ?? client3).get({ url: "/project/list", ...options });
var projectSessionList2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/session", ...options });
var projectSessionCreate2 = (options) => (options.client ?? client3).post({
  url: "/project/{projectID}/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionDelete2 = (options) => (options.client ?? client3).delete({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionGet2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionInitialize2 = (options) => (options.client ?? client3).post({
  url: "/project/{projectID}/session/{sessionID}/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionAbort2 = (options) => (options.client ?? client3).post({ url: "/project/{projectID}/session/{sessionID}/abort", ...options });
var projectSessionUnshare2 = (options) => (options.client ?? client3).delete({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionShare2 = (options) => (options.client ?? client3).post({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionCompact2 = (options) => (options.client ?? client3).post({ url: "/project/{projectID}/session/{sessionID}/compact", ...options });
var projectSessionMessages2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/session/{sessionID}/message", ...options });
var projectSessionMessageCreate2 = (options) => (options.client ?? client3).post({
  url: "/project/{projectID}/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionMessageGet2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/session/{sessionID}/message/{messageID}", ...options });
var projectSessionRevert2 = (options) => (options.client ?? client3).post({
  url: "/project/{projectID}/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionUnrevert2 = (options) => (options.client ?? client3).post({ url: "/project/{projectID}/session/{sessionID}/unrevert", ...options });
var projectSessionPermissionReply2 = (options) => (options.client ?? client3).post({
  url: "/project/{projectID}/session/{sessionID}/permission/{permissionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionFileFind2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/session/{sessionID}/find/file", ...options });
var projectSessionFileStatus2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/session/{sessionID}/file/status", ...options });
var projectSessionFileRead2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/session/{sessionID}/file", ...options });
var projectAgentList2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/agent", ...options });
var projectFindFile2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}/find/file", ...options });
var projectGet2 = (options) => (options.client ?? client3).get({ url: "/project/{projectID}", ...options });
var projectUpdate2 = (options) => (options.client ?? client3).patch({
  url: "/project/{projectID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceGet2 = (options) => (options?.client ?? client3).get({ url: "/workspace", ...options });
var workspaceInit2 = (options) => (options.client ?? client3).post({
  url: "/workspace/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceImport2 = (options) => (options.client ?? client3).post({
  url: "/workspace/import",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceIdentityGet2 = (options) => (options?.client ?? client3).get({ url: "/workspace/identity", ...options });
var workspaceIdentityPut2 = (options) => (options.client ?? client3).put({
  url: "/workspace/identity",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceLayers2 = (options) => (options?.client ?? client3).get({ url: "/workspace/layers", ...options });
var workspaceMemoryGet2 = (options) => (options?.client ?? client3).get({ url: "/workspace/memory", ...options });
var workspaceMemoryPost2 = (options) => (options.client ?? client3).post({
  url: "/workspace/memory",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceActivate2 = (options) => (options.client ?? client3).post({
  url: "/workspace/activate",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceSkills2 = (options) => (options?.client ?? client3).get({ url: "/workspace/skills", ...options });
var globalHealth2 = (options) => (options?.client ?? client3).get({ url: "/global/health", ...options });
var globalEvent2 = (options) => (options?.client ?? client3).sse.get({ url: "/global/event", ...options });
var globalVersion2 = (options) => (options?.client ?? client3).get({ url: "/global/version", ...options });
// packages/sdk/dist/gen/allternit-client.js
var jsonBodySerializer5 = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};
var extraPrefixesMap5 = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes5 = Object.entries(extraPrefixesMap5);
var createSseClient5 = ({
  onRequest,
  onSseError,
  onSseEvent,
  responseTransformer,
  responseValidator,
  sseDefaultRetryDelay,
  sseMaxRetryAttempts,
  sseMaxRetryDelay,
  sseSleepFn,
  url,
  ...options
}) => {
  let lastEventId;
  const sleep = sseSleepFn ?? ((ms) => new Promise((resolve) => setTimeout(resolve, ms)));
  const createStream = async function* () {
    let retryDelay = sseDefaultRetryDelay ?? 3000;
    let attempt = 0;
    const signal = options.signal ?? new AbortController().signal;
    while (true) {
      if (signal.aborted)
        break;
      attempt++;
      const headers = options.headers instanceof Headers ? options.headers : new Headers(options.headers);
      if (lastEventId !== undefined) {
        headers.set("Last-Event-ID", lastEventId);
      }
      try {
        const requestInit = {
          redirect: "follow",
          ...options,
          body: options.serializedBody,
          headers,
          signal
        };
        let request = new Request(url, requestInit);
        if (onRequest) {
          request = await onRequest(url, requestInit);
        }
        const _fetch = options.fetch ?? globalThis.fetch;
        const response = await _fetch(request);
        if (!response.ok)
          throw new Error(`SSE failed: ${response.status} ${response.statusText}`);
        if (!response.body)
          throw new Error("No body in SSE response");
        const reader = response.body.pipeThrough(new TextDecoderStream).getReader();
        let buffer = "";
        const abortHandler = () => {
          try {
            reader.cancel();
          } catch {}
        };
        signal.addEventListener("abort", abortHandler);
        try {
          while (true) {
            const { done, value } = await reader.read();
            if (done)
              break;
            buffer += value;
            buffer = buffer.replace(/\r\n/g, `
`).replace(/\r/g, `
`);
            const chunks = buffer.split(`

`);
            buffer = chunks.pop() ?? "";
            for (const chunk of chunks) {
              const lines = chunk.split(`
`);
              const dataLines = [];
              let eventName;
              for (const line of lines) {
                if (line.startsWith("data:")) {
                  dataLines.push(line.replace(/^data:\s*/, ""));
                } else if (line.startsWith("event:")) {
                  eventName = line.replace(/^event:\s*/, "");
                } else if (line.startsWith("id:")) {
                  lastEventId = line.replace(/^id:\s*/, "");
                } else if (line.startsWith("retry:")) {
                  const parsed = Number.parseInt(line.replace(/^retry:\s*/, ""), 10);
                  if (!Number.isNaN(parsed)) {
                    retryDelay = parsed;
                  }
                }
              }
              let data;
              let parsedJson = false;
              if (dataLines.length) {
                const rawData = dataLines.join(`
`);
                try {
                  data = JSON.parse(rawData);
                  parsedJson = true;
                } catch {
                  data = rawData;
                }
              }
              if (parsedJson) {
                if (responseValidator) {
                  await responseValidator(data);
                }
                if (responseTransformer) {
                  data = await responseTransformer(data);
                }
              }
              onSseEvent?.({
                data,
                event: eventName,
                id: lastEventId,
                retry: retryDelay
              });
              if (dataLines.length) {
                yield data;
              }
            }
          }
        } finally {
          signal.removeEventListener("abort", abortHandler);
          reader.releaseLock();
        }
        break;
      } catch (error) {
        onSseError?.(error);
        if (sseMaxRetryAttempts !== undefined && attempt >= sseMaxRetryAttempts) {
          break;
        }
        const backoff = Math.min(retryDelay * 2 ** (attempt - 1), sseMaxRetryDelay ?? 30000);
        await sleep(backoff);
      }
    }
  };
  const stream = createStream();
  return { stream };
};
var separatorArrayExplode5 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var separatorArrayNoExplode5 = (style) => {
  switch (style) {
    case "form":
      return ",";
    case "pipeDelimited":
      return "|";
    case "spaceDelimited":
      return "%20";
    default:
      return ",";
  }
};
var separatorObjectExplode5 = (style) => {
  switch (style) {
    case "label":
      return ".";
    case "matrix":
      return ";";
    case "simple":
      return ",";
    default:
      return "&";
  }
};
var serializeArrayParam5 = ({
  allowReserved,
  explode,
  name,
  style,
  value
}) => {
  if (!explode) {
    const joinedValues2 = (allowReserved ? value : value.map((v) => encodeURIComponent(v))).join(separatorArrayNoExplode5(style));
    switch (style) {
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      case "simple":
        return joinedValues2;
      default:
        return `${name}=${joinedValues2}`;
    }
  }
  const separator = separatorArrayExplode5(style);
  const joinedValues = value.map((v) => {
    if (style === "label" || style === "simple") {
      return allowReserved ? v : encodeURIComponent(v);
    }
    return serializePrimitiveParam5({
      allowReserved,
      name,
      value: v
    });
  }).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var serializePrimitiveParam5 = ({
  allowReserved,
  name,
  value
}) => {
  if (value === undefined || value === null) {
    return "";
  }
  if (typeof value === "object") {
    throw new Error("Deeply-nested arrays/objects aren\u2019t supported. Provide your own `querySerializer()` to handle these.");
  }
  return `${name}=${allowReserved ? value : encodeURIComponent(value)}`;
};
var serializeObjectParam5 = ({
  allowReserved,
  explode,
  name,
  style,
  value,
  valueOnly
}) => {
  if (value instanceof Date) {
    return valueOnly ? value.toISOString() : `${name}=${value.toISOString()}`;
  }
  if (style !== "deepObject" && !explode) {
    let values = [];
    Object.entries(value).forEach(([key, v]) => {
      values = [...values, key, allowReserved ? v : encodeURIComponent(v)];
    });
    const joinedValues2 = values.join(",");
    switch (style) {
      case "form":
        return `${name}=${joinedValues2}`;
      case "label":
        return `.${joinedValues2}`;
      case "matrix":
        return `;${name}=${joinedValues2}`;
      default:
        return joinedValues2;
    }
  }
  const separator = separatorObjectExplode5(style);
  const joinedValues = Object.entries(value).map(([key, v]) => serializePrimitiveParam5({
    allowReserved,
    name: style === "deepObject" ? `${name}[${key}]` : key,
    value: v
  })).join(separator);
  return style === "label" || style === "matrix" ? separator + joinedValues : joinedValues;
};
var PATH_PARAM_RE5 = /\{[^{}]+\}/g;
var defaultPathSerializer5 = ({ path, url: _url }) => {
  let url = _url;
  const matches = _url.match(PATH_PARAM_RE5);
  if (matches) {
    for (const match of matches) {
      let explode = false;
      let name = match.substring(1, match.length - 1);
      let style = "simple";
      if (name.endsWith("*")) {
        explode = true;
        name = name.substring(0, name.length - 1);
      }
      if (name.startsWith(".")) {
        name = name.substring(1);
        style = "label";
      } else if (name.startsWith(";")) {
        name = name.substring(1);
        style = "matrix";
      }
      const value = path[name];
      if (value === undefined || value === null) {
        continue;
      }
      if (Array.isArray(value)) {
        url = url.replace(match, serializeArrayParam5({ explode, name, style, value }));
        continue;
      }
      if (typeof value === "object") {
        url = url.replace(match, serializeObjectParam5({
          explode,
          name,
          style,
          value,
          valueOnly: true
        }));
        continue;
      }
      if (style === "matrix") {
        url = url.replace(match, `;${serializePrimitiveParam5({
          name,
          value
        })}`);
        continue;
      }
      const replaceValue = encodeURIComponent(style === "label" ? `.${value}` : value);
      url = url.replace(match, replaceValue);
    }
  }
  return url;
};
var getUrl5 = ({
  baseUrl,
  path,
  query,
  querySerializer,
  url: _url
}) => {
  const pathUrl = _url.startsWith("/") ? _url : `/${_url}`;
  let url = (baseUrl ?? "") + pathUrl;
  if (path) {
    url = defaultPathSerializer5({ path, url });
  }
  let search = query ? querySerializer(query) : "";
  if (search.startsWith("?")) {
    search = search.substring(1);
  }
  if (search) {
    url += `?${search}`;
  }
  return url;
};
function getValidRequestBody5(options) {
  const hasBody = options.body !== undefined;
  const isSerializedBody = hasBody && options.bodySerializer;
  if (isSerializedBody) {
    if ("serializedBody" in options) {
      const hasSerializedBody = options.serializedBody !== undefined && options.serializedBody !== "";
      return hasSerializedBody ? options.serializedBody : null;
    }
    return options.body !== "" ? options.body : null;
  }
  if (hasBody) {
    return options.body;
  }
  return;
}
var getAuthToken5 = async (auth, callback) => {
  const token = typeof callback === "function" ? await callback(auth) : callback;
  if (!token) {
    return;
  }
  if (auth.scheme === "bearer") {
    return `Bearer ${token}`;
  }
  if (auth.scheme === "basic") {
    return `Basic ${btoa(token)}`;
  }
  return token;
};
var createQuerySerializer5 = ({
  parameters = {},
  ...args
} = {}) => {
  const querySerializer = (queryParams) => {
    const search = [];
    if (queryParams && typeof queryParams === "object") {
      for (const name in queryParams) {
        const value = queryParams[name];
        if (value === undefined || value === null) {
          continue;
        }
        const options = parameters[name] || args;
        if (Array.isArray(value)) {
          const serializedArray = serializeArrayParam5({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "form",
            value,
            ...options.array
          });
          if (serializedArray)
            search.push(serializedArray);
        } else if (typeof value === "object") {
          const serializedObject = serializeObjectParam5({
            allowReserved: options.allowReserved,
            explode: true,
            name,
            style: "deepObject",
            value,
            ...options.object
          });
          if (serializedObject)
            search.push(serializedObject);
        } else {
          const serializedPrimitive = serializePrimitiveParam5({
            allowReserved: options.allowReserved,
            name,
            value
          });
          if (serializedPrimitive)
            search.push(serializedPrimitive);
        }
      }
    }
    return search.join("&");
  };
  return querySerializer;
};
var getParseAs5 = (contentType) => {
  if (!contentType) {
    return "stream";
  }
  const cleanContent = contentType.split(";")[0]?.trim();
  if (!cleanContent) {
    return;
  }
  if (cleanContent.startsWith("application/json") || cleanContent.endsWith("+json")) {
    return "json";
  }
  if (cleanContent === "multipart/form-data") {
    return "formData";
  }
  if (["application/", "audio/", "image/", "video/"].some((type) => cleanContent.startsWith(type))) {
    return "blob";
  }
  if (cleanContent.startsWith("text/")) {
    return "text";
  }
  return;
};
var checkForExistence5 = (options, name) => {
  if (!name) {
    return false;
  }
  if (options.headers.has(name) || options.query?.[name] || options.headers.get("Cookie")?.includes(`${name}=`)) {
    return true;
  }
  return false;
};
var setAuthParams5 = async ({
  security,
  ...options
}) => {
  for (const auth of security) {
    if (checkForExistence5(options, auth.name)) {
      continue;
    }
    const token = await getAuthToken5(auth, options.auth);
    if (!token) {
      continue;
    }
    const name = auth.name ?? "Authorization";
    switch (auth.in) {
      case "query":
        if (!options.query) {
          options.query = {};
        }
        options.query[name] = token;
        break;
      case "cookie":
        options.headers.append("Cookie", `${name}=${token}`);
        break;
      case "header":
      default:
        options.headers.set(name, token);
        break;
    }
  }
};
var buildUrl5 = (options) => getUrl5({
  baseUrl: options.baseUrl,
  path: options.path,
  query: options.query,
  querySerializer: typeof options.querySerializer === "function" ? options.querySerializer : createQuerySerializer5(options.querySerializer),
  url: options.url
});
var mergeConfigs5 = (a, b) => {
  const config = { ...a, ...b };
  if (config.baseUrl?.endsWith("/")) {
    config.baseUrl = config.baseUrl.substring(0, config.baseUrl.length - 1);
  }
  config.headers = mergeHeaders5(a.headers, b.headers);
  return config;
};
var headersEntries5 = (headers) => {
  const entries = [];
  headers.forEach((value, key) => {
    entries.push([key, value]);
  });
  return entries;
};
var mergeHeaders5 = (...headers) => {
  const mergedHeaders = new Headers;
  for (const header of headers) {
    if (!header) {
      continue;
    }
    const iterator = header instanceof Headers ? headersEntries5(header) : Object.entries(header);
    for (const [key, value] of iterator) {
      if (value === null) {
        mergedHeaders.delete(key);
      } else if (Array.isArray(value)) {
        for (const v of value) {
          mergedHeaders.append(key, v);
        }
      } else if (value !== undefined) {
        mergedHeaders.set(key, typeof value === "object" ? JSON.stringify(value) : value);
      }
    }
  }
  return mergedHeaders;
};

class Interceptors5 {
  fns = [];
  clear() {
    this.fns = [];
  }
  eject(id) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = null;
    }
  }
  exists(id) {
    const index = this.getInterceptorIndex(id);
    return Boolean(this.fns[index]);
  }
  getInterceptorIndex(id) {
    if (typeof id === "number") {
      return this.fns[id] ? id : -1;
    }
    return this.fns.indexOf(id);
  }
  update(id, fn) {
    const index = this.getInterceptorIndex(id);
    if (this.fns[index]) {
      this.fns[index] = fn;
      return id;
    }
    return false;
  }
  use(fn) {
    this.fns.push(fn);
    return this.fns.length - 1;
  }
}
var createInterceptors5 = () => ({
  error: new Interceptors5,
  request: new Interceptors5,
  response: new Interceptors5
});
var defaultQuerySerializer5 = createQuerySerializer5({
  allowReserved: false,
  array: {
    explode: true,
    style: "form"
  },
  object: {
    explode: true,
    style: "deepObject"
  }
});
var defaultHeaders5 = {
  "Content-Type": "application/json"
};
var createConfig5 = (override = {}) => ({
  ...jsonBodySerializer5,
  headers: defaultHeaders5,
  parseAs: "auto",
  querySerializer: defaultQuerySerializer5,
  ...override
});
var createClient5 = (config = {}) => {
  let _config = mergeConfigs5(createConfig5(), config);
  const getConfig = () => ({ ..._config });
  const setConfig = (config2) => {
    _config = mergeConfigs5(_config, config2);
    return getConfig();
  };
  const interceptors = createInterceptors5();
  const beforeRequest = async (options) => {
    const opts = {
      ..._config,
      ...options,
      fetch: options.fetch ?? _config.fetch ?? globalThis.fetch,
      headers: mergeHeaders5(_config.headers, options.headers),
      serializedBody: undefined
    };
    if (opts.security) {
      await setAuthParams5({
        ...opts,
        security: opts.security
      });
    }
    if (opts.requestValidator) {
      await opts.requestValidator(opts);
    }
    if (opts.body !== undefined && opts.bodySerializer) {
      opts.serializedBody = opts.bodySerializer(opts.body);
    }
    if (opts.body === undefined || opts.serializedBody === "") {
      opts.headers.delete("Content-Type");
    }
    const url = buildUrl5(opts);
    return { opts, url };
  };
  const request = async (options) => {
    const { opts, url } = await beforeRequest(options);
    const requestInit = {
      redirect: "follow",
      ...opts,
      body: getValidRequestBody5(opts)
    };
    let request2 = new Request(url, requestInit);
    for (const fn of interceptors.request.fns) {
      if (fn) {
        request2 = await fn(request2, opts);
      }
    }
    const _fetch = opts.fetch;
    let response;
    try {
      response = await _fetch(request2);
    } catch (error2) {
      let finalError2 = error2;
      for (const fn of interceptors.error.fns) {
        if (fn) {
          finalError2 = await fn(error2, undefined, request2, opts);
        }
      }
      finalError2 = finalError2 || {};
      if (opts.throwOnError) {
        throw finalError2;
      }
      return opts.responseStyle === "data" ? undefined : {
        error: finalError2,
        request: request2,
        response: undefined
      };
    }
    for (const fn of interceptors.response.fns) {
      if (fn) {
        response = await fn(response, request2, opts);
      }
    }
    const result = {
      request: request2,
      response
    };
    if (response.ok) {
      const parseAs = (opts.parseAs === "auto" ? getParseAs5(response.headers.get("Content-Type")) : opts.parseAs) ?? "json";
      if (response.status === 204 || response.headers.get("Content-Length") === "0") {
        let emptyData;
        switch (parseAs) {
          case "arrayBuffer":
          case "blob":
          case "text":
            emptyData = await response[parseAs]();
            break;
          case "formData":
            emptyData = new FormData;
            break;
          case "stream":
            emptyData = response.body;
            break;
          case "json":
          default:
            emptyData = {};
            break;
        }
        return opts.responseStyle === "data" ? emptyData : {
          data: emptyData,
          ...result
        };
      }
      let data;
      switch (parseAs) {
        case "arrayBuffer":
        case "blob":
        case "formData":
        case "text":
          data = await response[parseAs]();
          break;
        case "json": {
          const text = await response.text();
          data = text ? JSON.parse(text) : {};
          break;
        }
        case "stream":
          return opts.responseStyle === "data" ? response.body : {
            data: response.body,
            ...result
          };
      }
      if (parseAs === "json") {
        if (opts.responseValidator) {
          await opts.responseValidator(data);
        }
        if (opts.responseTransformer) {
          data = await opts.responseTransformer(data);
        }
      }
      return opts.responseStyle === "data" ? data : {
        data,
        ...result
      };
    }
    const textError = await response.text();
    let jsonError;
    try {
      jsonError = JSON.parse(textError);
    } catch {}
    const error = jsonError ?? textError;
    let finalError = error;
    for (const fn of interceptors.error.fns) {
      if (fn) {
        finalError = await fn(error, response, request2, opts);
      }
    }
    finalError = finalError || {};
    if (opts.throwOnError) {
      throw finalError;
    }
    return opts.responseStyle === "data" ? undefined : {
      error: finalError,
      ...result
    };
  };
  const makeMethodFn = (method) => (options) => request({ ...options, method });
  const makeSseFn = (method) => async (options) => {
    const { opts, url } = await beforeRequest(options);
    return createSseClient5({
      ...opts,
      body: opts.body,
      headers: opts.headers,
      method,
      onRequest: async (url2, init) => {
        let request2 = new Request(url2, init);
        for (const fn of interceptors.request.fns) {
          if (fn) {
            request2 = await fn(request2, opts);
          }
        }
        return request2;
      },
      serializedBody: getValidRequestBody5(opts),
      url
    });
  };
  const _buildUrl = (options) => buildUrl5({ ..._config, ...options });
  return {
    buildUrl: _buildUrl,
    connect: makeMethodFn("CONNECT"),
    delete: makeMethodFn("DELETE"),
    get: makeMethodFn("GET"),
    getConfig,
    head: makeMethodFn("HEAD"),
    interceptors,
    options: makeMethodFn("OPTIONS"),
    patch: makeMethodFn("PATCH"),
    post: makeMethodFn("POST"),
    put: makeMethodFn("PUT"),
    request,
    setConfig,
    sse: {
      connect: makeSseFn("CONNECT"),
      delete: makeSseFn("DELETE"),
      get: makeSseFn("GET"),
      head: makeSseFn("HEAD"),
      options: makeSseFn("OPTIONS"),
      patch: makeSseFn("PATCH"),
      post: makeSseFn("POST"),
      put: makeSseFn("PUT"),
      trace: makeSseFn("TRACE")
    },
    trace: makeMethodFn("TRACE")
  };
};
var client4 = createClient5(createConfig5());
var sessionListGlobal3 = (options) => (options?.client ?? client4).get({ url: "/session/global", ...options });
var sessionList3 = (options) => (options?.client ?? client4).get({ url: "/session/list", ...options });
var sessionCreate3 = (options) => (options.client ?? client4).post({
  url: "/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAllStatus3 = (options) => (options?.client ?? client4).get({ url: "/session/status", ...options });
var sessionDelete3 = (options) => (options.client ?? client4).delete({ url: "/session/{sessionID}", ...options });
var sessionGet3 = (options) => (options.client ?? client4).get({ url: "/session/{sessionID}", ...options });
var sessionUpdate3 = (options) => (options.client ?? client4).patch({
  url: "/session/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionInitialize3 = (options) => (options.client ?? client4).post({
  url: "/session/{sessionID}/initialize",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionMessages3 = (options) => (options.client ?? client4).get({ url: "/session/{sessionID}/messages", ...options });
var sessionPrompt3 = (options) => (options.client ?? client4).post({
  url: "/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionCommand3 = (options) => (options.client ?? client4).post({
  url: "/session/{sessionID}/command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAbort3 = (options) => (options.client ?? client4).post({ url: "/session/{sessionID}/abort", ...options });
var sessionFork3 = (options) => (options.client ?? client4).post({ url: "/session/{sessionID}/fork", ...options });
var sessionShare3 = (options) => (options.client ?? client4).post({ url: "/session/{sessionID}/share", ...options });
var sessionDiff3 = (options) => (options.client ?? client4).get({ url: "/session/{sessionID}/diff", ...options });
var sessionSummarize3 = (options) => (options.client ?? client4).post({ url: "/session/{sessionID}/summarize", ...options });
var sessionRevert3 = (options) => (options.client ?? client4).post({
  url: "/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionUnrevert3 = (options) => (options.client ?? client4).post({ url: "/session/{sessionID}/unrevert", ...options });
var sessionChildren3 = (options) => (options.client ?? client4).get({ url: "/session/{sessionID}/children", ...options });
var sessionTodo3 = (options) => (options.client ?? client4).get({ url: "/session/{sessionID}/todo", ...options });
var sessionClear3 = (options) => (options.client ?? client4).post({ url: "/session/{sessionID}/clear", ...options });
var agentList3 = (options) => (options?.client ?? client4).get({ url: "/agent/list", ...options });
var agentCreate3 = (options) => (options.client ?? client4).post({
  url: "/agent/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var agentGet3 = (options) => (options.client ?? client4).get({ url: "/agent/{agentID}", ...options });
var agentUpdate3 = (options) => (options.client ?? client4).patch({
  url: "/agent/{agentID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var commandList3 = (options) => (options?.client ?? client4).get({ url: "/command/list", ...options });
var providerList3 = (options) => (options?.client ?? client4).get({ url: "/provider", ...options });
var providerAuth3 = (options) => (options?.client ?? client4).get({ url: "/provider/auth", ...options });
var providerOauthAuthorize3 = (options) => (options.client ?? client4).post({ url: "/provider/{providerID}/oauth/authorize", ...options });
var providerOauthVerify3 = (options) => (options.client ?? client4).post({
  url: "/provider/{providerID}/oauth/verify",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configGet3 = (options) => (options?.client ?? client4).get({ url: "/config", ...options });
var configUpdate3 = (options) => (options.client ?? client4).patch({
  url: "/config",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configProviders3 = (options) => (options?.client ?? client4).get({ url: "/config/providers", ...options });
var mcpStatus3 = (options) => (options?.client ?? client4).get({ url: "/mcp", ...options });
var mcpList3 = (options) => (options?.client ?? client4).get({ url: "/mcp/list", ...options });
var mcpAdd3 = (options) => (options.client ?? client4).post({
  url: "/mcp/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var mcpResources3 = (options) => (options?.client ?? client4).get({ url: "/mcp/resources", ...options });
var mcpRemove3 = (options) => (options.client ?? client4).delete({ url: "/mcp/{name}", ...options });
var cronStatus3 = (options) => (options?.client ?? client4).get({ url: "/cron/status", ...options });
var cronList3 = (options) => (options?.client ?? client4).get({ url: "/cron/jobs", ...options });
var cronCreate3 = (options) => (options.client ?? client4).post({
  url: "/cron/jobs",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronDelete3 = (options) => (options.client ?? client4).delete({ url: "/cron/jobs/{id}", ...options });
var cronGet3 = (options) => (options.client ?? client4).get({ url: "/cron/jobs/{id}", ...options });
var cronUpdate3 = (options) => (options.client ?? client4).put({
  url: "/cron/jobs/{id}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronPause3 = (options) => (options.client ?? client4).post({ url: "/cron/jobs/{id}/pause", ...options });
var cronResume3 = (options) => (options.client ?? client4).post({ url: "/cron/jobs/{id}/resume", ...options });
var cronRun3 = (options) => (options.client ?? client4).post({ url: "/cron/jobs/{id}/run", ...options });
var cronRuns3 = (options) => (options.client ?? client4).get({ url: "/cron/jobs/{id}/runs", ...options });
var cronAllRuns3 = (options) => (options?.client ?? client4).get({ url: "/cron/runs", ...options });
var cronGetRun3 = (options) => (options.client ?? client4).get({ url: "/cron/runs/{id}", ...options });
var cronWake3 = (options) => (options?.client ?? client4).post({ url: "/cron/wake", ...options });
var cronCleanupSession3 = (options) => (options.client ?? client4).delete({ url: "/cron/session/{sessionId}", ...options });
var permissionReply3 = (options) => (options.client ?? client4).post({
  url: "/permission/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var permissionList3 = (options) => (options?.client ?? client4).get({ url: "/permission", ...options });
var questionList3 = (options) => (options?.client ?? client4).get({ url: "/question", ...options });
var questionReply3 = (options) => (options.client ?? client4).post({
  url: "/question/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var questionReject3 = (options) => (options.client ?? client4).post({ url: "/question/{requestID}/reject", ...options });
var fileSearch3 = (options) => (options?.client ?? client4).get({ url: "/file/search", ...options });
var fileGlob3 = (options) => (options?.client ?? client4).get({ url: "/file/glob", ...options });
var fileSymbols3 = (options) => (options?.client ?? client4).get({ url: "/file/symbols", ...options });
var fileTree3 = (options) => (options?.client ?? client4).get({ url: "/file/tree", ...options });
var fileRead3 = (options) => (options?.client ?? client4).get({ url: "/file/read", ...options });
var fileInfo3 = (options) => (options?.client ?? client4).get({ url: "/file/info", ...options });
var assetUpload3 = (options) => (options?.client ?? client4).post({ url: "/assets/upload", ...options });
var assetList3 = (options) => (options?.client ?? client4).get({ url: "/assets", ...options });
var assetDelete3 = (options) => (options.client ?? client4).delete({ url: "/assets/{id}", ...options });
var assetGet3 = (options) => (options.client ?? client4).get({ url: "/assets/{id}", ...options });
var filesList3 = (options) => (options?.client ?? client4).get({ url: "/files", ...options });
var filesUpload3 = (options) => (options?.client ?? client4).post({ url: "/files", ...options });
var filesDelete3 = (options) => (options.client ?? client4).delete({ url: "/files/{id}", ...options });
var filesGet3 = (options) => (options.client ?? client4).get({ url: "/files/{id}", ...options });
var userGet3 = (options) => (options?.client ?? client4).get({ url: "/user", ...options });
var userRefresh3 = (options) => (options?.client ?? client4).post({ url: "/user/refresh", ...options });
var userOnboard3 = (options) => (options.client ?? client4).post({
  url: "/user/onboard",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var userClear3 = (options) => (options?.client ?? client4).post({ url: "/user/clear", ...options });
var ptyList3 = (options) => (options?.client ?? client4).get({ url: "/pty/list", ...options });
var ptyCreate3 = (options) => (options.client ?? client4).post({
  url: "/pty/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var ptyKill3 = (options) => (options.client ?? client4).delete({ url: "/pty/{ptyID}", ...options });
var ptyGet3 = (options) => (options.client ?? client4).get({ url: "/pty/{ptyID}", ...options });
var instanceSync3 = (options) => (options?.client ?? client4).get({ url: "/instance/sync", ...options });
var instanceDispose3 = (options) => (options?.client ?? client4).post({ url: "/instance/dispose", ...options });
var instanceWorkspace3 = (options) => (options?.client ?? client4).get({ url: "/instance/workspace", ...options });
var instanceVersion3 = (options) => (options?.client ?? client4).get({ url: "/instance/version", ...options });
var instanceHealth3 = (options) => (options?.client ?? client4).get({ url: "/instance/health", ...options });
var tuiAppendPrompt3 = (options) => (options.client ?? client4).post({
  url: "/instance/tui/append-prompt",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiOpenHelp3 = (options) => (options?.client ?? client4).post({ url: "/instance/tui/open-help", ...options });
var tuiOpenSessions3 = (options) => (options?.client ?? client4).post({ url: "/instance/tui/open-sessions", ...options });
var tuiOpenThemes3 = (options) => (options?.client ?? client4).post({ url: "/instance/tui/open-themes", ...options });
var tuiOpenModels3 = (options) => (options?.client ?? client4).post({ url: "/instance/tui/open-models", ...options });
var tuiSubmitPrompt3 = (options) => (options?.client ?? client4).post({ url: "/instance/tui/submit-prompt", ...options });
var tuiClearPrompt3 = (options) => (options?.client ?? client4).post({ url: "/instance/tui/clear-prompt", ...options });
var tuiExecuteCommand3 = (options) => (options.client ?? client4).post({
  url: "/instance/tui/execute-command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiShowToast3 = (options) => (options.client ?? client4).post({
  url: "/instance/tui/show-toast",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiPublish3 = (options) => (options.client ?? client4).post({
  url: "/instance/tui/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiSelectSession3 = (options) => (options.client ?? client4).post({
  url: "/instance/tui/select-session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiControlNext3 = (options) => (options?.client ?? client4).get({ url: "/instance/tui/control/next", ...options });
var tuiControlResponse3 = (options) => (options.client ?? client4).post({
  url: "/instance/tui/control/response",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var pathGet3 = (options) => (options?.client ?? client4).get({ url: "/path", ...options });
var vcsGet3 = (options) => (options?.client ?? client4).get({ url: "/vcs", ...options });
var vcsWorktreeRemove3 = (options) => (options.client ?? client4).delete({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vcsWorktreeCreate3 = (options) => (options.client ?? client4).post({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var lspStatus3 = (options) => (options?.client ?? client4).get({ url: "/lsp", ...options });
var formatterStatus3 = (options) => (options?.client ?? client4).get({ url: "/formatter", ...options });
var skillToolIds3 = (options) => (options?.client ?? client4).get({ url: "/skill/tool-ids", ...options });
var skillTools3 = (options) => (options?.client ?? client4).get({ url: "/skill/tools", ...options });
var appSkills3 = (options) => (options?.client ?? client4).get({ url: "/skill", ...options });
var skillAdd3 = (options) => (options.client ?? client4).post({
  url: "/skill/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEval3 = (options) => (options.client ?? client4).post({
  url: "/skill/{name}/eval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEvalsList3 = (options) => (options.client ?? client4).get({ url: "/skill/{name}/evals", ...options });
var skillEvalsGet3 = (options) => (options.client ?? client4).get({ url: "/skill/{name}/evals/{id}", ...options });
var skillRegistry3 = (options) => (options?.client ?? client4).get({ url: "/skill/registry", ...options });
var skillPublish3 = (options) => (options.client ?? client4).post({
  url: "/skill/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillInstall3 = (options) => (options.client ?? client4).post({
  url: "/skill/{id}/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var getV1MemorySearch3 = (options) => (options?.client ?? client4).get({ url: "/memory/search", ...options });
var putV1MemoryL2ByType3 = (options) => (options.client ?? client4).put({
  url: "/memory/l2/{type}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryL1BySessionId3 = (options) => (options.client ?? client4).put({
  url: "/memory/l1/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryByFilename3 = (options) => (options.client ?? client4).put({
  url: "/memory/{filename}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tokensCount3 = (options) => (options.client ?? client4).post({
  url: "/tokens/count",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineExecute3 = (options) => (options.client ?? client4).post({
  url: "/engine/execute",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineWatch3 = (options) => (options.client ?? client4).sse.get({ url: "/engine/watch/{runId}", ...options });
var engineReceipts3 = (options) => (options.client ?? client4).get({ url: "/engine/receipts/{runId}", ...options });
var engineSnapshot3 = (options) => (options.client ?? client4).get({ url: "/engine/snapshot/{runId}", ...options });
var engineRunGet3 = (options) => (options.client ?? client4).get({ url: "/engine/runs/{runId}", ...options });
var engineRunEvents3 = (options) => (options.client ?? client4).get({ url: "/engine/runs/{runId}/events", ...options });
var engineRunApproval3 = (options) => (options.client ?? client4).post({
  url: "/engine/runs/{runId}/approval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunCancel3 = (options) => (options.client ?? client4).post({
  url: "/engine/runs/{runId}/cancel",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunPause3 = (options) => (options.client ?? client4).post({
  url: "/engine/runs/{runId}/pause",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunResume3 = (options) => (options.client ?? client4).post({
  url: "/engine/runs/{runId}/resume",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineHealth3 = (options) => (options?.client ?? client4).get({ url: "/engine/health", ...options });
var sandboxGet3 = (options) => (options.client ?? client4).get({ url: "/sandbox/{sessionID}", ...options });
var sandboxEnable3 = (options) => (options.client ?? client4).post({
  url: "/sandbox/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxDisable3 = (options) => (options.client ?? client4).post({ url: "/sandbox/{sessionID}/disable", ...options });
var sandboxToggle3 = (options) => (options.client ?? client4).post({
  url: "/sandbox/{sessionID}/toggle",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxPolicy3 = (options) => (options.client ?? client4).patch({
  url: "/sandbox/{sessionID}/policy",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDestroy3 = (options) => (options.client ?? client4).delete({ url: "/vm-session/{sessionID}", ...options });
var vmSessionGet3 = (options) => (options.client ?? client4).get({ url: "/vm-session/{sessionID}", ...options });
var vmSessionEnable3 = (options) => (options.client ?? client4).post({
  url: "/vm-session/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDisable3 = (options) => (options.client ?? client4).post({ url: "/vm-session/{sessionID}/disable", ...options });
var vmSessionToggle3 = (options) => (options.client ?? client4).post({ url: "/vm-session/{sessionID}/toggle", ...options });
var postV1PluginInstall3 = (options) => (options.client ?? client4).post({
  url: "/plugin/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var postV1PluginRemove3 = (options) => (options.client ?? client4).post({
  url: "/plugin/remove",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var eventSubscribe3 = (options) => (options?.client ?? client4).sse.get({ url: "/event", ...options });
var arsContextaHealth3 = (options) => (options?.client ?? client4).get({ url: "/ars-contexta/health", ...options });
var arsContextaInsights3 = (options) => (options.client ?? client4).post({
  url: "/ars-contexta/insights",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEntities3 = (options) => (options.client ?? client4).post({
  url: "/ars-contexta/entities",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEnrich3 = (options) => (options.client ?? client4).post({
  url: "/ars-contexta/enrich",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaProviders3 = (options) => (options?.client ?? client4).get({ url: "/ars-contexta/providers", ...options });
var authRemove3 = (options) => (options.client ?? client4).delete({ url: "/auth/{providerID}", ...options });
var authSet3 = (options) => (options.client ?? client4).put({
  url: "/auth/{providerID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkStart3 = (options) => (options.client ?? client4).post({
  url: "/auth/terminal/clerk/start",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkPoll3 = (options) => (options.client ?? client4).get({ url: "/auth/terminal/clerk/poll/{sessionID}", ...options });
var terminalClerkClaim3 = (options) => (options.client ?? client4).post({ url: "/auth/terminal/clerk/claim/{sessionID}", ...options });
var terminalClerkCallback3 = (options) => (options.client ?? client4).post({ url: "/auth/terminal/clerk/callback/{sessionID}", ...options });
var projectListRoot3 = (options) => (options?.client ?? client4).get({ url: "/project", ...options });
var projectInit3 = (options) => (options.client ?? client4).post({
  url: "/project/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectList3 = (options) => (options?.client ?? client4).get({ url: "/project/list", ...options });
var projectSessionList3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/session", ...options });
var projectSessionCreate3 = (options) => (options.client ?? client4).post({
  url: "/project/{projectID}/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionDelete3 = (options) => (options.client ?? client4).delete({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionGet3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionInitialize3 = (options) => (options.client ?? client4).post({
  url: "/project/{projectID}/session/{sessionID}/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionAbort3 = (options) => (options.client ?? client4).post({ url: "/project/{projectID}/session/{sessionID}/abort", ...options });
var projectSessionUnshare3 = (options) => (options.client ?? client4).delete({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionShare3 = (options) => (options.client ?? client4).post({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionCompact3 = (options) => (options.client ?? client4).post({ url: "/project/{projectID}/session/{sessionID}/compact", ...options });
var projectSessionMessages3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/session/{sessionID}/message", ...options });
var projectSessionMessageCreate3 = (options) => (options.client ?? client4).post({
  url: "/project/{projectID}/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionMessageGet3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/session/{sessionID}/message/{messageID}", ...options });
var projectSessionRevert3 = (options) => (options.client ?? client4).post({
  url: "/project/{projectID}/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionUnrevert3 = (options) => (options.client ?? client4).post({ url: "/project/{projectID}/session/{sessionID}/unrevert", ...options });
var projectSessionPermissionReply3 = (options) => (options.client ?? client4).post({
  url: "/project/{projectID}/session/{sessionID}/permission/{permissionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionFileFind3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/session/{sessionID}/find/file", ...options });
var projectSessionFileStatus3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/session/{sessionID}/file/status", ...options });
var projectSessionFileRead3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/session/{sessionID}/file", ...options });
var projectAgentList3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/agent", ...options });
var projectFindFile3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}/find/file", ...options });
var projectGet3 = (options) => (options.client ?? client4).get({ url: "/project/{projectID}", ...options });
var projectUpdate3 = (options) => (options.client ?? client4).patch({
  url: "/project/{projectID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceGet3 = (options) => (options?.client ?? client4).get({ url: "/workspace", ...options });
var workspaceInit3 = (options) => (options.client ?? client4).post({
  url: "/workspace/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceImport3 = (options) => (options.client ?? client4).post({
  url: "/workspace/import",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceIdentityGet3 = (options) => (options?.client ?? client4).get({ url: "/workspace/identity", ...options });
var workspaceIdentityPut3 = (options) => (options.client ?? client4).put({
  url: "/workspace/identity",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceLayers3 = (options) => (options?.client ?? client4).get({ url: "/workspace/layers", ...options });
var workspaceMemoryGet3 = (options) => (options?.client ?? client4).get({ url: "/workspace/memory", ...options });
var workspaceMemoryPost3 = (options) => (options.client ?? client4).post({
  url: "/workspace/memory",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceActivate3 = (options) => (options.client ?? client4).post({
  url: "/workspace/activate",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceSkills3 = (options) => (options?.client ?? client4).get({ url: "/workspace/skills", ...options });
var globalHealth3 = (options) => (options?.client ?? client4).get({ url: "/global/health", ...options });
var globalEvent3 = (options) => (options?.client ?? client4).sse.get({ url: "/global/event", ...options });
var globalVersion3 = (options) => (options?.client ?? client4).get({ url: "/global/version", ...options });

class HeyApiClient2 {
  client;
  constructor(args) {
    this.client = args?.client ?? client4;
  }
}

class HeyApiRegistry2 {
  defaultKey = "default";
  instances = new Map;
  get(key) {
    const instance = this.instances.get(key ?? this.defaultKey);
    if (!instance) {
      throw new Error(`No SDK client found. Create one with "new AllternitClient()" to fix this error.`);
    }
    return instance;
  }
  set(value, key) {
    this.instances.set(key ?? this.defaultKey, value);
  }
}

class ArsContexta2 extends HeyApiClient2 {
  enrich(options) {
    return arsContextaEnrich3({ ...options, client: this.client });
  }
  entities(options) {
    return arsContextaEntities3({ ...options, client: this.client });
  }
  health(options) {
    return arsContextaHealth3({ ...options, client: this.client });
  }
  insights(options) {
    return arsContextaInsights3({ ...options, client: this.client });
  }
  providers(options) {
    return arsContextaProviders3({ ...options, client: this.client });
  }
}

class CronCleanup2 extends HeyApiClient2 {
  session(options) {
    return cronCleanupSession3({ ...options, client: this.client });
  }
}

class EngineRun2 extends HeyApiClient2 {
  approval(options) {
    return engineRunApproval3({ ...options, client: this.client });
  }
  cancel(options) {
    return engineRunCancel3({ ...options, client: this.client });
  }
  events(options) {
    return engineRunEvents3({ ...options, client: this.client });
  }
  get(options) {
    return engineRunGet3({ ...options, client: this.client });
  }
  pause(options) {
    return engineRunPause3({ ...options, client: this.client });
  }
  resume(options) {
    return engineRunResume3({ ...options, client: this.client });
  }
}

class ProjectAgent2 extends HeyApiClient2 {
  list(options) {
    return projectAgentList3({ ...options, client: this.client });
  }
}

class ProjectFind2 extends HeyApiClient2 {
  file(options) {
    return projectFindFile3({ ...options, client: this.client });
  }
}

class ProjectSession2 extends HeyApiClient2 {
  abort(options) {
    return projectSessionAbort3({ ...options, client: this.client });
  }
  compact(options) {
    return projectSessionCompact3({ ...options, client: this.client });
  }
  create(options) {
    return projectSessionCreate3({ ...options, client: this.client });
  }
  delete(options) {
    return projectSessionDelete3({ ...options, client: this.client });
  }
  get(options) {
    return projectSessionGet3({ ...options, client: this.client });
  }
  initialize(options) {
    return projectSessionInitialize3({ ...options, client: this.client });
  }
  list(options) {
    return projectSessionList3({ ...options, client: this.client });
  }
  messages(options) {
    return projectSessionMessages3({ ...options, client: this.client });
  }
  revert(options) {
    return projectSessionRevert3({ ...options, client: this.client });
  }
  share(options) {
    return projectSessionShare3({ ...options, client: this.client });
  }
  unrevert(options) {
    return projectSessionUnrevert3({ ...options, client: this.client });
  }
  unshare(options) {
    return projectSessionUnshare3({ ...options, client: this.client });
  }
}

class ProviderOauth2 extends HeyApiClient2 {
  authorize(options) {
    return providerOauthAuthorize3({ ...options, client: this.client });
  }
  verify(options) {
    return providerOauthVerify3({ ...options, client: this.client });
  }
  callback(options) {
    return this.verify({ ...options, client: this.client });
  }
}

class SkillEvals2 extends HeyApiClient2 {
  get(options) {
    return skillEvalsGet3({ ...options, client: this.client });
  }
  list(options) {
    return skillEvalsList3({ ...options, client: this.client });
  }
}

class SkillTool2 extends HeyApiClient2 {
  ids(options) {
    return skillToolIds3({ ...options, client: this.client });
  }
}

class TerminalClerk2 extends HeyApiClient2 {
  callback(options) {
    return terminalClerkCallback3({ ...options, client: this.client });
  }
  claim(options) {
    return terminalClerkClaim3({ ...options, client: this.client });
  }
  poll(options) {
    return terminalClerkPoll3({ ...options, client: this.client });
  }
  start(options) {
    return terminalClerkStart3({ ...options, client: this.client });
  }
}

class TuiAppend2 extends HeyApiClient2 {
  prompt(options) {
    return tuiAppendPrompt3({ ...options, client: this.client });
  }
}

class TuiClear2 extends HeyApiClient2 {
  prompt(options) {
    return tuiClearPrompt3({ ...options, client: this.client });
  }
}

class TuiControl2 extends HeyApiClient2 {
  next(options) {
    return tuiControlNext3({ ...options, client: this.client });
  }
  response(options) {
    return tuiControlResponse3({ ...options, client: this.client });
  }
}

class TuiExecute2 extends HeyApiClient2 {
  command(options) {
    return tuiExecuteCommand3({ ...options, client: this.client });
  }
}

class TuiOpen2 extends HeyApiClient2 {
  help(options) {
    return tuiOpenHelp3({ ...options, client: this.client });
  }
  models(options) {
    return tuiOpenModels3({ ...options, client: this.client });
  }
  sessions(options) {
    return tuiOpenSessions3({ ...options, client: this.client });
  }
  themes(options) {
    return tuiOpenThemes3({ ...options, client: this.client });
  }
}

class TuiSelect2 extends HeyApiClient2 {
  session(options) {
    return tuiSelectSession3({ ...options, client: this.client });
  }
}

class TuiShow2 extends HeyApiClient2 {
  toast(options) {
    return tuiShowToast3({ ...options, client: this.client });
  }
}

class TuiSubmit2 extends HeyApiClient2 {
  prompt(options) {
    return tuiSubmitPrompt3({ ...options, client: this.client });
  }
}

class VcsWorktree2 extends HeyApiClient2 {
  create(options) {
    return vcsWorktreeCreate3({ ...options, client: this.client });
  }
  remove(options) {
    return vcsWorktreeRemove3({ ...options, client: this.client });
  }
}

class VmSession2 extends HeyApiClient2 {
  destroy(options) {
    return vmSessionDestroy3({ ...options, client: this.client });
  }
  disable(options) {
    return vmSessionDisable3({ ...options, client: this.client });
  }
  enable(options) {
    return vmSessionEnable3({ ...options, client: this.client });
  }
  get(options) {
    return vmSessionGet3({ ...options, client: this.client });
  }
  toggle(options) {
    return vmSessionToggle3({ ...options, client: this.client });
  }
}

class WorkspaceIdentity2 extends HeyApiClient2 {
  get(options) {
    return workspaceIdentityGet3({ ...options, client: this.client });
  }
  put(options) {
    return workspaceIdentityPut3({ ...options, client: this.client });
  }
}

class WorkspaceMemory2 extends HeyApiClient2 {
  get(options) {
    return workspaceMemoryGet3({ ...options, client: this.client });
  }
  post(options) {
    return workspaceMemoryPost3({ ...options, client: this.client });
  }
}

class Agent2 extends HeyApiClient2 {
  create(options) {
    return agentCreate3({ ...options, client: this.client });
  }
  get(options) {
    return agentGet3({ ...options, client: this.client });
  }
  list(options) {
    return agentList3({ ...options, client: this.client });
  }
  update(options) {
    return agentUpdate3({ ...options, client: this.client });
  }
}

class App2 extends HeyApiClient2 {
  agents(options) {
    return agentList3({ ...options, client: this.client });
  }
  skills(options) {
    return appSkills3({ ...options, client: this.client });
  }
}

class Ars2 extends HeyApiClient2 {
  _contexta;
  get contexta() {
    return this._contexta ??= new ArsContexta2({ client: this.client });
  }
}

class Asset2 extends HeyApiClient2 {
  delete(options) {
    return assetDelete3({ ...options, client: this.client });
  }
  get(options) {
    return assetGet3({ ...options, client: this.client });
  }
  list(options) {
    return assetList3({ ...options, client: this.client });
  }
  upload(options) {
    return assetUpload3({ ...options, client: this.client });
  }
}

class Auth2 extends HeyApiClient2 {
  remove(options) {
    return authRemove3({ ...options, client: this.client });
  }
  set(options) {
    return authSet3({ ...options, client: this.client });
  }
}

class Command2 extends HeyApiClient2 {
  list(options) {
    return commandList3({ ...options, client: this.client });
  }
}

class Config2 extends HeyApiClient2 {
  get(options) {
    return configGet3({ ...options, client: this.client });
  }
  providers(options) {
    return configProviders3({ ...options, client: this.client });
  }
  update(options) {
    return configUpdate3({ ...options, client: this.client });
  }
}

class Cron2 extends HeyApiClient2 {
  allruns(options) {
    return cronAllRuns3({ ...options, client: this.client });
  }
  create(options) {
    return cronCreate3({ ...options, client: this.client });
  }
  delete(options) {
    return cronDelete3({ ...options, client: this.client });
  }
  get(options) {
    return cronGet3({ ...options, client: this.client });
  }
  getrun(options) {
    return cronGetRun3({ ...options, client: this.client });
  }
  list(options) {
    return cronList3({ ...options, client: this.client });
  }
  pause(options) {
    return cronPause3({ ...options, client: this.client });
  }
  resume(options) {
    return cronResume3({ ...options, client: this.client });
  }
  run(options) {
    return cronRun3({ ...options, client: this.client });
  }
  runs(options) {
    return cronRuns3({ ...options, client: this.client });
  }
  status(options) {
    return cronStatus3({ ...options, client: this.client });
  }
  update(options) {
    return cronUpdate3({ ...options, client: this.client });
  }
  wake(options) {
    return cronWake3({ ...options, client: this.client });
  }
  _cleanup;
  get cleanup() {
    return this._cleanup ??= new CronCleanup2({ client: this.client });
  }
}

class Engine2 extends HeyApiClient2 {
  execute(options) {
    return engineExecute3({ ...options, client: this.client });
  }
  health(options) {
    return engineHealth3({ ...options, client: this.client });
  }
  receipts(options) {
    return engineReceipts3({ ...options, client: this.client });
  }
  snapshot(options) {
    return engineSnapshot3({ ...options, client: this.client });
  }
  watch(options) {
    return engineWatch3({ ...options, client: this.client });
  }
  _run;
  get run() {
    return this._run ??= new EngineRun2({ client: this.client });
  }
}

class Event2 extends HeyApiClient2 {
  async* stream(options) {
    const response = await this.subscribe(options);
    for await (const item of response.stream) {
      yield item;
    }
  }
  subscribe(options) {
    return eventSubscribe3({ ...options, client: this.client });
  }
}

class File2 extends HeyApiClient2 {
  glob(options) {
    return fileGlob3({ ...options, client: this.client });
  }
  info(options) {
    return fileInfo3({ ...options, client: this.client });
  }
  read(options) {
    return fileRead3({ ...options, client: this.client });
  }
  search(options) {
    return fileSearch3({ ...options, client: this.client });
  }
  symbols(options) {
    return fileSymbols3({ ...options, client: this.client });
  }
  tree(options) {
    return fileTree3({ ...options, client: this.client });
  }
}

class Files2 extends HeyApiClient2 {
  delete(options) {
    return filesDelete3({ ...options, client: this.client });
  }
  get(options) {
    return filesGet3({ ...options, client: this.client });
  }
  list(options) {
    return filesList3({ ...options, client: this.client });
  }
  upload(options) {
    return filesUpload3({ ...options, client: this.client });
  }
}

class Formatter2 extends HeyApiClient2 {
  status(options) {
    return formatterStatus3({ ...options, client: this.client });
  }
}

class Get2 extends HeyApiClient2 {
  v1memorysearch(options) {
    return getV1MemorySearch3({ ...options, client: this.client });
  }
}

class Global2 extends HeyApiClient2 {
  async* stream(options) {
    const response = await this.event(options);
    for await (const item of response.stream) {
      yield item?.payload ?? item;
    }
  }
  event(options) {
    return globalEvent3({ ...options, client: this.client });
  }
  health(options) {
    return globalHealth3({ ...options, client: this.client });
  }
  version(options) {
    return globalVersion3({ ...options, client: this.client });
  }
}

class Instance2 extends HeyApiClient2 {
  sync(options) {
    return this.client.get({
      url: "/instance/sync",
      ...options
    });
  }
  dispose(options) {
    return instanceDispose3({ ...options, client: this.client });
  }
  health(options) {
    return instanceHealth3({ ...options, client: this.client });
  }
  sync(options) {
    return instanceSync3({ ...options, client: this.client });
  }
  version(options) {
    return instanceVersion3({ ...options, client: this.client });
  }
  workspace(options) {
    return instanceWorkspace3({ ...options, client: this.client });
  }
}

class Lsp2 extends HeyApiClient2 {
  status(options) {
    return lspStatus3({ ...options, client: this.client });
  }
}

class Mcp2 extends HeyApiClient2 {
  add(options) {
    return mcpAdd3({ ...options, client: this.client });
  }
  list(options) {
    return mcpList3({ ...options, client: this.client });
  }
  remove(options) {
    return mcpRemove3({ ...options, client: this.client });
  }
  resources(options) {
    return mcpResources3({ ...options, client: this.client });
  }
  status(options) {
    return mcpStatus3({ ...options, client: this.client });
  }
}

class Path2 extends HeyApiClient2 {
  get(options) {
    return pathGet3({ ...options, client: this.client });
  }
}

class Permission2 extends HeyApiClient2 {
  list(options) {
    return permissionList3({ ...options, client: this.client });
  }
  reply(options) {
    return permissionReply3({ ...options, client: this.client });
  }
}

class Post2 extends HeyApiClient2 {
  v1plugininstall(options) {
    return postV1PluginInstall3({ ...options, client: this.client });
  }
  v1pluginremove(options) {
    return postV1PluginRemove3({ ...options, client: this.client });
  }
}

class Project2 extends HeyApiClient2 {
  get(options) {
    return projectGet3({ ...options, client: this.client });
  }
  init(options) {
    return projectInit3({ ...options, client: this.client });
  }
  list(options) {
    return projectList3({ ...options, client: this.client });
  }
  listroot(options) {
    return projectListRoot3({ ...options, client: this.client });
  }
  sessionfilefind(options) {
    return projectSessionFileFind3({ ...options, client: this.client });
  }
  sessionfileread(options) {
    return projectSessionFileRead3({ ...options, client: this.client });
  }
  sessionfilestatus(options) {
    return projectSessionFileStatus3({ ...options, client: this.client });
  }
  sessionmessagecreate(options) {
    return projectSessionMessageCreate3({ ...options, client: this.client });
  }
  sessionmessageget(options) {
    return projectSessionMessageGet3({ ...options, client: this.client });
  }
  sessionpermissionreply(options) {
    return projectSessionPermissionReply3({ ...options, client: this.client });
  }
  update(options) {
    return projectUpdate3({ ...options, client: this.client });
  }
  _agent;
  get agent() {
    return this._agent ??= new ProjectAgent2({ client: this.client });
  }
  _find;
  get find() {
    return this._find ??= new ProjectFind2({ client: this.client });
  }
  _session;
  get session() {
    return this._session ??= new ProjectSession2({ client: this.client });
  }
}

class Provider2 extends HeyApiClient2 {
  auth(options) {
    return providerAuth3({ ...options, client: this.client });
  }
  list(options) {
    return providerList3({ ...options, client: this.client });
  }
  _oauth;
  get oauth() {
    return this._oauth ??= new ProviderOauth2({ client: this.client });
  }
}

class Pty2 extends HeyApiClient2 {
  create(options) {
    return ptyCreate3({ ...options, client: this.client });
  }
  get(options) {
    return ptyGet3({ ...options, client: this.client });
  }
  kill(options) {
    return ptyKill3({ ...options, client: this.client });
  }
  list(options) {
    return ptyList3({ ...options, client: this.client });
  }
}

class Put2 extends HeyApiClient2 {
  v1memorybyfilename(options) {
    return putV1MemoryByFilename3({ ...options, client: this.client });
  }
  v1memoryl1bysessionid(options) {
    return putV1MemoryL1BySessionId3({ ...options, client: this.client });
  }
  v1memoryl2bytype(options) {
    return putV1MemoryL2ByType3({ ...options, client: this.client });
  }
}

class Question2 extends HeyApiClient2 {
  list(options) {
    return questionList3({ ...options, client: this.client });
  }
  reject(options) {
    return questionReject3({ ...options, client: this.client });
  }
  reply(options) {
    return questionReply3({ ...options, client: this.client });
  }
}

class Sandbox2 extends HeyApiClient2 {
  disable(options) {
    return sandboxDisable3({ ...options, client: this.client });
  }
  enable(options) {
    return sandboxEnable3({ ...options, client: this.client });
  }
  get(options) {
    return sandboxGet3({ ...options, client: this.client });
  }
  policy(options) {
    return sandboxPolicy3({ ...options, client: this.client });
  }
  toggle(options) {
    return sandboxToggle3({ ...options, client: this.client });
  }
}

class Session2 extends HeyApiClient2 {
  clear(options) {
    const { sessionID } = options?.path ?? {};
    return this.client.post({
      url: `/session/${sessionID}/clear`,
      ...options
    });
  }
  convertOptions(options) {
    if (!options)
      return options;
    if (options.path || !options.sessionID)
      return options;
    const { sessionID, ...rest } = options;
    return {
      path: { sessionID },
      body: rest
    };
  }
  abort(options) {
    return sessionAbort3({ ...this.convertOptions(options), client: this.client });
  }
  allstatus(options) {
    return sessionAllStatus3({ ...options, client: this.client });
  }
  children(options) {
    return sessionChildren3({ ...this.convertOptions(options), client: this.client });
  }
  clear(options) {
    return sessionClear3({ ...this.convertOptions(options), client: this.client });
  }
  command(options) {
    return sessionCommand3({ ...this.convertOptions(options), client: this.client });
  }
  create(options) {
    return sessionCreate3({ ...options, client: this.client });
  }
  delete(options) {
    return sessionDelete3({ ...this.convertOptions(options), client: this.client });
  }
  diff(options) {
    return sessionDiff3({ ...this.convertOptions(options), client: this.client });
  }
  fork(options) {
    return sessionFork3({ ...this.convertOptions(options), client: this.client });
  }
  get(options) {
    return sessionGet3({ ...this.convertOptions(options), client: this.client });
  }
  initialize(options) {
    return sessionInitialize3({ ...this.convertOptions(options), client: this.client });
  }
  list(options) {
    return sessionList3({ ...options, client: this.client });
  }
  listglobal(options) {
    return sessionListGlobal3({ ...options, client: this.client });
  }
  messages(options) {
    return sessionMessages3({ ...this.convertOptions(options), client: this.client });
  }
  prompt(options) {
    return sessionPrompt3({ ...this.convertOptions(options), client: this.client });
  }
  revert(options) {
    return sessionRevert3({ ...this.convertOptions(options), client: this.client });
  }
  share(options) {
    return sessionShare3({ ...this.convertOptions(options), client: this.client });
  }
  summarize(options) {
    return sessionSummarize3({ ...this.convertOptions(options), client: this.client });
  }
  todo(options) {
    return sessionTodo3({ ...this.convertOptions(options), client: this.client });
  }
  unrevert(options) {
    return sessionUnrevert3({ ...this.convertOptions(options), client: this.client });
  }
  update(options) {
    return sessionUpdate3({ ...this.convertOptions(options), client: this.client });
  }
}

class Skill2 extends HeyApiClient2 {
  add(options) {
    return skillAdd3({ ...options, client: this.client });
  }
  eval(options) {
    return skillEval3({ ...options, client: this.client });
  }
  install(options) {
    return skillInstall3({ ...options, client: this.client });
  }
  publish(options) {
    return skillPublish3({ ...options, client: this.client });
  }
  registry(options) {
    return skillRegistry3({ ...options, client: this.client });
  }
  tools(options) {
    return skillTools3({ ...options, client: this.client });
  }
  _evals;
  get evals() {
    return this._evals ??= new SkillEvals2({ client: this.client });
  }
  _tool;
  get tool() {
    return this._tool ??= new SkillTool2({ client: this.client });
  }
}

class Terminal2 extends HeyApiClient2 {
  _clerk;
  get clerk() {
    return this._clerk ??= new TerminalClerk2({ client: this.client });
  }
}

class Tokens2 extends HeyApiClient2 {
  count(options) {
    return tokensCount3({ ...options, client: this.client });
  }
}

class Tui2 extends HeyApiClient2 {
  publish(options) {
    return tuiPublish3({ ...options, client: this.client });
  }
  _append;
  get append() {
    return this._append ??= new TuiAppend2({ client: this.client });
  }
  _clear;
  get clear() {
    return this._clear ??= new TuiClear2({ client: this.client });
  }
  _control;
  get control() {
    return this._control ??= new TuiControl2({ client: this.client });
  }
  _execute;
  get execute() {
    return this._execute ??= new TuiExecute2({ client: this.client });
  }
  _open;
  get open() {
    return this._open ??= new TuiOpen2({ client: this.client });
  }
  _select;
  get select() {
    return this._select ??= new TuiSelect2({ client: this.client });
  }
  _show;
  get show() {
    return this._show ??= new TuiShow2({ client: this.client });
  }
  _submit;
  get submit() {
    return this._submit ??= new TuiSubmit2({ client: this.client });
  }
}

class User2 extends HeyApiClient2 {
  clear(options) {
    return userClear3({ ...options, client: this.client });
  }
  get(options) {
    return userGet3({ ...options, client: this.client });
  }
  onboard(options) {
    return userOnboard3({ ...options, client: this.client });
  }
  refresh(options) {
    return userRefresh3({ ...options, client: this.client });
  }
}

class Vcs2 extends HeyApiClient2 {
  get(options) {
    return vcsGet3({ ...options, client: this.client });
  }
  _worktree;
  get worktree() {
    return this._worktree ??= new VcsWorktree2({ client: this.client });
  }
}

class Vm2 extends HeyApiClient2 {
  _session;
  get session() {
    return this._session ??= new VmSession2({ client: this.client });
  }
}

class Workspace2 extends HeyApiClient2 {
  activate(options) {
    return workspaceActivate3({ ...options, client: this.client });
  }
  get(options) {
    return workspaceGet3({ ...options, client: this.client });
  }
  import(options) {
    return workspaceImport3({ ...options, client: this.client });
  }
  init(options) {
    return workspaceInit3({ ...options, client: this.client });
  }
  layers(options) {
    return workspaceLayers3({ ...options, client: this.client });
  }
  skills(options) {
    return workspaceSkills3({ ...options, client: this.client });
  }
  _identity;
  get identity() {
    return this._identity ??= new WorkspaceIdentity2({ client: this.client });
  }
  _memory;
  get memory() {
    return this._memory ??= new WorkspaceMemory2({ client: this.client });
  }
}

class AllternitClient2 extends HeyApiClient2 {
  static __registry = new HeyApiRegistry2;
  constructor(args) {
    super(args);
    AllternitClient2.__registry.set(this, args?.key);
  }
  _agent;
  get agent() {
    return this._agent ??= new Agent2({ client: this.client });
  }
  _app;
  get app() {
    return this._app ??= new App2({ client: this.client });
  }
  _ars;
  get ars() {
    return this._ars ??= new Ars2({ client: this.client });
  }
  _asset;
  get asset() {
    return this._asset ??= new Asset2({ client: this.client });
  }
  _auth;
  get auth() {
    return this._auth ??= new Auth2({ client: this.client });
  }
  _command;
  get command() {
    return this._command ??= new Command2({ client: this.client });
  }
  _config;
  get config() {
    return this._config ??= new Config2({ client: this.client });
  }
  _cron;
  get cron() {
    return this._cron ??= new Cron2({ client: this.client });
  }
  _engine;
  get engine() {
    return this._engine ??= new Engine2({ client: this.client });
  }
  _event;
  get event() {
    return this._event ??= new Event2({ client: this.client });
  }
  _file;
  get file() {
    return this._file ??= new File2({ client: this.client });
  }
  _files;
  get files() {
    return this._files ??= new Files2({ client: this.client });
  }
  _formatter;
  get formatter() {
    return this._formatter ??= new Formatter2({ client: this.client });
  }
  _get;
  get get() {
    return this._get ??= new Get2({ client: this.client });
  }
  _global;
  get global() {
    return this._global ??= new Global2({ client: this.client });
  }
  _instance;
  get instance() {
    return this._instance ??= new Instance2({ client: this.client });
  }
  _lsp;
  get lsp() {
    return this._lsp ??= new Lsp2({ client: this.client });
  }
  _mcp;
  get mcp() {
    return this._mcp ??= new Mcp2({ client: this.client });
  }
  _path;
  get path() {
    return this._path ??= new Path2({ client: this.client });
  }
  _permission;
  get permission() {
    return this._permission ??= new Permission2({ client: this.client });
  }
  _post;
  get post() {
    return this._post ??= new Post2({ client: this.client });
  }
  _project;
  get project() {
    return this._project ??= new Project2({ client: this.client });
  }
  _provider;
  get provider() {
    return this._provider ??= new Provider2({ client: this.client });
  }
  _pty;
  get pty() {
    return this._pty ??= new Pty2({ client: this.client });
  }
  _put;
  get put() {
    return this._put ??= new Put2({ client: this.client });
  }
  _question;
  get question() {
    return this._question ??= new Question2({ client: this.client });
  }
  _sandbox;
  get sandbox() {
    return this._sandbox ??= new Sandbox2({ client: this.client });
  }
  _session;
  get session() {
    return this._session ??= new Session2({ client: this.client });
  }
  _skill;
  get skill() {
    return this._skill ??= new Skill2({ client: this.client });
  }
  _terminal;
  get terminal() {
    return this._terminal ??= new Terminal2({ client: this.client });
  }
  _tokens;
  get tokens() {
    return this._tokens ??= new Tokens2({ client: this.client });
  }
  _tui;
  get tui() {
    return this._tui ??= new Tui2({ client: this.client });
  }
  _user;
  get user() {
    return this._user ??= new User2({ client: this.client });
  }
  _vcs;
  get vcs() {
    return this._vcs ??= new Vcs2({ client: this.client });
  }
  _vm;
  get vm() {
    return this._vm ??= new Vm2({ client: this.client });
  }
  _workspace;
  get workspace() {
    return this._workspace ??= new Workspace2({ client: this.client });
  }
  events(options) {
    return this.event.stream(options);
  }
  globalEvents(options) {
    return this.global.stream(options);
  }
  async* on(type, options) {
    for await (const event of this.events(options)) {
      if (event.type === type) {
        yield event;
      }
    }
  }
}
function createAllternitClient2(config) {
  if (!config?.fetch) {
    const customFetch = (req) => {
      req.timeout = false;
      return fetch(req);
    };
    config = { ...config, fetch: customFetch };
  }
  if (config?.directory) {
    const isNonASCII = /[^\x00-\x7F]/.test(config.directory);
    const encodedDirectory = isNonASCII ? encodeURIComponent(config.directory) : config.directory;
    config.headers = { ...config.headers, "x-opencode-directory": encodedDirectory };
  }
  const clientInstance = createClient5(config);
  return new AllternitClient2({ client: clientInstance });
}
export {
  workspaceSkills2 as workspaceSkills,
  workspaceMemoryPost2 as workspaceMemoryPost,
  workspaceMemoryGet2 as workspaceMemoryGet,
  workspaceLayers2 as workspaceLayers,
  workspaceInit2 as workspaceInit,
  workspaceImport2 as workspaceImport,
  workspaceIdentityPut2 as workspaceIdentityPut,
  workspaceIdentityGet2 as workspaceIdentityGet,
  workspaceGet2 as workspaceGet,
  workspaceActivate2 as workspaceActivate,
  vmSessionToggle2 as vmSessionToggle,
  vmSessionGet2 as vmSessionGet,
  vmSessionEnable2 as vmSessionEnable,
  vmSessionDisable2 as vmSessionDisable,
  vmSessionDestroy2 as vmSessionDestroy,
  vcsWorktreeRemove2 as vcsWorktreeRemove,
  vcsWorktreeCreate2 as vcsWorktreeCreate,
  vcsGet2 as vcsGet,
  userRefresh2 as userRefresh,
  userOnboard2 as userOnboard,
  userGet2 as userGet,
  userClear2 as userClear,
  tuiSubmitPrompt2 as tuiSubmitPrompt,
  tuiShowToast2 as tuiShowToast,
  tuiSelectSession2 as tuiSelectSession,
  tuiPublish2 as tuiPublish,
  tuiOpenThemes2 as tuiOpenThemes,
  tuiOpenSessions2 as tuiOpenSessions,
  tuiOpenModels2 as tuiOpenModels,
  tuiOpenHelp2 as tuiOpenHelp,
  tuiExecuteCommand2 as tuiExecuteCommand,
  tuiControlResponse2 as tuiControlResponse,
  tuiControlNext2 as tuiControlNext,
  tuiClearPrompt2 as tuiClearPrompt,
  tuiAppendPrompt2 as tuiAppendPrompt,
  tokensCount2 as tokensCount,
  terminalClerkStart2 as terminalClerkStart,
  terminalClerkPoll2 as terminalClerkPoll,
  terminalClerkClaim2 as terminalClerkClaim,
  terminalClerkCallback2 as terminalClerkCallback,
  skillTools2 as skillTools,
  skillToolIds2 as skillToolIds,
  skillRegistry2 as skillRegistry,
  skillPublish2 as skillPublish,
  skillInstall2 as skillInstall,
  skillEvalsList2 as skillEvalsList,
  skillEvalsGet2 as skillEvalsGet,
  skillEval2 as skillEval,
  skillAdd2 as skillAdd,
  sessionUpdate2 as sessionUpdate,
  sessionUnrevert2 as sessionUnrevert,
  sessionTodo2 as sessionTodo,
  sessionSummarize2 as sessionSummarize,
  sessionShare2 as sessionShare,
  sessionRevert2 as sessionRevert,
  sessionPrompt2 as sessionPrompt,
  sessionMessages2 as sessionMessages,
  sessionListGlobal2 as sessionListGlobal,
  sessionList2 as sessionList,
  sessionInitialize2 as sessionInitialize,
  sessionGet2 as sessionGet,
  sessionFork2 as sessionFork,
  sessionDiff2 as sessionDiff,
  sessionDelete2 as sessionDelete,
  sessionCreate2 as sessionCreate,
  sessionCommand2 as sessionCommand,
  sessionClear2 as sessionClear,
  sessionChildren2 as sessionChildren,
  sessionAllStatus2 as sessionAllStatus,
  sessionAbort2 as sessionAbort,
  sandboxToggle2 as sandboxToggle,
  sandboxPolicy2 as sandboxPolicy,
  sandboxGet2 as sandboxGet,
  sandboxEnable2 as sandboxEnable,
  sandboxDisable2 as sandboxDisable,
  questionReply2 as questionReply,
  questionReject2 as questionReject,
  questionList2 as questionList,
  putV1MemoryL2ByType2 as putV1MemoryL2ByType,
  putV1MemoryL1BySessionId2 as putV1MemoryL1BySessionId,
  putV1MemoryByFilename2 as putV1MemoryByFilename,
  ptyList2 as ptyList,
  ptyKill2 as ptyKill,
  ptyGet2 as ptyGet,
  ptyCreate2 as ptyCreate,
  providerOauthVerify2 as providerOauthVerify,
  providerOauthAuthorize2 as providerOauthAuthorize,
  providerList2 as providerList,
  providerAuth2 as providerAuth,
  projectUpdate2 as projectUpdate,
  projectSessionUnshare2 as projectSessionUnshare,
  projectSessionUnrevert2 as projectSessionUnrevert,
  projectSessionShare2 as projectSessionShare,
  projectSessionRevert2 as projectSessionRevert,
  projectSessionPermissionReply2 as projectSessionPermissionReply,
  projectSessionMessages2 as projectSessionMessages,
  projectSessionMessageGet2 as projectSessionMessageGet,
  projectSessionMessageCreate2 as projectSessionMessageCreate,
  projectSessionList2 as projectSessionList,
  projectSessionInitialize2 as projectSessionInitialize,
  projectSessionGet2 as projectSessionGet,
  projectSessionFileStatus2 as projectSessionFileStatus,
  projectSessionFileRead2 as projectSessionFileRead,
  projectSessionFileFind2 as projectSessionFileFind,
  projectSessionDelete2 as projectSessionDelete,
  projectSessionCreate2 as projectSessionCreate,
  projectSessionCompact2 as projectSessionCompact,
  projectSessionAbort2 as projectSessionAbort,
  projectListRoot2 as projectListRoot,
  projectList2 as projectList,
  projectInit2 as projectInit,
  projectGet2 as projectGet,
  projectFindFile2 as projectFindFile,
  projectAgentList2 as projectAgentList,
  postV1PluginRemove2 as postV1PluginRemove,
  postV1PluginInstall2 as postV1PluginInstall,
  permissionReply2 as permissionReply,
  permissionList2 as permissionList,
  pathGet2 as pathGet,
  mcpStatus2 as mcpStatus,
  mcpResources2 as mcpResources,
  mcpRemove2 as mcpRemove,
  mcpList2 as mcpList,
  mcpAdd2 as mcpAdd,
  lspStatus2 as lspStatus,
  instanceWorkspace2 as instanceWorkspace,
  instanceVersion2 as instanceVersion,
  instanceSync2 as instanceSync,
  instanceHealth2 as instanceHealth,
  instanceDispose2 as instanceDispose,
  globalVersion2 as globalVersion,
  globalHealth2 as globalHealth,
  globalEvent2 as globalEvent,
  getV1MemorySearch2 as getV1MemorySearch,
  formatterStatus2 as formatterStatus,
  filesUpload2 as filesUpload,
  filesList2 as filesList,
  filesGet2 as filesGet,
  filesDelete2 as filesDelete,
  fileTree2 as fileTree,
  fileSymbols2 as fileSymbols,
  fileSearch2 as fileSearch,
  fileRead2 as fileRead,
  fileInfo2 as fileInfo,
  fileGlob2 as fileGlob,
  eventSubscribe2 as eventSubscribe,
  engineWatch2 as engineWatch,
  engineSnapshot2 as engineSnapshot,
  engineRunResume2 as engineRunResume,
  engineRunPause2 as engineRunPause,
  engineRunGet2 as engineRunGet,
  engineRunEvents2 as engineRunEvents,
  engineRunCancel2 as engineRunCancel,
  engineRunApproval2 as engineRunApproval,
  engineReceipts2 as engineReceipts,
  engineHealth2 as engineHealth,
  engineExecute2 as engineExecute,
  cronWake2 as cronWake,
  cronUpdate2 as cronUpdate,
  cronStatus2 as cronStatus,
  cronRuns2 as cronRuns,
  cronRun2 as cronRun,
  cronResume2 as cronResume,
  cronPause2 as cronPause,
  cronList2 as cronList,
  cronGetRun2 as cronGetRun,
  cronGet2 as cronGet,
  cronDelete2 as cronDelete,
  cronCreate2 as cronCreate,
  cronCleanupSession2 as cronCleanupSession,
  cronAllRuns2 as cronAllRuns,
  createAllternitClient,
  createAllternitClient2 as createAllternit,
  configUpdate2 as configUpdate,
  configProviders2 as configProviders,
  configGet2 as configGet,
  commandList2 as commandList,
  authSet2 as authSet,
  authRemove2 as authRemove,
  assetUpload2 as assetUpload,
  assetList2 as assetList,
  assetGet2 as assetGet,
  assetDelete2 as assetDelete,
  arsContextaProviders2 as arsContextaProviders,
  arsContextaInsights2 as arsContextaInsights,
  arsContextaHealth2 as arsContextaHealth,
  arsContextaEntities2 as arsContextaEntities,
  arsContextaEnrich2 as arsContextaEnrich,
  appSkills2 as appSkills,
  agentUpdate2 as agentUpdate,
  agentList2 as agentList,
  agentGet2 as agentGet,
  agentCreate2 as agentCreate,
  AllternitClient
};
