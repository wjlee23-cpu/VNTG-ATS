# VNTG Design System Documentation

## Overview

The VNTG Design System is a modern, minimal, and accessible design framework built for the VNTG hiring platform. It leverages Tailwind CSS for utility-first styling and Radix UI primitives for accessible component behavior.

## Brand Colors

The VNTG brand uses a sophisticated blue palette with a high-energy yellow accent.

### Primary Colors

- **Main Brand Color**: `#5287FF` (`--primary`, `--brand-main`)
  - Used for primary actions, active states, and key highlights.
- **Deep Blue**: `#0248FF` (`--secondary`, `--brand-dark`)
  - Used for contrast, headers, and secondary brand elements.
- **Accent Yellow**: `#FFBA22` (`--accent`, `--brand-warning`)
  - Used for notifications, warnings, and high-priority callouts.

### Neutral Colors

- **Background**: `#FFFFFF` (`--background`)
- **Surface/Card**: `#FFFFFF` (`--card`)
- **Text/Foreground**: `#020817` (`--foreground`)
- **Muted Text**: `#64748B` (`--muted-foreground`)
- **Borders**: `#E2E8F0` (`--border`)

### Gradients

- **VNTG Gradient**: `linear-gradient(135deg, #0248FF 0%, #5287FF 100%)`
  - Used for primary buttons, active indicators, and brand symbols.
- **Subtle Gradient**: `linear-gradient(135deg, rgba(2, 72, 255, 0.05) 0%, rgba(82, 135, 255, 0.05) 100%)`
  - Used for background accents and hover states.

## Typography

The system uses a clean, sans-serif font stack prioritizing readability.

- **Font Family**: `Inter`, `system-ui`, `sans-serif`
- **Headings**:
  - `h1`: 2xl, Medium weight
  - `h2`: xl, Medium weight
  - `h3`: lg, Medium weight
- **Body**:
  - Base size: `16px` (`1rem`)
  - Small: `14px` (`0.875rem`)
  - Micro: `12px` (`0.75rem`)

## Components

### Buttons (`<Button />`)

Standard interactive elements.

- **Default**: Primary brand color background with white text.
- **Secondary**: Deep blue background.
- **Outline**: Bordered with transparent background.
- **Ghost**: Transparent background, used for subtle actions.
- **Destructive**: Red background for dangerous actions.

```tsx
<Button>Primary Action</Button>
<Button variant="outline">Secondary Action</Button>
```

### Badges (`<Badge />`)

Used for status indicators (e.g., Job Status, Candidate Stage).

- **Default**: Primary color.
- **Secondary**: Deep blue.
- **Outline**: Bordered.
- **Destructive**: Red (e.g., Rejected).

```tsx
<Badge>Active</Badge>
<Badge variant="outline">Draft</Badge>
```

### Cards (`<Card />`)

Container for grouped content. Modern variants include:

- **Modern Card**: `.card-modern` utility. Adds shadow, rounded corners (16px), and hover lift effect.
- **Glass Card**: `.glass-card` utility. Adds blur and translucency.

### Inputs & Forms

Standardized form controls with consistent focus states using the brand ring color (`#5287FF`).

## Layout

### Sidebar

A fixed, minimal icon-based sidebar for navigation.
- Width: `w-16` (64px)
- Fixed position: `fixed left-0`
- Z-Index: `z-50`

### TopBar

Sticky header containing global search and user profile actions.
- Height: `h-16` (64px)
- Sticky position: `sticky top-0`
- Z-Index: `z-10`

### Dashboard Grid

The main content area uses a responsive grid or flex layout to organize views like Candidates, Jobs, and Analytics.

## Utilities

### Shadows

- `shadow-sm`, `shadow-md`, `shadow-lg` for elevation.
- `shadow-blue`, `shadow-blue-lg` for colored glow effects matching the brand.

### Animations

- `animate-fade-in`: Simple opacity transition.
- `animate-slide-up`: Upward motion for entry.
- `animate-slide-in`: Right-to-left slide for side panels.
- `animate-scale-in`: Zoom-in effect for modals.

## Iconography

The system uses **Lucide React** for all icons. Icons should be consistent in size (usually `16px`, `18px`, or `20px`) and stroke width.

## Usage Example

```tsx
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Zap } from "lucide-react";

export function ExampleCard() {
  return (
    <div className="card-modern p-6">
      <div className="flex items-center gap-2 mb-4">
        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-brand-dark to-brand-main flex items-center justify-center">
          <Zap className="text-white" size={20} />
        </div>
        <h3 className="text-lg font-bold text-gray-900">New Feature</h3>
      </div>
      <p className="text-gray-600 mb-4">Description of the feature.</p>
      <div className="flex justify-between items-center">
        <Badge variant="secondary">New</Badge>
        <Button size="sm">Learn More</Button>
      </div>
    </div>
  );
}
```
