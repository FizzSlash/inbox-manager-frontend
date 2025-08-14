import React, { useState, useEffect } from 'react';
import { Clock, Zap, ArrowRight, X } from 'lucide-react';

const TrialBanner = ({ trialData, onUpgrade, onDismiss }) => {
  const [timeRemaining, setTimeRemaining] = useState(null);
  const [isDismissed, setIsDismissed] = useState(false);

  useEffect(() => {
    if (!trialData?.trial_ends_at) return;

    const updateTimer = () => {
      const now = new Date();
      const endTime = new Date(trialData.trial_ends_at);
      const difference = endTime.getTime() - now.getTime();

      if (difference <= 0) {
        setTimeRemaining({ expired: true });
        return;
      }

      const days = Math.floor(difference / (1000 * 60 * 60 * 24));
      const hours = Math.floor((difference % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((difference % (1000 * 60 * 60)) / (1000 * 60));

      setTimeRemaining({ days, hours, minutes, expired: false });
    };

    updateTimer();
    const interval = setInterval(updateTimer, 60000); // Update every minute

    return () => clearInterval(interval);
  }, [trialData?.trial_ends_at]);

  // Don't show if dismissed
  if (isDismissed) return null;

  // Don't show for non-trial users
  if (!trialData || trialData.subscription_plan !== 'trial') return null;

  // Don't show if no trial end date
  if (!trialData.trial_ends_at) return null;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (onDismiss) onDismiss();
  };

  const formatTimeRemaining = () => {
    if (!timeRemaining) return 'Calculating...';
    if (timeRemaining.expired) return 'Trial Expired';

    const { days, hours, minutes } = timeRemaining;
    
    if (days > 0) {
      return `${days} day${days !== 1 ? 's' : ''} ${hours}h remaining`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m remaining`;
    } else {
      return `${minutes}m remaining`;
    }
  };

  const getUrgencyStyle = () => {
    if (!timeRemaining || timeRemaining.expired) {
      return {
        bg: 'linear-gradient(90deg, #DC2626, #B91C1C)',
        textColor: '#FFFFFF',
        accentColor: '#FEF2F2',
        icon: '🚨'
      };
    }

    const { days, hours } = timeRemaining;
    const totalHours = (days * 24) + hours;

    if (totalHours <= 24) {
      // Last 24 hours - Red (Critical)
      return {
        bg: 'linear-gradient(90deg, #DC2626, #B91C1C)',
        textColor: '#FFFFFF',
        accentColor: '#FEF2F2',
        icon: '⚠️'
      };
    } else if (totalHours <= 72) {
      // Last 3 days - Orange (Urgent)
      return {
        bg: 'linear-gradient(90deg, #EA580C, #DC2626)',
        textColor: '#FFFFFF',
        accentColor: '#FEF3C7',
        icon: '⏰'
      };
    } else {
      // More than 3 days - Blue (Info)
      return {
        bg: 'linear-gradient(90deg, #3B82F6, #1D4ED8)',
        textColor: '#FFFFFF',
        accentColor: '#EBF8FF',
        icon: '💎'
      };
    }
  };

  const urgencyStyle = getUrgencyStyle();

  return (
    <div 
      className="relative text-white px-4 py-2"
      style={{ background: urgencyStyle.bg, zIndex: 'inherit' }}
    >
      <div className="flex items-center justify-between w-full">
        <div className="flex items-center gap-2 flex-1 min-w-0">
          <span className="text-sm">{urgencyStyle.icon}</span>
          <Clock className="w-4 h-4 flex-shrink-0" />
          
          <div className="flex items-center gap-2 flex-1 min-w-0">
            <span className="font-semibold text-sm whitespace-nowrap">
              {timeRemaining?.expired ? 'Trial Expired!' : 'Free Trial:'}
            </span>
            <span className="font-mono text-sm px-2 py-1 rounded whitespace-nowrap" style={{ backgroundColor: 'rgba(255,255,255,0.2)' }}>
              {formatTimeRemaining()}
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={onUpgrade}
            className="flex items-center gap-1 px-3 py-1.5 rounded-lg font-medium text-sm transition-all duration-200 hover:scale-105 whitespace-nowrap"
            style={{ 
              backgroundColor: 'white', 
              color: '#1F2937'
            }}
          >
            {timeRemaining?.expired ? 'Upgrade Now' : 'Upgrade Trial'}
            <ArrowRight className="w-3 h-3" />
          </button>
          
          <button
            onClick={handleDismiss}
            className="p-1 rounded-lg transition-colors duration-200 hover:bg-white/20"
            title="Dismiss"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default TrialBanner;