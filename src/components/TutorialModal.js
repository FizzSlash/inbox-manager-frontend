import React from 'react';
import { X, Mail, Filter, Bot, Settings, BarChart3, Zap, Clock, PlayCircle } from 'lucide-react';

const TutorialModal = ({ isOpen, onClose, onStartTour, currentPlan }) => {
  if (!isOpen) return null;

  const steps = [
    {
      icon: <Settings className="w-6 h-6" />,
      title: "🔑 Add API Key",
      description: "We'll guide you to add your SmartLead API key step-by-step. Just click and follow the prompts!"
    },
    {
      icon: <Mail className="w-6 h-6" />,
      title: "🔗 Setup Webhook",
      description: "Copy the webhook URL and add it to SmartLead as an 'Email Reply' webhook to receive responses automatically."
    },
    {
      icon: <Clock className="w-6 h-6" />,
      title: "📅 Import History", 
      description: "Choose your timeframe and campaigns, then import your email responses with one click."
    },
    {
      icon: <Bot className="w-6 h-6" />,
      title: "🤖 AI Analysis",
      description: "Watch as AI categorizes each response by intent, urgency, and engagement level automatically."
    },
    {
      icon: <Filter className="w-6 h-6" />,
      title: "🎯 Manage Leads",
      description: "Filter by Positive Intent to find hot prospects, generate AI responses, and track deals in CRM."
    },
    {
      icon: <BarChart3 className="w-6 h-6" />,
      title: "🚀 You're Ready!",
      description: "Complete setup in 5 minutes and start managing your email responses like a pro."
    }
  ];

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900 dark:text-white">
                Welcome to Your Inbox Manager! 🎉
              </h2>
              <p className="text-gray-600 dark:text-gray-400 mt-1">
                Let's walk you through setting up your SmartLead connection and importing your first leads
              </p>
            </div>
            <button
              onClick={onClose}
              className="p-2 hover:bg-gray-100 dark:hover:bg-gray-700 rounded-lg transition-colors"
            >
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
        </div>

        {/* Tutorial Steps */}
        <div className="p-6">
          <div className="space-y-6">
            {steps.map((step, index) => (
              <div key={index} className="flex gap-4 p-4 rounded-xl bg-gray-50 dark:bg-gray-700/50 hover:bg-gray-100 dark:hover:bg-gray-700 transition-colors">
                <div className="flex-shrink-0">
                  <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900/30 rounded-xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                    {step.icon}
                  </div>
                </div>
                <div className="flex-1">
                  <h3 className="font-semibold text-gray-900 dark:text-white text-lg">
                    {step.title}
                  </h3>
                  <p className="text-gray-600 dark:text-gray-400 mt-1 leading-relaxed">
                    {step.description}
                  </p>
                </div>
              </div>
            ))}
          </div>

          {/* Quick Tips */}
          <div className="mt-8 p-4 bg-gradient-to-r from-blue-50 to-indigo-50 dark:from-blue-900/20 dark:to-indigo-900/20 rounded-xl border border-blue-200 dark:border-blue-800">
            <div className="flex items-start gap-3">
              <Clock className="w-5 h-5 text-blue-600 dark:text-blue-400 mt-0.5 flex-shrink-0" />
              <div>
                <h4 className="font-semibold text-blue-900 dark:text-blue-100">You'll Complete These Steps:</h4>
                <ul className="text-blue-800 dark:text-blue-200 text-sm mt-1 space-y-1">
                  <li>• ✅ Add your SmartLead API key</li>
                  <li>• ✅ Copy and setup the webhook URL</li>
                  <li>• ✅ Import your email response history</li>
                  <li>• ✅ See AI categorize your leads</li>
                  <li>• ✅ Try the smart draft feature</li>
                </ul>
              </div>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800/50">
          <div className="flex flex-col sm:flex-row gap-3 sm:justify-between sm:items-center">
            <p className="text-sm text-gray-500 dark:text-gray-400">
              You can always access help from the Settings menu
            </p>
            <div className="flex gap-3">
              <button
                onClick={onClose}
                className="px-4 py-2 border border-gray-300 dark:border-gray-600 text-gray-700 dark:text-gray-300 rounded-lg font-medium transition-colors hover:bg-gray-50 dark:hover:bg-gray-700"
              >
                Skip Tutorial
              </button>
              <button
                onClick={onStartTour}
                className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                <PlayCircle className="w-4 h-4" />
                Take Interactive Tour 🚀
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default TutorialModal;