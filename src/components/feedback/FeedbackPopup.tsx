'use client'

import { useState } from 'react'
import { X, ThumbsUp, ThumbsDown, MessageSquare } from 'lucide-react'

interface FeedbackPopupProps {
  onDismiss: () => void
  onSubmit: (rating: 'positive' | 'negative', comment: string) => void
  feedbackMessage: {
    title: string
    subtitle: string
    emoji: string
  }
}

export default function FeedbackPopup({ onDismiss, onSubmit, feedbackMessage }: FeedbackPopupProps) {
  const [step, setStep] = useState<'rating' | 'comment'>('rating')
  const [rating, setRating] = useState<'positive' | 'negative' | null>(null)
  const [comment, setComment] = useState('')

  const handleRatingSelect = (selectedRating: 'positive' | 'negative') => {
    setRating(selectedRating)
    setStep('comment')
  }

  const handleSubmit = () => {
    // Send feedback data to parent component
    onSubmit(rating!, comment)
  }

  const handleSkip = () => {
    if (rating) {
      handleSubmit()
    } else {
      onDismiss()
    }
  }

  return (
    <div className="fixed bottom-4 right-4 z-50">
      <div className="bg-white dark:bg-gray-800 rounded-lg shadow-lg border border-gray-200 dark:border-gray-700 p-4 w-80 animate-in slide-in-from-bottom-2">
        {/* Header */}
        <div className="flex items-start justify-between mb-3">
          <div className="flex-1">
            <h3 className="font-medium text-gray-900 dark:text-gray-100 flex items-center gap-2">
              {feedbackMessage.title}
            </h3>
            <p className="text-sm text-gray-600 dark:text-gray-400 mt-1">
              {feedbackMessage.subtitle}
            </p>
          </div>
          <button
            onClick={onDismiss}
            className="text-gray-400 hover:text-gray-600 dark:text-gray-500 dark:hover:text-gray-300 transition-colors"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {step === 'rating' && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700 dark:text-gray-300">
              How is your experience with Whispey?
            </p>
            <div className="flex gap-2">
              <button
                onClick={() => handleRatingSelect('positive')}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-green-50 hover:border-green-300 dark:hover:bg-green-900/20 dark:hover:border-green-700 transition-colors"
              >
                <ThumbsUp className="w-4 h-4 text-green-600 dark:text-green-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Good</span>
              </button>
              <button
                onClick={() => handleRatingSelect('negative')}
                className="flex-1 flex items-center justify-center gap-2 p-3 rounded-md border border-gray-200 dark:border-gray-600 hover:bg-red-50 hover:border-red-300 dark:hover:bg-red-900/20 dark:hover:border-red-700 transition-colors"
              >
                <ThumbsDown className="w-4 h-4 text-red-600 dark:text-red-400" />
                <span className="text-sm text-gray-700 dark:text-gray-300">Bad</span>
              </button>
            </div>
          </div>
        )}

        {step === 'comment' && (
          <div className="space-y-3">
            <div className="flex items-center gap-2 mb-2">
              {rating === 'positive' ? (
                <ThumbsUp className="w-4 h-4 text-green-600 dark:text-green-400" />
              ) : (
                <ThumbsDown className="w-4 h-4 text-red-600 dark:text-red-400" />
              )}
              <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
                {rating === 'positive' ? 'Glad you like it!' : 'Sorry to hear that!'}
              </span>
            </div>
            
            <textarea
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={
                rating === 'positive' 
                  ? "What do you like most? (optional)"
                  : "What can we improve? (optional)"
              }
              className="w-full p-2 text-sm border border-gray-200 dark:border-gray-600 rounded-md bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-500 dark:placeholder-gray-400 resize-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              rows={3}
            />
            
            <div className="flex gap-2 pt-2">
              <button
                onClick={handleSkip}
                className="flex-1 px-3 py-2 text-sm text-gray-600 dark:text-gray-400 hover:text-gray-800 dark:hover:text-gray-200 transition-colors"
              >
                {comment.trim() ? 'Skip comment' : 'Skip'}
              </button>
              <button
                onClick={handleSubmit}
                className="flex-1 px-3 py-2 text-sm bg-blue-600 hover:bg-blue-700 text-white rounded-md transition-colors flex items-center justify-center gap-1"
              >
                <MessageSquare className="w-3 h-3" />
                Submit
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}