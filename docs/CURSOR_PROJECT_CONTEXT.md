# CURSOR PROJECT CONTEXT — BARTER MARKETPLACE

> Working title: **Baddelha / بدّلها**  
> This is a temporary project name and can be changed later.  
> This file is the primary product and technical context for Cursor before implementation begins.

---

## 1. Document Purpose

This document defines the product vision, user experience, business rules, technical architecture, development principles, and MVP scope for a modern barter marketplace.

Cursor must read this file before planning or changing the project.

Do not attempt to build the entire platform in one step. Work phase by phase, preserve the business rules in this document, and always inspect the existing repository before making changes.

---

## 2. Product Vision

Build a beautiful, enjoyable, trustworthy marketplace where people exchange products directly instead of buying and selling with money.

The experience should feel simpler and more entertaining than a traditional classifieds website.

A user can:

1. Publish an item they own.
2. Explain what they would like to receive in exchange.
3. Browse items published by other users.
4. Offer one or more of their own items in exchange.
5. Receive, reject, accept, withdraw, or counter an offer.
6. Chat within the platform while negotiating.
7. Agree on delivery, shipping, or an in-person exchange.
8. Confirm completion.
9. Review the other party.

The product is not an e-commerce store. Its central interaction is:

> **“I have this. What can I get for it?”**

The website must make discovering possible exchanges feel fun, fast, visual, and safe.

---

## 3. Core Product Principles

### 3.1 Barter First

The MVP must not depend on monetary payment.

No checkout, payment gateway, wallet, balance, cash top-up, or platform-held money is required in the MVP.

Users exchange products for products.

A future version may support optional service fees, delivery payments, or hybrid offers, but those must not be introduced unless explicitly approved.

### 3.2 Easy to Understand

A first-time visitor should understand the concept within a few seconds.

Primary calls to action should use simple language such as:

- أضف منتجك
- اكتشف المقايضات
- قدّم عرض مقايضة
- شاهد العروض
- اقترح بديلًا
- تم الاتفاق

Avoid complicated marketplace terminology.

### 3.3 Visual and Enjoyable

The experience should feel playful, polished, and modern without becoming childish.

Use:

- Large product imagery
- Rounded surfaces
- Clear cards
- Friendly empty states
- Smooth micro-interactions
- Subtle celebratory motion after a successful match
- Strong visual separation between “your item” and “their item”
- Clear exchange arrows and comparison layouts

### 3.4 Trust and Safety

The platform must clearly communicate trust.

Important trust features include:

- Verified email
- Optional verified phone in a later phase
- User rating and completed exchange count
- Item moderation
- User and item reporting
- Block user
- Safe meeting guidance
- Exact address hidden from public pages
- In-platform messaging
- Audit history for important status changes

### 3.5 Mobile Is Not a Smaller Desktop

The mobile version must feel like a native marketplace application.

Desktop and mobile use the same backend, domain logic, and URLs where practical, but their layouts and interaction patterns may differ significantly.

---

## 4. Target Users

### 4.1 Guest

A guest can:

- View the landing page
- Browse active items
- Search and filter
- View public item details
- View public user trust information
- Register or log in

A guest cannot:

- Publish an item
- Create an offer
- Chat
- Favorite items
- Complete a trade

### 4.2 Registered User

A registered user can act as both an item owner and an interested trader.

There is no separate buyer and seller role.

A registered user can:

- Manage a profile
- Publish and manage items
- Save favorites
- Send barter offers
- Receive barter offers
- Counter, accept, reject, withdraw, or cancel offers according to status
- Chat in offer conversations
- Manage active exchanges
- Confirm exchange completion
- Review another user
- Report an item, user, or conversation

### 4.3 Administrator

An administrator can:

- Moderate items
- Approve, reject, hide, or archive listings
- Manage categories
- View users and user reports
- Suspend or reactivate users
- Review reported conversations where legally and operationally permitted
- Manage platform content and safety notices
- View operational analytics
- View the audit trail for critical actions

---

## 5. Main User Journeys

## 5.1 Publish an Item

