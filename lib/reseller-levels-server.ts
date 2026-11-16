import { Resend } from 'resend'
import { FROM_EMAIL } from '@/lib/email'
import { COMPANY } from '@/lib/company'
import { sastMonth } from '@/lib/reseller-pricing'
import { adminEmails, programmeManagerEmails } from '@/lib/reseller-programme'
import {
  cardsEverSoldFrom, levelFor, levelProgress, levelRank, progressLine,
  type LevelProgress, type ResellerLevel,
} from '@/lib/reseller-levels'
import { badgePngPath } from '@/lib/reseller-badge'

// The server half of reseller levels (rules in lib/reseller-levels): counting
// cards ever sold, and the two emails. Run from the daily cron.

const PAGE = 1000
const SITE = 'https://www.cardtly.com'

/**
 * Cards ever sold, per reseller. Paged, because reseller_seat_months grows by
 * a row per client per month and PostgREST stops at 1000 rows without saying
 * so. Null when it cannot be read: a level shown from a short count would be
 * wrong in the one direction that upsets a reseller.
 */
export async function cardsEverSold(db: any, resellerIds: string[]): Promise<Record<string, number> | null> {
  const out: Record<string, number> = Object.fromEntries(resellerIds.map(id => [id, 0]))
  if (!resellerIds.length) return out
  const rows: any[] = []
  try {
    for (let from = 0; from < 200000; from += PAGE) {
      const { data, error } = await db.from('reseller_seat_months')
        .select('reseller_id, organization_id, peak_seats, month')
        .in('reseller_id', resellerIds)
        .order('reseller_id', { ascending: true })
        .order('organization_id', { ascending: true })
        .order('month', { ascending: true })
        .range(from, from + PAGE - 1)
      if (error) return null
      rows.push(...(data || []))
      if ((data || []).length < PAGE) break
    }
  } catch {
    return null
  }
  return { ...out, ...cardsEverSoldFrom(rows) }
}

