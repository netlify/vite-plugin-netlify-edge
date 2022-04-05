import type { Plugin, ResolvedConfig } from 'vite'

import fs from 'fs'
import path from 'path'
import glob from 'fast-glob'

export interface NetlifyEdgePluginOptions {
  generateStaticManifest?: boolean
  generateEdgeFunctionsManifest?: boolean
  additionalStaticPaths?: Array<string>
}

const netlifyEdge = ({
  generateStaticManifest = true,
  generateEdgeFunctionsManifest = true,
  additionalStaticPaths = [],
}: NetlifyEdgePluginOptions): Plugin => {
  let resolvedConfig: ResolvedConfig
  let originalPublicDir: string
  const staticManifestModuleId = '@static-manifest'
  const resolvedStaticManifestModuleId = '\0' + staticManifestModuleId
  const edgeFunctionsDir = '.netlify/edge-functions/handler'

  return {
    name: 'vite-plugin-netlify-edge',
    config(config) {
      if (config.build?.ssr) {
        originalPublicDir = config.publicDir || 'public'
        config.build.outDir ||= edgeFunctionsDir
        return {
          publicDir: false,
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
            cwd: path.resolve(originalPublicDir),
          })
          .map((file) => `/${encodeURIComponent(file)}`)

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
        options.dir?.endsWith(edgeFunctionsDir)
      ) {
        const manifest = {
          functions: [{ function: 'handler', path: '/*' }],
          version: 1,
        }
        // Write the manifest to the parent directory of the output directory
        fs.writeFileSync(
          path.resolve(options.dir, '..', 'manifest.json'),
          JSON.stringify(manifest),
          'utf-8'
        )
      }
    },
  }
}

export default netlifyEdge
