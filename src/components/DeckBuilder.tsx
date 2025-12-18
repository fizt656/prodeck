import React, { useState, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Upload, Play, Download, Loader2, Image as ImageIcon, X, Edit2, FileUp } from 'lucide-react';
import { geminiService } from '../services/gemini';
import { imageService, type ImageModel } from '../services/imageService';
import { exportPresentation } from '../utils/pptxExport';
import JSZip from 'jszip';

interface Slide {
    slideNumber: number;
    title: string;
    visualPrompt: string;
    imageData?: string; // base64
    status: 'pending' | 'generating' | 'done' | 'error';
}

export const DeckBuilder: React.FC = () => {
    const [context, setContext] = useState('');
    const [refImages, setRefImages] = useState<File[]>([]);
    const [contextFiles, setContextFiles] = useState<File[]>([]);
    const [slides, setSlides] = useState<Slide[]>([]);
    const [slideCount, setSlideCount] = useState<number>(6);
    const [currentStep, setCurrentStep] = useState<'input' | 'planning' | 'generating' | 'preview'>('input');
    const [isImporting, setIsImporting] = useState(false);
    const [imageModel, setImageModel] = useState<ImageModel>('gemini');

    const fileInputRef = useRef<HTMLInputElement>(null);
    const contextInputRef = useRef<HTMLInputElement>(null);
    const pptInputRef = useRef<HTMLInputElement>(null);

    const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setRefImages(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const handleContextUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.files) {
            setContextFiles(prev => [...prev, ...Array.from(e.target.files!)]);
        }
    };

    const handlePPTUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setIsImporting(true);
        try {
            const zip = await JSZip.loadAsync(file);
            const newSlides: Slide[] = [];

            // 1. Identify slides from ppt/presentation.xml or just by scanning ppt/slides/slide*.xml
            // A safer heuristic for generated decks is sorting slideN.xml files
            const slideFiles = Object.keys(zip.files).filter(path =>
                path.match(/^ppt\/slides\/slide\d+\.xml$/)
            ).sort((a, b) => {
                const numA = parseInt(a.match(/slide(\d+)\.xml/)![1]);
                const numB = parseInt(b.match(/slide(\d+)\.xml/)![1]);
                return numA - numB;
            });

            for (const slidePath of slideFiles) {
                const slideNum = parseInt(slidePath.match(/slide(\d+)\.xml/)![1]);

                // 2. Find relationships for this slide
                // Rel path is ppt/slides/_rels/slideX.xml.rels
                const relPath = slidePath.replace('ppt/slides/', 'ppt/slides/_rels/') + '.rels';
                const relFile = zip.file(relPath);

                if (relFile) {
                    const relXmlText = await relFile.async('text');
                    const parser = new DOMParser();
                    const relDoc = parser.parseFromString(relXmlText, "text/xml");

                    // Find image relationship
                    // Look for Type=".../image"
                    const relationships = relDoc.getElementsByTagName('Relationship');
                    let targetPath = '';

                    for (let i = 0; i < relationships.length; i++) {
                        const rel = relationships[i];
                        if (rel.getAttribute('Type')?.includes('/image')) {
                            targetPath = rel.getAttribute('Target') || '';
                            break;
                        }
                    }

                    if (targetPath) {
                        // Resolve target path (usually relative to slide, e.g. "../media/image1.png")
                        // If it starts with .., resolve it. ppt/slides/ + ../media -> ppt/media
                        let fullPath = '';
                        if (targetPath.startsWith('../')) {
                            fullPath = 'ppt/' + targetPath.replace('../', '');
                        } else {
                            fullPath = 'ppt/slides/' + targetPath;
                        }

                        // 3. Extract image
                        const imgFile = zip.file(fullPath);
                        if (imgFile) {
                            const imgBase64 = await imgFile.async('base64');
                            const imgExt = fullPath.split('.').pop() || 'png';
                            // Infer MIME type
                            const mime = imgExt === 'jpg' || imgExt === 'jpeg' ? 'image/jpeg' : 'image/png';

                            newSlides.push({
                                slideNumber: slideNum,
                                title: `Imported Slide ${slideNum}`,
                                visualPrompt: "Imported slide content", // Placeholder
                                status: 'done',
                                imageData: `data:${mime};base64,${imgBase64}`
                            });
                        }
                    }
                }
            }

            if (newSlides.length > 0) {
                setSlides(newSlides);
                // Try to infer context from filename if empty? No, keep it simple.
                setCurrentStep('preview');
            } else {
                alert("No slides/images found in this PPTX.");
            }

        } catch (error) {
            console.error("Failed to parse PPTX", error);
            alert("Failed to load PPTX. Ensure it is a valid PowerPoint file.");
        } finally {
            setIsImporting(false);
            if (pptInputRef.current) pptInputRef.current.value = '';
        }
    };

    const removeImage = (index: number) => {
        setRefImages(prev => prev.filter((_, i) => i !== index));
    };

    const removeContextFile = (index: number) => {
        setContextFiles(prev => prev.filter((_, i) => i !== index));
    };

    const [editingSlide, setEditingSlide] = useState<number | null>(null);
    const [editInstruction, setEditInstruction] = useState('');

    const handleEditStart = (slideNumber: number) => {
        setEditingSlide(slideNumber);
        setEditInstruction('');
    };

    const handleEditCancel = () => {
        setEditingSlide(null);
        setEditInstruction('');
    };

    const handleEditSubmit = async (slideNumber: number) => {
        if (!editInstruction.trim()) return;

        const slideIndex = slides.findIndex(s => s.slideNumber === slideNumber);
        if (slideIndex === -1) return;

        const currentSlide = slides[slideIndex];
        if (!currentSlide.imageData) return;

        // Update status to generating
        setSlides(prev => prev.map(s =>
            s.slideNumber === slideNumber ? { ...s, status: 'generating' } : s
        ));
        setEditingSlide(null);

        try {
            const newImageData = await imageService.editSlide(currentSlide.imageData, editInstruction, imageModel);

            setSlides(prev => prev.map(s =>
                s.slideNumber === slideNumber ? { ...s, imageData: newImageData, status: 'done' } : s
            ));
        } catch (error) {
            console.error("Edit failed", error);
            setSlides(prev => prev.map(s =>
                s.slideNumber === slideNumber ? { ...s, status: 'error' } : s
            ));
        }
    };

    const startGeneration = async () => {
        if (!context || refImages.length === 0) {
            alert("Please provide context and at least one reference image.");
            return;
        }

        setCurrentStep('planning');

        try {
            // 1. Plan Structure
            const plannedSlides = await geminiService.planDeck(context, refImages, contextFiles, slideCount);

            const initialSlides = plannedSlides.map((s: any) => ({
                ...s,
                status: 'pending'
            }));

            setSlides(initialSlides);
            setCurrentStep('generating');

            // 2. Generate Images Sequentially
            for (let i = 0; i < initialSlides.length; i++) {
                setSlides(prev => prev.map((slide, idx) =>
                    idx === i ? { ...slide, status: 'generating' } : slide
                ));

                try {
                    const imageData = await imageService.generateSlide(initialSlides[i].visualPrompt, refImages, imageModel);

                    setSlides(prev => prev.map((slide, idx) =>
                        idx === i ? { ...slide, imageData, status: 'done' } : slide
                    ));
                } catch (err) {
                    console.error(`Failed to generate slide ${i + 1}`, err);
                    setSlides(prev => prev.map((slide, idx) =>
                        idx === i ? { ...slide, status: 'error' } : slide
                    ));
                }
            }
            setCurrentStep('preview');

        } catch (error) {
            console.error("Workflow failed", error);
            setCurrentStep('input');
            alert("Something went wrong. Check console.");
        }
    };

    const handleExport = () => {
        exportPresentation(slides);
    };

    return (
        <div className="max-w-6xl mx-auto p-8 w-full">
            <AnimatePresence mode='wait'>
                {currentStep === 'input' && (
                    <motion.div
                        initial={{ opacity: 0, y: 20 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -20 }}
                        className="flex flex-col gap-8"
                    >
                        <div className="text-center space-y-2">
                            <h1 className="text-4xl font-semibold tracking-tight text-gray-900">Create your deck.</h1>
                            <p className="text-gray-500 text-lg">Upload docs for content. Upload images for style.</p>
                        </div>

                        <div className="bg-white/80 backdrop-blur-xl rounded-3xl p-8 shadow-sm border border-white/20 ring-1 ring-black/5">
                            <textarea
                                value={context}
                                onChange={(e) => setContext(e.target.value)}
                                placeholder="Describe your presentation... (e.g., 'Q3 Marketing Strategy for a coffee brand focusing on community and sustainability')"
                                className="w-full h-40 bg-transparent text-xl placeholder:text-gray-300 border-none focus:ring-0 resize-none outline-none leading-relaxed text-gray-800"
                            />

                            <div className="mt-8 pt-8 border-t border-gray-100 flex items-center justify-between">
                                <div className="flex gap-4 overflow-x-auto pb-2">
                                    {/* Visual Refs Input */}
                                    <div
                                        onClick={() => fileInputRef.current?.click()}
                                        className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-blue-500 hover:text-blue-500 transition-colors"
                                    >
                                        <ImageIcon size={20} />
                                        <span className="text-[10px] mt-2 font-medium uppercase tracking-wide">Style Refs</span>
                                    </div>
                                    <input
                                        type="file"
                                        multiple
                                        ref={fileInputRef}
                                        className="hidden"
                                        accept="image/*"
                                        onChange={handleImageUpload}
                                    />
                                    {refImages.map((file, i) => (
                                        <div key={i} className="relative group w-24 h-24 flex-shrink-0">
                                            <img
                                                src={URL.createObjectURL(file)}
                                                alt="ref"
                                                className="w-full h-full object-cover rounded-2xl shadow-sm"
                                            />
                                            <button
                                                onClick={() => removeImage(i)}
                                                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} className="text-red-500" />
                                            </button>
                                        </div>
                                    ))}

                                    {/* Vertical Separator */}
                                    <div className="w-px h-16 bg-gray-200 mx-2" />

                                    {/* Context Docs Input */}
                                    <div
                                        onClick={() => contextInputRef.current?.click()}
                                        className="w-24 h-24 rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center justify-center text-gray-400 cursor-pointer hover:border-emerald-500 hover:text-emerald-500 transition-colors"
                                    >
                                        <Upload size={20} />
                                        <span className="text-[10px] mt-2 font-medium uppercase tracking-wide">Context Docs</span>
                                    </div>
                                    <input
                                        type="file"
                                        multiple
                                        ref={contextInputRef}
                                        className="hidden"
                                        accept=".pdf,.txt,.md,.csv"
                                        onChange={handleContextUpload}
                                    />
                                    {contextFiles.map((file, i) => (
                                        <div key={i} className="relative group w-24 h-24 flex-shrink-0 bg-emerald-50 rounded-2xl border border-emerald-100 flex flex-col items-center justify-center text-center p-2">
                                            <span className="text-[10px] uppercase font-bold text-emerald-600 mb-1 truncate w-full">{file.name.split('.').pop()}</span>
                                            <span className="text-[10px] text-gray-600 leading-tight line-clamp-2 break-all">{file.name}</span>
                                            <button
                                                onClick={() => removeContextFile(i)}
                                                className="absolute -top-2 -right-2 bg-white rounded-full p-1 shadow-md opacity-0 group-hover:opacity-100 transition-opacity"
                                            >
                                                <X size={12} className="text-red-500" />
                                            </button>
                                        </div>
                                    ))}
                                </div>

                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-500">
                                        Length: <span className="text-gray-900">{slideCount} slides</span>
                                    </label>
                                    <input
                                        type="range"
                                        min="3"
                                        max="20"
                                        value={slideCount}
                                        onChange={(e) => setSlideCount(Number(e.target.value))}
                                        className="accent-black h-1 bg-gray-200 rounded-lg appearance-none cursor-pointer w-32"
                                    />
                                </div>

                                {/* Image Model Toggle */}
                                <div className="flex flex-col gap-2">
                                    <label className="text-sm font-medium text-gray-500">Image Model</label>
                                    <div className="flex bg-gray-100 rounded-lg p-1">
                                        <button
                                            onClick={() => setImageModel('gemini')}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${imageModel === 'gemini'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            Gemini 3
                                        </button>
                                        <button
                                            onClick={() => setImageModel('openai')}
                                            className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${imageModel === 'openai'
                                                    ? 'bg-white text-gray-900 shadow-sm'
                                                    : 'text-gray-500 hover:text-gray-700'
                                                }`}
                                        >
                                            OpenAI
                                        </button>
                                    </div>
                                </div>
                                <div className="flex flex-col gap-2 items-end">
                                    <button
                                        onClick={startGeneration}
                                        disabled={!context || refImages.length === 0}
                                        className="bg-black text-white px-8 py-4 rounded-full font-medium text-lg hover:scale-105 active:scale-95 transition-all disabled:opacity-50 disabled:hover:scale-100 shadow-lg flex items-center gap-2"
                                    >
                                        <Play size={20} fill="currentColor" />
                                        Generate Deck
                                    </button>

                                    {/* Import PPTX Button */}
                                    <div className="flex items-center gap-2">
                                        <input
                                            type="file"
                                            ref={pptInputRef}
                                            className="hidden"
                                            accept=".pptx"
                                            onChange={handlePPTUpload}
                                        />
                                        <button
                                            onClick={() => pptInputRef.current?.click()}
                                            disabled={isImporting}
                                            className="text-xs text-gray-500 hover:text-black flex items-center gap-1 transition-colors disabled:opacity-50"
                                        >
                                            {isImporting ? <Loader2 size={12} className="animate-spin" /> : <FileUp size={12} />}
                                            Import Existing .pptx
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}

                {currentStep === 'planning' && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="flex flex-col items-center justify-center min-h-[60vh] text-center"
                    >
                        <Loader2 size={48} className="animate-spin text-gray-400 mb-4" />
                        <h2 className="text-2xl font-medium text-gray-800">Planning your narrative...</h2>
                        <p className="text-gray-500 mt-2">Analyzing reference aesthetics and structuring slides.</p>
                    </motion.div>
                )}

                {(currentStep === 'generating' || currentStep === 'preview') && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        className="space-y-8"
                    >
                        <div className="flex items-center justify-between">
                            <h2 className="text-2xl font-semibold text-gray-900">Your Deck</h2>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => {
                                        setSlides([]);
                                        setCurrentStep('input');
                                    }}
                                    className="px-4 py-2 text-gray-500 font-medium hover:text-black transition-colors"
                                >
                                    Start Over
                                </button>
                                {currentStep === 'preview' && (
                                    <button
                                        onClick={handleExport}
                                        className="bg-blue-600 text-white px-6 py-2 rounded-full font-medium hover:bg-blue-700 transition-colors flex items-center gap-2 shadow-sm"
                                    >
                                        <Download size={18} />
                                        Export PPTX
                                    </button>
                                )}
                            </div>
                        </div>

                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {slides.map((slide) => (
                                <motion.div
                                    key={slide.slideNumber}
                                    layoutId={`slide-${slide.slideNumber}`}
                                    className="aspect-video bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden relative group"
                                >
                                    {slide.imageData ? (
                                        <>
                                            <img src={slide.imageData} alt={slide.title} className="w-full h-full object-cover" />
                                            {slide.status === 'generating' && (
                                                <div className="absolute inset-0 bg-black/50 flex flex-col items-center justify-center backdrop-blur-sm z-10 transition-all duration-300">
                                                    <Loader2 size={32} className="animate-spin text-white mb-2" />
                                                    <span className="text-white text-sm font-medium">Regenerating...</span>
                                                </div>
                                            )}
                                        </>
                                    ) : (
                                        <div className="w-full h-full flex flex-col items-center justify-center bg-gray-50 text-gray-400 p-4 text-center">
                                            {slide.status === 'generating' ? (
                                                <Loader2 size={32} className="animate-spin text-blue-500" />
                                            ) : slide.status === 'error' ? (
                                                <div className="text-red-500 flex flex-col items-center">
                                                    <X size={32} />
                                                    <span className="mt-2 text-sm font-medium">Generation Failed</span>
                                                </div>
                                            ) : (
                                                <ImageIcon size={32} />
                                            )}
                                            <span className="mt-2 text-sm font-medium">
                                                {slide.status === 'generating' ? 'Rendering...' : slide.status === 'error' ? '' : 'Waiting...'}
                                            </span>
                                        </div>
                                    )}
                                    <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/50 to-transparent p-4 opacity-0 group-hover:opacity-100 transition-opacity flex justify-between items-end">
                                        <p className="text-white text-sm font-medium">{slide.title}</p>

                                        {slide.status === 'done' && (
                                            <button
                                                onClick={() => handleEditStart(slide.slideNumber)}
                                                className="bg-white/20 hover:bg-white/40 backdrop-blur-md text-white p-2 rounded-lg transition-colors"
                                            >
                                                <Edit2 size={16} />
                                            </button>
                                        )}
                                    </div>

                                    {/* Edit Overlay */}
                                    {editingSlide === slide.slideNumber && (
                                        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4 z-10">
                                            <div className="bg-white rounded-xl p-4 w-full shadow-2xl space-y-3">
                                                <h3 className="text-sm font-semibold text-gray-900">Edit Slide</h3>
                                                <textarea
                                                    value={editInstruction}
                                                    onChange={(e) => setEditInstruction(e.target.value)}
                                                    placeholder="e.g. 'Make the background darker' or 'Change text to...'"
                                                    className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:ring-2 focus:ring-blue-500 outline-none resize-none h-20"
                                                    autoFocus
                                                />
                                                <div className="flex justify-end gap-2">
                                                    <button
                                                        onClick={handleEditCancel}
                                                        className="text-xs px-3 py-1.5 text-gray-500 font-medium hover:text-gray-700"
                                                    >
                                                        Cancel
                                                    </button>
                                                    <button
                                                        onClick={() => handleEditSubmit(slide.slideNumber)}
                                                        className="text-xs px-3 py-1.5 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700"
                                                    >
                                                        Update
                                                    </button>
                                                </div>
                                            </div>
                                        </div>
                                    )}
                                </motion.div>
                            ))}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
};
