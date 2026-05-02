# AGENTS.md - AI Dictionary App

## Project Overview

**Type:** Tauri 2 + React 19 + TypeScript + Vite desktop application  
**Package Manager:** Bun  
**Description:** AI-powered dictionary tool with word lookup, favorites, history, and review features

## Build & Development Commands

```bash
# Development
bun run dev          # Frontend dev server only (Vite)
bun run dev:pc       # Full Tauri dev mode (desktop)
bun run dev:android  # Android development
bun run dev:ios      # iOS development

# Building
bun run build        # Build frontend (tsc && vite build)
bun run build:pc     # Build Tauri desktop app
bun run build:android # Build Android app
bun run build:ios    # Build iOS app

# Preview
bun run preview      # Preview production build
bun run tauri        # Access Tauri CLI directly
```

## Testing Commands

```bash
# Add test scripts to package.json when implementing tests:
# "test": "vitest"
# "test:run": "vitest run"
# "test:coverage": "vitest run --coverage"

# Run single test file
bun test src/utils/api.test.ts

# Run tests in watch mode
bun test --watch
```

## Code Style Guidelines

### TypeScript Configuration
- **Target:** ES2020
- **Strict mode:** Enabled (noUnusedLocals, noUnusedParameters)
- **JSX:** react-jsx transform
- **Path alias:** `@/*` maps to `src/*`

### Naming Conventions

| Type | Convention | Example |
|------|------------|---------|
| Components | PascalCase | `SearchBox.tsx`, `QueryResult.tsx` |
| Utility files | camelCase | `api.ts`, `indexedDB.ts` |
| React hooks | camelCase with `use` prefix | `usePageTransition.ts` |
| Zustand stores | camelCase with `use` prefix | `useWordsStore.ts` |
| Types/Interfaces | PascalCase | `QueryResult`, `FavoriteWord` |
| Type aliases | PascalCase | `TranslationMap`, `PageType` |
| Functions | camelCase | `getWordFromCache`, `saveWordToCache` |
| Constants | UPPER_SNAKE_CASE | `API_TIMEOUT`, `defaultSettings` |
| CSS classes | kebab-case | `.search-box`, `.word-header` |

### Imports Order

1. React imports
2. Third-party libraries (zustand, lucide-react, etc.)
3. Internal components (`@/components/*`)
4. Internal hooks (`@/hooks/*`)
5. Internal stores (`@/stores/*`)
6. Internal utils (`@/utils/*`)
7. Types (`@/types`)
8. CSS files

Example:
```typescript
import { useEffect, useState } from 'react'
import { create } from 'zustand'
import { Star } from 'lucide-react'
import { SearchBox } from '@/components/SearchBox'
import { usePageTransition } from '@/hooks/usePageTransition'
import { useWordsStore } from '@/stores/wordsStore'
import { indexedDBService } from '@/utils/indexedDB'
import type { WordEntry, QueryResult } from '@/types'
import './index.css'
```

### Component Structure

```typescript
// 1. Imports
import { useEffect } from 'react'
import type { SomeType } from '@/types'

// 2. Types (if component-specific)
interface Props {
  data: SomeType
}

// 3. Helper functions (before component)
function formatData(data: SomeType): string {
  return data.toString()
}

// 4. Main component
export function ComponentName({ data }: Props) {
  // Hooks first
  useEffect(() => {
    // effect logic
  }, [])
  
  // Event handlers
  const handleClick = () => {
    // handler logic
  }
  
  // Render
  return <div>{formatData(data)}</div>
}
```

### State Management (Zustand)

- One store per domain (words, favorites, history, settings, app)
- Use interface for state type
- Actions defined inline in store
- Access other stores via `useOtherStore.getState()` when needed

```typescript
interface WordsState {
  cachedWords: WordEntry[]
  isLoading: boolean
  init: () => Promise<void>
}

export const useWordsStore = create<WordsState>((set, get) => ({
  cachedWords: [],
  isLoading: false,
  init: async () => {
    // implementation
  }
}))
```

### Error Handling

- Use try-catch for async operations
- Log errors with `console.error` for debugging
- Show user feedback via toast notifications
- Re-throw errors when needed for upstream handling

```typescript
try {
  const result = await fetchData()
  return result
} catch (error) {
  console.error('Failed to fetch:', error)
  useAppStore.getState().showToast('操作失败', 'error')
  throw error
}
```

### Type Definitions

- Define types in `src/types/index.ts`
- Use explicit return types for exported functions
- Prefer `type` over `interface` for object shapes
- Use union types for limited values

```typescript
export type PageType = 'search' | 'favorites' | 'history'
export type ToastType = 'success' | 'error' | 'warning' | 'info'
```

### CSS Guidelines

- Use CSS variables from `:root` for theming
- Follow BEM-like naming: `.block-element--modifier`
- Dark theme is the only theme (no light mode)
- Spacing: 4px grid system (4, 8, 12, 16, 24)
- Colors defined in `src/index.css` :root

### API Calls

- Define API functions in `src/utils/api.ts`
- Use AbortController for request timeouts
- Validate response format before returning
- Build prompts as template literals

## Project Structure

```
src/
├── components/     # React components
├── hooks/          # Custom React hooks
├── pages/          # Page components
├── stores/         # Zustand state stores
├── types/          # TypeScript types
├── utils/          # Utility functions
├── index.css       # Global styles
├── main.tsx        # App entry
└── App.tsx         # Root component

src-tauri/          # Rust backend (Tauri)
```

## Key Dependencies

- **@tauri-apps/api** - Tauri JavaScript API
- **zustand** - State management
- **dexie** - IndexedDB wrapper
- **lucide-react** - Icons
- **tailwindcss** v4 - CSS framework
- **uuid** - UUID generation

## Development Notes

- Window size: 400x600px (fixed, frameless)
- Uses IndexedDB via Dexie.js for local data
- localStorage for user settings
- System tray integration
- Clipboard monitoring for auto-translate
- Supports Chinese ↔ English translation

## Code Sync Rule

- **Always modify code in WSL only** (`~/Workspace/aict1`)
- **Never modify Windows files** under `/mnt/d/Workspace/aict1/`
- The user syncs code from WSL to Windows using `wsync`
- If you need to check something on Windows, read only — do not write
