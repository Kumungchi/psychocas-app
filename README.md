# Psychočas App

A lightweight, modern **Progressive Web App** for ---

## 📁 Folder Structure

```
psychocas-app/
├── .gitignore              # Git ignore rules
├── README.md               # Project documentation
├── desing/                 # Original Vite prototype
└── nextjs-app/            # Main Next.js application
    ├── public/            # Static assets
    ├── src/
    │   ├── app/           # Next.js App Router pages
    │   │   ├── (auth)/    # Auth-protected routes
    │   │   │   ├── home/     # Member dashboard
    │   │   │   ├── redeem/   # Code redemption
    │   │   │   ├── validate/ # Manager validation
    │   │   │   ├── stats/    # Statistics views
    │   │   │   └── technician/ # Admin tools
    │   │   ├── login/     # Authentication page
    │   │   ├── layout.tsx # Root layout
    │   │   └── page.tsx   # Landing/redirect page
    │   ├── components/    # Reusable React components
    │   │   ├── ui/       # Base UI components (buttons, cards, etc.)
    │   │   └── forms/    # Form components
    │   ├── lib/          # Utility functions
    │   │   ├── supabase.ts  # Supabase client config
    │   │   ├── auth.ts      # Authentication helpers
    │   │   └── utils.ts     # General utilities
    │   ├── hooks/        # Custom React hooks
    │   ├── types/        # TypeScript type definitions
    │   └── middleware.ts # Next.js middleware (auth, routing)
    ├── tailwind.config.js # Tailwind configuration
    ├── next.config.js    # Next.js configuration
    └── package.json      # Dependencies and scripts
```

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ 
- npm or yarn
- Supabase account (free tier)
- Vercel account (optional, for deployment)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/Kumungchi/psychocas-app.git
   cd psychocas-app/nextjs-app
   ```

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   ```bash
   cp .env.local.example .env.local
   ```
   
   Fill in your Supabase credentials:
   ```env
   NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
   NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
   SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
   ```

4. **Run the development server**
   ```bash
   npm run dev
   ```

5. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

---

## 🗄️ Database Schema

### Core Tables

```sql
-- Users and authentication (managed by Supabase Auth)
auth.users

-- Member profiles
members (
  id UUID PRIMARY KEY REFERENCES auth.users,
  email TEXT NOT NULL,
  role TEXT DEFAULT 'member', -- member|manager|council|technician
  is_active BOOLEAN DEFAULT false,
  expires_at TIMESTAMP,
  branch_id UUID REFERENCES branches(id),
  created_at TIMESTAMP DEFAULT NOW()
)

-- Organization branches
branches (
  id UUID PRIMARY KEY,
  name TEXT NOT NULL,
  city TEXT,
  manager_id UUID REFERENCES members(id)
)

-- One-time discount tokens
tokens (
  id UUID PRIMARY KEY,
  member_id UUID REFERENCES members(id),
  code TEXT UNIQUE NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  is_used BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW()
)

-- Redemption tracking (anonymous)
redemptions (
  id UUID PRIMARY KEY,
  token_id UUID REFERENCES tokens(id),
  branch_id UUID REFERENCES branches(id),
  redeemed_at TIMESTAMP DEFAULT NOW(),
  -- No member_id for privacy
)
```

---

## 🔧 Development

### Available Scripts

```bash
# Development
npm run dev          # Start development server
npm run build        # Build for production
npm run start        # Start production server

# Code Quality
npm run lint         # Run ESLint
npm run type-check   # Run TypeScript checks

