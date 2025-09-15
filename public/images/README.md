# Images Directory

This directory contains static images for the Frigo SaaS application.

## Image Guidelines

### **Recommended Image Sizes:**
- **Icons**: 32x32px, 64x64px, or 128x128px
- **Logos**: 200x200px or higher
- **Product Images**: 400x400px or higher
- **Background Images**: 1920x1080px or higher

### **Supported Formats:**
- **PNG**: Best for icons and images with transparency
- **JPG**: Best for photographs
- **SVG**: Best for scalable icons and logos
- **WebP**: Best for modern browsers (smaller file sizes)

### **Naming Convention:**
- Use kebab-case: `crate-icon.png`
- Be descriptive: `empty-crate-icon.png`
- Include size if multiple versions: `crate-icon-32.png`, `crate-icon-64.png`

## Usage in Components

### **Static Images (from public folder):**
```jsx
<img src="/images/crate-icon.png" alt="Caisse vide" />
```

### **With Error Handling:**
```jsx
<img 
  src="/images/crate-icon.png" 
  alt="Caisse vide" 
  onError={(e) => {
    e.currentTarget.src = '/images/fallback-icon.png';
  }}
/>
```

### **With Tailwind Classes:**
```jsx
<img 
  src="/images/crate-icon.png" 
  alt="Caisse vide" 
  className="w-8 h-8 object-contain rounded-lg"
/>
```

## Current Images

- `crate-icon.png` - Main crate icon for empty crates section
- `empty-crate.png` - Detailed empty crate image
- `icons/` - Directory for icon files
