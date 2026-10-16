import { useState } from 'react';

const wallpackTypes = [
  {
    id: 'daypack',
    name: 'Daypack',
    description: 'Wallpapers change throughout the day based on time',
    icon: '🌅',
    features: [
      'Time-based scheduling (dawn, morning, afternoon, dusk, night)',
      'Solar event support (sunrise, sunset)',
      'Multiple images per time block',
      'Automatic transitions'
    ],
    example: 'Morning landscapes, afternoon cityscapes, evening sunsets'
  },
  {
    id: 'weekpack',
    name: 'Weekpack',
    description: 'Different wallpapers for each day of the week',
    icon: '📅',
    features: [
      'Day-of-week scheduling',
      'Different themes per day',
      'Multiple images per day',
      'Weekly rotation'
    ],
    example: 'Work motivation on weekdays, adventure on weekends'
  },
  {
    id: 'album',
    name: 'Album',
    description: 'Simple collection of wallpapers that rotate or shuffle',
    icon: '🖼️',
    features: [
      'Simple image collection',
      'Random shuffle option',
      'Sequential rotation',
      'No time constraints'
    ],
    example: 'Nature photos, abstract art, gaming screenshots'
  }
];

export default function WallpackTypeSelector({ selectedType, onSelect }) {
  return (
    <div className="max-w-4xl mx-auto">
      <div className="text-center mb-8">
        <h2 className="text-3xl font-serif font-bold mb-4">Choose Your Wallpack Type</h2>
        <p className="text-white/80 text-lg">
          Select the type of wallpack you want to create. Each type has different scheduling capabilities.
        </p>
      </div>

      <div className="grid md:grid-cols-3 gap-6">
        {wallpackTypes.map((type) => (
          <div
            key={type.id}
            role="button"
            tabIndex={0}
            aria-pressed={selectedType === type.id}
            aria-label={type.name}
            onClick={() => onSelect(type.id)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onSelect(type.id);
              }
            }}
            className={`relative cursor-pointer rounded-lg border-2 p-6 transition-all duration-200 hover:scale-105 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/40 ${
              selectedType === type.id
                ? 'border-blue-500 bg-blue-500/10 shadow-lg shadow-blue-500/20'
                : 'border-white/20 bg-white/5 hover:border-white/30 hover:bg-white/10'
            }`}
          >
            {/* Selection indicator */}
            {selectedType === type.id && (
              <div className="absolute -top-2 -right-2 w-6 h-6 bg-blue-500 rounded-full flex items-center justify-center">
                <svg className="w-4 h-4 text-white" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                </svg>
              </div>
            )}

            {/* Icon */}
            <div className="text-4xl mb-4">{type.icon}</div>

            {/* Title and Description */}
            <h3 className="text-xl font-bold mb-2">{type.name}</h3>
            <p className="text-white/70 text-sm mb-4">{type.description}</p>

            {/* Features */}
            <div className="space-y-2 mb-4">
              {type.features.map((feature, index) => (
                <div key={index} className="flex items-start space-x-2">
                  <svg className="w-4 h-4 text-green-400 mt-0.5 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                  </svg>
                  <span className="text-sm text-white/80">{feature}</span>
                </div>
              ))}
            </div>

            {/* Example */}
            <div className="text-xs text-white/60 italic">
              Example: {type.example}
            </div>
          </div>
        ))}
      </div>

      {/* {selectedType && (
        <div className="mt-8 text-center">
          <div className="inline-flex items-center space-x-2 bg-blue-500/20 border border-blue-500/30 rounded-lg px-4 py-2">
            <svg className="w-5 h-5 text-blue-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
            <span className="text-blue-300">
              Selected: {wallpackTypes.find(t => t.id === selectedType)?.name}
            </span>
          </div>
        </div>
      )} */}
    </div>
  );
} 