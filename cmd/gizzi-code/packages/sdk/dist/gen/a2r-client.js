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
var pathGet = (options) => (options?.client ?? client).get({ url: "/path", ...options });
var vcsGet = (options) => (options?.client ?? client).get({ url: "/vcs", ...options });
var lspStatus = (options) => (options?.client ?? client).get({ url: "/lsp", ...options });
var formatterStatus = (options) => (options?.client ?? client).get({ url: "/formatter", ...options });
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
var getV1MemorySearch = (options) => (options?.client ?? client).get({ url: "/memory/search", ...options });
var putV1MemoryByFilename = (options) => (options.client ?? client).put({
  url: "/memory/{filename}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
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
var globalHealth = (options) => (options?.client ?? client).get({ url: "/global/health", ...options });
var globalEvent = (options) => (options?.client ?? client).sse.get({ url: "/global/event", ...options });
var globalVersion = (options) => (options?.client ?? client).get({ url: "/global/version", ...options });
var projectList = (options) => (options?.client ?? client).get({ url: "/project/list", ...options });
var projectGet = (options) => (options.client ?? client).get({ url: "/project/{projectID}", ...options });
var projectUpdate = (options) => (options.client ?? client).patch({
  url: "/project/{projectID}",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var toolIds = (options) => (options?.client ?? client).get({ url: "/experimental/tool/ids", ...options });
var toolList = (options) => (options?.client ?? client).get({ url: "/experimental/tool", ...options });
var worktreeRemove = (options) => (options.client ?? client).delete({
  url: "/experimental/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var worktreeCreate = (options) => (options.client ?? client).post({
  url: "/experimental/worktree",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var worktreeReset = (options) => (options?.client ?? client).post({ url: "/experimental/worktree/reset", ...options });
var sessionListGlobal = (options) => (options?.client ?? client).get({ url: "/experimental/session/global", ...options });
var mcpListResources = (options) => (options?.client ?? client).get({ url: "/experimental/mcp/resources", ...options });
var experimentalResourceList = (options) => (options?.client ?? client).get({ url: "/experimental/resource/list", ...options });
var tuiAppendPrompt = (options) => (options.client ?? client).post({
  url: "/tui/append-prompt",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiOpenHelp = (options) => (options?.client ?? client).post({ url: "/tui/open-help", ...options });
var tuiOpenSessions = (options) => (options?.client ?? client).post({ url: "/tui/open-sessions", ...options });
var tuiOpenThemes = (options) => (options?.client ?? client).post({ url: "/tui/open-themes", ...options });
var tuiOpenModels = (options) => (options?.client ?? client).post({ url: "/tui/open-models", ...options });
var tuiSubmitPrompt = (options) => (options?.client ?? client).post({ url: "/tui/submit-prompt", ...options });
var tuiClearPrompt = (options) => (options?.client ?? client).post({ url: "/tui/clear-prompt", ...options });
var tuiExecuteCommand = (options) => (options.client ?? client).post({
  url: "/tui/execute-command",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiShowToast = (options) => (options.client ?? client).post({
  url: "/tui/show-toast",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiPublish = (options) => (options.client ?? client).post({
  url: "/tui/publish",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiSelectSession = (options) => (options.client ?? client).post({
  url: "/tui/select-session",
  ...options,
  headers: {
    "Content-Type": "application/json",
    ...options.headers
  }
});
var tuiControlNext = (options) => (options?.client ?? client).get({ url: "/tui/control/next", ...options });
var tuiControlResponse = (options) => (options.client ?? client).post({
  url: "/tui/control/response",
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

// packages/sdk/dist/gen/a2r-client.ts
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
      throw new Error(`No SDK client found. Create one with "new A2RClient()" to fix this error.`);
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

class ExperimentalResource extends HeyApiClient {
  list(options) {
    return experimentalResourceList({ ...options, client: this.client });
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

class Experimental extends HeyApiClient {
  _resource;
  get resource() {
    return this._resource ??= new ExperimentalResource({ client: this.client });
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
  sync(options) {
    return instanceSync({ ...options, client: this.client });
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
  listresources(options) {
    return mcpListResources({ ...options, client: this.client });
  }
  remove(options) {
    return mcpRemove({ ...options, client: this.client });
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
  list(options) {
    return projectList({ ...options, client: this.client });
  }
  update(options) {
    return projectUpdate({ ...options, client: this.client });
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
  _evals;
  get evals() {
    return this._evals ??= new SkillEvals({ client: this.client });
  }
}

class Terminal extends HeyApiClient {
  _clerk;
  get clerk() {
    return this._clerk ??= new TerminalClerk({ client: this.client });
  }
}

class Tool extends HeyApiClient {
  ids(options) {
    return toolIds({ ...options, client: this.client });
  }
  list(options) {
    return toolList({ ...options, client: this.client });
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

class Worktree extends HeyApiClient {
  create(options) {
    return worktreeCreate({ ...options, client: this.client });
  }
  remove(options) {
    return worktreeRemove({ ...options, client: this.client });
  }
  reset(options) {
    return worktreeReset({ ...options, client: this.client });
  }
}

class A2RClient extends HeyApiClient {
  static __registry = new HeyApiRegistry;
  constructor(args) {
    super(args);
    A2RClient.__registry.set(this, args?.key);
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
  _event;
  get event() {
    return this._event ??= new Event({ client: this.client });
  }
  _experimental;
  get experimental() {
    return this._experimental ??= new Experimental({ client: this.client });
  }
  _file;
  get file() {
    return this._file ??= new File({ client: this.client });
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
  _tool;
  get tool() {
    return this._tool ??= new Tool({ client: this.client });
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
  _worktree;
  get worktree() {
    return this._worktree ??= new Worktree({ client: this.client });
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
function createA2RClient(config) {
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
  return new A2RClient({ client: clientInstance });
}
export {
  createA2RClient,
  A2RClient
};
