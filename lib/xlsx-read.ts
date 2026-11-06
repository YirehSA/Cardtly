import { inflateRawSync } from 'zlib'

// Reading a spreadsheet someone uploaded, whichever program wrote it.
//
// WHY NOT EXCELJS. Reps get their lists from all sorts of tools, and one of the
// first real files could not be opened by it: "Cannot read properties of
// undefined (reading 'sheets')". That workbook wraps every element in a
// namespace prefix (<x:workbook>, <x:sheet>), which is valid, is what the Open
// XML SDK writes, and opens perfectly in Excel. ExcelJS only knows the
// unprefixed spelling. An import that fails on a file Excel opens happily is a
// rep typing it in by hand, which is what the whole feature exists to stop.
//
// All an import needs is the sheets, the rows and the cell values, and that is
// a small job: an .xlsx is a zip of XML. So this reads the zip with Node's own
// inflate and pulls the values out of the XML, ignoring prefixes, styles and
// everything else. Node only (zlib). Kept free of aliases so that
// scripts/check-prospects can compile and run it.

export type CellValue = string | number | null

export interface ReadSheet {
  name: string
  hidden: boolean
  /** Rows in sheet order. Blank rows are kept so row numbers stay meaningful. */
  rows: CellValue[][]
}

/** 40 MB uncompressed. A real contact list is a fraction of that, and a zip that
 *  inflates past it is not a contact list. */
const MAX_INFLATED = 40 * 1024 * 1024

export class SpreadsheetError extends Error {}

function zipEntries(buf: Buffer): Map<string, Buffer> {
  // End of central directory: scan back from the end, past any trailing comment.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i >= buf.length - 66000; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new SpreadsheetError('That file is not an Excel workbook (.xlsx). If it is password protected, remove the password and try again.')

  const count = buf.readUInt16LE(eocd + 10)
  let at = buf.readUInt32LE(eocd + 16)
  const out = new Map<string, Buffer>()
  let total = 0

  for (let n = 0; n < count; n++) {
    if (at + 46 > buf.length || buf.readUInt32LE(at) !== 0x02014b50) break
    const flags = buf.readUInt16LE(at + 8)
    const method = buf.readUInt16LE(at + 10)
    const compressed = buf.readUInt32LE(at + 20)
    const nameLen = buf.readUInt16LE(at + 28)
    const extraLen = buf.readUInt16LE(at + 30)
    const commentLen = buf.readUInt16LE(at + 32)
    const local = buf.readUInt32LE(at + 42)
    const name = buf.toString('utf8', at + 46, at + 46 + nameLen)
    at += 46 + nameLen + extraLen + commentLen

    // Only the parts this reads, so a large embedded image costs nothing.
    if (!/^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/i.test(name)) continue
    if (flags & 1) throw new SpreadsheetError('That workbook is encrypted. Remove the password and try again.')
    if (local + 30 > buf.length) continue

    const start = local + 30 + buf.readUInt16LE(local + 26) + buf.readUInt16LE(local + 28)
    const raw = buf.subarray(start, start + compressed)
    const data = method === 0 ? raw : method === 8 ? inflateRawSync(raw, { maxOutputLength: MAX_INFLATED }) : null
    if (!data) continue
    total += data.length
    if (total > MAX_INFLATED) throw new SpreadsheetError('That workbook is too large to import.')
    out.set(name, data)
  }
  return out
}

const decode = (s: string): string =>
  s.replace(/&(#x?[0-9a-f]+|amp|lt|gt|quot|apos);/gi, (m, e: string) => {
    const k = e.toLowerCase()
    if (k === 'amp') return '&'
    if (k === 'lt') return '<'
    if (k === 'gt') return '>'
    if (k === 'quot') return '"'
    if (k === 'apos') return "'"
    const code = k[1] === 'x' ? parseInt(k.slice(2), 16) : parseInt(k.slice(1), 10)
    return Number.isFinite(code) && code > 0 && code <= 0x10ffff ? String.fromCodePoint(code) : m
  })

