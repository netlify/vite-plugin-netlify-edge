import { defineConfig } from 'vite'
import netlifyEdge from '../dist/index.js'

export default defineConfig({
  plugins: [netlifyEdge()],
})
