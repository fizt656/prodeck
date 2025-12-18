import { geminiService } from './gemini';
import { openAIService } from './openai';

export type ImageModel = 'gemini' | 'openai';

/**
 * Unified image service that delegates to the appropriate backend
 * based on the selected model.
 */
export const imageService = {
    /**
     * Generate a slide image using the specified model.
     */
    async generateSlide(
        visualPrompt: string,
        referenceImages: File[],
        model: ImageModel = 'gemini'
    ): Promise<string> {
        if (model === 'openai') {
            return openAIService.generateSlide(visualPrompt, referenceImages);
        }
        return geminiService.generateSlide(visualPrompt, referenceImages);
    },

    /**
     * Edit a slide image using the specified model.
     */
    async editSlide(
        currentImage: string,
        instruction: string,
        model: ImageModel = 'gemini'
    ): Promise<string> {
        if (model === 'openai') {
            return openAIService.editSlide(currentImage, instruction);
        }
        return geminiService.editSlide(currentImage, instruction);
    },
};
