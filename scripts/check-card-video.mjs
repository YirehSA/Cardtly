// The video section on a card (Andre, 2026-11-02).
//
// WHAT THIS PROTECTS:
//   1. lib/card-video recognises one video on YouTube, Vimeo, TikTok, Loom,
//      Wistia or Dailymotion, in the shapes people paste, and nothing else:
//      not a lookalike host, not a javascript: link, not an id of the wrong
//      shape. The player address is built from the id alone and always points
//      at that platform's player, so a card row can never frame another page.
//   2. Every one of the sixteen templates places the video once, under its bio
//      and above its contacts, and only for Pro with the switch on.
//   3. The picture comes from the platform: /api/video/thumb redirects only to
//      the platform's own image host, and the editor's check is signed in only
//      and follows a TikTok share link to TikTok and nowhere else.
//   4. It is each card's own content (migration 099, both tables), saved by
//      both editors, carried when a card moves into a team, waited for before
//      099 runs, and its players are allowed by the CSP.
//
// Run: node scripts/check-card-video.mjs

import { execFileSync } from 'node:child_process'
import { mkdtempSync, rmSync, renameSync, readFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { pathToFileURL } from 'node:url'

let fail = 0
const bad = (msg) => { console.error(`  FAIL ${msg}`); fail++ }
const read = (p) => { try { return readFileSync(p, 'utf8').replace(/\r/g, '') } catch { return '' } }

// ── 1. The links, run ───────────────────────────────────────────────────────
const out = mkdtempSync(join(tmpdir(), 'card-video-'))
let V
try {
  execFileSync(process.execPath,
    ['node_modules/typescript/bin/tsc', 'lib/card-video.ts', '--outDir', out,
     '--module', 'es2020', '--target', 'es2020', '--moduleResolution', 'node'],
    { stdio: 'pipe' })
  renameSync(join(out, 'card-video.js'), join(out, 'card-video.mjs'))
  V = await import(pathToFileURL(join(out, 'card-video.mjs')).href)
} catch (e) {
  console.error('check-card-video: could not compile lib/card-video.ts')
  console.error(String(e?.stderr || e?.message || e))
  process.exit(1)
} finally {
  try { rmSync(out, { recursive: true, force: true }) } catch {}
}

const yes = [
  // [pasted, provider, id, portrait]
  ['https://www.youtube.com/watch?v=aqz-KE-bpKQ', 'youtube', 'aqz-KE-bpKQ', false],
  ['youtube.com/watch?v=aqz-KE-bpKQ&list=PL123&index=2', 'youtube', 'aqz-KE-bpKQ', false],
  ['https://youtu.be/aqz-KE-bpKQ?si=abc', 'youtube', 'aqz-KE-bpKQ', false],
  ['https://m.youtube.com/watch?v=aqz-KE-bpKQ', 'youtube', 'aqz-KE-bpKQ', false],
  ['https://www.youtube.com/shorts/aqz-KE-bpKQ', 'youtube', 'aqz-KE-bpKQ', true],
  ['https://www.youtube.com/embed/aqz-KE-bpKQ', 'youtube', 'aqz-KE-bpKQ', false],
  ['https://www.youtube.com/live/aqz-KE-bpKQ', 'youtube', 'aqz-KE-bpKQ', false],
  ['https://www.youtube-nocookie.com/embed/aqz-KE-bpKQ', 'youtube', 'aqz-KE-bpKQ', false],
  ['https://music.youtube.com/watch?v=aqz-KE-bpKQ', 'youtube', 'aqz-KE-bpKQ', false],
  ['https://vimeo.com/1084537', 'vimeo', '1084537', false],
  ['https://vimeo.com/1084537/ab12cd34ef', 'vimeo', '1084537', false],
  ['https://player.vimeo.com/video/1084537?h=ab12cd34ef', 'vimeo', '1084537', false],
  ['https://vimeo.com/channels/staffpicks/1084537', 'vimeo', '1084537', false],
  ['https://www.tiktok.com/@scout2015/video/6718335390845095173', 'tiktok', '6718335390845095173', true],
  ['https://m.tiktok.com/v/6718335390845095173.html', 'tiktok', '6718335390845095173', true],
  ['https://www.loom.com/share/0123456789abcdef0123456789abcdef', 'loom', '0123456789abcdef0123456789abcdef', false],
  ['https://acme.wistia.com/medias/abcde12345', 'wistia', 'abcde12345', false],
  ['https://fast.wistia.net/embed/iframe/abcde12345', 'wistia', 'abcde12345', false],
  ['https://www.dailymotion.com/video/x7tgad0_my-title', 'dailymotion', 'x7tgad0', false],
  ['https://dai.ly/x7tgad0', 'dailymotion', 'x7tgad0', false],
]
for (const [raw, provider, id, portrait] of yes) {
  const v = V.parseVideoUrl(raw)
  if (!v) { bad(`${raw} is not recognised`); continue }
  if (v.provider !== provider || v.id !== id) bad(`${raw} read as ${v.provider} ${v.id}`)
  if (v.portrait !== portrait) bad(`${raw} is ${v.portrait ? 'upright' : 'wide'}, and should not be`)
  if (!V.PLAYER_ORIGINS.some(o => v.embedUrl.startsWith(o + '/'))) bad(`${raw} plays from ${v.embedUrl}, not a platform player`)
  if (v.posterPlayerUrl && !V.PLAYER_ORIGINS.some(o => v.posterPlayerUrl.startsWith(o + '/'))) bad(`${raw} shows a player from ${v.posterPlayerUrl}`)
  if (!v.embedUrl.includes(id)) bad(`${raw}'s player does not carry its id`)
  if (!V.parseVideoUrl(v.watchUrl) || V.parseVideoUrl(v.watchUrl).id !== id) bad(`${raw}'s stored link does not read back as the same video`)
}
const start = V.parseVideoUrl('https://youtu.be/aqz-KE-bpKQ?t=1m30s')
if (!start || !/start=90\b/.test(start.embedUrl)) bad('a YouTube start time (t=1m30s) is not kept')
const unlisted = V.parseVideoUrl('https://vimeo.com/1084537/ab12cd34ef')
if (!unlisted || !/h=ab12cd34ef/.test(unlisted.embedUrl)) bad('an unlisted Vimeo video loses the hash it needs to play')
const tt = V.parseVideoUrl('https://www.tiktok.com/@scout2015/video/6718335390845095173')
if (!tt?.posterPlayerUrl || !/autoplay=0/.test(tt.posterPlayerUrl)) bad('TikTok, which gives no picture, does not show its own player, not started')

const no = [
  '', 'hello', 'javascript:alert(1)', 'data:text/html,<b>x</b>', 'ftp://youtube.com/watch?v=aqz-KE-bpKQ',
  'https://youtube.com.evil.example/watch?v=aqz-KE-bpKQ', 'https://evilyoutube.com/watch?v=aqz-KE-bpKQ',
  'https://www.youtube.com/watch?v=short', 'https://www.youtube.com/watch?v=aqz-KE-bpKQ"><script>',
  'https://www.youtube.com/@cardtly', 'https://vimeo.com/about', 'https://player.vimeo.com/api/1084537',
  'https://www.tiktok.com/@scout2015', 'https://www.loom.com/share/not-hex', 'https://example.com/video.mp4',
  'https://www.youtube.com/watch?v=aqz-KE-bpKQ ' + 'x'.repeat(10), 'https://' + 'a'.repeat(600) + '.com',
  // Well-formed but too long, and with a space inside: both refused whole.
  'https://youtu.be/aqz-KE-bpKQ?x=' + 'a'.repeat(600), 'https://youtu.be/aqz-KE-bpKQ?a= b',
]
for (const raw of no) {
  if (V.parseVideoUrl(raw)) bad(`${JSON.stringify(raw.slice(0, 80))} is taken for a video`)
}
if (!V.isShortVideoLink('https://vm.tiktok.com/ZMabc123/') || !V.isShortVideoLink('vt.tiktok.com/ZSabc/')) bad('a TikTok share link is not recognised as one to follow')
if (V.isShortVideoLink('https://bit.ly/abc')) bad('a link shortener that is not TikTok would be followed')
if (V.isTikTokAddress('https://evil.example/') || V.isTikTokAddress('http://www.tiktok.com/x') || V.isTikTokAddress('https://tiktok.com.evil.example/')) bad('a TikTok share link may be followed away from TikTok')
if (!V.isPlatformThumb('vimeo', 'https://i.vimeocdn.com/video/1-d_960')) bad('a Vimeo picture is refused')
for (const [p, u] of [['vimeo', 'https://evil.example/x.jpg'], ['vimeo', 'http://i.vimeocdn.com/x.jpg'], ['loom', 'https://loom.com.evil.example/x.jpg'], ['wistia', 'javascript:alert(1)']]) {
  if (V.isPlatformThumb(p, u)) bad(`/api/video/thumb would send a visitor to ${u}`)
}

// ── 2. The card ─────────────────────────────────────────────────────────────
const card = read('components/card/PublicCardView.tsx')
if (!/const videoUrl = isPro && \(card as any\)\.show_video !== false \?/.test(card)) bad('the video shows on a free card, or with the switch off')
const branches = [...card.matchAll(/\n  if \(design\.templateId === '([a-z]+)'\) \{/g)].map(m => ({ id: m[1], at: m.index }))
if (branches.length !== 16) bad(`PublicCardView has ${branches.length} template branches; this check knows sixteen`)
branches.forEach((b, i) => {
  const body = card.slice(b.at, i + 1 < branches.length ? branches[i + 1].at : card.indexOf('\n  return null', b.at))
  const calls = body.match(/videoSection\(/g) || []
  if (calls.length !== 1) { bad(`${b.id} places the video ${calls.length} times`); return }
  const video = body.indexOf('videoSection(')
  const bio = body.indexOf('card.bio')
  const bottom = body.indexOf('<BottomSection')
  if (bio < 0 || video < bio) bad(`${b.id} places the video above the bio`)
  if (bottom >= 0 && video > bottom) bad(`${b.id} places the video below the links and gallery`)
})
const comp = read('components/card/CardVideo.tsx')
if (!/if \(!video\) return null/.test(comp)) bad('CardVideo draws something for a link it does not recognise')
if (!/src=\{playing \? video\.embedUrl : video\.posterPlayerUrl!\}/.test(comp) || /<iframe[^>]*src=\{url\}/.test(comp)) bad('the player address does not come from lib/card-video')
if (!/referrerPolicy="strict-origin-when-cross-origin"/.test(comp)) bad('the player sends no referrer, and YouTube refuses to play without one')

// ── 3. The routes ───────────────────────────────────────────────────────────
const thumb = read('app/api/video/thumb/route.ts')
if (!/isPlatformThumb\(ref\.provider, data\?\.thumbnail_url\)/.test(thumb)) bad('/api/video/thumb redirects without checking the picture is on the platform')
if (/NextResponse\.redirect\((?!picture)/.test(thumb)) bad('/api/video/thumb redirects to something other than the checked picture')
if (!/const keep = ref\.provider === 'tiktok'\n\s+\? 'public, max-age=\d+, s-maxage=\d+[^']*'\n\s+: 'public, max-age=\d+, s-maxage=\d+[^']*'/.test(thumb)) bad('/api/video/thumb is not kept by the CDN, so every view asks the platform')
const preview = read('app/api/video/preview/route.ts')
if (!/if \(!user\) return NextResponse\.json\(\{ error: 'Not signed in' \}, \{ status: 401 \}\)/.test(preview)) bad('/api/video/preview fetches for anybody, signed in or not')
if (!/if \(!isTikTokAddress\(at\)\) return null/.test(preview) || !/redirect: 'manual'/.test(preview)) bad('/api/video/preview follows a share link without checking every hop stays on TikTok')
if (!/res\.status === 400 \|\| res\.status === 401 \|\| res\.status === 403 \|\| res\.status === 404/.test(preview)) bad('a private, deleted or embed-blocked video is accepted')

// ── 4. Storing it ───────────────────────────────────────────────────────────
const mig = read('supabase/migrations/099_card_video.sql')
for (const t of ['cards', 'team_cards']) {
  const m = new RegExp(`alter table public\\.${t}\\s+add column if not exists video_url text,\\s+add column if not exists video_title text,\\s+add column if not exists show_video boolean not null default true;`).test(mig)
  if (!m) bad(`migration 099 does not give ${t} video_url, video_title and show_video (on by default)`)
}
if (!/video_url video_title show_video/.test(read('lib/move-card-to-team.ts'))) bad('a personal card moving into a team would refuse over its video, or lose it')
if (!/key === 'video_url' \|\| key === 'video_title' \|\| key === 'show_video'/.test(read('components/card/CardEditor.tsx'))) bad('saving a personal card fails outright before migration 099 runs')
if (!/key === 'video_url' \|\| key === 'video_title' \|\| key === 'show_video'/.test(read('app/api/team/card/save/route.ts'))) bad('saving a team card fails outright before migration 099 runs')
const personal = read('components/card/CardEditor.tsx')
if (!/<VideoField disabled=\{!pro\}/.test(personal) || !/show_video:\s+\(card as any\)\?\.show_video !== false/.test(personal)) bad('the personal editor has no video section, or offers it to a free plan')
const team = read('components/team/TeamCardEditor.tsx')
if (!/<VideoField /.test(team) || !/show_video:\s+\(card as any\)\.show_video !== false/.test(team)) bad('the team card editor has no video section')
// Not in the design: touching a team card's design takes it off the look.
if (/video/i.test(read('types/design.ts').split('export interface CardDesign')[1]?.split('\n}')[0] || '')) bad('the video moved into the design JSON, where adding one takes a team card off its look')
const cfg = read('next.config.js')
const frame = /"frame-src ([^"]*)"/.exec(cfg)?.[1] || ''
for (const o of V.PLAYER_ORIGINS) if (!frame.includes(o)) bad(`the CSP's frame-src does not allow ${o}`)
const img = /"img-src ([^"]*)"/.exec(cfg)?.[1] || ''
for (const h of ['https://i.ytimg.com', 'https://i.vimeocdn.com', 'https://www.dailymotion.com']) if (!img.includes(h)) bad(`the CSP's img-src does not allow ${h}`)

if (fail) { console.error(`check-card-video: ${fail} problem${fail === 1 ? '' : 's'}`); process.exit(1) }
console.log(`check-card-video: ok (${yes.length} links read right, ${no.length} refused, all 16 templates under the bio, pictures only from the platform)`)
