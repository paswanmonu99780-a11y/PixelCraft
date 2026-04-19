import React from 'react';
import { Phone } from 'lucide-react';
import '../styles/AiHelpperWidget.css';





const AiHelpperWidget = () => {



  const openVoiceAssistant = () => {
    const voiceWindow = window.open(
      '/voice-assistant',
      'aiVoiceAssistant',
      'width=600,height=800,scrollbars=no,resizable=yes,status=no,toolbar=no,menubar=no'
    );

    if (voiceWindow) {
      voiceWindow.focus();
    }
  };

  return (
    <button
      type="button"
      className="ai-voice-call-button"
      onClick={openVoiceAssistant}
      aria-label="Open AI Voice Assistant"
      title="AI Voice Assistant - Click to start voice call"
    >
      <Phone size={20} />
      <span>AI Voice Call</span>
    </button>
  );
};

export default AiHelpperWidget;
