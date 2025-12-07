# ProDeck

**ProDeck** is a premium, AI-powered presentation generator that transforms simple text prompts and reference images into professional, visually stunning slide decks.

Built with a focus on high-fidelity design, ProDeck leverages Google's latest **Gemini 3 Pro** models to understand your aesthetic preferences and generate ready-to-present slides.

## ✨ Key Features

-   **🧠 Intelligent Planning**: Uses `gemini-3-pro-preview` to analyze your prompt and reference images, structuring a cohesive narrative and slide flow.
-   **🎨 Style Transfer**: Upload your own reference images (logos, mood boards, existing decks), and ProDeck will mimic the style, color palette, and vibe.
-   **🖼️ High-Fidelity Generation**: Generates full 16:9 slide images using `gemini-3-pro-image-preview`, ensuring complex layouts and embedded typography that standard HTML-to-PPT converters can't match.
-   **💾 Native PowerPoint Export**: Exports directly to `.pptx` format, with each slide rendered as a high-quality background for instant playback.
-   **💎 Premium UI**: A sleek, Apple-inspired interface built with Tailwind CSS and Framer Motion.

## 🛠️ Technology Stack

-   **Frontend**: React (TypeScript) + Vite
-   **Styling**: Tailwind CSS v4 + Framer Motion
-   **AI**: Google Generative AI SDK (`gemini-3-pro-preview`, `gemini-3-pro-image-preview`)
-   **Export**: PptxGenJS

## 🚀 Getting Started

### Prerequisites

-   Node.js (v18 or higher)
-   Comparison text editor (VS Code recommended)
-   A **Google Gemini API Key** with access to the `gemini-3-pro` models.

### Installation

1.  **Clone the repository**
    ```bash
    git clone https://github.com/your-username/prodeck.git
    cd prodeck
    ```

2.  **Install dependencies**
    ```bash
    npm install
    ```

3.  **Configure Environment**
    Create a `.env.local` file in the root directory and add your API Key:
    ```bash
    VITE_GOOGLE_API_KEY=your_actual_api_key_here
    ```

4.  **Run Development Server**
    ```bash
    npm run dev
    ```

5.  Open [http://localhost:5173](http://localhost:5173) in your browser.

## 📖 Usage

1.  **Describe your Deck**: Enter a prompt describing the topic, audience, and goal of your presentation (e.g., "A pitch deck for a new coffee brand focusing on sustainability").
2.  **Add References**: Upload 1 or more images to define the visual style. This could be your logo, a screenshot of your website, or a slide you like.
3.  **Generate**: Click "Generate Deck". The AI will first plan the structure and then generate each slide image.
4.  **Export**: Once finished, preview the slides and click "Export PPTX" to download your file.

## ⚠️ Status

**Prototype / Alpha**. This project is currently in active development. Features and API (Gemini models) are subject to change.

---