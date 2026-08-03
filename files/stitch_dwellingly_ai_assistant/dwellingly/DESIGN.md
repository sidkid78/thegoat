---
name: Dwellingly
colors:
  surface: '#f8f9fb'
  surface-dim: '#d8dadc'
  surface-bright: '#f8f9fb'
  surface-container-lowest: '#ffffff'
  surface-container-low: '#f2f4f6'
  surface-container: '#eceef0'
  surface-container-high: '#e6e8ea'
  surface-container-highest: '#e0e3e5'
  on-surface: '#191c1e'
  on-surface-variant: '#484551'
  inverse-surface: '#2d3133'
  inverse-on-surface: '#eff1f3'
  outline: '#797583'
  outline-variant: '#cac4d3'
  surface-tint: '#654eaf'
  primary: '#160047'
  on-primary: '#ffffff'
  primary-container: '#2c0a75'
  on-primary-container: '#967fe4'
  inverse-primary: '#cdbdff'
  secondary: '#006b54'
  on-secondary: '#ffffff'
  secondary-container: '#00fdc9'
  on-secondary-container: '#007058'
  tertiary: '#00170a'
  on-tertiary: '#ffffff'
  tertiary-container: '#002e1a'
  on-tertiary-container: '#00a367'
  error: '#D13438'
  on-error: '#ffffff'
  error-container: '#ffdad6'
  on-error-container: '#93000a'
  primary-fixed: '#e7deff'
  primary-fixed-dim: '#cdbdff'
  on-primary-fixed: '#20005f'
  on-primary-fixed-variant: '#4c3496'
  secondary-fixed: '#27ffcc'
  secondary-fixed-dim: '#00e0b2'
  on-secondary-fixed: '#002118'
  on-secondary-fixed-variant: '#00513f'
  tertiary-fixed: '#51ffad'
  tertiary-fixed-dim: '#00e292'
  on-tertiary-fixed: '#002111'
  on-tertiary-fixed-variant: '#005232'
  background: '#f8f9fb'
  on-background: '#191c1e'
  surface-variant: '#e0e3e5'
  deep-navy: '#2C0A75'
  intelligent-teal: '#07FFCB'
  spring-green: '#2FFBA5'
  surface-acrylic: rgba(255, 255, 255, 0.7)
  surface-mica: '#F8F9FA'
  success: '#107C10'
typography:
  headline-xl:
    fontFamily: Plus Jakarta Sans
    fontSize: 40px
    fontWeight: '700'
    lineHeight: 48px
    letterSpacing: -0.02em
  headline-lg:
    fontFamily: Plus Jakarta Sans
    fontSize: 32px
    fontWeight: '600'
    lineHeight: 40px
  headline-md:
    fontFamily: Plus Jakarta Sans
    fontSize: 24px
    fontWeight: '600'
    lineHeight: 32px
  body-lg:
    fontFamily: Inter
    fontSize: 18px
    fontWeight: '400'
    lineHeight: 28px
  body-md:
    fontFamily: Inter
    fontSize: 16px
    fontWeight: '400'
    lineHeight: 24px
  body-sm:
    fontFamily: Inter
    fontSize: 14px
    fontWeight: '400'
    lineHeight: 20px
  label-md:
    fontFamily: Inter
    fontSize: 12px
    fontWeight: '600'
    lineHeight: 16px
    letterSpacing: 0.05em
  headline-lg-mobile:
    fontFamily: Plus Jakarta Sans
    fontSize: 28px
    fontWeight: '600'
    lineHeight: 36px
rounded:
  sm: 0.125rem
  DEFAULT: 0.25rem
  md: 0.375rem
  lg: 0.5rem
  xl: 0.75rem
  full: 9999px
spacing:
  unit: 4px
  container-max: 1280px
  gutter: 1.5rem
  margin-mobile: 1rem
  margin-desktop: 2.5rem
---

## Brand & Style
The design system is engineered to evoke maximum trust and authority in the AI-powered real estate sector. The brand personality is **transparent, empowered, and future-ready**, positioning the product as an indispensable partner for real estate professionals. 