1. User taps or clicks “أضف منتجك”.
2. User uploads product images.
3. User enters:
   - Title
   - Description
   - Category
   - Condition
   - City and general area
   - Exchange preference
   - Desired categories or item description
   - Whether they are open to any reasonable offer
4. User previews the listing.
5. User publishes it.
6. Depending on moderation settings, the item becomes:
   - `PENDING_REVIEW`, or
   - `ACTIVE`
7. User receives a notification when approved, rejected, or requiring edits.

The creation experience should be a guided multi-step flow on mobile and a spacious form with live preview on desktop.

## 5.2 Discover an Item

Users can discover items through:

- Personalized home feed
- Categories
- Search
- City or area
- Item condition
- “Open to any offer”
- Desired item category
- Recently added
- Popular
- Recommended exchanges
- Favorites

Do not require a user to know the exact item name. Discovery should be visual and exploratory.

## 5.3 Submit a Barter Offer

1. User opens an item.
2. User selects “قدّم عرض مقايضة”.
3. User chooses one or more active items they own.
4. User may include a short message.
5. User reviews a side-by-side comparison.
6. User submits the offer.
7. The item owner receives a notification.

The offer must clearly display:

- Requested item
- Offered item or items
- Both users
- Offer status
- Creation date
- Latest action
- Available actions

## 5.4 Counteroffer

The item owner can:

- Accept the offer
- Reject it
- Propose a counteroffer
- Ask a question in chat

A counteroffer can change the selected offered items and include a message.

The system must retain offer history. Do not overwrite the previous offer state without an audit trail.

## 5.5 Accept and Complete an Exchange

1. One party accepts the latest offer.
2. The relevant items become reserved.
3. A trade record is created.
4. Users choose:
   - In-person exchange
   - Shipping or delivery arrangement
5. The platform displays safety instructions.
6. Each user confirms completion.
7. When both confirm, the trade becomes completed.
8. The exchanged items become `SWAPPED`.
9. Both parties can review each other.

A disagreement can move the trade to `DISPUTED` for admin review.

---

## 6. Barter Rules

These rules are mandatory unless explicitly changed later.

1. The MVP is product-for-product barter.
2. A user cannot submit an offer using an item they do not own.
3. Only `ACTIVE` items may be offered.
4. Users cannot offer an item to themselves.
5. The requested item and offered items must not already be swapped, archived, rejected, or reserved in another accepted trade.
6. A user may submit multiple offers, but duplicate active offers for the same combination should be prevented.
7. Accepting an offer reserves all involved items atomically.
8. Competing pending offers for the reserved item must be closed or marked unavailable according to a clearly documented rule.
9. Important status changes must use database transactions.
10. A user may withdraw a pending offer before acceptance.
11. An accepted offer cannot silently return to pending.
12. Cancellation after acceptance must follow a dedicated trade cancellation flow.
13. Reviews are available only after a completed trade.
14. A user can review the other party only once per trade.
15. Public pages show city/general area only, never a private exact address.
16. Contact information should not be publicly exposed.
17. User-generated content must support reporting and moderation.
18. No money field should be treated as a required transaction value.
19. An optional private “estimated value” may be added later for recommendation quality, but it is not a price and must not be shown as payment.
20. All ownership and status checks must be enforced on the backend, not only in the UI.

---

## 7. Item Exchange Preferences

Each listing should support one of these preference modes:

### `SPECIFIC_REQUEST`

The owner wants a specific item or clearly described alternative.

Example:

> أريد تبديله بسماعات AirPods أو سماعة لاسلكية بنفس المستوى.

### `CATEGORY_PREFERENCE`

The owner is interested in one or more categories.

Example:

> ألعاب إلكترونية، شاشات، أو ملحقات كمبيوتر.

### `OPEN_TO_OFFERS`

The owner is open to reasonable suggestions.

A listing may combine a preferred category with open offers.

The UI should prominently show what the owner wants in exchange.

---

## 8. Suggested Status Models

These are initial domain recommendations and may be refined during schema design.

### 8.1 Item Status

