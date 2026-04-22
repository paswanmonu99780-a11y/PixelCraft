import React, { useState, useEffect } from 'react';
import { fetchPlans, createPaymentOrder, verifyPayment } from '../utils/api';
import './PaymentModal.css';

const PaymentModal = ({ isOpen, onClose, userToken, onPaymentSuccess }) => {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [selectedPlan, setSelectedPlan] = useState(null);
  const [razorpayLoaded, setRazorpayLoaded] = useState(false);

  useEffect(() => {
    if (isOpen) {
      loadPlans();
      loadRazorpayScript();
    }
  }, [isOpen]);

  const loadPlans = async () => {
    try {
      const plansList = await fetchPlans();
      setPlans(plansList);
    } catch (err) {
      setError('Failed to load pricing plans');
    }
  };

  const loadRazorpayScript = () => {
    if (window.Razorpay) {
      setRazorpayLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => setRazorpayLoaded(true);
    document.body.appendChild(script);
  };

  const handlePurchase = async (plan) => {
    setLoading(true);
    setError('');
    setSelectedPlan(plan);

    try {
      // Create order
      const orderData = await createPaymentOrder(userToken, plan.id);

      // Open Razorpay
      const options = {
        key: process.env.REACT_APP_RAZORPAY_KEY_ID || 'your_key_id',
        amount: orderData.amount,
        currency: orderData.currency,
        name: 'PixelCraft AI',
        description: `${plan.name} Plan - ${plan.credits} Credits`,
        image: '/logo.png',
        order_id: orderData.orderId,
        handler: async (response) => {
          try {
            await verifyPayment(userToken, {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              planId: plan.id
            });
            onPaymentSuccess();
            onClose();
          } catch (err) {
            setError('Payment verification failed');
          }
        },
        prefill: {
          name: '',
          email: ''
        },
        theme: {
          color: '#6366f1'
        }
      };

      const rzp = new window.Razorpay(options);
      rzp.on('payment.failed', () => {
        setError('Payment failed. Please try again.');
      });
      rzp.open();
    } catch (err) {
      setError('Failed to initiate payment');
    } finally {
      setLoading(false);
      setSelectedPlan(null);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="payment-modal-overlay" onClick={onClose}>
      <div className="payment-modal" onClick={(e) => e.stopPropagation()}>
        <button className="close-btn" onClick={onClose}>×</button>
        
        <h2>Choose Your Plan</h2>
        <p className="subtitle">Unlock unlimited AI image generation</p>

        {error && <div className="error-message">{error}</div>}

        <div className="plans-grid">
          {plans.map((plan) => (
            <div 
              key={plan.id} 
              className={`plan-card ${plan.id === 'pro' ? 'popular' : ''}`}
            >
              {plan.id === 'pro' && <span className="popular-badge">Popular</span>}
              
              <h3>{plan.name}</h3>
              <div className="credits-value">{plan.credits}</div>
              <div className="credits-label">Credits</div>
              <div className="price">₹{plan.price}</div>
              
              <button 
                className="buy-btn"
                onClick={() => handlePurchase(plan)}
                disabled={loading}
              >
                {loading && selectedPlan?.id === plan.id ? 'Processing...' : 'Buy Now'}
              </button>
            </div>
          ))}
        </div>

        <div className="payment-features">
          <ul>
            <li>✓ Instant credit activation</li>
            <li>✓ No watermark on images</li>
            <li>✓ Priority generation queue</li>
            <li>✓ 24/7 customer support</li>
          </ul>
        </div>

        <p className="payment-note">
          Secure payment powered by Razorpay
        </p>
      </div>
    </div>
  );
};

export default PaymentModal;