import React, { useRef, useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { X, Eraser, RotateCcw, Save } from 'lucide-react';

export default function SignatureDrawDialog({ isOpen, onClose, onSave, isUploading, userName }) {
  const canvasRef = useRef(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasDrawn, setHasDrawn] = useState(false);

  useEffect(() => {
    if (isOpen && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      ctx.fillStyle = 'white';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      ctx.strokeStyle = '#000000';
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
    }
  }, [isOpen]);

  const startDrawing = (e) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.beginPath();
    ctx.moveTo(x, y);
    setIsDrawing(true);
    setHasDrawn(true);
  };

  const draw = (e) => {
    if (!isDrawing) return;
    
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    ctx.lineTo(x, y);
    ctx.stroke();
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    setHasDrawn(false);
  };

  const handleTemplateSelect = (style) => {
    const canvas = canvasRef.current;
    const ctx = canvas.getContext('2d');
    
    // Clear canvas
    ctx.fillStyle = 'white';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    const text = userName || 'Signature';
    ctx.fillStyle = '#000000';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    
    // Apply different font styles
    if (style === 'cursive') {
      ctx.font = 'italic 48px "Brush Script MT", cursive';
    } else if (style === 'elegant') {
      ctx.font = 'italic 42px "Times New Roman", serif';
    } else if (style === 'modern') {
      ctx.font = '38px "Arial", sans-serif';
    } else if (style === 'formal') {
      ctx.font = '40px "Georgia", serif';
    }
    
    ctx.fillText(text, canvas.width / 2, canvas.height / 2);
    setHasDrawn(true);
  };

  const handleSave = () => {
    if (!hasDrawn) {
      alert('Please draw a signature first');
      return;
    }

    const canvas = canvasRef.current;
    canvas.toBlob((blob) => {
      const file = new File([blob], 'signature.png', { type: 'image/png' });
      onSave(file);
    }, 'image/png');
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-xl max-w-2xl w-full p-6 shadow-2xl">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold text-slate-900">Draw Signature</h2>
          <Button
            variant="ghost"
            size="icon"
            onClick={onClose}
            disabled={isUploading}
          >
            <X className="w-4 h-4" />
          </Button>
        </div>

        {userName && (
          <div className="mb-4">
            <p className="text-sm font-medium text-slate-700 mb-2">Select a signature style:</p>
            <div className="grid grid-cols-4 gap-2">
              <Button
                variant="outline"
                onClick={() => handleTemplateSelect('cursive')}
                className="h-16 text-xl italic font-cursive"
                style={{ fontFamily: '"Brush Script MT", cursive' }}
              >
                {userName}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTemplateSelect('elegant')}
                className="h-16 text-lg italic"
                style={{ fontFamily: '"Times New Roman", serif' }}
              >
                {userName}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTemplateSelect('modern')}
                className="h-16 text-lg"
                style={{ fontFamily: 'Arial, sans-serif' }}
              >
                {userName}
              </Button>
              <Button
                variant="outline"
                onClick={() => handleTemplateSelect('formal')}
                className="h-16 text-lg"
                style={{ fontFamily: 'Georgia, serif' }}
              >
                {userName}
              </Button>
            </div>
          </div>
        )}

        <div className="mb-4">
          <p className="text-sm font-medium text-slate-700 mb-2">Or draw your signature:</p>
          <canvas
            ref={canvasRef}
            width={600}
            height={200}
            className="border-2 border-slate-300 rounded-lg cursor-crosshair w-full bg-white"
            onMouseDown={startDrawing}
            onMouseMove={draw}
            onMouseUp={stopDrawing}
            onMouseLeave={stopDrawing}
          />
        </div>

        <div className="flex justify-between">
          <Button
            variant="outline"
            onClick={handleClear}
            disabled={isUploading}
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Clear
          </Button>
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={onClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={isUploading || !hasDrawn}
              className="bg-blue-600 hover:bg-blue-700"
            >
              {isUploading ? (
                <>Uploading...</>
              ) : (
                <>
                  <Save className="w-4 h-4 mr-2" />
                  Save Signature
                </>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}