- `DRAFT`
- `PENDING_REVIEW`
- `ACTIVE`
- `RESERVED`
- `SWAPPED`
- `REJECTED`
- `HIDDEN`
- `ARCHIVED`

### 8.2 Offer Status

- `PENDING`
- `COUNTERED`
- `ACCEPTED`
- `REJECTED`
- `WITHDRAWN`
- `EXPIRED`
- `CANCELLED`
- `UNAVAILABLE`

### 8.3 Trade Status

- `AGREED`
- `ARRANGING_EXCHANGE`
- `IN_PROGRESS`
- `PARTIALLY_CONFIRMED`
- `COMPLETED`
- `CANCELLED`
- `DISPUTED`

### 8.4 Report Status

- `OPEN`
- `UNDER_REVIEW`
- `RESOLVED`
- `DISMISSED`

Do not rely only on status labels. Define allowed state transitions in the service layer and test them.

---

## 9. MVP Functional Scope

The first production-ready MVP should include:

### Public

- Landing page
- Explore listings
- Categories
- Search and filters
- Public item details
- Public profile trust summary
- Authentication pages
- Safety and how-it-works pages

### Authentication and Account

- Register
- Login
- Refresh session
- Logout
- Current-user endpoint
- HttpOnly cookie authentication
- Email verification
- Forgot/reset password
- Profile settings
- Avatar
- City/general area
- Preferred language
- Account deactivation

### Listings

- Create item
- Edit item
- Delete/archive item
- Upload and reorder images
- Draft and preview
- Moderation status
- Owner dashboard
- Favorites
- Shareable public URL

### Offers

- Create offer
- Select owned item or items
- View sent offers
- View received offers
- Accept
- Reject
- Counter
- Withdraw
- Offer history
- Prevent invalid and conflicting offers

### Conversation

- One conversation per offer or trade context
- Text messages
- Read status
- Basic attachment support only if approved in a later phase
- Reporting and blocking
- Real-time updates may be added after the core REST flow is stable

### Trades

- Create trade after accepted offer
- Reserve items atomically
- Select exchange method
- Confirmation from both users
- Cancel or dispute
- Complete trade
- Review users

### Notifications

- In-app notifications
- Unread count
- Offer events
- Moderation events
- Trade events
- Review reminder

### Administration

- Admin login and authorization
- Dashboard summary
- Item moderation queue
- User management
- Reports
- Categories
- Basic audit log
- Platform content settings

---

## 10. UX and Visual Direction

## 10.1 Brand Personality

The visual personality should be:

- Energetic
- Friendly
- Trustworthy
- Modern
- Community-driven
- Easy to scan
- Image-first

It should not look like:

- A banking application
- A generic admin template
- A traditional auction site
- A clone of a basic classifieds website
- An overly childish game

## 10.2 Suggested Visual Language

Use a strong but balanced visual system:

- Deep ink/navy for trust and contrast
- Fresh teal or green for successful exchange states
- Warm coral or amber for highlights
- Soft neutral backgrounds
- Large border radii
- Clean elevated cards
- Subtle gradients, not on every surface
- Soft shadows
- Clear focus states
- High-quality skeleton loading
- Friendly illustrations or empty-state graphics
- Lucide icons with consistent stroke width

All final colors must be implemented through CSS variables and semantic tokens, not scattered hard-coded values.

## 10.3 Motion

Use motion to clarify actions, not distract.

Examples:

- Card lift on hover
- Smooth image transitions
- Animated exchange arrows
- Offer drawer transitions
- Bottom sheet movement on mobile
- Gentle success animation after acceptance
- Optimistic favorite animation

Respect `prefers-reduced-motion`.

## 10.4 Accessibility

Minimum requirements:

- Semantic HTML
- Keyboard navigation
- Visible focus rings
- Sufficient color contrast
- Accessible form labels
- Screen-reader-friendly dialogs
- Correct Radix UI primitives
- Meaningful alt text
- Do not communicate status by color alone
- Touch targets suitable for mobile

---

## 11. Responsive Product Design

