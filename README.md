# 🚀 Psychočas - Member App

[![Next.js](https://img.shields.io/badge/Next.js-15-black)](https://nextjs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-5-blue)](https://www.typescriptlang.org/)
[![Supabase](https://img.shields.io/badge/Supabase-green)](https://supabase.com/)
[![Tailwind CSS](https://img.shields.io/badge/Tailwind_CSS-3-38B2AC)](https://tailwindcss.com/)

Členská aplikace pro studenty psychologie - generování a validace slev s PWA podporou.

## ✨ Features

- 🔐 **Magic Link Auth** - Přihlášení přes e-mail bez hesla
- 🎫 **QR Discount Codes** - 3-minutové slevové kódy s QR
- ✅ **Validation System** - Manažeři validují kódy
- 📊 **Statistics Dashboard** - Denní/měsíční přehledy
- 👥 **Role Management** - Member/Manager/Council/Technician
- 📱 **PWA Ready** - Instalovatelná jako nativní app
- 🎨 **Brand Design** - Psychočas design system

## 🛠️ Tech Stack

- **Frontend**: Next.js 15, TypeScript, Tailwind CSS
- **Backend**: Supabase (Auth + Database + Edge Functions)
- **PWA**: Manifest, Service Worker, Icons
- **QR Codes**: react-qr-code
- **Deployment**: Vercel (ready)

## 🚀 Quick Start

### 1. Clone & Install

```bash
git clone https://github.com/Kumungchi/psychocas-app.git
cd psychocas-app/nextjs-app
npm install
```

### 2. Environment Setup

```bash
# Create .env.local
NEXT_PUBLIC_SUPABASE_URL=your_supabase_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

### 3. Database Setup

```sql
-- Run in Supabase SQL Editor
sql/complete_schema.sql
```

### 4. Deploy Edge Functions

```bash
npm install -g supabase
supabase login
supabase link --project-ref your_project_ref
supabase functions deploy
```

### 5. Start Development

```bash
npm run dev
# Open http://localhost:3000
```

## 📁 Project Structure

```text
nextjs-app/
├── src/
│   ├── app/           # Next.js 15 App Router
│   │   ├── login/     # Magic link authentication
│   │   ├── home/      # Membership dashboard
│   │   ├── redeem/    # QR code generation
│   │   ├── validate/  # Manager validation
│   │   ├── stats/     # Statistics dashboard
│   │   └── technician/ # Admin panel
│   ├── components/    # Reusable components
│   └── lib/          # Supabase client
├── sql/              # Database schema
├── supabase/         # Edge Functions
├── public/           # PWA assets
└── docs/            # Setup guides
```

## 🎨 Design System

### Colors

- **Primary**: #1d4f7d (Psychočas Blue)
- **Accent**: #049edb (Light Blue)
- **Success**: #2E7D32
- **Error**: #C62828
- **Gray**: #F5F5F5

### Typography

- **Font**: Avenir (Light/Medium/Black)
- **Grid**: 8px spacing system
- **Cards**: 16px border radius
- **Buttons**: 24px border radius

## 👥 User Roles

| Role | Access | Functions |
|------|--------|-----------|
| **Member** | Home, Redeem | Generate discount codes |
| **Manager** | Validate, Stats | Validate codes, branch stats |
| **Council** | Stats | All branch statistics |
| **Technician** | Admin | User management, system health |

## 🔒 Security

- **Row Level Security** (RLS) enabled on all tables
- **Role-based policies** for data access
- **JWT authentication** via Supabase Auth
- **GDPR compliant** - anonymous redemption tracking
- **Anti-spam protection** - 1 active token per user

## 📱 PWA Features

- **Installable** on mobile and desktop
- **Offline capable** (planned)
- **App icons** - faviconV1/V2 variants
- **Theme colors** match Psychočas branding
- **Mobile-optimized** (max-width 425px)

## 🚀 Deployment

### Vercel (Recommended)

1. Connect GitHub repository
2. Add environment variables
3. Deploy automatically on push

### Environment Variables

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_service_key
```

## 📊 Database Schema

### Core Tables

- `branches` - Organization branches
- `members` - User profiles with roles
- `tokens` - Temporary discount codes
- `redemptions` - Anonymous usage tracking

### Features

- UUID primary keys
- Automatic timestamps
- Foreign key constraints
- RLS policies per role
- Anti-spam triggers

## 🔧 Development

### Available Scripts

```bash
npm run dev      # Start development server
npm run build    # Build for production
npm run start    # Start production server
npm run lint     # Run ESLint
```

### Health Check

Visit `/test` for system health diagnostics:

- ✅ Supabase connection
- ✅ Database access
- ✅ Authentication flow

## 📝 API Reference

### Edge Functions

#### `generate_token`

```bash
POST /functions/v1/generate_token
Authorization: Bearer <user_token>

Response: {
  "code": "ABC4-XY89",
  "expiresAt": "2025-10-04T14:03:00.000Z"
}
```

#### `redeem_token`

```bash
POST /functions/v1/redeem_token
Authorization: Bearer <manager_token>
Body: {"code": "ABC4-XY89"}

Response: {
  "valid": true
}
```

## 🤝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## 👨‍💻 Development Team

- **GitHub**: [Kumungchi](https://github.com/Kumungchi)
- **Organization**: Psychočas - Spolek studentů psychologie

---

**🎯 Status**: Ready for production deployment!

For detailed setup instructions, see:

- [Complete Setup Guide](COMPLETE_SETUP.md)
- [Database Setup](DATABASE_SETUP.md)
- [Edge Functions Setup](EDGE_FUNCTIONS_SETUP.md)