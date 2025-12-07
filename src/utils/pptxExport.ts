import pptxgen from 'pptxgenjs';

interface SlideData {
    imageData?: string; // base64
}

export const exportPresentation = (slides: SlideData[]) => {
    const pptx = new pptxgen();

    slides.forEach(slide => {
        if (slide.imageData) {
            const s = pptx.addSlide();
            // Use addImage instead of background for better reliability
            s.addImage({
                data: slide.imageData,
                x: 0,
                y: 0,
                w: "100%",
                h: "100%"
            });
        }
    });

    pptx.writeFile({ fileName: `ProDeck_${new Date().toISOString()}.pptx` });
};
