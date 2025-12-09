import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { RefreshCw, Lock } from 'lucide-react';

export default function DualSignatureDialog({ 
    isOpen, 
    onClose, 
    onSave,
    initialSignature1 = null,
    initialSignedByName1 = null,
    initialSignature2 = null,
    initialSignedByName2 = null,
    suggestedName1 = '',
    suggestedName2 = ''
}) {
    const canvas1Ref = useRef(null);
    const canvas2Ref = useRef(null);
    const [isDrawing1, setIsDrawing1] = useState(false);
    const [isDrawing2, setIsDrawing2] = useState(false);
    const [name1, setName1] = useState('');
    const [name2, setName2] = useState('');

    useEffect(() => {
        if (isOpen) {
            setName1(initialSignedByName1 || suggestedName1 || '');
            setName2(initialSignedByName2 || suggestedName2 || '');
            
            setTimeout(() => {
                [canvas1Ref, canvas2Ref].forEach((canvasRef, idx) => {
                    const canvas = canvasRef.current;
                    if (!canvas) return;
                    
                    const ctx = canvas.getContext('2d');
                    canvas.width = canvas.offsetWidth;
                    canvas.height = canvas.offsetHeight;
                    ctx.strokeStyle = '#1e293b';
                    ctx.lineWidth = 2;
                    ctx.lineCap = 'round';
                    ctx.lineJoin = 'round';
                    
                    const existingSig = idx === 0 ? initialSignature1 : initialSignature2;
                    if (existingSig) {
                        const img = new Image();
                        img.onload = () => {
                            ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        };
                        img.src = existingSig;
                    }
                });
            }, 100);
        }
    }, [isOpen, initialSignature1, initialSignature2, initialSignedByName1, initialSignedByName2, suggestedName1, suggestedName2]);

    const getCoords = (e, canvasRef) => {
        const canvas = canvasRef.current;
        if (!canvas) return { offsetX: 0, offsetY: 0 };
        const rect = canvas.getBoundingClientRect();
        if (e.touches && e.touches.length > 0) {
            return {
                offsetX: e.touches[0].clientX - rect.left,
                offsetY: e.touches[0].clientY - rect.top,
            };
        }
        return { offsetX: e.nativeEvent.offsetX, offsetY: e.nativeEvent.offsetY };
    };

    const startDrawing = (e, canvasRef, setDrawing) => {
        const { offsetX, offsetY } = getCoords(e, canvasRef);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.beginPath();
            ctx.moveTo(offsetX, offsetY);
            setDrawing(true);
        }
    };

    const draw = (e, canvasRef, isDrawing) => {
        if (!isDrawing) return;
        e.preventDefault();
        const { offsetX, offsetY } = getCoords(e, canvasRef);
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) {
            ctx.lineTo(offsetX, offsetY);
            ctx.stroke();
        }
    };

    const stopDrawing = (canvasRef, setDrawing) => {
        const ctx = canvasRef.current?.getContext('2d');
        if (ctx) ctx.closePath();
        setDrawing(false);
    };

    const handleClear = (canvasRef) => {
        const canvas = canvasRef.current;
        if (!canvas) return;
        const ctx = canvas.getContext('2d');
        if (ctx) {
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }
    };

    const isCanvasEmpty = (canvasRef) => {
        const canvas = canvasRef.current;
        if (!canvas) return true;
        const ctx = canvas.getContext('2d');
        const pixelData = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        for (let i = 0; i < pixelData.length; i += 4) {
            if (pixelData[i + 3] !== 0) {
                return false;
            }
        }
        return true;
    };

    const handleLockSignatures = () => {
        try {
            const sig1Empty = isCanvasEmpty(canvas1Ref);
            const sig2Empty = isCanvasEmpty(canvas2Ref);
            
            if (sig1Empty && sig2Empty) {
                alert('Please provide at least one signature before locking');
                return;
            }

            if (!sig1Empty && !name1.trim()) {
                alert('Please enter name for Office Holder');
                return;
            }

            if (!sig2Empty && !name2.trim()) {
                alert('Please enter name for Admin');
                return;
            }

            const result = {
                signature1: !sig1Empty ? canvas1Ref.current.toDataURL('image/png') : null,
                name1: !sig1Empty ? name1.trim() : null,
                signature2: !sig2Empty ? canvas2Ref.current.toDataURL('image/png') : null,
                name2: !sig2Empty ? name2.trim() : null
            };

            if (typeof onSave === 'function') {
                onSave(result);
            }
            
            if (typeof onClose === 'function') {
                onClose();
            }
        } catch (error) {
            console.error('Error locking signatures:', error);
            alert('Error saving signatures. Please try again.');
        }
    };

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl">
                <DialogHeader>
                    <DialogTitle className="text-2xl font-bold">Provide E-Signatures</DialogTitle>
                </DialogHeader>

                <div className="grid grid-cols-2 gap-6 mt-4">
                    {/* Office Holder */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-700">Office Holder</h3>
                        <div className="relative">
                            <canvas
                                ref={canvas1Ref}
                                onMouseDown={(e) => startDrawing(e, canvas1Ref, setIsDrawing1)}
                                onMouseMove={(e) => draw(e, canvas1Ref, isDrawing1)}
                                onMouseUp={() => stopDrawing(canvas1Ref, setIsDrawing1)}
                                onMouseLeave={() => stopDrawing(canvas1Ref, setIsDrawing1)}
                                onTouchStart={(e) => startDrawing(e, canvas1Ref, setIsDrawing1)}
                                onTouchMove={(e) => draw(e, canvas1Ref, isDrawing1)}
                                onTouchEnd={() => stopDrawing(canvas1Ref, setIsDrawing1)}
                                className="w-full h-48 bg-slate-100 rounded-md cursor-crosshair border border-slate-300"
                            />
                            <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-2 text-slate-500 hover:text-slate-800" 
                                onClick={() => handleClear(canvas1Ref)}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name1">Name</Label>
                            <Input
                                id="name1"
                                value={name1}
                                onChange={(e) => setName1(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full"
                            />
                        </div>
                    </div>

                    {/* Admin */}
                    <div className="space-y-3">
                        <h3 className="font-semibold text-slate-700">Admin</h3>
                        <div className="relative">
                            <canvas
                                ref={canvas2Ref}
                                onMouseDown={(e) => startDrawing(e, canvas2Ref, setIsDrawing2)}
                                onMouseMove={(e) => draw(e, canvas2Ref, isDrawing2)}
                                onMouseUp={() => stopDrawing(canvas2Ref, setIsDrawing2)}
                                onMouseLeave={() => stopDrawing(canvas2Ref, setIsDrawing2)}
                                onTouchStart={(e) => startDrawing(e, canvas2Ref, setIsDrawing2)}
                                onTouchMove={(e) => draw(e, canvas2Ref, isDrawing2)}
                                onTouchEnd={() => stopDrawing(canvas2Ref, setIsDrawing2)}
                                className="w-full h-48 bg-slate-100 rounded-md cursor-crosshair border border-slate-300"
                            />
                            <Button 
                                type="button"
                                variant="ghost" 
                                size="icon" 
                                className="absolute top-2 right-2 text-slate-500 hover:text-slate-800" 
                                onClick={() => handleClear(canvas2Ref)}
                            >
                                <RefreshCw className="w-4 h-4" />
                            </Button>
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name2">Name</Label>
                            <Input
                                id="name2"
                                value={name2}
                                onChange={(e) => setName2(e.target.value)}
                                placeholder="Enter your name"
                                className="w-full"
                            />
                        </div>
                    </div>
                </div>

                <div className="flex justify-end gap-3 mt-6">
                    <Button 
                        type="button"
                        variant="outline" 
                        onClick={onClose}
                    >
                        Cancel
                    </Button>
                    <Button 
                        type="button"
                        onClick={handleLockSignatures} 
                        className="bg-blue-600 hover:bg-blue-700"
                    >
                        <Lock className="w-4 h-4 mr-2" />
                        Lock Signatures
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}