The website must be designed intentionally for both desktop and mobile.

Do not merely shrink desktop components.

## 11.1 Desktop Experience

Desktop should use:

- Spacious top navigation
- Wide search experience
- Multi-column discovery grids
- Two-column item detail page
- Sticky offer/action panel
- Side-by-side barter comparison
- Split-view messaging where useful
- Dashboard side navigation
- Rich filters displayed in a sidebar or popover
- More information visible without additional taps

Suggested desktop item detail structure:

- Left: image gallery
- Center: item information and owner trust
- Right: sticky barter action card

## 11.2 Mobile Experience

Mobile should feel like an application.

Required mobile patterns:

- Compact app-style top bar
- Bottom navigation
- Large touch targets
- Full-width visual item cards
- Floating or visually dominant “add item” action
- Bottom sheets instead of desktop-style modal boxes where appropriate
- Sticky bottom call-to-action on item details
- Full-screen chat
- Step-by-step item publishing flow
- Swipeable image gallery
- Horizontal category chips
- Fast access to offers and notifications
- Safe-area support
- Minimal browser-like clutter

Suggested bottom navigation:

1. الرئيسية
2. اكتشف
3. أضف
4. العروض
5. حسابي

The center “أضف” action may be visually elevated.

## 11.3 Mobile Home Feed

The mobile home may use:

- Greeting and notification icon
- Search field
- Category chips
- Recommended matches
- Vertical visual cards
- “What they want” badge
- Save and share actions
- Quick “اعرض منتجًا” action

A swipe-style discovery mode can be explored later, but it should not replace normal accessible browsing in the MVP.

## 11.4 Mobile Item Detail

Use:

- Full-bleed image carousel
- Back, favorite, and share actions over the image
- Item summary card
- Owner trust card
- Desired exchange section
- Safety summary
- Sticky bottom button: “قدّم عرض مقايضة”

## 11.5 Offer Builder

Desktop:

- Dialog, drawer, or side panel
- Side-by-side comparison
- Owned-item selector
- Offer summary

Mobile:

- Multi-step bottom sheet or full-screen flow
- Select your item
- Add message
- Review exchange
- Submit

---

## 12. Language and Localization

The product should be Arabic-first and ready for English.

Requirements:

- Arabic uses `dir="rtl"`
- English uses `dir="ltr"`
- No hard-coded user-facing strings inside reusable components
- Use translation dictionaries
- Layout must remain correct in both directions
- Numbers, dates, and relative times must be locale-aware
- Product and category data should support localized names where practical

Initial locales:

- `ar`
- `en`

Arabic copy should sound natural and friendly, not like literal machine translation.

---

## 13. Required Technology Stack

### Frontend

- Next.js App Router
- React
- TypeScript
- Tailwind CSS v4
- shadcn/ui
- Radix UI
- lucide-react
- Zod for client-side form schemas where shared validation is useful

### Backend

- Express.js
- TypeScript
- Zod
- Clear controller/service/repository separation
- REST API for the MVP

### Database

- Neon PostgreSQL
- Prisma ORM

### Authentication

- JWT access and refresh strategy
- HttpOnly cookies
- Secure cookie settings in production
- Refresh token rotation or a secure equivalent
- Server-side authorization
- CSRF protection for cookie-authenticated mutations
- Password hashing with a modern secure algorithm
- Email verification and password reset tokens must expire

Do not store authentication tokens in `localStorage`.

---

## 14. Recommended Repository Structure

A monorepo is preferred.

```text
/
├─ apps/
│  ├─ web/                 # Next.js application
│  └─ api/                 # Express API
├─ packages/
│  ├─ shared/              # Shared types, constants, and safe schemas
│  ├─ ui/                  # Optional shared UI package
│  └─ config/              # Shared lint/TypeScript configuration
├─ prisma/
│  ├─ schema.prisma
│  └─ migrations/
├─ docs/
│  ├─ CURSOR_PROJECT_CONTEXT.md
│  ├─ API_CONTRACT.md
│  ├─ DOMAIN_RULES.md
│  └─ QA_CHECKLIST.md
├─ .env.example
├─ package.json
└─ pnpm-workspace.yaml
```

