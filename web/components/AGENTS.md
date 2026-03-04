# COMPONENTS KNOWLEDGE BASE

**Generated:** 2026-03-04
**Commit:** N/A
**Branch:** N/A

## OVERVIEW
React UI components for the CacheFlow web application. Includes file browser, provider configuration, and common UI elements.

## STRUCTURE
```
./web/components/
├── files/                # File browser related components
├── providers/            # Cloud provider configuration UI
├── ui/                   # Common UI primitives
├── layout/               # Layout components
├── errors/               # Error display components
├── Sidebar/              # Navigation sidebar
├── FileBrowser/          # Main file browser component
├── ProviderCard/         # Cloud provider cards
├── FileActions/          # File operation buttons
├── hooks/                # Component-specific hooks
└── [...more components]  # Additional UI components
```

## WHERE TO LOOK
| Task | Location | Notes |
|------|----------|-------|
| File Browser | FileBrowser/ | Main file browsing interface |
| Provider Setup | providers/ | UI for connecting cloud accounts |
| File Operations | FileActions/ | Upload, download, delete operations |
| Error Handling | errors/ | Error display components |
| Layout | layout/ | Page structure components |
| Common UI | ui/ | Buttons, modals, inputs |

## CONVENTIONS
- Client Components for interactive elements
- Server Components for data fetching where possible
- TypeScript strict mode
- Responsive design with Tailwind CSS
- Accessible UI with proper ARIA attributes

## ANTI-PATTERNS (THIS PROJECT)
- Don't put heavy computations in render methods
- Avoid prop drilling - use Context API appropriately
- Never expose credentials in client components

## UNIQUE STYLES
- Server Components for initial data loading
- Client Components only when interactivity required
- Composition pattern for complex UI elements
- Tailwind CSS for styling with custom components