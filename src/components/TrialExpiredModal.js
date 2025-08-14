import React from 'react';
import { AlertCircle, Clock, CreditCard, X, Check, Star, Crown, Loader2 } from 'lucide-react';

const TrialExpiredModal = ({ isOpen, trialData, currentPlan, upgradingPlan, onUpgrade, onClose, mode = 'trial-expiration' }) => {
  if (!isOpen) return null;

  const { daysRemaining, trialEndsAt, isExpired } = trialData || {};
  const isUpgradeMode = mode === 'upgrade';
  const isTrialMode = mode === 'trial-expiration';

  // Define pricing tiers
  const pricingTiers = [
    {
      name: 'Core',
      price: 297,
      leads: 500,
      icon: <Check className="w-5 h-5" />,
      color: 'blue',
      planKey: 'professional',  // Maps to database 'professional'
      features: [
        '500 leads per month',
        'AI lead categorization',
        'Email draft generation',
        'Basic CRM integration',
        'Standard support'
      ]
    },
    {
      name: 'Scale',
      price: 597,
      leads: 2000,
      icon: <Star className="w-5 h-5" />,
      color: 'purple',
      planKey: 'enterprise',  // Maps to database 'enterprise'
      popular: true,
      features: [
        '2,000 leads per month',
        'Advanced AI categorization',
        'Priority email generation',
        'Full CRM integration',
        'Advanced analytics',
        'Priority support'
      ]
    },
    {
      name: 'Agency+',
      price: 997,
      leads: 'Unlimited',
      icon: <Crown className="w-5 h-5" />,
      color: 'gold',
      planKey: 'agency',  // Maps to database 'agency'
      features: [
        'Unlimited leads',
        'Custom AI models',
        'White-label options',
        'API access',
        'Custom integrations',
        'Dedicated account manager'
      ]
    }
  ];

  // Determine current plan based on lead limits
  const getCurrentPlan = () => {
    if (!currentPlan) return null;
    const maxLeads = currentPlan.maxLeadsPerMonth;
    
    if (maxLeads <= 10000 && currentPlan.subscriptionPlan === 'trial') return 'trial';
    if (maxLeads <= 500) return 'professional';
    if (maxLeads <= 2000) return 'enterprise';
    return 'agency';
  };

  // Get current plan display name
  const getCurrentPlanName = () => {
    const planKey = getCurrentPlan();
    switch(planKey) {
      case 'trial': return 'Free Trial';
      case 'professional': return 'Core';
      case 'enterprise': return 'Scale';
      case 'agency': return 'Agency+';
      default: return 'Current Plan';
    }
  };

  const currentPlanKey = getCurrentPlan();

  const getColorClasses = (color) => {
    const colors = {
      blue: {
        bg: 'bg-blue-50 dark:bg-blue-900/20',
        border: 'border-blue-200 dark:border-blue-700',
        text: 'text-blue-600 dark:text-blue-400',
        button: 'bg-blue-600 hover:bg-blue-700'
      },
      purple: {
        bg: 'bg-purple-50 dark:bg-purple-900/20',
        border: 'border-purple-200 dark:border-purple-700',
        text: 'text-purple-600 dark:text-purple-400',
        button: 'bg-purple-600 hover:bg-purple-700'
      },
      gold: {
        bg: 'bg-yellow-50 dark:bg-yellow-900/20',
        border: 'border-yellow-200 dark:border-yellow-700',
        text: 'text-yellow-600 dark:text-yellow-400',
        button: 'bg-yellow-600 hover:bg-yellow-700'
      }
    };
    return colors[color] || colors.blue;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50 p-4">
      <div className="bg-white dark:bg-gray-800 rounded-2xl shadow-2xl max-w-4xl w-full mx-4 overflow-hidden max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className={`p-6 text-white relative ${
          isUpgradeMode 
            ? 'bg-gradient-to-r from-blue-500 to-purple-600' 
            : 'bg-gradient-to-r from-red-500 to-orange-500'
        }`}>
          {/* Show X button for upgrade mode or non-expired trials */}
          {(isUpgradeMode || !isExpired) && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center gap-3 mb-2">
            {isUpgradeMode ? (
              <CreditCard className="w-8 h-8" />
            ) : (
              <AlertCircle className="w-8 h-8" />
            )}
            <h2 className="text-2xl font-bold">
              {isUpgradeMode ? 'Upgrade Your Plan' : 
               isExpired ? 'Trial Expired - Choose Your Plan' : 'Upgrade Your Trial'}
            </h2>
          </div>
          
          {isUpgradeMode ? (
            <p className="text-sm opacity-90">
              Ready to unlock more leads and advanced features? Choose the plan that fits your needs.
            </p>
          ) : isExpired ? (
            <p className="text-sm opacity-90">
              Your 7-day free trial has ended. Choose a plan to continue accessing your leads and AI features.
            </p>
          ) : (
            <p className="text-sm opacity-90">
              Your trial expires in {daysRemaining} day{daysRemaining !== 1 ? 's' : ''}. 
              Choose a plan to avoid interruption.
            </p>
          )}
        </div>

        {/* Current Status */}
        <div className="p-6 border-b border-gray-200 dark:border-gray-700">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900 dark:text-white">
                {isUpgradeMode ? 'Current Plan' : 'Current Status'}
              </h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {isUpgradeMode ? (
                  `${getCurrentPlanName()} • ${currentPlan?.maxLeadsPerMonth || 50} leads/month`
                ) : (
                  `${currentPlanKey === 'trial' ? 'Free Trial' : 'Active Plan'} • ${currentPlan?.maxLeadsPerMonth || 50} leads/month`
                )}
              </p>
            </div>
            <div className="text-right">
              {isUpgradeMode ? (
                <div className="inline-flex items-center px-3 py-1 rounded-full text-xs font-medium bg-green-100 text-green-800 dark:bg-green-900/20 dark:text-green-400">
                  Active
                </div>
              ) : (
                <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                  isExpired ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 
                             'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
                }`}>
                  {isExpired ? 'Expired' : `${daysRemaining} days left`}
                </div>
              )}
            </div>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Choose Your Plan
          </h3>
          
          <div className={`grid gap-6 ${
            isUpgradeMode ? 'md:grid-cols-2 lg:grid-cols-3' : 'md:grid-cols-3'
          }`}>
            {pricingTiers.filter(tier => {
              // In upgrade mode, only show plans higher than current
              if (isUpgradeMode) {
                const currentPlanOrder = ['trial', 'professional', 'enterprise', 'agency'].indexOf(currentPlanKey);
                const tierPlanOrder = ['trial', 'professional', 'enterprise', 'agency'].indexOf(tier.planKey);
                return tierPlanOrder > currentPlanOrder;
              }
              // In trial mode, show all plans
              return true;
            }).map((tier) => {
              const isCurrentPlan = currentPlanKey === tier.planKey;
              const colors = getColorClasses(tier.color);
              
              const isUpgrading = upgradingPlan === tier.planKey;
              const isDisabled = isCurrentPlan || (upgradingPlan && !isUpgrading);
              
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-xl border-2 p-6 transition-all ${
                    isCurrentPlan 
                      ? `${colors.border} ${colors.bg}` 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${tier.popular ? 'ring-2 ring-purple-500 ring-opacity-50' : ''} ${
                    upgradingPlan && !isUpgrading ? 'opacity-50' : ''
                  }`}
                >
                  {tier.popular && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-purple-600 text-white px-3 py-1 rounded-full text-xs font-medium">
                        Most Popular
                      </div>
                    </div>
                  )}
                  
                  {isCurrentPlan && (
                    <div className="absolute -top-3 right-4">
                      <div className={`${colors.text} px-3 py-1 rounded-full text-xs font-medium bg-white dark:bg-gray-800 border ${colors.border}`}>
                        Current Plan
                      </div>
                    </div>
                  )}

                  {isUpgrading && (
                    <div className="absolute -top-3 left-1/2 transform -translate-x-1/2">
                      <div className="bg-blue-600 text-white px-3 py-1 rounded-full text-xs font-medium flex items-center gap-1">
                        <Loader2 className="w-3 h-3 animate-spin" />
                        Processing...
                      </div>
                    </div>
                  )}

                  <div className="text-center mb-4">
                    <div className={`inline-flex items-center justify-center w-12 h-12 rounded-full mb-3 ${colors.bg} ${colors.text}`}>
                      {tier.icon}
                    </div>
                    <h4 className="text-xl font-bold text-gray-900 dark:text-white">{tier.name}</h4>
                    <div className="mt-2">
                      <span className="text-3xl font-bold text-gray-900 dark:text-white">${tier.price}</span>
                      <span className="text-gray-600 dark:text-gray-400">/month</span>
                    </div>
                    <p className={`text-sm mt-1 ${colors.text} font-medium`}>
                      {typeof tier.leads === 'number' ? `${tier.leads.toLocaleString()} leads` : tier.leads}
                    </p>
                  </div>

                  <ul className="space-y-2 mb-6">
                    {tier.features.map((feature, index) => (
                      <li key={index} className="flex items-center text-sm text-gray-600 dark:text-gray-400">
                        <Check className="w-4 h-4 text-green-500 mr-2 flex-shrink-0" />
                        {feature}
                      </li>
                    ))}
                  </ul>

                  <button
                    onClick={() => onUpgrade(tier.planKey)}
                    disabled={isDisabled}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      isDisabled
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                        : `${colors.button} text-white hover:shadow-lg`
                    }`}
                  >
                    {isUpgrading ? (
                      <>
                        <Loader2 className="w-4 h-4 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      <>
                        <CreditCard className="w-4 h-4" />
                        {isCurrentPlan ? 'Current Plan' : `Upgrade to ${tier.name}`}
                      </>
                    )}
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {/* Footer */}
        <div className="bg-gray-50 dark:bg-gray-700/50 p-6 text-center">
          {!isExpired && (
            <button
              onClick={onClose}
              disabled={!!upgradingPlan}
              className={`text-sm font-medium mb-2 ${
                upgradingPlan 
                  ? 'text-gray-400 cursor-not-allowed' 
                  : 'text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200'
              }`}
            >
              Continue with trial ({daysRemaining} days left)
            </button>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            All plans include a 14-day money-back guarantee. Cancel anytime.
            {upgradingPlan && (
              <>
                <br />
                <span className="text-blue-600 dark:text-blue-400">
                  Processing your upgrade to {upgradingPlan}...
                </span>
              </>
            )}
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialExpiredModal;