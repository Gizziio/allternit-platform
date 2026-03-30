// @bun
// packages/sdk/dist/gen/core/bodySerializer.gen.ts
var jsonBodySerializer = {
  bodySerializer: (body) => JSON.stringify(body, (_key, value) => typeof value === "bigint" ? value.toString() : value)
};
// packages/sdk/dist/gen/core/params.gen.ts
var extraPrefixesMap = {
  $body_: "body",
  $headers_: "headers",
  $path_: "path",
  $query_: "query"
};
var extraPrefixes = Object.entries(extraPrefixesMap);
// packages/sdk/dist/gen/core/serverSentEvents.gen.ts
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

// packages/sdk/dist/gen/core/pathSerializer.gen.ts
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

// packages/sdk/dist/gen/core/utils.gen.ts
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

// packages/sdk/dist/gen/core/auth.gen.ts
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

// packages/sdk/dist/gen/client/utils.gen.ts
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

// packages/sdk/dist/gen/client/client.gen.ts
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
// packages/sdk/dist/gen/client.gen.ts
var client = createClient(createConfig());

// packages/sdk/dist/gen/sdk.gen.ts
var sessionListGlobal = (options) => (options?.client ?? client).get({ url: "/session/global", ...options });
var sessionList = (options) => (options?.client ?? client).get({ url: "/session/list", ...options });
var sessionCreate = (options) => (options.client ?? client).post({
  url: "/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAllStatus = (options) => (options?.client ?? client).get({ url: "/session/status", ...options });
var sessionDelete = (options) => (options.client ?? client).delete({ url: "/session/{sessionID}", ...options });
var sessionGet = (options) => (options.client ?? client).get({ url: "/session/{sessionID}", ...options });
var sessionUpdate = (options) => (options.client ?? client).patch({
  url: "/session/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionInitialize = (options) => (options.client ?? client).post({
  url: "/session/{sessionID}/initialize",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionMessages = (options) => (options.client ?? client).get({ url: "/session/{sessionID}/messages", ...options });
var sessionPrompt = (options) => (options.client ?? client).post({
  url: "/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionCommand = (options) => (options.client ?? client).post({
  url: "/session/{sessionID}/command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionAbort = (options) => (options.client ?? client).post({ url: "/session/{sessionID}/abort", ...options });
var sessionFork = (options) => (options.client ?? client).post({ url: "/session/{sessionID}/fork", ...options });
var sessionShare = (options) => (options.client ?? client).post({ url: "/session/{sessionID}/share", ...options });
var sessionDiff = (options) => (options.client ?? client).get({ url: "/session/{sessionID}/diff", ...options });
var sessionSummarize = (options) => (options.client ?? client).post({ url: "/session/{sessionID}/summarize", ...options });
var sessionRevert = (options) => (options.client ?? client).post({
  url: "/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sessionUnrevert = (options) => (options.client ?? client).post({ url: "/session/{sessionID}/unrevert", ...options });
var sessionChildren = (options) => (options.client ?? client).get({ url: "/session/{sessionID}/children", ...options });
var sessionTodo = (options) => (options.client ?? client).get({ url: "/session/{sessionID}/todo", ...options });
var sessionClear = (options) => (options.client ?? client).post({ url: "/session/{sessionID}/clear", ...options });
var agentList = (options) => (options?.client ?? client).get({ url: "/agent/list", ...options });
var agentCreate = (options) => (options.client ?? client).post({
  url: "/agent/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var agentGet = (options) => (options.client ?? client).get({ url: "/agent/{agentID}", ...options });
var agentUpdate = (options) => (options.client ?? client).patch({
  url: "/agent/{agentID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var commandList = (options) => (options?.client ?? client).get({ url: "/command/list", ...options });
var providerList = (options) => (options?.client ?? client).get({ url: "/provider", ...options });
var providerAuth = (options) => (options?.client ?? client).get({ url: "/provider/auth", ...options });
var providerOauthAuthorize = (options) => (options.client ?? client).post({ url: "/provider/{providerID}/oauth/authorize", ...options });
var providerOauthVerify = (options) => (options.client ?? client).post({
  url: "/provider/{providerID}/oauth/verify",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configGet = (options) => (options?.client ?? client).get({ url: "/config", ...options });
var configUpdate = (options) => (options.client ?? client).patch({
  url: "/config",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var configProviders = (options) => (options?.client ?? client).get({ url: "/config/providers", ...options });
var mcpStatus = (options) => (options?.client ?? client).get({ url: "/mcp", ...options });
var mcpList = (options) => (options?.client ?? client).get({ url: "/mcp/list", ...options });
var mcpAdd = (options) => (options.client ?? client).post({
  url: "/mcp/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var mcpResources = (options) => (options?.client ?? client).get({ url: "/mcp/resources", ...options });
var mcpRemove = (options) => (options.client ?? client).delete({ url: "/mcp/{name}", ...options });
var cronStatus = (options) => (options?.client ?? client).get({ url: "/cron/status", ...options });
var cronList = (options) => (options?.client ?? client).get({ url: "/cron/jobs", ...options });
var cronCreate = (options) => (options.client ?? client).post({
  url: "/cron/jobs",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronDelete = (options) => (options.client ?? client).delete({ url: "/cron/jobs/{id}", ...options });
var cronGet = (options) => (options.client ?? client).get({ url: "/cron/jobs/{id}", ...options });
var cronUpdate = (options) => (options.client ?? client).put({
  url: "/cron/jobs/{id}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var cronPause = (options) => (options.client ?? client).post({ url: "/cron/jobs/{id}/pause", ...options });
var cronResume = (options) => (options.client ?? client).post({ url: "/cron/jobs/{id}/resume", ...options });
var cronRun = (options) => (options.client ?? client).post({ url: "/cron/jobs/{id}/run", ...options });
var cronRuns = (options) => (options.client ?? client).get({ url: "/cron/jobs/{id}/runs", ...options });
var cronAllRuns = (options) => (options?.client ?? client).get({ url: "/cron/runs", ...options });
var cronGetRun = (options) => (options.client ?? client).get({ url: "/cron/runs/{id}", ...options });
var cronWake = (options) => (options?.client ?? client).post({ url: "/cron/wake", ...options });
var cronCleanupSession = (options) => (options.client ?? client).delete({ url: "/cron/session/{sessionId}", ...options });
var permissionReply = (options) => (options.client ?? client).post({
  url: "/permission/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var permissionList = (options) => (options?.client ?? client).get({ url: "/permission", ...options });
var questionList = (options) => (options?.client ?? client).get({ url: "/question", ...options });
var questionReply = (options) => (options.client ?? client).post({
  url: "/question/{requestID}/reply",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var questionReject = (options) => (options.client ?? client).post({ url: "/question/{requestID}/reject", ...options });
var fileSearch = (options) => (options?.client ?? client).get({ url: "/file/search", ...options });
var fileGlob = (options) => (options?.client ?? client).get({ url: "/file/glob", ...options });
var fileSymbols = (options) => (options?.client ?? client).get({ url: "/file/symbols", ...options });
var fileTree = (options) => (options?.client ?? client).get({ url: "/file/tree", ...options });
var fileRead = (options) => (options?.client ?? client).get({ url: "/file/read", ...options });
var fileInfo = (options) => (options?.client ?? client).get({ url: "/file/info", ...options });
var assetUpload = (options) => (options?.client ?? client).post({ url: "/assets/upload", ...options });
var assetList = (options) => (options?.client ?? client).get({ url: "/assets", ...options });
var assetDelete = (options) => (options.client ?? client).delete({ url: "/assets/{id}", ...options });
var assetGet = (options) => (options.client ?? client).get({ url: "/assets/{id}", ...options });
var filesList = (options) => (options?.client ?? client).get({ url: "/files", ...options });
var filesUpload = (options) => (options?.client ?? client).post({ url: "/files", ...options });
var filesDelete = (options) => (options.client ?? client).delete({ url: "/files/{id}", ...options });
var filesGet = (options) => (options.client ?? client).get({ url: "/files/{id}", ...options });
var userGet = (options) => (options?.client ?? client).get({ url: "/user", ...options });
var userRefresh = (options) => (options?.client ?? client).post({ url: "/user/refresh", ...options });
var userOnboard = (options) => (options.client ?? client).post({
  url: "/user/onboard",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var userClear = (options) => (options?.client ?? client).post({ url: "/user/clear", ...options });
var ptyList = (options) => (options?.client ?? client).get({ url: "/pty/list", ...options });
var ptyCreate = (options) => (options.client ?? client).post({
  url: "/pty/create",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var ptyKill = (options) => (options.client ?? client).delete({ url: "/pty/{ptyID}", ...options });
var ptyGet = (options) => (options.client ?? client).get({ url: "/pty/{ptyID}", ...options });
var instanceSync = (options) => (options?.client ?? client).get({ url: "/instance/sync", ...options });
var instanceDispose = (options) => (options?.client ?? client).post({ url: "/instance/dispose", ...options });
var instanceWorkspace = (options) => (options?.client ?? client).get({ url: "/instance/workspace", ...options });
var instanceVersion = (options) => (options?.client ?? client).get({ url: "/instance/version", ...options });
var instanceHealth = (options) => (options?.client ?? client).get({ url: "/instance/health", ...options });
var tuiAppendPrompt = (options) => (options.client ?? client).post({
  url: "/instance/tui/append-prompt",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiOpenHelp = (options) => (options?.client ?? client).post({ url: "/instance/tui/open-help", ...options });
var tuiOpenSessions = (options) => (options?.client ?? client).post({ url: "/instance/tui/open-sessions", ...options });
var tuiOpenThemes = (options) => (options?.client ?? client).post({ url: "/instance/tui/open-themes", ...options });
var tuiOpenModels = (options) => (options?.client ?? client).post({ url: "/instance/tui/open-models", ...options });
var tuiSubmitPrompt = (options) => (options?.client ?? client).post({ url: "/instance/tui/submit-prompt", ...options });
var tuiClearPrompt = (options) => (options?.client ?? client).post({ url: "/instance/tui/clear-prompt", ...options });
var tuiExecuteCommand = (options) => (options.client ?? client).post({
  url: "/instance/tui/execute-command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiShowToast = (options) => (options.client ?? client).post({
  url: "/instance/tui/show-toast",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiPublish = (options) => (options.client ?? client).post({
  url: "/instance/tui/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiSelectSession = (options) => (options.client ?? client).post({
  url: "/instance/tui/select-session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiControlNext = (options) => (options?.client ?? client).get({ url: "/instance/tui/control/next", ...options });
var tuiControlResponse = (options) => (options.client ?? client).post({
  url: "/instance/tui/control/response",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var pathGet = (options) => (options?.client ?? client).get({ url: "/path", ...options });
var vcsGet = (options) => (options?.client ?? client).get({ url: "/vcs", ...options });
var vcsWorktreeRemove = (options) => (options.client ?? client).delete({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vcsWorktreeCreate = (options) => (options.client ?? client).post({
  url: "/vcs/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var lspStatus = (options) => (options?.client ?? client).get({ url: "/lsp", ...options });
var formatterStatus = (options) => (options?.client ?? client).get({ url: "/formatter", ...options });
var skillToolIds = (options) => (options?.client ?? client).get({ url: "/skill/tool-ids", ...options });
var skillTools = (options) => (options?.client ?? client).get({ url: "/skill/tools", ...options });
var appSkills = (options) => (options?.client ?? client).get({ url: "/skill", ...options });
var skillAdd = (options) => (options.client ?? client).post({
  url: "/skill/add",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEval = (options) => (options.client ?? client).post({
  url: "/skill/{name}/eval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillEvalsList = (options) => (options.client ?? client).get({ url: "/skill/{name}/evals", ...options });
var skillEvalsGet = (options) => (options.client ?? client).get({ url: "/skill/{name}/evals/{id}", ...options });
var skillRegistry = (options) => (options?.client ?? client).get({ url: "/skill/registry", ...options });
var skillPublish = (options) => (options.client ?? client).post({
  url: "/skill/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var skillInstall = (options) => (options.client ?? client).post({
  url: "/skill/{id}/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var getV1MemorySearch = (options) => (options?.client ?? client).get({ url: "/memory/search", ...options });
var putV1MemoryL2ByType = (options) => (options.client ?? client).put({
  url: "/memory/l2/{type}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryL1BySessionId = (options) => (options.client ?? client).put({
  url: "/memory/l1/{sessionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var putV1MemoryByFilename = (options) => (options.client ?? client).put({
  url: "/memory/{filename}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tokensCount = (options) => (options.client ?? client).post({
  url: "/tokens/count",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineExecute = (options) => (options.client ?? client).post({
  url: "/engine/execute",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineWatch = (options) => (options.client ?? client).sse.get({ url: "/engine/watch/{runId}", ...options });
var engineReceipts = (options) => (options.client ?? client).get({ url: "/engine/receipts/{runId}", ...options });
var engineSnapshot = (options) => (options.client ?? client).get({ url: "/engine/snapshot/{runId}", ...options });
var engineRunGet = (options) => (options.client ?? client).get({ url: "/engine/runs/{runId}", ...options });
var engineRunEvents = (options) => (options.client ?? client).get({ url: "/engine/runs/{runId}/events", ...options });
var engineRunApproval = (options) => (options.client ?? client).post({
  url: "/engine/runs/{runId}/approval",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunCancel = (options) => (options.client ?? client).post({
  url: "/engine/runs/{runId}/cancel",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunPause = (options) => (options.client ?? client).post({
  url: "/engine/runs/{runId}/pause",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineRunResume = (options) => (options.client ?? client).post({
  url: "/engine/runs/{runId}/resume",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var engineHealth = (options) => (options?.client ?? client).get({ url: "/engine/health", ...options });
var sandboxGet = (options) => (options.client ?? client).get({ url: "/sandbox/{sessionID}", ...options });
var sandboxEnable = (options) => (options.client ?? client).post({
  url: "/sandbox/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxDisable = (options) => (options.client ?? client).post({ url: "/sandbox/{sessionID}/disable", ...options });
var sandboxToggle = (options) => (options.client ?? client).post({
  url: "/sandbox/{sessionID}/toggle",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var sandboxPolicy = (options) => (options.client ?? client).patch({
  url: "/sandbox/{sessionID}/policy",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDestroy = (options) => (options.client ?? client).delete({ url: "/vm-session/{sessionID}", ...options });
var vmSessionGet = (options) => (options.client ?? client).get({ url: "/vm-session/{sessionID}", ...options });
var vmSessionEnable = (options) => (options.client ?? client).post({
  url: "/vm-session/{sessionID}/enable",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var vmSessionDisable = (options) => (options.client ?? client).post({ url: "/vm-session/{sessionID}/disable", ...options });
var vmSessionToggle = (options) => (options.client ?? client).post({ url: "/vm-session/{sessionID}/toggle", ...options });
var postV1PluginInstall = (options) => (options.client ?? client).post({
  url: "/plugin/install",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var postV1PluginRemove = (options) => (options.client ?? client).post({
  url: "/plugin/remove",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var eventSubscribe = (options) => (options?.client ?? client).sse.get({ url: "/event", ...options });
var arsContextaHealth = (options) => (options?.client ?? client).get({ url: "/ars-contexta/health", ...options });
var arsContextaInsights = (options) => (options.client ?? client).post({
  url: "/ars-contexta/insights",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEntities = (options) => (options.client ?? client).post({
  url: "/ars-contexta/entities",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaEnrich = (options) => (options.client ?? client).post({
  url: "/ars-contexta/enrich",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var arsContextaProviders = (options) => (options?.client ?? client).get({ url: "/ars-contexta/providers", ...options });
var authRemove = (options) => (options.client ?? client).delete({ url: "/auth/{providerID}", ...options });
var authSet = (options) => (options.client ?? client).put({
  url: "/auth/{providerID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkStart = (options) => (options.client ?? client).post({
  url: "/auth/terminal/clerk/start",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var terminalClerkPoll = (options) => (options.client ?? client).get({ url: "/auth/terminal/clerk/poll/{sessionID}", ...options });
var terminalClerkClaim = (options) => (options.client ?? client).post({ url: "/auth/terminal/clerk/claim/{sessionID}", ...options });
var terminalClerkCallback = (options) => (options.client ?? client).post({ url: "/auth/terminal/clerk/callback/{sessionID}", ...options });
var projectListRoot = (options) => (options?.client ?? client).get({ url: "/project", ...options });
var projectInit = (options) => (options.client ?? client).post({
  url: "/project/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectList = (options) => (options?.client ?? client).get({ url: "/project/list", ...options });
var projectSessionList = (options) => (options.client ?? client).get({ url: "/project/{projectID}/session", ...options });
var projectSessionCreate = (options) => (options.client ?? client).post({
  url: "/project/{projectID}/session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionDelete = (options) => (options.client ?? client).delete({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionGet = (options) => (options.client ?? client).get({ url: "/project/{projectID}/session/{sessionID}", ...options });
var projectSessionInitialize = (options) => (options.client ?? client).post({
  url: "/project/{projectID}/session/{sessionID}/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionAbort = (options) => (options.client ?? client).post({ url: "/project/{projectID}/session/{sessionID}/abort", ...options });
var projectSessionUnshare = (options) => (options.client ?? client).delete({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionShare = (options) => (options.client ?? client).post({ url: "/project/{projectID}/session/{sessionID}/share", ...options });
var projectSessionCompact = (options) => (options.client ?? client).post({ url: "/project/{projectID}/session/{sessionID}/compact", ...options });
var projectSessionMessages = (options) => (options.client ?? client).get({ url: "/project/{projectID}/session/{sessionID}/message", ...options });
var projectSessionMessageCreate = (options) => (options.client ?? client).post({
  url: "/project/{projectID}/session/{sessionID}/message",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionMessageGet = (options) => (options.client ?? client).get({ url: "/project/{projectID}/session/{sessionID}/message/{messageID}", ...options });
var projectSessionRevert = (options) => (options.client ?? client).post({
  url: "/project/{projectID}/session/{sessionID}/revert",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionUnrevert = (options) => (options.client ?? client).post({ url: "/project/{projectID}/session/{sessionID}/unrevert", ...options });
var projectSessionPermissionReply = (options) => (options.client ?? client).post({
  url: "/project/{projectID}/session/{sessionID}/permission/{permissionID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var projectSessionFileFind = (options) => (options.client ?? client).get({ url: "/project/{projectID}/session/{sessionID}/find/file", ...options });
var projectSessionFileStatus = (options) => (options.client ?? client).get({ url: "/project/{projectID}/session/{sessionID}/file/status", ...options });
var projectSessionFileRead = (options) => (options.client ?? client).get({ url: "/project/{projectID}/session/{sessionID}/file", ...options });
var projectAgentList = (options) => (options.client ?? client).get({ url: "/project/{projectID}/agent", ...options });
var projectFindFile = (options) => (options.client ?? client).get({ url: "/project/{projectID}/find/file", ...options });
var projectGet = (options) => (options.client ?? client).get({ url: "/project/{projectID}", ...options });
var projectUpdate = (options) => (options.client ?? client).patch({
  url: "/project/{projectID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceGet = (options) => (options?.client ?? client).get({ url: "/workspace", ...options });
var workspaceInit = (options) => (options.client ?? client).post({
  url: "/workspace/init",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceImport = (options) => (options.client ?? client).post({
  url: "/workspace/import",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceIdentityGet = (options) => (options?.client ?? client).get({ url: "/workspace/identity", ...options });
var workspaceIdentityPut = (options) => (options.client ?? client).put({
  url: "/workspace/identity",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceLayers = (options) => (options?.client ?? client).get({ url: "/workspace/layers", ...options });
var workspaceMemoryGet = (options) => (options?.client ?? client).get({ url: "/workspace/memory", ...options });
var workspaceMemoryPost = (options) => (options.client ?? client).post({
  url: "/workspace/memory",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceActivate = (options) => (options.client ?? client).post({
  url: "/workspace/activate",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var workspaceSkills = (options) => (options?.client ?? client).get({ url: "/workspace/skills", ...options });
var globalHealth = (options) => (options?.client ?? client).get({ url: "/global/health", ...options });
var globalEvent = (options) => (options?.client ?? client).sse.get({ url: "/global/event", ...options });
var globalVersion = (options) => (options?.client ?? client).get({ url: "/global/version", ...options });
export {
  workspaceSkills,
  workspaceMemoryPost,
  workspaceMemoryGet,
  workspaceLayers,
  workspaceInit,
  workspaceImport,
  workspaceIdentityPut,
  workspaceIdentityGet,
  workspaceGet,
  workspaceActivate,
  vmSessionToggle,
  vmSessionGet,
  vmSessionEnable,
  vmSessionDisable,
  vmSessionDestroy,
  vcsWorktreeRemove,
  vcsWorktreeCreate,
  vcsGet,
  userRefresh,
  userOnboard,
  userGet,
  userClear,
  tuiSubmitPrompt,
  tuiShowToast,
  tuiSelectSession,
  tuiPublish,
  tuiOpenThemes,
  tuiOpenSessions,
  tuiOpenModels,
  tuiOpenHelp,
  tuiExecuteCommand,
  tuiControlResponse,
  tuiControlNext,
  tuiClearPrompt,
  tuiAppendPrompt,
  tokensCount,
  terminalClerkStart,
  terminalClerkPoll,
  terminalClerkClaim,
  terminalClerkCallback,
  skillTools,
  skillToolIds,
  skillRegistry,
  skillPublish,
  skillInstall,
  skillEvalsList,
  skillEvalsGet,
  skillEval,
  skillAdd,
  sessionUpdate,
  sessionUnrevert,
  sessionTodo,
  sessionSummarize,
  sessionShare,
  sessionRevert,
  sessionPrompt,
  sessionMessages,
  sessionListGlobal,
  sessionList,
  sessionInitialize,
  sessionGet,
  sessionFork,
  sessionDiff,
  sessionDelete,
  sessionCreate,
  sessionCommand,
  sessionClear,
  sessionChildren,
  sessionAllStatus,
  sessionAbort,
  sandboxToggle,
  sandboxPolicy,
  sandboxGet,
  sandboxEnable,
  sandboxDisable,
  questionReply,
  questionReject,
  questionList,
  putV1MemoryL2ByType,
  putV1MemoryL1BySessionId,
  putV1MemoryByFilename,
  ptyList,
  ptyKill,
  ptyGet,
  ptyCreate,
  providerOauthVerify,
  providerOauthAuthorize,
  providerList,
  providerAuth,
  projectUpdate,
  projectSessionUnshare,
  projectSessionUnrevert,
  projectSessionShare,
  projectSessionRevert,
  projectSessionPermissionReply,
  projectSessionMessages,
  projectSessionMessageGet,
  projectSessionMessageCreate,
  projectSessionList,
  projectSessionInitialize,
  projectSessionGet,
  projectSessionFileStatus,
  projectSessionFileRead,
  projectSessionFileFind,
  projectSessionDelete,
  projectSessionCreate,
  projectSessionCompact,
  projectSessionAbort,
  projectListRoot,
  projectList,
  projectInit,
  projectGet,
  projectFindFile,
  projectAgentList,
  postV1PluginRemove,
  postV1PluginInstall,
  permissionReply,
  permissionList,
  pathGet,
  mcpStatus,
  mcpResources,
  mcpRemove,
  mcpList,
  mcpAdd,
  lspStatus,
  instanceWorkspace,
  instanceVersion,
  instanceSync,
  instanceHealth,
  instanceDispose,
  globalVersion,
  globalHealth,
  globalEvent,
  getV1MemorySearch,
  formatterStatus,
  filesUpload,
  filesList,
  filesGet,
  filesDelete,
  fileTree,
  fileSymbols,
  fileSearch,
  fileRead,
  fileInfo,
  fileGlob,
  eventSubscribe,
  engineWatch,
  engineSnapshot,
  engineRunResume,
  engineRunPause,
  engineRunGet,
  engineRunEvents,
  engineRunCancel,
  engineRunApproval,
  engineReceipts,
  engineHealth,
  engineExecute,
  cronWake,
  cronUpdate,
  cronStatus,
  cronRuns,
  cronRun,
  cronResume,
  cronPause,
  cronList,
  cronGetRun,
  cronGet,
  cronDelete,
  cronCreate,
  cronCleanupSession,
  cronAllRuns,
  configUpdate,
  configProviders,
  configGet,
  commandList,
  authSet,
  authRemove,
  assetUpload,
  assetList,
  assetGet,
  assetDelete,
  arsContextaProviders,
  arsContextaInsights,
  arsContextaHealth,
  arsContextaEntities,
  arsContextaEnrich,
  appSkills,
  agentUpdate,
  agentList,
  agentGet,
  agentCreate
};
