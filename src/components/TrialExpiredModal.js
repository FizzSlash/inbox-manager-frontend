import React from 'react';
import { AlertCircle, Clock, CreditCard, X } from 'lucide-react';

const TrialExpiredModal = ({ isOpen, trialData, onUpgrade, onClose }) => {
  if (!isOpen) return null;

  const { daysRemaining, trialEndsAt, isExpired } = trialData;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-md w-full mx-4 overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white relative">
          <button
            onClick={onClose}
            className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
          
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-2xl font-bold">
              {isExpired ? 'Trial Expired' : 'Trial Ending Soon'}
            </h2>
          </div>
          
          {isExpired ? (
            <p className="text-sm opacity-90">
              Your 7-day free trial has ended. Upgrade now to continue using Inbox Manager.
            </p>
          ) : (
            <p className="text-sm opacity-90">
              Your trial expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. 
              Upgrade now to avoid interruption.
            </p>
          )}
        </div>

        {/* Content */}
        <div className="p-6">
          {/* Trial Info */}
          <div className="bg-gray-50 dark:bg-gray-700 rounded-lg p-4 mb-6">
            <div className="flex items-center gap-3 mb-3">
              <Clock className="w-5 h-5 text-gray-600 dark:text-gray-400" />
              <span className="font-medium text-gray-900 dark:text-white">Trial Period</span>
            </div>
            
            <div className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <div>Started: {new Date(trialEndsAt - 7 * 24 * 60 * 60 * 1000).toLocaleDateString()}</div>
              <div>Expires: {new Date(trialEndsAt).toLocaleDateString()}</div>
              <div className={isExpired ? 'text-red-600 font-medium' : 'text-orange-600 font-medium'}>
                Status: {isExpired ? 'Expired' : `${daysRemaining} days remaining`}
              </div>
            </div>
          </div>

          {/* Features Lost */}
          <div className="mb-6">
            <h3 className="font-medium text-gray-900 dark:text-white mb-3">
              {isExpired ? 'Access Restored With Upgrade:' : 'Keep Access To:'}
            </h3>
            <ul className="text-sm text-gray-600 dark:text-gray-300 space-y-1">
              <li>• AI-powered lead categorization</li>
              <li>• Unlimited lead imports</li>
              <li>• Email draft generation</li>
              <li>• CRM integration</li>
              <li>• Advanced analytics</li>
            </ul>
          </div>

          {/* Action Buttons */}
          <div className="space-y-3">
            <button
              onClick={onUpgrade}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <CreditCard className="w-5 h-5" />
              Upgrade Now - Starting at $297/month
            </button>
            
            {!isExpired && (
              <button
                onClick={onClose}
                className="w-full bg-gray-200 hover:bg-gray-300 dark:bg-gray-600 dark:hover:bg-gray-700 text-gray-800 dark:text-white font-medium py-2 px-4 rounded-lg transition-colors"
              >
                Continue Trial ({daysRemaining} days left)
              </button>
            )}
          </div>

          {/* Fine Print */}
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-4 text-center">
            No credit card was required for your trial. You can upgrade or cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialExpiredModal;