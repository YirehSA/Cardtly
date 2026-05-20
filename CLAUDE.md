# Cardtly

Digital business card platform. Live at cardtly.com.

## Stack
- Next.js 15 (App Router)
- Supabase (database + auth)
- Vercel (hosting)
- Paystack (subscriptions)
- Resend (email, verified domain cardtly.com, sends from noreply@cardtly.com)

## Commands
- npm run dev — local dev server
- npm run build — production build
- ./node_modules/.bin/tsc --noEmit — type check

## Conventions
- Card design settings live as JSON in the cards.color_theme column, parsed via parseDesign() in types/design.ts
- The cards and team_cards tables have columns (image_X_link, button colour fields) not in the auto-generated database.ts types. TypeScript warnings about these are expected noise, not real errors.
- Personal and team cards share the same PublicCardView and TemplatedCardPreview components
- ON CONFLICT in Supabase SQL needs an explicit unique constraint on the target column
- Tio (tio@cardtly.com, UUID 255ee7e3-939b-40bf-b86e-1d7eea4d311f) has a comped Pro account with a 5-seat team org

## Workflow
- Create a git tag before risky changes: working-state-YYYY-MM-DD (letter suffix for multiple per day)
- Build complete, ready-to-run changes directly. Don't ask excessive upfront questions.
- If doing an unrequested rebuild, flag it and offer a revert option.
- User preference: no em dashes anywhere in code, comments, or commit messages
