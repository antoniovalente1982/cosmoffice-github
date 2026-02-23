# 🌌 Cosmoffice - Virtual Office for Remote Teams

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/yourusername/cosmoffice)

## 🚀 Quick Start

```bash
# 1. Clone the repository
git clone https://github.com/yourusername/cosmoffice.git
cd cosmoffice

# 2. Install dependencies
npm install

# 3. Set up environment variables
cp .env.example .env.local
# Edit .env.local with your Supabase credentials

# 4. Run the development server
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to see the result.

## 📋 Prerequisites

- Node.js 18+
- npm 9+
- Supabase account (free)
- Vercel account (free)

## 🛠️ Tech Stack

- **Frontend:** Next.js 14, React 18, TypeScript, Tailwind CSS
- **Backend:** Supabase (PostgreSQL, Auth, Realtime)
- **State:** Zustand
- **Animations:** Framer Motion
- **Icons:** Lucide React
- **Deploy:** Vercel

## 📁 Project Structure

```
cosmoffice/
├── app/                    # Next.js App Router
├── components/ui/          # UI Components
├── lib/                    # Utilities
├── stores/                 # Zustand stores
├── hooks/                  # Custom hooks
├── supabase/               # Database schema
└── scripts/                # Automation scripts
```

## 🗄️ Database Setup

1. Create a new project on [Supabase](https://sucpabase.com)
2. Go to SQL Editor
3. Copy and run the content of `supabase/schema.sql`
4. Get your API keys from Settings → API

## 🚀 Deploy

### Option 1: Vercel (Recommended)

```bash
npm i -g vercel
vercel --prod
```

### Option 2: GitHub + Vercel Auto-deploy

1. Push to GitHub
2. Connect repository on Vercel
3. Add environment variables
4. Deploy!

## 📄 License

MIT License - see LICENSE file for details.

---

Built with ❤️ for the future of remote work.
