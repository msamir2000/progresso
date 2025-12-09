import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Lock, Unlock, PlusCircle, Trash2, Loader2 } from 'lucide-react';
import { base44 } from '@/api/base44Client';
import CaseStrategyForm from '../case_strategy/CaseStrategyForm';
import OneMonthReviewForm from '../case_strategy/OneMonthReviewForm';
import SixMonthReviewForm from '../case_strategy/SixMonthReviewForm';

const getSixMonthReviewDefaultState = () => ({
  statutory: { narrative: '', initial_bond_value: '', current_bond_value: '', action_required: '' },
  compliance: { bribery: '', ethical: '', money_laundering: '', noclmar: '' },
  progression: { narrative: '' },
  investigations: { narrative: '', cdda_return_date: '' },
  tax: { narrative: '', ctta_return_date: '' },
  distributions: { narrative: '', secured_sum: '', preferential_sum: '', unsecured_sum: '' },
  fees_and_expenses: { narrative: '', basis_agreed: '', fees_billed: '', revision_level: '' },
  action_points: { points: [{ matter: '', actioned_by_date: '' }, { matter: '', actioned_by_date: '' }, { matter: '', actioned_by_date: '' }] },
  closure: { ready_for_closure: '', matters_preventing: '', anticipated_date: '' }
});

const ReviewMenuButton = ({ label, isActive, onClick, onToggleEdit, isEditing }) => (
  <div className={`w-full flex items-center justify-between group rounded-md transition-colors ${isActive ? 'bg-blue-100' : 'hover:bg-slate-50'}`}>
    <button
      onClick={onClick}
      className={`flex-grow text-left px-3 py-2 text-sm font-medium ${isActive ? 'text-blue-700' : 'text-slate-700'}`}
    >
      {label}
    </button>
    <div className="flex items-center">
      <button
        onClick={onToggleEdit}
        className={`p-2 mr-2 opacity-60 group-hover:opacity-100 transition-opacity ${isEditing ? 'text-green-600 hover:text-green-700' : 'text-red-600 hover:text-red-700'}`}
        aria-label={isEditing ? 'Unlock form' : 'Lock form'}
      >
        {isEditing ? <Unlock className="w-4 h-4" /> : <Lock className="w-4 h-4" />}
      </button>
    </div>
  </div>
);

const AdditionalReviewForm = ({
  reviewIndex,
  reviewName,
  initialData,
  onSave,
  isEditing,
  onDelete
}) => {
  const [currentReviewName, setCurrentReviewName] = useState(reviewName);
  const [isNameEditing, setIsNameEditing] = useState(false);

  useEffect(() => {
    setCurrentReviewName(reviewName);
  }, [reviewName]);

  const handleNameBlur = () => {
    if (currentReviewName !== reviewName) {
      onSave({ review_name: currentReviewName });
    }
    setIsNameEditing(false);
  };

  const handleKeyPress = (e) => {
    if (e.key === 'Enter') {
      handleNameBlur();
    }
  };

  const handleSixMonthReviewSave = (data) => {
      onSave({ review_note: data });
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        {isNameEditing && isEditing ? (
          <Input
            value={currentReviewName}
            onChange={(e) => setCurrentReviewName(e.target.value)}
            onBlur={handleNameBlur}
            onKeyPress={handleKeyPress}
            className="text-2xl font-bold w-auto"
          />
        ) : (
          <h2
            className="text-2xl font-bold text-slate-900"
            onClick={() => isEditing && setIsNameEditing(true)}
            style={{ cursor: isEditing ? 'pointer' : 'default' }}
          >
            {currentReviewName || `Additional Review ${reviewIndex + 1}`}
          </h2>
        )}
        <Button
            variant="destructive"
            size="sm"
            onClick={onDelete}
            disabled={!isEditing}
        >
            <Trash2 className="w-4 h-4 mr-2" />
            Delete Review
        </Button>
      </div>
      <SixMonthReviewForm
        initialData={initialData}
        onSave={handleSixMonthReviewSave}
        isEditing={isEditing}
      />
    </div>
  );
};

