import React, { useState } from 'react';
import './PromptGallery.css';

const PROMPT_CATEGORIES = [
  {
    name: 'Anime',
    icon: '🎨',
    prompts: [
      'Anime girl with pink hair,樱花背景, detailed eyes, soft lighting',
      'Anime boy in school uniform, blue eyes, dynamic pose, sunset',
      'Cute chibi characters, colorful candy land, kawaii style',
      'Anime warrior princess, silver armor, floating petals, epic',
      'Mecha robot pilot, cockpit view, neon city lights, cyberpunk'
    ]
  },
  {
    name: 'Realistic',
    icon: '📷',
    prompts: [
      'Professional portrait, studio lighting, natural makeup, 85mm lens',
      'Landscape photography, golden hour, mountains, crystal lake reflection',
      'Street photography, urban city life, bokeh lights, rainy night',
      'Food photography, gourmet dish, dramatic lighting, overhead shot',
      'Architecture photography, modern building, clean lines, blue sky'
    ]
  },
  {
    name: '3D Art',
    icon: '🎮',
    prompts: [
      '3D rendered character, Pixar style, cute and colorful, soft shadows',
      'Low poly landscape, geometric mountains, sunset gradient, stylized',
      '3D product visualization, glass material, studio lighting, clean bg',
      'Voxel art world, blocky trees, flowing river, pixel perfect',
      '3D cartoon scene, vibrant colors, playful composition, studio quality'
    ]
  },
  {
    name: 'Digital Art',
    icon: '✨',
    prompts: [
      'Digital painting, fantasy elf, forest sanctuary, ethereal glow',
      'Concept art character, cyberpunk style, neon lights, detailed armor',
      'Surrealist dream scene, floating islands, surreal clouds, Dali inspired',
      'Character design, witch with magic staff, mystical atmosphere, detailed robes',
      'Environmental concept art, alien planet, biopunk, strange flora'
    ]
  },
  {
    name: 'Abstract',
    icon: '🔮',
    prompts: [
      'Abstract art, flowing colors, iridescent waves, mesmerizing patterns',
      'Geometric abstraction, colorful shapes, modern art style, minimalist',
      'Fluid dynamics simulation, vibrant ink, artistic composition',
      'Particle system art, cosmic dust, star formation, space theme',
      'Generative art, algorithmic patterns, mathematical beauty, neon gradients'
    ]
  },
  {
    name: 'Portrait',
    icon: '👤',
    prompts: [
      'Beautiful woman portrait, natural lighting, soft focus, professional retouching',
      'Man with beard, dramatic lighting, cinematic, strong jawline',
      'Elderly person, wise eyes, document photography style, gray hair',
      'Child portrait, innocence, natural smile, outdoor lighting',
      'Couple portrait, romantic, golden hour, loving expressions'
    ]
  }
];

const PromptGallery = ({ onSelectPrompt }) => {
  const [activeCategory, setActiveCategory] = useState(0);
  const [searchTerm, setSearchTerm] = useState('');

  const filteredPrompts = searchTerm
    ? PROMPT_CATEGORIES.flatMap(cat => 
        cat.prompts.filter(p => 
          p.toLowerCase().includes(searchTerm.toLowerCase())
        ).map(prompt => ({ ...cat, prompt }))
      )
    : PROMPT_CATEGORIES[activeCategory]?.prompts.map(p => ({ ...PROMPT_CATEGORIES[activeCategory], prompt })) || [];

  const handlePromptClick = (prompt) => {
    if (onSelectPrompt) {
      onSelectPrompt(prompt);
    }
  };

  return (
    <div className="prompt-gallery">
      <div className="gallery-header">
        <h3>Prompt Gallery</h3>
        <input
          type="text"
          placeholder="Search prompts..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="search-input"
        />
      </div>

      {!searchTerm && (
        <div className="category-tabs">
          {PROMPT_CATEGORIES.map((category, index) => (
            <button
              key={category.name}
              className={`category-tab ${activeCategory === index ? 'active' : ''}`}
              onClick={() => setActiveCategory(index)}
            >
              <span className="category-icon">{category.icon}</span>
              <span className="category-name">{category.name}</span>
            </button>
          ))}
        </div>
      )}

      <div className="prompts-grid">
        {filteredPrompts.map((item, index) => (
          <div 
            key={`${item.name}-${index}`}
            className="prompt-card"
            onClick={() => handlePromptClick(item.prompt)}
          >
            <span className="prompt-icon">{item.icon}</span>
            <p className="prompt-text">{item.prompt}</p>
            <button className="use-btn">Use</button>
          </div>
        ))}
      </div>

      {filteredPrompts.length === 0 && (
        <div className="no-results">No prompts found. Try a different search.</div>
      )}
    </div>
  );
};

export default PromptGallery;
export { PROMPT_CATEGORIES };