# Database
npm run db:generate  # Generate Supabase types
npm run db:reset     # Reset local database
```

### Environment Setup

1. **Supabase Project Setup**
   - Create a new project at [supabase.com](https://supabase.com)
   - Enable Email Auth in Authentication settings
   - Set up RLS policies for data security
   - Run the database migration scripts

2. **Local Development**
   - Use Supabase CLI for local development: `supabase start`
   - Run database migrations: `supabase db reset`
   - Generate TypeScript types: `supabase gen types typescript`

---

## 🚀 Deployment

### Vercel (Recommended)

1. **Connect to Vercel**
   ```bash
   npm install -g vercel
   vercel login
   vercel
   ```

2. **Set Environment Variables**
   Add your Supabase keys in the Vercel dashboard under Settings > Environment Variables

3. **Deploy**
   ```bash
   vercel --prod
   ```

### Alternative Platforms
- **Netlify**: Supports Next.js with serverless functions
- **Railway**: Simple deployment with integrated database options
- **Supabase Platform**: Native hosting for Supabase projects

---

## 🛡️ Security & Privacy

- **Authentication**: Supabase Auth with magic links and optional passkeys
- **Authorization**: Row Level Security (RLS) policies on all tables
- **Data Privacy**: Anonymous redemption tracking, GDPR-compliant
- **Rate Limiting**: Token generation limited to prevent abuse
- **HTTPS**: Enforced in production via Vercel

---

## 📝 Contributing

1. Fork the repository
2. Create a feature branch: `git checkout -b feature/amazing-feature`
3. Commit changes: `git commit -m 'Add amazing feature'`
4. Push to branch: `git push origin feature/amazing-feature`
5. Open a Pull Request

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 🤝 Support

For questions or support, please contact:
- **Email**: support@psychocas.cz
- **GitHub Issues**: [Create an issue](https://github.com/Kumungchi/psychocas-app/issues)
- **Documentation**: [Project Wiki](https://github.com/Kumungchi/psychocas-app/wiki)bers of the Psychočas student association.  
Built with **Next.js**, **TailwindCSS**, and **Supabase**, deployed via **Vercel**.  
Designed for secure member verification, benefit redemption, and anonymous usage tracking.

---

## 🚀 Overview

Psychočas App allows registered members to:
- Log in securely with their association email (magic link or passkey)
- View their membership status and expiration
- Generate a one-time use code or QR for discount verification
- Have branch managers validate codes in real time
- Collect anonymized usage statistics for internal reporting
- Operate fully as a **Progressive Web App (PWA)** across mobile and desktop

Roles supported:
- **Member** — uses and redeems membership discounts  
- **Manager** — validates codes, views branch stats  
- **Council** — views aggregated national statistics  
- **Technician** — manages user accounts, roles, and membership data  

---

## 🧩 Tech Stack

| Layer | Technology | Purpose |
|-------|-------------|----------|
| Frontend | **Next.js 14 (TypeScript)** | Modern React-based UI framework |
| Styling | **TailwindCSS** | Utility-first responsive styling |
| Backend | **Supabase (PostgreSQL + Auth + Edge Functions)** | Authentication, database, and serverless logic |
| Hosting | **Vercel (Free Tier)** | Deployment, CDN, and SSL |
| Auth | Supabase Email Auth + optional Passkeys | Secure user access |
| PWA | next-pwa | Installable, offline-capable shell |
| Icons | lucide-react | Lightweight open-source icon set |
| QR Generator | react-qr-code | Discount code visualization |

---

## 🧠 Core Features

### 🔐 Authentication
- Login via Supabase Email Auth (Magic Link)  
- Passkey (WebAuthn) optional for recurring logins  
- Role-based access control (RLS on Supabase)

### 🎟️ Membership
- Member dashboard showing active/inactive state  
- Expiration date display  
- "Uplatnit slevu" button visible only to active members

### 💳 Token System
- One-time codes generated via Supabase Edge Function  
- 3-minute expiry per token  
- Prevents duplicates with trigger `prevent_token_spam`  
- Manager can validate tokens once → stored in `redemptions`

### � Statistics
- Branch-level and national aggregate views (daily, weekly, monthly)  
- Anonymous redemption data — GDPR-compliant  
- Simple bar chart visualization using Tailwind utility classes or lightweight chart lib

### 🧰 Technician Tools
- Table view of all members (email, role, active status)
- Role management actions
- System configuration & debugging access

---

## � Folder Structure