The final structure may be adapted to the existing repository, but responsibilities must remain clear.

Use `pnpm` unless the repository already standardizes another package manager.

---

## 15. Frontend Architecture Rules

1. Use Server Components by default.
2. Use Client Components only for interaction, browser APIs, or client-side state.
3. Keep business logic out of presentational components.
4. Build reusable primitives rather than duplicating pages.
5. Use semantic design tokens through CSS variables.
6. Use shadcn/ui and Radix primitives correctly; do not create inaccessible custom dialogs.
7. Forms should use shared Zod schemas where appropriate.
8. API errors must map to friendly user messages.
9. Include loading, empty, error, and success states.
10. Mobile and desktop may use different component compositions while sharing data and domain logic.
11. Do not use arbitrary responsive hacks that create hydration problems.
12. Optimize images using the Next.js image system.
13. Protect authenticated routes on the server where possible.
14. Avoid exposing private environment variables to the browser.
15. Keep URL state for search, filters, sorting, and pagination where useful.

---

## 16. Backend Architecture Rules

Use a modular structure such as:

```text
src/
├─ app.ts
├─ server.ts
├─ config/
├─ middleware/
├─ modules/
│  ├─ auth/
│  ├─ users/
│  ├─ categories/
│  ├─ items/
│  ├─ offers/
│  ├─ conversations/
│  ├─ trades/
│  ├─ reviews/
│  ├─ notifications/
│  ├─ reports/
│  └─ admin/
├─ lib/
├─ errors/
└─ tests/
```

Each module should separate:

- Routes
- Validation
- Controller
- Service
- Repository or database access
- Domain policies
- Tests

Rules:

1. Controllers should stay thin.
2. Business rules belong in services/domain policies.
3. Prisma calls should not be scattered throughout controllers.
4. Use centralized typed error handling.
5. Validate params, query strings, and bodies with Zod.
6. Use transactions for offer acceptance, item reservation, and trade completion.
7. Enforce ownership and authorization in the API.
8. Use pagination for list endpoints.
9. Add database indexes for common filters.
10. Make critical mutations idempotent where duplicate requests are possible.
11. Use structured logs without exposing secrets.
12. Record important admin and trade actions in an audit log.

---

## 17. Initial Data Model Direction

This is a conceptual model, not a final Prisma schema.

### Core Entities

- `User`
- `UserProfile`
- `Session` or `RefreshToken`
- `EmailVerificationToken`
- `PasswordResetToken`
- `Category`
- `Item`
- `ItemImage`
- `ItemWantedPreference`
- `Favorite`
- `SwapOffer`
- `SwapOfferItem`
- `OfferRevision`
- `Conversation`
- `Message`
- `Trade`
- `TradeConfirmation`
- `Review`
- `Notification`
- `Report`
- `Block`
- `AuditLog`

### Important Relationships

- A user owns many items.
- An item belongs to one category.
- An item has many images.
- An item can have multiple desired categories or preference records.
- An offer targets one requested item.
- An offer contains one or more offered items.
- An offer has revision history.
- An accepted offer creates one trade.
- A trade links all exchanged items and both users.
- A completed trade can have up to two reviews, one from each participant.
- Reports can target an item, user, conversation, or trade.

Use UUIDs or another deliberate identifier strategy consistently.

Use timestamps consistently and store them in UTC.

---

## 18. API Design Direction

Use versioned REST routes:

```text
/api/v1/auth/*
/api/v1/users/*
/api/v1/categories/*
/api/v1/items/*
/api/v1/offers/*
/api/v1/conversations/*
/api/v1/trades/*
/api/v1/reviews/*
/api/v1/notifications/*
/api/v1/reports/*
/api/v1/admin/*
```

Response conventions should be consistent.

Example success shape:

```json
{
  "data": {},
  "meta": {}
}
```

Example error shape:

```json
{
  "error": {
    "code": "OFFER_ITEM_UNAVAILABLE",
    "message": "The offered item is no longer available.",
    "fieldErrors": {}
  }
}
```

