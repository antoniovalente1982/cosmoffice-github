# Cosmoffice Logo System 🚀

Un sistema di logo completo e moderno per Cosmoffice, con tema cosmico e design futuristico.

## Concept

Il logo rappresenta un **ufficio spaziale** - un pianeta che è anche un edificio per uffici, con:
- 🪐 Un anello orbitale che ruota
- 🏢 Forma di edificio per uffici al centro
- 🪟 Finestre colorate che pulsano
- 🛰️ Un satellite in orbita

## Colori del Brand

| Colore | Hex | Utilizzo |
|--------|-----|----------|
| Violet | `#8B5CF6` | Primario, gradienti |
| Cyan | `#06B6D4` | Secondario, accenti |
| Pink | `#EC4899` | Terziario, highlight |
| Dark | `#0F172A` | Sfondo |

## Componenti

### `<Logo />`

Il componente principale con molte varianti:

```tsx
import { Logo } from './components/ui/logo';

// Base
<Logo />

// Dimensioni: sm | md | lg | xl | hero
<Logo size="lg" />

// Stili: default | minimal | glow | spinning
<Logo variant="glow" />

// Con/senza testo
<Logo showText={false} />

// Animazione SVG
<Logo animated={true} />
```

### Props

| Prop | Tipo | Default | Descrizione |
|------|------|---------|-------------|
| `size` | `'sm' \| 'md' \| 'lg' \| 'xl' \| 'hero'` | `'md'` | Dimensione del logo |
| `animated` | `boolean` | `false` | Animazione SVG integrata |
| `showText` | `boolean` | `true` | Mostra il testo "Cosmoffice" |
| `variant` | `'default' \| 'minimal' \| 'glow' \| 'spinning'` | `'default'` | Stile visivo |

### `<LogoFavicon />`

Per generare favicon in diverse dimensioni:

```tsx
import { LogoFavicon } from './components/ui/logo';

<LogoFavicon size={32} />
<LogoFavicon size={64} />
```

### `<LogoSpinner />`

Loading spinner animato:

```tsx
import { LogoSpinner } from './components/ui/logo';

<LogoSpinner size={40} />
```

## Varianti

### Default
Sfondo gradient con bordo, design pulito e moderno.

### Minimal
Solo l'icona SVG senza sfondo, per usi dove serve discrezione.

### Glow ✨
Effetto glow animato con blur e pulsazione, per impatto massimo.

### Spinning 🔄
Logo in rotazione 3D continua, perfetto per hero section.

## File Generati

- `/components/ui/logo.tsx` - Componente React
- `/public/favicon.svg` - Favicon SVG
- `/app/logo-showcase/page.tsx` - Pagina showcase

## Animazioni

Il logo include diverse animazioni:

1. **Orbita rotante** - L'anello esterno ruota continuamente
2. **Pulsazione** - Il pianeta pulsa dolcemente
3. **Finestre** - Le finestre dell'ufficio si illuminano a turno
4. **Satellite** - Orbita attorno al pianeta
5. **Glow** - Effetto luce pulsante

## Showcase

Visita `/logo-showcase` per vedere tutte le varianti in azione!

## Utilizzo nella Navbar

```tsx
import { Logo } from '../components/ui/logo';

// Nella navbar
<Link href="/">
  <Logo size="md" animated={false} showText={true} variant="glow" />
</Link>
```

## Logo come Icona di Caricamento

```tsx
import { LogoSpinner } from '../components/ui/logo';

// Durante il caricamento
<div className="flex items-center justify-center">
  <LogoSpinner size={48} />
</div>
```