const esc = (v: unknown) => String(v ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')

function wrap(inner: string): string {
  return `<div style="font-family:system-ui,-apple-system,sans-serif;max-width:560px;margin:0 auto;padding:24px;color:#111;line-height:1.5">${inner}</div>`
}

function bar(p: LevelProgress): string {
  const pct = Math.max(2, p.percent)
  const colour = (p.next || p.level).colour
  return `<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="margin:8px 0 4px;border-collapse:collapse"><tr>
    <td width="${pct}%" style="height:10px;background:${colour};border-radius:5px 0 0 5px"></td>
    <td style="height:10px;background:#e5e7eb;border-radius:0 5px 5px 0"></td>
  </tr></table>`
}

function rewardsList(level: ResellerLevel): { html: string; text: string } {
  return {
    html: `<ul style="margin:6px 0 14px;padding-left:20px">${level.rewards.map(r => `<li>${esc(r)}</li>`).join('')}</ul>`,
    text: level.rewards.map(r => `- ${r}`).join('\n'),
  }
}

/** The level's badge, as the PNG in public/badges (mail clients drop SVG). */
const badgeImg = (level: ResellerLevel, px: number) =>
  `<img src="${SITE}${badgePngPath(level.key)}" width="${px}" height="${px}" alt="${esc(level.name)} reseller badge" style="display:block;margin:0 0 14px;border:0">`

const button = (href: string, label: string) =>
  `<p style="margin:18px 0 0"><a href="${href}" style="display:inline-block;background:#111;color:#fff;text-decoration:none;padding:10px 18px;border-radius:8px;font-weight:600">${esc(label)}</a></p>`

/** To the reseller, when it reaches a new level. */
export function levelUpEmail(name: string, p: LevelProgress): { subject: string; html: string; text: string } {
  const r = rewardsList(p.level)
  const next = p.next ? `${p.toNext} more card${p.toNext === 1 ? '' : 's'} to ${p.next.name}.` : 'Platinum is the top level. Thank you.'
  // Bronze is where the public listing starts, and it only shows once they
  // fill it in, so the email says where.
  const listingNote = p.level.key === 'bronze'
    ? 'You can now be listed on cardtly.com, where companies look for a reseller near them. Fill in your listing on your Reseller page, under Listing, and it goes live straight away.'
    : ''
  return {
    subject: `You are now a ${p.level.name} Cardtly reseller`,
    html: wrap(`
      ${badgeImg(p.level, 140)}
      <h2 style="margin:0 0 12px;font-size:20px">Congratulations, ${esc(name)}: you are now ${p.level.name}</h2>
      <p style="margin:0 0 6px">You have sold <strong>${p.cardsSold} cards</strong> through Cardtly, which makes you a ${p.level.name} reseller.</p>
      <p style="margin:12px 0 0;font-weight:600">What ${p.level.name} gives you</p>
      ${r.html}
      ${listingNote ? `<p style="margin:0 0 12px;padding:12px;background:#ecfdf5;border-radius:8px">${esc(listingNote)}</p>` : ''}
      <p style="margin:0">${esc(next)}</p>
      ${p.next ? bar(p) : ''}
      ${listingNote
        ? button(`${SITE}/dashboard/reseller?tab=listing`, 'Fill in your listing')
        : button(`${SITE}/dashboard/reseller`, 'Open your Reseller page')}
      <p style="margin:18px 0 0;font-size:12px;color:#6b7280">Questions? Reply to this email.</p>`),
    text: [
      `Congratulations, ${name}: you are now ${p.level.name}.`,
      `You have sold ${p.cardsSold} cards through Cardtly, which makes you a ${p.level.name} reseller.`,
      '', `What ${p.level.name} gives you:`, r.text, '',
      ...(listingNote ? [listingNote, `Your listing: ${SITE}/dashboard/reseller?tab=listing`, ''] : []),
      next, '',
      `Your Reseller page: ${SITE}/dashboard/reseller`,
    ].join('\n'),
  }
}

/** To Cardtly, so the rewards are actually given. */
export function levelUpStaffEmail(name: string, p: LevelProgress): { subject: string; html: string; text: string } {
  // The listing places them by level by itself (lib/reseller-listing), once
  // they have filled it in and switched it on.
  const todo = p.level.key === 'bronze' || p.level.key === 'silver'
    ? `They can now appear on ${SITE}/find-a-reseller. If they have not filled in their listing (Reseller page, Listing), remind them.`
    : 'Start passing them the leads Cardtly receives in their area, and switch on the exclusive card themes for their clients.'
  const r = rewardsList(p.level)
  return {
    subject: `${name} reached ${p.level.name} (${p.cardsSold} cards sold)`,
    html: wrap(`
      ${badgeImg(p.level, 80)}
      <h2 style="margin:0 0 12px;font-size:20px">${esc(name)} is now a ${p.level.name} reseller</h2>
      <p style="margin:0 0 6px">${p.cardsSold} cards sold in total. They have been emailed.</p>
      <p style="margin:12px 0 0;font-weight:600">What they were told ${p.level.name} gives them</p>
      ${r.html}
      <p style="margin:0;padding:12px;background:#fff3cd;border-radius:8px"><strong>To do:</strong> ${esc(todo)}</p>
      ${button(`${SITE}/admin?tab=resellers`, 'Open Resellers in admin')}`),
    text: [
      `${name} is now a ${p.level.name} reseller (${p.cardsSold} cards sold). They have been emailed.`,
      '', `What they were told ${p.level.name} gives them:`, r.text, '', `To do: ${todo}`,
    ].join('\n'),
  }
}

/** To the reseller, once a month: where they stand. */
export function progressEmail(name: string, p: LevelProgress): { subject: string; html: string; text: string } {
  const subject = p.next
    ? `Your Cardtly reseller level: ${p.level.name}, ${p.toNext} card${p.toNext === 1 ? '' : 's'} to ${p.next.name}`
    : 'Your Cardtly reseller level: Platinum'
  const r = p.next ? rewardsList(p.next) : null
  return {
    subject,
    html: wrap(`
      ${badgeImg(p.level, 96)}
      <h2 style="margin:0 0 12px;font-size:20px">${esc(name)}: you are ${p.level.name}</h2>
      <p style="margin:0">${esc(progressLine(p))}</p>
      ${bar(p)}
      ${p.next && r ? `<p style="margin:14px 0 0;font-weight:600">What ${p.next.name} adds</p>${r.html}` : ''}
      <p style="margin:0">Every client you add, and every seat you give them, counts. Your level is never lost.</p>
      ${button(`${SITE}/dashboard/reseller`, 'Add a client')}
      <p style="margin:18px 0 0;font-size:12px;color:#6b7280">You get this once a month because you resell Cardtly. Questions, or would rather not get it? Reply to this email.</p>`),
    text: [
      `${name}: you are ${p.level.name}.`, progressLine(p), '',
      ...(p.next && r ? [`What ${p.next.name} adds:`, r.text, ''] : []),
      'Every client you add, and every seat you give them, counts. Your level is never lost.',
      `Add a client: ${SITE}/dashboard/reseller`,
    ].join('\n'),
  }
}

async function send(to: string[], mail: { subject: string; html: string; text: string }): Promise<boolean> {
  const key = process.env.RESEND_API_KEY
  const list = [...new Set(to.map(e => String(e || '').trim().toLowerCase()).filter(Boolean))]
  if (!key || !list.length) return false
  try {
    const { error } = await new Resend(key).emails.send({ from: FROM_EMAIL, to: list, replyTo: COMPANY.email, ...mail })
    return !error
  } catch {
    return false
  }
}

/**
 * The daily pass. Announces each new level once (to the reseller and to
 * Cardtly) and sends the monthly progress email on the first run of a month.
 * Both are claimed compare-and-set before sending, so a second run in the same
 * day sends nothing. Needs migration 107; before it, nothing is sent.
 */
export async function checkResellerLevels(db: any, now = new Date()): Promise<{ levelUps: string[]; progress: number; problems: string[] }> {
  const out = { levelUps: [] as string[], progress: 0, problems: [] as string[] }
  const { data: resellers, error } = await db.from('resellers').select('id, name, email, status, level, level_nudged_month')
  if (error) {
    out.problems.push(/level/.test(error.message || '') ? 'Reseller levels need migration 107.' : `could not read resellers: ${error.message}`)
    return out
  }
  const live = (resellers || []).filter((r: any) => r.status !== 'ended')
  const sold = await cardsEverSold(db, live.map((r: any) => r.id))
  if (!sold) { out.problems.push('could not count cards sold'); return out }

  const month = sastMonth(now)
  let staff: string[] | null = null

  for (const r of live) {
    try {
      const p = levelProgress(sold[r.id] || 0)
      let announced = false

      if (levelRank(p.level.key) > levelRank(r.level)) {
        const { data: claimed } = await db.from('resellers')
          .update({ level: p.level.key, level_reached_at: now.toISOString() })
          .eq('id', r.id).eq('level', r.level || 'starter').select('id')
        if (claimed?.length) {
          announced = true
          out.levelUps.push(`${r.name}: ${p.level.name}`)
          await send([r.email], levelUpEmail(r.name, p))
          staff ??= [...await adminEmails(db), ...await programmeManagerEmails(db)]
          await send(staff, levelUpStaffEmail(r.name, p))
        }
      }

      // The monthly email: active resellers only (on hold cannot sell), once a
      // month, skipped in a month whose level-up email already said it.
      if (r.status === 'active' && (!r.level_nudged_month || String(r.level_nudged_month) < month)) {
        let q = db.from('resellers').update({ level_nudged_month: month }).eq('id', r.id)
        q = r.level_nudged_month ? q.eq('level_nudged_month', r.level_nudged_month) : q.is('level_nudged_month', null)
        const { data: claimed } = await q.select('id')
        if (claimed?.length && !announced && await send([r.email], progressEmail(r.name, p))) out.progress++
      }
    } catch (e: any) {
      out.problems.push(`${r.name}: ${e?.message || 'level check failed'}`)
    }
  }
  return out
}
