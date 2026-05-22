import { UserPlan, PlanTier } from '@/types/database'

export type { UserPlan, PlanTier }

export function isPro(plan: UserPlan): boolean {
  return plan.tier === 'pro' && plan.isActive
}

export const PLAN_FEATURES = {
  publicCard: () => true,
  basicQR: () => true,
  oneProfileImage: () => true,
  basicContact: () => true,
  jobTitle: (plan: UserPlan) => isPro(plan),
  bio: (plan: UserPlan) => isPro(plan),
  companyLogo: (plan: UserPlan) => isPro(plan),
  coverPhoto: (plan: UserPlan) => isPro(plan),
  whatsapp: (plan: UserPlan) => isPro(plan),
  address: (plan: UserPlan) => isPro(plan),
  website: () => true,
  socialLinks: (plan: UserPlan) => isPro(plan),
  customLinks: (plan: UserPlan) => isPro(plan),
  gallery: (plan: UserPlan) => isPro(plan),
  certifications: (plan: UserPlan) => isPro(plan),
  designCustomization: (plan: UserPlan) => isPro(plan),
  customSlug: (plan: UserPlan) => isPro(plan),
  brandedQR: (plan: UserPlan) => isPro(plan),
  removeCardtlyBranding: (plan: UserPlan) => isPro(plan),
  emailSignature: (plan: UserPlan) => isPro(plan),
  virtualBackground: (plan: UserPlan) => isPro(plan),
  analytics: (plan: UserPlan) => isPro(plan),
  contactCapture: (plan: UserPlan) => isPro(plan),
} as const

export function generateFreeSlug(firstName: string): string {
  const clean = firstName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
    .slice(0, 20)
  const suffix = Math.random().toString(36).slice(2, 7)
  return `${clean}-${suffix}`
}