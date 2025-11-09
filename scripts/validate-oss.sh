#!/bin/bash
# Originary Trace OSS Validation Script
# Ensures codebase is clean for public release

set -e

echo "🔍 Originary Trace v0.1 - OSS Validation"
echo "=================================="

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

FAILED=0

# 1. Check for internal/confidential markers
echo -e "\n📝 Checking for internal markers..."
if grep -r "TODO\|FIXME\|HACK" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.js" --include="*.php" 2>/dev/null | grep -v "node_modules\|\.next\|dist" | grep -E "(internal|confidential|strategy|private note)" > /dev/null; then
    echo -e "${RED}❌ Found internal/confidential markers${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ No internal markers found${NC}"
fi

# 2. Check for hardcoded secrets
echo -e "\n🔐 Checking for hardcoded secrets..."
if grep -r "password\s*=\s*['\"].\\|secret\s*=\s*['\"].\\|api_key\s*=\s*['\".]" apps/ packages/ --include="*.ts" --include="*.tsx" --include="*.js" | grep -v "process\.env\|node_modules\|\.next\|description\|placeholder\|tests/\|test\.ts\|\.test\." > /dev/null; then
    echo -e "${RED}❌ Found potential hardcoded secrets${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ No hardcoded secrets found${NC}"
fi

# 3. Check for AI artifacts
echo -e "\n🤖 Checking for AI artifacts..."
if find . -type f \( -name "*.prompt.md" -o -name "*-context.md" -o -name "ai-context.md" \) ! -path "*/node_modules/*" 2>/dev/null | grep -q .; then
    echo -e "${RED}❌ Found AI artifact files${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ No AI artifacts found${NC}"
fi

# 4. Check Node.js version compatibility
echo -e "\n📦 Checking Node.js version compatibility..."
NODE_VERSION=$(node --version | cut -d'.' -f1 | tr -d 'v')
if [ "$NODE_VERSION" -ge 20 ]; then
    echo -e "${GREEN}✅ Node.js $NODE_VERSION (LTS compatible)${NC}"
else
    echo -e "${YELLOW}⚠️  Node.js $NODE_VERSION (recommend 20.x LTS)${NC}"
fi

# 5. Verify dependencies are installed
echo -e "\n📚 Checking dependencies..."
if [ ! -d "node_modules" ]; then
    echo -e "${YELLOW}⚠️  Dependencies not installed. Run: pnpm install${NC}"
else
    echo -e "${GREEN}✅ Dependencies installed${NC}"
fi

# 6. Run TypeScript checks
echo -e "\n🔨 Running TypeScript checks..."
if pnpm --filter @originary/trace-api run typecheck > /dev/null 2>&1; then
    echo -e "${GREEN}✅ TypeScript checks passed${NC}"
else
    echo -e "${RED}❌ TypeScript checks failed${NC}"
    FAILED=1
fi

# 7. Verify build succeeds
echo -e "\n🏗️  Verifying build..."
if pnpm --filter @originary/trace-api run build > /dev/null 2>&1; then
    echo -e "${GREEN}✅ Build successful${NC}"
else
    echo -e "${RED}❌ Build failed${NC}"
    FAILED=1
fi

# 8. Check .gitignore is clean
echo -e "\n📄 Checking .gitignore..."
if grep -E "(claude|cursor|aider|ROADMAP|BUILD_SUMMARY|bot_meter_v)" .gitignore > /dev/null; then
    echo -e "${RED}❌ .gitignore contains traces of internal files${NC}"
    echo -e "${YELLOW}   Use .git/info/exclude for local exclusions${NC}"
    FAILED=1
else
    echo -e "${GREEN}✅ .gitignore is clean${NC}"
fi

echo -e "\n=================================="
if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All checks passed! Ready for public release.${NC}"
    exit 0
else
    echo -e "${RED}❌ Some checks failed. Please fix before committing.${NC}"
    exit 1
fi