/** <x:row> becomes <row>. Attributes keep their prefixes, because r:id is read. */
const unprefixed = (xml: string) => xml.replace(/<(\/?)[A-Za-z_][\w.-]*:/g, '<$1')

const attr = (tag: string, name: string): string | null => {
  const m = tag.match(new RegExp(`\\s${name}\\s*=\\s*("([^"]*)"|'([^']*)')`))
  return m ? decode(m[2] ?? m[3] ?? '') : null
}

const allText = (xml: string): string =>
  [...xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '').matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)].map(m => decode(m[1])).join('')

function columnIndex(ref: string | null, fallback: number): number {
  const letters = ref?.match(/^[A-Z]+/i)?.[0]
  if (!letters) return fallback
  let n = 0
  for (const ch of letters.toUpperCase()) n = n * 26 + ch.charCodeAt(0) - 64
  return n - 1
}

function readRows(xml: string, shared: string[]): CellValue[][] {
  const rows: CellValue[][] = []
  for (const r of xml.matchAll(/<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const num = Number(attr(` ${r[1]}`, 'r'))
    const cells: CellValue[] = []
    for (const c of (r[2] || '').matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const a = ` ${c[1]}`
      const body = c[2] || ''
      const type = attr(a, 't')
      const col = columnIndex(attr(a, 'r'), cells.length)
      const v = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1]
      let value: CellValue = null
      if (type === 's') value = v !== undefined ? shared[Number(v)] ?? null : null
      else if (type === 'inlineStr') value = allText(body)
      else if (type === 'str') value = v !== undefined ? decode(v) : null
      else if (type === 'b') value = v === '1' ? 'TRUE' : 'FALSE'
      else if (type === 'e') value = null
      else if (v !== undefined && v !== '') {
        const n = Number(v)
        value = Number.isFinite(n) ? n : decode(v)
      }
      if (value === '') value = null
      while (cells.length < col) cells.push(null)
      cells[col] = value
    }
    if (Number.isFinite(num) && num > 0) {
      while (rows.length < num - 1) rows.push([])
      rows[num - 1] = cells
    } else {
      rows.push(cells)
    }
  }
  return rows
}

export function readWorkbook(file: Buffer): ReadSheet[] {
  let parts: Map<string, Buffer>
  try {
    parts = zipEntries(file)
  } catch (e) {
    if (e instanceof SpreadsheetError) throw e
    throw new SpreadsheetError('That file could not be read as an Excel workbook.')
  }
  const get = (name: string) => {
    for (const [k, v] of parts) if (k.toLowerCase() === name.toLowerCase()) return unprefixed(v.toString('utf8'))
    return null
  }

  const wb = get('xl/workbook.xml')
  const rels = get('xl/_rels/workbook.xml.rels')
  if (!wb || !rels) throw new SpreadsheetError('That file is not an Excel workbook (.xlsx).')

  const targets = new Map<string, string>()
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], 'Id')
    const target = attr(m[0], 'Target')
    if (id && target) targets.set(id, target)
  }

  const sharedXml = get('xl/sharedStrings.xml')
  const shared = sharedXml ? [...sharedXml.matchAll(/<si\b[^>]*>([\s\S]*?)<\/si>|<si\b[^>]*\/>/g)].map(m => allText(m[1] || '')) : []

  const out: ReadSheet[] = []
  for (const m of wb.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], 'name') || 'Sheet'
    const id = attr(m[0], 'r:id')
    const target = id ? targets.get(id) : null
    if (!target) continue
    const path = target.startsWith('/') ? target.slice(1) : `xl/${target.replace(/^\.\//, '')}`
    const xml = get(path)
    if (!xml) continue
    out.push({ name, hidden: !!attr(m[0], 'state') && attr(m[0], 'state') !== 'visible', rows: readRows(xml, shared) })
  }
  if (out.length === 0) throw new SpreadsheetError('That workbook has no sheets to read.')
  return out
}
