export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export interface Database {
  public: {
    Tables: {
      profiles: {
        Row: {
          id: string
          user_id: string
          name: string | null
          bio: string | null
          avatar_url: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name?: string | null
          bio?: string | null
          avatar_url?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          name?: string | null
          bio?: string | null
          avatar_url?: string | null
          updated_at?: string
        }
      }
      cards: {
        Row: {
          id: string
          user_id: string
          org_id: string | null
          organization_id: string | null
          team_id: string | null
          design_variant_id: string | null
          // Identity
          name: string
          title: string | null
          company: string | null
          bio: string | null
          email: string | null
          phone: string | null
          work_phone: string | null
          whatsapp: string | null
          address: string | null
          website: string | null
          // Social (legacy)
          linkedin_url: string | null
          twitter_url: string | null
          instagram_url: string | null
          // Media
          profile_image_url: string | null
          company_logo_url: string | null
          company_logo: string | null
          image_1_url: string | null
          image_2_url: string | null
          image_3_url: string | null
          image_4_url: string | null
          image_5_url: string | null
          image_6_url: string | null
          // Custom links (flat, max 14)
          link_1_title: string | null
          link_1_url: string | null
          link_2_title: string | null
          link_2_url: string | null
          link_3_title: string | null
          link_3_url: string | null
          link_4_title: string | null
          link_4_url: string | null
          link_5_title: string | null
          link_5_url: string | null
          link_6_title: string | null
          link_6_url: string | null
          link_7_title: string | null
          link_7_url: string | null
          link_8_title: string | null
          link_8_url: string | null
          link_9_title: string | null
          link_9_url: string | null
          link_10_title: string | null
          link_10_url: string | null
          link_11_title: string | null
          link_11_url: string | null
          link_12_title: string | null
          link_12_url: string | null
          link_13_title: string | null
          link_13_url: string | null
          link_14_title: string | null
          link_14_url: string | null
          // Extras
          certifications: string | null
          awards: string | null
          specialties: string | null
          // Appearance
          color_theme: string | null
          // State
          slug: string | null
          is_primary: boolean | null
          view_count: number | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id: string
          name: string
          slug?: string | null
          [key: string]: unknown
        }
        Update: {
          [key: string]: unknown
        }
      }
      whop_subscriptions: {
        Row: {
          id: string
          user_id: string | null
          organization_id: string | null
          email: string
          plan_id: string
          subscription_tier: string | null
          billing_cycle: string
          status: string
          receipt_id: string | null
          membership_id: string | null
          whop_membership_id: string | null
          seats: number
          needs_reconciliation: boolean | null
          metadata: Json | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          organization_id?: string | null
          email: string
          plan_id: string
          subscription_tier?: string | null
          billing_cycle?: string
          status?: string
          seats?: number
          needs_reconciliation?: boolean | null
          metadata?: Json | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          status?: string
          subscription_tier?: string | null
          needs_reconciliation?: boolean | null
          updated_at?: string
          [key: string]: unknown
        }
      }
      slug_redirects: {
        Row: {
          id: string
          old_slug: string
          new_slug: string
          card_id: string | null
          created_at: string | null
        }
        Insert: {
          id?: string
          old_slug: string
          new_slug: string
          card_id?: string | null
          created_at?: string | null
        }
        Update: {
          new_slug?: string
        }
      }
      contacts: {
        Row: {
          id: string
          card_id: string
          name: string
          email: string
          phone: string | null
          message: string | null
          source: string | null
          created_at: string
        }
        Insert: {
          id?: string
          card_id: string
          name: string
          email: string
          phone?: string | null
          message?: string | null
          source?: string | null
          created_at?: string
        }
        Update: Record<string, never>
      }
      design_variants: {
        Row: {
          id: string
          name: string
          slug: string
          is_paid: boolean
          is_active: boolean
          created_at: string | null
        }
        Insert: {
          id?: string
          name: string
          slug: string
          is_paid?: boolean
          is_active?: boolean
        }
        Update: {
          is_active?: boolean
        }
      }
    }
  }
}

// Convenience types
export type Profile = Database['public']['Tables']['profiles']['Row']
export type Card = Database['public']['Tables']['cards']['Row']
export type WhopSubscription = Database['public']['Tables']['whop_subscriptions']['Row']
export type SlugRedirect = Database['public']['Tables']['slug_redirects']['Row']
export type Contact = Database['public']['Tables']['contacts']['Row']
export type DesignVariant = Database['public']['Tables']['design_variants']['Row']

// Plan types
// 'free' is legacy: nothing returns it any more. A new account is on a
// 60-day trial that behaves exactly like Pro, and once that runs out with
// no subscription the account is 'expired' and the card stops serving.
export type PlanTier = 'free' | 'pro' | 'expired'

export interface UserPlan {
  tier: PlanTier
  isActive: boolean
  billingCycle?: string
  // True while the account is inside its trial rather than paying.
  isTrial?: boolean
  trialEndsAt?: string | null
  // Whole days left in the trial, floored at 0. Only set while isTrial.
  trialDaysLeft?: number
  // A payment failed and the account is inside its grace window: still fully
  // entitled, but it ends unless the charge succeeds. See PAYMENT_GRACE_DAYS.
  isPastDue?: boolean
  graceEndsAt?: string | null
  graceDaysLeft?: number
  // Entitled because an organisation pays for this person's seat, not because
  // they subscribe themselves. Lets the UI say "covered by your team" rather
  // than showing billing controls that are not theirs to change.
  viaTeam?: boolean
}

// Card with plan context
export interface CardWithPlan extends Card {
  plan: UserPlan
}

// Custom link helper type
export interface CustomLink {
  title: string
  url: string
  index: number // 1-14
}

// Helper to extract links from flat card columns
export function extractLinks(card: Card): CustomLink[] {
  const links: CustomLink[] = []
  for (let i = 1; i <= 14; i++) {
    const title = card[`link_${i}_title` as keyof Card] as string | null
    const url = card[`link_${i}_url` as keyof Card] as string | null
    if (title && url) {
      links.push({ title, url, index: i })
    }
  }
  return links
}
