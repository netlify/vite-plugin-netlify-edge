import type { Plugin, ResolvedConfig } from 'vite'

import fs from 'fs'
import path from 'path'
import glob from 'fast-glob'

export interface NetlifyEdgePluginOptions {
  generateStaticManifest?: boolean
  generateEdgeFunctionsManifest?: boolean
  additionalStaticPaths?: Array<string>
  functionName?: string
}

const staticManifestModuleId = '@static-manifest'
const resolvedStaticManifestModuleId = '\0' + staticManifestModuleId
const edgeFunctionsDir = '.netlify/edge-functions'
const DEFAULT_FUNCTION_NAME = 'handler'

const netlifyEdge = ({
  generateStaticManifest = true,
  generateEdgeFunctionsManifest = true,
  additionalStaticPaths = [],
  functionName = DEFAULT_FUNCTION_NAME,
}: NetlifyEdgePluginOptions = {}): Plugin => {
  let resolvedConfig: ResolvedConfig
  let originalPublicDir: string

  return {
    name: 'vite-plugin-netlify-edge',
    config(config) {
      if (config.build?.ssr) {
        originalPublicDir = config.publicDir || 'public'
        config.build.outDir ||= path.join(edgeFunctionsDir, functionName)
        return {
          publicDir: false,
          // The types for `ssr` are omitted because it's marked as alpha, but it's still used
          ssr: {
            target: 'webworker',
            noExternal: true,
          },
          build: {
            rollupOptions: {
              output: {
                format: 'es',
              },
            },
          },
        }
      }
    },
    configResolved(config) {
      resolvedConfig = config
    },
    resolveId(id) {
      if (generateStaticManifest && id === staticManifestModuleId) {
        return resolvedStaticManifestModuleId
      }
    },
    load(id) {
      if (generateStaticManifest && id === resolvedStaticManifestModuleId) {
        const files = glob
          .sync('**/*', {
            cwd: path.resolve(resolvedConfig.root, originalPublicDir),
          })
          .map((file) => `${resolvedConfig.base}${encodeURIComponent(file)}`)

        return `export default new Set(${JSON.stringify([
          ...files,
          ...additionalStaticPaths,
        ])})`
      }
    },
    writeBundle(options) {
      // If we're writing to the internal edge functions dir we need to write a manifest
      if (
        generateEdgeFunctionsManifest &&
        resolvedConfig.build.ssr &&
        // Edge Functions can either be in a subdirectory or directly in the edge functions dir
        (options.dir?.endsWith(edgeFunctionsDir) ||
          options.dir?.endsWith(path.join(edgeFunctionsDir, functionName)))
      ) {
        const manifest = {
          functions: [{ function: functionName, path: '/*' }],
          version: 1,
        }
        // Write the manifest to the edge functions directory
        fs.writeFileSync(
          path.join(resolvedConfig.root, edgeFunctionsDir, 'manifest.json'),
          JSON.stringify(manifest),
          'utf-8'
        )
      }
    },
  }
}

export default netlifyEdge