Use stable machine-readable error codes.

Do not leak stack traces, Prisma errors, JWT details, or internal database information.

---

## 19. Security Requirements

Minimum security expectations:

- HttpOnly authentication cookies
- `Secure` cookies in production
- Appropriate `SameSite` configuration
- CSRF protection for mutations
- Password hashing
- Login rate limiting
- Password reset rate limiting
- Email verification token expiration
- Refresh token rotation or revocation strategy
- Schema validation
- Authorization on every protected action
- Ownership checks
- File upload type and size validation
- Safe image storage strategy
- Content sanitization where needed
- Security headers
- CORS restricted to approved origins
- Secrets only in environment variables
- No sensitive data in logs
- No exact public home address
- Account suspension enforcement
- Audit logs for critical actions

Security-sensitive decisions must be documented.

---

## 20. Search and Recommendation Direction

MVP search should support:

- Keyword
- Category
- City
- Condition
- Exchange preference mode
- Recently added
- Sort options
- Pagination

Recommendation can begin rule-based.

Potential matching signals:

- Desired category matches another user’s offered category
- Same city
- Similar condition
- Reciprocal category interest
- Recently active item
- User trust score

Do not claim AI matching unless an actual matching model exists.

A simple explainable score is acceptable:

> “مناسب لك لأن صاحبه يبحث عن ألعاب إلكترونية، وأنت لديك جهاز ألعاب معروض.”

---

## 21. Admin and Moderation Direction

The admin interface should be functional, fast, and trustworthy.

It may be more desktop-oriented than the public product, but it must remain usable on mobile.

Admin features should include:

- Item moderation queue
- Item details and moderation history
- User search by name or email
- User status and reports
- Category management
- Report queue
- Trade dispute overview
- Audit log
- Basic KPIs:
  - Active users
  - Active items
  - Pending moderation
  - Offers created
  - Accepted offers
  - Completed exchanges
  - Disputes
  - Report rate

Do not expose private user information beyond what the admin needs.

---

## 22. Analytics Events

Prepare a clear event naming strategy.

Examples:

- `item_viewed`
- `item_favorited`
- `item_created`
- `search_performed`
- `offer_started`
- `offer_submitted`
- `offer_countered`
- `offer_accepted`
- `trade_created`
- `trade_completed`
- `review_submitted`

Do not add third-party analytics before privacy and environment decisions are approved.

---

## 23. Development Phases

Cursor should work only on the requested phase.

### Phase 0 — Foundation

- Repository and monorepo setup
- Next.js app
- Express API
- TypeScript strict mode
- Tailwind CSS v4
- shadcn/ui setup
- Prisma and Neon configuration placeholders
- Environment validation
- Shared linting and formatting
- Health endpoints
- Basic CI-friendly scripts
- Base design tokens
- Arabic/English layout foundation
- Initial documentation

### Phase 1 — Authentication and Profiles

- Register
- Login
- Refresh
- Logout
- Current user
- Email verification
- Password reset
- Profile
- Protected routes
- CSRF
- Tests

### Phase 2 — Listings and Discovery

- Categories
- Item CRUD
- Images
- Moderation state
- Explore page
- Search and filters
- Item details
- Favorites
- Desktop/mobile responsive experience

### Phase 3 — Offers and Counteroffers

- Create offer
- Offered-item selection
- Sent/received offers
- Counteroffer revisions
- Accept/reject/withdraw
- Atomic item reservation
- Concurrency tests
- Offer notifications

### Phase 4 — Conversations and Trades

- Offer conversation
- Trade creation
- Exchange method
- Completion confirmation
- Cancellation
- Dispute
- Notifications

### Phase 5 — Reviews, Reporting, and Admin

- Reviews
- Reports
- Blocking
- Moderation dashboard
- User management
- Audit log
- Operational KPIs

### Phase 6 — Polish and Readiness

- Accessibility audit
- Responsive QA
- Performance
- Security review
- Error-state audit
- End-to-end tests
- Production deployment documentation

