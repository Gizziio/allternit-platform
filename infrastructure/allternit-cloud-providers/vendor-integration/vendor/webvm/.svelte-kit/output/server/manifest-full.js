export const manifest = (() => {
function __memo(fn) {
	let value;
	return () => value ??= (value = fn());
}

return {
	appDir: "_app",
	appPath: "_app",
	assets: new Set([]),
	mimeTypes: {},
	_: {
		client: {start:"_app/immutable/entry/start.7DR_c9DD.js",app:"_app/immutable/entry/app.zH7Rbfvn.js",imports:["_app/immutable/entry/start.7DR_c9DD.js","_app/immutable/chunks/BYzENXOr.js","_app/immutable/chunks/Bo03LDfb.js","_app/immutable/entry/app.zH7Rbfvn.js","_app/immutable/chunks/CmsKOCeN.js","_app/immutable/chunks/Bo03LDfb.js","_app/immutable/chunks/DJStFLsK.js"],stylesheets:[],fonts:[],uses_env_dynamic_public:false},
		nodes: [
			__memo(() => import('./nodes/0.js')),
			__memo(() => import('./nodes/1.js')),
			__memo(() => import('./nodes/2.js')),
			__memo(() => import('./nodes/3.js'))
		],
		remotes: {
			
		},
		routes: [
			{
				id: "/",
				pattern: /^\/$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 2 },
				endpoint: null
			},
			{
				id: "/alpine",
				pattern: /^\/alpine\/?$/,
				params: [],
				page: { layouts: [0,], errors: [1,], leaf: 3 },
				endpoint: null
			}
		],
		prerendered_routes: new Set([]),
		matchers: async () => {
			
			return {  };
		},
		server_assets: {}
	}
}
})();
