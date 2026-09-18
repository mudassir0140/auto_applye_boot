#!/bin/bash

# Job Application AI Agent - Setup Script

echo "🚀 Setting up Job Application AI Agent..."

# Check if Node.js is installed
if ! command -v node &> /dev/null; then
    echo "❌ Node.js is not installed. Please install Node.js 18+ first."
    exit 1
fi

echo "✓ Node.js found: $(node --version)"

# Check if npm is installed
if ! command -v npm &> /dev/null; then
    echo "❌ npm is not installed."
    exit 1
fi

echo "✓ npm found: $(npm --version)"

# Install dependencies
echo "📦 Installing dependencies..."
npm install

if [ $? -ne 0 ]; then
    echo "❌ Failed to install dependencies"
    exit 1
fi

echo "✓ Dependencies installed"

# Check if .env.local exists
if [ ! -f .env.local ]; then
    echo "⚙️  Creating .env.local file..."
    cp .env.local.example .env.local
    echo "⚠️  Please edit .env.local and add your Google OAuth credentials"

    # Generate NEXTAUTH_SECRET
    echo "🔐 Generating NEXTAUTH_SECRET..."
    SECRET=$(node -e "console.log(require('crypto').randomBytes(32).toString('hex'))")
    sed -i "s/your-super-secret-key-change-this-in-production/$SECRET/" .env.local
    echo "✓ NEXTAUTH_SECRET generated"
fi

# Generate Prisma client
echo "📊 Generating Prisma client..."
npm run prisma:generate

# Run database migrations
echo "🗄️  Setting up database..."
npm run prisma:migrate

echo ""
echo "✅ Setup complete!"
echo ""
echo "Next steps:"
echo "1. Edit .env.local with your Google OAuth credentials"
echo "2. Run 'npm run dev' to start development server"
echo "3. Visit http://localhost:3000"
echo ""
