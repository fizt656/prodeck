# ProDeck

AI-powered slide deck generator. Drop in some reference images, describe what you want, and get back polished presentation slides, designed according to your reference materials. This also includes structurring the narrative of the presentation based on your prompt -- your prompt can be simple (system will take more creative license), or very complex/structured (system will follow your instructions re: slide-by-slide layout, text displayed, etc).

Uses Gemini 3 for planning + image generation, with optional OpenAI support.

## What it does

- Takes your prompt + reference images and plans out a full deck structure
- Generates each slide as a 16:9 image (not HTML, actual rendered slides)
- Mimics the style/colors and 'brand kit' from your reference images
- Exports to `.pptx` (not editable, but works smoothly in PowerPoint, images are high resolution).

## Stack

- React + TypeScript + Vite
- Tailwind v4 + Framer Motion
- Gemini 3 (planning + images) / OpenAI gpt-image-1.5 (optional)
- PptxGenJS for export

## Setup

Need Node 18+, a Gemini API key, and optionally an OpenAI key.

```bash
git clone https://github.com/your-username/prodeck.git
cd prodeck
npm install
```

Create `.env.local`:

```bash
VITE_GOOGLE_API_KEY=your_key
VITE_OPENAI_API_KEY=your_key  # optional
```

Run it:

```bash
npm run dev
```

Then hit `http://localhost:5173`

## How to use

1. Write what you want the deck to be about (as detailed or as simple as you want)
2. Upload style reference images (logos, mood boards, slide template screenshots, whatever)
3. Choose the image model you want to use (make sure your api key is set)
4. Hit Generate
5. Export to pptx when done