export default function ReviewsTab({ caseData, caseId, onCaseUpdate }) {
  const [activeReview, setActiveReview] = useState('caseStrategy');
  const [isEditingStrategy, setIsEditingStrategy] = useState(false);
  const [isEditingReview1Month, setIsEditingReview1Month] = useState(false);
  const [isEditingReview6Month, setIsEditingReview6Month] = useState(false);
  const [isEditingAdditionalReview, setIsEditingAdditionalReview] = useState({});
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    setActiveReview('caseStrategy');
    setIsEditingStrategy(false);
    setIsEditingReview1Month(false);
    setIsEditingReview6Month(false);
    setIsEditingAdditionalReview({});
  }, [caseId]);

  const handleSaveReviewData = async (data) => {
    setIsLoading(true);
    try {
      await base44.entities.Case.update(caseId, data);
      if (onCaseUpdate) {
        await onCaseUpdate();
      }
    } catch (error) {
      console.error("Failed to save review data:", error);
      alert('Failed to save review data. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddReview = async () => {
    setIsLoading(true);
    const currentReviews = [...(caseData.additional_reviews || [])];
    const newReviewName = `Additional Review ${currentReviews.length + 1}`;

    const defaultState = getSixMonthReviewDefaultState();

    const newReview = {
      review_name: newReviewName,
      review_note: JSON.stringify(defaultState),
      review_date: new Date().toISOString().split('T')[0]
    };

    const updatedReviews = [...currentReviews, newReview];

    try {
      await base44.entities.Case.update(caseId, { additional_reviews: updatedReviews });
      setActiveReview(`additional_${currentReviews.length}`);
      setIsEditingAdditionalReview(prev => ({ ...prev, [currentReviews.length]: true }));
      if (onCaseUpdate) await onCaseUpdate();
    } catch (error) {
      console.error("Failed to add new review:", error);
      alert('Failed to add review. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSaveAdditionalReviewData = async (index, updateObject) => {
    setIsLoading(true);
    const currentReviews = [...(caseData.additional_reviews || [])];
    if (currentReviews[index]) {
      const updatedReview = { ...currentReviews[index] };

      if (updateObject.review_name !== undefined) {
        updatedReview.review_name = updateObject.review_name;
      }

      if (updateObject.review_note !== undefined) {
        updatedReview.review_note = JSON.stringify(updateObject.review_note);
      }

      updatedReview.review_date = new Date().toISOString().split('T')[0];
      currentReviews[index] = updatedReview;

      try {
        await base44.entities.Case.update(caseId, { additional_reviews: currentReviews });
        if (onCaseUpdate) await onCaseUpdate();
      } catch (error) {
        console.error("Failed to save additional review data:", error);
        alert('Failed to save review. Please try again.');
      } finally {
        setIsLoading(false);
      }
    }
  };

  const handleDeleteReview = async (indexToDelete) => {
    if (!confirm('Are you sure you want to delete this additional review?')) {
      return;
    }

    setIsLoading(true);
    const updatedReviews = (caseData.additional_reviews || []).filter((_, index) => index !== indexToDelete);

    try {
      await base44.entities.Case.update(caseId, { additional_reviews: updatedReviews });
      setActiveReview('caseStrategy');
      setIsEditingAdditionalReview(prev => {
        const newState = { ...prev };
        delete newState[indexToDelete];
        return newState;
      });
      if (onCaseUpdate) await onCaseUpdate();
    } catch (error) {
      console.error("Failed to delete additional review:", error);
      alert('Failed to delete review. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex h-full relative">
      {isLoading && (
        <div className="absolute top-4 left-1/2 transform -translate-x-1/2 z-50 bg-white shadow-lg rounded-lg px-4 py-2 flex items-center gap-2 border border-blue-200">
          <Loader2 className="w-4 h-4 animate-spin text-blue-600" />
          <span className="text-sm text-slate-700">Saving...</span>
        </div>
      )}
      <div className="w-64 flex-shrink-0 border-r bg-slate-50 flex flex-col">
        <div className="p-4 flex-1">
          <div className="space-y-1 mb-4">
            <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider px-3 mb-2">Reviews</h3>
            <ReviewMenuButton
              label="Case Strategy"
              isActive={activeReview === 'caseStrategy'}
              onClick={() => setActiveReview('caseStrategy')}
              onToggleEdit={() => setIsEditingStrategy(!isEditingStrategy)}
              isEditing={isEditingStrategy}
            />
            <ReviewMenuButton
              label="1 Month Review"
              isActive={activeReview === 'oneMonth'}
              onClick={() => setActiveReview('oneMonth')}
              onToggleEdit={() => setIsEditingReview1Month(!isEditingReview1Month)}
              isEditing={isEditingReview1Month}
            />
            <ReviewMenuButton
              label="6 Month Review"
              isActive={activeReview === 'sixMonth'}
              onClick={() => setActiveReview('sixMonth')}
              onToggleEdit={() => setIsEditingReview6Month(!isEditingReview6Month)}
              isEditing={isEditingReview6Month}
            />

            {(caseData.additional_reviews || []).map((review, index) => {
              const reviewKey = `additional_${index}`;
              return (
                <ReviewMenuButton
                  key={reviewKey}
                  label={review.review_name || `Review ${index + 1}`}
                  isActive={activeReview === reviewKey}
                  onClick={() => setActiveReview(reviewKey)}
                  onToggleEdit={() => {
                    setIsEditingAdditionalReview(prev => ({
                      ...prev,
                      [index]: !prev[index]
                    }));
                  }}
                  isEditing={isEditingAdditionalReview[index] || false}
                />
              );
            })}

            <button
              onClick={handleAddReview}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-blue-600 hover:bg-blue-50 rounded-lg transition-colors mt-2"
            >
              <PlusCircle className="w-4 h-4" />
              <span>Add Review</span>
            </button>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-6">
            {activeReview === 'caseStrategy' && (
              <div id="case-strategy-content">
                <CaseStrategyForm
                  initialData={caseData.case_strategy_note}
                  onSave={handleSaveReviewData}
                  caseId={caseData.id}
                  isEditing={isEditingStrategy}
                  onToggleEdit={() => setIsEditingStrategy(!isEditingStrategy)}
                />
              </div>
            )}
            {activeReview === 'oneMonth' && (
              <div id="1-month-review-content">
                <OneMonthReviewForm
                  initialData={caseData}
                  onSave={handleSaveReviewData}
                  isEditing={isEditingReview1Month}
                  onToggleEdit={() => setIsEditingReview1Month(!isEditingReview1Month)}
                  onCaseUpdate={onCaseUpdate}
                />
              </div>
            )}
            {activeReview === 'sixMonth' && (
              <div id="6-month-review-content">
                <SixMonthReviewForm
                  initialData={caseData.review_6_month_note}
                  onSave={handleSaveReviewData}
                  isEditing={isEditingReview6Month}
                />
              </div>
            )}
            {activeReview.startsWith('additional_') && (() => {
              const index = parseInt(activeReview.split('_')[1], 10);
              const additionalReview = caseData.additional_reviews && caseData.additional_reviews[index];

              if (!additionalReview) return null;

              let parsedReviewNote = getSixMonthReviewDefaultState();

              if (additionalReview.review_note) {
                try {
                  const parsed = JSON.parse(additionalReview.review_note);
                  parsedReviewNote = {
                    statutory: { ...parsedReviewNote.statutory, ...(parsed.statutory || {}) },
                    compliance: { ...parsedReviewNote.compliance, ...(parsed.compliance || {}) },
                    progression: { ...parsedReviewNote.progression, ...(parsed.progression || {}) },
                    investigations: { ...parsedReviewNote.investigations, ...(parsed.investigations || {}) },
                    tax: { ...parsedReviewNote.tax, ...(parsed.tax || {}) },
                    distributions: { ...parsedReviewNote.distributions, ...(parsed.distributions || {}) },
                    fees_and_expenses: { ...parsedReviewNote.fees_and_expenses, ...(parsed.fees_and_expenses || {}) },
                    action_points: {
                      points: Array.isArray(parsed.action_points?.points) ? parsed.action_points.points : parsedReviewNote.action_points.points
                    },
                    closure: { ...parsedReviewNote.closure, ...(parsed.closure || {}) }
                  };
                } catch (e) {
                  console.error(`Error parsing additional review note at index ${index}:`, e);
                }
              }

              return (
                <div id={`additional-review-content-${index}`} key={`additional-review-${index}`}>
                  <AdditionalReviewForm
                    reviewIndex={index}
                    reviewName={additionalReview.review_name}
                    initialData={parsedReviewNote}
                    reviewDate={additionalReview.review_date}
                    onSave={(updates) => handleSaveAdditionalReviewData(index, updates)}
                    isEditing={isEditingAdditionalReview[index] || false}
                    onDelete={() => handleDeleteReview(index)}
                  />
                </div>
              );
            })()}
          </div>
        </ScrollArea>
      </div>
    </div>
  );
}