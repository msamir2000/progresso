import React, { useRef, useEffect, useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { X, Loader2, CheckCircle } from 'lucide-react';
import { Case } from '@/api/entities';

export default function SignatureDialog({ 
    isOpen, 
    onClose, 
    caseId,
    signatureField1,
    nameField1,
    signatureField2,
    nameField2,
    existingSignature1, 
    existingName1, 
    existingSignature2, 
    existingName2,
    reviewDateField,
    reviewNoteField,
    reviewNoteData
}) {
    const canvas1Ref = useRef(null);
    const canvas2Ref = useRef(null);
    const [drawing1, setDrawing1] = useState(false);
    const [drawing2, setDrawing2] = useState(false);
    const [name1, setName1] = useState('');
    const [name2, setName2] = useState('');
    const [saving, setSaving] = useState(false);
    const [loaded1, setLoaded1] = useState(false);
    const [loaded2, setLoaded2] = useState(false);

    useEffect(() => {
        if (isOpen) {
            console.log('Dialog opened with signatures:', {
                sig1: existingSignature1 ? 'exists' : 'none',
                sig2: existingSignature2 ? 'exists' : 'none',
                name1: existingName1,
                name2: existingName2
            });
            
            setName1(existingName1 || '');
            setName2(existingName2 || '');
            setLoaded1(false);
            setLoaded2(false);
            
            setTimeout(() => {
                initCanvas(canvas1Ref, existingSignature1, setLoaded1);
                initCanvas(canvas2Ref, existingSignature2, setLoaded2);
            }, 150);
        }
    }, [isOpen, existingSignature1, existingName1, existingSignature2, existingName2]);

    const initCanvas = (ref, existingSig, setLoaded) => {
        const canvas = ref.current;
        if (!canvas) {
            console.log('Canvas not found');
            return;
        }
        
        // Set canvas size
        canvas.width = 400;
        canvas.height = 200;
        
        const ctx = canvas.getContext('2d');
        
        // Clear canvas first
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        // Set drawing style
        ctx.strokeStyle = '#000';
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.lineJoin = 'round';
        
        // Load existing signature if present
        if (existingSig) {
            console.log('Loading existing signature');
            const img = new Image();
            img.crossOrigin = 'anonymous';
            img.onload = () => {
                console.log('Signature image loaded successfully');
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                setLoaded(true);
            };
            img.onerror = (err) => {
                console.error('Failed to load signature image:', err);
                setLoaded(false);
            };
            img.src = existingSig;
        } else {
            console.log('No existing signature to load');
            setLoaded(false);
        }
    };

    const startDraw = (e, ref, setDraw) => {
        const canvas = ref.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.beginPath();
        ctx.moveTo(x, y);
        setDraw(true);
    };

    const draw = (e, ref, isDraw) => {
        if (!isDraw) return;
        
        const canvas = ref.current;
        if (!canvas) return;
        
        const rect = canvas.getBoundingClientRect();
        const ctx = canvas.getContext('2d');
        
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        ctx.lineTo(x, y);
        ctx.stroke();
    };

    const stopDraw = (setDraw) => {
        setDraw(false);
    };

    const clearCanvas = (ref, setLoaded) => {
        const canvas = ref.current;
        if (!canvas) return;
        
        const ctx = canvas.getContext('2d');
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        setLoaded(false);
    };

    const isEmpty = (ref) => {
        const canvas = ref.current;
        if (!canvas) return true;
        
        const ctx = canvas.getContext('2d');
        const data = ctx.getImageData(0, 0, canvas.width, canvas.height).data;
        
        for (let i = 3; i < data.length; i += 4) {
            if (data[i] > 0) return false;
        }
        return true;
    };

    const handleSave = async () => {
        const empty1 = isEmpty(canvas1Ref);
        const empty2 = isEmpty(canvas2Ref);
        
        console.log('Saving signatures:', { empty1, empty2, name1, name2 });
        
        if (empty1 && empty2) {
            alert('Please draw at least one signature');
            return;
        }
        
        if (!empty1 && !name1.trim()) {
            alert('Please enter name for Office Holder');
            return;
        }
        
        if (!empty2 && !name2.trim()) {
            alert('Please enter name for Admin');
            return;
        }
        
        setSaving(true);
        
        try {
            const updateData = {
                [reviewDateField]: new Date().toISOString().split('T')[0]
            };
            
            if (reviewNoteField && reviewNoteData) {
                updateData[reviewNoteField] = JSON.stringify(reviewNoteData);
            }
            
            if (!empty1) {
                const sig1Data = canvas1Ref.current.toDataURL('image/png');
                updateData[signatureField1] = sig1Data;
                updateData[nameField1] = name1.trim();
                console.log('Signature 1 saved:', { field: signatureField1, nameField: nameField1, dataLength: sig1Data.length });
            }
            
            if (!empty2) {
                const sig2Data = canvas2Ref.current.toDataURL('image/png');
                updateData[signatureField2] = sig2Data;
                updateData[nameField2] = name2.trim();
                console.log('Signature 2 saved:', { field: signatureField2, nameField: nameField2, dataLength: sig2Data.length });
            }
            
            console.log('Updating case with data:', Object.keys(updateData));
            await Case.update(caseId, updateData);
            
            alert('Signatures saved successfully!');
            onClose();
            
            // Reload to show updated signatures
            setTimeout(() => {
                window.location.reload();
            }, 500);
        } catch (error) {
            console.error('Error saving signatures:', error);
            alert('Failed to save signatures: ' + error.message);
        } finally {
            setSaving(false);
        }
    };

    if (!isOpen) return null;

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
                <DialogHeader>
                    <DialogTitle className="text-xl font-bold">E-Signatures</DialogTitle>
                </DialogHeader>
                
                <div className="grid grid-cols-2 gap-6 mt-4">
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold">Office Holder</Label>
                            {loaded1 && (
                                <div className="flex items-center gap-1 text-green-600 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Signed</span>
                                </div>
                            )}
                        </div>
                        <div className="relative bg-white">
                            <canvas
                                ref={canvas1Ref}
                                className="border-2 border-slate-300 rounded cursor-crosshair w-full"
                                onMouseDown={(e) => startDraw(e, canvas1Ref, setDrawing1)}
                                onMouseMove={(e) => draw(e, canvas1Ref, drawing1)}
                                onMouseUp={() => stopDraw(setDrawing1)}
                                onMouseLeave={() => stopDraw(setDrawing1)}
                                style={{ touchAction: 'none' }}
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2 h-8 w-8 p-0"
                                onClick={() => clearCanvas(canvas1Ref, setLoaded1)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <Input
                            className="mt-3"
                            placeholder="Full Name"
                            value={name1}
                            onChange={(e) => setName1(e.target.value)}
                        />
                    </div>
                    
                    <div>
                        <div className="flex items-center justify-between mb-2">
                            <Label className="font-semibold">Admin</Label>
                            {loaded2 && (
                                <div className="flex items-center gap-1 text-green-600 text-sm">
                                    <CheckCircle className="w-4 h-4" />
                                    <span>Signed</span>
                                </div>
                            )}
                        </div>
                        <div className="relative bg-white">
                            <canvas
                                ref={canvas2Ref}
                                className="border-2 border-slate-300 rounded cursor-crosshair w-full"
                                onMouseDown={(e) => startDraw(e, canvas2Ref, setDrawing2)}
                                onMouseMove={(e) => draw(e, canvas2Ref, drawing2)}
                                onMouseUp={() => stopDraw(setDrawing2)}
                                onMouseLeave={() => stopDraw(setDrawing2)}
                                style={{ touchAction: 'none' }}
                            />
                            <Button
                                type="button"
                                size="sm"
                                variant="ghost"
                                className="absolute top-2 right-2 h-8 w-8 p-0"
                                onClick={() => clearCanvas(canvas2Ref, setLoaded2)}
                            >
                                <X className="w-4 h-4" />
                            </Button>
                        </div>
                        <Input
                            className="mt-3"
                            placeholder="Full Name"
                            value={name2}
                            onChange={(e) => setName2(e.target.value)}
                        />
                    </div>
                </div>
                
                <div className="flex justify-end gap-3 mt-6">
                    <Button type="button" variant="outline" onClick={onClose} disabled={saving}>
                        Cancel
                    </Button>
                    <Button type="button" onClick={handleSave} disabled={saving} className="bg-blue-600 hover:bg-blue-700">
                        {saving ? (
                            <>
                                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                                Saving...
                            </>
                        ) : (
                            'Save Signatures'
                        )}
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    );
}