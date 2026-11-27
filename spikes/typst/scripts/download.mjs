// Download one file: node scripts/download.mjs <url> <outfile>
import { writeFile } from 'node:fs/promises'

const [url, out] = process.argv.slice(2)
const res = await fetch(url)
if (!res.ok) throw new Error(`Download failed: ${res.status} ${url}`)
await writeFile(out, Buffer.from(await res.arrayBuffer()))
console.log(`Saved ${out}`)
