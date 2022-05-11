# vite-plugin-netlify-edge

This plugin helps add support for generating Netlify Edge Functions. This is mostly intended for frameworks that need to generate a catch-all Edge Function to serve all requests.

# Usage

Install the plugin:

```shell
npm i -D @netlify/vite-plugin-netlify-edge
```

Then add the following to your `.vite.config.js`:

```js
// vite.config.js
import { defineConfig } from 'vite'
import netlifyEdge from '@netlify/vite-plugin-netlify-edge'

export default defineConfig({
  plugins: [netlifyEdge()],
})
```

By default, it sets `outDir` to `.netlify/edge-functions/handler`, and generates an Edge Functions manifest that defines the `handler` function for all requests.
Passing a value to `functionName` will override this. This will affect the generated manifest and the base directory for the output, but it will not affect the names of the generated bundles. For this reason you should ensure that your entrypoint file is named the same as the function name.

```js
// vite.config.js

// ...
export default defineConfig({
  plugins: [netlifyEdge({ functionName: 'server' })],
})
```

This generates the file inside `.netlify/edge-functions/server`, and creates a manifest pointing to the `server` function.

### Static file handling

To help with handling static files, it registers a virtual module called `@static-manifest` that exports a `Set` that includes the paths of all files in `publicDir`. This can be used in the handler to identify requests for static files.

You can disable any of this feature by passing options to the `netlifyEdge()` function:

```js
// vite.config.js

// ...
export default defineConfig({
  plugins: [netlifyEdge({ generateEdgeFunctionsManifest: false })],
})
```

You can pass additional static paths to the plugin, so that they are also included. They are paths not filenames, so should include a leading slash and be URL-encoded.

```js
// vite.config.js
import { defineConfig } from 'vite'
import netlifyEdge from '@netlify/vite-plugin-netlify-edge'
import glob from 'fast-glob'

export default defineConfig({
  plugins: [
    netlifyEdge({
      additionalStaticPaths: glob
        .sync('**/*.{js,css}', { cwd: 'dist/client' })
        .map((path) => `/${encodeURI(path)}`),
    }),
  ],
})
```

If you need to add all paths under a directory then it is likely to be more efficient to check the prefix instead of adding all files individually. See the example below, where every path under `/assets/` is served from the CDN.

In order to use this plugin to create Edge Functions you must define an SSR entrypoint:

```js
// handler.js
import { handleRequest } from 'my-framework'
import staticFiles from '@static-manifest'

export const handler = async (request, { next }) => {
  // Handle static files

  const { pathname } = new URL(request.url)

  // If your framework generates client assets in a subdirectory, you can add these too
  if (staticFiles.includes(pathname) || pathname.startsWith('assets/')) {
    return
  }

  // "handleRequest" is defined by your framework
  try {
    return await handleRequest(request)
  } catch (err) {
    return new Response(err.message || 'Internal Server Error', {
      status: err.status || 500,
    })
  }
}
```

You can then build it using the vite CLI:

```shell
vite build --ssr handler.js
```

This will generate the Edge Function `.netlify/edge-functions/handler/handler.js` and a manifest file `.netlify/edge-functions/manifest.json` that defines the `handler` function.
