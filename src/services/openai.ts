const API_KEY = import.meta.env.VITE_OPENAI_API_KEY || '';

if (!API_KEY) {
    console.warn("Missing VITE_OPENAI_API_KEY. OpenAI image generation will not work.");
}

const OPENAI_API_URL = 'https://api.openai.com/v1/images';

export class OpenAIService {
    /**
     * Generates a slide image using OpenAI's gpt-image-1 model.
     */
    async generateSlide(visualPrompt: string, referenceImages: File[]): Promise<string> {
        try {
            // Build the prompt, optionally referencing style from images
            // Note: OpenAI image generation doesn't accept reference images directly
            // We'll include a note about style in the prompt if refs exist
            let finalPrompt = visualPrompt;
            if (referenceImages.length > 0) {
                finalPrompt += `\n\nStyle note: Create this in a professional, polished presentation style.`;
            }
            finalPrompt += `\n\nEnsure the image has a 16:9 aspect ratio suitable for presentations.`;

            const response = await fetch(`${OPENAI_API_URL}/generations`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify({
                    model: 'gpt-image-1.5',
                    prompt: finalPrompt,
                    n: 1,
                    size: '1536x1024', // Landscape, closest to 16:9
                    quality: 'high',
                }),
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();

            // OpenAI returns base64 data or URL depending on response_format
            // Default is URL, but we need base64 for consistency with Gemini
            if (data.data?.[0]?.b64_json) {
                return `data:image/png;base64,${data.data[0].b64_json}`;
            } else if (data.data?.[0]?.url) {
                // Fetch the image and convert to base64
                const imageResponse = await fetch(data.data[0].url);
                const blob = await imageResponse.blob();
                return await this.blobToBase64(blob);
            }

            throw new Error("No image generated from OpenAI");

        } catch (error: any) {
            console.error("Error generating slide with OpenAI:", error);
            throw error;
        }
    }

    /**
     * Edits a slide image using OpenAI's gpt-image-1 model.
     */
    async editSlide(currentImage: string, instruction: string): Promise<string> {
        try {
            // OpenAI edit endpoint requires form data with image file
            const formData = new FormData();

            // Convert base64 to blob
            const base64Data = currentImage.split(',')[1] || currentImage;
            const byteCharacters = atob(base64Data);
            const byteNumbers = new Array(byteCharacters.length);
            for (let i = 0; i < byteCharacters.length; i++) {
                byteNumbers[i] = byteCharacters.charCodeAt(i);
            }
            const byteArray = new Uint8Array(byteNumbers);
            const blob = new Blob([byteArray], { type: 'image/png' });

            formData.append('model', 'gpt-image-1.5');
            formData.append('image', blob, 'slide.png');
            formData.append('prompt', `Edit this image: ${instruction}. Maintain the 16:9 aspect ratio and overall professional presentation style. Only change what is specified, keep everything else the same.`);
            formData.append('size', '1536x1024');

            const response = await fetch(`${OPENAI_API_URL}/edits`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${API_KEY}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const error = await response.json();
                throw new Error(`OpenAI API error: ${error.error?.message || response.statusText}`);
            }

            const data = await response.json();

            if (data.data?.[0]?.b64_json) {
                return `data:image/png;base64,${data.data[0].b64_json}`;
            } else if (data.data?.[0]?.url) {
                const imageResponse = await fetch(data.data[0].url);
                const blob = await imageResponse.blob();
                return await this.blobToBase64(blob);
            }

            throw new Error("No image generated from OpenAI edit");

        } catch (error: any) {
            console.error("Error editing slide with OpenAI:", error);
            throw error;
        }
    }

    private blobToBase64(blob: Blob): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onloadend = () => resolve(reader.result as string);
            reader.onerror = reject;
            reader.readAsDataURL(blob);
        });
    }
}

export const openAIService = new OpenAIService();