The aesthetic is heavily inspired by **Modern Corporate / Microsoft Fluent Design**, prioritizing clarity and efficiency. We utilize a "Mica" and "Acrylic" material approach to create a sense of physical space and depth without overwhelming the user. The interface feels lightweight and layered, using subtle motion and translucency to communicate state changes and hierarchy. High accessibility (WCAG 2.1) is not an afterthought but a core pillar of the visual language, ensuring the tool is reliable for all users in high-stakes real estate transactions.

## Colors
The palette is built on **High-Trust Blues and Intelligent Neutrals**. The primary color, a Deep Professional Navy (#2C0A75), provides an anchor of stability and authority. The secondary "Intelligent Teal" (#07FFCB) is used sparingly for high-impact actions and AI-driven insights, symbolizing the "spark" of intelligence.

We employ a "Neutral-First" strategy where the background utilizes a soft gray-blue tint rather than pure white to reduce eye strain during prolonged use. All text-to-background combinations must maintain a minimum 4.5:1 contrast ratio. The secondary green and teal accents are reserved for "success" states and generative AI indicators.

## Typography
The typography system uses **Plus Jakarta Sans** for headlines to provide a modern, approachable geometric feel, while **Inter** is used for all functional body and UI text for its extreme legibility and systematic performance.

We employ **Visual Chunking**: information is broken down into digestible groups using distinct weight variances rather than just size. Headlines are tight and impactful, while body text uses a generous line-height to improve the scanning of real estate listings and legal data. For mobile, headline sizes are scaled down to ensure that property titles and prices remain within the viewport without excessive wrapping.

## Layout & Spacing
The design system follows a **Fluid Grid** model based on a 4px baseline grid. Content is organized into a 12-column grid for desktop and a 4-column grid for mobile devices. 

Layout transitions should prioritize vertical flow to accommodate the mobile-first requirement. We utilize "Safe Margins" for AI-generated content blocks, giving them extra padding (32px+) to distinguish them from standard data entry fields. Breakpoints are set at 640px (Mobile-to-Tablet) and 1024px (Tablet-to-Desktop).

## Elevation & Depth
Depth is a functional tool in this design system, not just an aesthetic one. We use **Z-axis layering** to indicate hierarchy:

1.  **Layer 0 (Mica):** The base app surface. It is opaque and stable.
2.  **Layer 1 (Cards):** Standard content cards with a subtle 1px border (#E5E5E5) and a soft, low-blur shadow (0px 2px 4px rgba(0,0,0,0.04)).
3.  **Layer 2 (Acrylic/Overlays):** Modals and flyouts use a backdrop-blur effect (20px) to maintain context while focusing the user.
4.  **Layer 3 (Floating AI Assistant):** The highest elevation, utilizing a deep ambient shadow (0px 12px 24px rgba(44, 10, 117, 0.15)) to signal its persistent accessibility over all other content.

## Shapes
In alignment with the Fluent aesthetic, we use **Soft (0.25rem)** corners for functional UI elements like input fields and small buttons. Larger cards and containers use **rounded-lg (0.5rem)**. 

The only exception to the standard roundedness is the **Floating Action Button (FAB)** and state chips, which are **pill-shaped (full radius)** to distinguish them as interactive, high-velocity elements. This contrast between the structured "Safe" rectangles of the data and the fluid "Smart" shapes of the AI components reinforces the partnership between agent and machine.

## Components
- **AI Assistant FAB:** A persistent, circular button in the bottom-right corner. It uses a gradient of #2C0A75 to #07FFCB. On hover/tap, it expands with a subtle "Acrylic" blur menu.
- **Fluent-Style Cards:** White background, 1px neutral border, and 8px corner radius. Content inside is "chunked" with clear dividers between property details.
- **Buttons:**
    - *Primary:* Solid Deep Navy with white text.
    - *Secondary:* Ghost style with 1px Deep Navy border.
    - *AI-Action:* Teal background with Navy text for specific "Generate" or "Analyze" tasks.
- **Progress Bars:** Thin, 4px height, using the Intelligent Teal (#07FFCB) for completion states. Motion should be "linear-to-ease-out" to feel responsive.
- **Input Fields:** Soft rounded corners with a bottom-heavy 2px border that turns Deep Navy on focus. Labels are always visible in `label-md` style.
- **Property Chips:** Used for status (e.g., "Active," "Pending"). They use a pill-shape and high-contrast text for immediate recognition.