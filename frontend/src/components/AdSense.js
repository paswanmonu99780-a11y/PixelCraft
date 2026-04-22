import React, { useEffect, useRef } from 'react';
import './AdSense.css';

const AdSense = ({ type = 'display', position = 'default', className = '' }) => {
  const adRef = useRef(null);
  const adUnitId = process.env.REACT_APP_ADSENSE_ID || 'ca-pub-XXXXXXXXXX';

  useEffect(() => {
    // Load Google AdSense script if not already loaded
    if (!window.adsbygoogle || !window.googlesag) {
      const script = document.createElement('script');
      script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adUnitId}`;
      script.crossOrigin = 'anonymous';
      script.async = true;
      document.head.appendChild(script);
    }
  }, [adUnitId]);

  const adFormats = {
    display: { height: 90, width: 728 },
    rectangle: { height: 250, width: 300 },
    leaderboard: { height: 60, width: 468 },
    wide_skyscraper: { height: 600, width: 160 },
    half_page: { height: 250, width: 300 },
    large_mobile_banner: { height: 100, width: 320 }
  };

  const adConfig = adFormats[type] || adFormats.display;

  return (
    <div className={`ad-container ${position} ${className}`}>
      <ins 
        ref={adRef}
        className="adsbygoogle"
        style={{
          display: 'block',
          width: adConfig.width,
          height: adConfig.height,
          margin: '0 auto'
        }}
        data-ad-client={adUnitId}
        data-ad-slot={process.env.REACT_APP_ADSENSE_SLOT || 'XXXXXXXXXX'}
        data-ad-format={type}
      />
    </div>
  );
};

// Ad placements
export const HomeAdBanner = () => <AdSense type="leaderboard" position="home" />;
export const ResultAdBanner = () => <AdSense type="banner" position="result" />;
export const SidebarAd = () => <AdSense type="wide_skyscraper" position="sidebar" />;

export default AdSense;
