import { defineConfig } from 'vite'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import adonisjs from '@adonisjs/vite/client'

export default defineConfig({
  plugins: [
    react(),
    // React Compiler (D-389)
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
    adonisjs({
      entryPoints: ['inertia/app.tsx', 'inertia/css/app.css'],
      reload: ['resources/views/**/*.edge'],
    }),
  ],

  resolve: {
    alias: {
      '~/': `${import.meta.dirname}/inertia/`,
      '@generated': `${import.meta.dirname}/.adonisjs/client/`,
    },
  },

  server: {
    // The dev server runs inside AdonisJS on app., admin. and ujian. hosts.
    allowedHosts: ['.sigrak.test'],
    watch: {
      ignored: ['**/storage/**', '**/tmp/**'],
    },
  },
})
