import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { RefreshCw } from 'lucide-react';

export default function SignatureDialog({ isOpen, onClose, onSave, userName }) {
    const canvasRef = useRef(null);
    const [isDrawing, setIsDrawing] = useState(false);

    const getCanvasContext = () => {
        const canvas = canvasRef.current;
        if (!canvas) return null;
        return canvas.getContext('2d');
    };

    useEffect(() => {
        if (isOpen) {
            // Delay context access until canvas is mounted and visible
            setTimeout(() => {
                const canvas = canvasRef.current;
                if (!canvas) return;
                const ctx = getCanvasContext();
                canvas.width = canvas.offsetWidth;
                canvas.height = canvas.offsetHeight;
                ctx.strokeStyle = '#1e293b'; // slate-800
                ctx.lineWidth = 2;
                ctx.lineCap = 'round';
                ctx.lineJoin = 'round';
            }, 0);
        }
    }, [isOpen]);

    const getCoords = (e) => {
        const canvas = canvasRef.current;
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top,
            };
        }
        return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
    };

    const startDrawing = (e) => {
        const { offsetX, offsetY } = getCoords(e);
        const ctx = getCanvasContext();
        ctx.beginPath();
        ctx.moveTo(offsetX, offsetY);
        setIsDrawing(true);
    };

    const draw = (e) => {
        if (!isDrawing) return;
        e.preventDefault(); // Prevent scrolling on touch devices
        const { offsetX, offsetY } = getCoords(e);
        const ctx = getCanvasContext();
        ctx.lineTo(offsetX, offsetY);
        ctx.stroke();
    };

    const stopDrawing = () => {
        const ctx = getCanvasContext();
        if (ctx) ctx.closePath();
        setIsDrawing(false);
    };

    const handleClear = () => {
        const canvas = canvasRef.current;
        const ctx = getCanvasContext();
        ctx.clearRect(0, 0, canvas.width, canvas.height);
    };

    const handleSaveDrawnSignature = () => {
        const canvas = canvasRef.current;
        // Check if canvas is empty
        const blank = document.createElement('canvas');
        blank.width = canvas.width;
        blank.height = canvas.height;
        if (canvas.toDataURL() === blank.toDataURL()) {
            onSave(null); // Nothing drawn
        } else {
            const dataUrl = canvas.toDataURL('image/png');
            onSave(dataUrl);
        }
        onClose();
    };
    
    const handleSaveTypedSignature = () => {
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = 400;
        tempCanvas.height = 150;
        const ctx = tempCanvas.getContext('2d');
        ctx.font = '48px "Brush Script MT", cursive';
        ctx.fillStyle = '#1e293b';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(userName, tempCanvas.width / 2, tempCanvas.height / 2);
        const dataUrl = tempCanvas.toDataURL('image/png');
        onSave(dataUrl);
        onClose();
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-md">
                <DialogHeader>
                    <DialogTitle>Provide E-Signature</DialogTitle>
                </DialogHeader>
                <Tabs defaultValue="draw">
                    <TabsList className="grid w-full grid-cols-2">
                        <TabsTrigger value="draw">Draw Signature</TabsTrigger>
                        <TabsTrigger value="type">Type Signature</TabsTrigger>
                    </TabsList>
                    <TabsContent value="draw" className="mt-4">
                        <div className="relative">
                            <canvas
                                ref={canvasRef}
                                onMouseDown={startDrawing}
                                onMouseMove={draw}
                                onMouseUp={stopDrawing}
                                onMouseLeave={stopDrawing}
                                onTouchStart={startDrawing}
                                onTouchMove={draw}
                                onTouchEnd={stopDrawing}
                                className="w-full h-48 bg-slate-100 rounded-md cursor-crosshair border border-slate-300"
                            />
                            <Button variant="ghost" size="icon" className="absolute top-2 right-2 text-slate-500 hover:text-slate-800" onClick={handleClear}>
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button onClick={handleSaveDrawnSignature}>Save Drawn Signature</Button>
                        </div>
                    </TabsContent>
                    <TabsContent value="type" className="mt-4">
                        <div className="w-full h-48 bg-slate-100 rounded-md flex items-center justify-center border border-slate-300">
                            <p className="text-4xl text-slate-800" style={{ fontFamily: '"Brush Script MT", cursive' }}>
                                {userName}
                            </p>
                        </div>
                         <div className="flex justify-end gap-2 mt-4">
                            <Button variant="outline" onClick={onClose}>Cancel</Button>
                            <Button onClick={handleSaveTypedSignature}>Use Typed Signature</Button>
                        </div>
                    </TabsContent>
                </Tabs>
            </DialogContent>
        </Dialog>
    );
}