import { GoogleGenerativeAI, SchemaType, type Schema } from "@google/generative-ai";

const API_KEY = import.meta.env.VITE_GOOGLE_API_KEY || '';

if (!API_KEY) {
    console.warn("Missing VITE_GOOGLE_API_KEY. Please ensure it is set in your environment.");
}

const genAI = new GoogleGenerativeAI(API_KEY);

// Schema for the deck structure
const deckSchema: Schema = {
    description: "List of slides for the presentation",
    type: SchemaType.ARRAY,
    items: {
        type: SchemaType.OBJECT,
        properties: {
            slideNumber: { type: SchemaType.NUMBER },
            title: { type: SchemaType.STRING },
            visualPrompt: {
                type: SchemaType.STRING,
                description: "A VERY DETAILED description of the slide's visual appearance, including layout, background, and specific text content to be rendered in the image. Mention colors, fonts, and placement."
            },
        },
        required: ["slideNumber", "title", "visualPrompt"],
    },
};

export class GeminiService {
    private plannerModel: any;
    private imageModel: any;

    constructor() {
        this.plannerModel = genAI.getGenerativeModel({
            model: "gemini-3-pro-preview", // Planning model
            generationConfig: {
                responseMimeType: "application/json",
                responseSchema: deckSchema,
            },
        });

        this.imageModel = genAI.getGenerativeModel({
            model: "gemini-3-pro-image-preview", // Image generation model
        });
    }

    /**
     * Plans the deck structure based on user context, reference images, and context files (PDF/Text).
     */
    async planDeck(context: string, referenceImages: File[], contextFiles: File[] = [], slideCount: number = 6): Promise<any[]> {
        try {
            // Process Reference Images (Style)
            const imageParts = await Promise.all(
                referenceImages.map(async (file) => ({
                    inlineData: {
                        data: await this.fileToBase64(file),
                        mimeType: file.type,
                    },
                }))
            );

            // Process Context Files (Content)
            const contextParts = await Promise.all(
                contextFiles.map(async (file) => await this.fileToGenerativePart(file))
            );

            const prompt = `
        You are an expert Presentation Designer.
        Plan a professional slide deck about: "${context}".
        
        INPUTS:
        1. Reference Images: Use these for design style, colors, layout, and branding ONLY.
        2. Context Files: Use these documents (PDFs, text) as the SOURCE TRUTH for the content, data, and details of the presentation.
        
        TASK:
        Output a JSON list of EXACTLY ${slideCount} slides. 
        For each slide, write a 'visualPrompt' that is extremely detailed. 
        This 'visualPrompt' will be sent to an image generation model to create the FINAL SLIDE as a single image.
        
        The 'visualPrompt' MUST include:
        1. The exact text to appear on the slide (Headings, bullets, body) derived from the Context Files where applicable.
        2. The layout description (e.g., "Split screen", "Centered title").
        3. Stylistic commonalities from the Reference Images (hex codes, logo placement).
        4. Aspect ratio instruction: "Compose for 16:9".
      `;

            const result = await this.plannerModel.generateContent([prompt, ...imageParts, ...contextParts]);
            const response = await result.response;
            return JSON.parse(response.text());
        } catch (error) {
            console.error("Error planning deck:", error);
            throw error;
        }
    }

    /**
     * Generates a single slide image based on the visual prompt and references.
     */
    async generateSlide(visualPrompt: string, referenceImages: File[]): Promise<string> {
        try {
            const imageParts = await Promise.all(
                referenceImages.map(async (file) => ({
                    inlineData: {
                        data: await this.fileToBase64(file),
                        mimeType: file.type,
                    },
                }))
            );

            // Note: Gemini 3 Image model usage might differ slightly in final API, 
            // but assuming standard generateContent with 'image/png' output or similar is not standard.
            // Usually it's generateContent -> response.parts[0].inlineData or similar.
            // For now we assume standard text-to-image flow if supported, or we might need a specific 'imagine' tool if it was an agent.
            // Docs said: response.modalities = ['IMAGE'].

            const finalPrompt = `${visualPrompt} \n\nEnsure the generated image has a 16:9 aspect ratio.`;

            // Create a timeout promise
            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out")), 45000)
            );

            const generationPromise = this.imageModel.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: finalPrompt }, ...imageParts] }
                ],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                }
            });

            const result: any = await Promise.race([generationPromise, timeoutPromise]);

            const response = await result.response;

            // Extract image data
            // Check for inlineData in parts
            const parts = response.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }

            throw new Error("No image generated");

        } catch (error: any) {
            console.error("Error generating slide:", error);
            // Log full details for debugging
            if (error.response) {
                console.error("API Response Error:", await error.response.text());
            }
            throw error;
        }
    }

    /**
     * Edits a slide image based on user instruction.
     */
    async editSlide(currentImage: string, instruction: string): Promise<string> {
        try {
            // Remove data:image/xxx;base64, prefix if present
            const base64Data = currentImage.split(',')[1] || currentImage;

            const imagePart = {
                inlineData: {
                    data: base64Data,
                    mimeType: "image/png", // Assuming PNG for now
                },
            };

            const prompt = `Edit this image. Instruction: ${instruction}. 
            Maintain the exact same aspect ratio (16:9) and overall style. 
            Do not change parts of the image unrelated to the instruction.`;

            const timeoutPromise = new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Request timed out")), 45000)
            );

            const generationPromise = this.imageModel.generateContent({
                contents: [
                    { role: 'user', parts: [{ text: prompt }, imagePart] }
                ],
                generationConfig: {
                    responseModalities: ["IMAGE"],
                }
            });

            const result: any = await Promise.race([generationPromise, timeoutPromise]);

            const response = await result.response;

            const parts = response.candidates?.[0]?.content?.parts;
            if (parts) {
                for (const part of parts) {
                    if (part.inlineData) {
                        return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                    }
                }
            }

            throw new Error("No image generated from edit");

        } catch (error: any) {
            console.error("Error editing slide:", error);
            if (error.response) {
                console.error("API Response Error:", await error.response.text());
            }
            throw error;
        }
    }

    private fileToBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => {
                const result = reader.result as string;
                // Remove data URL prefix (e.g. "data:image/png;base64,")
                const base64 = result.split(',')[1];
                resolve(base64);
            };
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    private async fileToGenerativePart(file: File): Promise<any> {
        // Handle Text Files (txt, md, csv, html)
        if (file.type.startsWith('text/') || file.name.endsWith('.md') || file.name.endsWith('.csv')) {
            const text = await file.text();
            return {
                text: `[FILE: ${file.name}]\n${text}\n[END FILE]`
            };
        }
        // Handle PDF and Images
        else {
            const base64Data = await this.fileToBase64(file);
            return {
                inlineData: {
                    data: base64Data,
                    mimeType: file.type
                }
            };
        }
    }
}

export const geminiService = new GeminiService();
