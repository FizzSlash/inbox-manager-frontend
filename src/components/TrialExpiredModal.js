import React from 'react';
import { AlertCircle, Clock, CreditCard, X, Check, Star, Crown } from 'lucide-react';

const TrialExpiredModal = ({ isOpen, trialData, currentPlan, onUpgrade, onClose }) => {
  if (!isOpen) return null;

  const { daysRemaining, trialEndsAt, isExpired } = trialData;

  // Define pricing tiers
  const pricingTiers = [
    {
      name: 'Starter',
      price: 297,
      leads: 300,
      icon: <Check className="w-5 h-5" />,
      color: 'blue',
      planKey: 'starter',
      features: [
        '300 leads per month',
        'AI lead categorization',
        'Email draft generation',
        'Basic CRM integration',
        'Standard support'
      ]
    },
    {
      name: 'Professional',
      price: 497,
      leads: 1000,
      icon: <Star className="w-5 h-5" />,
      color: 'purple',
      planKey: 'professional',
      popular: true,
      features: [
        '1,000 leads per month',
        'Advanced AI categorization',
        'Priority email generation',
        'Full CRM integration',
        'Advanced analytics',
        'Priority support'
      ]
    },
    {
      name: 'Enterprise',
      price: 997,
      leads: 'Unlimited',
      icon: <Crown className="w-5 h-5" />,
      color: 'gold',
      planKey: 'god',
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
    
    if (maxLeads <= 50) return 'trial';
    if (maxLeads <= 300) return 'starter';
    if (maxLeads <= 1000) return 'professional';
    return 'god';
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
        <div className="bg-gradient-to-r from-red-500 to-orange-500 p-6 text-white relative">
          {/* Only show X button if trial is not expired */}
          {!isExpired && (
            <button
              onClick={onClose}
              className="absolute top-4 right-4 text-white hover:text-gray-200 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="w-8 h-8" />
            <h2 className="text-2xl font-bold">
              {isExpired ? 'Trial Expired - Choose Your Plan' : 'Upgrade Your Trial'}
            </h2>
          </div>
          
          {isExpired ? (
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
              <h3 className="font-semibold text-gray-900 dark:text-white">Current Status</h3>
              <p className="text-sm text-gray-600 dark:text-gray-400">
                {currentPlanKey === 'trial' ? 'Free Trial' : 'Active Plan'} • {currentPlan?.maxLeadsPerMonth || 50} leads/month
              </p>
            </div>
            <div className="text-right">
              <div className={`inline-flex items-center px-3 py-1 rounded-full text-xs font-medium ${
                isExpired ? 'bg-red-100 text-red-800 dark:bg-red-900/20 dark:text-red-400' : 
                           'bg-orange-100 text-orange-800 dark:bg-orange-900/20 dark:text-orange-400'
              }`}>
                {isExpired ? 'Expired' : `${daysRemaining} days left`}
              </div>
            </div>
          </div>
        </div>

        {/* Pricing Tiers */}
        <div className="p-6">
          <h3 className="text-xl font-bold text-gray-900 dark:text-white mb-6 text-center">
            Choose Your Plan
          </h3>
          
          <div className="grid md:grid-cols-3 gap-6">
            {pricingTiers.map((tier) => {
              const isCurrentPlan = currentPlanKey === tier.planKey;
              const colors = getColorClasses(tier.color);
              
              return (
                <div
                  key={tier.name}
                  className={`relative rounded-xl border-2 p-6 transition-all ${
                    isCurrentPlan 
                      ? `${colors.border} ${colors.bg}` 
                      : 'border-gray-200 dark:border-gray-700 hover:border-gray-300 dark:hover:border-gray-600'
                  } ${tier.popular ? 'ring-2 ring-purple-500 ring-opacity-50' : ''}`}
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
                    disabled={isCurrentPlan}
                    className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
                      isCurrentPlan
                        ? 'bg-gray-100 text-gray-500 cursor-not-allowed dark:bg-gray-700 dark:text-gray-400'
                        : `${colors.button} text-white hover:shadow-lg`
                    }`}
                  >
                    <CreditCard className="w-4 h-4" />
                    {isCurrentPlan ? 'Current Plan' : `Upgrade to ${tier.name}`}
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
              className="text-gray-600 hover:text-gray-800 dark:text-gray-400 dark:hover:text-gray-200 text-sm font-medium mb-2"
            >
              Continue with trial ({daysRemaining} days left)
            </button>
          )}
          <p className="text-xs text-gray-500 dark:text-gray-400">
            All plans include a 14-day money-back guarantee. Cancel anytime.
          </p>
        </div>
      </div>
    </div>
  );
};

export default TrialExpiredModal;