---

## 24. Testing Expectations

At minimum:

### API

- Unit tests for domain rules
- Integration tests for auth
- Integration tests for item ownership
- Offer state transition tests
- Concurrency test for accepting competing offers
- Transaction rollback tests
- Authorization tests
- Validation tests

### Web

- Component tests for critical forms
- Route protection tests where practical
- End-to-end tests for:
  - Register/login
  - Publish item
  - Browse item
  - Submit offer
  - Accept or counter
  - Complete trade
  - Submit review

### Manual QA

Test:

- Arabic RTL
- English LTR
- Desktop
- Tablet
- Small mobile
- Slow network
- Empty data
- Long Arabic text
- Failed image upload
- Expired session
- Competing accepted offers
- Suspended user

Do not claim live Neon, email, storage, or production integrations passed unless they were actually configured and tested.

---

## 25. Definition of Done

A feature is not complete merely because the happy-path UI exists.

A feature is complete only when:

- Business rules are implemented
- Backend authorization exists
- Zod validation exists
- Database constraints are considered
- Loading, empty, error, and success states exist
- Arabic and English layouts remain usable
- Mobile and desktop are tested
- Relevant tests pass
- Documentation is updated
- No secrets are committed
- No unrelated areas are broken

---

## 26. Cursor Working Instructions

Before making changes:

1. Read this file.
2. Inspect the repository.
3. Read existing documentation.
4. Check current Git branch, status, and HEAD.
5. Identify the requested phase and exact scope.
6. Explain the implementation plan briefly.
7. Preserve existing behavior outside scope.

While working:

- Do not redesign unrelated pages.
- Do not invent product rules that conflict with this file.
- Do not silently change API contracts.
- Do not bypass backend authorization.
- Do not use mock data as if it were production data.
- Do not add payment functionality.
- Do not expose secrets.
- Do not duplicate business logic between web and API.
- Keep TypeScript strict.
- Prefer small, reviewable changes.
- Add or update tests.
- Update documentation when behavior changes.

Git restrictions:

- Do not run `git add`.
- Do not run `git commit`.
- Do not run `git push`.
- Do not create or merge pull requests.
- Do not create or push tags.
- You may show `git diff`, `git status`, and suggest a commit message.
- The user performs all Git write operations.

At the end of each task, report:

1. What changed
2. Files created or modified
3. Business rules implemented
4. Tests and commands run
5. Results
6. Known limitations
7. Manual QA steps
8. Suggested commit message
9. Suggested next phase

---

## 27. Initial Product Acceptance Criteria

The initial product direction is correct when:

- A visitor immediately understands that this is a barter platform.
- A user can publish an item and clearly state what they want in exchange.
- Another user can offer one or more owned items.
- The owner can accept, reject, or counter.
- Accepted exchanges reserve all involved items safely.
- Users can arrange and confirm the exchange.
- Completed trades update the item state and enable reviews.
- The mobile experience feels app-like.
- The desktop experience uses the extra screen space intelligently.
- The design feels enjoyable, premium, and trustworthy.
- The system remains Arabic-first, responsive, accessible, and secure.
- No monetary checkout is required for the central experience.

---

## 28. Product Summary for Cursor

Build an Arabic-first, mobile-app-like barter marketplace using Next.js, React, TypeScript, Express, Neon PostgreSQL, Prisma, Tailwind CSS v4, shadcn/ui, Radix UI, lucide-react, JWT HttpOnly cookies, and Zod.

The product allows users to list items, describe what they want in exchange, browse other listings, offer their own items, negotiate with counteroffers, accept a barter deal, arrange delivery or meetup, confirm completion, and review each other.

The platform must be visually delightful and simple, but its backend must strictly enforce ownership, state transitions, concurrency safety, moderation, privacy, and trust.

Mobile must use app-style navigation, bottom sheets, sticky actions, full-screen chat, and guided flows. Desktop must use richer layouts, multi-column discovery, comparison panels, and efficient dashboards.

Develop phase by phase. Do not add payments. Do not perform Git write operations.
