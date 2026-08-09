import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'
import { cpSync } from 'fs'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const outDir = path.join(__dirname, '../out')
const publicFrontendDir = path.join(__dirname, '../../ultrafreight/public/frontend')
const wwwHtmlPath = path.join(__dirname, '../../ultrafreight/www/transport_frontend.html')
const driverHtmlPath = path.join(__dirname, '../../ultrafreight/www/driver.html')

const srcNextDir = path.join(outDir, '_next')
const destNextDir = path.join(publicFrontendDir, '_next')

if (!fs.existsSync(srcNextDir)) {
  console.error('Build output not found at', srcNextDir)
  process.exit(1)
}

fs.mkdirSync(publicFrontendDir, { recursive: true })
if (fs.existsSync(destNextDir)) {
  fs.rmSync(destNextDir, { recursive: true })
}
cpSync(srcNextDir, destNextDir, { recursive: true })
console.log('Copied _next/ assets to ultrafreight/public/frontend/_next/')

const builtHtmlPath = path.join(outDir, 'index.html')
if (!fs.existsSync(builtHtmlPath)) {
  console.error('Built index.html not found at', builtHtmlPath)
  process.exit(1)
}

let html = fs.readFileSync(builtHtmlPath, 'utf8')
html = html.replace(
  /(<meta name="viewport"[^>]*>)/i,
  '$1\n    <meta name="csrf-token" content="{{ csrf_token }}" />'
)
html = html.replace(
  /<\/body>/i,
  `  <script>window.csrf_token = "{{ csrf_token }}";</script>\n</body>`
)

fs.writeFileSync(wwwHtmlPath, html)
console.log('Updated www/transport_frontend.html')

const driverHtml = html.replace(
  /<title>[^<]*<\/title>/i,
  '<title>Ultra Freight - Driver Portal</title>'
).replace(
  /<\/head>/i,
  `  <script>window.__ULTRAFREIGHT_PORTAL__ = "driver";</script>\n</head>`
)

fs.writeFileSync(driverHtmlPath, driverHtml)
console.log('Updated www/driver.html')
