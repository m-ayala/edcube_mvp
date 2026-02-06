// frontend/src/components/AIGenerateButton.jsx

import React, { useState } from 'react';
import { Sparkles } from 'lucide-react';

const AIGenerateButton = ({
  level,
  context,
  onGenerate,
  count = 3,
  buttonText = "Generate with AI",
  showDialog = true
}) => {
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [userGuidance, setUserGuidance] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const handleClick = () => {
    if (showDialog) {
      setIsDialogOpen(true);
    } else {
      handleGenerate();
    }
  };

  const handleGenerate = async () => {
    setIsGenerating(true);
    
    try {
      await onGenerate({
        level,
        context,
        userGuidance: userGuidance.trim() || null,
        count
      });
      
      // Close dialog and reset on success
      setIsDialogOpen(false);
      setUserGuidance('');
    } catch (error) {
      console.error('Generation failed:', error);
      // You can add error toast notification here
    } finally {
      setIsGenerating(false);
    }
  };

  const handleCancel = () => {
    setIsDialogOpen(false);
    setUserGuidance('');
  };

  return (
    <>
      {/* AI Generate Button */}
      <button
        onClick={handleClick}
        disabled={isGenerating}
        className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 shadow-md hover:shadow-lg disabled:opacity-50 disabled:cursor-not-allowed"
      >
        <Sparkles className={`w-5 h-5 ${isGenerating ? 'animate-spin' : ''}`} />
        <span>{isGenerating ? 'Generating...' : buttonText}</span>
      </button>

      {/* Generation Dialog */}
      {isDialogOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl p-6 w-full max-w-md">
            {/* Dialog Header */}
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="w-6 h-6 text-purple-500" />
              <h3 className="text-lg font-semibold">
                Generate {count} {level === 'sections' ? 'Section(s)' : level === 'subsections' ? 'Subsection(s)' : 'Topic Box(es)'} with AI
              </h3>
            </div>

            {/* Optional Guidance Input */}
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-700 mb-2">
                💡 Optional: Guide the AI
              </label>
              <textarea
                value={userGuidance}
                onChange={(e) => setUserGuidance(e.target.value)}
                placeholder='e.g., "Focus on hands-on activities" or "Include primary sources"'
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent resize-none"
                rows={3}
              />
              <p className="text-xs text-gray-500 mt-1">
                Leave blank to let AI decide based on context
              </p>
            </div>

            {/* Examples */}
            <div className="mb-4 p-3 bg-gray-50 rounded-lg">
              <p className="text-xs font-medium text-gray-600 mb-1">Examples:</p>
              <ul className="text-xs text-gray-500 space-y-1">
                <li>• "Focus on visual learners"</li>
                <li>• "Include multimedia resources"</li>
                <li>• "Make it hands-on and interactive"</li>
              </ul>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-3">
              <button
                onClick={handleCancel}
                disabled={isGenerating}
                className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={handleGenerate}
                disabled={isGenerating}
                className="flex-1 px-4 py-2 bg-gradient-to-r from-purple-500 to-pink-500 text-white rounded-lg hover:from-purple-600 hover:to-pink-600 transition-all duration-200 disabled:opacity-50 flex items-center justify-center gap-2"
              >
                {isGenerating ? (
                  <>
                    <Sparkles className="w-4 h-4 animate-spin" />
                    <span>Generating...</span>
                  </>
                ) : (
                  <>
                    <Sparkles className="w-4 h-4" />
                    <span>Generate</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};

export default AIGenerateButton;